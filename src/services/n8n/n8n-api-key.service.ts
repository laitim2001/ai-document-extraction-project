/**
 * @fileoverview n8n API Key 服務 - 管理 n8n 工作流整合的 API 金鑰
 * @description
 *   本模組負責 n8n 整合的 API Key 完整生命週期管理，包含：
 *   - API Key 生成與 SHA-256 雜湊存儲
 *   - API Key 驗證與權限檢查
 *   - 速率限制（Rate Limiting）控制
 *   - 使用統計追蹤
 *   - API Key 列表、撤銷與刪除
 *
 *   ## 安全設計
 *   - API Key 採用 SHA-256 雜湊存儲，原始 Key 只在建立時返回一次
 *   - 支援細粒度權限控制（documents:read, documents:write, webhook:receive 等）
 *   - 城市級別隔離，確保跨城市數據安全
 *   - 速率限制預設 100 請求/分鐘
 *
 *   ## Key 格式
 *   - 前綴：n8n_
 *   - 長度：32 bytes 隨機數據（64 hex 字符）
 *   - 完整格式：n8n_[64 hex characters]
 *
 * @module src/services/n8n/n8n-api-key.service
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 *
 * @features
 *   - 安全的 API Key 生成與存儲
 *   - SHA-256 雜湊存儲
 *   - 權限驗證
 *   - 速率限制檢查
 *   - 使用統計追蹤
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - crypto - Node.js 加密模組
 *
 * @related
 *   - src/types/n8n.ts - n8n 類型定義
 *   - prisma/schema.prisma - N8nApiKey 模型
 */

import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';
import type {
  CreateApiKeyInput,
  CreateApiKeyResult,
  ValidateApiKeyResult,
  N8nApiKeyInfo,
  N8nPermission,
  ListApiKeysOptions,
  ListApiKeysResult,
} from '@/types/n8n';
import type { Prisma } from '@prisma/client';

// ============================================================
// Types
// ============================================================

/**
 * API Key 與城市關聯的 Prisma 查詢結果類型
 */
type ApiKeyWithCity = Prisma.N8nApiKeyGetPayload<{
  include: { city: true };
}>;

// ============================================================
// Service Class
// ============================================================

/**
 * @class N8nApiKeyService
 * @description n8n API Key 管理服務
 */
export class N8nApiKeyService {
  /** API Key 前綴 */
  private readonly KEY_PREFIX = 'n8n_';

  /** 隨機部分長度（bytes） */
  private readonly KEY_LENGTH = 32;

  // ============================================================
  // Public Methods - CRUD Operations
  // ============================================================

