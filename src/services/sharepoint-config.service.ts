/**
 * @fileoverview SharePoint 配置管理服務
 * @description
 *   提供 SharePoint 連線配置的 CRUD 操作，包含：
 *   - 配置的建立、讀取、更新、刪除
 *   - 連線測試功能
 *   - Client Secret 加密儲存
 *   - 城市級別與全域配置管理
 *
 * @module src/services/sharepoint-config.service
 * @author Development Team
 * @since Epic 9 - Story 9.2 (SharePoint 連線配置)
 * @lastModified 2025-12-20
 *
 * @features
 *   - SharePoint 配置 CRUD 操作
 *   - 連線測試（含詳細資訊）
 *   - Client Secret AES-256 加密
 *   - 城市級別配置隔離
 *   - 全域預設配置支援
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/encryption.service - 加密服務
 *   - @/services/microsoft-graph.service - Graph API 服務
 *
 * @related
 *   - src/app/api/admin/integrations/sharepoint/ - API 端點
 *   - src/types/sharepoint.ts - 類型定義
 */

import { prisma } from '@/lib/prisma';
import { EncryptionService } from './encryption.service';
import { MicrosoftGraphService } from './microsoft-graph.service';
import type { SharePointConfig } from '@prisma/client';
import type {
  SharePointConfigInput,
  SharePointConfigUpdateInput,
  SharePointConfigResponse,
  SharePointConfigQueryOptions,
  ConnectionTestResult,
  SharePointConfigListItem,
} from '@/types/sharepoint';

// ============================================================
// Constants
// ============================================================

/** 密鑰遮罩字串 */
const SECRET_MASK = '********';

// ============================================================
// Error Class
// ============================================================

/**
 * SharePoint 配置服務錯誤
 */
export class SharePointConfigError extends Error {
  constructor(
    message: string,
    public code:
      | 'CONFIG_NOT_FOUND'
      | 'DUPLICATE_CITY'
      | 'DUPLICATE_GLOBAL'
      | 'VALIDATION_ERROR'
      | 'CONNECTION_TEST_FAILED'
      | 'ENCRYPTION_ERROR'
  ) {
    super(message);
    this.name = 'SharePointConfigError';
  }
}

// ============================================================
// Service
// ============================================================

/**
 * SharePoint 配置管理服務
 *
 * @description
 *   處理 SharePoint 連線配置的所有操作，
 *   包含 CRUD、連線測試、密鑰加密等功能。
 *
 * @example
 *   const service = new SharePointConfigService();
 *   const config = await service.createConfig(input, userId);
 *   const testResult = await service.testConnection(config.id);
 */
export class SharePointConfigService {
  private readonly encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  // ============================================================
  // Create
  // ============================================================

  /**
   * 建立新的 SharePoint 配置
   *
   * @param input - 配置輸入
   * @param userId - 建立者使用者 ID
   * @returns 新建立的配置（密鑰已遮罩）
   * @throws {SharePointConfigError} 當城市或全域配置已存在時
   */
  async createConfig(
    input: SharePointConfigInput,
    userId: string
  ): Promise<SharePointConfigResponse> {
    // 驗證城市配置不重複
    if (input.cityId) {
      const existingCity = await prisma.sharePointConfig.findFirst({
        where: { cityId: input.cityId },
      });
      if (existingCity) {
        throw new SharePointConfigError(
          `SharePoint config already exists for city: ${input.cityId}`,
          'DUPLICATE_CITY'
        );
      }
    }

    // 驗證全域配置不重複
    if (input.isGlobal) {
      const existingGlobal = await prisma.sharePointConfig.findFirst({
        where: { isGlobal: true },
      });
      if (existingGlobal) {
        throw new SharePointConfigError(
          'Global SharePoint config already exists',
          'DUPLICATE_GLOBAL'
        );
      }
    }

    // 加密 Client Secret
    const encryptedSecret = this.encryptionService.encrypt(input.clientSecret);

    // 建立配置
    const config = await prisma.sharePointConfig.create({
      data: {
        name: input.name,
        description: input.description,
        siteUrl: input.siteUrl,
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: encryptedSecret,
        libraryPath: input.libraryPath,
        rootFolderPath: input.rootFolderPath,
        cityId: input.cityId,
        isGlobal: input.isGlobal ?? false,
        fileExtensions: input.fileExtensions ?? [],
        maxFileSizeMb: input.maxFileSizeMb ?? 50,
        excludeFolders: input.excludeFolders ?? [],
        createdById: userId,
      },
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    return this.maskSecretInResponse(config);
  }

  // ============================================================
  // Read
  // ============================================================

  /**
   * 獲取配置列表
   *
   * @param options - 查詢選項
   * @returns 配置列表（密鑰已遮罩）
   */
  async getConfigs(
    options: SharePointConfigQueryOptions = {}
  ): Promise<SharePointConfigListItem[]> {
    const where: Record<string, unknown> = {};

    if (options.cityId) {
      where.cityId = options.cityId;
    }

    if (!options.includeInactive) {
      where.isActive = true;
    }

    const configs = await prisma.sharePointConfig.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        siteUrl: true,
        libraryPath: true,
        isActive: true,
        isGlobal: true,
        lastTestedAt: true,
        lastTestResult: true,
        createdAt: true,
        updatedAt: true,
        city: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
    });

    return configs;
  }

