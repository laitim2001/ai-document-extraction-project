/**
 * @fileoverview 格式匹配適配器
 * @description
 *   將現有的 document-format.service.ts 適配到統一處理流程：
 *   - 封裝現有服務的調用
 *   - 轉換請求/結果格式
 *   - 提供統一的錯誤處理
 *   - 支援格式匹配和自動創建
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.3
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/document-format.service.ts - 被適配的現有服務
 *   - src/types/format-matching.ts - 類型定義
 *   - src/services/unified-processor/steps/format-matching.step.ts - 使用此適配器
 */

import {
  FormatMatchRequest,
  FormatMatchResult,
  FormatMatchOptions,
  FormatMatchMethod,
  FormatStatus,
  DocumentCharacteristics,
  DEFAULT_FORMAT_MATCH_OPTIONS,
  buildDocumentCharacteristics,
} from '@/types/format-matching';

// 導入現有格式服務和類型
import { processDocumentFormat } from '@/services/document-format.service';
import type {
  DocumentFormatExtractionResult,
  FormatIdentificationConfig,
  DocumentType,
  DocumentSubtype,
  DocumentFormatFeatures,
} from '@/types/document-format';

/**
 * 格式匹配適配器
 * @description 封裝現有 document-format.service.ts 提供統一介面
 */
export class FormatMatcherAdapter {
  /**
   * 匹配或創建文件格式
   * @param request - 匹配請求
   * @returns 匹配結果
   */
  async matchFormat(request: FormatMatchRequest): Promise<FormatMatchResult> {
    const startTime = Date.now();

    try {
      // 合併選項
      const options = this.mergeOptions(request.options);

      // 轉換為 Legacy 請求格式
      const legacyRequest = this.convertToLegacyRequest(request.characteristics);
      const legacyConfig = this.convertToLegacyConfig(options);

      // 調用現有服務
      const legacyResult = await processDocumentFormat(
        request.companyId,
        legacyRequest,
        legacyConfig
      );

      // 轉換結果
      const processingTimeMs = Date.now() - startTime;

      if (!legacyResult) {
        return this.createNotFoundResult(processingTimeMs);
      }

      return this.convertFromLegacyResult(legacyResult, processingTimeMs);
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      return this.createErrorResult(error, processingTimeMs);
    }
  }

  /**
   * 從上下文資料匹配格式（簡化版本）
   * @description 用於步驟處理器直接調用
   * @param companyId - 公司 ID
   * @param extractedData - AI 提取結果
   * @param options - 匹配選項
   * @returns 匹配結果
   */
  async matchFromExtraction(
    companyId: string,
    extractedData: {
      invoiceData?: Record<string, unknown>;
      metadata?: {
        pageCount?: number;
        hasTables?: boolean;
        logoDetected?: boolean;
        orientation?: string;
      };
      documentType?: string;
      documentSubtype?: string;
    } | null,
    options?: Partial<FormatMatchOptions>
  ): Promise<FormatMatchResult> {
    const characteristics = buildDocumentCharacteristics(extractedData);

    return this.matchFormat({
      companyId,
      characteristics,
      options: options as FormatMatchOptions,
    });
  }

  /**
   * 檢查是否可以執行格式匹配
   * @param companyId - 公司 ID
   * @param characteristics - 文件特徵
   * @returns 是否可以匹配
   */
  canMatch(
    companyId: string | null | undefined,
    characteristics: DocumentCharacteristics | null
  ): boolean {
    // 必須有公司 ID
    if (!companyId) {
      return false;
    }

    // 必須有文件特徵
    if (!characteristics) {
      return false;
    }

    // 必須有文件類型
    if (!characteristics.documentType || characteristics.documentType === 'UNKNOWN') {
      return false;
    }

    return true;
  }