  /**
   * 生成新的 API Key
   *
   * @description
   *   建立新的 API Key，包含：
   *   1. 生成隨機 key
   *   2. SHA-256 雜湊存儲
   *   3. 記錄 key 前綴（用於識別）
   *   4. 返回原始 key（僅此一次）
   *
   * @param input - 建立 API Key 的輸入參數
   * @returns 包含 API Key 資訊和原始 key 的結果
   *
   * @example
   * ```typescript
   * const result = await n8nApiKeyService.createApiKey({
   *   name: 'Production Workflow',
   *   cityCode: 'TW',
   *   permissions: ['documents:write', 'webhook:receive'],
   *   createdBy: 'user-id',
   * });
   * console.log(result.rawKey); // 只有這次能看到原始 key
   * ```
   */
  async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    // 生成隨機 key
    const randomPart = randomBytes(this.KEY_LENGTH).toString('hex');
    const rawKey = `${this.KEY_PREFIX}${randomPart}`;
    const hashedKey = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12); // n8n_xxxxxxxx

    const apiKey = await prisma.n8nApiKey.create({
      data: {
        key: hashedKey,
        keyPrefix,
        name: input.name,
        cityCode: input.cityCode,
        permissions: input.permissions,
        expiresAt: input.expiresAt ?? null,
        rateLimit: input.rateLimit ?? 100,
        createdBy: input.createdBy,
      },
      include: {
        city: true,
      },
    });

    return {
      apiKey: this.toApiKeyInfo(apiKey),
      rawKey, // 只在創建時返回
    };
  }

  /**
   * 驗證 API Key
   *
   * @description
   *   驗證提供的 API Key 是否有效，檢查包含：
   *   1. 格式驗證（必須以 n8n_ 開頭）
   *   2. 雜湊比對
   *   3. 啟用狀態
   *   4. 過期時間
   *   5. 速率限制
   *
   * @param rawKey - 原始 API Key
   * @returns 驗證結果，包含有效性和錯誤資訊
   *
   * @example
   * ```typescript
   * const result = await n8nApiKeyService.validateApiKey(rawKey);
   * if (result.valid) {
   *   console.log('API Key valid for city:', result.apiKey?.cityCode);
   * } else {
   *   console.error('Validation failed:', result.error);
   * }
   * ```
   */
  async validateApiKey(rawKey: string): Promise<ValidateApiKeyResult> {
    // 格式驗證
    if (!rawKey || !rawKey.startsWith(this.KEY_PREFIX)) {
      return { valid: false, error: 'Invalid API key format', errorCode: 'INVALID_KEY' };
    }

    const hashedKey = this.hashKey(rawKey);

    const apiKey = await prisma.n8nApiKey.findUnique({
      where: { key: hashedKey },
      include: { city: true },
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' };
    }

    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is disabled', errorCode: 'DISABLED' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired', errorCode: 'EXPIRED' };
    }

    // 檢查速率限制
    const isRateLimited = await this.checkRateLimit(apiKey.id, apiKey.rateLimit);
    if (isRateLimited) {
      return { valid: false, error: 'Rate limit exceeded', errorCode: 'RATE_LIMITED' };
    }

    // 更新使用統計（異步，不阻塞）
    this.updateUsageStats(apiKey.id).catch((error) => {
      console.error('Failed to update API key usage stats:', error);
    });

    return {
      valid: true,
      apiKey: this.toApiKeyInfo(apiKey),
    };
  }

  /**
   * 檢查權限
   *
   * @description
   *   檢查 API Key 是否擁有指定權限。
   *   支援萬用字元權限 '*'。
   *
   * @param apiKey - API Key 資訊
   * @param requiredPermission - 所需權限
   * @returns 是否擁有該權限
   *
   * @example
   * ```typescript
   * const hasPermission = n8nApiKeyService.hasPermission(
   *   apiKey,
   *   'documents:write'
   * );
   * ```
   */
  hasPermission(apiKey: N8nApiKeyInfo, requiredPermission: N8nPermission): boolean {
    return (
      apiKey.permissions.includes('*') ||
      apiKey.permissions.includes(requiredPermission)
    );
  }

  /**
   * 列出 API Keys
   *
   * @description
   *   取得 API Key 列表，支援城市、啟用狀態篩選及分頁。
   *
   * @param options - 列表選項
   * @returns 分頁的 API Key 列表
   *
   * @example
   * ```typescript
   * const result = await n8nApiKeyService.listApiKeys({
   *   cityCode: 'TW',
   *   isActive: true,
   *   page: 1,
   *   pageSize: 20,
   * });
   * ```
   */
  async listApiKeys(options: ListApiKeysOptions): Promise<ListApiKeysResult> {
    const { cityCode, isActive, page = 1, pageSize = 20 } = options;

    const where: Prisma.N8nApiKeyWhereInput = {};
    if (cityCode) where.cityCode = cityCode;
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await Promise.all([
      prisma.n8nApiKey.findMany({
        where,
        include: { city: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.n8nApiKey.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toApiKeyInfo(item)),
      total,
    };
  }

  /**
   * 撤銷 API Key
   *
   * @description
   *   停用 API Key，使其無法再用於認證。
   *   不會刪除記錄，保留審計軌跡。
   *
   * @param id - API Key ID
   * @param _revokedBy - 撤銷者 ID（用於審計）
   *
   * @example
   * ```typescript
   * await n8nApiKeyService.revokeApiKey(apiKeyId, userId);
   * ```
   */
  async revokeApiKey(id: string, _revokedBy: string): Promise<void> {
    await prisma.n8nApiKey.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 刪除 API Key
   *
   * @description
   *   永久刪除 API Key 記錄。
   *   警告：此操作不可逆，建議優先使用 revokeApiKey。
   *
   * @param id - API Key ID
   *
   * @example
   * ```typescript
   * await n8nApiKeyService.deleteApiKey(apiKeyId);
   * ```
   */
  async deleteApiKey(id: string): Promise<void> {
    await prisma.n8nApiKey.delete({
      where: { id },
    });
  }

  /**
   * 根據 ID 取得 API Key
   *
   * @param id - API Key ID
   * @returns API Key 資訊或 null
   */
  async getApiKeyById(id: string): Promise<N8nApiKeyInfo | null> {
    const apiKey = await prisma.n8nApiKey.findUnique({
      where: { id },
      include: { city: true },
    });

    return apiKey ? this.toApiKeyInfo(apiKey) : null;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 檢查速率限制
   *
   * @description
   *   檢查 API Key 在過去一分鐘內的調用次數是否超過限制。
   *
   * @param apiKeyId - API Key ID
   * @param limit - 速率限制（請求/分鐘）
   * @returns 是否已達到速率限制
   */
  private async checkRateLimit(apiKeyId: string, limit: number): Promise<boolean> {
    const windowStart = new Date(Date.now() - 60000); // 1 分鐘窗口

    const count = await prisma.n8nApiCall.count({
      where: {
        apiKeyId,
        timestamp: { gte: windowStart },
      },
    });

    return count >= limit;
  }

  /**
   * 更新使用統計
   *
   * @description
   *   更新 API Key 的最後使用時間和使用次數。
   *
   * @param apiKeyId - API Key ID
   */
  private async updateUsageStats(apiKeyId: string): Promise<void> {
    await prisma.n8nApiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Hash API Key
   *
   * @description
   *   使用 SHA-256 算法對 API Key 進行雜湊。
   *
   * @param key - 原始 API Key
   * @returns 雜湊後的字串
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * 轉換為 API Key Info
   *
   * @description
   *   將 Prisma 模型轉換為 API 響應格式。
   *
   * @param apiKey - Prisma API Key 記錄
   * @returns API Key 資訊
   */
  private toApiKeyInfo(apiKey: ApiKeyWithCity): N8nApiKeyInfo {
    return {
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      cityCode: apiKey.cityCode,
      cityName: apiKey.city?.name ?? apiKey.cityCode,
      permissions: apiKey.permissions as N8nPermission[],
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      rateLimit: apiKey.rateLimit,
      createdAt: apiKey.createdAt,
      createdBy: apiKey.createdBy,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * n8n API Key 服務單例
 */
export const n8nApiKeyService = new N8nApiKeyService();
