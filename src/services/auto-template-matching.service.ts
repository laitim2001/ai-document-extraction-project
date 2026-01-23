/**
 * @fileoverview 自動模版匹配服務
 * @description
 *   提供文件自動匹配到數據模版的功能，支援以下匹配模式：
 *   - 自動匹配：根據預設規則自動選擇模版
 *   - 手動匹配：用戶選擇目標模版
 *   - 批量匹配：多個文件同時匹配到同一模版
 *
 * @module src/services/auto-template-matching
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 *
 * @features
 *   - 三層優先級規則解析（FORMAT > COMPANY > GLOBAL）
 *   - 自動匹配觸發（處理完成後）
 *   - 批量手動匹配
 *   - 取消匹配
 *   - 進度回調
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - template-matching-engine.service.ts - 匹配引擎
 *   - template-instance.service.ts - 實例管理
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { templateMatchingEngineService } from './template-matching-engine.service';
import type { MatchResult, MatchProgress } from '@/types/template-matching-engine';

// ============================================================================
// Types
// ============================================================================

/**
 * 預設模版解析結果
 */
export interface ResolvedDefaultTemplate {
  /** 模版 ID */
  templateId: string;
  /** 模版名稱 */
  templateName: string;
  /** 解析來源 */
  source: 'FORMAT' | 'COMPANY' | 'GLOBAL';
  /** 來源 ID（格式或公司） */
  sourceId?: string;
}

/**
 * 自動匹配結果
 */
export interface AutoMatchResult {
  /** 是否成功 */
  success: boolean;
  /** 模版實例 ID */
  templateInstanceId?: string;
  /** 匹配結果詳情 */
  matchResult?: MatchResult;
  /** 解析來源 */
  source?: 'FORMAT' | 'COMPANY' | 'GLOBAL';
  /** 錯誤訊息 */
  error?: string;
}

/**
 * 批量匹配參數
 */
export interface BatchMatchParams {
  /** 文件 ID 列表（最多 500 個） */
  documentIds: string[];
  /** 模版實例 ID */
  templateInstanceId: string;
  /** 選項 */
  options?: {
    /** 批量處理大小 */
    batchSize?: number;
    /** 進度回調 */
    onProgress?: (progress: MatchProgress) => void;
  };
}

/**
 * 批量匹配結果
 */
export interface BatchMatchResult {
  /** 總文件數 */
  totalDocuments: number;
  /** 成功數 */
  successCount: number;
  /** 錯誤數 */
  errorCount: number;
  /** 匹配結果列表 */
  results: MatchResult[];
}

/**
 * 單一文件匹配參數
 */
export interface SingleMatchParams {
  /** 文件 ID */
  documentId: string;
  /** 模版實例 ID */
  templateInstanceId: string;
}

/**
 * 取消匹配參數
 */
export interface UnmatchParams {
  /** 文件 ID */
  documentId: string;
}

/**
 * 取消匹配結果
 */
export interface UnmatchResult {
  /** 是否成功 */
  success: boolean;
  /** 之前的模版實例 ID */
  previousInstanceId?: string;
  /** 錯誤訊息 */
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 最大批量文件數量 */
const MAX_BATCH_SIZE = 500;

/** 預設批量處理大小 */
const DEFAULT_BATCH_SIZE = 50;

/** 全局設定 Key */
const GLOBAL_DEFAULT_TEMPLATE_KEY = 'global_default_template_id';

// ============================================================================
// Service Class
// ============================================================================

/**
 * 自動模版匹配服務類
 * @description
 *   負責自動和手動將文件匹配到數據模版
 */
export class AutoTemplateMatchingService {
  // --------------------------------------------------------------------------
  // Resolve Default Template
  // --------------------------------------------------------------------------