  /**
   * 獲取單一配置詳情
   *
   * @param configId - 配置 ID
   * @returns 配置詳情（密鑰已遮罩）
   * @throws {SharePointConfigError} 當配置不存在時
   */
  async getConfig(configId: string): Promise<SharePointConfigResponse> {
    const config = await prisma.sharePointConfig.findUnique({
      where: { id: configId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    if (!config) {
      throw new SharePointConfigError(
        `SharePoint config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    return this.maskSecretInResponse(config);
  }

  /**
   * 獲取城市的 SharePoint 配置
   *
   * @description
   *   優先返回城市級別配置，若無則返回全域配置
   *
   * @param cityId - 城市 ID
   * @returns 配置（含解密的 Client Secret）或 null
   */
  async getConfigForCity(cityId: string): Promise<SharePointConfig | null> {
    // 優先查找城市專屬配置
    let config = await prisma.sharePointConfig.findFirst({
      where: { cityId, isActive: true },
    });

    // 回退到全域配置
    if (!config) {
      config = await prisma.sharePointConfig.findFirst({
        where: { isGlobal: true, isActive: true },
      });
    }

    return config;
  }

  // ============================================================
  // Update
  // ============================================================

  /**
   * 更新 SharePoint 配置
   *
   * @param configId - 配置 ID
   * @param input - 更新輸入
   * @param userId - 更新者使用者 ID
   * @returns 更新後的配置（密鑰已遮罩）
   * @throws {SharePointConfigError} 當配置不存在時
   */
  async updateConfig(
    configId: string,
    input: SharePointConfigUpdateInput,
    userId: string
  ): Promise<SharePointConfigResponse> {
    const existing = await prisma.sharePointConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      throw new SharePointConfigError(
        `SharePoint config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    // 準備更新資料
    const updateData: Record<string, unknown> = {
      ...input,
      updatedById: userId,
    };

    // 如果提供新的 Client Secret，則加密
    if (input.clientSecret) {
      updateData.clientSecret = this.encryptionService.encrypt(input.clientSecret);
    } else {
      delete updateData.clientSecret;
    }

    const config = await prisma.sharePointConfig.update({
      where: { id: configId },
      data: updateData,
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    return this.maskSecretInResponse(config);
  }

  /**
   * 切換配置啟用狀態
   *
   * @param configId - 配置 ID
   * @param isActive - 新的啟用狀態
   * @param userId - 操作者使用者 ID
   * @returns 更新後的配置（密鑰已遮罩）
   */
  async toggleActive(
    configId: string,
    isActive: boolean,
    userId: string
  ): Promise<SharePointConfigResponse> {
    const config = await prisma.sharePointConfig.update({
      where: { id: configId },
      data: { isActive, updatedById: userId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    return this.maskSecretInResponse(config);
  }

  // ============================================================
  // Delete
  // ============================================================

  /**
   * 刪除 SharePoint 配置
   *
   * @param configId - 配置 ID
   * @throws {SharePointConfigError} 當配置不存在時
   */
  async deleteConfig(configId: string): Promise<void> {
    const existing = await prisma.sharePointConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      throw new SharePointConfigError(
        `SharePoint config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    await prisma.sharePointConfig.delete({
      where: { id: configId },
    });
  }

  // ============================================================
  // Connection Test
  // ============================================================

  /**
   * 測試現有配置的連線
   *
   * @param configId - 配置 ID
   * @returns 連線測試結果
   * @throws {SharePointConfigError} 當配置不存在時
   */
  async testConnection(configId: string): Promise<ConnectionTestResult> {
    const config = await prisma.sharePointConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new SharePointConfigError(
        `SharePoint config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    // 解密 Client Secret
    const clientSecret = this.encryptionService.decrypt(config.clientSecret);

    // 執行連線測試
    const graphService = new MicrosoftGraphService({
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret,
    });

    const result = await graphService.testConnectionWithDetails(
      config.siteUrl,
      config.libraryPath
    );

    // 更新測試結果
    await prisma.sharePointConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: result.success,
        lastTestError: result.error ?? null,
        driveId: result.details?.driveInfo?.id ?? config.driveId,
      },
    });

    return result;
  }

  /**
   * 測試新配置的連線（不儲存）
   *
   * @description
   *   用於在儲存配置前測試連線是否正常
   *
   * @param input - 配置輸入
   * @returns 連線測試結果
   */
  async testConnectionWithInput(
    input: Pick<SharePointConfigInput, 'tenantId' | 'clientId' | 'clientSecret' | 'siteUrl' | 'libraryPath'>
  ): Promise<ConnectionTestResult> {
    const graphService = new MicrosoftGraphService({
      tenantId: input.tenantId,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    });

    return graphService.testConnectionWithDetails(input.siteUrl, input.libraryPath);
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 遮罩回應中的 Client Secret
   */
  private maskSecretInResponse(
    config: SharePointConfig & {
      city?: { id: string; name: string; code: string } | null;
      createdBy?: { id: string; name: string | null };
      updatedBy?: { id: string; name: string | null } | null;
    }
  ): SharePointConfigResponse {
    return {
      ...config,
      clientSecret: SECRET_MASK,
    };
  }

  /**
   * 獲取解密後的 Client Secret
   *
   * @description
   *   內部方法，用於需要實際密鑰的操作（如連線測試）
   *
   * @param configId - 配置 ID
   * @returns 解密後的 Client Secret
   */
  async getDecryptedSecret(configId: string): Promise<string> {
    const config = await prisma.sharePointConfig.findUnique({
      where: { id: configId },
      select: { clientSecret: true },
    });

    if (!config) {
      throw new SharePointConfigError(
        `SharePoint config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    return this.encryptionService.decrypt(config.clientSecret);
  }
}
