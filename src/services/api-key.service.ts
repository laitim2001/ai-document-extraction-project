/**
 * @fileoverview API Key 管理服務
 * @description
 *   提供外部 API Key 的完整生命週期管理，包括：
 *   - 創建 API Key（SHA-256 雜湊存儲）
 *   - 查詢、更新、刪除（軟刪除）
 *   - 驗證和啟用/停用
 *   - 輪替功能
 *
 * @module src/services/api-key.service
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @features
 *   - SHA-256 API Key 雜湊存儲
 *   - CRUD 操作
 *   - 軟刪除支援
 *   - Key 輪替功能
 *   - 分頁查詢
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - crypto - 雜湊和隨機數生成
 *
 * @related
 *   - src/middleware/external-api-auth.ts - API 認證中間件
 *   - src/types/external-api/auth.ts - 認證類型定義
 *   - src/lib/constants/api-auth.ts - 認證常數
 */

import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';
import {
  API_KEY_PREFIX,
  API_KEY_RANDOM_LENGTH,
  API_KEY_PREFIX_DISPLAY_LENGTH,
  DEFAULT_RATE_LIMIT,
} from '@/lib/constants/api-auth';
import type {
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyResponse,
  CreateApiKeyResponse,
} from '@/types/external-api/auth';
import { Prisma } from '@prisma/client';

// ============================================================
// 類型定義
// ============================================================

/**
 * API Key 列表查詢參數
 */
export interface ApiKeyListParams {
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  limit?: number;
  /** 搜尋關鍵字 */
  search?: string;
  /** 啟用狀態篩選 */
  isActive?: boolean;
  /** 排序欄位 */
  sortBy?: 'name' | 'createdAt' | 'lastUsedAt' | 'usageCount';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分頁結果
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================
// 服務類別
// ============================================================

/**
 * API Key 管理服務
 *
 * @description
 * 使用 Singleton 模式，提供 API Key 的完整生命週期管理。
 * 所有 API Key 以 SHA-256 雜湊形式存儲，原始 Key 僅在創建時返回一次。
 *
 * @example
 * ```typescript
 * // 創建 API Key
 * const result = await apiKeyService.create({
 *   name: 'External System',
 *   allowedCities: ['HKG', 'SGP'],
 *   allowedOperations: ['submit', 'query'],
 * }, 'user-123');
 * console.log(result.rawKey); // 僅此次可見
 *
 * // 列出所有 API Keys
 * const keys = await apiKeyService.list({ page: 1, limit: 20 });
 * ```
 */
export class ApiKeyService {
  private static instance: ApiKeyService;

  /**
   * 獲取服務單例
   */
  static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * 私有建構函數
   */
  private constructor() {}

  // ============================================================
  // 創建操作
  // ============================================================

  /**
   * 創建新的 API Key
   *
   * @description
   * 1. 生成隨機 Key（格式：inv_<32 hex chars>）
   * 2. 計算 SHA-256 雜湊存儲
   * 3. 返回原始 Key（僅此次可見）
   *
   * @param request 創建請求
   * @param createdById 創建者用戶 ID
   * @returns 創建結果，包含原始 Key
   */
  async create(
    request: CreateApiKeyRequest,
    createdById: string
  ): Promise<CreateApiKeyResponse> {
    // 1. 生成隨機 Key
    const rawKey = this.generateApiKey();
    const keyHash = this.hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, API_KEY_PREFIX_DISPLAY_LENGTH);

    // 2. 創建資料庫記錄
    const apiKey = await prisma.externalApiKey.create({
      data: {
        name: request.name,
        description: request.description,
        keyHash,
        keyPrefix,
        createdById,
        allowedCities: request.allowedCities,
        allowedOperations: request.allowedOperations,
        rateLimit: request.rateLimit ?? DEFAULT_RATE_LIMIT,
        expiresAt: request.expiresAt,
        allowedIps: request.allowedIps ?? [],
        blockedIps: request.blockedIps ?? [],
        webhookSecret: request.webhookSecret,
        isActive: true,
      },
    });

    return {
      apiKey: this.toApiKeyResponse(apiKey),
      rawKey,
      message: 'API Key created successfully. Please save this key securely - it will not be shown again.',
    };
  }

  // ============================================================
  // 讀取操作
  // ============================================================

