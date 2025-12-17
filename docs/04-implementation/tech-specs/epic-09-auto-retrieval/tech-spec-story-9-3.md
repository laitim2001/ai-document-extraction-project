# Tech Spec: Story 9-3 Outlook 郵件附件提取 API

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 9.3 |
| Epic | Epic 9: 自動化文件獲取 |
| 標題 | Outlook 郵件附件提取 API |
| 優先級 | High |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| FR 覆蓋 | FR3 |
| 依賴 | Story 9-1 (MicrosoftGraphService) |

## 1. 概述

### 1.1 目標
提供 API 端點供外部系統（如 n8n）提交 Outlook 郵件附件進行處理，支援兩種提交模式：Message ID 或 Direct Upload。

### 1.2 用戶故事
**As a** 系統
**I want** 提供 API 供外部提取 Outlook 郵件附件並提交處理
**So that** n8n 可以監控郵箱並自動提取發票附件

### 1.3 範圍
- Outlook 相關數據模型設計
- Outlook 郵件服務（繼承 MicrosoftGraphService）
- 附件提交與處理服務
- 過濾規則驗證
- API 端點與錯誤處理

---

## 2. 數據庫設計

### 2.1 OutlookConfig 模型

```prisma
// Outlook 配置
model OutlookConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String
  description       String?

  // 郵箱設定
  mailboxAddress    String    @map("mailbox_address")

  // Azure AD 設定
  tenantId          String    @map("tenant_id")
  clientId          String    @map("client_id")
  clientSecret      String    @map("client_secret")  // 加密儲存

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
  createdById       String    @map("created_by_id")
  createdBy         User      @relation("OutlookConfigCreator", fields: [createdById], references: [id])

  // 關聯
  filterRules       OutlookFilterRule[]
  fetchLogs         OutlookFetchLog[]

  @@index([cityId])
  @@index([isActive])
  @@index([isGlobal])
  @@map("outlook_configs")
}
```

### 2.2 OutlookFilterRule 模型

```prisma
// Outlook 過濾規則
model OutlookFilterRule {
  id              String            @id @default(cuid())
  configId        String            @map("config_id")
  config          OutlookConfig     @relation(fields: [configId], references: [id], onDelete: Cascade)

  // 規則類型
  ruleType        OutlookRuleType   @map("rule_type")
  operator        RuleOperator      @default(CONTAINS)
  ruleValue       String            @map("rule_value")
  isWhitelist     Boolean           @default(true) @map("is_whitelist")

  // 狀態
  isActive        Boolean           @default(true) @map("is_active")
  priority        Int               @default(0)

  // 時間戳
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  @@index([configId])
  @@index([priority])
  @@map("outlook_filter_rules")
}

// 過濾規則類型
enum OutlookRuleType {
  SENDER_EMAIL      // 寄件者 Email
  SENDER_DOMAIN     // 寄件者網域
  SUBJECT_KEYWORD   // 主旨關鍵字
  SUBJECT_REGEX     // 主旨正則表達式
  ATTACHMENT_TYPE   // 附件類型
  ATTACHMENT_NAME   // 附件名稱模式
}

// 規則運算符
enum RuleOperator {
  EQUALS            // 完全匹配
  CONTAINS          // 包含
  STARTS_WITH       // 開頭匹配
  ENDS_WITH         // 結尾匹配
  REGEX             // 正則表達式
}
```

### 2.3 OutlookFetchLog 模型

```prisma
// Outlook 獲取日誌
model OutlookFetchLog {
  id                  String                @id @default(cuid())

  // 郵件資訊
  messageId           String?               @map("message_id")
  subject             String
  senderEmail         String                @map("sender_email")
  senderName          String?               @map("sender_name")
  receivedAt          DateTime              @map("received_at")

  // 請求方式
  submissionType      OutlookSubmissionType @default(DIRECT_UPLOAD) @map("submission_type")

  // 附件統計
  totalAttachments    Int                   @map("total_attachments")
  validAttachments    Int                   @default(0) @map("valid_attachments")
  skippedAttachments  Int                   @default(0) @map("skipped_attachments")

  // 來源配置
  configId            String?               @map("config_id")
  config              OutlookConfig?        @relation(fields: [configId], references: [id])
  cityId              String                @map("city_id")
  city                City                  @relation(fields: [cityId], references: [id])

  // 狀態
  status              OutlookFetchStatus    @default(PENDING)

  // 結果
  documentIds         String[]              @default([]) @map("document_ids")
  skippedFiles        Json?                 @map("skipped_files")

  // 錯誤資訊
  errorCode           String?               @map("error_code")
  errorMessage        String?               @map("error_message")

  // API 請求資訊
  requestIp           String?               @map("request_ip")
  requestUserAgent    String?               @map("request_user_agent")
  apiKeyId            String?               @map("api_key_id")

  // 時間戳
  createdAt           DateTime              @default(now()) @map("created_at")
  completedAt         DateTime?             @map("completed_at")

  @@index([messageId])
  @@index([senderEmail])
  @@index([status])
  @@index([cityId])
  @@index([createdAt])
  @@map("outlook_fetch_logs")
}

// 提交方式
enum OutlookSubmissionType {
  MESSAGE_ID        // 使用 Message ID 讓系統獲取
  DIRECT_UPLOAD     // 直接上傳附件內容
}

// Outlook 獲取狀態
enum OutlookFetchStatus {
  PENDING           // 待處理
  FETCHING          // 獲取中
  PROCESSING        // 處理中
  COMPLETED         // 已完成
  PARTIAL           // 部分成功
  FAILED            // 失敗
  FILTERED          // 被過濾規則排除
}
```

