/**
 * @fileoverview Extraction V2 服務導出
 * @description
 *   導出 CHANGE-020 新提取架構的所有服務：
 *   - Azure DI prebuilt-document 服務
 *   - 數據精選服務
 *   - GPT-mini 提取服務
 *
 * @module src/services/extraction-v2
 * @since CHANGE-020 - Extraction V2 Architecture
 * @lastModified 2026-01-29
 *
 * @features
 *   - 統一導出所有 extraction-v2 服務
 *   - 類型導出
 *   - 整合函數導出
 *
 * @related
 *   - claudedocs/4-changes/feature-changes/CHANGE-020-extraction-v2-prebuilt-document-gpt-mini.md
 */

// ============================================================
// Azure DI Document Service
// ============================================================

export {
  extractWithPrebuiltDocument,
  validateConfig as validateAzureDIConfig,
  testConnection as testAzureDIConnection,
  type AzureDIDocumentResult,
  type AzureDIDocumentConfig,
  type ExtractedKeyValuePair,
  type ExtractedTable,
} from './azure-di-document.service';

// ============================================================
// Data Selector Service
// ============================================================

export {
  selectDataForGpt,
  generateGptContext,
  analyzeResultQuality,
  type SelectedData,
  type DataSelectorConfig,
} from './data-selector.service';

// ============================================================
// GPT Mini Extractor Service
// ============================================================

export {
  extractFieldsWithGptMini,
  validateConfig as validateGptMiniConfig,
  testConnection as testGptMiniConnection,
  convertPromptConfigFields,
  type GptMiniExtractionResult,
  type GptMiniExtractorConfig,
  type ExtractedFieldResult,
  type FieldDefinition,
} from './gpt-mini-extractor.service';

// ============================================================
// Integrated Extraction Pipeline
// ============================================================

import {
  extractWithPrebuiltDocument,
  type AzureDIDocumentResult,
} from './azure-di-document.service';
import {
  selectDataForGpt,
  analyzeResultQuality,
  type SelectedData,
  type DataSelectorConfig,
} from './data-selector.service';
import {
  extractFieldsWithGptMini,
  convertPromptConfigFields,
  type GptMiniExtractionResult,
  type GptMiniExtractorConfig,
  type FieldDefinition,
} from './gpt-mini-extractor.service';

/**
 * 完整的 Extraction V2 流程結果
 */
export interface ExtractionV2Result {
  /** 整體成功 */
  success: boolean;
  /** Azure DI 結果 */
  azureDIResult: AzureDIDocumentResult;
  /** 精選數據 */
  selectedData: SelectedData;
  /** 數據品質分析 */
  qualityAnalysis: ReturnType<typeof analyzeResultQuality>;
  /** GPT 提取結果 */
  gptResult: GptMiniExtractionResult;
  /** 總處理時間 */
  totalProcessingTimeMs: number;
  /** 錯誤信息（如果有） */
  error?: string;
}

/**
 * Extraction V2 配置
 */
export interface ExtractionV2Config {
  /** 數據精選配置 */
  dataSelectorConfig?: DataSelectorConfig;
  /** GPT 配置 */
  gptConfig?: GptMiniExtractorConfig;
  /** 要提取的欄位（如果不提供，使用預設欄位） */
  fields?: FieldDefinition[];
}

/**
 * 執行完整的 Extraction V2 流程
 *
 * @description
 *   整合執行新提取架構的完整流程：
 *   1. Azure DI prebuilt-document 提取
 *   2. 數據精選
 *   3. 品質分析
 *   4. GPT-mini 欄位提取
 *
 * @param fileBuffer - 文件 Buffer
 * @param fileName - 文件名
 * @param config - 配置選項
 * @returns 完整的提取結果
 *
 * @example
 * ```typescript
 * const result = await runExtractionV2Pipeline(buffer, 'invoice.pdf', {
 *   fields: [
 *     { name: 'invoiceNumber', aliases: ['Invoice No'] },
 *     { name: 'totalAmount', type: 'currency' },
 *   ],
 * });
 *
 * if (result.success) {
 *   console.log('Extracted fields:', result.gptResult.fields);
 * }
 * ```
 */
export async function runExtractionV2Pipeline(
  fileBuffer: Buffer,
  fileName: string,
  config: ExtractionV2Config = {}
): Promise<ExtractionV2Result> {
  const startTime = Date.now();

  try {
    // Step 1: Azure DI prebuilt-document 提取
    console.log(`[ExtractionV2] Step 1: Azure DI extraction for ${fileName}`);
    const azureDIResult = await extractWithPrebuiltDocument(fileBuffer, fileName);

    if (!azureDIResult.success) {
      return {
        success: false,
        azureDIResult,
        selectedData: {
          markdown: '',
          tokenEstimate: 0,
          keyValuePairsCount: 0,
          tablesCount: 0,
          truncated: false,
          originalStats: { keyValuePairsCount: 0, tablesCount: 0, contentLength: 0 },
        },
        qualityAnalysis: {
          overallQuality: 'low',
          keyValuePairsQuality: 'low',
          hasUsefulTables: false,
          avgConfidence: 0,
          recommendations: ['Azure DI extraction failed'],
        },
        gptResult: {
          success: false,
          fields: {},
          tokensUsed: { input: 0, output: 0, total: 0 },
          processingTimeMs: 0,
          modelUsed: 'none',
          error: azureDIResult.error,
        },
        totalProcessingTimeMs: Date.now() - startTime,
        error: azureDIResult.error,
      };
    }

    // Step 2: 數據精選
    console.log('[ExtractionV2] Step 2: Data selection');
    const selectedData = selectDataForGpt(azureDIResult, config.dataSelectorConfig);

    // Step 3: 品質分析
    console.log('[ExtractionV2] Step 3: Quality analysis');
    const qualityAnalysis = analyzeResultQuality(azureDIResult);

    // Step 4: GPT-mini 欄位提取
    console.log('[ExtractionV2] Step 4: GPT-mini extraction');
    const fields = config.fields ?? convertPromptConfigFields(null);
    const gptResult = await extractFieldsWithGptMini(
      selectedData,
      fields,
      config.gptConfig
    );

    const totalProcessingTimeMs = Date.now() - startTime;

    console.log(
      `[ExtractionV2] Pipeline completed in ${totalProcessingTimeMs}ms. ` +
        `Quality: ${qualityAnalysis.overallQuality}, ` +
        `Fields extracted: ${Object.keys(gptResult.fields).length}`
    );

    return {
      success: true,
      azureDIResult,
      selectedData,
      qualityAnalysis,
      gptResult,
      totalProcessingTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ExtractionV2] Pipeline error: ${errorMessage}`);

    return {
      success: false,
      azureDIResult: {
        success: false,
        confidence: 0,
        keyValuePairs: [],
        tables: [],
        content: '',
        pageCount: 0,
        processingTimeMs: 0,
        error: errorMessage,
      },
      selectedData: {
        markdown: '',
        tokenEstimate: 0,
        keyValuePairsCount: 0,
        tablesCount: 0,
        truncated: false,
        originalStats: { keyValuePairsCount: 0, tablesCount: 0, contentLength: 0 },
      },
      qualityAnalysis: {
        overallQuality: 'low',
        keyValuePairsQuality: 'low',
        hasUsefulTables: false,
        avgConfidence: 0,
        recommendations: ['Pipeline error occurred'],
      },
      gptResult: {
        success: false,
        fields: {},
        tokensUsed: { input: 0, output: 0, total: 0 },
        processingTimeMs: 0,
        modelUsed: 'none',
        error: errorMessage,
      },
      totalProcessingTimeMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}
