/**
 * @fileoverview SharePoint 文件提交服務
 * @description
 *   處理從 SharePoint 提交文件的完整流程，包含：
 *   - 文件資訊獲取
 *   - 文件下載
 *   - Azure Blob 儲存
 *   - 文件記錄建立
 *   - 處理隊列建立
 *
 *   ## 處理流程
 *   1. 驗證請求和城市權限
 *   2. 建立獲取日誌
 *   3. 從 SharePoint 獲取文件資訊
 *   4. 驗證文件類型和大小
 *   5. 檢查重複文件
 *   6. 下載文件內容
 *   7. 上傳到 Azure Blob Storage
 *   8. 建立 Document 記錄
 *   9. 建立 ProcessingQueue 記錄
 *   10. 更新獲取日誌狀態
 *
 * @module src/services/sharepoint-document.service
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - SharePoint 文件提交
 *   - 批次文件提交
 *   - 重複文件檢測
 *   - 完整錯誤處理和日誌
 *
 * @dependencies
 *   - src/services/microsoft-graph.service.ts - Graph API 整合
 *   - src/services/encryption.service.ts - 密鑰解密
 *   - src/lib/azure/storage.ts - Azure Blob 操作
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/app/api/documents/from-sharepoint/route.ts - API 端點
 *   - src/types/sharepoint.ts - 類型定義
 */

import { createHash } from 'crypto';
import type { PrismaClient, SharePointFetchStatus } from '@prisma/client';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { EncryptionService } from './encryption.service';
import { uploadFile } from '@/lib/azure/storage';
import type {
  SharePointSubmitRequest,
  SharePointSubmitResult,
  SharePointBatchSubmitResult,
  SharePointFileInfo,
  SharePointSourceMetadata,
  RequestContext,
  SharePointErrorCode,
} from '@/types/sharepoint';
import { ALLOWED_MIME_TYPE_SET, MAX_FILE_SIZE } from '@/types/sharepoint';

// ============================================================
// Error Class
// ============================================================

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

// ============================================================
// Service
// ============================================================

/**
 * SharePoint 文件服務
 *
 * @description
 *   處理 SharePoint 文件的提交、下載、儲存流程。
 *   為 n8n 等外部系統提供自動化文件獲取功能。
 *
 * @example
 *   const service = new SharePointDocumentService(prisma, encryptionService);
 *   const result = await service.submitDocument(
 *     { sharepointUrl: '...', cityCode: 'TPE' },
 *     { ip: '127.0.0.1', apiKeyId: 'key-1' }
 *   );
 */
export class SharePointDocumentService {
  constructor(
    private prisma: PrismaClient,
    private encryptionService: EncryptionService
  ) {}

  /**
   * 提交 SharePoint 文件
   *
   * @description
   *   完整處理 SharePoint 文件提交流程，從獲取文件資訊到建立處理隊列。
   *
   * @param request - 提交請求
   * @param context - 請求上下文
   * @returns 提交結果
   *
   * @example
   *   const result = await service.submitDocument(
   *     {
   *       sharepointUrl: 'https://tenant.sharepoint.com/sites/Site/Doc.pdf',
   *       cityCode: 'TPE'
   *     },
   *     { ip: '127.0.0.1', apiKeyId: 'key-1' }
   *   );
   */
  async submitDocument(
    request: SharePointSubmitRequest,
    context: RequestContext
  ): Promise<SharePointSubmitResult> {
    // 取得城市資訊
    const city = await this.getCityByCode(request.cityCode);

    // 建立獲取日誌
    const fetchLog = await this.prisma.sharePointFetchLog.create({
      data: {
        sharepointUrl: request.sharepointUrl,
        fileName: request.originalFileName || 'unknown',
        cityId: city.id,
        requestIp: context.ip,
        requestUserAgent: context.userAgent,
        apiKeyId: context.apiKeyId,
        status: 'PENDING',
      },
    });

    try {
      // 獲取 SharePoint 配置
      const config = await this.getSharePointConfig(city.id);
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
        clientSecret: this.encryptionService.decrypt(config.clientSecret),
      });

      // 更新狀態為下載中
      await this.updateFetchLog(fetchLog.id, { status: 'DOWNLOADING' });

      // 獲取文件資訊
      const fileInfo = await graphService.getFileInfoFromUrl(request.sharepointUrl);

      // 更新日誌檔名和 Item ID
      await this.updateFetchLog(fetchLog.id, {
        fileName: fileInfo.name,
        sharepointItemId: fileInfo.id,
      });

      // 驗證文件
      this.validateFile(fileInfo);

      // 檢查重複
      if (await this.checkDuplicate(fileInfo)) {
        await this.updateFetchLog(fetchLog.id, {
          status: 'DUPLICATE',
          errorCode: 'DUPLICATE_FILE',
          errorMessage: '文件已存在',
        });
        throw new SharePointSubmitError('DUPLICATE_FILE', '此文件已經提交過');
      }

      // 下載文件
      const fileBuffer = await graphService.downloadFile(fileInfo.downloadUrl);

      // 計算文件雜湊
      const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

      // 上傳到 Azure Blob Storage
      const fileExtension = this.getFileExtension(fileInfo.name);
      const uploadResult = await uploadFile(fileBuffer, fileInfo.name, {
        contentType: fileInfo.mimeType,
        folder: `sharepoint/${request.cityCode}`,
        metadata: {
          sourceType: 'sharepoint',
          sharepointUrl: request.sharepointUrl,
        },
      });

      // 更新狀態為處理中
      await this.updateFetchLog(fetchLog.id, { status: 'PROCESSING' });

