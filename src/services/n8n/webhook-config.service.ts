/**
 * @fileoverview Webhook 配置服務 - 管理 n8n Webhook 連接配置
 * @description
 *   本模組負責 Webhook 配置的完整生命週期管理，包含：
 *   - 配置的 CRUD 操作
 *   - 認證令牌加密存儲（AES-256-GCM）
 *   - 連接測試功能
 *   - 配置變更歷史記錄
 *   - 城市級別隔離
 *
 *   ## 安全設計
 *   - 認證令牌使用 AES-256-GCM 加密存儲
 *   - 解密只在實際使用時進行
 *   - 配置變更完整審計追蹤
 *
 *   ## 重試策略
 *   - 預設最大重試次數：3
 *   - 預設重試間隔：1秒、5秒、30秒
 *
 * @module src/services/n8n/webhook-config.service
 * @author Development Team
 * @since Epic 10 - Story 10.2
 * @lastModified 2025-12-20
 *
 * @features
 *   - Webhook 配置 CRUD
 *   - 認證令牌加密存儲
 *   - 連接測試
 *   - 配置變更歷史
 *   - 城市級別隔離
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/encryption - 加密工具
 *
 * @related
 *   - src/types/n8n.ts - n8n 類型定義
 *   - prisma/schema.prisma - WebhookConfig 模型
 */

import { prisma } from '@/lib/prisma';
import { encrypt, decrypt, maskToken } from '@/lib/encryption';
import {
  DEFAULT_RETRY_STRATEGY,
  type CreateWebhookConfigInput,
  type UpdateWebhookConfigInput,
  type WebhookConfigDto,
  type WebhookConfigListItem,
  type ListWebhookConfigsOptions,
  type ListWebhookConfigsResult,
  type TestConnectionResult,
  type TestConnectionRequest,
  type WebhookConfigHistoryDto,
  type ListConfigHistoryOptions,
  type ListConfigHistoryResult,
  type RetryStrategy,
  type ConfigChangeType,
  type WebhookTestResult as WebhookTestResultType,
  type N8nEventType,
} from '@/types/n8n';
import { Prisma, type WebhookTestResult, type ConfigChangeType as PrismaConfigChangeType } from '@prisma/client';

// ============================================================
// Types
// ============================================================

/**
 * Webhook 配置與關聯的 Prisma 查詢結果類型
 */
type WebhookConfigWithRelations = Prisma.WebhookConfigGetPayload<{
  include: {
    city: true;
    createdByUser: { select: { id: true; name: true } };
    updatedByUser: { select: { id: true; name: true } };
  };
}>;

/**
 * 配置歷史與關聯的 Prisma 查詢結果類型
 */
type ConfigHistoryWithRelations = Prisma.WebhookConfigHistoryGetPayload<{
  include: {
    changedByUser: { select: { id: true; name: true } };
  };
}>;

/**
 * 創建歷史記錄的輸入
 */
interface CreateHistoryInput {
  configId: string;
  changeType: PrismaConfigChangeType;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields: string[];
  changedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================
// Constants
// ============================================================

/** 預設頁面大小 */
const DEFAULT_PAGE_SIZE = 20;

/** 預設超時時間（毫秒） */
const DEFAULT_TIMEOUT_MS = 30000;

/** 連接測試端點路徑 */
const TEST_ENDPOINT_PATH = '/health';

// ============================================================
// Service Class
// ============================================================

/**
 * @class WebhookConfigService
 * @description Webhook 配置管理服務
 */
export class WebhookConfigService {
  // ============================================================
  // Public Methods - CRUD Operations
  // ============================================================

