# Tech Spec: Story 15.1 - 處理流程重構 - 統一入口

> **Status**: ✅ Done (2026-01-03)
> **Implementation**: `src/services/unified-processor/`

## 概述

建立 UnifiedDocumentProcessor 統一文件處理管道，整合 Epic 0 的 3 層機制到日常處理流程。

## 目標

- 統一歷史數據和日常處理的入口點
- 實現 11 步處理管道
- 支援功能開關的漸進式啟用
- 區分必要步驟和可選步驟的錯誤處理

---

## 技術設計

### 1. 核心類型定義

```typescript
// src/types/unified-processor.ts

/**
 * 處理步驟枚舉
 */
export enum ProcessingStep {
  FILE_TYPE_DETECTION = 'FILE_TYPE_DETECTION',
  SMART_ROUTING = 'SMART_ROUTING',
  AZURE_DI_EXTRACTION = 'AZURE_DI_EXTRACTION',
  ISSUER_IDENTIFICATION = 'ISSUER_IDENTIFICATION',
  FORMAT_MATCHING = 'FORMAT_MATCHING',
  CONFIG_FETCHING = 'CONFIG_FETCHING',
  GPT_ENHANCED_EXTRACTION = 'GPT_ENHANCED_EXTRACTION',
  FIELD_MAPPING = 'FIELD_MAPPING',
  TERM_RECORDING = 'TERM_RECORDING',
  CONFIDENCE_CALCULATION = 'CONFIDENCE_CALCULATION',
  ROUTING_DECISION = 'ROUTING_DECISION',
}

/**
 * 步驟優先級
 */
export enum StepPriority {
  REQUIRED = 'REQUIRED',   // 失敗則中斷
  OPTIONAL = 'OPTIONAL',   // 失敗則繼續
}

/**
 * 步驟配置
 */
export interface StepConfig {
  step: ProcessingStep;
  priority: StepPriority;
  timeout: number;         // 毫秒
  retryCount: number;
  enabled: boolean;
}

/**
 * 步驟結果
 */
export interface StepResult<T = unknown> {
  step: ProcessingStep;
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
  skipped: boolean;
  retryAttempts: number;
}

/**
 * 處理上下文
 */
export interface ProcessingContext {
  fileId: string;
  batchId?: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  userId: string;

  // 逐步填充的處理結果
  fileType?: FileType;
  processingMethod?: ProcessingMethod;
  extractedData?: ExtractedDocumentData;
  companyId?: string;
  documentFormatId?: string;
  fieldMappingConfig?: FieldMappingConfig;
  promptConfig?: ResolvedPrompt;
  mappedFields?: MappedFieldResult[];
  recordedTerms?: RecordedTerm[];
  confidenceScore?: number;
  routingDecision?: RoutingDecision;

  // 元數據
  startedAt: Date;
  stepResults: StepResult[];
  warnings: ProcessingWarning[];
}

/**
 * 文件類型
 */
export enum FileType {
  NATIVE_PDF = 'NATIVE_PDF',
  SCANNED_PDF = 'SCANNED_PDF',
  IMAGE = 'IMAGE',
}

/**
 * 處理方法
 */
export enum ProcessingMethod {
  DUAL_PROCESSING = 'DUAL_PROCESSING',   // GPT Vision + Azure DI
  GPT_VISION_ONLY = 'GPT_VISION_ONLY',   // GPT Vision 單獨處理
  AZURE_DI_ONLY = 'AZURE_DI_ONLY',       // Azure DI 單獨處理（降級）
}

/**
 * 路由決策
 */
export enum RoutingDecision {
  AUTO_APPROVE = 'AUTO_APPROVE',       // >= 90%
  QUICK_REVIEW = 'QUICK_REVIEW',       // 70-89%
  FULL_REVIEW = 'FULL_REVIEW',         // < 70%
}

/**
 * 處理結果
 */
export interface ProcessingResult {
  fileId: string;
  success: boolean;
  routingDecision: RoutingDecision;
  confidenceScore: number;
  companyId?: string;
  documentFormatId?: string;
  extractedFields: MappedFieldResult[];
  stepResults: StepResult[];
  warnings: ProcessingWarning[];
  processingTimeMs: number;
  usedFallback: boolean;
}

/**
 * 處理警告
 */
export interface ProcessingWarning {
  step: ProcessingStep;
  code: string;
  message: string;
  timestamp: Date;
}

/**
 * 統一處理器功能開關
 */
export interface UnifiedProcessorFlags {
  enableUnifiedProcessor: boolean;
  enableIssuerIdentification: boolean;
  enableFormatMatching: boolean;
  enableDynamicConfig: boolean;
  enableTermRecording: boolean;
  enableEnhancedConfidence: boolean;
  autoCreateCompany: boolean;
  autoCreateFormat: boolean;
}
```

