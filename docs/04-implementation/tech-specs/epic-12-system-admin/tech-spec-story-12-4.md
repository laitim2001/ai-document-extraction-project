# Tech Spec: Story 12-4 - 系統配置管理 (System Configuration Management)

## 1. Overview

### 1.1 Purpose
本 Tech Spec 定義系統配置管理功能的詳細技術實作規範。此功能讓系統管理員能夠在不重新部署的情況下調整系統行為參數，包括處理參數、整合設定、安全設定、通知設定等，並提供配置驗證、變更歷史追蹤與回滾功能。

### 1.2 Scope
- 配置參數分類管理（PROCESSING、INTEGRATION、SECURITY、NOTIFICATION、SYSTEM）
- 多種值類型支援（STRING、NUMBER、BOOLEAN、JSON、SECRET、ENUM）
- 敏感配置 AES-256-GCM 加密儲存
- 配置驗證規則與約束檢查
- 配置變更歷史追蹤與審計日誌整合
- 配置回滾與重置預設值功能
- 配置快取與熱載入機制
- 管理員配置介面

### 1.3 Dependencies
- **Story 1-0**: 專案初始化與基礎架構
- **Story 8-1**: 審計日誌記錄
- **Story 12-3**: 錯誤告警配置（共用通知設定）

### 1.4 Story Reference
- **Story ID**: 12-4
- **Epic**: Epic 12 - 系統管理與監控
- **Priority**: High
- **Story Points**: 8
- **FR Coverage**: FR62

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Configuration Management Layer                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────┐     ┌─────────────────────────────────────┐    │
│  │   ConfigManagement  │────▶│         Config API Routes           │    │
│  │      Component      │     │  /api/admin/config/*                │    │
│  │                     │     │                                     │    │
│  │  - Category Tabs    │     │  - GET /config (list)              │    │
│  │  - Config Items     │     │  - GET /config/:key (get)          │    │
│  │  - Edit Modal       │     │  - PUT /config/:key (update)       │    │
│  │  - History Modal    │     │  - GET /config/:key/history        │    │
│  └─────────────────────┘     │  - POST /config/:key/rollback      │    │
│                               │  - POST /config/:key/reset         │    │
│                               └───────────────┬─────────────────────┘    │
│                                               │                          │
├───────────────────────────────────────────────┼──────────────────────────┤
│                          Service Layer        │                          │
│                                               ▼                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     SystemConfigService                          │    │
│  │                                                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │    │
│  │  │ Config CRUD  │  │  Validation  │  │  Encryption/         │  │    │
│  │  │              │  │   Engine     │  │  Decryption          │  │    │
│  │  │ - list       │  │              │  │                      │  │    │
│  │  │ - get        │  │ - required   │  │ - AES-256-GCM        │  │    │
│  │  │ - update     │  │ - range      │  │ - scrypt key derive  │  │    │
│  │  │ - rollback   │  │ - pattern    │  │ - IV per encryption  │  │    │
│  │  │ - reset      │  │ - options    │  │                      │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │                     ConfigCache                           │  │    │
│  │  │  - In-memory cache with TTL (60s)                        │  │    │
│  │  │  - Auto refresh on expiry                                 │  │    │
│  │  │  - Invalidation on update                                 │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                               │                          │
├───────────────────────────────────────────────┼──────────────────────────┤
│                        Data Layer             │                          │
│                                               ▼                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         Prisma ORM                               │    │
│  │                                                                  │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │    │
│  │  │   SystemConfig   │  │  ConfigHistory   │  │   AuditLog   │  │    │
│  │  │                  │  │                  │  │              │  │    │
│  │  │ - key (unique)   │  │ - configId       │  │ - action     │  │    │
│  │  │ - value          │  │ - previousValue  │  │ - resourceId │  │    │
│  │  │ - category       │  │ - newValue       │  │ - userId     │  │    │
│  │  │ - valueType      │  │ - changedBy      │  │ - timestamp  │  │    │
│  │  │ - validation     │  │ - changeReason   │  │              │  │    │
│  │  │ - isEncrypted    │  │ - isRollback     │  │              │  │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Configuration Category Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Configuration Categories                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐    │
│  │  PROCESSING    │  │  INTEGRATION   │  │      SECURITY          │    │
│  │  ⚙️            │  │  🔗            │  │      🔒                 │    │
│  │                │  │                │  │                        │    │
│  │ • confidence   │  │ • AI provider  │  │ • session timeout      │    │
│  │   threshold    │  │ • AI API key   │  │ • password policy      │    │
│  │ • auto approve │  │ • n8n base URL │  │ • max login attempts   │    │
│  │   threshold    │  │ • webhook      │  │ • account lockout      │    │
│  │ • max file     │  │   settings     │  │ • 2FA settings         │    │
│  │   size         │  │ • storage      │  │                        │    │
│  │ • batch size   │  │   connection   │  │                        │    │
│  └────────────────┘  └────────────────┘  └────────────────────────┘    │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐                                 │
│  │  NOTIFICATION  │  │    SYSTEM      │                                 │
│  │  📧            │  │    🖥️          │                                 │
│  │                │  │                │                                 │
│  │ • SMTP host    │  │ • log level    │                                 │
│  │ • SMTP port    │  │ • log retention│                                 │
│  │ • SMTP user    │  │ • maintenance  │                                 │
│  │ • Teams        │  │   mode         │                                 │
│  │   webhook      │  │ • timezone     │                                 │
│  │ • sender       │  │ • locale       │                                 │
│  │   email        │  │                │                                 │
│  └────────────────┘  └────────────────┘                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Configuration Value Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Configuration Update Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │ Admin UI │───▶│  API Route  │───▶│  Validation  │───▶│ Serialize │  │
│  │ (Input)  │    │  (PUT)      │    │  Check       │    │ Value     │  │
│  └──────────┘    └─────────────┘    └──────────────┘    └─────┬─────┘  │
│                                              │                   │       │
│                                              │ Invalid           │       │
│                                              ▼                   │       │
│                                       ┌──────────────┐          │       │
│                                       │ Return Error │          │       │
│                                       │ 400          │          │       │
│                                       └──────────────┘          │       │
│                                                                  │       │
│                                                                  ▼       │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  Return  │◀───│  Invalidate │◀───│   Create     │◀───│ Encrypt   │  │
│  │ Response │    │   Cache     │    │   History    │    │ if SECRET │  │
│  │          │    │             │    │   Record     │    │           │  │
│  └──────────┘    └─────────────┘    └──────────────┘    └───────────┘  │
│       │                                    │                            │
│       │                                    ▼                            │
│       │                           ┌──────────────┐                     │
│       │                           │    Write     │                     │
│       │                           │   AuditLog   │                     │
│       │                           └──────────────┘                     │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  Effect Type Handling                             │  │
│  │                                                                   │  │
│  │  IMMEDIATE: Apply immediately via cache refresh                  │  │
│  │  RESTART_REQUIRED: Return flag to notify user                    │  │
│  │  SCHEDULED: Queue for scheduled application                      │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Encryption Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Encryption Flow (AES-256-GCM)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Encrypt Value                             │    │
│  │                                                                  │    │
│  │  CONFIG_ENCRYPTION_KEY (env) ──┐                                │    │
│  │                                │                                │    │
│  │                                ▼                                │    │
│  │                        ┌──────────────┐                        │    │
│  │                        │    scrypt    │                        │    │
│  │                        │  Key Derive  │                        │    │
│  │                        │   (32 bytes) │                        │    │
│  │                        └──────┬───────┘                        │    │
│  │                               │                                 │    │
│  │  Random IV (16 bytes) ────────┼──────────┐                     │    │
│  │                               │          │                      │    │
│  │                               ▼          ▼                      │    │
│  │  Plaintext ──────────▶  ┌──────────────────────┐               │    │
│  │                         │  AES-256-GCM Cipher  │               │    │
│  │                         └──────────┬───────────┘               │    │
│  │                                    │                            │    │
│  │                                    ▼                            │    │
│  │  Output Format: IV:AuthTag:EncryptedData (hex)                 │    │
│  │  Example: "a1b2...16bytes:c3d4...16bytes:e5f6...data"         │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Decrypt Value                             │    │
│  │                                                                  │    │
│  │  Encrypted String ──▶ Split by ':'                              │    │
│  │                            │                                    │    │
│  │                            ├──▶ IV (16 bytes from hex)         │    │
│  │                            ├──▶ AuthTag (16 bytes from hex)    │    │
│  │                            └──▶ EncryptedData                   │    │
│  │                                                                  │    │
│  │  Derived Key + IV + AuthTag ──▶ AES-256-GCM Decipher           │    │
│  │                                        │                        │    │
│  │                                        ▼                        │    │
│  │                                   Plaintext                     │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Prisma Schema

```prisma
// prisma/schema.prisma

// 系統配置類別
enum ConfigCategory {
  PROCESSING     // 處理參數（信心度、閾值、檔案大小限制）
  INTEGRATION    // 整合設定（AI 服務、n8n、外部系統）
  SECURITY       // 安全設定（Session、密碼策略、帳戶鎖定）
  NOTIFICATION   // 通知設定（Email、Teams、Webhook）
  SYSTEM         // 系統設定（日誌、維護模式、時區）
}

// 配置值類型
enum ConfigValueType {
  STRING         // 文字字串
  NUMBER         // 數值（整數或浮點數）
  BOOLEAN        // 布林值（true/false）
  JSON           // JSON 物件或陣列
  SECRET         // 敏感資料（加密儲存）
  ENUM           // 預定義選項列表
}

// 配置效果類型
enum ConfigEffectType {
  IMMEDIATE           // 立即生效（透過快取更新）
  RESTART_REQUIRED    // 需要重啟服務才能生效
  SCHEDULED           // 排程在指定時間生效
}

// 系統配置主表
model SystemConfig {
  id           String              @id @default(cuid())
  key          String              @unique  // 配置鍵（如 processing.confidence_threshold）
  value        String              // JSON 編碼值，敏感值加密儲存
  defaultValue String              // 預設值（用於重置）

  // 配置元資料
  category     ConfigCategory      // 配置類別
  valueType    ConfigValueType     // 值類型
  effectType   ConfigEffectType    @default(IMMEDIATE)  // 生效類型

  // 顯示資訊
  name         String              // 顯示名稱（如「信心度閾值」）
  description  String              // 詳細描述
  impactNote   String?             // 變更影響說明

  // 驗證規則（JSON 格式）
  // { min?: number, max?: number, pattern?: string, options?: string[], required?: boolean }
  validation   Json?

  // 控制標誌
  isEncrypted  Boolean             @default(false)  // 是否加密儲存
  isReadOnly   Boolean             @default(false)  // 是否唯讀
  sortOrder    Int                 @default(0)      // 顯示排序

  // 審計資訊
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  updatedBy    String?
  updatedByUser User?              @relation("ConfigUpdater", fields: [updatedBy], references: [id])

  // 關聯
  history      ConfigHistory[]

  // 索引
  @@index([category])
  @@index([key])
  @@index([isEncrypted])
}

// 配置變更歷史
model ConfigHistory {
  id            String          @id @default(cuid())
  configId      String
  config        SystemConfig    @relation(fields: [configId], references: [id], onDelete: Cascade)

  // 變更內容
  previousValue String          // 變更前的值（敏感值顯示為遮罩）
  newValue      String          // 變更後的值（敏感值顯示為遮罩）

  // 審計資訊
  changedAt     DateTime        @default(now())
  changedBy     String
  changedByUser User            @relation("ConfigHistoryChanger", fields: [changedBy], references: [id])

  // 變更原因
  changeReason  String?

  // 回滾資訊
  isRollback    Boolean         @default(false)
  rollbackFrom  String?         // 回滾來源的歷史記錄 ID

  // 索引
  @@index([configId])
  @@index([changedAt])
  @@index([configId, changedAt])
}
```

### 3.2 TypeScript 型別定義

```typescript
// types/config.types.ts

import { ConfigCategory, ConfigValueType, ConfigEffectType } from '@prisma/client';

/**
 * 配置驗證規則
 */