  /**
   * 取得預設匹配選項
   * @returns 預設選項
   */
  getDefaultOptions(): Required<FormatMatchOptions> {
    return { ...DEFAULT_FORMAT_MATCH_OPTIONS };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 合併選項與預設值
   */
  private mergeOptions(
    options?: Partial<FormatMatchOptions>
  ): Required<FormatMatchOptions> {
    return {
      ...DEFAULT_FORMAT_MATCH_OPTIONS,
      ...options,
    };
  }

  /**
   * 轉換為 Legacy 請求格式
   * @description 將統一格式轉換為現有服務可接受的格式
   */
  private convertToLegacyRequest(
    characteristics: DocumentCharacteristics
  ): DocumentFormatExtractionResult {
    return {
      documentType: characteristics.documentType as DocumentType,
      documentSubtype: (characteristics.documentSubtype ?? 'GENERAL') as DocumentSubtype,
      formatConfidence: 80, // 預設信心度
      formatFeatures: this.extractFormatFeatures(characteristics),
    };
  }

  /**
   * 提取格式特徵
   */
  private extractFormatFeatures(
    characteristics: DocumentCharacteristics
  ): DocumentFormatFeatures {
    const features: DocumentFormatFeatures = {
      hasLineItems: characteristics.hasTables,
      hasHeaderLogo: characteristics.hasLogo,
      layoutPattern: characteristics.layoutType,
    };

    // 添加額外特徵
    if (characteristics.formatFeatures) {
      for (const feature of characteristics.formatFeatures) {
        if (feature.name === 'currency') {
          features.currency = String(feature.value);
        } else if (feature.name === 'language') {
          features.language = String(feature.value);
        }
      }
    }

    return features;
  }

  /**
   * 轉換為 Legacy 配置格式
   */
  private convertToLegacyConfig(
    options: Required<FormatMatchOptions>
  ): Partial<FormatIdentificationConfig> {
    return {
      autoCreateFormat: options.autoCreate,
      confidenceThreshold: options.minConfidence,
      enabled: true,
      learnFeatures: true,
    };
  }

  /**
   * 從 Legacy 結果轉換
   */
  private convertFromLegacyResult(
    legacyResult: NonNullable<Awaited<ReturnType<typeof processDocumentFormat>>>,
    processingTimeMs: number
  ): FormatMatchResult {
    return {
      success: true,
      formatId: legacyResult.formatId,
      formatName: legacyResult.formatName,
      matchMethod: legacyResult.isNewFormat
        ? FormatMatchMethod.AUTO_CREATED
        : FormatMatchMethod.EXACT,
      confidence: legacyResult.confidence,
      formatStatus: FormatStatus.ACTIVE, // 新建或匹配的格式預設為 ACTIVE
      isNewFormat: legacyResult.isNewFormat,
      processingTimeMs,
      metadata: {
        candidatesSearched: 1,
        strategyUsed: legacyResult.isNewFormat
          ? FormatMatchMethod.AUTO_CREATED
          : FormatMatchMethod.EXACT,
        cached: false,
      },
    };
  }

  /**
   * 創建未找到結果
   */
  private createNotFoundResult(processingTimeMs: number): FormatMatchResult {
    return {
      success: false,
      formatId: null,
      formatName: null,
      matchMethod: FormatMatchMethod.NOT_FOUND,
      confidence: 0,
      formatStatus: null,
      isNewFormat: false,
      processingTimeMs,
      error: 'No format found or created',
    };
  }

  /**
   * 創建錯誤結果
   */
  private createErrorResult(
    error: unknown,
    processingTimeMs: number
  ): FormatMatchResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during format matching';

    return {
      success: false,
      formatId: null,
      formatName: null,
      matchMethod: FormatMatchMethod.NOT_FOUND,
      confidence: 0,
      formatStatus: null,
      isNewFormat: false,
      processingTimeMs,
      error: errorMessage,
    };
  }
}

// 單例導出
export const formatMatcherAdapter = new FormatMatcherAdapter();