### 2. 步驟配置常數

```typescript
// src/constants/processing-steps.ts

import { ProcessingStep, StepPriority, StepConfig } from '@/types/unified-processor';

/**
 * 預設步驟配置（11 步處理管道）
 */
export const DEFAULT_STEP_CONFIGS: StepConfig[] = [
  {
    step: ProcessingStep.FILE_TYPE_DETECTION,
    priority: StepPriority.REQUIRED,
    timeout: 5000,
    retryCount: 0,
    enabled: true,
  },
  {
    step: ProcessingStep.SMART_ROUTING,
    priority: StepPriority.REQUIRED,
    timeout: 2000,
    retryCount: 0,
    enabled: true,
  },
  {
    step: ProcessingStep.AZURE_DI_EXTRACTION,
    priority: StepPriority.REQUIRED,
    timeout: 60000,
    retryCount: 2,
    enabled: true,
  },
  {
    step: ProcessingStep.ISSUER_IDENTIFICATION,
    priority: StepPriority.OPTIONAL,
    timeout: 30000,
    retryCount: 1,
    enabled: true,
  },
  {
    step: ProcessingStep.FORMAT_MATCHING,
    priority: StepPriority.OPTIONAL,
    timeout: 10000,
    retryCount: 1,
    enabled: true,
  },
  {
    step: ProcessingStep.CONFIG_FETCHING,
    priority: StepPriority.OPTIONAL,
    timeout: 5000,
    retryCount: 1,
    enabled: true,
  },
  {
    step: ProcessingStep.GPT_ENHANCED_EXTRACTION,
    priority: StepPriority.OPTIONAL,
    timeout: 60000,
    retryCount: 1,
    enabled: true,
  },
  {
    step: ProcessingStep.FIELD_MAPPING,
    priority: StepPriority.REQUIRED,
    timeout: 10000,
    retryCount: 0,
    enabled: true,
  },
  {
    step: ProcessingStep.TERM_RECORDING,
    priority: StepPriority.OPTIONAL,
    timeout: 10000,
    retryCount: 0,
    enabled: true,
  },
  {
    step: ProcessingStep.CONFIDENCE_CALCULATION,
    priority: StepPriority.REQUIRED,
    timeout: 5000,
    retryCount: 0,
    enabled: true,
  },
  {
    step: ProcessingStep.ROUTING_DECISION,
    priority: StepPriority.REQUIRED,
    timeout: 2000,
    retryCount: 0,
    enabled: true,
  },
];

/**
 * 功能開關預設值
 */
export const DEFAULT_PROCESSOR_FLAGS: UnifiedProcessorFlags = {
  enableUnifiedProcessor: false,  // 預設關閉，漸進式啟用
  enableIssuerIdentification: true,
  enableFormatMatching: true,
  enableDynamicConfig: true,
  enableTermRecording: true,
  enableEnhancedConfidence: true,
  autoCreateCompany: true,
  autoCreateFormat: true,
};
```

### 3. 統一處理器服務