export interface ConfigValidation {
  /** 最小值（用於 NUMBER 類型） */
  min?: number;
  /** 最大值（用於 NUMBER 類型） */
  max?: number;
  /** 正則表達式（用於 STRING 類型） */
  pattern?: string;
  /** 可選選項（用於 ENUM 類型） */
  options?: string[];
  /** 是否必填 */
  required?: boolean;
  /** 最小長度（用於 STRING 類型） */
  minLength?: number;
  /** 最大長度（用於 STRING 類型） */
  maxLength?: number;
}

/**
 * 配置值介面（API 回傳格式）
 */
export interface ConfigValue {
  key: string;
  value: unknown;  // 實際值，敏感值會被遮罩
  name: string;
  description: string;
  category: ConfigCategory;
  valueType: ConfigValueType;
  effectType: ConfigEffectType;
  defaultValue: unknown;
  validation?: ConfigValidation;
  impactNote?: string;
  isEncrypted: boolean;
  isReadOnly: boolean;
  isModified: boolean;  // 是否已修改（與預設值不同）
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * 配置更新輸入
 */
export interface ConfigUpdateInput {
  value: unknown;
  changeReason?: string;
}

/**
 * 配置更新結果
 */
export interface ConfigUpdateResult {
  success: boolean;
  requiresRestart: boolean;
  error?: string;
}

/**
 * 配置列表查詢選項
 */
export interface ConfigListOptions {
  category?: ConfigCategory;
  search?: string;
  includeReadOnly?: boolean;
}

/**
 * 配置歷史記錄
 */
export interface ConfigHistoryItem {
  id: string;
  previousValue: string;
  newValue: string;
  changedAt: Date;
  changedBy: string;
  changeReason?: string;
  isRollback: boolean;
}

/**
 * 配置歷史查詢選項
 */
export interface ConfigHistoryOptions {
  limit?: number;
  offset?: number;
}

/**
 * 配置歷史查詢結果
 */
export interface ConfigHistoryResult {
  history: ConfigHistoryItem[];
  total: number;
}

/**
 * 分組後的配置列表
 */
export type GroupedConfigs = Record<ConfigCategory, ConfigValue[]>;

/**
 * 配置匯出格式
 */
export interface ConfigExport {
  exportedAt: Date;
  exportedBy: string;
  configs: Record<string, unknown>;
}

/**
 * 配置匯入結果
 */
export interface ConfigImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * 類別顯示資訊
 */
export const CATEGORY_INFO: Record<ConfigCategory, { label: string; icon: string; description: string }> = {
  PROCESSING: {
    label: '處理參數',
    icon: '⚙️',
    description: '控制文件處理和 AI 提取的相關參數',
  },
  INTEGRATION: {
    label: '整合設定',
    icon: '🔗',
    description: 'AI 服務、n8n 和外部系統的連線設定',
  },
  SECURITY: {
    label: '安全設定',
    icon: '🔒',
    description: 'Session 管理、密碼策略和帳戶安全設定',
  },
  NOTIFICATION: {
    label: '通知設定',
    icon: '📧',
    description: 'Email、Teams 和其他通知管道的設定',
  },
  SYSTEM: {
    label: '系統設定',
    icon: '🖥️',
    description: '日誌、維護模式和系統級別的設定',
  },
};

/**
 * 效果類型顯示資訊
 */
export const EFFECT_TYPE_INFO: Record<ConfigEffectType, { label: string; color: string }> = {
  IMMEDIATE: {
    label: '立即生效',
    color: 'green',
  },
  RESTART_REQUIRED: {
    label: '需重啟',
    color: 'orange',
  },
  SCHEDULED: {
    label: '排程生效',
    color: 'blue',
  },
};
```

---

## 4. API Specifications

### 4.1 API Routes Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/config` | 取得配置列表（依類別分組） | Admin |
| GET | `/api/admin/config/:key` | 取得單一配置詳情 | Admin |
| PUT | `/api/admin/config/:key` | 更新配置值 | Admin |
| GET | `/api/admin/config/:key/history` | 取得配置變更歷史 | Admin |
| POST | `/api/admin/config/:key/rollback` | 回滾到指定版本 | Admin |
| POST | `/api/admin/config/:key/reset` | 重置為預設值 | Admin |
| POST | `/api/admin/config/export` | 匯出配置 | Admin |
| POST | `/api/admin/config/import` | 匯入配置 | Admin |
| POST | `/api/admin/config/reload` | 重新載入配置快取 | Admin |

### 4.2 API Endpoints Implementation

```typescript
// app/api/admin/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';
import { ConfigCategory } from '@prisma/client';
import { z } from 'zod';

const configService = new SystemConfigService();

// 查詢參數驗證
const listQuerySchema = z.object({
  category: z.nativeEnum(ConfigCategory).optional(),
  search: z.string().max(100).optional(),
});

/**
 * GET /api/admin/config
 * 取得配置列表（依類別分組）
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足，僅系統管理員可存取配置管理' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
    });

    const configs = await configService.listConfigs({
      category: query.category,
      search: query.search,
    });

    return NextResponse.json({
      success: true,
      configs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '查詢參數格式錯誤', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to list configs:', error);
    return NextResponse.json(
      { error: '取得配置列表失敗' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/admin/config/[key]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';
import { z } from 'zod';

const configService = new SystemConfigService();

// 更新請求驗證
const updateSchema = z.object({
  value: z.unknown(),
  changeReason: z.string().max(500).optional(),
});

interface RouteParams {
  params: { key: string };
}

/**
 * GET /api/admin/config/:key
 * 取得單一配置詳情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足' },
      { status: 403 }
    );
  }

  try {
    const config = await configService.getConfig(params.key);

    if (!config) {
      return NextResponse.json(
        { error: '配置不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Failed to get config:', error);
    return NextResponse.json(
      { error: '取得配置失敗' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/config/:key
 * 更新配置值
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { value, changeReason } = updateSchema.parse(body);

    const result = await configService.updateConfig(
      params.key,
      { value, changeReason },
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '配置已更新',
      requiresRestart: result.requiresRestart,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '請求格式錯誤', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to update config:', error);
    return NextResponse.json(
      { error: '更新配置失敗' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/admin/config/[key]/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';
import { z } from 'zod';

const configService = new SystemConfigService();

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

interface RouteParams {
  params: { key: string };
}

/**
 * GET /api/admin/config/:key/history
 * 取得配置變更歷史
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = historyQuerySchema.parse({
      limit: searchParams.get('limit') || 20,
      offset: searchParams.get('offset') || 0,
    });

    const result = await configService.getConfigHistory(params.key, {
      limit: query.limit,
      offset: query.offset,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to get config history:', error);
    return NextResponse.json(
      { error: '取得配置歷史失敗' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/admin/config/[key]/rollback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';
import { z } from 'zod';

const configService = new SystemConfigService();

const rollbackSchema = z.object({
  historyId: z.string().cuid(),
});

interface RouteParams {
  params: { key: string };
}

/**
 * POST /api/admin/config/:key/rollback
 * 回滾配置到指定版本
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { historyId } = rollbackSchema.parse(body);

    const result = await configService.rollbackConfig(
      params.key,
      historyId,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '配置已回滾',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '請求格式錯誤' },
        { status: 400 }
      );
    }
    console.error('Failed to rollback config:', error);
    return NextResponse.json(
      { error: '回滾配置失敗' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/admin/config/[key]/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

interface RouteParams {
  params: { key: string };
}

/**
 * POST /api/admin/config/:key/reset
 * 重置配置為預設值
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足' },
      { status: 403 }
    );
  }

  try {
    const result = await configService.resetToDefault(
      params.key,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '配置已重置為預設值',
    });
  } catch (error) {
    console.error('Failed to reset config:', error);
    return NextResponse.json(
      { error: '重置配置失敗' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/admin/config/reload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SystemConfigService } from '@/services/config/config.service';

const configService = new SystemConfigService();

/**
 * POST /api/admin/config/reload
 * 重新載入配置快取（熱載入）
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '權限不足' },
      { status: 403 }
    );
  }

  try {
    await configService.reloadAllConfigs();

    return NextResponse.json({
      success: true,
      message: '配置快取已重新載入',
      reloadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to reload configs:', error);
    return NextResponse.json(
      { error: '重新載入配置失敗' },
      { status: 500 }
    );
  }
}
```

---

## 5. Service Implementation

### 5.1 SystemConfigService

```typescript
// services/config/config.service.ts
import { PrismaClient, ConfigCategory, ConfigValueType, ConfigEffectType } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { EventEmitter } from 'events';
import {
  ConfigValue,
  ConfigUpdateInput,
  ConfigUpdateResult,
  ConfigListOptions,
  ConfigHistoryOptions,
  ConfigHistoryResult,
  ConfigValidation,
  GroupedConfigs,
  ConfigImportResult,
} from '@/types/config.types';

const prisma = new PrismaClient();

// 加密設定
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY!;
const ENCRYPTION_SALT = 'config-salt';

// 配置變更事件發射器
export const configEvents = new EventEmitter();

/**
 * 配置快取類別
 * 提供記憶體快取以減少資料庫查詢
 */
class ConfigCache {
  private cache: Map<string, unknown> = new Map();
  private lastRefresh: Date = new Date(0);
  private refreshInterval = 60000; // 1 分鐘
  private isRefreshing = false;

  /**
   * 取得快取值
   */
  async get(key: string): Promise<unknown | undefined> {
    if (this.shouldRefresh() && !this.isRefreshing) {
      await this.refresh();
    }
    return this.cache.get(key);
  }

  /**
   * 設定快取值
   */
  set(key: string, value: unknown): void {
    this.cache.set(key, value);
  }

  /**
   * 清除快取
   */
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    this.lastRefresh = new Date(0);
  }

  /**
   * 檢查是否需要刷新
   */
  private shouldRefresh(): boolean {
    return Date.now() - this.lastRefresh.getTime() > this.refreshInterval;
  }

  /**
   * 刷新所有快取
   */
  private async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const configs = await prisma.systemConfig.findMany();
      this.cache.clear();

      for (const config of configs) {
        const value = decryptIfNeeded(config.value, config.isEncrypted);
        this.cache.set(config.key, parseConfigValue(value, config.valueType));
      }

      this.lastRefresh = new Date();
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 取得所有快取的鍵
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 取得快取大小
   */
  size(): number {
    return this.cache.size;
  }
}

// 單例快取實例
const configCache = new ConfigCache();

/**
 * 使用 scrypt 衍生加密金鑰
 */
function deriveKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, ENCRYPTION_SALT, 32);
}

/**
 * 加密值
 * @param value 原始值
 * @returns 加密後的字串（格式：IV:AuthTag:EncryptedData）
 */
function encryptValue(value: string): string {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 解密值
 * @param encrypted 加密的字串
 * @returns 解密後的原始值
 */
function decryptValue(encrypted: string): string {
  const [ivHex, authTagHex, data] = encrypted.split(':');

  if (!ivHex || !authTagHex || !data) {
    throw new Error('Invalid encrypted value format');
  }

  const key = deriveKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 若需要則解密值
 */
function decryptIfNeeded(value: string, isEncrypted: boolean): string {
  if (isEncrypted && value) {
    try {
      return decryptValue(value);
    } catch {
      console.error('Failed to decrypt config value');
      return value;
    }
  }
  return value;
}

/**
 * 解析配置值為對應的 JavaScript 型別
 */
function parseConfigValue(value: string, valueType: ConfigValueType): unknown {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (valueType) {
    case 'NUMBER':
      return parseFloat(value);
    case 'BOOLEAN':
      return value === 'true' || value === '1';
    case 'JSON':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    default:
      return value;
  }
}

/**
 * 將值序列化為字串以儲存
 */
function stringifyConfigValue(value: unknown, valueType: ConfigValueType): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (valueType) {
    case 'NUMBER':
    case 'BOOLEAN':
      return String(value);
    case 'JSON':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/**
 * 遮罩敏感值
 */
function maskSensitiveValue(value: string, showLength: number = 4): string {
  if (!value || value.length <= showLength) {
    return '••••••••';
  }
  return '••••••••' + value.slice(-showLength);
}

/**
 * 系統配置服務
 */
export class SystemConfigService {
  /**
   * 取得配置列表（依類別分組）
   */
  async listConfigs(options: ConfigListOptions = {}): Promise<GroupedConfigs> {
    const { category, search, includeReadOnly = true } = options;

    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (!includeReadOnly) {
      where.isReadOnly = false;
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
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        updatedByUser: {
          select: { id: true, displayName: true },
        },
      },
    });

    // 初始化分組結構
    const grouped: GroupedConfigs = {
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
        // 敏感值以遮罩方式顯示
        value: config.isEncrypted ? maskSensitiveValue(decryptedValue) : parsedValue,
        name: config.name,
        description: config.description,
        category: config.category,
        valueType: config.valueType,
        effectType: config.effectType,
        defaultValue,
        validation: config.validation as ConfigValidation | undefined,
        impactNote: config.impactNote || undefined,
        isEncrypted: config.isEncrypted,
        isReadOnly: config.isReadOnly,
        isModified: config.value !== config.defaultValue,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedByUser?.displayName,
      };

      grouped[config.category].push(configValue);
    }

    return grouped;
  }

  /**
   * 取得單一配置值（完整資訊）
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
      validation: config.validation as ConfigValidation | undefined,
      impactNote: config.impactNote || undefined,
      isEncrypted: config.isEncrypted,
      isReadOnly: config.isReadOnly,
      isModified: config.value !== config.defaultValue,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedByUser?.displayName,
    };
  }

  /**
   * 取得配置值（用於運行時，使用快取）
   */
  async getValue<T>(key: string, defaultValue?: T): Promise<T> {
    // 先檢查快取
    const cached = await configCache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    // 從資料庫載入
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
  ): Promise<ConfigUpdateResult> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return { success: false, requiresRestart: false, error: '配置不存在' };
    }

    if (config.isReadOnly) {
      return { success: false, requiresRestart: false, error: '此配置為唯讀，無法修改' };
    }

    // 驗證值
    const validation = config.validation as ConfigValidation | null;
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

    const previousValue = config.value;

    // 使用交易確保一致性
    await prisma.$transaction([
      // 更新配置
      prisma.systemConfig.update({
        where: { key },
        data: {
          value: newValue,
          updatedBy: userId,
        },
      }),
      // 記錄歷史（敏感值以遮罩顯示）
      prisma.configHistory.create({
        data: {
          configId: config.id,
          previousValue: config.isEncrypted
            ? maskSensitiveValue(decryptIfNeeded(previousValue, true))
            : previousValue,
          newValue: config.isEncrypted
            ? maskSensitiveValue(stringifyConfigValue(input.value, config.valueType))
            : newValue,
          changedBy: userId,
          changeReason: input.changeReason,
        },
      }),
    ]);

    // 清除快取
    configCache.invalidate(key);

    // 記錄審計日誌
    await this.logConfigChange(key, config.name, userId, 'CONFIG_UPDATE');

    // 發送配置變更事件
    configEvents.emit('config:updated', { key, effectType: config.effectType });

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

    if (config.isReadOnly) {
      return { success: false, error: '此配置為唯讀，無法回滾' };
    }

    const historyRecord = await prisma.configHistory.findUnique({
      where: { id: historyId },
    });

    if (!historyRecord || historyRecord.configId !== config.id) {
      return { success: false, error: '歷史記錄不存在或不屬於此配置' };
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
          changeReason: `回滾至 ${historyRecord.changedAt.toISOString()} 的版本`,
          isRollback: true,
          rollbackFrom: historyId,
        },
      }),
    ]);

    // 清除快取
    configCache.invalidate(key);

    // 記錄審計日誌
    await this.logConfigChange(key, config.name, userId, 'CONFIG_ROLLBACK');

    // 發送配置變更事件
    configEvents.emit('config:rolledback', { key, historyId });

    return { success: true };
  }

  /**
   * 取得配置變更歷史
   */
  async getConfigHistory(
    key: string,
    options: ConfigHistoryOptions = {}
  ): Promise<ConfigHistoryResult> {
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
  async resetToDefault(
    key: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return { success: false, error: '配置不存在' };
    }

    if (config.isReadOnly) {
      return { success: false, error: '此配置為唯讀，無法重置' };
    }

    // 如果已是預設值則直接返回成功
    if (config.value === config.defaultValue) {
      return { success: true };
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
          previousValue: config.isEncrypted
            ? maskSensitiveValue(decryptIfNeeded(config.value, true))
            : config.value,
          newValue: config.isEncrypted
            ? maskSensitiveValue(config.defaultValue)
            : config.defaultValue,
          changedBy: userId,
          changeReason: '重置為預設值',
        },
      }),
    ]);

    // 清除快取
    configCache.invalidate(key);

    // 記錄審計日誌
    await this.logConfigChange(key, config.name, userId, 'CONFIG_RESET');

    return { success: true };
  }

  /**
   * 驗證配置值
   */
  private validateValue(
    value: unknown,
    valueType: ConfigValueType,
    validation?: ConfigValidation | null
  ): string | null {
    // 必填驗證
    if (validation?.required && (value === null || value === undefined || value === '')) {
      return '此配置為必填';
    }

    // 空值允許（若非必填）
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // 數值類型驗證
    if (valueType === 'NUMBER') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return '必須為有效數值';
      }
      if (validation?.min !== undefined && numValue < validation.min) {
        return `最小值為 ${validation.min}`;
      }
      if (validation?.max !== undefined && numValue > validation.max) {
        return `最大值為 ${validation.max}`;
      }
    }

    // 字串類型驗證
    if (valueType === 'STRING' || valueType === 'SECRET') {
      const strValue = String(value);
      if (validation?.minLength !== undefined && strValue.length < validation.minLength) {
        return `最小長度為 ${validation.minLength}`;
      }
      if (validation?.maxLength !== undefined && strValue.length > validation.maxLength) {
        return `最大長度為 ${validation.maxLength}`;
      }
      if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(strValue)) {
          return '格式不正確';
        }
      }
    }

    // 列舉類型驗證
    if (valueType === 'ENUM' || validation?.options) {
      if (validation?.options && !validation.options.includes(String(value))) {
        return `必須是以下選項之一: ${validation.options.join(', ')}`;
      }
    }

    // JSON 類型驗證
    if (valueType === 'JSON' && typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch {
        return 'JSON 格式不正確';
      }
    }

    return null;
  }

  /**
   * 記錄配置變更至審計日誌
   */
  private async logConfigChange(
    key: string,
    name: string,
    userId: string,
    action: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType: 'SystemConfig',
        resourceId: key,
        description: `${action === 'CONFIG_UPDATE' ? '更新' : action === 'CONFIG_ROLLBACK' ? '回滾' : '重置'}系統配置: ${name}`,
      },
    });
  }

  /**
   * 重新載入所有配置（熱載入）
   */
  async reloadAllConfigs(): Promise<void> {
    configCache.invalidate();
    configEvents.emit('config:reloaded');
  }

  /**
   * 匯出所有配置（排除敏感值）
   */
  async exportConfigs(userId: string): Promise<Record<string, unknown>> {
    const configs = await prisma.systemConfig.findMany({
      where: { isEncrypted: false },
    });

    const exported: Record<string, unknown> = {};
    for (const config of configs) {
      exported[config.key] = parseConfigValue(config.value, config.valueType);
    }

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CONFIG_EXPORT',
        resourceType: 'SystemConfig',
        resourceId: 'all',
        description: '匯出系統配置',
      },
    });

    return exported;
  }

  /**
   * 批量匯入配置
   */
  async importConfigs(
    configs: Record<string, unknown>,
    userId: string
  ): Promise<ConfigImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [key, value] of Object.entries(configs)) {
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!existingConfig) {
        skipped++;
        continue;
      }

      if (existingConfig.isEncrypted || existingConfig.isReadOnly) {
        skipped++;
        continue;
      }

      const result = await this.updateConfig(
        key,
        { value, changeReason: '批量匯入' },
        userId
      );

      if (result.success) {
        imported++;
      } else {
        errors.push(`${key}: ${result.error}`);
      }
    }

    return { imported, skipped, errors };
  }
}

// 匯出單例實例
export const configService = new SystemConfigService();
```

### 5.2 Configuration Accessor Helper

```typescript
// services/config/config.accessor.ts
import { configService } from './config.service';

/**
 * 配置存取器
 * 提供型別安全的配置值存取方法
 */
export const ConfigAccessor = {
  // 處理參數
  processing: {
    async confidenceThreshold(): Promise<number> {
      return configService.getValue<number>('processing.confidence_threshold', 0.8);
    },
    async autoApproveThreshold(): Promise<number> {
      return configService.getValue<number>('processing.auto_approve_threshold', 0.95);
    },
    async maxFileSizeMB(): Promise<number> {
      return configService.getValue<number>('processing.max_file_size_mb', 50);
    },
    async batchSize(): Promise<number> {
      return configService.getValue<number>('processing.batch_size', 10);
    },
  },

  // 整合設定
  integration: {
    async aiProvider(): Promise<string> {
      return configService.getValue<string>('integration.ai.provider', 'azure-openai');
    },
    async aiApiKey(): Promise<string> {
      return configService.getValue<string>('integration.ai.api_key', '');
    },
    async n8nBaseUrl(): Promise<string> {
      return configService.getValue<string>('integration.n8n.base_url', 'http://localhost:5678');
    },
  },

  // 安全設定
  security: {
    async sessionTimeoutMinutes(): Promise<number> {
      return configService.getValue<number>('security.session_timeout_minutes', 60);
    },
    async passwordMinLength(): Promise<number> {
      return configService.getValue<number>('security.password_min_length', 8);
    },
    async maxLoginAttempts(): Promise<number> {
      return configService.getValue<number>('security.max_login_attempts', 5);
    },
  },

  // 通知設定
  notification: {
    async smtpHost(): Promise<string> {
      return configService.getValue<string>('notification.email.smtp_host', '');
    },
    async smtpPort(): Promise<number> {
      return configService.getValue<number>('notification.email.smtp_port', 587);
    },
    async teamsWebhookUrl(): Promise<string> {
      return configService.getValue<string>('notification.teams.webhook_url', '');
    },
  },

  // 系統設定
  system: {
    async logLevel(): Promise<string> {
      return configService.getValue<string>('system.log_level', 'info');
    },
    async logRetentionDays(): Promise<number> {
      return configService.getValue<number>('system.log_retention_days', 30);
    },
    async maintenanceMode(): Promise<boolean> {
      return configService.getValue<boolean>('system.maintenance_mode', false);
    },
  },
};
```

---

## 6. UI Components

### 6.1 ConfigManagement Component

```typescript
// components/admin/config/ConfigManagement.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ConfigCategory } from '@prisma/client';
import { ConfigValue, CATEGORY_INFO, EFFECT_TYPE_INFO } from '@/types/config.types';
import { ConfigItem } from './ConfigItem';
import { ConfigEditModal } from './ConfigEditModal';
import { ConfigHistoryModal } from './ConfigHistoryModal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { RefreshCw, Download, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';

type GroupedConfigs = Record<ConfigCategory, ConfigValue[]>;

interface ConfigHistoryItem {
  id: string;
  previousValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string;
  changeReason?: string;
  isRollback: boolean;
}

export function ConfigManagement() {
  const [configs, setConfigs] = useState<GroupedConfigs>({
    PROCESSING: [],
    INTEGRATION: [],
    SECURITY: [],
    NOTIFICATION: [],
    SYSTEM: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>('PROCESSING');
  const [editingConfig, setEditingConfig] = useState<ConfigValue | null>(null);
  const [historyConfig, setHistoryConfig] = useState<string | null>(null);
  const [history, setHistory] = useState<ConfigHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReloading, setIsReloading] = useState(false);

  // 載入配置列表
  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/config?${params}`);
      const data = await response.json();

      if (data.success) {
        setConfigs(data.configs);
      } else {
        toast.error('載入配置失敗');
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
      toast.error('載入配置失敗');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // 載入變更歷史
  const fetchHistory = async (key: string) => {
    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/admin/config/${key}/history`);
      const data = await response.json();

      if (data.success) {
        setHistory(data.history);
        setHistoryConfig(key);
      } else {
        toast.error('載入歷史記錄失敗');
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast.error('載入歷史記錄失敗');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 儲存配置
  const handleSaveConfig = async (key: string, value: unknown, changeReason: string) => {
    try {
      const response = await fetch(`/api/admin/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, changeReason }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresRestart) {
          toast.success('配置已更新，需要重啟服務才能生效', { duration: 5000 });
        } else {
          toast.success('配置已更新');
        }
        setEditingConfig(null);
        fetchConfigs();
      } else {
        toast.error(data.error || '更新失敗');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('更新失敗');
    }
  };

  // 回滾配置
  const handleRollback = async (key: string, historyId: string) => {
    if (!confirm('確定要回滾此配置嗎？這將會覆蓋目前的值。')) return;

    try {
      const response = await fetch(`/api/admin/config/${key}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('配置已回滾');
        fetchConfigs();
        fetchHistory(key);
      } else {
        toast.error(data.error || '回滾失敗');
      }
    } catch (error) {
      console.error('Failed to rollback config:', error);
      toast.error('回滾失敗');
    }
  };

  // 重置為預設值
  const handleResetToDefault = async (key: string) => {
    if (!confirm('確定要重置為預設值嗎？')) return;

    try {
      const response = await fetch(`/api/admin/config/${key}/reset`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('配置已重置為預設值');
        fetchConfigs();
      } else {
        toast.error(data.error || '重置失敗');
      }
    } catch (error) {
      console.error('Failed to reset config:', error);
      toast.error('重置失敗');
    }
  };

  // 重新載入快取
  const handleReloadCache = async () => {
    try {
      setIsReloading(true);
      const response = await fetch('/api/admin/config/reload', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('配置快取已重新載入');
        fetchConfigs();
      } else {
        toast.error(data.error || '重新載入失敗');
      }
    } catch (error) {
      console.error('Failed to reload cache:', error);
      toast.error('重新載入失敗');
    } finally {
      setIsReloading(false);
    }
  };

  // 計算各類別的配置數量
  const getCategoryCount = (category: ConfigCategory): number => {
    return configs[category]?.length || 0;
  };

  // 計算已修改的配置數量
  const getModifiedCount = (category: ConfigCategory): number => {
    return configs[category]?.filter((c) => c.isModified).length || 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-2">載入配置中...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 頁面標題與操作按鈕 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">系統配置管理</h1>
          <p className="text-gray-500 mt-1">管理系統運行時配置參數</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReloadCache}
            disabled={isReloading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isReloading ? 'animate-spin' : ''}`} />
            重新載入快取
          </Button>
        </div>
      </div>

      {/* 搜尋欄 */}
      <div className="mb-6">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="搜尋配置名稱或描述..."
          className="max-w-md"
        />
      </div>

      {/* 類別標籤 */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ConfigCategory)}>
        <TabsList className="mb-6">
          {(Object.keys(CATEGORY_INFO) as ConfigCategory[]).map((category) => {
            const info = CATEGORY_INFO[category];
            const count = getCategoryCount(category);
            const modifiedCount = getModifiedCount(category);

            return (
              <TabsTrigger key={category} value={category} className="relative">
                <span className="mr-1">{info.icon}</span>
                <span>{info.label}</span>
                <span className="ml-1 text-xs text-gray-400">({count})</span>
                {modifiedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {modifiedCount}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* 各類別內容 */}
        {(Object.keys(CATEGORY_INFO) as ConfigCategory[]).map((category) => (
          <TabsContent key={category} value={category}>
            <div className="bg-white rounded-lg shadow">
              {/* 類別描述 */}
              <div className="px-6 py-4 border-b bg-gray-50">
                <p className="text-sm text-gray-600">{CATEGORY_INFO[category].description}</p>
              </div>

              {/* 配置列表 */}
              <div className="divide-y">
                {configs[category]?.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? '找不到符合條件的配置' : '此類別沒有配置項目'}
                  </div>
                ) : (
                  configs[category]?.map((config) => (
                    <ConfigItem
                      key={config.key}
                      config={config}
                      onEdit={() => setEditingConfig(config)}
                      onViewHistory={() => fetchHistory(config.key)}
                      onResetToDefault={() => handleResetToDefault(config.key)}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

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
          loading={historyLoading}
          onRollback={handleRollback}
          onClose={() => {
            setHistoryConfig(null);
            setHistory([]);
          }}
        />
      )}
    </div>
  );
}

export default ConfigManagement;
```

### 6.2 ConfigItem Component

```typescript
// components/admin/config/ConfigItem.tsx
'use client';

import React from 'react';
import { ConfigValue, EFFECT_TYPE_INFO } from '@/types/config.types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { History, RotateCcw, Edit2, Lock, Shield, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface ConfigItemProps {
  config: ConfigValue;
  onEdit: () => void;
  onViewHistory: () => void;
  onResetToDefault: () => void;
}

export function ConfigItem({ config, onEdit, onViewHistory, onResetToDefault }: ConfigItemProps) {
  const effectInfo = EFFECT_TYPE_INFO[config.effectType];

  // 格式化顯示值
  const formatDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(未設定)';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* 左側：配置資訊 */}
        <div className="flex-1 min-w-0">
          {/* 名稱與標籤 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{config.name}</span>

            {config.isReadOnly && (
              <Badge variant="secondary" className="text-xs">
                <Lock className="w-3 h-3 mr-1" />
                唯讀
              </Badge>
            )}

            {config.isEncrypted && (
              <Badge variant="warning" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                加密
              </Badge>
            )}

            {config.isModified && (
              <Badge variant="info" className="text-xs">
                已修改
              </Badge>
            )}

            {config.effectType !== 'IMMEDIATE' && (
              <Badge
                variant={effectInfo.color as 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'}
                className="text-xs"
              >
                {effectInfo.label}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          <p className="text-sm text-gray-500 mt-1">{config.description}</p>

          {/* 當前值 */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm text-gray-400">目前值:</span>
            <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
              {formatDisplayValue(config.value)}
            </code>
            {config.isModified && (
              <span className="text-xs text-gray-400">
                (預設: {formatDisplayValue(config.defaultValue)})
              </span>
            )}
          </div>

          {/* 驗證規則提示 */}
          {config.validation && (
            <div className="mt-1 text-xs text-gray-400">
              {config.validation.min !== undefined && config.validation.max !== undefined && (
                <span>範圍: {config.validation.min} - {config.validation.max}</span>
              )}
              {config.validation.options && (
                <span>選項: {config.validation.options.join(', ')}</span>
              )}
            </div>
          )}

          {/* 影響說明 */}
          {config.impactNote && (
            <div className="mt-2 flex items-start gap-1 text-xs text-orange-600">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{config.impactNote}</span>
            </div>
          )}

          {/* 更新資訊 */}
          {config.updatedBy && (
            <p className="mt-2 text-xs text-gray-400">
              最後更新: {config.updatedBy} (
              {formatDistanceToNow(new Date(config.updatedAt), {
                addSuffix: true,
                locale: zhTW,
              })}
              )
            </p>
          )}
        </div>

        {/* 右側：操作按鈕 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewHistory}
            title="查看變更歷史"
          >
            <History className="w-4 h-4" />
          </Button>

          {!config.isReadOnly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetToDefault}
                disabled={!config.isModified}
                title="重置為預設值"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onEdit}
                title="編輯配置"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                編輯
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 6.3 ConfigEditModal Component

```typescript
// components/admin/config/ConfigEditModal.tsx
'use client';

import React, { useState } from 'react';
import { ConfigValue, EFFECT_TYPE_INFO } from '@/types/config.types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { AlertTriangle, Shield } from 'lucide-react';

interface ConfigEditModalProps {
  config: ConfigValue;
  onSave: (key: string, value: unknown, changeReason: string) => Promise<void>;
  onClose: () => void;
}

export function ConfigEditModal({ config, onSave, onClose }: ConfigEditModalProps) {
  const [value, setValue] = useState<string>(
    typeof config.value === 'object'
      ? JSON.stringify(config.value, null, 2)
      : String(config.value ?? '')
  );
  const [changeReason, setChangeReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectInfo = EFFECT_TYPE_INFO[config.effectType];

  // 解析並驗證值
  const parseValue = (): { valid: boolean; parsed: unknown; error?: string } => {
    try {
      switch (config.valueType) {
        case 'NUMBER': {
          const num = parseFloat(value);
          if (isNaN(num)) {
            return { valid: false, parsed: null, error: '請輸入有效數值' };
          }
          if (config.validation?.min !== undefined && num < config.validation.min) {
            return { valid: false, parsed: null, error: `最小值為 ${config.validation.min}` };
          }
          if (config.validation?.max !== undefined && num > config.validation.max) {
            return { valid: false, parsed: null, error: `最大值為 ${config.validation.max}` };
          }
          return { valid: true, parsed: num };
        }
        case 'BOOLEAN':
          return { valid: true, parsed: value === 'true' };
        case 'JSON':
          try {
            return { valid: true, parsed: JSON.parse(value) };
          } catch {
            return { valid: false, parsed: null, error: 'JSON 格式不正確' };
          }
        case 'ENUM':
          if (config.validation?.options && !config.validation.options.includes(value)) {
            return { valid: false, parsed: null, error: '請選擇有效選項' };
          }
          return { valid: true, parsed: value };
        default:
          return { valid: true, parsed: value };
      }
    } catch (e) {
      return { valid: false, parsed: null, error: '值格式錯誤' };
    }
  };

  const handleSubmit = async () => {
    // 敏感配置需要確認
    if (config.isEncrypted && !confirmed) {
      setError('請確認您要更改敏感配置');
      return;
    }

    // 解析值
    const { valid, parsed, error: parseError } = parseValue();
    if (!valid) {
      setError(parseError || '值格式錯誤');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await onSave(config.key, parsed, changeReason);
    } catch {
      setError('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  // 渲染輸入欄位
  const renderInput = () => {
    switch (config.valueType) {
      case 'BOOLEAN':
        return (
          <Select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
          >
            <option value="true">是 (true)</option>
            <option value="false">否 (false)</option>
          </Select>
        );

      case 'ENUM':
        return (
          <Select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
          >
            {config.validation?.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        );

      case 'JSON':
        return (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            className="w-full font-mono text-sm"
            placeholder="請輸入有效的 JSON..."
          />
        );

      case 'NUMBER':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={config.validation?.min}
            max={config.validation?.max}
            step={config.validation?.min !== undefined && config.validation.min < 1 ? 0.01 : 1}
            className="w-full"
          />
        );

      case 'SECRET':
        return (
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
            placeholder="輸入新的值..."
          />
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
          />
        );
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`編輯配置: ${config.name}`}>
      <div className="space-y-4">
        {/* 配置描述 */}
        <div className="text-sm text-gray-500">{config.description}</div>

        {/* 影響說明 */}
        {config.impactNote && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{config.impactNote}</span>
          </div>
        )}

        {/* 效果類型提示 */}
        {config.effectType !== 'IMMEDIATE' && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              此配置{effectInfo.label}
              {config.effectType === 'RESTART_REQUIRED' && '，需要重新啟動服務'}
            </span>
          </div>
        )}

        {/* 值輸入 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">值</label>
          {renderInput()}
          {config.validation && (
            <p className="mt-1 text-xs text-gray-400">
              {config.validation.min !== undefined && config.validation.max !== undefined && (
                <>範圍: {config.validation.min} - {config.validation.max}</>
              )}
              {config.validation.pattern && <>格式: {config.validation.pattern}</>}
            </p>
          )}
        </div>

        {/* 變更原因 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            變更原因 <span className="text-gray-400">(選填)</span>
          </label>
          <Input
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="說明為何要變更此配置..."
            className="w-full"
          />
        </div>

        {/* 敏感配置確認 */}
        {config.isEncrypted && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
            <Shield className="w-4 h-4 text-yellow-600" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              />
              <span>我確認要更改此敏感配置</span>
            </label>
          </div>
        )}

        {/* 錯誤訊息 */}
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        {/* 按鈕 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? '儲存中...' : '儲存'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

### 6.4 ConfigHistoryModal Component

```typescript
// components/admin/config/ConfigHistoryModal.tsx
'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RotateCcw, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface ConfigHistoryItem {
  id: string;
  previousValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string;
  changeReason?: string;
  isRollback: boolean;
}

interface ConfigHistoryModalProps {
  configKey: string;
  history: ConfigHistoryItem[];
  loading: boolean;
  onRollback: (key: string, historyId: string) => void;
  onClose: () => void;
}

export function ConfigHistoryModal({
  configKey,
  history,
  loading,
  onRollback,
  onClose,
}: ConfigHistoryModalProps) {
  return (
    <Modal isOpen onClose={onClose} title="配置變更歷史" size="lg">
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暫無變更記錄</div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {history.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 border rounded-lg ${
                  index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    {/* 時間與標籤 */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {format(new Date(item.changedAt), 'yyyy-MM-dd HH:mm:ss', {
                          locale: zhTW,
                        })}
                      </span>
                      {index === 0 && (
                        <Badge variant="info" className="text-xs">
                          目前版本
                        </Badge>
                      )}
                      {item.isRollback && (
                        <Badge variant="secondary" className="text-xs">
                          回滾
                        </Badge>
                      )}
                    </div>

                    {/* 變更者 */}
                    <p className="text-sm text-gray-500">變更者: {item.changedBy}</p>

                    {/* 變更原因 */}
                    {item.changeReason && (
                      <p className="text-sm text-gray-600">原因: {item.changeReason}</p>
                    )}
                  </div>

                  {/* 回滾按鈕（不顯示在目前版本上） */}
                  {index > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRollback(configKey, item.id)}
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      回滾到此版本
                    </Button>
                  )}
                </div>

                {/* 值變更 */}
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">變更前</span>
                    <code className="block p-2 bg-red-50 text-red-700 rounded text-sm font-mono break-all">
                      {item.previousValue || '(空)'}
                    </code>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">變更後</span>
                    <code className="block p-2 bg-green-50 text-green-700 rounded text-sm font-mono break-all">
                      {item.newValue || '(空)'}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 關閉按鈕 */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            關閉
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

## 7. Database Seeds

### 7.1 Configuration Seeds

```typescript
// prisma/seeds/config-seeds.ts
import { PrismaClient, ConfigCategory, ConfigValueType, ConfigEffectType } from '@prisma/client';

const prisma = new PrismaClient();

interface ConfigSeed {
  key: string;
  defaultValue: string;
  category: ConfigCategory;
  valueType: ConfigValueType;
  effectType: ConfigEffectType;
  name: string;
  description: string;
  impactNote?: string;
  validation?: Record<string, unknown>;
  isEncrypted?: boolean;
  isReadOnly?: boolean;
  sortOrder: number;
}

const configSeeds: ConfigSeed[] = [
  // ===== 處理參數 (PROCESSING) =====
  {
    key: 'processing.confidence_threshold',
    defaultValue: '0.8',
    category: 'PROCESSING',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '信心度閾值',
    description: 'AI 提取結果需要人工審核的信心度閾值。低於此值的結果將標記為需要審核。',
    impactNote: '降低此值會增加需要人工審核的發票數量，提高準確性但降低處理效率。',
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
    description: '高於此信心度的發票將自動通過審核，無需人工介入。',
    impactNote: '提高此值會減少自動通過的發票數量，增加人工審核工作量。',
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
    description: '允許上傳的最大檔案大小限制。',
    validation: { min: 1, max: 500, required: true },
    sortOrder: 3,
  },
  {
    key: 'processing.batch_size',
    defaultValue: '10',
    category: 'PROCESSING',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '批次處理大小',
    description: '每批次處理的檔案數量上限。',
    validation: { min: 1, max: 100, required: true },
    sortOrder: 4,
  },
  {
    key: 'processing.max_concurrent_jobs',
    defaultValue: '5',
    category: 'PROCESSING',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '最大並行任務數',
    description: '系統同時處理的最大任務數量。',
    impactNote: '增加此值會提高處理速度但可能增加系統負載。',
    validation: { min: 1, max: 20, required: true },
    sortOrder: 5,
  },

  // ===== 整合設定 (INTEGRATION) =====
  {
    key: 'integration.ai.provider',
    defaultValue: 'azure-openai',
    category: 'INTEGRATION',
    valueType: 'ENUM',
    effectType: 'IMMEDIATE',
    name: 'AI 服務提供者',
    description: '使用的 AI 服務提供者。',
    validation: { options: ['azure-openai', 'openai', 'anthropic', 'custom'] },
    sortOrder: 1,
  },
  {
    key: 'integration.ai.api_key',
    defaultValue: '',
    category: 'INTEGRATION',
    valueType: 'SECRET',
    effectType: 'IMMEDIATE',
    name: 'AI API 金鑰',
    description: 'AI 服務的 API 金鑰。',
    isEncrypted: true,
    sortOrder: 2,
  },
  {
    key: 'integration.ai.endpoint',
    defaultValue: '',
    category: 'INTEGRATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'AI 服務端點',
    description: 'AI 服務的 API 端點 URL（Azure OpenAI 需要）。',
    validation: { pattern: '^https?://' },
    sortOrder: 3,
  },
  {
    key: 'integration.ai.model',
    defaultValue: 'gpt-4-vision-preview',
    category: 'INTEGRATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'AI 模型名稱',
    description: '使用的 AI 模型名稱或部署名稱。',
    sortOrder: 4,
  },
  {
    key: 'integration.n8n.base_url',
    defaultValue: 'http://localhost:5678',
    category: 'INTEGRATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'n8n 基礎 URL',
    description: 'n8n 服務的基礎 URL。',
    validation: { pattern: '^https?://' },
    sortOrder: 5,
  },
  {
    key: 'integration.n8n.api_key',
    defaultValue: '',
    category: 'INTEGRATION',
    valueType: 'SECRET',
    effectType: 'IMMEDIATE',
    name: 'n8n API 金鑰',
    description: 'n8n 服務的 API 金鑰。',
    isEncrypted: true,
    sortOrder: 6,
  },
  {
    key: 'integration.storage.provider',
    defaultValue: 'azure-blob',
    category: 'INTEGRATION',
    valueType: 'ENUM',
    effectType: 'RESTART_REQUIRED',
    name: '儲存服務提供者',
    description: '檔案儲存服務提供者。',
    impactNote: '變更儲存提供者需要重新啟動服務並遷移現有檔案。',
    validation: { options: ['local', 'azure-blob', 's3', 'gcs'] },
    sortOrder: 7,
  },

  // ===== 安全設定 (SECURITY) =====
  {
    key: 'security.session_timeout_minutes',
    defaultValue: '60',
    category: 'SECURITY',
    valueType: 'NUMBER',
    effectType: 'RESTART_REQUIRED',
    name: 'Session 超時時間 (分鐘)',
    description: '用戶閒置多久後自動登出。',
    impactNote: '變更此設定需要重啟服務才能生效。',
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
    description: '用戶密碼的最小長度要求。',
    validation: { min: 6, max: 32, required: true },
    sortOrder: 2,
  },
  {
    key: 'security.password_require_uppercase',
    defaultValue: 'true',
    category: 'SECURITY',
    valueType: 'BOOLEAN',
    effectType: 'IMMEDIATE',
    name: '密碼需要大寫字母',
    description: '是否要求密碼包含至少一個大寫字母。',
    sortOrder: 3,
  },
  {
    key: 'security.password_require_number',
    defaultValue: 'true',
    category: 'SECURITY',
    valueType: 'BOOLEAN',
    effectType: 'IMMEDIATE',
    name: '密碼需要數字',
    description: '是否要求密碼包含至少一個數字。',
    sortOrder: 4,
  },
  {
    key: 'security.password_require_special',
    defaultValue: 'false',
    category: 'SECURITY',
    valueType: 'BOOLEAN',
    effectType: 'IMMEDIATE',
    name: '密碼需要特殊字元',
    description: '是否要求密碼包含至少一個特殊字元。',
    sortOrder: 5,
  },
  {
    key: 'security.max_login_attempts',
    defaultValue: '5',
    category: 'SECURITY',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '最大登入嘗試次數',
    description: '帳戶鎖定前允許的登入失敗次數。',
    validation: { min: 3, max: 10, required: true },
    sortOrder: 6,
  },
  {
    key: 'security.lockout_duration_minutes',
    defaultValue: '15',
    category: 'SECURITY',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: '帳戶鎖定時間 (分鐘)',
    description: '帳戶被鎖定後需要等待的時間。',
    validation: { min: 1, max: 60, required: true },
    sortOrder: 7,
  },
  {
    key: 'security.jwt_secret',
    defaultValue: '',
    category: 'SECURITY',
    valueType: 'SECRET',
    effectType: 'RESTART_REQUIRED',
    name: 'JWT 密鑰',
    description: '用於簽署 JWT 令牌的密鑰。',
    impactNote: '變更此設定將使所有現有的 JWT 令牌失效。',
    isEncrypted: true,
    sortOrder: 8,
  },

  // ===== 通知設定 (NOTIFICATION) =====
  {
    key: 'notification.email.enabled',
    defaultValue: 'false',
    category: 'NOTIFICATION',
    valueType: 'BOOLEAN',
    effectType: 'IMMEDIATE',
    name: '啟用 Email 通知',
    description: '是否啟用 Email 通知功能。',
    sortOrder: 1,
  },
  {
    key: 'notification.email.smtp_host',
    defaultValue: '',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'SMTP 主機',
    description: '郵件伺服器主機地址。',
    sortOrder: 2,
  },
  {
    key: 'notification.email.smtp_port',
    defaultValue: '587',
    category: 'NOTIFICATION',
    valueType: 'NUMBER',
    effectType: 'IMMEDIATE',
    name: 'SMTP 連接埠',
    description: '郵件伺服器連接埠。',
    validation: { min: 1, max: 65535 },
    sortOrder: 3,
  },
  {
    key: 'notification.email.smtp_user',
    defaultValue: '',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: 'SMTP 使用者名稱',
    description: 'SMTP 認證的使用者名稱。',
    sortOrder: 4,
  },
  {
    key: 'notification.email.smtp_password',
    defaultValue: '',
    category: 'NOTIFICATION',
    valueType: 'SECRET',
    effectType: 'IMMEDIATE',
    name: 'SMTP 密碼',
    description: 'SMTP 認證的密碼。',
    isEncrypted: true,
    sortOrder: 5,
  },
  {
    key: 'notification.email.from_address',
    defaultValue: 'noreply@example.com',
    category: 'NOTIFICATION',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: '寄件者地址',
    description: '系統發送通知郵件時使用的寄件者地址。',
    validation: { pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
    sortOrder: 6,
  },
  {
    key: 'notification.teams.enabled',
    defaultValue: 'false',
    category: 'NOTIFICATION',
    valueType: 'BOOLEAN',
    effectType: 'IMMEDIATE',
    name: '啟用 Teams 通知',
    description: '是否啟用 Microsoft Teams 通知功能。',
    sortOrder: 7,
  },
  {
    key: 'notification.teams.webhook_url',
    defaultValue: '',
    category: 'NOTIFICATION',
    valueType: 'SECRET',
    effectType: 'IMMEDIATE',
    name: 'Teams Webhook URL',
    description: 'Microsoft Teams 的 Incoming Webhook URL。',
    isEncrypted: true,
    sortOrder: 8,
  },

  // ===== 系統設定 (SYSTEM) =====
  {
    key: 'system.log_level',
    defaultValue: 'info',
    category: 'SYSTEM',
    valueType: 'ENUM',
    effectType: 'IMMEDIATE',
    name: '日誌級別',
    description: '系統日誌的記錄級別。',
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
    description: '系統日誌保留的天數。',
    validation: { min: 7, max: 365, required: true },
    sortOrder: 2,
  },
  {
    key: 'system.maintenance_mode',
    defaultValue: 'false',
    category: 'SYSTEM',
    valueType: 'BOOLEAN',
    effectType: 'IMMEDIATE',
    name: '維護模式',
    description: '啟用維護模式後，只有管理員可以存取系統。',
    impactNote: '啟用此設定將阻止一般用戶存取系統。',
    sortOrder: 3,
  },
  {
    key: 'system.timezone',
    defaultValue: 'Asia/Taipei',
    category: 'SYSTEM',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: '系統時區',
    description: '系統使用的時區設定。',
    sortOrder: 4,
  },
  {
    key: 'system.locale',
    defaultValue: 'zh-TW',
    category: 'SYSTEM',
    valueType: 'ENUM',
    effectType: 'IMMEDIATE',
    name: '系統語言',
    description: '系統預設的語言設定。',
    validation: { options: ['zh-TW', 'zh-CN', 'en-US', 'ja-JP'] },
    sortOrder: 5,
  },
  {
    key: 'system.version',
    defaultValue: '1.0.0',
    category: 'SYSTEM',
    valueType: 'STRING',
    effectType: 'IMMEDIATE',
    name: '系統版本',
    description: '目前系統版本號。',
    isReadOnly: true,
    sortOrder: 6,
  },
];

/**
 * 執行配置種子資料
 */
export async function seedConfigs(): Promise<void> {
  console.log('🌱 Seeding system configs...');

  for (const config of configSeeds) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        // 只更新元資料，不更新值
        name: config.name,
        description: config.description,
        impactNote: config.impactNote,
        validation: config.validation,
        effectType: config.effectType,
        sortOrder: config.sortOrder,
      },
      create: {
        key: config.key,
        value: config.defaultValue,
        defaultValue: config.defaultValue,
        category: config.category,
        valueType: config.valueType,
        effectType: config.effectType,
        name: config.name,
        description: config.description,
        impactNote: config.impactNote,
        validation: config.validation,
        isEncrypted: config.isEncrypted ?? false,
        isReadOnly: config.isReadOnly ?? false,
        sortOrder: config.sortOrder,
      },
    });
  }

  console.log(`✅ Seeded ${configSeeds.length} system configs`);
}

// 執行 seed（如果直接運行此檔案）
if (require.main === module) {
  seedConfigs()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to seed configs:', error);
      process.exit(1);
    });
}
```

---

## 8. Testing

### 8.1 Unit Tests

```typescript
// __tests__/services/config.service.test.ts
import { SystemConfigService } from '@/services/config/config.service';
import { PrismaClient, ConfigCategory, ConfigValueType, ConfigEffectType } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    service = new SystemConfigService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('應該返回存在的配置', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        defaultValue: '0.8',
        category: 'PROCESSING' as ConfigCategory,
        valueType: 'NUMBER' as ConfigValueType,
        effectType: 'IMMEDIATE' as ConfigEffectType,
        name: '信心度閾值',
        description: '測試描述',
        impactNote: null,
        validation: { min: 0, max: 1 },
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
        updatedByUser: null,
      };

      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getConfig('processing.confidence_threshold');

      expect(result).toBeDefined();
      expect(result?.key).toBe('processing.confidence_threshold');
      expect(result?.value).toBe(0.85); // 應該被解析為數值
      expect(result?.defaultValue).toBe(0.8);
    });

    it('應該返回 null 當配置不存在', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    const mockConfig = {
      id: 'config-1',
      key: 'processing.confidence_threshold',
      value: '0.85',
      defaultValue: '0.8',
      category: 'PROCESSING' as ConfigCategory,
      valueType: 'NUMBER' as ConfigValueType,
      effectType: 'IMMEDIATE' as ConfigEffectType,
      name: '信心度閾值',
      description: '測試描述',
      impactNote: null,
      validation: { min: 0, max: 1 },
      isEncrypted: false,
      isReadOnly: false,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: null,
    };

    it('應該成功更新配置並記錄歷史', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.updateConfig(
        'processing.confidence_threshold',
        { value: 0.9, changeReason: '調整閾值' },
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.requiresRestart).toBe(false);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('應該拒絕更新唯讀配置', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        isReadOnly: true,
      });

      const result = await service.updateConfig(
        'processing.confidence_threshold',
        { value: 0.9 },
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('唯讀');
    });

    it('應該驗證數值範圍', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.updateConfig(
        'processing.confidence_threshold',
        { value: 1.5 }, // 超出 max: 1
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('最大值');
    });

    it('應該返回需要重啟的標誌', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        effectType: 'RESTART_REQUIRED' as ConfigEffectType,
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.updateConfig(
        'processing.confidence_threshold',
        { value: 0.9 },
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.requiresRestart).toBe(true);
    });
  });

  describe('validateValue', () => {
    it('應該驗證必填欄位', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'test',
        value: 'value',
        defaultValue: 'default',
        category: 'PROCESSING' as ConfigCategory,
        valueType: 'STRING' as ConfigValueType,
        effectType: 'IMMEDIATE' as ConfigEffectType,
        name: '測試',
        description: '測試',
        impactNote: null,
        validation: { required: true },
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
      };

      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.updateConfig('test', { value: '' }, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('必填');
    });

    it('應該驗證列舉選項', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'notification.channel',
        value: 'email',
        defaultValue: 'email',
        category: 'NOTIFICATION' as ConfigCategory,
        valueType: 'ENUM' as ConfigValueType,
        effectType: 'IMMEDIATE' as ConfigEffectType,
        name: '通知管道',
        description: '測試',
        impactNote: null,
        validation: { options: ['email', 'teams', 'webhook'] },
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
      };

      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.updateConfig(
        'notification.channel',
        { value: 'sms' }, // 不在選項中
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('選項');
    });
  });

  describe('rollbackConfig', () => {
    it('應該成功回滾配置', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.9',
        defaultValue: '0.8',
        category: 'PROCESSING' as ConfigCategory,
        valueType: 'NUMBER' as ConfigValueType,
        effectType: 'IMMEDIATE' as ConfigEffectType,
        name: '信心度閾值',
        description: '測試',
        impactNote: null,
        validation: null,
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
      };

      const mockHistory = {
        id: 'history-1',
        configId: 'config-1',
        previousValue: '0.85',
        newValue: '0.9',
        changedAt: new Date(),
        changedBy: 'user-1',
        changeReason: null,
        isRollback: false,
        rollbackFrom: null,
      };

      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.configHistory.findUnique.mockResolvedValue(mockHistory);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.rollbackConfig(
        'processing.confidence_threshold',
        'history-1',
        'user-1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('resetToDefault', () => {
    it('應該成功重置為預設值', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.9',
        defaultValue: '0.8',
        category: 'PROCESSING' as ConfigCategory,
        valueType: 'NUMBER' as ConfigValueType,
        effectType: 'IMMEDIATE' as ConfigEffectType,
        name: '信心度閾值',
        description: '測試',
        impactNote: null,
        validation: null,
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
      };

      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.resetToDefault(
        'processing.confidence_threshold',
        'user-1'
      );

      expect(result.success).toBe(true);
    });

    it('應該直接返回成功如果已是預設值', async () => {
      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.8',
        defaultValue: '0.8', // 相同
        category: 'PROCESSING' as ConfigCategory,
        valueType: 'NUMBER' as ConfigValueType,
        effectType: 'IMMEDIATE' as ConfigEffectType,
        name: '信心度閾值',
        description: '測試',
        impactNote: null,
        validation: null,
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
      };

      mockPrisma.systemConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.resetToDefault(
        'processing.confidence_threshold',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
```

### 8.2 Integration Tests

```typescript
// __tests__/api/config.integration.test.ts
import { createMocks } from 'node-mocks-http';
import { GET, PUT } from '@/app/api/admin/config/[key]/route';
import { POST as rollbackPost } from '@/app/api/admin/config/[key]/rollback/route';
import { POST as resetPost } from '@/app/api/admin/config/[key]/reset/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth');
jest.mock('@/lib/prisma');

describe('Config API Routes', () => {
  const mockAdminSession = {
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    },
  };

  const mockUserSession = {
    user: {
      id: 'user-1',
      role: 'USER',
      email: 'user@example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/config/:key', () => {
    it('應該返回配置詳情給管理員', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        defaultValue: '0.8',
        category: 'PROCESSING',
        valueType: 'NUMBER',
        effectType: 'IMMEDIATE',
        name: '信心度閾值',
        description: '測試描述',
        impactNote: null,
        validation: { min: 0, max: 1 },
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        updatedAt: new Date(),
        updatedBy: null,
        updatedByUser: null,
      };

      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const { req } = createMocks({
        method: 'GET',
      });

      const response = await GET(req as any, {
        params: { key: 'processing.confidence_threshold' },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.config.key).toBe('processing.confidence_threshold');
    });

    it('應該拒絕非管理員存取', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockUserSession);

      const { req } = createMocks({
        method: 'GET',
      });

      const response = await GET(req as any, {
        params: { key: 'processing.confidence_threshold' },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/admin/config/:key', () => {
    it('應該成功更新配置', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        defaultValue: '0.8',
        category: 'PROCESSING',
        valueType: 'NUMBER',
        effectType: 'IMMEDIATE',
        name: '信心度閾值',
        description: '測試描述',
        impactNote: null,
        validation: { min: 0, max: 1 },
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        updatedAt: new Date(),
        updatedBy: null,
      };

      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const { req } = createMocks({
        method: 'PUT',
        body: {
          value: 0.9,
          changeReason: '調整閾值',
        },
      });

      const response = await PUT(req as any, {
        params: { key: 'processing.confidence_threshold' },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('已更新');
    });

    it('應該返回錯誤當值驗證失敗', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.85',
        defaultValue: '0.8',
        category: 'PROCESSING',
        valueType: 'NUMBER',
        effectType: 'IMMEDIATE',
        name: '信心度閾值',
        description: '測試描述',
        impactNote: null,
        validation: { min: 0, max: 1 },
        isEncrypted: false,
        isReadOnly: false,
        sortOrder: 1,
        updatedAt: new Date(),
        updatedBy: null,
      };

      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const { req } = createMocks({
        method: 'PUT',
        body: {
          value: 1.5, // 超出範圍
        },
      });

      const response = await PUT(req as any, {
        params: { key: 'processing.confidence_threshold' },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/config/:key/rollback', () => {
    it('應該成功回滾配置', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.9',
        defaultValue: '0.8',
        isReadOnly: false,
      };

      const mockHistory = {
        id: 'history-1',
        configId: 'config-1',
        previousValue: '0.85',
        changedAt: new Date(),
      };

      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.configHistory.findUnique as jest.Mock).mockResolvedValue(mockHistory);
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const { req } = createMocks({
        method: 'POST',
        body: {
          historyId: 'history-1',
        },
      });

      const response = await rollbackPost(req as any, {
        params: { key: 'processing.confidence_threshold' },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('已回滾');
    });
  });

  describe('POST /api/admin/config/:key/reset', () => {
    it('應該成功重置為預設值', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

      const mockConfig = {
        id: 'config-1',
        key: 'processing.confidence_threshold',
        value: '0.9',
        defaultValue: '0.8',
        isEncrypted: false,
        isReadOnly: false,
      };

      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const { req } = createMocks({
        method: 'POST',
      });

      const response = await resetPost(req as any, {
        params: { key: 'processing.confidence_threshold' },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('已重置');
    });
  });
});
```

### 8.3 E2E Tests

```typescript
// e2e/config-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('系統配置管理', () => {
  test.beforeEach(async ({ page }) => {
    // 以管理員身份登入
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 導航到配置管理頁面
    await page.goto('/admin/config');
    await page.waitForLoadState('networkidle');
  });

  test('應該顯示配置列表並依類別分組', async ({ page }) => {
    // 檢查頁面標題
    await expect(page.locator('h1')).toContainText('系統配置管理');

    // 檢查類別標籤
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: /處理參數/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /整合設定/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /安全設定/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /通知設定/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /系統設定/ })).toBeVisible();
  });

  test('應該能夠切換類別標籤', async ({ page }) => {
    // 點擊「安全設定」標籤
    await page.getByRole('tab', { name: /安全設定/ }).click();

    // 檢查顯示安全設定相關配置
    await expect(page.getByText('Session 超時時間')).toBeVisible();
    await expect(page.getByText('密碼最小長度')).toBeVisible();
  });

  test('應該能夠搜尋配置', async ({ page }) => {
    // 輸入搜尋關鍵字
    await page.fill('input[placeholder*="搜尋"]', '信心度');
    await page.waitForTimeout(500); // 等待 debounce

    // 檢查搜尋結果
    await expect(page.getByText('信心度閾值')).toBeVisible();
  });

  test('應該能夠編輯配置', async ({ page }) => {
    // 找到並點擊編輯按鈕
    const configItem = page.locator('[data-testid="config-item"]', {
      has: page.getByText('信心度閾值'),
    });
    await configItem.getByRole('button', { name: '編輯' }).click();

    // 檢查編輯對話框
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('編輯配置: 信心度閾值')).toBeVisible();

    // 修改值
    await page.fill('input[type="number"]', '0.85');
    await page.fill('input[placeholder*="變更原因"]', 'E2E 測試變更');

    // 儲存
    await page.click('button:has-text("儲存")');

    // 檢查成功訊息
    await expect(page.getByText('配置已更新')).toBeVisible();
  });

  test('應該顯示需要重啟的提示', async ({ page }) => {
    // 切換到安全設定
    await page.getByRole('tab', { name: /安全設定/ }).click();

    // 找到需要重啟的配置
    const configItem = page.locator('[data-testid="config-item"]', {
      has: page.getByText('Session 超時時間'),
    });

    // 檢查「需重啟」標籤
    await expect(configItem.getByText('需重啟')).toBeVisible();
  });

  test('應該能夠查看變更歷史', async ({ page }) => {
    // 找到並點擊歷史按鈕
    const configItem = page.locator('[data-testid="config-item"]', {
      has: page.getByText('信心度閾值'),
    });
    await configItem.getByRole('button', { name: /歷史/ }).click();

    // 檢查歷史對話框
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('配置變更歷史')).toBeVisible();
  });

  test('應該能夠重置為預設值', async ({ page }) => {
    // 先修改一個配置值
    const configItem = page.locator('[data-testid="config-item"]', {
      has: page.getByText('批次處理大小'),
    });

    // 確認已修改標籤可見（如果有的話）
    const resetButton = configItem.getByRole('button', { name: /重置/ });

    // 點擊重置（會有確認對話框）
    await resetButton.click();
    page.on('dialog', (dialog) => dialog.accept());

    // 等待重置完成
    await expect(page.getByText('配置已重置為預設值')).toBeVisible();
  });

  test('應該正確處理敏感配置', async ({ page }) => {
    // 切換到整合設定
    await page.getByRole('tab', { name: /整合設定/ }).click();

    // 找到敏感配置
    const configItem = page.locator('[data-testid="config-item"]', {
      has: page.getByText('AI API 金鑰'),
    });

    // 檢查加密標籤
    await expect(configItem.getByText('加密')).toBeVisible();

    // 檢查值被遮罩
    await expect(configItem.getByText('••••••••')).toBeVisible();

    // 點擊編輯
    await configItem.getByRole('button', { name: '編輯' }).click();

    // 檢查編輯對話框中有確認勾選框
    await expect(page.getByText('我確認要更改此敏感配置')).toBeVisible();
  });

  test('應該能夠重新載入配置快取', async ({ page }) => {
    // 點擊重新載入快取按鈕
    await page.click('button:has-text("重新載入快取")');

    // 檢查成功訊息
    await expect(page.getByText('配置快取已重新載入')).toBeVisible();
  });

  test('非管理員應該無法存取配置管理', async ({ page, context }) => {
    // 登出
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("登出")');

    // 以一般用戶登入
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'UserPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 嘗試存取配置管理
    await page.goto('/admin/config');

    // 應該被重定向或顯示無權限訊息
    await expect(page).not.toHaveURL('/admin/config');
  });
});
```

---

## 9. Security Considerations

### 9.1 敏感資料加密

```typescript
// lib/encryption.ts

/**
 * 配置加密安全要求
 *
 * 1. 加密算法: AES-256-GCM
 *    - 提供認證加密，防止篡改
 *    - 256 位元金鑰長度提供足夠的安全性
 *
 * 2. 金鑰衍生: scrypt
 *    - 記憶體密集型算法，抵抗硬體攻擊
 *    - 使用固定 salt 確保同一金鑰衍生相同結果
 *
 * 3. IV (初始化向量): 每次加密隨機生成
 *    - 16 bytes (128 bits) 隨機 IV
 *    - 確保相同明文產生不同密文
 *
 * 4. 認證標籤 (Auth Tag): 16 bytes
 *    - 驗證密文完整性
 *    - 防止密文被篡改
 */

/**
 * 金鑰管理最佳實踐
 *
 * 1. CONFIG_ENCRYPTION_KEY 必須:
 *    - 至少 32 字元
 *    - 包含大小寫字母、數字和特殊字元
 *    - 安全儲存（如 Azure Key Vault、HashiCorp Vault）
 *    - 定期輪換（建議每 90 天）
 *
 * 2. 金鑰輪換程序:
 *    a. 產生新金鑰
 *    b. 解密所有敏感配置（使用舊金鑰）
 *    c. 重新加密（使用新金鑰）
 *    d. 更新環境變數
 *    e. 驗證解密正確
 *    f. 安全刪除舊金鑰
 */
```

### 9.2 存取控制

```typescript
// middleware/config-access.ts

/**
 * 配置存取控制策略
 *
 * 1. 角色要求:
 *    - 所有配置管理操作僅限 ADMIN 角色
 *    - 讀取配置（API）需要認證
 *    - 運行時讀取可使用快取（無需認證）
 *
 * 2. 操作審計:
 *    - 所有配置變更記錄至審計日誌
 *    - 包含：用戶、時間、變更前後值、原因
 *    - 敏感值以遮罩方式記錄
 *
 * 3. 變更歷史:
 *    - 保留完整變更歷史
 *    - 支援回滾到任意歷史版本
 *    - 歷史記錄不可刪除
 */
```

### 9.3 輸入驗證

```typescript
// lib/config-validation.ts

/**
 * 配置輸入驗證
 *
 * 1. 類型驗證:
 *    - NUMBER: 必須是有效數值
 *    - BOOLEAN: 必須是 true/false
 *    - JSON: 必須是有效 JSON
 *    - ENUM: 必須在選項列表中
 *
 * 2. 範圍驗證:
 *    - min/max 數值範圍
 *    - minLength/maxLength 字串長度
 *    - pattern 正則表達式
 *
 * 3. 業務規則:
 *    - required 必填驗證
 *    - options 選項驗證
 *    - 自定義驗證器
 *
 * 4. 安全驗證:
 *    - XSS 防護（Zod 自動處理）
 *    - SQL 注入防護（Prisma 參數化查詢）
 *    - 路徑穿越防護
 */
```

---

## 10. Performance Considerations

### 10.1 配置快取策略

```typescript
// lib/config-cache.ts

/**
 * 配置快取設計
 *
 * 1. 快取層級:
 *    - L1: 記憶體快取（ConfigCache 類別）
 *    - L2: 可選 Redis 快取（分散式環境）
 *
 * 2. 快取策略:
 *    - TTL: 60 秒自動過期
 *    - 寫入時失效（Write-Through Invalidation）
 *    - 延遲載入（Lazy Loading）
 *
 * 3. 快取鍵設計:
 *    - 格式: config:{key}
 *    - 例如: config:processing.confidence_threshold
 *
 * 4. 快取更新:
 *    - 單一配置更新: 僅失效該配置
 *    - 批量更新: 失效所有配置
 *    - 熱載入: 清空快取並重新載入
 */
```

### 10.2 資料庫優化

```sql
-- 配置表索引策略
CREATE INDEX idx_system_config_category ON "SystemConfig"("category");
CREATE INDEX idx_system_config_key ON "SystemConfig"("key");
CREATE INDEX idx_system_config_encrypted ON "SystemConfig"("isEncrypted");

-- 歷史表索引策略
CREATE INDEX idx_config_history_config_id ON "ConfigHistory"("configId");
CREATE INDEX idx_config_history_changed_at ON "ConfigHistory"("changedAt");
CREATE INDEX idx_config_history_composite ON "ConfigHistory"("configId", "changedAt");
```

---

## 11. Deployment Configuration

### 11.1 環境變數

```bash
# .env.example

# 配置加密金鑰（必填，至少 32 字元）
CONFIG_ENCRYPTION_KEY=your-32-character-minimum-secret-key-here!

# 配置快取設定
CONFIG_CACHE_TTL_SECONDS=60
CONFIG_CACHE_ENABLED=true

# Redis 快取（可選，用於分散式環境）
REDIS_URL=redis://localhost:6379
CONFIG_REDIS_PREFIX=config:
```

### 11.2 Docker Compose

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - CONFIG_ENCRYPTION_KEY=${CONFIG_ENCRYPTION_KEY}
      - CONFIG_CACHE_TTL_SECONDS=60
      - CONFIG_CACHE_ENABLED=true
    secrets:
      - config_encryption_key

secrets:
  config_encryption_key:
    external: true
```

### 11.3 Kubernetes Secret

```yaml
# k8s/config-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: config-secrets
type: Opaque
data:
  CONFIG_ENCRYPTION_KEY: <base64-encoded-key>
```

---

## 12. Verification Checklist

### 12.1 功能驗證

- [ ] 配置列表依類別正確分組顯示
- [ ] 所有 5 個類別標籤可正確切換
- [ ] 配置搜尋功能正確過濾結果
- [ ] 配置編輯表單顯示正確的欄位類型（文字、數值、布林、JSON、選項）
- [ ] 數值範圍驗證正確運作（min/max）
- [ ] 必填欄位驗證正確運作
- [ ] 選項類型驗證正確運作
- [ ] JSON 格式驗證正確運作
- [ ] 敏感配置以遮罩方式顯示
- [ ] 敏感配置編輯需要二次確認
- [ ] 配置變更正確記錄至審計日誌
- [ ] 配置變更歷史正確記錄
- [ ] 配置回滾功能正確運作
- [ ] 重置為預設值功能正確運作
- [ ] 需要重啟的配置有正確提示
- [ ] 唯讀配置無法編輯
- [ ] 重新載入快取功能正確運作

### 12.2 安全驗證

- [ ] 敏感配置值 AES-256-GCM 加密儲存
- [ ] 僅系統管理員可存取配置管理
- [ ] 一般用戶無法存取配置 API
- [ ] 所有配置變更記錄審計日誌
- [ ] 敏感值在審計日誌中以遮罩顯示
- [ ] API 請求正確驗證 Zod Schema
- [ ] 無 XSS 漏洞
- [ ] 無 SQL 注入漏洞

### 12.3 效能驗證

- [ ] 配置快取正確運作
- [ ] 快取 TTL 過期後正確刷新
- [ ] 配置更新後快取正確失效
- [ ] 熱載入機制正確運作
- [ ] 批量載入效能 < 100ms
- [ ] 單一配置讀取效能 < 10ms（快取命中）

### 12.4 整合驗證

- [ ] 與審計日誌服務正確整合
- [ ] 配置變更事件正確發送
- [ ] Prisma 模型與資料庫同步
- [ ] 種子資料正確載入
- [ ] 與現有認證系統整合正常

---

## Appendix

### A. 配置鍵命名規範

```
命名格式: {category}.{subcategory}.{name}

範例:
- processing.confidence_threshold
- integration.ai.provider
- security.password_min_length
- notification.email.smtp_host
- system.log_level

規則:
1. 全小寫
2. 使用底線分隔單字
3. 使用點號分隔層級
4. 最多 3 層級
5. 名稱應具描述性
```

### B. 配置類型對應

| ConfigValueType | JavaScript Type | UI Input | Validation |
|-----------------|-----------------|----------|------------|
| STRING | string | text input | pattern, minLength, maxLength |
| NUMBER | number | number input | min, max |
| BOOLEAN | boolean | select/toggle | - |
| JSON | object/array | textarea | JSON.parse |
| SECRET | string | password input | pattern |
| ENUM | string | select | options |

### C. 效果類型處理

| ConfigEffectType | 處理方式 | UI 提示 |
|------------------|----------|---------|
| IMMEDIATE | 更新快取即生效 | 無 |
| RESTART_REQUIRED | 更新後返回標誌 | 「需要重啟服務才能生效」 |
| SCHEDULED | 排程在指定時間套用 | 「將於 {time} 生效」 |
