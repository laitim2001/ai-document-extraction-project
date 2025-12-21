# Story 12-4: 系統配置管理

## Story 資訊
- **Story ID**: 12-4
- **Epic**: Epic 12 - 系統管理與監控
- **優先級**: High
- **預估點數**: 8
- **FR 覆蓋**: FR62

## User Story
**As a** 系統管理員,
**I want** 管理系統配置參數,
**So that** 我可以調整系統行為而不需要重新部署。

## Acceptance Criteria

### AC 12-4-1: 配置參數分類列表
```gherkin
Given 系統管理員在配置管理頁面
When 查看系統配置
Then 顯示可配置參數分類列表：
  - 處理參數（信心度閾值、自動通過閾值）
  - 整合設定（AI 服務參數、n8n 連線）
  - 安全設定（Session 超時、密碼策略）
  - 通知設定（Email SMTP、Teams Webhook）
```

### AC 12-4-2: 參數編輯介面
```gherkin
Given 配置參數
When 編輯某個參數
Then 顯示：
  - 參數名稱和描述
  - 當前值和預設值
  - 允許的值範圍或選項
  - 變更影響說明
```

### AC 12-4-3: 配置保存與驗證
```gherkin
Given 修改配置
When 點擊「儲存」
Then 系統驗證配置值
And 如果驗證失敗顯示錯誤訊息
And 如果驗證成功則：
  - 儲存新配置
  - 記錄變更至審計日誌
  - 立即生效或提示需要重啟
```

### AC 12-4-4: 敏感配置保護
```gherkin
Given 敏感配置（如密鑰）
When 顯示或編輯
Then 值以遮罩方式顯示
And 變更需要二次確認
```

### AC 12-4-5: 配置變更歷史與回滾
```gherkin
Given 配置變更歷史
When 需要查看或回滾
Then 顯示變更歷史：
  - 變更時間、變更人
  - 變更前後的值
  - 提供「回滾」按鈕
```

## Technical Specifications

### 1. Prisma Data Models

```prisma
// 系統配置類別
enum ConfigCategory {
  PROCESSING     // 處理參數
  INTEGRATION    // 整合設定
  SECURITY       // 安全設定
  NOTIFICATION   // 通知設定
  SYSTEM         // 系統設定
}

// 配置值類型
enum ConfigValueType {
  STRING
  NUMBER
  BOOLEAN
  JSON
  SECRET        // 加密儲存
  ENUM          // 預定義選項
}

// 配置效果類型
enum ConfigEffectType {
  IMMEDIATE      // 立即生效
  RESTART_REQUIRED  // 需要重啟
  SCHEDULED      // 排程生效
}

// 系統配置
model SystemConfig {
  id           String           @id @default(cuid())
  key          String           @unique
  value        String           // JSON 編碼值，敏感值加密
  defaultValue String           // 預設值

  // 元資料
  category     ConfigCategory
  valueType    ConfigValueType
  effectType   ConfigEffectType @default(IMMEDIATE)

  // 描述與約束
  name         String           // 顯示名稱
  description  String           // 參數描述
  impactNote   String?          // 變更影響說明

  // 驗證規則 (JSON)
  validation   Json?            // {min, max, pattern, options, required}

  // 元資料
  isEncrypted  Boolean          @default(false)
  isReadOnly   Boolean          @default(false)  // 唯讀參數
  sortOrder    Int              @default(0)

  // 審計
  updatedAt    DateTime         @updatedAt
  updatedBy    String?
  updatedByUser User?           @relation(fields: [updatedBy], references: [id])

  // 關聯
  history      ConfigHistory[]

  @@index([category])
  @@index([key])
}

// 配置變更歷史
model ConfigHistory {
  id           String       @id @default(cuid())
  configId     String
  config       SystemConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  // 變更內容
  previousValue String      // 變更前的值
  newValue      String      // 變更後的值

  // 審計
  changedAt    DateTime     @default(now())
  changedBy    String
  changedByUser User        @relation(fields: [changedBy], references: [id])

  // 變更原因
  changeReason String?

  // 回滾資訊
  isRollback   Boolean      @default(false)
  rollbackFrom String?      // 從哪個版本回滾

  @@index([configId, changedAt])
  @@index([changedAt])
}

// 配置預設值種子 (用於初始化)
model ConfigSeed {
  id           String          @id @default(cuid())
  key          String          @unique
  defaultValue String
  category     ConfigCategory
  valueType    ConfigValueType
  effectType   ConfigEffectType
  name         String
  description  String
  impactNote   String?
  validation   Json?
  isEncrypted  Boolean         @default(false)
  sortOrder    Int             @default(0)
}
```

### 2. 配置服務

