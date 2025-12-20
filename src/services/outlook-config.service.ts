/**
 * @fileoverview Outlook 配置管理服務
 * @description
 *   提供 Outlook 連線配置的 CRUD 操作，包含：
 *   - 配置的建立、讀取、更新、刪除
 *   - 連線測試功能
 *   - Client Secret 加密儲存
 *   - 城市級別與全域配置管理
 *   - 過濾規則 CRUD 和排序
 *
 *   ## 配置優先級
 *   1. 城市專屬配置（cityId 對應）
 *   2. 全域預設配置（isGlobal = true）
 *
 *   ## 過濾規則處理
 *   - 白名單規則：只處理匹配的郵件
 *   - 黑名單規則：排除匹配的郵件
 *   - 優先級排序：priority 數字越小越優先
 *
 * @module src/services/outlook-config.service
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - Outlook 配置 CRUD 操作
 *   - 連線測試（含郵箱資訊、資料夾列表）
 *   - Client Secret AES-256 加密
 *   - 城市級別配置隔離
 *   - 全域預設配置支援
 *   - 過濾規則 CRUD 和優先級排序
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/encryption.service - 加密服務
 *   - @/services/outlook-mail.service - Outlook 郵件服務
 *
 * @related
 *   - src/app/api/admin/integrations/outlook/ - API 端點
 *   - src/types/outlook-config.types.ts - 類型定義
 *   - src/lib/validations/outlook-config.schema.ts - 驗證 Schema
 */

import { prisma } from '@/lib/prisma';
import { EncryptionService } from './encryption.service';
import { OutlookMailService } from './outlook-mail.service';
import type { OutlookConfig, OutlookFilterRule } from '@prisma/client';
import type {
  CreateOutlookConfigInput,
  UpdateOutlookConfigInput,
  CreateFilterRuleInput,
  UpdateFilterRuleInput,
  TestConnectionInput,
  OutlookConnectionTestResult,
  OutlookConfigWithRelations,
  OutlookConfigApiResponse,
  GetOutlookConfigsOptions,
  MailInfoForRules,
  RuleEvaluationResult,
} from '@/types/outlook-config.types';

// ============================================================
// Constants
// ============================================================

/** 密鑰遮罩字串 */
const SECRET_MASK = '********';

// ============================================================
// Error Class
// ============================================================

/**
 * Outlook 配置服務錯誤
 */
export class OutlookConfigError extends Error {
  constructor(
    message: string,
    public code:
      | 'CONFIG_NOT_FOUND'
      | 'RULE_NOT_FOUND'
      | 'DUPLICATE_CITY'
      | 'DUPLICATE_GLOBAL'
      | 'VALIDATION_ERROR'
      | 'CONNECTION_TEST_FAILED'
      | 'ENCRYPTION_ERROR'
  ) {
    super(message);
    this.name = 'OutlookConfigError';
  }
}

// ============================================================
// Service
// ============================================================

/**
 * Outlook 配置管理服務
 *
 * @description
 *   處理 Outlook 連線配置的所有操作，
 *   包含 CRUD、連線測試、密鑰加密、過濾規則管理等功能。
 *
 * @example
 *   const service = new OutlookConfigService();
 *   const config = await service.createConfig(input, userId);
 *   const testResult = await service.testConnection(config.id);
 */
export class OutlookConfigService {
  private readonly encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  // ============================================================
  // Config CRUD
  // ============================================================

  /**
   * 建立新的 Outlook 配置
   *
   * @param input - 配置輸入
   * @param userId - 建立者使用者 ID
   * @returns 新建立的配置（密鑰已遮罩）
   * @throws {OutlookConfigError} 當城市或全域配置已存在時
   */
  async createConfig(
    input: CreateOutlookConfigInput,
    userId: string
  ): Promise<OutlookConfigApiResponse> {
    // 驗證城市配置不重複
    if (input.cityId) {
      const existingCity = await prisma.outlookConfig.findFirst({
        where: { cityId: input.cityId },
      });
      if (existingCity) {
        throw new OutlookConfigError(
          `Outlook config already exists for city: ${input.cityId}`,
          'DUPLICATE_CITY'
        );
      }
    }

    // 驗證全域配置不重複
    if (input.isGlobal) {
      const existingGlobal = await prisma.outlookConfig.findFirst({
        where: { isGlobal: true },
      });
      if (existingGlobal) {
        throw new OutlookConfigError(
          'Global Outlook config already exists',
          'DUPLICATE_GLOBAL'
        );
      }
    }

    // 加密 Client Secret
    const encryptedSecret = this.encryptionService.encrypt(input.clientSecret);

    // 建立配置
    const config = await prisma.outlookConfig.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        mailboxAddress: input.mailboxAddress,
        mailFolders: input.mailFolders ?? ['inbox'],
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: encryptedSecret,
        cityId: input.cityId ?? null,
        isGlobal: input.isGlobal ?? false,
        allowedExtensions: input.allowedExtensions ?? ['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
        maxAttachmentSizeMb: input.maxAttachmentSizeMb ?? 30,
        createdById: userId,
      },
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: true,
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    return this.maskSecretInResponse(config);
  }

