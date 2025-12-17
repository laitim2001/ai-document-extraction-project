# Tech Spec: Story 9-2 SharePoint 連線配置

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 9.2 |
| Epic | Epic 9: 自動化文件獲取 |
| 標題 | SharePoint 連線配置 |
| 優先級 | High |
| 預估點數 | 5 |
| 狀態 | Ready for Dev |
| FR 覆蓋 | FR2 |
| 依賴 | Story 9-1 (SharePoint 文件監控 API) |

## 1. 概述

### 1.1 目標
提供管理介面讓系統管理員配置 SharePoint 連線設定，支援城市級別配置與全域預設配置。

### 1.2 用戶故事
**As a** 系統管理員
**I want** 配置 SharePoint 連線設定
**So that** 系統可以正確存取 SharePoint 資源

### 1.3 範圍
- SharePointConfig 模型擴展
- SharePointConfigService 服務層
- 加密工具（AES-256-GCM）
- 管理 API 端點
- 配置表單與列表元件

---

## 2. 數據庫設計

### 2.1 SharePointConfig 模型擴展

```prisma
// 擴展 SharePoint 配置模型
model SharePointConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String
  description       String?

  // 連線設定
  siteUrl           String    @map("site_url")
  tenantId          String    @map("tenant_id")
  clientId          String    @map("client_id")
  clientSecret      String    @map("client_secret")  // 加密儲存

  // 文件庫設定
  driveId           String?   @map("drive_id")       // 自動偵測
  libraryPath       String    @map("library_path")
  rootFolderPath    String?   @map("root_folder_path")

  // 文件過濾設定
  fileExtensions    String[]  @default(["pdf", "jpg", "jpeg", "png", "tiff"]) @map("file_extensions")
  maxFileSizeMb     Int       @default(50) @map("max_file_size_mb")
  excludeFolders    String[]  @default([]) @map("exclude_folders")

  // 城市關聯
  cityId            String?   @unique @map("city_id")
  city              City?     @relation(fields: [cityId], references: [id])

  // 全域配置標記
  isGlobal          Boolean   @default(false) @map("is_global")

  // 狀態
  isActive          Boolean   @default(true) @map("is_active")
  lastTestedAt      DateTime? @map("last_tested_at")
  lastTestResult    Boolean?  @map("last_test_result")
  lastTestError     String?   @map("last_test_error")

  // 時間戳
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  // 建立者/更新者
  createdById       String    @map("created_by_id")
  createdBy         User      @relation("SharePointConfigCreator", fields: [createdById], references: [id])
  updatedById       String?   @map("updated_by_id")
  updatedBy         User?     @relation("SharePointConfigUpdater", fields: [updatedById], references: [id])

  // 關聯
  fetchLogs         SharePointFetchLog[]

  @@index([cityId])
  @@index([isActive])
  @@index([isGlobal])
  @@map("sharepoint_configs")
}
```

---

## 3. 類型定義

```typescript
// src/types/sharepoint-config.ts

import { SharePointConfig, City, User } from '@prisma/client';

// ===== 配置輸入 =====

/** 建立/更新 SharePoint 配置的輸入 */
export interface SharePointConfigInput {
  name: string;
  description?: string;
  siteUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  libraryPath: string;
  rootFolderPath?: string;
  cityId?: string | null;
  isGlobal?: boolean;
  fileExtensions?: string[];
  maxFileSizeMb?: number;
  excludeFolders?: string[];
}

/** 更新配置的輸入（部分欄位） */
export type SharePointConfigUpdateInput = Partial<Omit<SharePointConfigInput, 'cityId' | 'isGlobal'>>;

// ===== 連線測試 =====

/** 連線測試結果 */
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: ConnectionTestDetails;
}

/** 連線測試詳情 */
export interface ConnectionTestDetails {
  siteInfo?: {
    id: string;
    name: string;
    webUrl: string;
  };
  driveInfo?: {
    id: string;
    name: string;
    driveType: string;
  };
  permissions?: string[];
}

// ===== API 回應 =====

/** 配置回應（含關聯資料） */
export interface SharePointConfigResponse extends Omit<SharePointConfig, 'clientSecret'> {
  clientSecret: string;  // 遮罩後的密鑰 ********
  city?: Pick<City, 'id' | 'name' | 'code'> | null;
  createdBy?: Pick<User, 'id' | 'name'>;
  updatedBy?: Pick<User, 'id' | 'name'> | null;
}

/** 配置列表查詢選項 */
export interface SharePointConfigQueryOptions {
  cityId?: string;
  includeInactive?: boolean;
}

// ===== 表單驗證 =====

/** 表單資料 */
export interface SharePointConfigFormData {
  name: string;
  description?: string;
  siteUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  libraryPath: string;
  rootFolderPath?: string;
  cityId?: string | null;
  isGlobal?: boolean;
  fileExtensions?: string;  // 逗號分隔的字串
  maxFileSizeMb?: number;
  excludeFolders?: string;  // 逗號分隔的字串
}

// ===== Graph API 擴展 =====

/** SharePoint 站點資訊 */
export interface SharePointSiteInfo {
  id: string;
  displayName: string;
  webUrl: string;
  description?: string;
}

/** SharePoint 文件庫資訊 */
export interface SharePointDriveInfo {
  id: string;
  name: string;
  driveType: string;
  webUrl: string;
  quota?: {
    used: number;
    total: number;
  };
}
```

