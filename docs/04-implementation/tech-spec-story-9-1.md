# Tech Spec: Story 9-1 SharePoint 文件監控 API

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 9.1 |
| Epic | Epic 9: 自動化文件獲取 |
| 標題 | SharePoint 文件監控 API |
| 優先級 | High |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| FR 覆蓋 | FR2 |
| 依賴 | Story 1-0 (專案初始化), Story 2-1 (文件上傳) |

## 1. 概述

### 1.1 目標
提供 API 端點供外部系統（如 n8n）提交 SharePoint 文件進行處理，實現自動化文件獲取流程。

### 1.2 用戶故事
**As a** 系統
**I want** 提供 API 供外部獲取 SharePoint 文件並提交處理
**So that** n8n 可以監控 SharePoint 並自動提交新文件

### 1.3 範圍
- SharePoint 相關數據模型設計
- Microsoft Graph API 整合服務
- SharePoint 文件提交服務
- API 端點與驗證機制
- 錯誤處理與日誌記錄

---

## 2. 數據庫設計

### 2.1 DocumentSourceType 列舉

```prisma
// 文件來源類型列舉
enum DocumentSourceType {
  MANUAL_UPLOAD   // 手動上傳
  SHAREPOINT      // SharePoint
  OUTLOOK         // Outlook 郵件附件
  API             // 外部 API
}
```

### 2.2 Document 模型擴展

```prisma
// 擴展現有 Document 模型
model Document {
  id                String              @id @default(cuid())

  // 現有欄位
  originalFileName  String              @map("original_file_name")
  fileUrl           String              @map("file_url")
  fileSize          BigInt              @map("file_size")
  mimeType          String              @map("mime_type")
  fileHash          String?             @map("file_hash")
  status            DocumentStatus      @default(PENDING)

  // 來源追蹤欄位（新增）
  sourceType        DocumentSourceType  @default(MANUAL_UPLOAD) @map("source_type")
  sourceMetadata    Json?               @map("source_metadata")

  // SharePoint 特定欄位
  sharepointItemId  String?             @map("sharepoint_item_id")
  sharepointDriveId String?             @map("sharepoint_drive_id")
  sharepointSiteId  String?             @map("sharepoint_site_id")
  sharepointUrl     String?             @map("sharepoint_url")

  // 城市關聯
  cityId            String              @map("city_id")
  city              City                @relation(fields: [cityId], references: [id])

  // 上傳/獲取者
  uploadedById      String?             @map("uploaded_by_id")
  uploadedBy        User?               @relation(fields: [uploadedById], references: [id])

  // 時間戳
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")
  processedAt       DateTime?           @map("processed_at")

  // 關聯
  processingJob     ProcessingJob?
  sharePointFetchLog SharePointFetchLog[]

  @@index([sourceType])
  @@index([cityId])
  @@index([status])
  @@index([createdAt])
  @@index([sharepointItemId])
  @@map("documents")
}
```

### 2.3 SharePointConfig 模型

```prisma
// SharePoint 連線配置
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
  driveId           String?   @map("drive_id")
  libraryPath       String    @map("library_path")

  // 城市關聯（可選，null 表示全域配置）
  cityId            String?   @unique @map("city_id")
  city              City?     @relation(fields: [cityId], references: [id])
  isGlobal          Boolean   @default(false) @map("is_global")

  // 狀態
  isActive          Boolean   @default(true) @map("is_active")
  lastTestedAt      DateTime? @map("last_tested_at")
  lastTestResult    Boolean?  @map("last_test_result")
  lastTestError     String?   @map("last_test_error")

  // 時間戳
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  createdById       String    @map("created_by_id")
  createdBy         User      @relation(fields: [createdById], references: [id])

  // 關聯
  fetchLogs         SharePointFetchLog[]

  @@index([cityId])
  @@index([isActive])
  @@index([isGlobal])
  @@map("sharepoint_configs")
}
```

### 2.4 SharePointFetchLog 模型

```prisma
// SharePoint 文件獲取日誌
model SharePointFetchLog {
  id                String                @id @default(cuid())

  // 請求資訊
  sharepointUrl     String                @map("sharepoint_url")
  sharepointItemId  String?               @map("sharepoint_item_id")
  fileName          String                @map("file_name")
  fileSize          BigInt?               @map("file_size")

  // 來源配置
  configId          String?               @map("config_id")
  config            SharePointConfig?     @relation(fields: [configId], references: [id])
  cityId            String                @map("city_id")
  city              City                  @relation(fields: [cityId], references: [id])

  // 結果
  status            SharePointFetchStatus @default(PENDING)
  documentId        String?               @map("document_id")
  document          Document?             @relation(fields: [documentId], references: [id])

  // 錯誤資訊
  errorCode         String?               @map("error_code")
  errorMessage      String?               @map("error_message")
  errorDetails      Json?                 @map("error_details")

  // API 請求資訊
  requestIp         String?               @map("request_ip")
  requestUserAgent  String?               @map("request_user_agent")
  apiKeyId          String?               @map("api_key_id")

  // 時間戳
  createdAt         DateTime              @default(now()) @map("created_at")
  completedAt       DateTime?             @map("completed_at")

  @@index([sharepointUrl])
  @@index([status])
  @@index([cityId])
  @@index([createdAt])
  @@index([configId])
  @@map("sharepoint_fetch_logs")
}

// SharePoint 獲取狀態
enum SharePointFetchStatus {
  PENDING           // 待處理
  DOWNLOADING       // 下載中
  PROCESSING        // 處理中
  COMPLETED         // 已完成
  FAILED            // 失敗
  DUPLICATE         // 重複文件
}
```

