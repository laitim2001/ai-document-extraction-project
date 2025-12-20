/**
 * @fileoverview Outlook 文件提交服務
 * @description
 *   處理從 Outlook 郵件提交文件的完整流程，包含：
 *   - 附件獲取（透過 Message ID 或直接上傳）
 *   - 過濾規則驗證（白名單/黑名單）
 *   - 文件類型和大小驗證
 *   - Azure Blob 儲存
 *   - 文件記錄建立
 *   - 處理隊列建立
 *
 *   ## 處理流程
 *   1. 驗證請求和城市權限
 *   2. 建立獲取日誌
 *   3. 檢查過濾規則
 *   4. 獲取附件（MESSAGE_ID 或 DIRECT_UPLOAD）
 *   5. 驗證每個附件（類型、大小、重複）
 *   6. 上傳到 Azure Blob Storage
 *   7. 建立 Document 記錄
 *   8. 建立 ProcessingQueue 記錄
 *   9. 更新獲取日誌狀態
 *
 * @module src/services/outlook-document.service
 * @author Development Team
 * @since Epic 9 - Story 9.3 (Outlook 郵件附件提取 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 雙模式附件提交（MESSAGE_ID / DIRECT_UPLOAD）
 *   - 過濾規則驗證（白名單/黑名單）
 *   - 重複文件檢測
 *   - 完整錯誤處理和日誌
 *
 * @dependencies
 *   - src/services/outlook-mail.service.ts - Outlook 郵件服務
 *   - src/services/encryption.service.ts - 密鑰解密
 *   - src/lib/azure/storage.ts - Azure Blob 操作
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/app/api/documents/from-outlook/route.ts - API 端點
 *   - src/types/outlook.ts - 類型定義
 */