---

## 4. 加密服務

```typescript
// src/lib/services/encryption.service.ts

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  CipherGCM,
  DecipherGCM
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 加密服務
 * 使用 AES-256-GCM 進行加密/解密
 */
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }
  }

  /**
   * 加密字串
   * @param plaintext 明文
   * @returns 格式: iv:authTag:encrypted (hex)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv) as CipherGCM;

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密字串
   * @param ciphertext 格式: iv:authTag:encrypted (hex)
   * @returns 明文
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv) as DecipherGCM;
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 生成隨機加密金鑰
   */
  static generateKey(): string {
    return randomBytes(32).toString('hex');
  }
}

// 單例實例
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}
```

---

## 5. MicrosoftGraphService 擴展

```typescript
// src/lib/services/microsoft-graph.service.ts (擴展方法)

/**
 * 獲取 SharePoint 站點資訊
 */
async getSiteInfo(siteUrl: string): Promise<SharePointSiteInfo> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  const site = await this.client
    .api(`/sites/${hostname}:${sitePath}`)
    .select('id,displayName,webUrl,description')
    .get();

  return {
    id: site.id,
    displayName: site.displayName,
    webUrl: site.webUrl,
    description: site.description
  };
}

/**
 * 獲取文件庫資訊
 */
async getDriveInfo(siteId: string, libraryPath: string): Promise<SharePointDriveInfo> {
  // 列出站點的所有文件庫
  const drives = await this.client
    .api(`/sites/${siteId}/drives`)
    .select('id,name,driveType,webUrl,quota')
    .get();

  // 找到匹配的文件庫
  const drive = drives.value.find(
    (d: any) => d.name === libraryPath || d.webUrl.includes(libraryPath)
  );

  if (!drive) {
    throw new Error(`Drive not found: ${libraryPath}`);
  }

  return {
    id: drive.id,
    name: drive.name,
    driveType: drive.driveType,
    webUrl: drive.webUrl,
    quota: drive.quota ? {
      used: drive.quota.used,
      total: drive.quota.total
    } : undefined
  };
}

/**
 * 列出文件庫的資料夾結構（用於驗證路徑）
 */
async listFolders(driveId: string, folderPath: string = ''): Promise<string[]> {
  const path = folderPath ? `/root:/${folderPath}:/children` : '/root/children';

  const items = await this.client
    .api(`/drives/${driveId}${path}`)
    .filter('folder ne null')
    .select('name')
    .get();

  return items.value.map((item: any) => item.name);
}
```

---

## 6. SharePointConfigService 服務層