### 2.5 ApiKey 模型

```prisma
// API Key 管理
model ApiKey {
  id              String    @id @default(cuid())

  // Key 資訊
  name            String
  description     String?
  keyHash         String    @unique @map("key_hash")  // SHA-256 雜湊
  keyPrefix       String    @map("key_prefix")        // 前 8 字元用於識別

  // 權限
  permissions     Json      @default("[]")            // 權限列表
  cityAccess      Json      @default("[]")            // 可存取的城市代碼

  // 狀態
  isActive        Boolean   @default(true) @map("is_active")
  expiresAt       DateTime? @map("expires_at")
  lastUsedAt      DateTime? @map("last_used_at")

  // 建立者
  createdById     String    @map("created_by_id")
  createdBy       User      @relation(fields: [createdById], references: [id])

  // 時間戳
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@index([keyHash])
  @@index([isActive])
  @@map("api_keys")
}
```

---

## 3. 類型定義

```typescript
// src/types/sharepoint.ts

import { SharePointFetchStatus, DocumentSourceType } from '@prisma/client';

// ===== Microsoft Graph API 相關 =====

/** Graph API 配置 */
export interface GraphApiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

/** SharePoint 文件資訊 */
export interface SharePointFileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webUrl: string;
  driveId: string;
  siteId: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  downloadUrl: string;
}

/** SharePoint URL 解析結果 */
export interface SharePointUrlParts {
  siteUrl: string;
  filePath: string;
}

// ===== 文件提交相關 =====

/** SharePoint 文件提交請求 */
export interface SharePointSubmitRequest {
  sharepointUrl: string;
  cityCode: string;
  originalFileName?: string;
  metadata?: Record<string, unknown>;
}

/** SharePoint 文件提交結果 */
export interface SharePointSubmitResult {
  success: boolean;
  documentId?: string;
  processingJobId?: string;
  fetchLogId?: string;
  error?: SharePointError;
}

/** SharePoint 錯誤 */
export interface SharePointError {
  code: SharePointErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** SharePoint 錯誤代碼 */
export type SharePointErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFIG_NOT_FOUND'
  | 'CITY_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'AUTH_ERROR'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'DUPLICATE_FILE'
  | 'DOWNLOAD_FAILED'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

// ===== 批次處理相關 =====

/** 批次提交請求 */
export interface SharePointBatchSubmitRequest {
  documents: SharePointSubmitRequest[];
}

/** 批次提交結果 */
export interface SharePointBatchSubmitResult {
  total: number;
  successful: number;
  failed: number;
  results: SharePointSubmitResult[];
}

// ===== API 相關 =====

/** API Key 驗證結果 */
export interface ApiKeyValidationResult {
  valid: boolean;
  keyId?: string;
  permissions?: string[];
  cityAccess?: string[];
  error?: string;
}

/** 請求上下文 */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
  apiKeyId?: string;
}

// ===== 獲取日誌相關 =====

/** 獲取日誌查詢條件 */
export interface FetchLogQueryOptions {
  cityId?: string;
  status?: SharePointFetchStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/** 獲取日誌統計 */
export interface FetchLogStats {
  total: number;
  pending: number;
  downloading: number;
  processing: number;
  completed: number;
  failed: number;
  duplicate: number;
}

// ===== 來源 Metadata =====

/** SharePoint 來源 Metadata */
export interface SharePointSourceMetadata {
  sharepointUrl: string;
  webUrl: string;
  driveId: string;
  siteId: string;
  itemId: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  fetchedAt: string;
  fetchLogId: string;
}

// ===== 常數 =====

/** 允許的 MIME 類型 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif'
] as const;

/** 最大文件大小 (50MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** HTTP 狀態碼對應 */
export const ERROR_STATUS_CODES: Record<SharePointErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CONFIG_NOT_FOUND: 404,
  CITY_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  ACCESS_DENIED: 403,
  AUTH_ERROR: 401,
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 400,
  DUPLICATE_FILE: 409,
  DOWNLOAD_FAILED: 502,
  STORAGE_ERROR: 500,
  INTERNAL_ERROR: 500
};
```

