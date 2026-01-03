/**
 * @fileoverview Step 4: 發行者識別
 * @description
 *   識別文件發行者（Document Issuer）並匹配公司：
 *   - 從 Header 區域識別
 *   - 從 Logo 識別
 *   - OCR 文字匹配
 *   - AI 推斷識別
 *   - 自動創建公司（如果 autoCreateCompany 啟用）
 *
 *   整合 Epic 0 Story 0.8 的發行者識別功能，
 *   透過 IssuerIdentifierAdapter 適配現有服務。
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 0.8)
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/document-issuer.service.ts - 被適配的現有服務
 *   - src/services/unified-processor/adapters/issuer-identifier-adapter.ts - 適配器
 *   - src/types/issuer-identification.ts - 類型定義
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import { issuerIdentifierAdapter } from '../adapters/issuer-identifier-adapter';
import type {
  ExtractionResultForIssuer,
  IssuerIdentificationResult,
  IssuerIdentificationOptions,
} from '@/types/issuer-identification';

/**
 * 發行者識別步驟
 * @description 識別文件發行者並匹配/創建公司
 */
export class IssuerIdentificationStep extends BaseStepHandler {
  readonly step = ProcessingStep.ISSUER_IDENTIFICATION;
  readonly priority = StepPriority.OPTIONAL;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    if (!super.shouldExecute(context, flags)) {
      return false;
    }

    // 檢查 Feature Flag
    if (!flags.enableIssuerIdentification) {
      return false;
    }

    // 檢查是否有提取結果可供識別
    const extractionResult = this.buildExtractionResultForIssuer(context);
    return issuerIdentifierAdapter.canIdentify(extractionResult);
  }

  /**
   * 執行發行者識別
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 構建識別請求
      const extractionResult = this.buildExtractionResultForIssuer(context);
      const options = this.buildIdentificationOptions(flags);

      // 調用適配器進行識別
      const issuerResult = await issuerIdentifierAdapter.identifyFromExtraction(
        extractionResult,
        options
      );

      // 更新上下文
      this.updateContextWithResult(context, issuerResult);

      // 返回步驟結果
      return this.createSuccessResult(
        {
          issuerName: issuerResult.issuerName,
          identificationMethod: issuerResult.identificationMethod,
          confidence: issuerResult.confidence,
          matchedCompanyId: issuerResult.matchedCompanyId,
          companyStatus: issuerResult.companyStatus,
          isNewCompany: issuerResult.isNewCompany,
          matchType: issuerResult.matchType,
          matchScore: issuerResult.matchScore,
          processingTimeMs: issuerResult.processingTimeMs,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // OPTIONAL 步驟失敗不中斷流程，但記錄警告
      context.warnings.push({
        step: this.step,
        message: `Issuer identification failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 從處理上下文構建發行者識別輸入
   */
  private buildExtractionResultForIssuer(
    context: UnifiedProcessingContext
  ): ExtractionResultForIssuer {
    // 從上下文中提取已有的 AI 處理結果
    const extractedData = context.extractedData ?? {};

    // 從 documentIssuer 推斷 issuerIdentification 資訊
    const documentIssuer = extractedData.documentIssuer;
    const issuerIdentification = documentIssuer
      ? {
          name: documentIssuer.companyName,
          method: documentIssuer.method,
          confidence: documentIssuer.confidence,
        }
      : undefined;

    // 推斷 Logo 偵測結果
    const logoDetected = documentIssuer?.method === 'LOGO';

    return {
      invoiceData: extractedData.invoiceData as ExtractionResultForIssuer['invoiceData'],
      issuerIdentification,
      metadata: {
        documentType: context.fileType,
        logoDetected,
      },
    };
  }

  /**
   * 從 Flags 構建識別選項
   */
  private buildIdentificationOptions(
    flags: UnifiedProcessorFlags
  ): IssuerIdentificationOptions {
    return {
      autoCreateCompany: flags.autoCreateCompany,
      source: 'unified-processor',
      // 從 flags 中獲取其他選項，使用預設值
      fuzzyThreshold: 0.8,
      minConfidenceThreshold: 0.5,
      skipCompanyMatching: false,
    };
  }

  /**
   * 用識別結果更新處理上下文
   */
  private updateContextWithResult(
    context: UnifiedProcessingContext,
    result: IssuerIdentificationResult
  ): void {
    // 更新公司相關資訊
    if (result.matchedCompanyId) {
      context.companyId = result.matchedCompanyId;
      context.isNewCompany = result.isNewCompany;
    }

    if (result.issuerName) {
      context.companyName = result.issuerName;
    }

    // 轉換識別方法為 ExtractedDocumentData 期望的類型
    // unified-processor.ts 中的 IssuerIdentificationResult 使用字串字面量
    const methodMapping: Record<string, 'LOGO' | 'HEADER' | 'TEXT_MATCH' | undefined> = {
      LOGO: 'LOGO',
      HEADER: 'HEADER',
      TEXT_MATCH: 'TEXT_MATCH',
      AI_INFERENCE: 'TEXT_MATCH', // AI_INFERENCE 映射到 TEXT_MATCH
    };
    const mappedMethod = result.identificationMethod
      ? methodMapping[result.identificationMethod]
      : undefined;

    // 更新提取資料中的發行者識別結果
    // 注意：ExtractedDocumentData.issuerIdentification 使用 unified-processor.ts 的類型
    context.extractedData = {
      ...context.extractedData,
      issuerIdentification: {
        method: mappedMethod,
        companyName: result.issuerName ?? undefined,
        confidence: result.confidence,
        matchedCompanyId: result.matchedCompanyId ?? undefined,
        isNewCompany: result.isNewCompany,
      },
    };
  }
}