```typescript
// src/lib/services/sharepoint-config.service.ts

import { PrismaClient, SharePointConfig } from '@prisma/client';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { EncryptionService, getEncryptionService } from './encryption.service';
import {
  SharePointConfigInput,
  SharePointConfigUpdateInput,
  SharePointConfigQueryOptions,
  ConnectionTestResult
} from '@/types/sharepoint-config';

/**
 * SharePoint 配置服務
 */
export class SharePointConfigService {
  private prisma: PrismaClient;
  private encryption: EncryptionService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.encryption = getEncryptionService();
  }

  /**
   * 建立配置
   */
  async createConfig(
    input: SharePointConfigInput,
    userId: string
  ): Promise<SharePointConfig> {
    // 驗證城市配置唯一性
    if (input.cityId) {
      const existingCityConfig = await this.prisma.sharePointConfig.findFirst({
        where: { cityId: input.cityId, isActive: true }
      });

      if (existingCityConfig) {
        throw new Error('此城市已有 SharePoint 配置');
      }
    }

    // 驗證全域配置唯一性
    if (input.isGlobal) {
      const existingGlobalConfig = await this.prisma.sharePointConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      });

      if (existingGlobalConfig) {
        throw new Error('已存在全域 SharePoint 配置');
      }
    }

    // 加密 Client Secret
    const encryptedSecret = this.encryption.encrypt(input.clientSecret);

    return this.prisma.sharePointConfig.create({
      data: {
        name: input.name,
        description: input.description,
        siteUrl: input.siteUrl,
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: encryptedSecret,
        libraryPath: input.libraryPath,
        rootFolderPath: input.rootFolderPath,
        cityId: input.cityId || null,
        isGlobal: input.isGlobal || false,
        fileExtensions: input.fileExtensions || ['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
        maxFileSizeMb: input.maxFileSizeMb || 50,
        excludeFolders: input.excludeFolders || [],
        createdById: userId
      }
    });
  }

  /**
   * 更新配置
   */
  async updateConfig(
    configId: string,
    input: SharePointConfigUpdateInput,
    userId: string
  ): Promise<SharePointConfig> {
    // 確認配置存在
    await this.prisma.sharePointConfig.findUniqueOrThrow({
      where: { id: configId }
    });

    const updateData: any = {
      ...input,
      updatedById: userId
    };

    // 如果更新 Client Secret，需要加密
    if (input.clientSecret) {
      updateData.clientSecret = this.encryption.encrypt(input.clientSecret);
    }

    return this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: updateData
    });
  }

  /**
   * 測試已儲存的配置連線
   */
  async testConnection(configId: string): Promise<ConnectionTestResult> {
    const config = await this.prisma.sharePointConfig.findUniqueOrThrow({
      where: { id: configId }
    });

    try {
      const decryptedSecret = this.encryption.decrypt(config.clientSecret);

      const graphService = new MicrosoftGraphService({
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: decryptedSecret
      });

      // 測試基本連線
      const connectionResult = await graphService.testConnection();
      if (!connectionResult.success) {
        await this.updateTestResult(configId, false, connectionResult.error);
        return { success: false, error: connectionResult.error };
      }

      // 測試 SharePoint 站點存取
      const siteInfo = await graphService.getSiteInfo(config.siteUrl);

      // 測試文件庫存取
      const driveInfo = await graphService.getDriveInfo(siteInfo.id, config.libraryPath);

      // 更新配置的 driveId
      await this.prisma.sharePointConfig.update({
        where: { id: configId },
        data: { driveId: driveInfo.id }
      });

      // 記錄成功
      await this.updateTestResult(configId, true);

      return {
        success: true,
        details: {
          siteInfo: {
            id: siteInfo.id,
            name: siteInfo.displayName,
            webUrl: siteInfo.webUrl
          },
          driveInfo: {
            id: driveInfo.id,
            name: driveInfo.name,
            driveType: driveInfo.driveType
          },
          permissions: ['Files.Read.All', 'Sites.Read.All']
        }
      };

    } catch (error) {
      const errorMessage = this.parseGraphError(error);
      await this.updateTestResult(configId, false, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 使用輸入直接測試（未儲存的配置）
   */
  async testConnectionWithInput(input: SharePointConfigInput): Promise<ConnectionTestResult> {
    try {
      const graphService = new MicrosoftGraphService({
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: input.clientSecret
      });

      // 測試基本連線
      const connectionResult = await graphService.testConnection();
      if (!connectionResult.success) {
        return { success: false, error: connectionResult.error };
      }

      // 測試 SharePoint 站點存取
      const siteInfo = await graphService.getSiteInfo(input.siteUrl);

      // 測試文件庫存取
      const driveInfo = await graphService.getDriveInfo(siteInfo.id, input.libraryPath);

      return {
        success: true,
        details: {
          siteInfo: {
            id: siteInfo.id,
            name: siteInfo.displayName,
            webUrl: siteInfo.webUrl
          },
          driveInfo: {
            id: driveInfo.id,
            name: driveInfo.name,
            driveType: driveInfo.driveType
          }
        }
      };

    } catch (error) {
      return { success: false, error: this.parseGraphError(error) };
    }
  }

  /**
   * 獲取配置列表
   */
  async getConfigs(options?: SharePointConfigQueryOptions): Promise<SharePointConfig[]> {
    const where: any = {};

    if (options?.cityId) {
      where.cityId = options.cityId;
    }

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    return this.prisma.sharePointConfig.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } }
      },
      orderBy: [
        { isGlobal: 'desc' },
        { city: { name: 'asc' } }
      ]
    });
  }

  /**
   * 獲取單一配置
   */
  async getConfig(configId: string): Promise<SharePointConfig | null> {
    return this.prisma.sharePointConfig.findUnique({
      where: { id: configId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } }
      }
    });
  }

  /**
   * 獲取城市適用的配置
   */
  async getConfigForCity(cityCode: string): Promise<SharePointConfig | null> {
    const city = await this.prisma.city.findUnique({
      where: { code: cityCode }
    });

    if (!city) return null;

    // 優先查找城市專屬配置
    let config = await this.prisma.sharePointConfig.findFirst({
      where: { cityId: city.id, isActive: true }
    });

    // 如果沒有，使用全域配置
    if (!config) {
      config = await this.prisma.sharePointConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      });
    }

    return config;
  }

  /**
   * 切換啟用狀態
   */
  async toggleActive(configId: string, isActive: boolean): Promise<SharePointConfig> {
    return this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: { isActive }
    });
  }

  /**
   * 刪除配置（軟刪除）
   */
  async deleteConfig(configId: string): Promise<void> {
    await this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: { isActive: false }
    });
  }

  /**
   * 更新測試結果
   */
  private async updateTestResult(
    configId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: success,
        lastTestError: error || null
      }
    });
  }

  /**
   * 解析 Graph API 錯誤
   */
  private parseGraphError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('invalid_client')) {
        return '無效的應用程式 ID 或客戶端密鑰';
      }
      if (message.includes('tenant') && message.includes('not found')) {
        return '找不到指定的租戶 ID';
      }
      if (message.includes('access_denied')) {
        return '存取被拒絕，請檢查應用程式權限';
      }
      if (message.includes('site') && message.includes('not found')) {
        return '找不到指定的 SharePoint 站點';
      }
      if (message.includes('drive') && message.includes('not found')) {
        return '找不到指定的文件庫';
      }

      return error.message;
    }

    return '未知錯誤';
  }
}
```