---

## 4. Microsoft Graph API 服務

```typescript
// src/lib/services/microsoft-graph.service.ts

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import {
  GraphApiConfig,
  SharePointFileInfo,
  SharePointUrlParts
} from '@/types/sharepoint';

/**
 * Microsoft Graph API 服務
 * 處理與 SharePoint 的所有交互
 */
export class MicrosoftGraphService {
  private client: Client;
  private config: GraphApiConfig;

  constructor(config: GraphApiConfig) {
    this.config = config;
    this.initializeClient();
  }

  /**
   * 初始化 Graph API 客戶端
   */
  private initializeClient(): void {
    const credential = new ClientSecretCredential(
      this.config.tenantId,
      this.config.clientId,
      this.config.clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    this.client = Client.initWithMiddleware({
      authProvider
    });
  }

  /**
   * 從 SharePoint URL 獲取文件資訊
   */
  async getFileInfoFromUrl(sharepointUrl: string): Promise<SharePointFileInfo> {
    // 嘗試使用 shares API (適用於共享連結)
    try {
      const encodedUrl = this.encodeSharePointUrl(sharepointUrl);
      const shareResponse = await this.client
        .api(`/shares/${encodedUrl}/driveItem`)
        .get();

      const downloadUrl = await this.getDownloadUrl(
        shareResponse.parentReference.driveId,
        shareResponse.id
      );

      return this.mapToFileInfo(shareResponse, downloadUrl);
    } catch {
      // 回退到路徑解析方式
      const urlParts = this.parseSharePointUrl(sharepointUrl);
      if (!urlParts) {
        throw new Error('Invalid SharePoint URL format');
      }
      return this.getFileInfoFromPath(urlParts.siteUrl, urlParts.filePath);
    }
  }

  /**
   * 從站點路徑獲取文件資訊
   */
  private async getFileInfoFromPath(
    siteUrl: string,
    filePath: string
  ): Promise<SharePointFileInfo> {
    const siteId = await this.getSiteId(siteUrl);

    const file = await this.client
      .api(`/sites/${siteId}/drive/root:/${filePath}`)
      .get();

    const downloadUrl = await this.getDownloadUrl(
      file.parentReference.driveId,
      file.id
    );

    return this.mapToFileInfo(file, downloadUrl, siteId);
  }

  /**
   * 獲取站點 ID
   */
  private async getSiteId(siteUrl: string): Promise<string> {
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const sitePath = url.pathname;

    const site = await this.client
      .api(`/sites/${hostname}:${sitePath}`)
      .get();

    return site.id;
  }

  /**
   * 獲取文件下載 URL
   */
  private async getDownloadUrl(driveId: string, itemId: string): Promise<string> {
    const item = await this.client
      .api(`/drives/${driveId}/items/${itemId}`)
      .select('@microsoft.graph.downloadUrl')
      .get();

    return item['@microsoft.graph.downloadUrl'];
  }

  /**
   * 下載文件內容 (使用下載 URL)
   */
  async downloadFile(downloadUrl: string): Promise<Buffer> {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download file: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 下載文件內容 (使用 Drive ID 和 Item ID)
   */
  async downloadFileById(driveId: string, itemId: string): Promise<Buffer> {
    const stream = await this.client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .getStream();

    return this.streamToBuffer(stream);
  }

  /**
   * 測試連線
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.api('/organization').get();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * 編碼 SharePoint URL 用於 shares API
   */
  private encodeSharePointUrl(url: string): string {
    const base64 = Buffer.from(url).toString('base64');
    return 'u!' + base64
      .replace(/=/g, '')
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
  }

  /**
   * 解析 SharePoint URL
   */
  private parseSharePointUrl(url: string): SharePointUrlParts | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // 尋找 sites 或 s 路徑
      const sitesIndex = pathParts.indexOf('sites') !== -1
        ? pathParts.indexOf('sites')
        : pathParts.indexOf('s');

      if (sitesIndex === -1) {
        return null;
      }

      const siteUrl = `${urlObj.origin}/sites/${pathParts[sitesIndex + 1]}`;
      const filePath = pathParts.slice(sitesIndex + 2).join('/');

      return {
        siteUrl,
        filePath: decodeURIComponent(filePath)
      };
    } catch {
      return null;
    }
  }

  /**
   * 映射 Graph API 回應到 FileInfo
   */
  private mapToFileInfo(
    response: any,
    downloadUrl: string,
    siteId?: string
  ): SharePointFileInfo {
    return {
      id: response.id,
      name: response.name,
      size: response.size,
      mimeType: response.file?.mimeType || 'application/octet-stream',
      webUrl: response.webUrl,
      driveId: response.parentReference.driveId,
      siteId: siteId || response.parentReference.siteId,
      createdDateTime: response.createdDateTime,
      lastModifiedDateTime: response.lastModifiedDateTime,
      downloadUrl
    };
  }

  /**
   * Stream 轉換為 Buffer
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
```