```typescript
// services/config/config.service.ts
import { PrismaClient, ConfigCategory, ConfigValueType, ConfigEffectType } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

// 加密設定
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY!;

interface ConfigValue {
  key: string;
  value: any;
  name: string;
  description: string;
  category: ConfigCategory;
  valueType: ConfigValueType;
  effectType: ConfigEffectType;
  defaultValue: any;
  validation?: ConfigValidation;
  impactNote?: string;
  isEncrypted: boolean;
  isReadOnly: boolean;
  updatedAt: Date;
  updatedBy?: string;
}

interface ConfigValidation {
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  required?: boolean;
}

interface ConfigUpdateInput {
  value: any;
  changeReason?: string;
}

interface ConfigListOptions {
  category?: ConfigCategory;
  search?: string;
}

// 配置快取 (熱載入用)
class ConfigCache {
  private cache: Map<string, any> = new Map();
  private lastRefresh: Date = new Date(0);
  private refreshInterval = 60000; // 1 分鐘

  async get(key: string): Promise<any> {
    if (this.shouldRefresh()) {
      await this.refresh();
    }
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    this.lastRefresh = new Date(0);
  }

  private shouldRefresh(): boolean {
    return Date.now() - this.lastRefresh.getTime() > this.refreshInterval;
  }

  private async refresh(): Promise<void> {
    const configs = await prisma.systemConfig.findMany();
    this.cache.clear();
    for (const config of configs) {
      const value = decryptIfNeeded(config.value, config.isEncrypted);
      this.cache.set(config.key, parseConfigValue(value, config.valueType));
    }
    this.lastRefresh = new Date();
  }
}

const configCache = new ConfigCache();

// 加密函數
function encryptValue(value: string): string {
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// 解密函數
function decryptValue(encrypted: string): string {
  const [ivHex, authTagHex, data] = encrypted.split(':');
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function decryptIfNeeded(value: string, isEncrypted: boolean): string {
  if (isEncrypted) {
    return decryptValue(value);
  }
  return value;
}

function parseConfigValue(value: string, valueType: ConfigValueType): any {
  switch (valueType) {
    case 'NUMBER':
      return parseFloat(value);
    case 'BOOLEAN':
      return value === 'true';
    case 'JSON':
      return JSON.parse(value);
    default:
      return value;
  }
}

function stringifyConfigValue(value: any, valueType: ConfigValueType): string {
  switch (valueType) {
    case 'NUMBER':
    case 'BOOLEAN':
      return String(value);
    case 'JSON':
      return JSON.stringify(value);
    default:
      return value;
  }
}

export class SystemConfigService {
  /**
   * 取得配置列表（依類別分組）
   */
  async listConfigs(options: ConfigListOptions = {}): Promise<Record<ConfigCategory, ConfigValue[]>> {
    const { category, search } = options;

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const configs = await prisma.systemConfig.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        updatedByUser: {
          select: { id: true, displayName: true },
        },
      },
    });

    // 依類別分組
    const grouped: Record<ConfigCategory, ConfigValue[]> = {
      PROCESSING: [],
      INTEGRATION: [],
      SECURITY: [],
      NOTIFICATION: [],
      SYSTEM: [],
    };

    for (const config of configs) {
      const decryptedValue = decryptIfNeeded(config.value, config.isEncrypted);
      const parsedValue = parseConfigValue(decryptedValue, config.valueType);
      const defaultValue = parseConfigValue(config.defaultValue, config.valueType);

      const configValue: ConfigValue = {
        key: config.key,
        value: config.isEncrypted ? '••••••••' : parsedValue, // 敏感值遮罩
        name: config.name,
        description: config.description,
        category: config.category,
        valueType: config.valueType,
        effectType: config.effectType,
        defaultValue,
        validation: config.validation as ConfigValidation,
        impactNote: config.impactNote || undefined,
        isEncrypted: config.isEncrypted,
        isReadOnly: config.isReadOnly,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedByUser?.displayName,
      };

      grouped[config.category].push(configValue);
    }

    return grouped;
  }

  /**
   * 取得單一配置值
   */
  async getConfig(key: string): Promise<ConfigValue | null> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
      include: {
        updatedByUser: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!config) return null;

    const decryptedValue = decryptIfNeeded(config.value, config.isEncrypted);
    const parsedValue = parseConfigValue(decryptedValue, config.valueType);
    const defaultValue = parseConfigValue(config.defaultValue, config.valueType);

    return {
      key: config.key,
      value: parsedValue,
      name: config.name,
      description: config.description,
      category: config.category,
      valueType: config.valueType,
      effectType: config.effectType,
      defaultValue,
      validation: config.validation as ConfigValidation,
      impactNote: config.impactNote || undefined,
      isEncrypted: config.isEncrypted,
      isReadOnly: config.isReadOnly,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedByUser?.displayName,
    };
  }

  /**
   * 取得配置值（快取版本，用於運行時）
   */
  async getValue<T>(key: string, defaultValue?: T): Promise<T> {
    const cached = await configCache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const config = await this.getConfig(key);
    if (config) {
      configCache.set(key, config.value);
      return config.value as T;
    }

    return defaultValue as T;
  }

  /**
   * 更新配置值
   */
  async updateConfig(
    key: string,
    input: ConfigUpdateInput,
    userId: string
  ): Promise<{ success: boolean; requiresRestart: boolean; error?: string }> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return { success: false, requiresRestart: false, error: '配置不存在' };
    }

    if (config.isReadOnly) {
      return { success: false, requiresRestart: false, error: '此配置為唯讀' };
    }

    // 驗證值
    const validation = config.validation as ConfigValidation;
    const validationError = this.validateValue(input.value, config.valueType, validation);
    if (validationError) {
      return { success: false, requiresRestart: false, error: validationError };
    }

    // 序列化值
    let newValue = stringifyConfigValue(input.value, config.valueType);

    // 加密敏感值
    if (config.isEncrypted) {
      newValue = encryptValue(newValue);
    }

    // 記錄變更歷史
    const previousValue = config.value;

    await prisma.$transaction([
      // 更新配置
      prisma.systemConfig.update({
        where: { key },
        data: {
          value: newValue,
          updatedBy: userId,
        },
      }),
      // 記錄歷史
      prisma.configHistory.create({
        data: {
          configId: config.id,
          previousValue: config.isEncrypted ? '••••••••' : previousValue,
          newValue: config.isEncrypted ? '••••••••' : newValue,
          changedBy: userId,
          changeReason: input.changeReason,
        },
      }),
    ]);

    // 清除快取
    configCache.invalidate(key);

    // 記錄審計日誌
    await this.logConfigChange(key, config.name, userId);

    return {
      success: true,
      requiresRestart: config.effectType === 'RESTART_REQUIRED',
    };
  }

  /**
   * 回滾配置到特定版本
   */
  async rollbackConfig(
    key: string,
    historyId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return { success: false, error: '配置不存在' };
    }

    const historyRecord = await prisma.configHistory.findUnique({
      where: { id: historyId },
    });

    if (!historyRecord || historyRecord.configId !== config.id) {
      return { success: false, error: '歷史記錄不存在' };
    }

    // 執行回滾
    await prisma.$transaction([
      prisma.systemConfig.update({
        where: { key },
        data: {
          value: historyRecord.previousValue,
          updatedBy: userId,
        },
      }),
      prisma.configHistory.create({
        data: {
          configId: config.id,
          previousValue: config.value,
          newValue: historyRecord.previousValue,
          changedBy: userId,
          changeReason: `回滾至 ${historyRecord.changedAt.toISOString()}`,
          isRollback: true,
          rollbackFrom: historyId,
        },
      }),
    ]);

    configCache.invalidate(key);

    return { success: true };
  }

  /**
   * 取得配置變更歷史
   */
  async getConfigHistory(
    key: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    history: Array<{
      id: string;
      previousValue: string;
      newValue: string;
      changedAt: Date;
      changedBy: string;
      changeReason?: string;
      isRollback: boolean;
    }>;
    total: number;
  }> {
    const { limit = 20, offset = 0 } = options;

    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return { history: [], total: 0 };
    }

    const [history, total] = await Promise.all([
      prisma.configHistory.findMany({
        where: { configId: config.id },
        orderBy: { changedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          changedByUser: {
            select: { displayName: true },
          },
        },
      }),
      prisma.configHistory.count({
        where: { configId: config.id },
      }),
    ]);

    return {
      history: history.map((h) => ({
        id: h.id,
        previousValue: h.previousValue,
        newValue: h.newValue,
        changedAt: h.changedAt,
        changedBy: h.changedByUser.displayName,
        changeReason: h.changeReason || undefined,
        isRollback: h.isRollback,
      })),
      total,
    };
  }

  /**
   * 重置配置為預設值
   */
  async resetToDefault(key: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return { success: false, error: '配置不存在' };
    }

    let defaultValue = config.defaultValue;
    if (config.isEncrypted) {
      defaultValue = encryptValue(defaultValue);
    }

    await prisma.$transaction([
      prisma.systemConfig.update({
        where: { key },
        data: {
          value: defaultValue,
          updatedBy: userId,
        },
      }),
      prisma.configHistory.create({
        data: {
          configId: config.id,
          previousValue: config.value,
          newValue: config.defaultValue,
          changedBy: userId,
          changeReason: '重置為預設值',
        },
      }),
    ]);

    configCache.invalidate(key);

    return { success: true };
  }

  /**
   * 驗證配置值
   */
  private validateValue(
    value: any,
    valueType: ConfigValueType,
    validation?: ConfigValidation
  ): string | null {
    if (!validation) return null;

    // 必填驗證
    if (validation.required && (value === null || value === undefined || value === '')) {
      return '此配置為必填';
    }

    // 數值範圍驗證
    if (valueType === 'NUMBER') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return '必須為數值';
      }
      if (validation.min !== undefined && numValue < validation.min) {
        return `最小值為 ${validation.min}`;
      }
      if (validation.max !== undefined && numValue > validation.max) {
        return `最大值為 ${validation.max}`;
      }
    }

    // 正則表達式驗證
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return '格式不正確';
      }
    }

    // 選項驗證
    if (validation.options && !validation.options.includes(String(value))) {
      return `必須是以下選項之一: ${validation.options.join(', ')}`;
    }

    return null;
  }

  /**
   * 記錄配置變更至審計日誌
   */
  private async logConfigChange(key: string, name: string, userId: string): Promise<void> {
    // 整合審計日誌服務
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CONFIG_UPDATE',
        resourceType: 'SystemConfig',
        resourceId: key,
        description: `更新系統配置: ${name}`,
      },
    });
  }

  /**
   * 重新載入所有配置（熱載入）
   */
  async reloadAllConfigs(): Promise<void> {
    configCache.invalidate();
    // 觸發重新載入事件
    // 可以通過 EventEmitter 或 WebSocket 通知其他服務
  }

  /**
   * 匯出所有配置（排除敏感值）
   */
  async exportConfigs(): Promise<Record<string, any>> {
    const configs = await prisma.systemConfig.findMany({
      where: { isEncrypted: false },
    });

    const exported: Record<string, any> = {};
    for (const config of configs) {
      exported[config.key] = parseConfigValue(config.value, config.valueType);
    }

    return exported;
  }

  /**
   * 批量匯入配置
   */
  async importConfigs(
    configs: Record<string, any>,
    userId: string
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const [key, value] of Object.entries(configs)) {
      const result = await this.updateConfig(key, { value, changeReason: '批量匯入' }, userId);
      if (result.success) {
        imported++;
      } else {
        errors.push(`${key}: ${result.error}`);
      }
    }

    return { imported, errors };
  }
}
```