---

## 7. API 路由

### 7.1 配置列表與建立

```typescript
// src/app/api/admin/integrations/sharepoint/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { SharePointConfigService } from '@/lib/services/sharepoint-config.service';
import { authOptions } from '@/lib/auth';

// 驗證 Schema
const configSchema = z.object({
  name: z.string().min(1, '名稱為必填'),
  description: z.string().optional(),
  siteUrl: z.string().url('請輸入有效的 SharePoint Site URL'),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  libraryPath: z.string().min(1, '文件庫路徑為必填'),
  rootFolderPath: z.string().optional(),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  fileExtensions: z.array(z.string()).optional(),
  maxFileSizeMb: z.number().min(1).max(100).optional(),
  excludeFolders: z.array(z.string()).optional()
});

/**
 * GET /api/admin/integrations/sharepoint
 * 獲取配置列表
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('cityId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const service = new SharePointConfigService(prisma);
    const configs = await service.getConfigs({ cityId, includeInactive });

    // 遮蓋敏感資訊
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      clientSecret: '********'
    }));

    return NextResponse.json({ success: true, data: sanitizedConfigs });
  } catch (error) {
    console.error('Failed to fetch configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch configs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/integrations/sharepoint
 * 建立新配置
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validated = configSchema.parse(body);

    const service = new SharePointConfigService(prisma);
    const config = await service.createConfig(validated, session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: '********'
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create config' },
      { status: 500 }
    );
  }
}
```

### 7.2 單一配置操作