---

## 5. SharePoint 文件服務

```typescript
// src/lib/services/sharepoint-document.service.ts

import { PrismaClient, SharePointFetchStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { BlobStorageService } from './blob-storage.service';
import { EncryptionService } from './encryption.service';
import {
  SharePointSubmitRequest,
  SharePointSubmitResult,
  SharePointBatchSubmitResult,
  SharePointFileInfo,
  SharePointSourceMetadata,
  RequestContext,
  SharePointErrorCode,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
} from '@/types/sharepoint';

/**
 * SharePoint 文件提交錯誤
 */
export class SharePointSubmitError extends Error {
  constructor(
    public code: SharePointErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SharePointSubmitError';
  }
}

/**
 * SharePoint 文件服務
 * 處理 SharePoint 文件的提交、下載、儲存流程
 */
export class SharePointDocumentService {
  constructor(
    private prisma: PrismaClient,
    private blobService: BlobStorageService,
    private encryptionService: EncryptionService
  ) {}

  /**
   * 提交 SharePoint 文件
   */
  async submitDocument(
    request: SharePointSubmitRequest,
    context: RequestContext
  ): Promise<SharePointSubmitResult> {
    // 取得城市 ID
    const cityId = await this.getCityIdByCode(request.cityCode);

    // 建立獲取日誌
    const fetchLog = await this.prisma.sharePointFetchLog.create({
      data: {
        sharepointUrl: request.sharepointUrl,
        fileName: request.originalFileName || 'unknown',
        cityId,
        requestIp: context.ip,
        requestUserAgent: context.userAgent,
        apiKeyId: context.apiKeyId,
        status: 'PENDING'
      }
    });

    try {
      // 獲取 SharePoint 配置
      const config = await this.getSharePointConfig(cityId);
      if (!config) {
        throw new SharePointSubmitError(
          'CONFIG_NOT_FOUND',
          '找不到該城市的 SharePoint 配置'
        );
      }

      // 初始化 Graph API 服務
      const graphService = new MicrosoftGraphService({
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: await this.encryptionService.decrypt(config.clientSecret)
      });

      // 更新狀態為下載中
      await this.updateFetchLog(fetchLog.id, { status: 'DOWNLOADING' });

      // 獲取文件資訊
      const fileInfo = await graphService.getFileInfoFromUrl(request.sharepointUrl);

      // 更新日誌檔名
      await this.updateFetchLog(fetchLog.id, {
        fileName: fileInfo.name,
        sharepointItemId: fileInfo.id
      });

      // 驗證文件
      this.validateFile(fileInfo);

      // 檢查重複
      if (await this.checkDuplicate(fileInfo)) {
        await this.updateFetchLog(fetchLog.id, {
          status: 'DUPLICATE',
          errorCode: 'DUPLICATE_FILE',
          errorMessage: '文件已存在'
        });
        throw new SharePointSubmitError('DUPLICATE_FILE', '此文件已經提交過');
      }

      // 下載文件
      const fileBuffer = await graphService.downloadFile(fileInfo.downloadUrl);

      // 計算文件雜湊
      const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

      // 上傳到 Blob Storage
      const blobPath = this.generateBlobPath(request.cityCode, fileInfo.name);
      const blobUrl = await this.blobService.uploadBuffer(
        fileBuffer,
        blobPath,
        fileInfo.mimeType,
        {
          sourceType: 'sharepoint',
          sharepointUrl: request.sharepointUrl,
          originalFileName: fileInfo.name
        }
      );

      // 更新狀態為處理中
      await this.updateFetchLog(fetchLog.id, { status: 'PROCESSING' });

      // 建立文件記錄
      const sourceMetadata: SharePointSourceMetadata = {
        sharepointUrl: request.sharepointUrl,
        webUrl: fileInfo.webUrl,
        driveId: fileInfo.driveId,
        siteId: fileInfo.siteId,
        itemId: fileInfo.id,
        createdDateTime: fileInfo.createdDateTime,
        lastModifiedDateTime: fileInfo.lastModifiedDateTime,
        fetchedAt: new Date().toISOString(),
        fetchLogId: fetchLog.id
      };

      const document = await this.prisma.document.create({
        data: {
          originalFileName: request.originalFileName || fileInfo.name,
          fileUrl: blobUrl,
          fileSize: BigInt(fileInfo.size),
          mimeType: fileInfo.mimeType,
          fileHash,
          sourceType: 'SHAREPOINT',
          sourceMetadata,
          sharepointItemId: fileInfo.id,
          sharepointDriveId: fileInfo.driveId,
          sharepointSiteId: fileInfo.siteId,
          sharepointUrl: request.sharepointUrl,
          cityId,
          status: 'PENDING'
        }
      });

      // 建立處理任務
      const processingJob = await this.prisma.processingJob.create({
        data: {
          documentId: document.id,
          status: 'QUEUED',
          priority: 'NORMAL'
        }
      });

      // 更新獲取日誌為完成
      await this.updateFetchLog(fetchLog.id, {
        status: 'COMPLETED',
        documentId: document.id,
        fileSize: BigInt(fileInfo.size),
        completedAt: new Date()
      });

      return {
        success: true,
        documentId: document.id,
        processingJobId: processingJob.id,
        fetchLogId: fetchLog.id
      };

    } catch (error) {
      const errorInfo = this.parseError(error);

      await this.updateFetchLog(fetchLog.id, {
        status: 'FAILED',
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        errorDetails: errorInfo.details
      });

      return {
        success: false,
        fetchLogId: fetchLog.id,
        error: errorInfo
      };
    }
  }

  /**
   * 批次提交文件
   */
  async submitDocumentsBatch(
    requests: SharePointSubmitRequest[],
    context: RequestContext
  ): Promise<SharePointBatchSubmitResult> {
    const results: SharePointSubmitResult[] = [];

    for (const request of requests) {
      const result = await this.submitDocument(request, context);
      results.push(result);
    }

    return {
      total: requests.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * 驗證文件
   */
  private validateFile(fileInfo: SharePointFileInfo): void {
    // 檢查文件類型
    if (!ALLOWED_MIME_TYPES.includes(fileInfo.mimeType as any)) {
      throw new SharePointSubmitError(
        'INVALID_FILE_TYPE',
        `不支援的文件類型: ${fileInfo.mimeType}`,
        { allowedTypes: ALLOWED_MIME_TYPES, receivedType: fileInfo.mimeType }
      );
    }

    // 檢查文件大小
    if (fileInfo.size > MAX_FILE_SIZE) {
      throw new SharePointSubmitError(
        'FILE_TOO_LARGE',
        `文件大小超過限制 (最大 ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        { fileSize: fileInfo.size, maxSize: MAX_FILE_SIZE }
      );
    }
  }

  /**
   * 檢查重複文件
   */
  private async checkDuplicate(fileInfo: SharePointFileInfo): Promise<boolean> {
    const existing = await this.prisma.document.findFirst({
      where: {
        sharepointItemId: fileInfo.id,
        sharepointDriveId: fileInfo.driveId
      }
    });

    return !!existing;
  }

  /**
   * 獲取 SharePoint 配置
   */
  private async getSharePointConfig(cityId: string) {
    // 優先查找城市專屬配置
    let config = await this.prisma.sharePointConfig.findFirst({
      where: {
        cityId,
        isActive: true
      }
    });

    // 如果沒有城市專屬配置，使用全域配置
    if (!config) {
      config = await this.prisma.sharePointConfig.findFirst({
        where: {
          isGlobal: true,
          isActive: true
        }
      });
    }

    return config;
  }

  /**
   * 取得城市 ID
   */
  private async getCityIdByCode(cityCode: string): Promise<string> {
    const city = await this.prisma.city.findUnique({
      where: { code: cityCode }
    });

    if (!city) {
      throw new SharePointSubmitError('CITY_NOT_FOUND', `找不到城市: ${cityCode}`);
    }

    return city.id;
  }

  /**
   * 更新獲取日誌
   */
  private async updateFetchLog(
    id: string,
    data: Partial<{
      status: SharePointFetchStatus;
      fileName: string;
      fileSize: bigint;
      sharepointItemId: string;
      documentId: string;
      errorCode: string;
      errorMessage: string;
      errorDetails: Record<string, unknown>;
      completedAt: Date;
    }>
  ): Promise<void> {
    await this.prisma.sharePointFetchLog.update({
      where: { id },
      data
    });
  }

  /**
   * 生成 Blob 路徑
   */
  private generateBlobPath(cityCode: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `documents/sharepoint/${cityCode}/${timestamp}_${sanitizedFileName}`;
  }

  /**
   * 解析錯誤
   */
  private parseError(error: unknown): {
    code: SharePointErrorCode;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (error instanceof SharePointSubmitError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details
      };
    }

    if (error instanceof Error) {
      // Graph API 錯誤映射
      if (error.message.includes('ItemNotFound')) {
        return { code: 'FILE_NOT_FOUND', message: '找不到指定的文件' };
      }
      if (error.message.includes('AccessDenied')) {
        return { code: 'ACCESS_DENIED', message: '沒有權限存取此文件' };
      }
      if (error.message.includes('InvalidAuthenticationToken')) {
        return { code: 'AUTH_ERROR', message: '認證失敗，請檢查 SharePoint 配置' };
      }

      return { code: 'INTERNAL_ERROR', message: error.message };
    }

    return { code: 'INTERNAL_ERROR', message: '未知錯誤' };
  }
}
```

---

## 6. API Key 驗證服務

```typescript
// src/lib/auth/api-key.service.ts

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ApiKeyValidationResult } from '@/types/sharepoint';