---

## 3. 類型定義

```typescript
// src/types/outlook.ts

import { OutlookFetchStatus, OutlookRuleType, RuleOperator, OutlookSubmissionType } from '@prisma/client';

// ===== 郵件資訊 =====

/** 郵件資訊 */
export interface MailInfo {
  id: string;
  subject: string;
  sender: {
    email: string;
    name?: string;
  };
  receivedDateTime: string;
  attachments: AttachmentInfo[];
}

/** 附件資訊 */
export interface AttachmentInfo {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

/** 附件內容（含 Base64） */
export interface AttachmentContent extends AttachmentInfo {
  contentBytes: string;  // Base64 編碼
}

// ===== 提交請求 =====

/** 直接上傳的附件 */
export interface DirectAttachment {
  fileName: string;
  contentType: string;
  contentBase64: string;
}

/** Outlook 提交請求 */
export interface OutlookSubmitRequest {
  // 方式一：使用 Message ID
  messageId?: string;

  // 方式二：直接上傳附件
  attachments?: DirectAttachment[];

  // 共用欄位
  cityCode: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
}

// ===== 處理結果 =====

/** 單一附件處理結果 */
export interface AttachmentResult {
  fileName: string;
  status: 'success' | 'skipped' | 'failed';
  documentId?: string;
  processingJobId?: string;
  skipReason?: string;
  error?: string;
}

/** 完整提交結果 */
export interface OutlookSubmitResult {
  success: boolean;
  fetchLogId: string;
  totalAttachments: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  results: AttachmentResult[];
  error?: OutlookError;
}

/** Outlook 錯誤 */
export interface OutlookError {
  code: OutlookErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Outlook 錯誤代碼 */
export type OutlookErrorCode =
  | 'VALIDATION_ERROR'
  | 'CITY_NOT_FOUND'
  | 'CONFIG_NOT_FOUND'
  | 'AUTH_ERROR'
  | 'MAIL_NOT_FOUND'
  | 'ATTACHMENT_NOT_FOUND'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'DUPLICATE_ATTACHMENT'
  | 'FILTERED'
  | 'PROCESSING_ERROR'
  | 'INTERNAL_ERROR';

// ===== 過濾規則 =====

/** 過濾規則檢查結果 */
export interface FilterCheckResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: {
    id: string;
    ruleType: OutlookRuleType;
    isWhitelist: boolean;
  };
}

// ===== 來源 Metadata =====

/** Outlook 來源 Metadata */
export interface OutlookSourceMetadata {
  messageId?: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: string;
  attachmentName: string;
  attachmentIndex: number;
  totalAttachments: number;
  fetchLogId: string;
}

// ===== 常數 =====

/** 允許的 MIME 類型 */
export const OUTLOOK_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif'
] as const;

/** 最大附件大小 (30MB) */
export const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024;

/** HTTP 狀態碼對應 */
export const OUTLOOK_ERROR_STATUS_CODES: Record<OutlookErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CITY_NOT_FOUND: 404,
  CONFIG_NOT_FOUND: 404,
  AUTH_ERROR: 401,
  MAIL_NOT_FOUND: 404,
  ATTACHMENT_NOT_FOUND: 404,
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 400,
  DUPLICATE_ATTACHMENT: 409,
  FILTERED: 422,
  PROCESSING_ERROR: 500,
  INTERNAL_ERROR: 500
};
```

---

## 4. OutlookMailService 服務