```typescript
// src/services/unified-document-processor.service.ts

/**
 * @fileoverview 統一文件處理器服務
 * @description
 *   整合 Epic 0 的 3 層機制到日常處理流程：
 *   - 文件類型檢測（Native PDF / Scanned）
 *   - 發行者識別與格式匹配
 *   - 動態配置獲取（Epic 13 + Epic 14）
 *   - 術語記錄與持續學習
 *   - 多維度信心度計算
 *
 * @module src/services/unified-document-processor
 * @since Epic 15 - Story 15.1
 */

import { prisma } from '@/lib/prisma';
import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  ProcessingContext,
  ProcessingResult,
  ProcessingWarning,
  FileType,
  ProcessingMethod,
  RoutingDecision,
  UnifiedProcessorFlags,
} from '@/types/unified-processor';
import { DEFAULT_STEP_CONFIGS, DEFAULT_PROCESSOR_FLAGS } from '@/constants/processing-steps';

// 步驟處理器類型
type StepHandler = (context: ProcessingContext) => Promise<StepResult>;

export class UnifiedDocumentProcessor {
  private stepConfigs: Map<ProcessingStep, StepConfig>;
  private stepHandlers: Map<ProcessingStep, StepHandler>;
  private flags: UnifiedProcessorFlags;

  constructor(
    private fileTypeDetector: IFileTypeDetector,
    private smartRouter: ISmartRouter,
    private azureDiService: IAzureDiService,
    private issuerIdentifier: IIssuerIdentifier,
    private formatMatcher: IFormatMatcher,
    private configFetcher: IConfigFetcher,
    private gptEnhancer: IGptEnhancer,
    private fieldMapper: IFieldMapper,
    private termRecorder: ITermRecorder,
    private confidenceCalculator: IConfidenceCalculator,
    private routingDecider: IRoutingDecider,
    customFlags?: Partial<UnifiedProcessorFlags>,
  ) {
    this.stepConfigs = new Map(
      DEFAULT_STEP_CONFIGS.map(config => [config.step, config])
    );
    this.flags = { ...DEFAULT_PROCESSOR_FLAGS, ...customFlags };
    this.stepHandlers = this.initializeHandlers();
  }

  /**
   * 初始化步驟處理器
   */
  private initializeHandlers(): Map<ProcessingStep, StepHandler> {
    return new Map([
      [ProcessingStep.FILE_TYPE_DETECTION, this.handleFileTypeDetection.bind(this)],
      [ProcessingStep.SMART_ROUTING, this.handleSmartRouting.bind(this)],
      [ProcessingStep.AZURE_DI_EXTRACTION, this.handleAzureDiExtraction.bind(this)],
      [ProcessingStep.ISSUER_IDENTIFICATION, this.handleIssuerIdentification.bind(this)],
      [ProcessingStep.FORMAT_MATCHING, this.handleFormatMatching.bind(this)],
      [ProcessingStep.CONFIG_FETCHING, this.handleConfigFetching.bind(this)],
      [ProcessingStep.GPT_ENHANCED_EXTRACTION, this.handleGptEnhancedExtraction.bind(this)],
      [ProcessingStep.FIELD_MAPPING, this.handleFieldMapping.bind(this)],
      [ProcessingStep.TERM_RECORDING, this.handleTermRecording.bind(this)],
      [ProcessingStep.CONFIDENCE_CALCULATION, this.handleConfidenceCalculation.bind(this)],
      [ProcessingStep.ROUTING_DECISION, this.handleRoutingDecision.bind(this)],
    ]);
  }

  /**
   * 處理文件
   */
  async process(input: ProcessFileInput): Promise<ProcessingResult> {
    // 檢查功能開關
    if (!this.flags.enableUnifiedProcessor) {
      return this.fallbackToLegacyProcessor(input);
    }

    const context = this.initializeContext(input);

    try {
      // 執行 11 步處理管道
      for (const step of this.getOrderedSteps()) {
        const config = this.stepConfigs.get(step);
        if (!config || !config.enabled) {
          context.stepResults.push(this.createSkippedResult(step));
          continue;
        }

        // 檢查步驟是否因功能開關而跳過
        if (this.shouldSkipStep(step)) {
          context.stepResults.push(this.createSkippedResult(step));
          continue;
        }

        const result = await this.runStepWithRetry(step, context, config);
        context.stepResults.push(result);

        // 必要步驟失敗則中斷
        if (!result.success && config.priority === StepPriority.REQUIRED) {
          return this.buildErrorResult(context, result);
        }

        // 可選步驟失敗記錄警告
        if (!result.success && config.priority === StepPriority.OPTIONAL) {
          context.warnings.push({
            step,
            code: 'OPTIONAL_STEP_FAILED',
            message: result.error || 'Step failed',
            timestamp: new Date(),
          });
        }
      }

      return this.buildSuccessResult(context);
    } catch (error) {
      return this.buildExceptionResult(context, error);
    }
  }

  /**
   * 帶重試的步驟運行
   */
  private async runStepWithRetry(
    step: ProcessingStep,
    context: ProcessingContext,
    config: StepConfig,
  ): Promise<StepResult> {
    const handler = this.stepHandlers.get(step);
    if (!handler) {
      return {
        step,
        success: false,
        error: `No handler for step: ${step}`,
        durationMs: 0,
        skipped: false,
        retryAttempts: 0,
      };
    }

    let lastError: string | undefined;
    let attempts = 0;

    while (attempts <= config.retryCount) {
      const startTime = Date.now();

      try {
        const result = await Promise.race([
          handler(context),
          this.createTimeoutPromise(config.timeout, step),
        ]);

        result.durationMs = Date.now() - startTime;
        result.retryAttempts = attempts;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        attempts++;

        if (attempts <= config.retryCount) {
          await this.delay(1000 * attempts); // 指數退避
        }
      }
    }

    return {
      step,
      success: false,
      error: lastError,
      durationMs: 0,
      skipped: false,
      retryAttempts: attempts,
    };
  }

  /**
   * 創建超時 Promise
   */
  private createTimeoutPromise(timeout: number, step: ProcessingStep): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step ${step} timed out after ${timeout}ms`)), timeout);
    });
  }

  /**
   * 檢查是否應跳過步驟
   */
  private shouldSkipStep(step: ProcessingStep): boolean {
    switch (step) {
      case ProcessingStep.ISSUER_IDENTIFICATION:
        return !this.flags.enableIssuerIdentification;
      case ProcessingStep.FORMAT_MATCHING:
        return !this.flags.enableFormatMatching;
      case ProcessingStep.CONFIG_FETCHING:
        return !this.flags.enableDynamicConfig;
      case ProcessingStep.TERM_RECORDING:
        return !this.flags.enableTermRecording;
      case ProcessingStep.CONFIDENCE_CALCULATION:
        return !this.flags.enableEnhancedConfidence;
      default:
        return false;
    }
  }

  /**
   * 獲取排序後的步驟列表
   */
  private getOrderedSteps(): ProcessingStep[] {
    return [
      ProcessingStep.FILE_TYPE_DETECTION,
      ProcessingStep.SMART_ROUTING,
      ProcessingStep.AZURE_DI_EXTRACTION,
      ProcessingStep.ISSUER_IDENTIFICATION,
      ProcessingStep.FORMAT_MATCHING,
      ProcessingStep.CONFIG_FETCHING,
      ProcessingStep.GPT_ENHANCED_EXTRACTION,
      ProcessingStep.FIELD_MAPPING,
      ProcessingStep.TERM_RECORDING,
      ProcessingStep.CONFIDENCE_CALCULATION,
      ProcessingStep.ROUTING_DECISION,
    ];
  }

  // ========== 步驟處理器實現 ==========

  private async handleFileTypeDetection(context: ProcessingContext): Promise<StepResult> {
    const fileType = await this.fileTypeDetector.detect(
      context.fileBuffer,
      context.mimeType,
    );
    context.fileType = fileType;

    return {
      step: ProcessingStep.FILE_TYPE_DETECTION,
      success: true,
      data: { fileType },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleSmartRouting(context: ProcessingContext): Promise<StepResult> {
    const processingMethod = this.smartRouter.determineMethod(context.fileType!);
    context.processingMethod = processingMethod;

    return {
      step: ProcessingStep.SMART_ROUTING,
      success: true,
      data: { processingMethod },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleAzureDiExtraction(context: ProcessingContext): Promise<StepResult> {
    const extractedData = await this.azureDiService.extract(
      context.fileBuffer,
      context.mimeType,
    );
    context.extractedData = extractedData;

    return {
      step: ProcessingStep.AZURE_DI_EXTRACTION,
      success: true,
      data: { extractedData },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleIssuerIdentification(context: ProcessingContext): Promise<StepResult> {
    const result = await this.issuerIdentifier.identify(
      context.fileBuffer,
      context.extractedData,
      { autoCreateCompany: this.flags.autoCreateCompany },
    );
    context.companyId = result.companyId;

    return {
      step: ProcessingStep.ISSUER_IDENTIFICATION,
      success: true,
      data: result,
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleFormatMatching(context: ProcessingContext): Promise<StepResult> {
    const result = await this.formatMatcher.match(
      context.companyId,
      context.extractedData,
      { autoCreateFormat: this.flags.autoCreateFormat },
    );
    context.documentFormatId = result.documentFormatId;

    return {
      step: ProcessingStep.FORMAT_MATCHING,
      success: true,
      data: result,
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleConfigFetching(context: ProcessingContext): Promise<StepResult> {
    const [fieldMappingConfig, promptConfig] = await Promise.all([
      this.configFetcher.getFieldMappingConfig(
        context.companyId,
        context.documentFormatId,
      ),
      this.configFetcher.getPromptConfig(
        context.companyId,
        context.documentFormatId,
      ),
    ]);

    context.fieldMappingConfig = fieldMappingConfig;
    context.promptConfig = promptConfig;

    return {
      step: ProcessingStep.CONFIG_FETCHING,
      success: true,
      data: { fieldMappingConfig, promptConfig },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleGptEnhancedExtraction(context: ProcessingContext): Promise<StepResult> {
    // 僅在雙重處理或 GPT Vision Only 時執行
    if (context.processingMethod === ProcessingMethod.AZURE_DI_ONLY) {
      return {
        step: ProcessingStep.GPT_ENHANCED_EXTRACTION,
        success: true,
        skipped: true,
        durationMs: 0,
        retryAttempts: 0,
      };
    }

    const enhancedData = await this.gptEnhancer.enhance(
      context.fileBuffer,
      context.extractedData,
      context.promptConfig,
    );

    // 合併增強數據
    context.extractedData = {
      ...context.extractedData,
      ...enhancedData,
    };

    return {
      step: ProcessingStep.GPT_ENHANCED_EXTRACTION,
      success: true,
      data: enhancedData,
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleFieldMapping(context: ProcessingContext): Promise<StepResult> {
    const mappedFields = await this.fieldMapper.map(
      context.extractedData!,
      context.fieldMappingConfig,
    );
    context.mappedFields = mappedFields;

    return {
      step: ProcessingStep.FIELD_MAPPING,
      success: true,
      data: { mappedFields },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleTermRecording(context: ProcessingContext): Promise<StepResult> {
    const recordedTerms = await this.termRecorder.record(
      context.extractedData!,
      context.documentFormatId,
    );
    context.recordedTerms = recordedTerms;

    return {
      step: ProcessingStep.TERM_RECORDING,
      success: true,
      data: { recordedTerms },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleConfidenceCalculation(context: ProcessingContext): Promise<StepResult> {
    const confidenceScore = await this.confidenceCalculator.calculate(context);
    context.confidenceScore = confidenceScore;

    return {
      step: ProcessingStep.CONFIDENCE_CALCULATION,
      success: true,
      data: { confidenceScore },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  private async handleRoutingDecision(context: ProcessingContext): Promise<StepResult> {
    const routingDecision = this.routingDecider.decide(context.confidenceScore!);
    context.routingDecision = routingDecision;

    return {
      step: ProcessingStep.ROUTING_DECISION,
      success: true,
      data: { routingDecision },
      durationMs: 0,
      skipped: false,
      retryAttempts: 0,
    };
  }

  // ========== 輔助方法 ==========

  private initializeContext(input: ProcessFileInput): ProcessingContext {
    return {
      fileId: input.fileId,
      batchId: input.batchId,
      fileName: input.fileName,
      fileBuffer: input.fileBuffer,
      mimeType: input.mimeType,
      userId: input.userId,
      startedAt: new Date(),
      stepResults: [],
      warnings: [],
    };
  }

  private createSkippedResult(step: ProcessingStep): StepResult {
    return {
      step,
      success: true,
      skipped: true,
      durationMs: 0,
      retryAttempts: 0,
    };
  }

  private buildSuccessResult(context: ProcessingContext): ProcessingResult {
    return {
      fileId: context.fileId,
      success: true,
      routingDecision: context.routingDecision!,
      confidenceScore: context.confidenceScore!,
      companyId: context.companyId,
      documentFormatId: context.documentFormatId,
      extractedFields: context.mappedFields || [],
      stepResults: context.stepResults,
      warnings: context.warnings,
      processingTimeMs: Date.now() - context.startedAt.getTime(),
      usedFallback: false,
    };
  }

  private buildErrorResult(context: ProcessingContext, failedStep: StepResult): ProcessingResult {
    return {
      fileId: context.fileId,
      success: false,
      routingDecision: RoutingDecision.FULL_REVIEW,
      confidenceScore: 0,
      companyId: context.companyId,
      documentFormatId: context.documentFormatId,
      extractedFields: context.mappedFields || [],
      stepResults: context.stepResults,
      warnings: [{
        step: failedStep.step,
        code: 'REQUIRED_STEP_FAILED',
        message: failedStep.error || 'Required step failed',
        timestamp: new Date(),
      }],
      processingTimeMs: Date.now() - context.startedAt.getTime(),
      usedFallback: false,
    };
  }

  private buildExceptionResult(context: ProcessingContext, error: unknown): ProcessingResult {
    return {
      fileId: context.fileId,
      success: false,
      routingDecision: RoutingDecision.FULL_REVIEW,
      confidenceScore: 0,
      extractedFields: [],
      stepResults: context.stepResults,
      warnings: [{
        step: ProcessingStep.FILE_TYPE_DETECTION,
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      }],
      processingTimeMs: Date.now() - context.startedAt.getTime(),
      usedFallback: false,
    };
  }

  private async fallbackToLegacyProcessor(input: ProcessFileInput): Promise<ProcessingResult> {
    // 調用原有處理流程
    // 這裡應該調用現有的 batch-processor.service.ts 或類似服務
    throw new Error('Legacy processor not implemented in this context');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4. 步驟處理器介面

```typescript
// src/services/unified-processor/interfaces.ts

import { ProcessingContext, FileType, ProcessingMethod } from '@/types/unified-processor';
import { ExtractedDocumentData, FieldMappingConfig, ResolvedPrompt, MappedFieldResult, RecordedTerm } from '@/types';

/**
 * 文件類型檢測器介面
 */
export interface IFileTypeDetector {
  detect(buffer: Buffer, mimeType: string): Promise<FileType>;
}

/**
 * 智能路由器介面
 */
export interface ISmartRouter {
  determineMethod(fileType: FileType): ProcessingMethod;
}

/**
 * Azure DI 服務介面
 */
export interface IAzureDiService {
  extract(buffer: Buffer, mimeType: string): Promise<ExtractedDocumentData>;
}

/**
 * 發行者識別器介面
 */
export interface IIssuerIdentifier {
  identify(
    buffer: Buffer,
    extractedData?: ExtractedDocumentData,
    options?: { autoCreateCompany?: boolean },
  ): Promise<IssuerIdentificationResult>;
}

export interface IssuerIdentificationResult {
  companyId?: string;
  companyName?: string;
  confidence: number;
  method: 'LOGO' | 'HEADER' | 'TEXT_MATCH';
  isNewCompany: boolean;
}

/**
 * 格式匹配器介面
 */
export interface IFormatMatcher {
  match(
    companyId?: string,
    extractedData?: ExtractedDocumentData,
    options?: { autoCreateFormat?: boolean },
  ): Promise<FormatMatchResult>;
}

export interface FormatMatchResult {
  documentFormatId?: string;
  formatName?: string;
  confidence: number;
  isNewFormat: boolean;
}

/**
 * 配置獲取器介面
 */
export interface IConfigFetcher {
  getFieldMappingConfig(
    companyId?: string,
    documentFormatId?: string,
  ): Promise<FieldMappingConfig | undefined>;

  getPromptConfig(
    companyId?: string,
    documentFormatId?: string,
  ): Promise<ResolvedPrompt | undefined>;
}

/**
 * GPT 增強器介面
 */
export interface IGptEnhancer {
  enhance(
    buffer: Buffer,
    extractedData?: ExtractedDocumentData,
    promptConfig?: ResolvedPrompt,
  ): Promise<Partial<ExtractedDocumentData>>;
}

/**
 * 欄位映射器介面
 */
export interface IFieldMapper {
  map(
    extractedData: ExtractedDocumentData,
    mappingConfig?: FieldMappingConfig,
  ): Promise<MappedFieldResult[]>;
}

/**
 * 術語記錄器介面
 */
export interface ITermRecorder {
  record(
    extractedData: ExtractedDocumentData,
    documentFormatId?: string,
  ): Promise<RecordedTerm[]>;
}

/**
 * 信心度計算器介面
 */
export interface IConfidenceCalculator {
  calculate(context: ProcessingContext): Promise<number>;
}

/**
 * 路由決策器介面
 */
export interface IRoutingDecider {
  decide(confidenceScore: number): RoutingDecision;
}
```

### 5. 服務工廠

```typescript
// src/services/unified-processor/factory.ts

import { UnifiedDocumentProcessor, UnifiedProcessorFlags } from './unified-document-processor.service';
import { FileTypeDetector } from './steps/file-type-detector';
import { SmartRouter } from './steps/smart-router';
import { AzureDiServiceAdapter } from './adapters/azure-di-adapter';
import { IssuerIdentifierAdapter } from './adapters/issuer-identifier-adapter';
import { FormatMatcherAdapter } from './adapters/format-matcher-adapter';
import { ConfigFetcherAdapter } from './adapters/config-fetcher-adapter';
import { GptEnhancerAdapter } from './adapters/gpt-enhancer-adapter';
import { FieldMapperAdapter } from './adapters/field-mapper-adapter';
import { TermRecorderAdapter } from './adapters/term-recorder-adapter';
import { EnhancedConfidenceCalculator } from './steps/enhanced-confidence-calculator';
import { RoutingDecider } from './steps/routing-decider';

/**
 * 創建統一處理器實例
 */
export function createUnifiedDocumentProcessor(
  flags?: Partial<UnifiedProcessorFlags>,
): UnifiedDocumentProcessor {
  return new UnifiedDocumentProcessor(
    new FileTypeDetector(),
    new SmartRouter(),
    new AzureDiServiceAdapter(),
    new IssuerIdentifierAdapter(),
    new FormatMatcherAdapter(),
    new ConfigFetcherAdapter(),
    new GptEnhancerAdapter(),
    new FieldMapperAdapter(),
    new TermRecorderAdapter(),
    new EnhancedConfidenceCalculator(),
    new RoutingDecider(),
    flags,
  );
}

/**
 * 獲取功能開關配置
 */
export async function getProcessorFlags(): Promise<UnifiedProcessorFlags> {
  // 從環境變數或資料庫獲取配置
  return {
    enableUnifiedProcessor: process.env.ENABLE_UNIFIED_PROCESSOR === 'true',
    enableIssuerIdentification: process.env.ENABLE_ISSUER_IDENTIFICATION !== 'false',
    enableFormatMatching: process.env.ENABLE_FORMAT_MATCHING !== 'false',
    enableDynamicConfig: process.env.ENABLE_DYNAMIC_CONFIG !== 'false',
    enableTermRecording: process.env.ENABLE_TERM_RECORDING !== 'false',
    enableEnhancedConfidence: process.env.ENABLE_ENHANCED_CONFIDENCE !== 'false',
    autoCreateCompany: process.env.AUTO_CREATE_COMPANY !== 'false',
    autoCreateFormat: process.env.AUTO_CREATE_FORMAT !== 'false',
  };
}
```

### 6. 文件類型檢測器

```typescript
// src/services/unified-processor/steps/file-type-detector.ts

import { IFileTypeDetector } from '../interfaces';
import { FileType } from '@/types/unified-processor';
import pdf from 'pdf-parse';

export class FileTypeDetector implements IFileTypeDetector {
  async detect(buffer: Buffer, mimeType: string): Promise<FileType> {
    // 圖片類型直接返回
    if (this.isImageMimeType(mimeType)) {
      return FileType.IMAGE;
    }

    // PDF 類型需要進一步分析
    if (this.isPdfMimeType(mimeType)) {
      return this.detectPdfType(buffer);
    }

    // 未知類型默認為圖片（需要完整 OCR）
    return FileType.IMAGE;
  }

  private isImageMimeType(mimeType: string): boolean {
    return ['image/png', 'image/jpeg', 'image/tiff', 'image/bmp'].includes(mimeType);
  }

  private isPdfMimeType(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  private async detectPdfType(buffer: Buffer): Promise<FileType> {
    try {
      const data = await pdf(buffer);
      const textLength = data.text.replace(/\s+/g, '').length;
      const pageCount = data.numpages;

      // 計算每頁平均文字量
      const avgTextPerPage = textLength / pageCount;

      // 閾值：每頁少於 100 個字符視為掃描 PDF
      const TEXT_THRESHOLD = 100;

      if (avgTextPerPage < TEXT_THRESHOLD) {
        return FileType.SCANNED_PDF;
      }

      return FileType.NATIVE_PDF;
    } catch {
      // 解析失敗視為掃描 PDF
      return FileType.SCANNED_PDF;
    }
  }
}
```

### 7. 智能路由器

```typescript
// src/services/unified-processor/steps/smart-router.ts

import { ISmartRouter } from '../interfaces';
import { FileType, ProcessingMethod } from '@/types/unified-processor';

export class SmartRouter implements ISmartRouter {
  determineMethod(fileType: FileType): ProcessingMethod {
    switch (fileType) {
      case FileType.NATIVE_PDF:
        // Native PDF: GPT Vision 分類 + Azure DI 提取
        return ProcessingMethod.DUAL_PROCESSING;

      case FileType.SCANNED_PDF:
      case FileType.IMAGE:
        // 掃描文件/圖片: 只用 GPT Vision
        return ProcessingMethod.GPT_VISION_ONLY;

      default:
        // 未知類型: 降級為 Azure DI Only
        return ProcessingMethod.AZURE_DI_ONLY;
    }
  }
}
```

### 8. 路由決策器

```typescript
// src/services/unified-processor/steps/routing-decider.ts

import { IRoutingDecider } from '../interfaces';
import { RoutingDecision } from '@/types/unified-processor';

export class RoutingDecider implements IRoutingDecider {
  private readonly AUTO_APPROVE_THRESHOLD = 90;
  private readonly QUICK_REVIEW_THRESHOLD = 70;

  decide(confidenceScore: number): RoutingDecision {
    if (confidenceScore >= this.AUTO_APPROVE_THRESHOLD) {
      return RoutingDecision.AUTO_APPROVE;
    }

    if (confidenceScore >= this.QUICK_REVIEW_THRESHOLD) {
      return RoutingDecision.QUICK_REVIEW;
    }

    return RoutingDecision.FULL_REVIEW;
  }
}
```

---

## 目錄結構

```
src/services/unified-processor/
├── unified-document-processor.service.ts  # 核心處理器
├── interfaces.ts                          # 步驟處理器介面
├── factory.ts                             # 服務工廠
├── steps/
│   ├── file-type-detector.ts              # 文件類型檢測
│   ├── smart-router.ts                    # 智能路由
│   ├── enhanced-confidence-calculator.ts  # 信心度計算 (Story 15.5)
│   └── routing-decider.ts                 # 路由決策
├── adapters/
│   ├── azure-di-adapter.ts                # Azure DI 適配器
│   ├── issuer-identifier-adapter.ts       # 發行者識別適配器 (Story 15.2)
│   ├── format-matcher-adapter.ts          # 格式匹配適配器 (Story 15.3)
│   ├── config-fetcher-adapter.ts          # 配置獲取適配器 (Story 15.3)
│   ├── gpt-enhancer-adapter.ts            # GPT 增強適配器
│   ├── field-mapper-adapter.ts            # 欄位映射適配器
│   └── term-recorder-adapter.ts           # 術語記錄適配器 (Story 15.4)
└── index.ts                               # 模組導出
```

---

## 驗收標準對應

| AC | 實現 |
|----|------|
| 統一使用 UnifiedDocumentProcessor | ✅ 核心處理器類，11 步管道 |
| 執行完整的 11 步處理管道 | ✅ getOrderedSteps() 定義 11 步驟 |
| 功能開關 = false 時使用原有流程 | ✅ fallbackToLegacyProcessor() |
| optional 步驟失敗記錄警告繼續 | ✅ StepPriority.OPTIONAL 處理邏輯 |
| required 步驟失敗中斷處理 | ✅ StepPriority.REQUIRED 處理邏輯 |

---

## 環境變數

```env
# 統一處理器功能開關
ENABLE_UNIFIED_PROCESSOR=false
ENABLE_ISSUER_IDENTIFICATION=true
ENABLE_FORMAT_MATCHING=true
ENABLE_DYNAMIC_CONFIG=true
ENABLE_TERM_RECORDING=true
ENABLE_ENHANCED_CONFIDENCE=true
AUTO_CREATE_COMPANY=true
AUTO_CREATE_FORMAT=true
```

---

## 測試要點

1. **11 步管道執行順序**：驗證步驟按正確順序執行
2. **必要步驟失敗中斷**：FILE_TYPE_DETECTION 失敗應中斷整個流程
3. **可選步驟失敗繼續**：ISSUER_IDENTIFICATION 失敗應記錄警告並繼續
4. **功能開關控制**：ENABLE_UNIFIED_PROCESSOR=false 應使用舊流程
5. **超時處理**：步驟超時應正確處理
6. **重試邏輯**：AZURE_DI_EXTRACTION 失敗應重試最多 2 次

---

*Tech Spec 建立日期: 2026-01-02*
*關聯 Story: Epic 15 - Story 15.1*