/**
 * API Key 驗證服務
 */
export class ApiKeyService {
  /**
   * 驗證 API Key
   */
  static async verify(request: NextRequest): Promise<ApiKeyValidationResult> {
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      return { valid: false, error: 'API key is required' };
    }

    // 計算雜湊值
    const hashedKey = createHash('sha256').update(apiKey).digest('hex');

    // 查詢 API Key
    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash: hashedKey,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (!keyRecord) {
      return { valid: false, error: 'Invalid or expired API key' };
    }

    // 更新最後使用時間
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      valid: true,
      keyId: keyRecord.id,
      permissions: keyRecord.permissions as string[],
      cityAccess: keyRecord.cityAccess as string[]
    };
  }

  /**
   * 從請求中提取 API Key
   */
  private static extractApiKey(request: NextRequest): string | null {
    // 優先從 x-api-key header 取得
    const headerKey = request.headers.get('x-api-key');
    if (headerKey) {
      return headerKey;
    }

    // 其次從 Authorization header 取得
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }

  /**
   * 檢查城市存取權限
   */
  static checkCityAccess(cityAccess: string[], cityCode: string): boolean {
    // 空陣列表示可存取所有城市
    if (cityAccess.length === 0) {
      return true;
    }
    return cityAccess.includes(cityCode);
  }

  /**
   * 檢查權限
   */
  static checkPermission(permissions: string[], requiredPermission: string): boolean {
    return permissions.includes(requiredPermission) || permissions.includes('*');
  }
}
```

---

## 7. API 路由

### 7.1 提交 SharePoint 文件

```typescript
// src/app/api/documents/from-sharepoint/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { SharePointDocumentService } from '@/lib/services/sharepoint-document.service';
import { BlobStorageService } from '@/lib/services/blob-storage.service';
import { EncryptionService } from '@/lib/services/encryption.service';
import { ApiKeyService } from '@/lib/auth/api-key.service';
import { ERROR_STATUS_CODES, SharePointErrorCode } from '@/types/sharepoint';