  /**
   * 創建 Webhook 配置
   *
   * @description
   *   建立新的 Webhook 配置，包含：
   *   1. 驗證輸入資料
   *   2. 加密認證令牌
   *   3. 創建配置記錄
   *   4. 記錄變更歷史
   *
   * @param input - 創建配置的輸入參數
   * @param userId - 創建者用戶 ID
   * @param ipAddress - 請求 IP 地址
   * @param userAgent - 請求 User-Agent
   * @returns 創建的配置 DTO
   */
  async create(
    input: CreateWebhookConfigInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WebhookConfigDto> {
    // 加密認證令牌
    const encryptResult = encrypt(input.authToken);
    if (!encryptResult.success) {
      throw new Error('Failed to encrypt auth token');
    }

    // 準備重試策略
    const retryStrategy = input.retryStrategy ?? DEFAULT_RETRY_STRATEGY;

    // 創建配置
    const config = await prisma.webhookConfig.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        baseUrl: input.baseUrl,
        endpointPath: input.endpointPath,
        authToken: encryptResult.encrypted,
        cityCode: input.cityCode ?? null,
        retryStrategy: retryStrategy as unknown as Prisma.InputJsonValue,
        timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        subscribedEvents: (input.subscribedEvents ?? []) as string[],
        isActive: true,
        createdBy: userId,
      },
      include: {
        city: true,
        createdByUser: { select: { id: true, name: true } },
        updatedByUser: { select: { id: true, name: true } },
      },
    });

    // 記錄創建歷史
    await this.createHistory({
      configId: config.id,
      changeType: 'CREATED',
      previousValue: null,
      newValue: this.configToHistoryValue(config),
      changedFields: ['name', 'baseUrl', 'endpointPath', 'authToken', 'retryStrategy', 'timeoutMs'],
      changedBy: userId,
      ipAddress,
      userAgent,
    });