      // 建立來源 metadata（轉為 JSON 格式）
      const sourceMetadata = {
        sharepointUrl: request.sharepointUrl,
        webUrl: fileInfo.webUrl,
        driveId: fileInfo.driveId,
        siteId: fileInfo.siteId,
        itemId: fileInfo.id,
        createdDateTime: fileInfo.createdDateTime,
        lastModifiedDateTime: fileInfo.lastModifiedDateTime,
        fetchedAt: new Date().toISOString(),
        fetchLogId: fetchLog.id,
      } satisfies SharePointSourceMetadata;

      // 確保有有效的上傳者 ID
      const uploadedById = await this.getSystemUserId();

      // 建立文件記錄
      const document = await this.prisma.document.create({
        data: {
          fileName: request.originalFileName || fileInfo.name,
          fileType: fileInfo.mimeType,
          fileExtension,
          fileSize: fileInfo.size,
          filePath: uploadResult.blobUrl,
          blobName: uploadResult.blobName,
          fileHash,
          sourceType: 'SHAREPOINT',
          sourceMetadata,
          sharepointItemId: fileInfo.id,
          sharepointDriveId: fileInfo.driveId,
          sharepointSiteId: fileInfo.siteId,
          sharepointUrl: request.sharepointUrl,
          uploadedBy: uploadedById,
          cityCode: request.cityCode,
          status: 'UPLOADED',
        },
      });

      // 建立處理隊列
      const processingQueue = await this.prisma.processingQueue.create({
        data: {
          documentId: document.id,
          cityCode: request.cityCode,
          processingPath: 'AUTO_APPROVE', // 預設路徑，可由後續流程調整
          priority: 0,
          status: 'PENDING',
          routingReason: 'SharePoint 自動獲取',
        },
      });

      // 更新獲取日誌為完成
      await this.updateFetchLog(fetchLog.id, {
        status: 'COMPLETED',
        documentId: document.id,
        fileSize: BigInt(fileInfo.size),
        completedAt: new Date(),
      });

      return {
        success: true,
        documentId: document.id,
        processingQueueId: processingQueue.id,
        fetchLogId: fetchLog.id,
      };
    } catch (error) {
      const errorInfo = this.parseError(error);

      await this.updateFetchLog(fetchLog.id, {
        status: 'FAILED',
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        errorDetails: errorInfo.details,
      });

      return {
        success: false,
        fetchLogId: fetchLog.id,
        error: errorInfo,
      };
    }
  }

  /**
   * 批次提交文件
   *
   * @description
   *   依序處理多個 SharePoint 文件提交請求。
   *
   * @param requests - 提交請求陣列
   * @param context - 請求上下文
   * @returns 批次提交結果
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
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * 驗證文件
   */
  private validateFile(fileInfo: SharePointFileInfo): void {
    // 檢查文件類型
    if (!ALLOWED_MIME_TYPE_SET.has(fileInfo.mimeType)) {
      throw new SharePointSubmitError(
        'INVALID_FILE_TYPE',
        `不支援的文件類型: ${fileInfo.mimeType}`,
        {
          allowedTypes: Array.from(ALLOWED_MIME_TYPE_SET),
          receivedType: fileInfo.mimeType,
        }
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
        sharepointDriveId: fileInfo.driveId,
      },
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
        isActive: true,
      },
    });

    // 如果沒有城市專屬配置，使用全域配置
    if (!config) {
      config = await this.prisma.sharePointConfig.findFirst({
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
   */
  private async getCityByCode(
    cityCode: string
  ): Promise<{ id: string; code: string }> {
    const city = await this.prisma.city.findUnique({
      where: { code: cityCode },
      select: { id: true, code: true },
    });

    if (!city) {
      throw new SharePointSubmitError('CITY_NOT_FOUND', `找不到城市: ${cityCode}`);
    }

    return city;
  }

  /**
   * 獲取系統用戶 ID
   *
   * @description
   *   獲取用於 SharePoint 自動上傳的系統用戶 ID。
   *   如果環境變數未設定，嘗試查找或創建系統用戶。
   */
  private async getSystemUserId(): Promise<string> {
    // 如果有設定環境變數，直接使用
    if (process.env.SYSTEM_USER_ID) {
      return process.env.SYSTEM_USER_ID;
    }

    // 查找系統用戶
    const systemUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: 'system@internal' },
          { name: 'System' },
        ],
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

    // 最後fallback
    throw new SharePointSubmitError(
      'INTERNAL_ERROR',
      '找不到系統用戶，請設定 SYSTEM_USER_ID 環境變數'
    );
  }

  /**
   * 更新獲取日誌
   */
  private async updateFetchLog(
    id: string,
    data: {
      status?: SharePointFetchStatus;
      fileName?: string;
      fileSize?: bigint;
      sharepointItemId?: string;
      documentId?: string;
      errorCode?: string;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      completedAt?: Date;
    }
  ): Promise<void> {
    // 構建 Prisma 可接受的更新資料
    const updateData: Parameters<typeof this.prisma.sharePointFetchLog.update>[0]['data'] = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.fileName !== undefined) updateData.fileName = data.fileName;
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
    if (data.sharepointItemId !== undefined) updateData.sharepointItemId = data.sharepointItemId;
    if (data.errorCode !== undefined) updateData.errorCode = data.errorCode;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.errorDetails !== undefined) updateData.errorDetails = data.errorDetails as object;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

    // documentId 使用 relation connect
    if (data.documentId !== undefined) {
      updateData.document = { connect: { id: data.documentId } };
    }

    await this.prisma.sharePointFetchLog.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 獲取文件擴展名
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
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
        details: error.details,
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
        return {
          code: 'AUTH_ERROR',
          message: '認證失敗，請檢查 SharePoint 配置',
        };
      }

      return { code: 'INTERNAL_ERROR', message: error.message };
    }

    return { code: 'INTERNAL_ERROR', message: '未知錯誤' };
  }
}