// 請求驗證 Schema
const submitSchema = z.object({
  sharepointUrl: z.string().url('無效的 SharePoint URL'),
  cityCode: z.string().min(1, '城市代碼為必填'),
  originalFileName: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const batchSubmitSchema = z.object({
  documents: z.array(submitSchema).min(1, '至少需要一個文件').max(50, '最多 50 個文件')
});

/**
 * POST /api/documents/from-sharepoint
 * 提交 SharePoint 文件
 */
export async function POST(request: NextRequest) {
  // 驗證 API Key
  const apiKeyResult = await ApiKeyService.verify(request);
  if (!apiKeyResult.valid) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: apiKeyResult.error }
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // 初始化服務
    const service = new SharePointDocumentService(
      prisma,
      new BlobStorageService(),
      new EncryptionService()
    );

    const requestContext = {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip') ||
          'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      apiKeyId: apiKeyResult.keyId
    };

    // 檢查是否為批次請求
    if (body.documents) {
      const validated = batchSubmitSchema.parse(body);

      // 驗證城市存取權限
      for (const doc of validated.documents) {
        if (!ApiKeyService.checkCityAccess(apiKeyResult.cityAccess || [], doc.cityCode)) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'ACCESS_DENIED',
                message: `無權限存取城市: ${doc.cityCode}`
              }
            },
            { status: 403 }
          );
        }
      }

      const result = await service.submitDocumentsBatch(
        validated.documents,
        requestContext
      );

      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // 單一文件請求
    const validated = submitSchema.parse(body);

    // 驗證城市存取權限
    if (!ApiKeyService.checkCityAccess(apiKeyResult.cityAccess || [], validated.cityCode)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: `無權限存取城市: ${validated.cityCode}`
          }
        },
        { status: 403 }
      );
    }

    const result = await service.submitDocument(validated, requestContext);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          documentId: result.documentId,
          processingJobId: result.processingJobId,
          fetchLogId: result.fetchLogId,
          message: '文件已成功提交處理'
        }
      });
    }

    const statusCode = ERROR_STATUS_CODES[result.error?.code as SharePointErrorCode] || 500;
    return NextResponse.json(
      { success: false, error: result.error },
      { status: statusCode }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '請求參數驗證失敗',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    console.error('SharePoint submit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '內部伺服器錯誤'
        }
      },
      { status: 500 }
    );
  }
}
```

### 7.2 查詢提交狀態

```typescript
// src/app/api/documents/from-sharepoint/status/[fetchLogId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiKeyService } from '@/lib/auth/api-key.service';