```typescript
// src/app/api/admin/integrations/sharepoint/[configId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { SharePointConfigService } from '@/lib/services/sharepoint-config.service';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: { configId: string };
}

/**
 * GET /api/admin/integrations/sharepoint/:configId
 * 獲取單一配置
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const service = new SharePointConfigService(prisma);
    const config = await service.getConfig(params.configId);

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: '********'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/integrations/sharepoint/:configId
 * 更新配置
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const service = new SharePointConfigService(prisma);
    const config = await service.updateConfig(
      params.configId,
      body,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: '********'
      }
    });
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/integrations/sharepoint/:configId
 * 刪除配置
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const service = new SharePointConfigService(prisma);
    await service.deleteConfig(params.configId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete config' },
      { status: 500 }
    );
  }
}
```

### 7.3 連線測試

```typescript
// src/app/api/admin/integrations/sharepoint/[configId]/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { SharePointConfigService } from '@/lib/services/sharepoint-config.service';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: { configId: string };
}

/**
 * POST /api/admin/integrations/sharepoint/:configId/test
 * 測試已儲存的配置連線
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const service = new SharePointConfigService(prisma);
    const result = await service.testConnection(params.configId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to test connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}
```

```typescript
// src/app/api/admin/integrations/sharepoint/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { SharePointConfigService } from '@/lib/services/sharepoint-config.service';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/admin/integrations/sharepoint/test
 * 測試未儲存的配置連線
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const service = new SharePointConfigService(prisma);
    const result = await service.testConnectionWithInput(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to test connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}
```

---

## 8. React 元件

### 8.1 配置表單