### 3. API Routes

```typescript
// app/api/admin/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

// GET /api/admin/config - 取得配置列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as any;
  const search = searchParams.get('search') || undefined;

  const configs = await configService.listConfigs({ category, search });

  return NextResponse.json({ configs });
}
```

```typescript
// app/api/admin/config/[key]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

// GET /api/admin/config/:key - 取得單一配置
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const config = await configService.getConfig(params.key);

  if (!config) {
    return NextResponse.json({ error: '配置不存在' }, { status: 404 });
  }

  return NextResponse.json({ config });
}

// PUT /api/admin/config/:key - 更新配置
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const body = await request.json();
  const { value, changeReason } = body;

  const result = await configService.updateConfig(
    params.key,
    { value, changeReason },
    session.user.id
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: '配置已更新',
    requiresRestart: result.requiresRestart,
  });
}
```

```typescript
// app/api/admin/config/[key]/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

// GET /api/admin/config/:key/history - 取得變更歷史
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const result = await configService.getConfigHistory(params.key, { limit, offset });

  return NextResponse.json(result);
}
```

```typescript
// app/api/admin/config/[key]/rollback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

// POST /api/admin/config/:key/rollback - 回滾配置
export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const body = await request.json();
  const { historyId } = body;

  const result = await configService.rollbackConfig(
    params.key,
    historyId,
    session.user.id
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ message: '配置已回滾' });
}
```