import { createHash } from 'crypto';
import type { PrismaClient, OutlookFetchStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { OutlookMailService } from './outlook-mail.service';
import { EncryptionService } from './encryption.service';
import { uploadFile } from '@/lib/azure/storage';
import type {
  OutlookSubmitRequest,
  OutlookSubmitResult,
  AttachmentResult,
  DirectAttachment,
  OutlookSourceMetadata,
  FilterCheckResult,
  OutlookErrorCode,
  AttachmentContext,
  ParsedAttachment,
  OutlookRequestContext,
} from '@/types/outlook';
import {
  OUTLOOK_ALLOWED_MIME_TYPE_SET,
  MAX_ATTACHMENT_SIZE,
} from '@/types/outlook';

// ============================================================
// Error Class
// ============================================================

/**
 * Outlook 文件提交錯誤
 */
export class OutlookSubmitError extends Error {
  constructor(
    public code: OutlookErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OutlookSubmitError';
  }
}

// ============================================================
// Service
// ============================================================

/**
 * Outlook 文件服務
 *
 * @description
 *   處理 Outlook 郵件附件的提交、下載、儲存流程。
 *   為 n8n 等外部系統提供自動化附件獲取功能。
 *
 * @example
 *   const service = new OutlookDocumentService(prisma, encryptionService);
 *   const result = await service.submitMailAttachments(
 *     {
 *       cityCode: 'TPE',
 *       senderEmail: 'vendor@example.com',
 *       subject: 'Invoice October 2024',
 *       attachments: [{ fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: '...' }]
 *     },
 *     { ip: '127.0.0.1', apiKeyId: 'key-1' }
 *   );
 */
export class OutlookDocumentService {
  constructor(
    private prisma: PrismaClient,
    private encryptionService: EncryptionService
  ) {}

  /**
   * 提交郵件附件
   *
   * @description
   *   完整處理 Outlook 郵件附件提交流程。
   *   支援兩種模式：
   *   - MESSAGE_ID: 透過郵件 ID 自動獲取附件
   *   - DIRECT_UPLOAD: 直接上傳附件內容
   *
   * @param request - 提交請求
   * @param context - 請求上下文（IP、UserAgent、API Key ID）
   * @returns 提交結果
   *
   * @example
   *   // 直接上傳模式
   *   const result = await service.submitMailAttachments({
   *     cityCode: 'TPE',
   *     senderEmail: 'vendor@example.com',
   *     subject: 'Invoice October 2024',
   *     attachments: [
   *       { fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: 'JVBERi0...' }
   *     ]
   *   }, context);
   */
  async submitMailAttachments(
    request: OutlookSubmitRequest,
    context: OutlookRequestContext
  ): Promise<OutlookSubmitResult> {
    // 取得城市資訊
    const city = await this.getCityByCode(request.cityCode);
    if (!city) {
      return this.createErrorResult('CITY_NOT_FOUND', `找不到城市: ${request.cityCode}`);
    }

    // 取得 Outlook 配置（用於記錄 configId）
    const config = await this.getOutlookConfig(city.id);

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
        configId: config?.id,
        cityId: city.id,
        requestIp: context.ip,
        requestUserAgent: context.userAgent,
        apiKeyId: context.apiKeyId,
        status: 'PENDING',
      },
    });

    try {
      // 檢查過濾規則
      const filterResult = await this.checkFilterRules(request, city.id);
      if (!filterResult.allowed) {
        await this.updateFetchLog(fetchLog.id, {
          status: 'FILTERED',
          errorCode: 'FILTERED',
          errorMessage: filterResult.reason,
        });

        return {
          success: false,
          fetchLogId: fetchLog.id,
          totalAttachments: 0,
          processedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          results: [],
          error: { code: 'FILTERED', message: filterResult.reason || '被過濾規則排除' },
        };
      }

      // 獲取附件
      let attachments: ParsedAttachment[];

      if (request.messageId) {
        // MESSAGE_ID 模式：從 Outlook 獲取
        await this.updateFetchLog(fetchLog.id, { status: 'FETCHING' });
        attachments = await this.fetchAttachmentsFromOutlook(request.messageId, city.id);
      } else if (request.attachments && request.attachments.length > 0) {
        // DIRECT_UPLOAD 模式：解析直接上傳的附件
        attachments = this.parseDirectAttachments(request.attachments);
      } else {
        throw new OutlookSubmitError(
          'VALIDATION_ERROR',
          '必須提供 messageId 或 attachments'
        );
      }

      // 更新總附件數
      await this.updateFetchLog(fetchLog.id, {
        totalAttachments: attachments.length,
        status: 'PROCESSING',
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
          fetchLogId: fetchLog.id,
        });

        results.push(result);

        if (result.status === 'success' && result.documentId) {
          documentIds.push(result.documentId);
        } else if (result.status === 'skipped' && result.skipReason) {
          skippedFiles.push({ fileName: result.fileName, reason: result.skipReason });
        }
      }

      const processedCount = results.filter((r) => r.status === 'success').length;
      const skippedCount = results.filter((r) => r.status === 'skipped').length;
      const failedCount = results.filter((r) => r.status === 'failed').length;

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
        completedAt: new Date(),
      });

      return {
        success: processedCount > 0,
        fetchLogId: fetchLog.id,
        totalAttachments: attachments.length,
        processedCount,
        skippedCount,
        failedCount,
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode =
        error instanceof OutlookSubmitError ? error.code : 'PROCESSING_ERROR';

      await this.updateFetchLog(fetchLog.id, {
        status: 'FAILED',
        errorCode,
        errorMessage,
      });

      return this.createErrorResult(errorCode as OutlookErrorCode, errorMessage, fetchLog.id);
    }
  }

  /**
   * 從 Outlook 獲取附件
   *
   * @description
   *   使用 OutlookMailService 從指定郵件獲取所有非內嵌附件。
   *
   * @param messageId - Outlook 郵件 ID
   * @param cityId - 城市 ID（用於查找配置）
   * @returns 解析後的附件陣列
   */
  private async fetchAttachmentsFromOutlook(
    messageId: string,
    cityId: string
  ): Promise<ParsedAttachment[]> {
    const config = await this.getOutlookConfig(cityId);
    if (!config) {
      throw new OutlookSubmitError('CONFIG_NOT_FOUND', '找不到 Outlook 配置');
    }

    const decryptedSecret = this.encryptionService.decrypt(config.clientSecret);
    const mailService = new OutlookMailService(
      {
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: decryptedSecret,
      },
      config.mailboxAddress
    );

    const attachments = await mailService.getAllAttachments(messageId);

    return attachments.map((att) => ({
      fileName: att.name,
      contentType: att.contentType,
      buffer: Buffer.from(att.contentBytes, 'base64'),
    }));
  }

  /**
   * 解析直接上傳的附件
   *
   * @description
   *   將 Base64 編碼的附件轉換為 Buffer。
   *
   * @param attachments - 直接上傳的附件陣列
   * @returns 解析後的附件陣列
   */
  private parseDirectAttachments(attachments: DirectAttachment[]): ParsedAttachment[] {
    return attachments.map((att) => ({
      fileName: att.fileName,
      contentType: att.contentType,
      buffer: Buffer.from(att.contentBase64, 'base64'),
    }));
  }

  /**
   * 處理單一附件
   *
   * @description
   *   驗證附件類型和大小，上傳到 Blob Storage，建立 Document 和 ProcessingQueue 記錄。
   *
   * @param attachment - 解析後的附件
   * @param context - 附件處理上下文
   * @returns 處理結果
   */
  private async processAttachment(
    attachment: ParsedAttachment,
    context: AttachmentContext
  ): Promise<AttachmentResult> {
    const { fileName, contentType, buffer } = attachment;

    // 檢查文件類型
    if (!OUTLOOK_ALLOWED_MIME_TYPE_SET.has(contentType)) {
      return {
        fileName,
        status: 'skipped',
        skipReason: `不支援的文件類型: ${contentType}`,
      };
    }

    // 檢查文件大小
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      return {
        fileName,
        status: 'skipped',
        skipReason: `文件大小超過限制 (最大 ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`,
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
            fileName: fileName,
            sourceMetadata: {
              path: ['messageId'],
              equals: context.messageId,
            },
          },
        });

        if (existing) {
          return {
            fileName,
            status: 'skipped',
            skipReason: '此附件已處理過',
          };
        }
      }

      // 獲取文件擴展名
      const fileExtension = this.getFileExtension(fileName);

      // 上傳到 Blob Storage
      const uploadResult = await uploadFile(buffer, fileName, {
        contentType,
        folder: `outlook/${context.cityCode}`,
        metadata: {
          sourceType: 'outlook',
          senderEmail: context.senderEmail,
          subject: context.subject,
        },
      });

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
        fetchLogId: context.fetchLogId,
      };

      // 獲取系統用戶 ID
      const uploadedById = await this.getSystemUserId();

      // 建立文件記錄
      const document = await this.prisma.document.create({
        data: {
          fileName,
          fileType: contentType,
          fileExtension,
          fileSize: buffer.length,
          filePath: uploadResult.blobUrl,
          blobName: uploadResult.blobName,
          fileHash,
          sourceType: 'OUTLOOK',
          sourceMetadata: sourceMetadata as unknown as Prisma.InputJsonValue,
          uploadedBy: uploadedById,
          cityCode: context.cityCode,
          status: 'UPLOADED',
        },
      });

      // 建立處理隊列
      const processingQueue = await this.prisma.processingQueue.create({
        data: {
          documentId: document.id,
          cityCode: context.cityCode,
          processingPath: 'AUTO_APPROVE',
          priority: 0,
          status: 'PENDING',
          routingReason: 'Outlook 自動獲取',
        },
      });

      return {
        fileName,
        status: 'success',
        documentId: document.id,
        processingJobId: processingQueue.id,
      };
    } catch (error) {
      return {
        fileName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 檢查過濾規則
   *
   * @description
   *   依序檢查白名單和黑名單規則。
   *   - 如果有白名單規則，必須匹配至少一條
   *   - 如果匹配任何黑名單規則，則拒絕
   *
   * @param request - 提交請求
   * @param cityId - 城市 ID
   * @returns 過濾檢查結果
   */
  private async checkFilterRules(
    request: OutlookSubmitRequest,
    cityId: string
  ): Promise<FilterCheckResult> {
    const config = await this.getOutlookConfig(cityId);
    if (!config) {
      return { allowed: true }; // 沒有配置則允許
    }

    const rules = await this.prisma.outlookFilterRule.findMany({
      where: {
        configId: config.id,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    });

    if (rules.length === 0) {
      return { allowed: true }; // 沒有規則則允許
    }

    // 先檢查白名單規則
    const whitelistRules = rules.filter((r) => r.isWhitelist);
    if (whitelistRules.length > 0) {
      const matchesAnyWhitelist = whitelistRules.some((rule) =>
        this.checkRuleMatch(rule, request)
      );

      if (!matchesAnyWhitelist) {
        return {
          allowed: false,
          reason: '不符合任何白名單規則',
        };
      }
    }

    // 再檢查黑名單規則
    const blacklistRules = rules.filter((r) => !r.isWhitelist);
    for (const rule of blacklistRules) {
      if (this.checkRuleMatch(rule, request)) {
        return {
          allowed: false,
          reason: `符合黑名單規則: ${rule.ruleType}`,
          matchedRule: {
            id: rule.id,
            ruleType: rule.ruleType,
            isWhitelist: false,
          },
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 檢查單一規則是否匹配
   *
   * @param rule - 過濾規則
   * @param request - 提交請求
   * @returns 是否匹配
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
   *
   * @description
   *   優先查找城市專屬配置，如果沒有則使用全域配置。
   *
   * @param cityId - 城市 ID
   * @returns Outlook 配置或 null
   */
  private async getOutlookConfig(cityId: string) {
    // 優先查找城市專屬配置
    let config = await this.prisma.outlookConfig.findFirst({
      where: {
        cityId,
        isActive: true,
      },
    });

    // 如果沒有城市專屬配置，使用全域配置
    if (!config) {
      config = await this.prisma.outlookConfig.findFirst({
        where: {
          isGlobal: true,
          isActive: true,
        },
      });
    }

    return config;
  }

  /**
   * 取得城市資訊
   *
   * @param cityCode - 城市代碼
   * @returns 城市資訊或 null
   */
  private async getCityByCode(
    cityCode: string
  ): Promise<{ id: string; code: string } | null> {
    return this.prisma.city.findUnique({
      where: { code: cityCode },
      select: { id: true, code: true },
    });
  }

  /**
   * 獲取系統用戶 ID
   *
   * @description
   *   獲取用於 Outlook 自動上傳的系統用戶 ID。
   *   優先使用環境變數，否則查找系統用戶或全域管理員。
   */
  private async getSystemUserId(): Promise<string> {
    // 如果有設定環境變數，直接使用
    if (process.env.SYSTEM_USER_ID) {
      return process.env.SYSTEM_USER_ID;
    }

    // 查找系統用戶
    const systemUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: 'system@internal' }, { name: 'System' }],
      },
      select: { id: true },
    });

    if (systemUser) {
      return systemUser.id;
    }

    // 如果沒有系統用戶，使用第一個全域管理員
    const admin = await this.prisma.user.findFirst({
      where: { isGlobalAdmin: true },
      select: { id: true },
    });

    if (admin) {
      return admin.id;
    }

    // 最後 fallback
    throw new OutlookSubmitError(
      'INTERNAL_ERROR',
      '找不到系統用戶，請設定 SYSTEM_USER_ID 環境變數'
    );
  }

  /**
   * 更新獲取日誌
   *
   * @param id - 獲取日誌 ID
   * @param data - 更新資料
   */
  private async updateFetchLog(
    id: string,
    data: {
      status?: OutlookFetchStatus;
      totalAttachments?: number;
      validAttachments?: number;
      skippedAttachments?: number;
      documentIds?: string[];
      skippedFiles?: Array<{ fileName: string; reason: string }>;
      errorCode?: string;
      errorMessage?: string;
      completedAt?: Date;
    }
  ): Promise<void> {
    // 構建 Prisma 可接受的更新資料
    const updateData: Parameters<typeof this.prisma.outlookFetchLog.update>[0]['data'] = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.totalAttachments !== undefined) updateData.totalAttachments = data.totalAttachments;
    if (data.validAttachments !== undefined) updateData.validAttachments = data.validAttachments;
    if (data.skippedAttachments !== undefined)
      updateData.skippedAttachments = data.skippedAttachments;
    if (data.documentIds !== undefined) updateData.documentIds = data.documentIds;
    if (data.skippedFiles !== undefined) updateData.skippedFiles = data.skippedFiles as object;
    if (data.errorCode !== undefined) updateData.errorCode = data.errorCode;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

    await this.prisma.outlookFetchLog.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 獲取文件擴展名
   *
   * @param fileName - 文件名
   * @returns 擴展名（小寫）
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * 建立錯誤結果
   *
   * @param code - 錯誤代碼
   * @param message - 錯誤訊息
   * @param fetchLogId - 獲取日誌 ID（可選）
   * @returns 提交結果
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
      error: { code, message },
    };
  }
}