```typescript
// src/components/admin/SharePointConfigForm.tsx

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle, XCircle, Loader2, Eye, EyeOff, TestTube, Save
} from 'lucide-react';
import { toast } from 'sonner';

// 表單驗證 Schema
const formSchema = z.object({
  name: z.string().min(1, '名稱為必填'),
  description: z.string().optional(),
  siteUrl: z.string().url('請輸入有效的 SharePoint Site URL'),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  libraryPath: z.string().min(1, '文件庫路徑為必填'),
  rootFolderPath: z.string().optional(),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  fileExtensions: z.string().optional(),
  maxFileSizeMb: z.number().min(1).max(100).optional()
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  configId?: string;
  onSuccess?: () => void;
}

export function SharePointConfigForm({ configId, onSuccess }: Props) {
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    details?: any;
  } | null>(null);

  const queryClient = useQueryClient();

  // 獲取城市列表
  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities');
      const result = await response.json();
      return result.data || result;
    }
  });

  // 獲取現有配置（編輯模式）
  const { data: existingConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['sharepoint-config', configId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/integrations/sharepoint/${configId}`);
      const result = await response.json();
      return result.data;
    },
    enabled: !!configId
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      siteUrl: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      libraryPath: 'Shared Documents',
      rootFolderPath: '',
      cityId: null,
      isGlobal: false,
      fileExtensions: 'pdf,jpg,jpeg,png,tiff',
      maxFileSizeMb: 50
    }
  });

  // 當獲取到現有配置時，更新表單
  useEffect(() => {
    if (existingConfig) {
      form.reset({
        ...existingConfig,
        fileExtensions: existingConfig.fileExtensions?.join(',') || '',
        clientSecret: '' // 不顯示現有密鑰
      });
    }
  }, [existingConfig, form]);

  // 測試連線 Mutation
  const testMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const endpoint = configId
        ? `/api/admin/integrations/sharepoint/${configId}/test`
        : '/api/admin/integrations/sharepoint/test';

      const payload = {
        ...data,
        fileExtensions: data.fileExtensions?.split(',').map(s => s.trim()) || []
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      return result.data || result;
    },
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast.success('連線測試成功');
      } else {
        toast.error(`連線測試失敗: ${result.error}`);
      }
    },
    onError: () => {
      toast.error('連線測試失敗');
    }
  });

  // 儲存配置 Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const method = configId ? 'PUT' : 'POST';
      const endpoint = configId
        ? `/api/admin/integrations/sharepoint/${configId}`
        : '/api/admin/integrations/sharepoint';

      const payload = {
        ...data,
        fileExtensions: data.fileExtensions?.split(',').map(s => s.trim()) || []
      };

      // 編輯模式下，如果密鑰為空則不更新
      if (configId && !payload.clientSecret) {
        delete (payload as any).clientSecret;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('配置已儲存');
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '儲存失敗');
    }
  });

  const handleTest = () => {
    const values = form.getValues();
    testMutation.mutate(values);
  };

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data);
  };

  if (configId && isLoadingConfig) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {configId ? '編輯 SharePoint 配置' : '新增 SharePoint 配置'}
        </CardTitle>
        <CardDescription>
          配置 SharePoint 連線設定，讓系統可以自動獲取文件
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">配置名稱 *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="例如：台北辦公室 SharePoint"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cityId">關聯城市</Label>
              <Select
                value={form.watch('cityId') || ''}
                onValueChange={(value) => form.setValue('cityId', value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇城市（留空為全域）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全域配置</SelectItem>
                  {cities?.map((city: any) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name} ({city.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="配置用途說明..."
              rows={2}
            />
          </div>

          {/* Azure AD 設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">Azure AD 設定</h3>

            <div className="space-y-2">
              <Label htmlFor="tenantId">租戶 ID (Tenant ID) *</Label>
              <Input
                id="tenantId"
                {...form.register('tenantId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              {form.formState.errors.tenantId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.tenantId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">應用程式 ID (Client ID) *</Label>
              <Input
                id="clientId"
                {...form.register('clientId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              {form.formState.errors.clientId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.clientId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">
                客戶端密鑰 (Client Secret) {configId ? '' : '*'}
              </Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? 'text' : 'password'}
                  {...form.register('clientSecret')}
                  placeholder={configId ? '留空保持不變' : '輸入客戶端密鑰'}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {form.formState.errors.clientSecret && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.clientSecret.message}
                </p>
              )}
            </div>
          </div>

          {/* SharePoint 設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">SharePoint 設定</h3>

            <div className="space-y-2">
              <Label htmlFor="siteUrl">Site URL *</Label>
              <Input
                id="siteUrl"
                {...form.register('siteUrl')}
                placeholder="https://your-tenant.sharepoint.com/sites/your-site"
              />
              {form.formState.errors.siteUrl && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.siteUrl.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="libraryPath">文件庫路徑 *</Label>
                <Input
                  id="libraryPath"
                  {...form.register('libraryPath')}
                  placeholder="Shared Documents"
                />
                {form.formState.errors.libraryPath && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.libraryPath.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rootFolderPath">監控資料夾路徑</Label>
                <Input
                  id="rootFolderPath"
                  {...form.register('rootFolderPath')}
                  placeholder="Invoices/2024（留空監控整個文件庫）"
                />
              </div>
            </div>
          </div>

          {/* 文件過濾設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">文件過濾設定</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileExtensions">允許的副檔名</Label>
                <Input
                  id="fileExtensions"
                  {...form.register('fileExtensions')}
                  placeholder="pdf,jpg,jpeg,png,tiff"
                />
                <p className="text-xs text-muted-foreground">
                  以逗號分隔多個副檔名
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxFileSizeMb">最大文件大小 (MB)</Label>
                <Input
                  id="maxFileSizeMb"
                  type="number"
                  {...form.register('maxFileSizeMb', { valueAsNumber: true })}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* 連線測試結果 */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    {testResult.success ? (
                      <div className="space-y-2">
                        <p className="font-medium text-green-800">連線測試成功！</p>
                        {testResult.details && (
                          <div className="text-sm">
                            <p>站點：{testResult.details.siteInfo?.name}</p>
                            <p>文件庫：{testResult.details.driveInfo?.name}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>{testResult.error}</p>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              測試連線
            </Button>

            <Button
              type="submit"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              儲存配置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

### 8.2 配置列表

```typescript
// src/components/admin/SharePointConfigList.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  CheckCircle, XCircle, MoreVertical, Edit, Trash2,
  TestTube, Globe, Building2, Loader2, Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { toast } from 'sonner';
import { SharePointConfigForm } from './SharePointConfigForm';

export function SharePointConfigList() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  // 獲取配置列表
  const { data: configs, isLoading } = useQuery({
    queryKey: ['sharepoint-configs'],
    queryFn: async () => {
      const response = await fetch('/api/admin/integrations/sharepoint');
      const result = await response.json();
      return result.data || [];
    }
  });

  // 測試連線
  const testMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(
        `/api/admin/integrations/sharepoint/${configId}/test`,
        { method: 'POST' }
      );
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] });
      if (result.data?.success) {
        toast.success('連線測試成功');
      } else {
        toast.error(`連線測試失敗: ${result.data?.error}`);
      }
    },
    onError: () => {
      toast.error('連線測試失敗');
    }
  });

  // 切換啟用狀態
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/integrations/sharepoint/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] });
      toast.success('狀態已更新');
    }
  });

  // 刪除配置
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/integrations/sharepoint/${id}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] });
      toast.success('配置已刪除');
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">SharePoint 配置</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增配置
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名稱</TableHead>
            <TableHead>範圍</TableHead>
            <TableHead>Site URL</TableHead>
            <TableHead>連線狀態</TableHead>
            <TableHead>最後測試</TableHead>
            <TableHead>啟用</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                尚無 SharePoint 配置
              </TableCell>
            </TableRow>
          ) : (
            configs?.map((config: any) => (
              <TableRow key={config.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{config.name}</div>
                    {config.description && (
                      <div className="text-xs text-muted-foreground">
                        {config.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {config.isGlobal ? (
                    <Badge variant="secondary">
                      <Globe className="h-3 w-3 mr-1" />
                      全域
                    </Badge>
                  ) : config.city ? (
                    <Badge variant="outline">
                      <Building2 className="h-3 w-3 mr-1" />
                      {config.city.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline">未指定</Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {config.siteUrl}
                </TableCell>
                <TableCell>
                  {config.lastTestResult === true && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      正常
                    </Badge>
                  )}
                  {config.lastTestResult === false && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      失敗
                    </Badge>
                  )}
                  {config.lastTestResult === null && (
                    <Badge variant="outline">未測試</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {config.lastTestedAt ? (
                    formatDistanceToNow(new Date(config.lastTestedAt), {
                      addSuffix: true,
                      locale: zhTW
                    })
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={config.isActive}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: config.id, isActive: checked })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => testMutation.mutate(config.id)}
                        disabled={testMutation.isPending}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        測試連線
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingId(config.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        編輯
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('確定要刪除此配置嗎？')) {
                            deleteMutation.mutate(config.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* 建立對話框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增 SharePoint 配置</DialogTitle>
          </DialogHeader>
          <SharePointConfigForm
            onSuccess={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 編輯對話框 */}
      <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯 SharePoint 配置</DialogTitle>
          </DialogHeader>
          {editingId && (
            <SharePointConfigForm
              configId={editingId}
              onSuccess={() => setEditingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## 9. 測試規格

### 9.1 服務層單元測試

```typescript
// src/__tests__/services/sharepoint-config.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointConfigService } from '@/lib/services/sharepoint-config.service';
import { prismaMock } from '@/test/mocks/prisma';

vi.mock('@/lib/services/encryption.service', () => ({
  getEncryptionService: () => ({
    encrypt: vi.fn((text) => `encrypted:${text}`),
    decrypt: vi.fn((text) => text.replace('encrypted:', ''))
  })
}));

describe('SharePointConfigService', () => {
  let service: SharePointConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SharePointConfigService(prismaMock);
  });

  describe('createConfig', () => {
    it('should encrypt client secret before saving', async () => {
      prismaMock.sharePointConfig.findFirst.mockResolvedValue(null);
      prismaMock.sharePointConfig.create.mockResolvedValue({
        id: 'config-1',
        name: 'Test Config'
      });

      await service.createConfig({
        name: 'Test Config',
        siteUrl: 'https://test.sharepoint.com/sites/test',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-value',
        libraryPath: 'Documents'
      }, 'user-123');

      expect(prismaMock.sharePointConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientSecret: expect.stringContaining('encrypted:')
        })
      });
    });

    it('should reject duplicate city config', async () => {
      prismaMock.sharePointConfig.findFirst.mockResolvedValue({
        id: 'existing-config'
      });

      await expect(service.createConfig({
        name: 'Test Config',
        siteUrl: 'https://test.sharepoint.com/sites/test',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret',
        libraryPath: 'Documents',
        cityId: 'city-1'
      }, 'user-123')).rejects.toThrow('此城市已有 SharePoint 配置');
    });

    it('should reject duplicate global config', async () => {
      prismaMock.sharePointConfig.findFirst
        .mockResolvedValueOnce(null)  // 城市配置檢查
        .mockResolvedValueOnce({ id: 'existing-global' });  // 全域配置檢查

      await expect(service.createConfig({
        name: 'Test Config',
        siteUrl: 'https://test.sharepoint.com/sites/test',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret',
        libraryPath: 'Documents',
        isGlobal: true
      }, 'user-123')).rejects.toThrow('已存在全域 SharePoint 配置');
    });
  });

  describe('testConnection', () => {
    it('should update driveId on success', async () => {
      prismaMock.sharePointConfig.findUniqueOrThrow.mockResolvedValue({
        id: 'config-1',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'encrypted:secret',
        siteUrl: 'https://test.sharepoint.com/sites/test',
        libraryPath: 'Documents'
      });

      // Mock Graph Service responses
      vi.doMock('@/lib/services/microsoft-graph.service', () => ({
        MicrosoftGraphService: vi.fn().mockImplementation(() => ({
          testConnection: () => Promise.resolve({ success: true }),
          getSiteInfo: () => Promise.resolve({ id: 'site-1', displayName: 'Test Site' }),
          getDriveInfo: () => Promise.resolve({ id: 'drive-1', name: 'Documents', driveType: 'documentLibrary' })
        }))
      }));

      const result = await service.testConnection('config-1');

      expect(result.success).toBe(true);
      expect(prismaMock.sharePointConfig.update).toHaveBeenCalledWith({
        where: { id: 'config-1' },
        data: expect.objectContaining({ driveId: 'drive-1' })
      });
    });
  });

  describe('getConfigForCity', () => {
    it('should return city-specific config first', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.sharePointConfig.findFirst.mockResolvedValue({
        id: 'city-config',
        cityId: 'city-1'
      });

      const config = await service.getConfigForCity('TPE');

      expect(config?.id).toBe('city-config');
    });

    it('should fallback to global config', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.sharePointConfig.findFirst
        .mockResolvedValueOnce(null)  // 城市配置不存在
        .mockResolvedValueOnce({ id: 'global-config', isGlobal: true });  // 全域配置

      const config = await service.getConfigForCity('TPE');

      expect(config?.id).toBe('global-config');
    });
  });
});
```

### 9.2 API 路由測試

```typescript
// src/__tests__/api/admin/sharepoint-config.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest } from '@/test/utils/request';
import { GET, POST } from '@/app/api/admin/integrations/sharepoint/route';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

describe('SharePoint Config API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/integrations/sharepoint', () => {
    it('should require admin role', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { role: 'USER' }
      });

      const request = createMockRequest({ method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should return configs for admin', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' }
      });

      const request = createMockRequest({ method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should mask client secrets', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' }
      });

      const request = createMockRequest({ method: 'GET' });
      const response = await GET(request);
      const json = await response.json();

      expect(json.data[0].clientSecret).toBe('********');
    });
  });

  describe('POST /api/admin/integrations/sharepoint', () => {
    it('should validate required fields', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' }
      });

      const request = createMockRequest({
        method: 'POST',
        body: { name: 'Test' }  // Missing required fields
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
```

---

## 10. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 連線配置表單 | SharePointConfigForm 元件含所有必要欄位 |
| AC2 | 連線測試 | testConnection / testConnectionWithInput 方法 |
| AC3 | 配置儲存 | createConfig / updateConfig 方法與加密儲存 |
| AC4 | 城市級別配置 | cityId 欄位 + getConfigForCity 優先級邏輯 |

---

## 11. 安全考量

### 11.1 加密儲存
- Client Secret 使用 AES-256-GCM 加密
- 加密金鑰透過環境變數管理
- 每次加密使用隨機 IV
- 包含認證標籤（Auth Tag）防篡改

### 11.2 存取控制
- 僅 ADMIN 角色可存取配置 API
- API 回應遮蓋敏感欄位
- 操作記錄更新者資訊

### 11.3 Azure AD 權限
- 最小權限原則
- 僅需 Sites.Read.All、Files.Read.All
- 建議使用應用程式權限（非委派權限）

---

## 12. 相關文件

- [Story 9-1: SharePoint 文件監控 API](./tech-spec-story-9-1.md)
- [Epic 9: 自動化文件獲取](../03-epics/sections/epic-9-automated-document-retrieval.md)