```typescript
// src/lib/services/outlook-mail.service.ts

import { MicrosoftGraphService, GraphApiConfig } from './microsoft-graph.service';
import { MailInfo, AttachmentInfo, AttachmentContent } from '@/types/outlook';

/**
 * Outlook 郵件服務
 * 繼承 MicrosoftGraphService，提供郵件專屬操作
 */
export class OutlookMailService extends MicrosoftGraphService {
  private mailboxAddress: string;

  constructor(config: GraphApiConfig, mailboxAddress: string) {
    super(config);
    this.mailboxAddress = mailboxAddress;
  }

  /**
   * 獲取郵件資訊
   */
  async getMailInfo(messageId: string): Promise<MailInfo> {
    const message = await this.client
      .api(`/users/${this.mailboxAddress}/messages/${messageId}`)
      .select('id,subject,sender,receivedDateTime')
      .expand('attachments($select=id,name,contentType,size,isInline)')
      .get();

    return {
      id: message.id,
      subject: message.subject,
      sender: {
        email: message.sender?.emailAddress?.address || '',
        name: message.sender?.emailAddress?.name
      },
      receivedDateTime: message.receivedDateTime,
      attachments: this.mapAttachments(message.attachments || [])
    };
  }

  /**
   * 獲取單一附件內容
   */
  async getAttachmentContent(
    messageId: string,
    attachmentId: string
  ): Promise<AttachmentContent> {
    const attachment = await this.client
      .api(`/users/${this.mailboxAddress}/messages/${messageId}/attachments/${attachmentId}`)
      .get();

    return {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      isInline: attachment.isInline,
      contentBytes: attachment.contentBytes
    };
  }

  /**
   * 獲取所有非內嵌附件
   */
  async getAllAttachments(messageId: string): Promise<AttachmentContent[]> {
    const mailInfo = await this.getMailInfo(messageId);

    // 過濾內嵌附件
    const regularAttachments = mailInfo.attachments.filter(att => !att.isInline);

    const attachmentContents = await Promise.all(
      regularAttachments.map(att =>
        this.getAttachmentContent(messageId, att.id)
      )
    );

    return attachmentContents;
  }

  /**
   * 測試郵箱存取權限
   */
  async testMailboxAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      // 測試用戶資訊存取
      await this.client
        .api(`/users/${this.mailboxAddress}`)
        .select('id,displayName,mail')
        .get();

      // 測試郵件讀取權限
      await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .top(1)
        .select('id')
        .get();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * 映射附件列表
   */
  private mapAttachments(attachments: any[]): AttachmentInfo[] {
    return attachments.map(att => ({
      id: att.id,
      name: att.name,
      contentType: att.contentType,
      size: att.size,
      isInline: att.isInline || false
    }));
  }
}
```

---

## 5. OutlookDocumentService 服務