  /**
   * 解析預設模版
   *
   * @description
   *   按優先級解析預設模版：
   *   1. FORMAT 級別：DocumentFormat.defaultTemplateId
   *   2. COMPANY 級別：Company.defaultTemplateId
   *   3. GLOBAL 級別：SystemConfig 中的全局預設
   *
   * @param companyId - 公司 ID
   * @param formatId - 文件格式 ID（可選）
   * @returns 預設模版資訊，如果沒有預設則返回 null
   */
  async resolveDefaultTemplate(
    companyId: string,
    formatId?: string
  ): Promise<ResolvedDefaultTemplate | null> {
    // 1. FORMAT 級別
    if (formatId) {
      const format = await prisma.documentFormat.findUnique({
        where: { id: formatId },
        include: {
          defaultTemplate: {
            select: { id: true, name: true },
          },
        },
      });

      if (format?.defaultTemplate) {
        return {
          templateId: format.defaultTemplate.id,
          templateName: format.defaultTemplate.name,
          source: 'FORMAT',
          sourceId: formatId,
        };
      }
    }

    // 2. COMPANY 級別
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        defaultTemplate: {
          select: { id: true, name: true },
        },
      },
    });

    if (company?.defaultTemplate) {
      return {
        templateId: company.defaultTemplate.id,
        templateName: company.defaultTemplate.name,
        source: 'COMPANY',
        sourceId: companyId,
      };
    }

    // 3. GLOBAL 級別
    const globalTemplate = await this.getGlobalDefaultTemplate();
    if (globalTemplate) {
      return {
        templateId: globalTemplate.id,
        templateName: globalTemplate.name,
        source: 'GLOBAL',
      };
    }

    return null;
  }

  /**
   * 獲取全局預設模版
   *
   * @description
   *   從 SystemConfig 讀取全局預設模版
   *
   * @returns 全局預設模版資訊
   */
  async getGlobalDefaultTemplate(): Promise<{ id: string; name: string } | null> {
    const config = await prisma.systemConfig.findFirst({
      where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
    });

    if (!config?.value) {
      return null;
    }

    // SystemConfig.value 是 JSON 編碼的字串
    let templateId: string | undefined;
    try {
      const parsed = JSON.parse(config.value);
      templateId = typeof parsed === 'string' ? parsed : parsed?.templateId;
    } catch {
      // 如果不是 JSON，直接使用原值
      templateId = config.value;
    }

    if (!templateId) {
      return null;
    }

    const template = await prisma.dataTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true },
    });

    return template;
  }

  /**
   * 設定全局預設模版
   *
   * @param templateId - 模版 ID（null 表示清除）
   */
  async setGlobalDefaultTemplate(templateId: string | null): Promise<void> {
    if (templateId) {
      // 驗證模版存在
      const template = await prisma.dataTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new Error('模版不存在');
      }

      await prisma.systemConfig.upsert({
        where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
        update: {
          value: JSON.stringify({ templateId }),
          updatedAt: new Date(),
        },
        create: {
          key: GLOBAL_DEFAULT_TEMPLATE_KEY,
          value: JSON.stringify({ templateId }),
          category: 'SYSTEM',
          name: '全局預設數據模版',
          description: '系統全局預設的數據模版 ID，用於自動匹配',
        },
      });
    } else {
      await prisma.systemConfig.deleteMany({
        where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
      });
    }
  }

  // --------------------------------------------------------------------------
  // Auto Match
  // --------------------------------------------------------------------------

  /**
   * 自動匹配（處理完成後調用）
   *
   * @description
   *   當文件處理完成後，根據預設規則自動匹配到模版
   *   如果沒有預設規則，則不執行匹配
   *
   * @param documentId - 文件 ID
   * @returns 自動匹配結果
   */
  async autoMatch(documentId: string): Promise<AutoMatchResult> {
    try {
      // 1. 獲取文件資訊
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          companyId: true,
          templateInstanceId: true,
        },
      });

      if (!document) {
        return {
          success: false,
          error: '文件不存在',
        };
      }

      if (!document.companyId) {
        return {
          success: false,
          error: '文件未關聯公司，無法自動匹配',
        };
      }

      // 如果已經匹配，跳過
      if (document.templateInstanceId) {
        return {
          success: true,
          templateInstanceId: document.templateInstanceId,
        };
      }

      // 2. 解析預設模版（目前只支援 COMPANY 和 GLOBAL 級別）
      // 注意：FORMAT 級別需要 Document 有 formatId 欄位，目前未實現
      const resolved = await this.resolveDefaultTemplate(
        document.companyId,
        undefined // formatId 暫不支援
      );

      if (!resolved) {
        return {
          success: false,
          error: '沒有配置預設模版',
        };
      }

      // 3. 查找或創建模版實例
      const instance = await this.getOrCreateInstance(resolved.templateId);

      // 4. 執行匹配
      const matchResult = await templateMatchingEngineService.matchDocuments({
        documentIds: [documentId],
        templateInstanceId: instance.id,
        options: {
          companyId: document.companyId,
        },
      });

      // 5. 更新 Document 記錄
      await prisma.document.update({
        where: { id: documentId },
        data: {
          templateInstanceId: instance.id,
          templateMatchedAt: new Date(),
        },
      });

      return {
        success: true,
        templateInstanceId: instance.id,
        matchResult,
        source: resolved.source,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '自動匹配失敗',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Manual Match
  // --------------------------------------------------------------------------

  /**
   * 單一文件匹配
   *
   * @description
   *   手動將單一文件匹配到指定模版實例
   *
   * @param params - 匹配參數
   * @returns 匹配結果
   */
  async matchSingle(params: SingleMatchParams): Promise<MatchResult> {
    const { documentId, templateInstanceId } = params;

    // 獲取文件資訊
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        companyId: true,
      },
    });

    if (!document) {
      throw new Error('文件不存在');
    }

    // 執行匹配
    const result = await templateMatchingEngineService.matchDocuments({
      documentIds: [documentId],
      templateInstanceId,
      options: {
        companyId: document.companyId || undefined,
      },
    });

    // 更新 Document 記錄
    await prisma.document.update({
      where: { id: documentId },
      data: {
        templateInstanceId,
        templateMatchedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * 批量手動匹配
   *
   * @description
   *   將多個文件匹配到同一模版實例
   *   支援最多 500 個文件
   *
   * @param params - 批量匹配參數
   * @returns 批量匹配結果
   */
  async batchMatch(params: BatchMatchParams): Promise<BatchMatchResult> {
    const { documentIds, templateInstanceId, options = {} } = params;
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;

    // 驗證文件數量
    if (documentIds.length > MAX_BATCH_SIZE) {
      throw new Error(`最多只能批量處理 ${MAX_BATCH_SIZE} 個文件`);
    }

    if (documentIds.length === 0) {
      return {
        totalDocuments: 0,
        successCount: 0,
        errorCount: 0,
        results: [],
      };
    }

    // 驗證模版實例存在
    const instance = await prisma.templateInstance.findUnique({
      where: { id: templateInstanceId },
    });

    if (!instance) {
      throw new Error('模版實例不存在');
    }

    const results: MatchResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // 分批處理
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);

      try {
        const result = await templateMatchingEngineService.matchDocuments({
          documentIds: batch,
          templateInstanceId,
        });

        results.push(result);
        successCount += result.validRows;
        errorCount += result.invalidRows + result.errorRows;

        // 批量更新 Document 記錄
        await prisma.document.updateMany({
          where: { id: { in: batch } },
          data: {
            templateInstanceId,
            templateMatchedAt: new Date(),
          },
        });
      } catch {
        // 單批失敗，記錄錯誤但繼續處理
        errorCount += batch.length;
      }

      // 進度回調
      if (options.onProgress) {
        options.onProgress({
          processed: Math.min(i + batchSize, documentIds.length),
          total: documentIds.length,
          percentage: Math.round(
            (Math.min(i + batchSize, documentIds.length) / documentIds.length) * 100
          ),
        });
      }
    }

    return {
      totalDocuments: documentIds.length,
      successCount,
      errorCount,
      results,
    };
  }

  // --------------------------------------------------------------------------
  // Unmatch
  // --------------------------------------------------------------------------

  /**
   * 取消匹配
   *
   * @description
   *   移除文件與模版實例的關聯
   *   不會刪除 TemplateInstanceRow 中的數據
   *
   * @param params - 取消匹配參數
   * @returns 取消結果
   */
  async unmatch(params: UnmatchParams): Promise<UnmatchResult> {
    const { documentId } = params;

    // 獲取文件
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        templateInstanceId: true,
      },
    });

    if (!document) {
      return {
        success: false,
        error: '文件不存在',
      };
    }

    const previousInstanceId = document.templateInstanceId || undefined;

    // 清除匹配關聯
    await prisma.document.update({
      where: { id: documentId },
      data: {
        templateInstanceId: null,
        templateMatchedAt: null,
      },
    });

    return {
      success: true,
      previousInstanceId,
    };
  }

  /**
   * 批量取消匹配
   *
   * @param documentIds - 文件 ID 列表
   * @returns 取消的文件數量
   */
  async batchUnmatch(documentIds: string[]): Promise<number> {
    if (documentIds.length === 0) {
      return 0;
    }

    const result = await prisma.document.updateMany({
      where: { id: { in: documentIds } },
      data: {
        templateInstanceId: null,
        templateMatchedAt: null,
      },
    });

    return result.count;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * 獲取或創建模版實例
   *
   * @description
   *   查找目前可用的實例，如果沒有則創建新實例
   *   可用實例：狀態為 DRAFT 或 ACTIVE 的實例
   *
   * @param templateId - 模版 ID
   * @returns 模版實例
   */
  private async getOrCreateInstance(templateId: string): Promise<{
    id: string;
    name: string;
  }> {
    // 查找現有的可編輯實例（DRAFT 狀態為可編輯）
    const existingInstance = await prisma.templateInstance.findFirst({
      where: {
        dataTemplateId: templateId,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });

    if (existingInstance) {
      return existingInstance;
    }

    // 獲取模版資訊
    const template = await prisma.dataTemplate.findUnique({
      where: { id: templateId },
      select: { name: true },
    });

    if (!template) {
      throw new Error('模版不存在');
    }

    // 創建新實例
    const now = new Date();
    const instanceName = `${template.name} - ${now.toISOString().slice(0, 10)}`;

    const newInstance = await prisma.templateInstance.create({
      data: {
        dataTemplateId: templateId,
        name: instanceName,
        status: 'DRAFT',
      },
      select: { id: true, name: true },
    });

    return newInstance;
  }

  /**
   * 獲取文件匹配狀態
   *
   * @param documentId - 文件 ID
   * @returns 匹配狀態資訊
   */
  async getMatchStatus(documentId: string): Promise<{
    isMatched: boolean;
    templateInstanceId?: string;
    templateName?: string;
    matchedAt?: Date;
  }> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        templateInstanceId: true,
        templateMatchedAt: true,
        templateInstance: {
          select: {
            dataTemplate: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!document) {
      return { isMatched: false };
    }

    return {
      isMatched: !!document.templateInstanceId,
      templateInstanceId: document.templateInstanceId || undefined,
      templateName: document.templateInstance?.dataTemplate.name,
      matchedAt: document.templateMatchedAt || undefined,
    };
  }

  /**
   * 獲取未匹配文件數量
   *
   * @param filters - 篩選條件
   * @returns 未匹配文件數量
   */
  async getUnmatchedCount(filters?: {
    companyId?: string;
    status?: string;
  }): Promise<number> {
    const where: Prisma.DocumentWhereInput = {
      templateInstanceId: null,
    };

    if (filters?.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters?.status) {
      where.status = filters.status as Prisma.EnumDocumentStatusFilter;
    }

    return prisma.document.count({ where });
  }
}

// ============================================================================
// Service Instance Export
// ============================================================================

/**
 * 自動模版匹配服務單例
 */
export const autoTemplateMatchingService = new AutoTemplateMatchingService();
