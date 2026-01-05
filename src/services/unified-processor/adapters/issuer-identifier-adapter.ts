/**
 * @fileoverview 發行者識別適配器
 * @description
 *   將現有的 document-issuer.service.ts 適配到統一處理流程：
 *   - 封裝現有服務的調用
 *   - 轉換請求/結果格式
 *   - 提供統一的錯誤處理
 *   - 支援向後兼容
 *
 *   CHANGE-005 修改（2026-01-05）：
 *   修正 convertToLegacyRequest() 欄位映射，將 issuerIdentification 正確映射到
 *   extractDocumentIssuer 期望的 documentIssuer 欄位。
 *
 * @module src/services/unified-processor/adapters
 * @since Epic 15 - Story 15.2
 * @lastModified 2026-01-05
 *
 * @changes
 *   - 2026-01-05 (CHANGE-005): 修正 issuerIdentification → documentIssuer 欄位映射
 *
 * @related
 *   - src/services/document-issuer.service.ts - 被適配的現有服務
 *   - src/types/issuer-identification.ts - 類型定義
 *   - src/services/unified-processor/steps/issuer-identification.step.ts - 使用此適配器
 */

import {
  IssuerIdentificationRequest,
  IssuerIdentificationResult,
  IssuerIdentificationOptions,
  ExtractionResultForIssuer,
  convertLegacyResult,
  DEFAULT_IDENTIFICATION_OPTIONS,
} from '@/types/issuer-identification';

// 導入現有發行者識別服務
import {
  extractDocumentIssuer,
  type IssuerExtractionOptions,
} from '@/services/document-issuer.service';

/**
 * 發行者識別適配器
 * @description 封裝現有 document-issuer.service.ts 提供統一介面
 */
export class IssuerIdentifierAdapter {
  /**
   * 識別文件發行者
   * @param request - 識別請求
   * @returns 識別結果
   */
  async identifyIssuer(
    request: IssuerIdentificationRequest
  ): Promise<IssuerIdentificationResult> {
    const startTime = Date.now();

    try {
      // 合併選項
      const options = this.mergeOptions(request.options);

      // 轉換為 Legacy 請求格式
      const legacyRequest = this.convertToLegacyRequest(request.extractionResult);
      const legacyOptions = this.convertToLegacyOptions(options);

      // 調用現有服務
      const legacyResult = await extractDocumentIssuer(legacyRequest, legacyOptions);

      // 轉換結果
      const processingTimeMs = Date.now() - startTime;
      return convertLegacyResult(legacyResult, processingTimeMs);
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      return this.createErrorResult(error, processingTimeMs);
    }
  }

  /**
   * 從上下文資料識別發行者（簡化版本）
   * @description 用於步驟處理器直接調用
   * @param extractionResult - AI 提取結果
   * @param options - 識別選項
   * @returns 識別結果
   */
  async identifyFromExtraction(
    extractionResult: ExtractionResultForIssuer,
    options?: IssuerIdentificationOptions
  ): Promise<IssuerIdentificationResult> {
    return this.identifyIssuer({
      fileId: 'unknown',
      extractionResult,
      options,
    });
  }

  /**
   * 合併選項與預設值
   */
  private mergeOptions(
    options?: IssuerIdentificationOptions
  ): Required<IssuerIdentificationOptions> {
    return {
      ...DEFAULT_IDENTIFICATION_OPTIONS,
      ...options,
    };
  }

  /**
   * 轉換為 Legacy 請求格式
   * @description 將統一格式轉換為現有服務可接受的格式
   *
   * CHANGE-005 修復：
   *   extractDocumentIssuer 接受的 ExtractionResultWithIssuer 期望 `documentIssuer` 欄位，
   *   而非 `issuerIdentification`。此處進行正確的欄位名稱映射。
   */
  private convertToLegacyRequest(
    extractionResult: ExtractionResultForIssuer
  ): Parameters<typeof extractDocumentIssuer>[0] {
    // CHANGE-005: 將 issuerIdentification 映射到 documentIssuer
    // extractDocumentIssuer 期望的欄位名稱是 documentIssuer，不是 issuerIdentification
    // 注意：documentIssuer.name 是必填欄位，只有當 issuerIdentification.name 存在時才創建物件
    const issuerInfo = extractionResult.issuerIdentification;
    const documentIssuer =
      issuerInfo?.name
        ? {
            name: issuerInfo.name,
            identificationMethod: issuerInfo.method,
            confidence: issuerInfo.confidence,
            rawText: issuerInfo.rawText,
          }
        : undefined;

    return {
      invoiceData: extractionResult.invoiceData ?? {},
      documentIssuer,
      metadata: extractionResult.metadata,
    };
  }

  /**
   * 轉換為 Legacy 選項格式
   */
  private convertToLegacyOptions(
    options: Required<IssuerIdentificationOptions>
  ): IssuerExtractionOptions {
    return {
      createIfNotFound: options.autoCreateCompany,
      source: options.source,
      fuzzyThreshold: options.fuzzyThreshold,
      confidenceThreshold: options.minConfidenceThreshold,
      createdById: options.createdById,
    };
  }

  /**
   * 創建錯誤結果
   */
  private createErrorResult(
    error: unknown,
    processingTimeMs: number
  ): IssuerIdentificationResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during issuer identification';

    return {
      success: false,
      issuerName: null,
      identificationMethod: null,
      confidence: 0,
      matchedCompanyId: null,
      companyStatus: null,
      isNewCompany: false,
      matchType: null,
      matchScore: null,
      error: errorMessage,
      processingTimeMs,
    };
  }

  /**
   * 檢查是否可以執行識別
   * @param extractionResult - 提取結果
   * @returns 是否有足夠資訊進行識別
   */
  canIdentify(extractionResult: ExtractionResultForIssuer): boolean {
    // 檢查是否有發行者識別資訊
    if (extractionResult.issuerIdentification?.name) {
      return true;
    }

    // 檢查是否有供應商資訊
    if (extractionResult.invoiceData?.vendorName) {
      return true;
    }

    return false;
  }

  /**
   * 取得建議的識別方法
   * @param extractionResult - 提取結果
   * @returns 建議使用的識別方法
   */
  getSuggestedMethod(
    extractionResult: ExtractionResultForIssuer
  ): 'LOGO' | 'HEADER' | 'TEXT_MATCH' | 'AI_INFERENCE' | null {
    // 如果有 GPT Vision 的識別結果
    if (extractionResult.issuerIdentification?.method) {
      const method = extractionResult.issuerIdentification.method.toUpperCase();
      if (['LOGO', 'HEADER', 'TEXT_MATCH', 'AI_INFERENCE'].includes(method)) {
        return method as 'LOGO' | 'HEADER' | 'TEXT_MATCH' | 'AI_INFERENCE';
      }
    }

    // 如果偵測到 Logo
    if (extractionResult.metadata?.logoDetected) {
      return 'LOGO';
    }

    // 如果有供應商資訊
    if (extractionResult.invoiceData?.vendorName) {
      return 'TEXT_MATCH';
    }

    // 無法確定
    return null;
  }
}

// 單例導出
export const issuerIdentifierAdapter = new IssuerIdentifierAdapter();