```typescript
// src/lib/services/outlook-document.service.ts

import { PrismaClient, OutlookFetchStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { OutlookMailService } from './outlook-mail.service';
import { BlobStorageService } from './blob-storage.service';
import { EncryptionService, getEncryptionService } from './encryption.service';
import {
  OutlookSubmitRequest,
  OutlookSubmitResult,
  AttachmentResult,
  DirectAttachment,
  OutlookSourceMetadata,
  FilterCheckResult,
  OutlookErrorCode,
  OUTLOOK_ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_SIZE
} from '@/types/outlook';

/** 附件處理上下文 */
interface AttachmentContext {
  cityId: string;
  cityCode: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  messageId?: string;
  receivedAt?: string;
  attachmentIndex: number;
  totalAttachments: number;
  fetchLogId: string;
}

/** 解析後的附件 */
interface ParsedAttachment {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

/**
 * Outlook 文件提交服務
 */
export class OutlookDocumentService {
  private prisma: PrismaClient;
  private blobService: BlobStorageService;
  private encryption: EncryptionService;

  constructor(prisma: PrismaClient, blobService: BlobStorageService) {
    this.prisma = prisma;
    this.blobService = blobService;
    this.encryption = getEncryptionService();
  }

  /**
   * 提交郵件附件
   */
  async submitMailAttachments(
    request: OutlookSubmitRequest,
    context: { ip?: string; userAgent?: string; apiKeyId?: string }
  ): Promise<OutlookSubmitResult> {
    // 驗證城市
    const city = await this.prisma.city.findUnique({
      where: { code: request.cityCode }
    });

    if (!city) {
      return this.createErrorResult('CITY_NOT_FOUND', `找不到城市: ${request.cityCode}`);
    }

    // 建立獲取日誌
    const fetchLog = await this.prisma.outlookFetchLog.create({
      data: {
        messageId: request.messageId,
        subject: request.subject,
        senderEmail: request.senderEmail,
        senderName: request.senderName,
        receivedAt: request.receivedAt ? new Date(request.receivedAt) : new Date(),
        submissionType: request.messageId ? 'MESSAGE_ID' : 'DIRECT_UPLOAD',
        totalAttachments: 0,
        validAttachments: 0,
        skippedAttachments: 0,
        cityId: city.id,
        requestIp: context.ip,
        requestUserAgent: context.userAgent,
        apiKeyId: context.apiKeyId,
        status: 'PENDING'
      }
    });

    try {
      // 檢查過濾規則
      const filterResult = await this.checkFilterRules(request, city.id);
      if (!filterResult.allowed) {
        await this.updateFetchLog(fetchLog.id, {
          status: 'FILTERED',
          errorCode: 'FILTERED',
          errorMessage: filterResult.reason
        });

        return {
          success: false,
          fetchLogId: fetchLog.id,
          totalAttachments: 0,
          processedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          results: [],
          error: { code: 'FILTERED', message: filterResult.reason! }
        };
      }

      // 獲取附件
      let attachments: ParsedAttachment[];

      if (request.messageId) {
        await this.updateFetchLog(fetchLog.id, { status: 'FETCHING' });
        attachments = await this.fetchAttachmentsFromOutlook(request.messageId, city.id);
      } else if (request.attachments && request.attachments.length > 0) {
        attachments = this.parseDirectAttachments(request.attachments);
      } else {
        throw new Error('必須提供 messageId 或 attachments');
      }

      await this.updateFetchLog(fetchLog.id, {
        totalAttachments: attachments.length,
        status: 'PROCESSING'
      });

      // 處理每個附件
      const results: AttachmentResult[] = [];
      const documentIds: string[] = [];
      const skippedFiles: Array<{ fileName: string; reason: string }> = [];

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const result = await this.processAttachment(attachment, {
          cityId: city.id,
          cityCode: request.cityCode,
          senderEmail: request.senderEmail,
          senderName: request.senderName,
          subject: request.subject,
          messageId: request.messageId,
          receivedAt: request.receivedAt,
          attachmentIndex: i,
          totalAttachments: attachments.length,
          fetchLogId: fetchLog.id
        });

        results.push(result);

        if (result.status === 'success' && result.documentId) {
          documentIds.push(result.documentId);
        } else if (result.status === 'skipped') {
          skippedFiles.push({ fileName: result.fileName, reason: result.skipReason! });
        }
      }

      const processedCount = results.filter(r => r.status === 'success').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      // 決定最終狀態
      let finalStatus: OutlookFetchStatus;
      if (failedCount === attachments.length) {
        finalStatus = 'FAILED';
      } else if (skippedCount === attachments.length) {
        finalStatus = 'FILTERED';
      } else if (processedCount < attachments.length) {
        finalStatus = 'PARTIAL';
      } else {
        finalStatus = 'COMPLETED';
      }

      // 更新獲取日誌
      await this.updateFetchLog(fetchLog.id, {
        status: finalStatus,
        validAttachments: processedCount,
        skippedAttachments: skippedCount,
        documentIds,
        skippedFiles,
        completedAt: new Date()
      });

      return {
        success: processedCount > 0,
        fetchLogId: fetchLog.id,
        totalAttachments: attachments.length,
        processedCount,
        skippedCount,
        failedCount,
        results
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateFetchLog(fetchLog.id, {
        status: 'FAILED',
        errorCode: 'PROCESSING_ERROR',
        errorMessage
      });

      return this.createErrorResult('PROCESSING_ERROR', errorMessage, fetchLog.id);
    }
  }

  /**
   * 從 Outlook 獲取附件
   */
  private async fetchAttachmentsFromOutlook(
    messageId: string,
    cityId: string
  ): Promise<ParsedAttachment[]> {
    const config = await this.getOutlookConfig(cityId);
    if (!config) {
      throw new Error('找不到 Outlook 配置');
    }

    const decryptedSecret = this.encryption.decrypt(config.clientSecret);
    const mailService = new OutlookMailService(
      {
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: decryptedSecret
      },
      config.mailboxAddress
    );

    const attachments = await mailService.getAllAttachments(messageId);

    return attachments.map(att => ({
      fileName: att.name,
      contentType: att.contentType,
      buffer: Buffer.from(att.contentBytes, 'base64')
    }));
  }

  /**
   * 解析直接上傳的附件
   */
  private parseDirectAttachments(attachments: DirectAttachment[]): ParsedAttachment[] {
    return attachments.map(att => ({
      fileName: att.fileName,
      contentType: att.contentType,
      buffer: Buffer.from(att.contentBase64, 'base64')
    }));
  }

  /**
   * 處理單一附件
   */
  private async processAttachment(
    attachment: ParsedAttachment,
    context: AttachmentContext
  ): Promise<AttachmentResult> {
    const { fileName, contentType, buffer } = attachment;

    // 檢查文件類型
    if (!OUTLOOK_ALLOWED_MIME_TYPES.includes(contentType as any)) {
      return {
        fileName,
        status: 'skipped',
        skipReason: `不支援的文件類型: ${contentType}`
      };
    }

    // 檢查文件大小
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      return {
        fileName,
        status: 'skipped',
        skipReason: `文件大小超過限制 (最大 ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`
      };
    }

    try {
      // 計算文件雜湊
      const fileHash = createHash('sha256').update(buffer).digest('hex');

      // 檢查重複（同一封郵件的同名附件）
      if (context.messageId) {
        const existing = await this.prisma.document.findFirst({
          where: {
            sourceType: 'OUTLOOK',
            originalFileName: fileName,
            sourceMetadata: {
              path: ['messageId'],
              equals: context.messageId
            }
          }
        });

        if (existing) {
          return {
            fileName,
            status: 'skipped',
            skipReason: '此附件已處理過'
          };
        }
      }

      // 上傳到 Blob Storage
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobPath = `documents/outlook/${context.cityCode}/${timestamp}_${sanitizedFileName}`;

      const blobUrl = await this.blobService.uploadBuffer(
        buffer,
        blobPath,
        contentType,
        {
          sourceType: 'outlook',
          senderEmail: context.senderEmail,
          subject: context.subject
        }
      );

      // 建立來源 Metadata
      const sourceMetadata: OutlookSourceMetadata = {
        messageId: context.messageId,
        subject: context.subject,
        senderEmail: context.senderEmail,
        senderName: context.senderName,
        receivedAt: context.receivedAt || new Date().toISOString(),
        attachmentName: fileName,
        attachmentIndex: context.attachmentIndex,
        totalAttachments: context.totalAttachments,
        fetchLogId: context.fetchLogId
      };

      // 建立文件記錄
      const document = await this.prisma.document.create({
        data: {
          originalFileName: fileName,
          fileUrl: blobUrl,
          fileSize: BigInt(buffer.length),
          mimeType: contentType,
          fileHash,
          sourceType: 'OUTLOOK',
          sourceMetadata,
          cityId: context.cityId,
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

      return {
        fileName,
        status: 'success',
        documentId: document.id,
        processingJobId: processingJob.id
      };

    } catch (error) {
      return {
        fileName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 檢查過濾規則
   */
  private async checkFilterRules(
    request: OutlookSubmitRequest,
    cityId: string
  ): Promise<FilterCheckResult> {
    const config = await this.getOutlookConfig(cityId);
    if (!config) {
      return { allowed: true };  // 沒有配置則允許
    }

    const rules = await this.prisma.outlookFilterRule.findMany({
      where: {
        configId: config.id,
        isActive: true
      },
      orderBy: { priority: 'asc' }
    });

    // 先檢查白名單規則
    const whitelistRules = rules.filter(r => r.isWhitelist);
    if (whitelistRules.length > 0) {
      const matchesAnyWhitelist = whitelistRules.some(rule =>
        this.checkRuleMatch(rule, request)
      );

      if (!matchesAnyWhitelist) {
        return {
          allowed: false,
          reason: '不符合任何白名單規則'
        };
      }
    }

    // 再檢查黑名單規則
    const blacklistRules = rules.filter(r => !r.isWhitelist);
    for (const rule of blacklistRules) {
      if (this.checkRuleMatch(rule, request)) {
        return {
          allowed: false,
          reason: `符合黑名單規則: ${rule.ruleType}`,
          matchedRule: {
            id: rule.id,
            ruleType: rule.ruleType,
            isWhitelist: false
          }
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 檢查單一規則是否匹配
   */
  private checkRuleMatch(
    rule: { ruleType: string; operator: string; ruleValue: string },
    request: OutlookSubmitRequest
  ): boolean {
    let targetValue: string;

    switch (rule.ruleType) {
      case 'SENDER_EMAIL':
        targetValue = request.senderEmail.toLowerCase();
        break;
      case 'SENDER_DOMAIN':
        targetValue = request.senderEmail.split('@')[1]?.toLowerCase() || '';
        break;
      case 'SUBJECT_KEYWORD':
      case 'SUBJECT_REGEX':
        targetValue = request.subject;
        break;
      default:
        return false;
    }

    const ruleValue = rule.ruleValue.toLowerCase();

    switch (rule.operator) {
      case 'EQUALS':
        return targetValue.toLowerCase() === ruleValue;
      case 'CONTAINS':
        return targetValue.toLowerCase().includes(ruleValue);
      case 'STARTS_WITH':
        return targetValue.toLowerCase().startsWith(ruleValue);
      case 'ENDS_WITH':
        return targetValue.toLowerCase().endsWith(ruleValue);
      case 'REGEX':
        try {
          const regex = new RegExp(rule.ruleValue, 'i');
          return regex.test(targetValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * 獲取 Outlook 配置
   */
  private async getOutlookConfig(cityId: string) {
    // 優先查找城市專屬配置
    let config = await this.prisma.outlookConfig.findFirst({
      where: { cityId, isActive: true }
    });

    // 如果沒有，使用全域配置
    if (!config) {
      config = await this.prisma.outlookConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      });
    }

    return config;
  }

  /**
   * 更新獲取日誌
   */
  private async updateFetchLog(
    id: string,
    data: Partial<{
      status: OutlookFetchStatus;
      totalAttachments: number;
      validAttachments: number;
      skippedAttachments: number;
      documentIds: string[];
      skippedFiles: Array<{ fileName: string; reason: string }>;
      errorCode: string;
      errorMessage: string;
      completedAt: Date;
    }>
  ): Promise<void> {
    await this.prisma.outlookFetchLog.update({
      where: { id },
      data
    });
  }

  /**
   * 建立錯誤結果
   */
  private createErrorResult(
    code: OutlookErrorCode,
    message: string,
    fetchLogId?: string
  ): OutlookSubmitResult {
    return {
      success: false,
      fetchLogId: fetchLogId || '',
      totalAttachments: 0,
      processedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      error: { code, message }
    };
  }
}
```

---

## 6. API 路由

### 6.1 提交郵件附件

```typescript
// src/app/api/documents/from-outlook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { OutlookDocumentService } from '@/lib/services/outlook-document.service';
import { BlobStorageService } from '@/lib/services/blob-storage.service';
import { ApiKeyService } from '@/lib/auth/api-key.service';
import { OUTLOOK_ERROR_STATUS_CODES, OutlookErrorCode } from '@/types/outlook';

// 請求驗證 Schema
const directAttachmentSchema = z.object({
  fileName: z.string().min(1, '檔名為必填'),
  contentType: z.string().min(1, '內容類型為必填'),
  contentBase64: z.string().min(1, 'Base64 內容為必填')
});

const submitSchema = z.object({
  messageId: z.string().optional(),
  attachments: z.array(directAttachmentSchema).optional(),
  cityCode: z.string().min(1, '城市代碼為必填'),
  senderEmail: z.string().email('請輸入有效的寄件者 Email'),
  senderName: z.string().optional(),
  subject: z.string().min(1, '郵件主旨為必填'),
  receivedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
}).refine(
  data => data.messageId || (data.attachments && data.attachments.length > 0),
  { message: '必須提供 messageId 或 attachments' }
);

/**
 * POST /api/documents/from-outlook
 * 提交郵件附件
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
    const validated = submitSchema.parse(body);

    // 驗證城市存取權限
    if (!ApiKeyService.checkCityAccess(apiKeyResult.cityAccess || [], validated.cityCode)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ACCESS_DENIED', message: `無權限存取城市: ${validated.cityCode}` }
        },
        { status: 403 }
      );
    }

    const service = new OutlookDocumentService(prisma, new BlobStorageService());
    const result = await service.submitMailAttachments(
      validated,
      {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
        apiKeyId: apiKeyResult.keyId
      }
    );

    if (result.success || result.processedCount > 0) {
      return NextResponse.json({
        success: true,
        data: {
          fetchLogId: result.fetchLogId,
          summary: {
            total: result.totalAttachments,
            processed: result.processedCount,
            skipped: result.skippedCount,
            failed: result.failedCount
          },
          results: result.results.map(r => ({
            fileName: r.fileName,
            status: r.status,
            documentId: r.documentId,
            processingJobId: r.processingJobId,
            reason: r.skipReason || r.error
          }))
        }
      });
    }

    const statusCode = OUTLOOK_ERROR_STATUS_CODES[result.error?.code as OutlookErrorCode] || 500;
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        fetchLogId: result.fetchLogId
      },
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

    console.error('Outlook submit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '內部伺服器錯誤' }
      },
      { status: 500 }
    );
  }
}
```

### 6.2 查詢提交狀態

```typescript
// src/app/api/documents/from-outlook/status/[fetchLogId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiKeyService } from '@/lib/auth/api-key.service';

interface RouteParams {
  params: { fetchLogId: string };
}

/**
 * GET /api/documents/from-outlook/status/:fetchLogId
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
    const fetchLog = await prisma.outlookFetchLog.findUnique({
      where: { id: params.fetchLogId },
      include: {
        city: { select: { code: true } }
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

    // 獲取關聯的文件處理狀態
    const documents = fetchLog.documentIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: fetchLog.documentIds } },
          include: { processingJob: { select: { id: true, status: true } } }
        })
      : [];

    return NextResponse.json({
      success: true,
      data: {
        id: fetchLog.id,
        status: fetchLog.status,
        subject: fetchLog.subject,
        senderEmail: fetchLog.senderEmail,
        senderName: fetchLog.senderName,
        receivedAt: fetchLog.receivedAt.toISOString(),
        summary: {
          total: fetchLog.totalAttachments,
          processed: fetchLog.validAttachments,
          skipped: fetchLog.skippedAttachments
        },
        documents: documents.map(doc => ({
          id: doc.id,
          fileName: doc.originalFileName,
          status: doc.status,
          processingJobId: doc.processingJob?.id,
          processingStatus: doc.processingJob?.status
        })),
        skippedFiles: fetchLog.skippedFiles,
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

## 7. 測試規格

### 7.1 單元測試

```typescript
// src/__tests__/services/outlook-document.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutlookDocumentService } from '@/lib/services/outlook-document.service';
import { prismaMock } from '@/test/mocks/prisma';
import { blobServiceMock } from '@/test/mocks/blob-storage';

vi.mock('@/lib/services/encryption.service');

describe('OutlookDocumentService', () => {
  let service: OutlookDocumentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OutlookDocumentService(prismaMock, blobServiceMock);
  });

  describe('submitMailAttachments', () => {
    const baseRequest = {
      cityCode: 'TPE',
      senderEmail: 'vendor@example.com',
      subject: 'Invoice October 2024'
    };

    it('should process multiple attachments successfully', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.outlookFetchLog.create.mockResolvedValue({ id: 'log-1' });
      prismaMock.outlookConfig.findFirst.mockResolvedValue(null);  // 無過濾規則
      prismaMock.document.create.mockResolvedValue({ id: 'doc-1' });
      prismaMock.processingJob.create.mockResolvedValue({ id: 'job-1' });

      const result = await service.submitMailAttachments({
        ...baseRequest,
        attachments: [
          { fileName: 'invoice1.pdf', contentType: 'application/pdf', contentBase64: 'dGVzdA==' },
          { fileName: 'invoice2.pdf', contentType: 'application/pdf', contentBase64: 'dGVzdA==' }
        ]
      }, {});

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should skip unsupported file types', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.outlookFetchLog.create.mockResolvedValue({ id: 'log-1' });
      prismaMock.outlookConfig.findFirst.mockResolvedValue(null);
      prismaMock.document.create.mockResolvedValue({ id: 'doc-1' });
      prismaMock.processingJob.create.mockResolvedValue({ id: 'job-1' });

      const result = await service.submitMailAttachments({
        ...baseRequest,
        attachments: [
          { fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: 'dGVzdA==' },
          { fileName: 'doc.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contentBase64: 'dGVzdA==' }
        ]
      }, {});

      expect(result.processedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.results.find(r => r.fileName === 'doc.docx')?.status).toBe('skipped');
    });

    it('should apply blacklist filter rules', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.outlookFetchLog.create.mockResolvedValue({ id: 'log-1' });
      prismaMock.outlookConfig.findFirst.mockResolvedValue({ id: 'config-1' });
      prismaMock.outlookFilterRule.findMany.mockResolvedValue([
        { ruleType: 'SENDER_DOMAIN', operator: 'EQUALS', ruleValue: 'spam.com', isWhitelist: false, isActive: true }
      ]);

      const result = await service.submitMailAttachments({
        ...baseRequest,
        senderEmail: 'sender@spam.com',
        attachments: [{ fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: 'dGVzdA==' }]
      }, {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILTERED');
    });

    it('should require messageId or attachments', async () => {
      prismaMock.city.findUnique.mockResolvedValue({ id: 'city-1', code: 'TPE' });
      prismaMock.outlookFetchLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.submitMailAttachments({
        ...baseRequest
        // 沒有 messageId 或 attachments
      }, {});

      expect(result.success).toBe(false);
    });
  });

  describe('checkFilterRules', () => {
    it('should allow when no config exists', async () => {
      prismaMock.outlookConfig.findFirst.mockResolvedValue(null);

      const result = await service['checkFilterRules'](
        { cityCode: 'TPE', senderEmail: 'test@example.com', subject: 'Test' },
        'city-1'
      );

      expect(result.allowed).toBe(true);
    });

    it('should block when whitelist rule not matched', async () => {
      prismaMock.outlookConfig.findFirst.mockResolvedValue({ id: 'config-1' });
      prismaMock.outlookFilterRule.findMany.mockResolvedValue([
        { ruleType: 'SENDER_DOMAIN', operator: 'EQUALS', ruleValue: 'trusted.com', isWhitelist: true, isActive: true }
      ]);

      const result = await service['checkFilterRules'](
        { cityCode: 'TPE', senderEmail: 'sender@untrusted.com', subject: 'Test' },
        'city-1'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('白名單');
    });
  });
});
```

### 7.2 API 路由測試

```typescript
// src/__tests__/api/from-outlook.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/documents/from-outlook/route';
import { createMockRequest } from '@/test/utils/request';
import { ApiKeyService } from '@/lib/auth/api-key.service';

vi.mock('@/lib/auth/api-key.service');

describe('POST /api/documents/from-outlook', () => {
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
        cityCode: 'TPE',
        senderEmail: 'vendor@example.com',
        subject: 'Invoice',
        attachments: [{ fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: 'dGVzdA==' }]
      }
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should validate required fields', async () => {
    vi.mocked(ApiKeyService.verify).mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      cityAccess: ['TPE']
    });
    vi.mocked(ApiKeyService.checkCityAccess).mockReturnValue(true);

    const request = createMockRequest({
      method: 'POST',
      headers: { 'x-api-key': 'valid-key' },
      body: {
        cityCode: 'TPE',
        senderEmail: 'vendor@example.com'
        // missing subject and attachments
      }
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should process direct upload attachments', async () => {
    vi.mocked(ApiKeyService.verify).mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      cityAccess: ['TPE']
    });
    vi.mocked(ApiKeyService.checkCityAccess).mockReturnValue(true);

    const request = createMockRequest({
      method: 'POST',
      headers: { 'x-api-key': 'valid-key' },
      body: {
        cityCode: 'TPE',
        senderEmail: 'vendor@example.com',
        subject: 'October Invoice',
        attachments: [
          { fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: 'JVBERi0xLjQ=' }
        ]
      }
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

---

## 8. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | API 接收郵件附件提交 | `POST /api/documents/from-outlook` 支援 messageId 或 attachments 模式 |
| AC2 | 附件解析與過濾 | OUTLOOK_ALLOWED_MIME_TYPES 驗證 + OutlookFilterRule 規則檢查 |
| AC3 | 多附件處理 | 迴圈處理每個附件，獨立建立 Document 和 ProcessingJob |
| AC4 | 處理結果返回 | AttachmentResult[] 包含成功/跳過/失敗狀態及原因 |

---

## 9. n8n 整合說明

### 9.1 兩種提交模式

| 模式 | 適用場景 | 優點 | 缺點 |
|------|----------|------|------|
| MESSAGE_ID | n8n 僅傳遞郵件 ID | 減少 n8n 記憶體使用 | 需要系統有 Outlook 權限 |
| DIRECT_UPLOAD | n8n 預處理附件 | 降低系統權限需求 | 傳輸資料量較大 |

### 9.2 建議使用 Direct Upload 模式
- n8n 可預先過濾不需要的附件
- 減少系統對 Outlook 的 API 呼叫
- 簡化權限配置

### 9.3 n8n 整合範例

```javascript
// n8n Function Node 範例
const attachments = items[0].binary;
const result = [];

for (const key of Object.keys(attachments)) {
  const att = attachments[key];
  result.push({
    fileName: att.fileName,
    contentType: att.mimeType,
    contentBase64: att.data  // Base64 encoded
  });
}

return [{
  json: {
    cityCode: 'TPE',
    senderEmail: $node["Outlook Trigger"].json.from,
    subject: $node["Outlook Trigger"].json.subject,
    receivedAt: $node["Outlook Trigger"].json.receivedDateTime,
    attachments: result
  }
}];
```

---

## 10. 安全考量

### 10.1 API 認證
- 所有請求需 API Key 認證
- 支援城市級別存取控制
- 記錄 API Key 使用情況

### 10.2 過濾規則
- 白名單/黑名單規則支援
- 可依寄件者、網域、主旨過濾
- 防止處理不相關郵件

### 10.3 文件驗證
- MIME 類型白名單
- 文件大小限制 (30MB)
- 重複文件檢測

---

## 11. 相關文件

- [Story 9-1: SharePoint 文件監控 API](./tech-spec-story-9-1.md)
- [Story 9-4: Outlook 連線配置](./tech-spec-story-9-4.md)
- [Story 9-5: 自動獲取來源追蹤](./tech-spec-story-9-5.md)
- [Epic 9: 自動化文件獲取](../03-epics/sections/epic-9-automated-document-retrieval.md)