    return this.toDto(config);
  }

  /**
   * 獲取配置列表
   *
   * @param options - 列表選項
   * @returns 配置列表結果
   */
  async list(options: ListWebhookConfigsOptions = {}): Promise<ListWebhookConfigsResult> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    // 構建 where 條件
    const where: Prisma.WebhookConfigWhereInput = {};

    if (options.cityCode !== undefined) {
      where.cityCode = options.cityCode;
    }

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    // 構建排序
    const orderBy: Prisma.WebhookConfigOrderByWithRelationInput = {};
    const orderField = options.orderBy ?? 'createdAt';
    const orderDirection = options.order ?? 'desc';
    orderBy[orderField] = orderDirection;

    // 查詢資料
    const [items, total] = await Promise.all([
      prisma.webhookConfig.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          city: true,
        },
      }),
      prisma.webhookConfig.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toListItem(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 獲取單一配置詳情
   *
   * @param id - 配置 ID
   * @returns 配置 DTO 或 null
   */
  async getById(id: string): Promise<WebhookConfigDto | null> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id },
      include: {
        city: true,
        createdByUser: { select: { id: true, name: true } },
        updatedByUser: { select: { id: true, name: true } },
      },
    });

    if (!config) {
      return null;
    }

    return this.toDto(config);
  }

  /**
   * 更新配置
   *
   * @param id - 配置 ID
   * @param input - 更新輸入
   * @param userId - 更新者用戶 ID
   * @param ipAddress - 請求 IP 地址
   * @param userAgent - 請求 User-Agent
   * @returns 更新後的配置 DTO
   */
  async update(
    id: string,
    input: UpdateWebhookConfigInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WebhookConfigDto> {
    // 獲取現有配置
    const existing = await prisma.webhookConfig.findUnique({
      where: { id },
      include: {
        city: true,
        createdByUser: { select: { id: true, name: true } },
        updatedByUser: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      throw new Error('Webhook config not found');
    }

    // 準備更新資料
    const updateData: Prisma.WebhookConfigUpdateInput = {
      updatedByUser: { connect: { id: userId } },
    };

    const changedFields: string[] = [];
    const previousValue = this.configToHistoryValue(existing);

    // 檢查每個可更新欄位
    if (input.name !== undefined && input.name !== existing.name) {
      updateData.name = input.name;
      changedFields.push('name');
    }

    if (input.description !== undefined && input.description !== existing.description) {
      updateData.description = input.description;
      changedFields.push('description');
    }

    if (input.baseUrl !== undefined && input.baseUrl !== existing.baseUrl) {
      updateData.baseUrl = input.baseUrl;
      changedFields.push('baseUrl');
    }

    if (input.endpointPath !== undefined && input.endpointPath !== existing.endpointPath) {
      updateData.endpointPath = input.endpointPath;
      changedFields.push('endpointPath');
    }

    if (input.authToken !== undefined) {
      const encryptResult = encrypt(input.authToken);
      if (!encryptResult.success) {
        throw new Error('Failed to encrypt auth token');
      }
      updateData.authToken = encryptResult.encrypted;
      changedFields.push('authToken');
    }

    if (input.cityCode !== undefined) {
      if (input.cityCode === null) {
        updateData.city = { disconnect: true };
      } else {
        updateData.city = { connect: { code: input.cityCode } };
      }
      changedFields.push('cityCode');
    }

    if (input.retryStrategy !== undefined) {
      updateData.retryStrategy = input.retryStrategy as unknown as Prisma.InputJsonValue;
      changedFields.push('retryStrategy');
    }

    if (input.timeoutMs !== undefined && input.timeoutMs !== existing.timeoutMs) {
      updateData.timeoutMs = input.timeoutMs;
      changedFields.push('timeoutMs');
    }

    if (input.subscribedEvents !== undefined) {
      updateData.subscribedEvents = input.subscribedEvents as string[];
      changedFields.push('subscribedEvents');
    }

    // 處理啟用/停用狀態變更
    let changeType: PrismaConfigChangeType = 'UPDATED';
    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      updateData.isActive = input.isActive;
      changedFields.push('isActive');
      changeType = input.isActive ? 'ACTIVATED' : 'DEACTIVATED';
    }

    // 如果沒有任何變更，直接返回
    if (changedFields.length === 0) {
      return this.toDto(existing);
    }

    // 執行更新
    const updated = await prisma.webhookConfig.update({
      where: { id },
      data: updateData,
      include: {
        city: true,
        createdByUser: { select: { id: true, name: true } },
        updatedByUser: { select: { id: true, name: true } },
      },
    });

    // 記錄變更歷史
    await this.createHistory({
      configId: id,
      changeType,
      previousValue,
      newValue: this.configToHistoryValue(updated),
      changedFields,
      changedBy: userId,
      ipAddress,
      userAgent,
    });

    return this.toDto(updated);
  }

  /**
   * 刪除配置
   *
   * @param id - 配置 ID
   * @param userId - 刪除者用戶 ID
   * @param ipAddress - 請求 IP 地址
   * @param userAgent - 請求 User-Agent
   */
  async delete(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // 獲取現有配置用於記錄歷史
    const existing = await prisma.webhookConfig.findUnique({
      where: { id },
      include: {
        city: true,
        createdByUser: { select: { id: true, name: true } },
        updatedByUser: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      throw new Error('Webhook config not found');
    }

    // 記錄刪除歷史
    await this.createHistory({
      configId: id,
      changeType: 'DELETED',
      previousValue: this.configToHistoryValue(existing),
      newValue: null,
      changedFields: [],
      changedBy: userId,
      ipAddress,
      userAgent,
    });

    // 執行刪除
    await prisma.webhookConfig.delete({
      where: { id },
    });
  }

  // ============================================================
  // Public Methods - Connection Test
  // ============================================================

  /**
   * 測試 Webhook 連接
   *
   * @description
   *   測試與 n8n 服務器的連接，可以使用：
   *   1. 現有配置 ID
   *   2. 臨時配置參數
   *
   * @param request - 測試請求
   * @returns 測試結果
   */
  async testConnection(request: TestConnectionRequest): Promise<TestConnectionResult> {
    const startTime = Date.now();
    let baseUrl: string;
    let authToken: string;
    let timeoutMs: number = DEFAULT_TIMEOUT_MS;

    // 決定使用現有配置還是臨時配置
    if (request.configId) {
      const config = await prisma.webhookConfig.findUnique({
        where: { id: request.configId },
      });

      if (!config) {
        return {
          success: false,
          result: 'ERROR',
          message: 'Configuration not found',
          error: 'CONFIG_NOT_FOUND',
          testedAt: new Date(),
        };
      }

      baseUrl = config.baseUrl;
      timeoutMs = config.timeoutMs;

      // 解密認證令牌
      const decryptResult = decrypt(config.authToken);
      if (!decryptResult.success) {
        return {
          success: false,
          result: 'ERROR',
          message: 'Failed to decrypt auth token',
          error: 'DECRYPTION_FAILED',
          testedAt: new Date(),
        };
      }
      authToken = decryptResult.decrypted;
    } else if (request.baseUrl && request.authToken) {
      baseUrl = request.baseUrl;
      authToken = request.authToken;
      timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    } else {
      return {
        success: false,
        result: 'ERROR',
        message: 'Either configId or baseUrl and authToken are required',
        error: 'INVALID_REQUEST',
        testedAt: new Date(),
      };
    }

    // 構建測試 URL
    const testUrl = `${baseUrl.replace(/\/$/, '')}${TEST_ENDPOINT_PATH}`;

    try {
      // 執行連接測試
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'X-Test-Connection': 'true',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const success = response.ok;
      const result: WebhookTestResultType = success ? 'SUCCESS' : 'FAILED';

      // 如果有 configId，更新測試結果
      if (request.configId) {
        await prisma.webhookConfig.update({
          where: { id: request.configId },
          data: {
            lastTestAt: new Date(),
            lastTestResult: result as WebhookTestResult,
            lastTestError: success ? null : `HTTP ${response.status}`,
          },
        });
      }

      return {
        success,
        result,
        responseTime,
        statusCode: response.status,
        message: success ? 'Connection successful' : `HTTP ${response.status} ${response.statusText}`,
        testedAt: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let result: WebhookTestResultType = 'ERROR';
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          result = 'TIMEOUT';
          errorMessage = `Connection timeout after ${timeoutMs}ms`;
        } else {
          errorMessage = error.message;
        }
      }

      // 如果有 configId，更新測試結果
      if (request.configId) {
        await prisma.webhookConfig.update({
          where: { id: request.configId },
          data: {
            lastTestAt: new Date(),
            lastTestResult: result as WebhookTestResult,
            lastTestError: errorMessage,
          },
        });
      }

      return {
        success: false,
        result,
        responseTime,
        message: errorMessage,
        error: errorMessage,
        testedAt: new Date(),
      };
    }
  }

  // ============================================================
  // Public Methods - History
  // ============================================================

  /**
   * 獲取配置變更歷史
   *
   * @param options - 歷史列表選項
   * @returns 歷史列表結果
   */
  async getHistory(options: ListConfigHistoryOptions): Promise<ListConfigHistoryResult> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    // 構建 where 條件
    const where: Prisma.WebhookConfigHistoryWhereInput = {
      configId: options.configId,
    };

    if (options.changeType) {
      where.changeType = options.changeType as PrismaConfigChangeType;
    }

    // 查詢資料
    const [items, total] = await Promise.all([
      prisma.webhookConfigHistory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { changedAt: 'desc' },
        include: {
          changedByUser: { select: { id: true, name: true } },
        },
      }),
      prisma.webhookConfigHistory.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toHistoryDto(item)),
      total,
      page,
      pageSize,
    };
  }

  // ============================================================
  // Public Methods - Utility
  // ============================================================

  /**
   * 獲取解密後的認證令牌
   *
   * @description
   *   僅用於實際發送 Webhook 時。
   *   注意：此方法返回敏感資料，請謹慎使用。
   *
   * @param configId - 配置 ID
   * @returns 解密後的認證令牌或 null
   */
  async getDecryptedToken(configId: string): Promise<string | null> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id: configId },
      select: { authToken: true },
    });

    if (!config) {
      return null;
    }

    const decryptResult = decrypt(config.authToken);
    return decryptResult.success ? decryptResult.decrypted : null;
  }

  /**
   * 獲取城市的活躍配置列表
   *
   * @param cityCode - 城市代碼（null 表示全域配置）
   * @returns 活躍配置列表
   */
  async getActiveConfigs(cityCode: string | null): Promise<WebhookConfigListItem[]> {
    const configs = await prisma.webhookConfig.findMany({
      where: {
        isActive: true,
        OR: [
          { cityCode: cityCode },
          { cityCode: null }, // 全域配置也包含
        ],
      },
      include: {
        city: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((item) => this.toListItem(item));
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 轉換為 DTO
   */
  private toDto(config: WebhookConfigWithRelations): WebhookConfigDto {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      baseUrl: config.baseUrl,
      endpointPath: config.endpointPath,
      cityCode: config.cityCode,
      cityName: config.city?.name ?? null,
      retryStrategy: config.retryStrategy as unknown as RetryStrategy,
      timeoutMs: config.timeoutMs,
      subscribedEvents: config.subscribedEvents as N8nEventType[],
      isActive: config.isActive,
      lastTestAt: config.lastTestAt,
      lastTestResult: config.lastTestResult as WebhookTestResultType | null,
      lastTestError: config.lastTestError,
      createdBy: config.createdBy,
      createdByName: config.createdByUser?.name ?? null,
      createdAt: config.createdAt,
      updatedBy: config.updatedBy,
      updatedByName: config.updatedByUser?.name ?? null,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 轉換為列表項目
   */
  private toListItem(
    config: Prisma.WebhookConfigGetPayload<{ include: { city: true } }>
  ): WebhookConfigListItem {
    return {
      id: config.id,
      name: config.name,
      baseUrl: config.baseUrl,
      endpointPath: config.endpointPath,
      cityCode: config.cityCode,
      cityName: config.city?.name ?? null,
      isActive: config.isActive,
      lastTestAt: config.lastTestAt,
      lastTestResult: config.lastTestResult as WebhookTestResultType | null,
      createdAt: config.createdAt,
    };
  }

  /**
   * 轉換為歷史 DTO
   */
  private toHistoryDto(history: ConfigHistoryWithRelations): WebhookConfigHistoryDto {
    return {
      id: history.id,
      configId: history.configId,
      changeType: history.changeType as ConfigChangeType,
      previousValue: history.previousValue as Record<string, unknown> | null,
      newValue: history.newValue as Record<string, unknown> | null,
      changedFields: history.changedFields,
      changedBy: history.changedBy,
      changedByName: history.changedByUser?.name ?? null,
      changedAt: history.changedAt,
      ipAddress: history.ipAddress,
      userAgent: history.userAgent,
    };
  }

  /**
   * 創建歷史記錄
   */
  private async createHistory(input: CreateHistoryInput): Promise<void> {
    await prisma.webhookConfigHistory.create({
      data: {
        configId: input.configId,
        changeType: input.changeType,
        previousValue: input.previousValue as Prisma.InputJsonValue ?? Prisma.DbNull,
        newValue: input.newValue as Prisma.InputJsonValue ?? Prisma.DbNull,
        changedFields: input.changedFields,
        changedBy: input.changedBy,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * 將配置轉換為歷史記錄值
   * 注意：不包含敏感的認證令牌
   */
  private configToHistoryValue(config: WebhookConfigWithRelations): Record<string, unknown> {
    return {
      name: config.name,
      description: config.description,
      baseUrl: config.baseUrl,
      endpointPath: config.endpointPath,
      cityCode: config.cityCode,
      retryStrategy: config.retryStrategy,
      timeoutMs: config.timeoutMs,
      subscribedEvents: config.subscribedEvents,
      isActive: config.isActive,
      // 認證令牌只記錄遮蔽版本
      authTokenMasked: maskToken(config.authToken, 4),
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * Webhook 配置服務單例
 */
export const webhookConfigService = new WebhookConfigService();
