/**
 * @fileoverview Step 3: 發行者識別
 * @description
 *   識別文件發行者（Document Issuer）並匹配公司：
 *   - 使用 GPT Vision classifyDocument() 進行輕量級分類
 *   - 從 Header 區域識別
 *   - 從 Logo 識別
 *   - AI 推斷識別
 *   - 自動創建公司（如果 autoCreateCompany 啟用）
 *
 *   CHANGE-005: 將發行者識別移至 Azure DI 提取之前（Step 3），
 *   實現「先識別公司 → 再依配置動態提取」的流程。
 *
 *   整合 Epic 0 Story 0.8 的發行者識別功能，
 *   透過 IssuerIdentifierAdapter 適配現有服務。
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 0.8)
 * @lastModified 2026-01-05
 *
 * @changes
 *   - 2026-01-05 (CHANGE-005): 改用 classifyDocument() 進行發行者識別
 *
 * @related
 *   - src/services/gpt-vision.service.ts - classifyDocument() 輕量分類
 *   - src/services/document-issuer.service.ts - 被適配的現有服務
 *   - src/services/unified-processor/adapters/issuer-identifier-adapter.ts - 適配器
 *   - src/types/issuer-identification.ts - 類型定義
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
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
import {
  classifyDocument,
  type ClassificationResult,
} from '@/services/gpt-vision.service';
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
   * @description
   *   CHANGE-005: 不再依賴 Azure DI 提取結果，
   *   改為檢查是否有可用的文件進行 GPT Vision 分類
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

    // CHANGE-005: 檢查是否有文件可供 GPT Vision 分類
    // 不再依賴 extractedData（Azure DI 結果）
    const hasFileBuffer = !!context.input?.fileBuffer;
    const hasFileName = !!context.input?.fileName;

    return hasFileBuffer && hasFileName;
  }

  /**
   * 執行發行者識別
   * @description
   *   CHANGE-005: 使用 GPT Vision classifyDocument() 進行輕量級分類，
   *   而非依賴 Azure DI 提取結果（因為此時 Azure DI 尚未執行）
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();
    let tempFilePath: string | null = null;

    try {
      // CHANGE-005: Step 1 - 將文件 Buffer 保存為臨時文件
      tempFilePath = await this.saveBufferToTempFile(
        context.input.fileBuffer,
        context.input.fileName
      );

      console.log(`[IssuerIdentification] Step 3: Classifying document: ${context.input.fileName}`);

      // CHANGE-005: Step 2 - 調用 GPT Vision classifyDocument() 進行輕量分類
      const classificationResult = await classifyDocument(tempFilePath, {}, {
        companyId: context.companyId,
        documentFormatId: context.documentFormatId,
        documentId: context.input.fileId,
      });

      // CHANGE-005: Step 3 - 從分類結果構建發行者識別輸入
      const extractionResult = this.buildExtractionResultFromClassification(
        classificationResult,
        context
      );

      const options = this.buildIdentificationOptions(flags);

      // CHANGE-005: Step 4 - 調用適配器進行公司匹配
      const issuerResult = await issuerIdentifierAdapter.identifyFromExtraction(
        extractionResult,
        options
      );

      // 更新上下文
      this.updateContextWithResult(context, issuerResult);

      console.log(`[IssuerIdentification] Step 3: Identified issuer: ${issuerResult.issuerName || 'Unknown'} (method: ${issuerResult.identificationMethod || 'N/A'}, confidence: ${issuerResult.confidence})`);

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
          // CHANGE-005: 額外記錄分類結果
          classificationSuccess: classificationResult.success,
          classificationPageCount: classificationResult.pageCount,
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
    } finally {
      // CHANGE-005: 清理臨時文件
      if (tempFilePath) {
        await this.cleanupTempFile(tempFilePath);
      }
    }
  }

  /**
   * 將文件 Buffer 保存為臨時文件
   * @param buffer - 文件 Buffer
   * @param fileName - 原始文件名（用於確定擴展名）
   * @returns 臨時文件路徑
   */
  private async saveBufferToTempFile(
    buffer: Buffer,
    fileName: string
  ): Promise<string> {
    const ext = path.extname(fileName) || '.pdf';
    const tempDir = os.tmpdir();
    const tempFileName = `issuer-id-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    await fs.writeFile(tempFilePath, buffer);
    return tempFilePath;
  }

  /**
   * 清理臨時文件
   * @param filePath - 臨時文件路徑
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // 忽略清理失敗（文件可能已被刪除）
      console.warn(`[IssuerIdentification] Failed to cleanup temp file: ${filePath}`);
    }
  }

  /**
   * 從 GPT Vision 分類結果構建發行者識別輸入
   * @description CHANGE-005: 新方法，取代 buildExtractionResultForIssuer
   * @param classificationResult - GPT Vision classifyDocument() 結果
   * @param context - 處理上下文
   * @returns 發行者識別輸入
   */
  private buildExtractionResultFromClassification(
    classificationResult: ClassificationResult,
    context: UnifiedProcessingContext
  ): ExtractionResultForIssuer {
    const issuer = classificationResult.documentIssuer;

    // 從 classifyDocument 結果構建 issuerIdentification
    const issuerIdentification = issuer
      ? {
          name: issuer.name,
          method: this.mapIdentificationMethod(issuer.identificationMethod),
          confidence: issuer.confidence,
          rawText: issuer.rawText,
        }
      : undefined;

    // Logo 偵測：如果識別方法是 LOGO 則為 true
    const logoDetected = issuer?.identificationMethod === 'LOGO';

    return {
      // CHANGE-005: 此時 invoiceData 為空（Azure DI 尚未執行）
      invoiceData: undefined,
      issuerIdentification,
      metadata: {
        documentType: context.fileType,
        logoDetected,
      },
    };
  }

  /**
   * 映射識別方法到 ExtractionResultForIssuer 期望的類型
   */
  private mapIdentificationMethod(
    method?: string
  ): 'LOGO' | 'HEADER' | 'TEXT_MATCH' | 'AI_INFERENCE' | undefined {
    if (!method) return undefined;

    const mapping: Record<string, 'LOGO' | 'HEADER' | 'TEXT_MATCH' | 'AI_INFERENCE'> = {
      LOGO: 'LOGO',
      HEADER: 'HEADER',
      LETTERHEAD: 'HEADER', // 映射 LETTERHEAD 到 HEADER
      FOOTER: 'HEADER', // 映射 FOOTER 到 HEADER
      TEXT_MATCH: 'TEXT_MATCH',
      AI_INFERENCE: 'AI_INFERENCE',
    };

    return mapping[method.toUpperCase()];
  }

  /**
   * @deprecated CHANGE-005: 此方法已被 buildExtractionResultFromClassification 取代
   * 保留用於向後兼容，但不再使用
   *
   * 從處理上下文構建發行者識別輸入（舊版：依賴 Azure DI 結果）
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private buildExtractionResultForIssuer(
    _context: UnifiedProcessingContext
  ): ExtractionResultForIssuer {
    // CHANGE-005: 此方法已棄用，不再使用
    // 現在使用 buildExtractionResultFromClassification 從 GPT Vision 分類結果構建
    throw new Error(
      'buildExtractionResultForIssuer is deprecated. Use buildExtractionResultFromClassification instead.'
    );
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