  /**
   * 獲取單個 API Key
   *
   * @param id API Key ID
   * @returns API Key 響應（不含敏感資訊）
   */
  async getById(id: string): Promise<ApiKeyResponse | null> {
    const apiKey = await prisma.externalApiKey.findUnique({
      where: { id, deletedAt: null },
    });

    if (!apiKey) {
      return null;
    }

    return this.toApiKeyResponse(apiKey);
  }

  /**
   * 列出所有 API Keys（支援分頁、搜尋、排序）
   *
   * @param params 查詢參數
   * @returns 分頁結果
   */
  async list(params: ApiKeyListParams = {}): Promise<PaginatedResult<ApiKeyResponse>> {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    // 構建查詢條件
    const where: Prisma.ExternalApiKeyWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { keyPrefix: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    // 執行查詢
    const [apiKeys, total] = await Promise.all([
      prisma.externalApiKey.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.externalApiKey.count({ where }),
    ]);

    return {
      data: apiKeys.map((key) => this.toApiKeyResponse(key)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================
  // 更新操作
  // ============================================================

  /**
   * 更新 API Key
   *
   * @param id API Key ID
   * @param request 更新請求
   * @returns 更新後的 API Key
   */
  async update(
    id: string,
    request: UpdateApiKeyRequest
  ): Promise<ApiKeyResponse | null> {
    // 檢查是否存在
    const existing = await prisma.externalApiKey.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    // 構建更新資料
    const updateData: Prisma.ExternalApiKeyUpdateInput = {};

    if (request.name !== undefined) updateData.name = request.name;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.allowedCities !== undefined) updateData.allowedCities = request.allowedCities;
    if (request.allowedOperations !== undefined) updateData.allowedOperations = request.allowedOperations;
    if (request.rateLimit !== undefined) updateData.rateLimit = request.rateLimit;
    if (request.expiresAt !== undefined) updateData.expiresAt = request.expiresAt;
    if (request.isActive !== undefined) updateData.isActive = request.isActive;
    if (request.allowedIps !== undefined) updateData.allowedIps = request.allowedIps;
    if (request.blockedIps !== undefined) updateData.blockedIps = request.blockedIps;
    if (request.webhookSecret !== undefined) updateData.webhookSecret = request.webhookSecret;

    const updated = await prisma.externalApiKey.update({
      where: { id },
      data: updateData,
    });

    return this.toApiKeyResponse(updated);
  }

  /**
   * 啟用 API Key
   *
   * @param id API Key ID
   */
  async activate(id: string): Promise<ApiKeyResponse | null> {
    return this.update(id, { isActive: true });
  }

  /**
   * 停用 API Key
   *
   * @param id API Key ID
   */
  async deactivate(id: string): Promise<ApiKeyResponse | null> {
    return this.update(id, { isActive: false });
  }

  // ============================================================
  // 刪除操作
  // ============================================================

  /**
   * 刪除 API Key（軟刪除）
   *
   * @param id API Key ID
   * @returns 是否刪除成功
   */
  async delete(id: string): Promise<boolean> {
    const existing = await prisma.externalApiKey.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return false;
    }

    await prisma.externalApiKey.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return true;
  }

  /**
   * 永久刪除 API Key（硬刪除）
   * @warning 此操作不可逆，僅供管理員使用
   *
   * @param id API Key ID
   * @returns 是否刪除成功
   */
  async hardDelete(id: string): Promise<boolean> {
    try {
      await prisma.externalApiKey.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // 輪替操作
  // ============================================================

  /**
   * 輪替 API Key
   *
   * @description
   * 生成新的 Key，停用舊 Key。
   * 返回新 Key，舊 Key 保留但標記為已輪替。
   *
   * @param id 原始 API Key ID
   * @returns 新的 API Key 響應
   */
  async rotate(id: string): Promise<CreateApiKeyResponse | null> {
    const existing = await prisma.externalApiKey.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    // 使用事務確保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 停用舊 Key
      await tx.externalApiKey.update({
        where: { id },
        data: {
          isActive: false,
          description: `[ROTATED] ${existing.description || ''} - Rotated on ${new Date().toISOString()}`,
        },
      });

      // 2. 創建新 Key
      const rawKey = this.generateApiKey();
      const keyHash = this.hashApiKey(rawKey);
      const keyPrefix = rawKey.substring(0, API_KEY_PREFIX_DISPLAY_LENGTH);

      const newApiKey = await tx.externalApiKey.create({
        data: {
          name: existing.name,
          description: existing.description,
          keyHash,
          keyPrefix,
          createdById: existing.createdById,
          organizationId: existing.organizationId,
          allowedCities: existing.allowedCities as string[],
          allowedOperations: existing.allowedOperations as string[],
          rateLimit: existing.rateLimit,
          expiresAt: existing.expiresAt,
          allowedIps: existing.allowedIps ?? [],
          blockedIps: existing.blockedIps ?? [],
          webhookSecret: existing.webhookSecret,
          isActive: true,
        },
      });

      return { newApiKey, rawKey };
    });

    return {
      apiKey: this.toApiKeyResponse(result.newApiKey),
      rawKey: result.rawKey,
      message: 'API Key rotated successfully. The old key has been deactivated. Please save this new key securely - it will not be shown again.',
    };
  }

  // ============================================================
  // 統計和查詢
  // ============================================================

  /**
   * 獲取 API Key 使用統計
   *
   * @param id API Key ID
   */
  async getUsageStats(id: string): Promise<{
    totalUsage: bigint;
    monthlyUsage: number;
    lastUsedAt: Date | null;
    isActive: boolean;
  } | null> {
    const apiKey = await prisma.externalApiKey.findUnique({
      where: { id, deletedAt: null },
      select: {
        usageCount: true,
        monthlyUsage: true,
        lastUsedAt: true,
        isActive: true,
      },
    });

    if (!apiKey) {
      return null;
    }

    return {
      totalUsage: apiKey.usageCount,
      monthlyUsage: apiKey.monthlyUsage,
      lastUsedAt: apiKey.lastUsedAt,
      isActive: apiKey.isActive,
    };
  }

  /**
   * 重置月度使用量（定時任務使用）
   */
  async resetMonthlyUsage(): Promise<number> {
    const result = await prisma.externalApiKey.updateMany({
      where: {
        deletedAt: null,
        monthlyUsage: { gt: 0 },
      },
      data: {
        monthlyUsage: 0,
        monthlyReset: new Date(),
      },
    });

    return result.count;
  }

  // ============================================================
  // 私有輔助方法
  // ============================================================

  /**
   * 生成 API Key
   * @returns 格式：inv_<32 hex chars>
   */
  private generateApiKey(): string {
    const randomPart = randomBytes(API_KEY_RANDOM_LENGTH).toString('hex');
    return `${API_KEY_PREFIX}_${randomPart}`;
  }

  /**
   * 計算 API Key 的 SHA-256 雜湊
   * @param rawKey 原始 API Key
   * @returns 64 字元的十六進位雜湊
   */
  private hashApiKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * 轉換為 API Key 響應格式
   */
  private toApiKeyResponse(apiKey: {
    id: string;
    name: string;
    description: string | null;
    keyPrefix: string;
    allowedCities: Prisma.JsonValue;
    allowedOperations: Prisma.JsonValue;
    rateLimit: number;
    isActive: boolean;
    expiresAt: Date | null;
    allowedIps: Prisma.JsonValue;
    blockedIps: Prisma.JsonValue;
    lastUsedAt: Date | null;
    usageCount: bigint;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  }): ApiKeyResponse {
    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description,
      keyPrefix: apiKey.keyPrefix,
      allowedCities: apiKey.allowedCities as string[],
      allowedOperations: apiKey.allowedOperations as string[],
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      allowedIps: (apiKey.allowedIps as string[]) ?? [],
      blockedIps: (apiKey.blockedIps as string[]) ?? [],
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      createdById: apiKey.createdById,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  /**
   * 重置服務實例（僅用於測試）
   * @internal
   */
  static resetInstance(): void {
    // @ts-expect-error - 用於測試重置
    ApiKeyService.instance = undefined;
  }
}

// ============================================================
// 單例導出
// ============================================================

/**
 * API Key 服務單例
 *
 * @example
 * ```typescript
 * import { apiKeyService } from '@/services/api-key.service';
 *
 * // 創建 API Key
 * const result = await apiKeyService.create({
 *   name: 'My API Key',
 *   allowedCities: ['HKG'],
 *   allowedOperations: ['submit'],
 * }, userId);
 * ```
 */
export const apiKeyService = ApiKeyService.getInstance();
