/**
 * @fileoverview Step 4: 發行者識別
 * @description
 *   識別文件發行者（Document Issuer）：
 *   - 從 Header 區域識別
 *   - 從 Logo 識別
 *   - OCR 文字匹配
 *   - 自動創建公司（如果 autoCreateCompany 啟用）
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 0.8)
 * @lastModified 2026-01-03
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

// 導入現有服務
// import { identifyDocumentIssuer } from '@/services/document-issuer.service';
// import { matchOrCreateCompany } from '@/services/company-auto-create.service';

/**
 * 發行者識別步驟
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
    return flags.enableIssuerIdentification;
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
      // 調用發行者識別服務
      // TODO: 整合現有的 document-issuer.service.ts
      const issuerResult = await this.identifyIssuer(context);

      // 如果啟用自動創建公司
      if (flags.autoCreateCompany && issuerResult.issuerName) {
        const companyResult = await this.matchOrCreateCompany(
          issuerResult.issuerName,
          issuerResult.identificationMethod
        );

        context.companyId = companyResult.companyId;
        context.companyName = companyResult.companyName;
        context.isNewCompany = companyResult.isNewCompany;
      }

      // 更新上下文
      context.extractedData = {
        ...context.extractedData,
        issuerIdentification: issuerResult,
      };

      return this.createSuccessResult(
        {
          issuerName: issuerResult.issuerName,
          identificationMethod: issuerResult.identificationMethod,
          confidence: issuerResult.confidence,
          companyId: context.companyId,
          isNewCompany: context.isNewCompany,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // OPTIONAL 步驟失敗不中斷流程，但記錄警告
      context.warnings.push({
        step: this.step,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 識別文件發行者
   * @description 暫時實現，後續整合現有服務
   */
  private async identifyIssuer(
    context: UnifiedProcessingContext
  ): Promise<{
    issuerName: string | null;
    identificationMethod: 'HEADER' | 'LOGO' | 'OCR' | null;
    confidence: number;
  }> {
    // TODO: 整合現有的 document-issuer.service.ts
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      issuerName: null,
      identificationMethod: null,
      confidence: 0,
    };
  }

  /**
   * 匹配或創建公司
   * @description 暫時實現，後續整合現有服務
   */
  private async matchOrCreateCompany(
    issuerName: string,
    identificationMethod: string | null
  ): Promise<{
    companyId: string;
    companyName: string;
    isNewCompany: boolean;
  }> {
    // TODO: 整合現有的 company-auto-create.service.ts
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      companyId: '',
      companyName: issuerName,
      isNewCompany: false,
    };
  }
}