  /**
   * 獲取配置列表
   *
   * @param options - 查詢選項
   * @returns 配置列表（密鑰已遮罩）
   */
  async getConfigs(
    options: GetOutlookConfigsOptions = {}
  ): Promise<OutlookConfigApiResponse[]> {
    const where: Record<string, unknown> = {};

    if (options.cityId) {
      where.cityId = options.cityId;
    }

    if (!options.includeInactive) {
      where.isActive = true;
    }

    const configs = await prisma.outlookConfig.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: options.includeRules ? {
          orderBy: { priority: 'asc' },
        } : false,
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
    });

    return configs.map((config) => this.maskSecretInResponse(config));
  }

  /**
   * 獲取單一配置詳情
   *
   * @param configId - 配置 ID
   * @returns 配置詳情（密鑰已遮罩）
   * @throws {OutlookConfigError} 當配置不存在時
   */
  async getConfig(configId: string): Promise<OutlookConfigApiResponse> {
    const config = await prisma.outlookConfig.findUnique({
      where: { id: configId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: { orderBy: { priority: 'asc' } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    if (!config) {
      throw new OutlookConfigError(
        `Outlook config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    return this.maskSecretInResponse(config);
  }

  /**
   * 獲取城市的 Outlook 配置
   *
   * @description
   *   優先返回城市級別配置，若無則返回全域配置
   *
   * @param cityId - 城市 ID
   * @returns 配置（含加密的 Client Secret）或 null
   */
  async getConfigForCity(cityId: string): Promise<OutlookConfig | null> {
    // 優先查找城市專屬配置
    let config = await prisma.outlookConfig.findFirst({
      where: { cityId, isActive: true },
    });

    // 回退到全域配置
    if (!config) {
      config = await prisma.outlookConfig.findFirst({
        where: { isGlobal: true, isActive: true },
      });
    }

    return config;
  }

  /**
   * 更新 Outlook 配置
   *
   * @param configId - 配置 ID
   * @param input - 更新輸入
   * @param userId - 更新者使用者 ID
   * @returns 更新後的配置（密鑰已遮罩）
   * @throws {OutlookConfigError} 當配置不存在時
   */
  async updateConfig(
    configId: string,
    input: UpdateOutlookConfigInput,
    userId: string
  ): Promise<OutlookConfigApiResponse> {
    const existing = await prisma.outlookConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      throw new OutlookConfigError(
        `Outlook config not found: ${configId}`,
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

    const config = await prisma.outlookConfig.update({
      where: { id: configId },
      data: updateData,
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: { orderBy: { priority: 'asc' } },
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
  ): Promise<OutlookConfigApiResponse> {
    const config = await prisma.outlookConfig.update({
      where: { id: configId },
      data: { isActive, updatedById: userId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: { orderBy: { priority: 'asc' } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    return this.maskSecretInResponse(config);
  }

  /**
   * 刪除 Outlook 配置
   *
   * @param configId - 配置 ID
   * @throws {OutlookConfigError} 當配置不存在時
   */
  async deleteConfig(configId: string): Promise<void> {
    const existing = await prisma.outlookConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      throw new OutlookConfigError(
        `Outlook config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    // 刪除配置（級聯刪除過濾規則）
    await prisma.outlookConfig.delete({
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
   * @throws {OutlookConfigError} 當配置不存在時
   */
  async testConnection(configId: string): Promise<OutlookConnectionTestResult> {
    const config = await prisma.outlookConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new OutlookConfigError(
        `Outlook config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    // 解密 Client Secret
    const clientSecret = this.encryptionService.decrypt(config.clientSecret);

    // 執行連線測試
    const result = await this.performConnectionTest({
      mailboxAddress: config.mailboxAddress,
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret,
    });

    // 更新測試結果
    await prisma.outlookConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: result.success,
        lastTestError: result.error ?? null,
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
   * @param input - 連線測試輸入
   * @returns 連線測試結果
   */
  async testConnectionWithInput(
    input: TestConnectionInput
  ): Promise<OutlookConnectionTestResult> {
    return this.performConnectionTest(input);
  }

  /**
   * 執行連線測試
   *
   * @param input - 連線參數
   * @returns 連線測試結果
   */
  private async performConnectionTest(
    input: TestConnectionInput
  ): Promise<OutlookConnectionTestResult> {
    try {
      const mailService = new OutlookMailService(
        {
          tenantId: input.tenantId,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
        },
        input.mailboxAddress
      );

      // 測試郵箱存取
      const accessResult = await mailService.testMailboxAccess();
      if (!accessResult.success) {
        return {
          success: false,
          error: accessResult.error || 'Mailbox access test failed',
        };
      }

      // 獲取郵箱資訊
      const mailboxInfo = await mailService.getMailboxInfo();

      // 獲取最近郵件數量
      const recentMailCount = await mailService.getRecentMailCount(24);

      // 獲取郵件資料夾列表
      const folders = await mailService.getMailFolders();

      return {
        success: true,
        details: {
          mailboxInfo: {
            displayName: mailboxInfo.displayName,
            email: mailboxInfo.mail,
          },
          permissions: ['Mail.Read', 'User.Read'],
          recentMailCount,
          folders,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  // ============================================================
  // Filter Rules CRUD
  // ============================================================

  /**
   * 新增過濾規則
   *
   * @param configId - 配置 ID
   * @param input - 規則輸入
   * @returns 新建立的規則
   * @throws {OutlookConfigError} 當配置不存在時
   */
  async addFilterRule(
    configId: string,
    input: CreateFilterRuleInput
  ): Promise<OutlookFilterRule> {
    const config = await prisma.outlookConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new OutlookConfigError(
        `Outlook config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    // 獲取當前最大優先級
    const maxPriorityRule = await prisma.outlookFilterRule.findFirst({
      where: { configId },
      orderBy: { priority: 'desc' },
    });
    const nextPriority = input.priority ?? (maxPriorityRule?.priority ?? -1) + 1;

    return prisma.outlookFilterRule.create({
      data: {
        configId,
        name: input.name,
        description: input.description ?? null,
        ruleType: input.ruleType,
        ruleValue: input.ruleValue,
        operator: input.operator ?? 'CONTAINS',
        isWhitelist: input.isWhitelist,
        priority: nextPriority,
      },
    });
  }

  /**
   * 更新過濾規則
   *
   * @param ruleId - 規則 ID
   * @param input - 更新輸入
   * @returns 更新後的規則
   * @throws {OutlookConfigError} 當規則不存在時
   */
  async updateFilterRule(
    ruleId: string,
    input: UpdateFilterRuleInput
  ): Promise<OutlookFilterRule> {
    const existing = await prisma.outlookFilterRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) {
      throw new OutlookConfigError(
        `Filter rule not found: ${ruleId}`,
        'RULE_NOT_FOUND'
      );
    }

    return prisma.outlookFilterRule.update({
      where: { id: ruleId },
      data: input,
    });
  }

  /**
   * 刪除過濾規則
   *
   * @param ruleId - 規則 ID
   * @throws {OutlookConfigError} 當規則不存在時
   */
  async deleteFilterRule(ruleId: string): Promise<void> {
    const existing = await prisma.outlookFilterRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) {
      throw new OutlookConfigError(
        `Filter rule not found: ${ruleId}`,
        'RULE_NOT_FOUND'
      );
    }

    await prisma.outlookFilterRule.delete({
      where: { id: ruleId },
    });
  }

  /**
   * 獲取配置的所有過濾規則
   *
   * @param configId - 配置 ID
   * @returns 規則列表（按優先級排序）
   */
  async getFilterRules(configId: string): Promise<OutlookFilterRule[]> {
    return prisma.outlookFilterRule.findMany({
      where: { configId },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * 重新排序過濾規則
   *
   * @description
   *   接收規則 ID 陣列，按陣列順序更新優先級
   *
   * @param ruleIds - 規則 ID 陣列（按新順序排列）
   */
  async reorderFilterRules(ruleIds: string[]): Promise<void> {
    await prisma.$transaction(
      ruleIds.map((id, index) =>
        prisma.outlookFilterRule.update({
          where: { id },
          data: { priority: index },
        })
      )
    );
  }

  // ============================================================
  // Rule Evaluation
  // ============================================================

  /**
   * 評估郵件是否符合過濾規則
   *
   * @description
   *   根據配置的過濾規則評估郵件是否應該處理。
   *   規則按優先級順序評估，第一個匹配的規則決定結果。
   *
   *   - 白名單規則匹配 → 允許處理
   *   - 黑名單規則匹配 → 拒絕處理
   *   - 無規則匹配 → 預設允許
   *
   * @param configId - 配置 ID
   * @param mailInfo - 郵件資訊
   * @returns 評估結果
   */
  async evaluateRules(
    configId: string,
    mailInfo: MailInfoForRules
  ): Promise<RuleEvaluationResult> {
    const rules = await this.getFilterRules(configId);

    // 如果沒有規則，預設允許
    if (rules.length === 0) {
      return {
        allowed: true,
        reason: 'No filter rules configured',
      };
    }

    // 按優先級評估規則
    for (const rule of rules) {
      if (!rule.isActive) continue;

      const matches = this.matchRule(rule, mailInfo);

      if (matches) {
        return {
          allowed: rule.isWhitelist,
          matchedRule: rule,
          reason: rule.isWhitelist
            ? `Allowed by whitelist rule: ${rule.name}`
            : `Blocked by blacklist rule: ${rule.name}`,
        };
      }
    }

    // 無規則匹配，檢查是否有任何白名單規則
    const hasWhitelistRules = rules.some((r) => r.isWhitelist && r.isActive);

    if (hasWhitelistRules) {
      // 有白名單規則但都沒匹配 → 拒絕
      return {
        allowed: false,
        reason: 'No whitelist rules matched',
      };
    }

    // 只有黑名單規則且都沒匹配 → 允許
    return {
      allowed: true,
      reason: 'No blacklist rules matched',
    };
  }

  /**
   * 檢查規則是否匹配郵件
   *
   * @param rule - 過濾規則
   * @param mailInfo - 郵件資訊
   * @returns 是否匹配
   */
  private matchRule(
    rule: OutlookFilterRule,
    mailInfo: MailInfoForRules
  ): boolean {
    const { ruleType, ruleValue, operator } = rule;

    let targetValue: string;

    switch (ruleType) {
      case 'SENDER_EMAIL':
        targetValue = mailInfo.senderEmail.toLowerCase();
        break;
      case 'SENDER_DOMAIN':
        targetValue = mailInfo.senderEmail.split('@')[1]?.toLowerCase() ?? '';
        break;
      case 'SUBJECT_KEYWORD':
      case 'SUBJECT_REGEX':
        targetValue = mailInfo.subject;
        break;
      case 'ATTACHMENT_TYPE':
        // 檢查是否有任何附件匹配類型
        return mailInfo.attachments.some((att) =>
          this.matchOperator(att.contentType.toLowerCase(), ruleValue.toLowerCase(), operator)
        );
      case 'ATTACHMENT_NAME':
        // 檢查是否有任何附件名稱匹配
        return mailInfo.attachments.some((att) =>
          this.matchOperator(att.name.toLowerCase(), ruleValue.toLowerCase(), operator)
        );
      default:
        return false;
    }

    // 正則表達式特殊處理
    if (ruleType === 'SUBJECT_REGEX' || operator === 'REGEX') {
      try {
        const regex = new RegExp(ruleValue, 'i');
        return regex.test(targetValue);
      } catch {
        return false;
      }
    }

    return this.matchOperator(targetValue, ruleValue.toLowerCase(), operator);
  }

  /**
   * 根據運算子比對值
   *
   * @param targetValue - 目標值
   * @param ruleValue - 規則值
   * @param operator - 運算子
   * @returns 是否匹配
   */
  private matchOperator(
    targetValue: string,
    ruleValue: string,
    operator: string
  ): boolean {
    switch (operator) {
      case 'EQUALS':
        return targetValue === ruleValue;
      case 'CONTAINS':
        return targetValue.includes(ruleValue);
      case 'STARTS_WITH':
        return targetValue.startsWith(ruleValue);
      case 'ENDS_WITH':
        return targetValue.endsWith(ruleValue);
      case 'REGEX':
        try {
          const regex = new RegExp(ruleValue, 'i');
          return regex.test(targetValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 遮罩回應中的 Client Secret
   */
  private maskSecretInResponse(
    config: OutlookConfigWithRelations
  ): OutlookConfigApiResponse {
    return {
      ...config,
      clientSecretMasked: SECRET_MASK,
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
    const config = await prisma.outlookConfig.findUnique({
      where: { id: configId },
      select: { clientSecret: true },
    });

    if (!config) {
      throw new OutlookConfigError(
        `Outlook config not found: ${configId}`,
        'CONFIG_NOT_FOUND'
      );
    }

    return this.encryptionService.decrypt(config.clientSecret);
  }

  /**
   * 增加處理計數
   *
   * @description
   *   當成功處理郵件附件時，更新統計資訊
   *
   * @param configId - 配置 ID
   */
  async incrementProcessedCount(configId: string): Promise<void> {
    await prisma.outlookConfig.update({
      where: { id: configId },
      data: {
        totalProcessed: { increment: 1 },
        lastProcessedAt: new Date(),
      },
    });
  }
}