```typescript
// app/api/admin/config/[key]/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

// POST /api/admin/config/:key/reset - 重置為預設值
export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const result = await configService.resetToDefault(params.key, session.user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ message: '配置已重置為預設值' });
}
```

### 4. React Components

```typescript
// components/admin/config/ConfigManagement.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ConfigCategory } from '@prisma/client';

interface ConfigValue {
  key: string;
  value: any;
  name: string;
  description: string;
  category: ConfigCategory;
  valueType: string;
  effectType: string;
  defaultValue: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
    required?: boolean;
  };
  impactNote?: string;
  isEncrypted: boolean;
  isReadOnly: boolean;
  updatedAt: string;
  updatedBy?: string;
}

interface ConfigHistoryItem {
  id: string;
  previousValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string;
  changeReason?: string;
  isRollback: boolean;
}

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  PROCESSING: '處理參數',
  INTEGRATION: '整合設定',
  SECURITY: '安全設定',
  NOTIFICATION: '通知設定',
  SYSTEM: '系統設定',
};

const CATEGORY_ICONS: Record<ConfigCategory, string> = {
  PROCESSING: '⚙️',
  INTEGRATION: '🔗',
  SECURITY: '🔒',
  NOTIFICATION: '📧',
  SYSTEM: '🖥️',
};

export function ConfigManagement() {
  const [configs, setConfigs] = useState<Record<ConfigCategory, ConfigValue[]>>({
    PROCESSING: [],
    INTEGRATION: [],
    SECURITY: [],
    NOTIFICATION: [],
    SYSTEM: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ConfigCategory | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConfigValue | null>(null);
  const [historyConfig, setHistoryConfig] = useState<string | null>(null);
  const [history, setHistory] = useState<ConfigHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConfigs();
  }, [searchTerm]);

  const fetchConfigs = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/config?${params}`);
      const data = await response.json();
      setConfigs(data.configs);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (key: string) => {
    try {
      const response = await fetch(`/api/admin/config/${key}/history`);
      const data = await response.json();
      setHistory(data.history);
      setHistoryConfig(key);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const handleSaveConfig = async (key: string, value: any, changeReason: string) => {
    try {
      const response = await fetch(`/api/admin/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, changeReason }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresRestart) {
          alert('配置已更新，需要重啟服務才能生效');
        } else {
          alert('配置已更新');
        }
        setEditingConfig(null);
        fetchConfigs();
      } else {
        alert(`更新失敗: ${data.error}`);
      }
    } catch (error) {
      alert('更新失敗');
    }
  };

  const handleRollback = async (key: string, historyId: string) => {
    if (!confirm('確定要回滾此配置嗎？')) return;

    try {
      const response = await fetch(`/api/admin/config/${key}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });

      if (response.ok) {
        alert('配置已回滾');
        fetchConfigs();
        fetchHistory(key);
      } else {
        const data = await response.json();
        alert(`回滾失敗: ${data.error}`);
      }
    } catch (error) {
      alert('回滾失敗');
    }
  };

  const handleResetToDefault = async (key: string) => {
    if (!confirm('確定要重置為預設值嗎？')) return;

    try {
      const response = await fetch(`/api/admin/config/${key}/reset`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('配置已重置為預設值');
        fetchConfigs();
      } else {
        const data = await response.json();
        alert(`重置失敗: ${data.error}`);
      }
    } catch (error) {
      alert('重置失敗');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">系統配置管理</h1>
        <input
          type="text"
          placeholder="搜尋配置..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        />
      </div>

      {/* 類別標籤 */}
      <div className="flex space-x-2 mb-6">
        {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(
              selectedCategory === category ? null : category as ConfigCategory
            )}
            className={`px-4 py-2 rounded-lg ${
              selectedCategory === category
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_ICONS[category as ConfigCategory]} {label}
          </button>
        ))}
      </div>

      {/* 配置列表 */}
      <div className="space-y-6">
        {Object.entries(configs)
          .filter(([category]) => !selectedCategory || category === selectedCategory)
          .map(([category, categoryConfigs]) => (
            categoryConfigs.length > 0 && (
              <div key={category} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {CATEGORY_ICONS[category as ConfigCategory]} {CATEGORY_LABELS[category as ConfigCategory]}
                </h2>
                <div className="space-y-4">
                  {categoryConfigs.map((config) => (
                    <ConfigItem
                      key={config.key}
                      config={config}
                      onEdit={() => setEditingConfig(config)}
                      onViewHistory={() => fetchHistory(config.key)}
                      onResetToDefault={() => handleResetToDefault(config.key)}
                    />
                  ))}
                </div>
              </div>
            )
          ))}
      </div>

      {/* 編輯對話框 */}
      {editingConfig && (
        <ConfigEditModal
          config={editingConfig}
          onSave={handleSaveConfig}
          onClose={() => setEditingConfig(null)}
        />
      )}

      {/* 歷史對話框 */}
      {historyConfig && (
        <ConfigHistoryModal
          configKey={historyConfig}
          history={history}
          onRollback={handleRollback}
          onClose={() => setHistoryConfig(null)}
        />
      )}
    </div>
  );
}

interface ConfigItemProps {
  config: ConfigValue;
  onEdit: () => void;
  onViewHistory: () => void;
  onResetToDefault: () => void;
}

function ConfigItem({ config, onEdit, onViewHistory, onResetToDefault }: ConfigItemProps) {
  const isModified = config.value !== config.defaultValue;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{config.name}</span>
          {config.isReadOnly && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">唯讀</span>
          )}
          {config.isEncrypted && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 text-xs rounded">🔐 加密</span>
          )}
          {isModified && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">已修改</span>
          )}
          {config.effectType === 'RESTART_REQUIRED' && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">需重啟</span>
          )}
        </div>
        <p className="text-sm text-gray-500">{config.description}</p>
        <div className="mt-1 text-sm">
          <span className="text-gray-400">目前值: </span>
          <span className="font-mono">{String(config.value)}</span>
          {isModified && (
            <span className="ml-2 text-gray-400">(預設: {String(config.defaultValue)})</span>
          )}
        </div>
        {config.impactNote && (
          <p className="mt-1 text-xs text-orange-600">⚠️ {config.impactNote}</p>
        )}
        {config.updatedBy && (
          <p className="mt-1 text-xs text-gray-400">
            最後更新: {config.updatedBy} ({new Date(config.updatedAt).toLocaleString()})
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onViewHistory}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          歷史
        </button>
        {!config.isReadOnly && (
          <>
            <button
              onClick={onResetToDefault}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              disabled={!isModified}
            >
              重置
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
            >
              編輯
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface ConfigEditModalProps {
  config: ConfigValue;
  onSave: (key: string, value: any, changeReason: string) => void;
  onClose: () => void;
}

function ConfigEditModal({ config, onSave, onClose }: ConfigEditModalProps) {
  const [value, setValue] = useState(String(config.value));
  const [changeReason, setChangeReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = () => {
    if (config.isEncrypted && !confirmed) {
      alert('請確認您要更改敏感配置');
      return;
    }

    let parsedValue: any = value;
    if (config.valueType === 'NUMBER') {
      parsedValue = parseFloat(value);
    } else if (config.valueType === 'BOOLEAN') {
      parsedValue = value === 'true';
    } else if (config.valueType === 'JSON') {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        alert('JSON 格式不正確');
        return;
      }
    }

    onSave(config.key, parsedValue, changeReason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">編輯配置: {config.name}</h2>

        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">{config.description}</p>
          {config.impactNote && (
            <p className="text-sm text-orange-600 mb-2">⚠️ {config.impactNote}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">值</label>
          {config.valueType === 'BOOLEAN' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="true">是 (true)</option>
              <option value="false">否 (false)</option>
            </select>
          ) : config.validation?.options ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              {config.validation.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : config.valueType === 'JSON' ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border rounded font-mono text-sm"
            />
          ) : (
            <input
              type={config.valueType === 'NUMBER' ? 'number' : config.isEncrypted ? 'password' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min={config.validation?.min}
              max={config.validation?.max}
              className="w-full px-3 py-2 border rounded"
            />
          )}
          {config.validation?.min !== undefined && config.validation?.max !== undefined && (
            <p className="text-xs text-gray-400 mt-1">
              範圍: {config.validation.min} - {config.validation.max}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">變更原因 (選填)</label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="說明為何要變更此配置..."
          />
        </div>

        {config.isEncrypted && (
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="text-sm">我確認要更改此敏感配置</span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfigHistoryModalProps {
  configKey: string;
  history: ConfigHistoryItem[];
  onRollback: (key: string, historyId: string) => void;
  onClose: () => void;
}

function ConfigHistoryModal({ configKey, history, onRollback, onClose }: ConfigHistoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <h2 className="text-xl font-bold mb-4">變更歷史</h2>

        {history.length === 0 ? (
          <p className="text-gray-500">暫無變更記錄</p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {new Date(item.changedAt).toLocaleString()}
                      </span>
                      {item.isRollback && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">
                          回滾
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">變更者: {item.changedBy}</p>
                    {item.changeReason && (
                      <p className="text-sm text-gray-600 mt-1">原因: {item.changeReason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRollback(configKey, item.id)}
                    className="px-3 py-1 text-sm bg-orange-100 hover:bg-orange-200 text-orange-600 rounded"
                  >
                    回滾到此版本
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">變更前: </span>
                    <span className="font-mono bg-red-50 px-1 rounded">{item.previousValue}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">變更後: </span>
                    <span className="font-mono bg-green-50 px-1 rounded">{item.newValue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigManagement;
```

### 5. Unit Tests

```typescript
// __tests__/services/config.service.test.ts
import { SystemConfigService } from '@/services/config/config.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new SystemConfigService();
  });

  describe('getConfig', () => {
    it('should return config value for existing key', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        defaultValue: '0.8',
        category: 'PROCESSING',
        valueType: 'NUMBER',
        effectType: 'IMMEDIATE',
        name: '信心度閾值',
        description: '自動審核的信心度閾值',
        isEncrypted: false,
        isReadOnly: false,
        updatedAt: new Date(),
        updatedBy: null,
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getConfig('processing.confidence_threshold');

      expect(result).toBeDefined();
      expect(result?.value).toBe(0.85);
      expect(result?.defaultValue).toBe(0.8);
    });

    it('should return null for non-existent key', async () => {
      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getConfig('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update config and create history record', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        defaultValue: '0.8',
        category: 'PROCESSING',
        valueType: 'NUMBER',
        effectType: 'IMMEDIATE',
        isEncrypted: false,
        isReadOnly: false,
        validation: { min: 0, max: 1 },
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateConfig(
        'processing.confidence_threshold',
        { value: 0.9, changeReason: '調整閾值' },
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.requiresRestart).toBe(false);
    });

    it('should reject read-only config updates', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'system.version',
        value: '1.0.0',
        isReadOnly: true,
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.updateConfig(
        'system.version',
        { value: '2.0.0' },
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('此配置為唯讀');
    });

    it('should validate number range', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        valueType: 'NUMBER',
        isReadOnly: false,
        validation: { min: 0, max: 1 },
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.updateConfig(
        'processing.confidence_threshold',
        { value: 1.5 },
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('最大值為 1');
    });
  });

  describe('rollbackConfig', () => {
    it('should rollback to previous value', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.9',
      };

      const mockHistory = {
        id: 'history-1',
        configId: 'config-1',
        previousValue: '0.85',
        newValue: '0.9',
        changedAt: new Date(),
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (mockPrisma.configHistory.findUnique as jest.Mock).mockResolvedValue(mockHistory);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const result = await service.rollbackConfig(
        'processing.confidence_threshold',
        'history-1',
        'user-1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('validateValue', () => {
    it('should validate required field', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'test',
        value: 'value',
        valueType: 'STRING',
        isReadOnly: false,
        validation: { required: true },
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.updateConfig(
        'test',
        { value: '' },
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('此配置為必填');
    });

    it('should validate enum options', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'notification.channel',
        value: 'email',
        valueType: 'ENUM',
        isReadOnly: false,
        validation: { options: ['email', 'teams', 'webhook'] },
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.updateConfig(
        'notification.channel',
        { value: 'sms' },
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須是以下選項之一');
    });
  });

  describe('resetToDefault', () => {
    it('should reset config to default value', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.9',
        defaultValue: '0.8',
        isEncrypted: false,
      };

      (mockPrisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const result = await service.resetToDefault(
        'processing.confidence_threshold',
        'user-1'
      );

      expect(result.success).toBe(true);
    });
  });
});
```

### 6. 配置種子資料

```typescript
// prisma/seeds/config-seeds.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const configSeeds = [
  // 處理參數
  {
    key: 'processing.confidence_threshold',
    defaultValue: '0.8',
    category: 'PROCESSING',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '信心度閾值',
    description: 'AI 提取結果需要人工審核的信心度閾值',
    impactNote: '降低此值會增加需要人工審核的發票數量',
    validation: { min: 0, max: 1, required: true },
    sortOrder: 1,
  },
  {
    key: 'processing.auto_approve_threshold',
    defaultValue: '0.95',
    category: 'PROCESSING',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '自動通過閾值',
    description: '高於此信心度的發票將自動通過審核',
    impactNote: '提高此值會減少自動通過的發票數量',
    validation: { min: 0, max: 1, required: true },
    sortOrder: 2,
  },
  {
    key: 'processing.max_file_size_mb',
    defaultValue: '50',
    category: 'PROCESSING',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '最大檔案大小 (MB)',
    description: '允許上傳的最大檔案大小',
    validation: { min: 1, max: 500, required: true },
    sortOrder: 3,
  },

  // 整合設定
  {
    key: 'integration.ai.provider',
    defaultValue: 'azure-openai',
    category: 'INTEGRATION',
    valueType: 'ENUM',
    effectType: 'IMMEDIATE',
    name: 'AI 服務提供者',
    description: '使用的 AI 服務提供者',
    validation: { options: ['azure-openai', 'openai', 'custom'] },
    sortOrder: 1,
  },
  {
    key: 'integration.ai.api_key',
    defaultValue: '',
    category: 'INTEGRATION',
    valueType: 'SECRET',
    effectType: 'IMMEDIATE',
    name: 'AI API 金鑰',
    description: 'AI 服務的 API 金鑰',
    isEncrypted: true,
    sortOrder: 2,
  },
  {
    key: 'integration.n8n.base_url',
    defaultValue: 'http://localhost:5678',
    category: 'INTEGRATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'n8n 基礎 URL',
    description: 'n8n 服務的基礎 URL',
    validation: { pattern: '^https?://' },
    sortOrder: 3,
  },

  // 安全設定
  {
    key: 'security.session_timeout_minutes',
    defaultValue: '60',
    category: 'SECURITY',
    valueType: 'NUMBER',
    effectType: 'RESTART_REQUIRED',
    name: 'Session 超時時間 (分鐘)',
    description: '用戶閒置多久後自動登出',
    impactNote: '變更此設定需要重啟服務',
    validation: { min: 5, max: 480, required: true },
    sortOrder: 1,
  },
  {
    key: 'security.password_min_length',
    defaultValue: '8',
    category: 'SECURITY',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '密碼最小長度',
    description: '用戶密碼的最小長度要求',
    validation: { min: 6, max: 32, required: true },
    sortOrder: 2,
  },
  {
    key: 'security.max_login_attempts',
    defaultValue: '5',
    category: 'SECURITY',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '最大登入嘗試次數',
    description: '帳戶鎖定前允許的登入失敗次數',
    validation: { min: 3, max: 10, required: true },
    sortOrder: 3,
  },

  // 通知設定
  {
    key: 'notification.email.smtp_host',
    defaultValue: '',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'SMTP 主機',
    description: '郵件伺服器主機地址',
    sortOrder: 1,
  },
  {
    key: 'notification.email.smtp_port',
    defaultValue: '587',
    category: 'NOTIFICATION',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: 'SMTP 連接埠',
    description: '郵件伺服器連接埠',
    validation: { min: 1, max: 65535 },
    sortOrder: 2,
  },
  {
    key: 'notification.teams.webhook_url',
    defaultValue: '',
    category: 'NOTIFICATION',
    valueType: 'SECRET',
    effectType: 'IMMEDIATE',
    name: 'Teams Webhook URL',
    description: 'Microsoft Teams 的 Webhook URL',
    isEncrypted: true,
    sortOrder: 3,
  },

  // 系統設定
  {
    key: 'system.log_level',
    defaultValue: 'info',
    category: 'SYSTEM',
    valueType: 'ENUM',
    effectType: 'IMMEDIATE',
    name: '日誌級別',
    description: '系統日誌的記錄級別',
    validation: { options: ['debug', 'info', 'warn', 'error'] },
    sortOrder: 1,
  },
  {
    key: 'system.log_retention_days',
    defaultValue: '30',
    category: 'SYSTEM',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '日誌保留天數',
    description: '系統日誌保留的天數',
    validation: { min: 7, max: 365, required: true },
    sortOrder: 2,
  },
];

export async function seedConfigs() {
  for (const config of configSeeds) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        ...config,
        value: config.defaultValue,
        isEncrypted: config.isEncrypted || false,
        isReadOnly: false,
      },
    });
  }

  console.log('✅ System configs seeded');
}
```

## Dependencies

### 前置 Stories
- **Story 1-0**: 專案初始化與基礎架構
- **Story 8-1**: 審計日誌記錄

### 技術依賴
- PostgreSQL 資料庫
- AES-256-GCM 加密
- Next.js App Router
- React 狀態管理

## Verification Checklist

### 功能驗證
- [ ] 配置列表依類別正確分組顯示
- [ ] 配置編輯表單顯示正確的欄位類型
- [ ] 數值範圍驗證正確運作
- [ ] 敏感配置以遮罩方式顯示
- [ ] 配置變更正確記錄至審計日誌
- [ ] 配置回滾功能正確運作
- [ ] 重置為預設值功能正確運作
- [ ] 需要重啟的配置有正確提示

### 安全驗證
- [ ] 敏感配置值加密儲存
- [ ] 僅系統管理員可存取配置管理
- [ ] 二次確認機制正確運作

### 效能驗證
- [x] 配置快取正確運作
- [x] 熱載入機制正確運作

---

## Implementation Summary

**Completed**: 2025-12-21

### Files Created/Modified

#### Prisma Schema
- `prisma/schema.prisma` - Added SystemConfig, ConfigHistory models and related enums (ConfigCategory, ConfigValueType, ConfigEffectType, ConfigScope)

#### Types
- `src/types/config.ts` - Complete type definitions for config system

#### Services
- `src/services/system-config.service.ts` - AES-256-GCM encryption, 60s TTL cache, EventEmitter for config events

#### API Routes (10 routes)
- `src/app/api/admin/config/route.ts` - GET (list configs)
- `src/app/api/admin/config/[key]/route.ts` - GET (single), PUT (update)
- `src/app/api/admin/config/[key]/history/route.ts` - GET (history)
- `src/app/api/admin/config/[key]/reset/route.ts` - POST (reset to default)
- `src/app/api/admin/config/[key]/rollback/route.ts` - POST (rollback)
- `src/app/api/admin/config/reload/route.ts` - POST (reload cache)
- `src/app/api/admin/config/export/route.ts` - GET (export)
- `src/app/api/admin/config/import/route.ts` - POST (import)

#### React Query Hooks
- `src/hooks/use-system-config.ts` - useConfigs, useConfigHistory, useUpdateConfig, useRollbackConfig, useResetConfig, useReloadConfigs, useExportConfigs, useImportConfigs

#### UI Components
- `src/components/features/admin/config/ConfigItem.tsx` - Single config display with badges
- `src/components/features/admin/config/ConfigEditDialog.tsx` - Edit dialog with type-aware editors
- `src/components/features/admin/config/ConfigHistoryDialog.tsx` - History with pagination and rollback
- `src/components/features/admin/config/ConfigManagement.tsx` - Main management interface

#### Pages
- `src/app/(dashboard)/admin/config/page.tsx` - Admin config page with global admin check

#### Seed Data
- `prisma/seed-data/config-seeds.ts` - 20+ default config entries across 5 categories

### Key Features
1. **8 Config Categories**: PROCESSING, INTEGRATION, SECURITY, NOTIFICATION, SYSTEM, DISPLAY, AI_MODEL, THRESHOLD
2. **6 Value Types**: STRING, NUMBER, BOOLEAN, JSON, SECRET, ENUM
3. **3 Effect Types**: IMMEDIATE, RESTART_REQUIRED, SCHEDULED
4. **AES-256-GCM Encryption**: For SECRET type values
5. **In-Memory Cache**: 60-second TTL with invalidation
6. **Config History**: Full audit trail with rollback support
7. **Validation System**: Min/max, pattern, options, required rules
8. **Global Admin Access Control**: Only isGlobalAdmin users can access