interface RouteParams {
  params: { fetchLogId: string };
}

/**
 * GET /api/documents/from-sharepoint/status/:fetchLogId
 * 查詢提交狀態
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // 驗證 API Key
  const apiKeyResult = await ApiKeyService.verify(request);
  if (!apiKeyResult.valid) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: apiKeyResult.error } },
      { status: 401 }
    );
  }

  try {
    const fetchLog = await prisma.sharePointFetchLog.findUnique({
      where: { id: params.fetchLogId },
      include: {
        document: {
          include: {
            processingJob: true
          }
        },
        city: {
          select: { code: true }
        }
      }
    });

    if (!fetchLog) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '找不到獲取記錄' } },
        { status: 404 }
      );
    }

    // 驗證城市存取權限
    if (!ApiKeyService.checkCityAccess(
      apiKeyResult.cityAccess || [],
      fetchLog.city.code
    )) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: '無權限存取此記錄' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: fetchLog.id,
        status: fetchLog.status,
        sharepointUrl: fetchLog.sharepointUrl,
        fileName: fetchLog.fileName,
        fileSize: fetchLog.fileSize ? Number(fetchLog.fileSize) : null,
        documentId: fetchLog.documentId,
        processingJobId: fetchLog.document?.processingJob?.id,
        processingStatus: fetchLog.document?.processingJob?.status,
        error: fetchLog.errorCode ? {
          code: fetchLog.errorCode,
          message: fetchLog.errorMessage
        } : null,
        createdAt: fetchLog.createdAt.toISOString(),
        completedAt: fetchLog.completedAt?.toISOString()
      }
    });

  } catch (error) {
    console.error('Fetch status error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '內部伺服器錯誤' } },
      { status: 500 }
    );
  }
}
```

---

## 8. 加密服務

```typescript
// src/lib/services/encryption.service.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * 加密服務
 * 用於加密/解密敏感資料（如 Client Secret）
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
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
   * @returns 格式: iv:encrypted (hex)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密字串
   * @param ciphertext 格式: iv:encrypted (hex)
   */
  decrypt(ciphertext: string): string {
    const [ivHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid ciphertext format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

---

## 9. 測試規格

### 9.1 單元測試

```typescript
// src/__tests__/services/sharepoint-document.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointDocumentService, SharePointSubmitError } from '@/lib/services/sharepoint-document.service';
import { prismaMock } from '@/test/mocks/prisma';
import { blobServiceMock } from '@/test/mocks/blob-storage';
import { encryptionServiceMock } from '@/test/mocks/encryption';

// Mock Microsoft Graph Service
vi.mock('@/lib/services/microsoft-graph.service', () => ({
  MicrosoftGraphService: vi.fn().mockImplementation(() => ({
    getFileInfoFromUrl: vi.fn(),
    downloadFile: vi.fn()
  }))
}));

describe('SharePointDocumentService', () => {
  let service: SharePointDocumentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SharePointDocumentService(
      prismaMock,
      blobServiceMock,
      encryptionServiceMock
    );
  });

  describe('submitDocument', () => {
    const validRequest = {
      sharepointUrl: 'https://tenant.sharepoint.com/sites/Site/Shared Documents/invoice.pdf',
      cityCode: 'TPE'
    };

    const mockContext = { ip: '127.0.0.1', userAgent: 'test' };

    it('should successfully submit a valid SharePoint file', async () => {
      // Setup mocks
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.sharePointConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'encrypted-secret'
      });
      prismaMock.sharePointFetchLog.create.mockResolvedValue({ id: 'log-1' });
      prismaMock.document.findFirst.mockResolvedValue(null); // 無重複
      prismaMock.document.create.mockResolvedValue({ id: 'doc-1' });
      prismaMock.processingJob.create.mockResolvedValue({ id: 'job-1' });

      const result = await service.submitDocument(validRequest, mockContext);

      expect(result.success).toBe(true);
      expect(result.documentId).toBe('doc-1');
      expect(result.processingJobId).toBe('job-1');
    });

    it('should reject when city not found', async () => {
      prismaMock.city.findUnique.mockResolvedValue(null);
      prismaMock.sharePointFetchLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.submitDocument(validRequest, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CITY_NOT_FOUND');
    });

    it('should reject when config not found', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.sharePointConfig.findFirst.mockResolvedValue(null);
      prismaMock.sharePointFetchLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.submitDocument(validRequest, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should detect duplicate files', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.sharePointConfig.findFirst.mockResolvedValue({
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'encrypted-secret'
      });
      prismaMock.sharePointFetchLog.create.mockResolvedValue({ id: 'log-1' });
      prismaMock.document.findFirst.mockResolvedValue({ id: 'existing-doc' });

      const result = await service.submitDocument(validRequest, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DUPLICATE_FILE');
    });
  });

  describe('validateFile', () => {
    it('should reject unsupported MIME types', () => {
      const fileInfo = {
        id: 'file-1',
        name: 'document.docx',
        size: 1024,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        downloadUrl: 'https://...'
      };

      expect(() => service['validateFile'](fileInfo)).toThrow(SharePointSubmitError);
    });

    it('should reject files exceeding size limit', () => {
      const fileInfo = {
        id: 'file-1',
        name: 'large.pdf',
        size: 100 * 1024 * 1024, // 100MB
        mimeType: 'application/pdf',
        downloadUrl: 'https://...'
      };

      expect(() => service['validateFile'](fileInfo)).toThrow(SharePointSubmitError);
    });
  });
});
```

### 9.2 API 路由測試

```typescript
// src/__tests__/api/from-sharepoint.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/documents/from-sharepoint/route';
import { createMockRequest } from '@/test/utils/request';
import { ApiKeyService } from '@/lib/auth/api-key.service';

vi.mock('@/lib/auth/api-key.service');
vi.mock('@/lib/services/sharepoint-document.service');

describe('POST /api/documents/from-sharepoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject request without API key', async () => {
    vi.mocked(ApiKeyService.verify).mockResolvedValue({
      valid: false,
      error: 'API key is required'
    });

    const request = createMockRequest({
      method: 'POST',
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf',
        cityCode: 'TPE'
      }
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('should accept valid submission with API key', async () => {
    vi.mocked(ApiKeyService.verify).mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      permissions: ['sharepoint:submit'],
      cityAccess: ['TPE']
    });

    const request = createMockRequest({
      method: 'POST',
      headers: { 'x-api-key': 'valid-api-key' },
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf',
        cityCode: 'TPE'
      }
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('should validate required fields', async () => {
    vi.mocked(ApiKeyService.verify).mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      permissions: ['*'],
      cityAccess: []
    });

    const request = createMockRequest({
      method: 'POST',
      headers: { 'x-api-key': 'valid-api-key' },
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf'
        // missing cityCode
      }
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject access to unauthorized city', async () => {
    vi.mocked(ApiKeyService.verify).mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      permissions: ['sharepoint:submit'],
      cityAccess: ['TPE'] // 只有 TPE 權限
    });

    vi.mocked(ApiKeyService.checkCityAccess).mockReturnValue(false);

    const request = createMockRequest({
      method: 'POST',
      headers: { 'x-api-key': 'valid-api-key' },
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf',
        cityCode: 'HKG' // 無權限的城市
      }
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe('ACCESS_DENIED');
  });
});
```

### 9.3 整合測試

```typescript
// src/__tests__/integration/sharepoint-flow.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestApiKey, cleanupTestData } from '@/test/utils/db';

describe('SharePoint Integration Flow', () => {
  let apiKey: string;
  let testCityId: string;

  beforeAll(async () => {
    // 建立測試資料
    const city = await prisma.city.create({
      data: { code: 'TEST', name: 'Test City' }
    });
    testCityId = city.id;

    apiKey = await createTestApiKey({
      permissions: ['sharepoint:submit'],
      cityAccess: ['TEST']
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should complete full submission flow', async () => {
    // 此測試需要實際的 SharePoint 環境
    // 可使用 Mock 服務進行測試
  });
});
```

---

## 10. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | API 接收 SharePoint 文件提交 | `POST /api/documents/from-sharepoint` 端點接收 URL、cityCode、fileName |
| AC2 | 文件下載與處理任務創建 | MicrosoftGraphService 下載 → BlobStorage 儲存 → ProcessingJob 建立 |
| AC3 | 成功響應包含任務 ID | 返回 documentId 和 processingJobId |
| AC4 | 錯誤處理與日誌記錄 | SharePointFetchLog 記錄所有請求，包含錯誤代碼和詳情 |

---

## 11. 安全考量

### 11.1 API Key 安全
- API Key 使用 SHA-256 雜湊儲存
- 支援過期時間設定
- 記錄最後使用時間用於稽核
- 城市級別存取控制

### 11.2 憑證安全
- Client Secret 使用 AES-256-CBC 加密儲存
- 加密金鑰透過環境變數管理
- 建議使用 Azure Key Vault（生產環境）

### 11.3 文件驗證
- MIME 類型白名單驗證
- 文件大小限制（50MB）
- 重複文件檢測

---

## 12. 相關文件

- [Story 9-2: SharePoint 連線配置](./tech-spec-story-9-2.md)
- [Story 9-5: 自動獲取來源追蹤](./tech-spec-story-9-5.md)
- [Epic 9: 自動化文件獲取](../03-epics/sections/epic-9-automated-document-retrieval.md)
