# Story 15-1: 處理流程重構 - 統一入口

> **Epic**: Epic 15 - 統一 3 層機制到日常處理流程
> **Story Points**: 5
> **Priority**: High
> **Status**: 📋 Backlog

---

## 📋 Story 概述

### User Story

```
作為系統，
我希望有一個統一的文件處理入口，
以便所有文件（歷史批次或日常上傳）都能享受相同的智能識別和分類功能。
```

### 驗收標準 (Acceptance Criteria)

1. **AC1**: 建立 `UnifiedDocumentProcessor` 統一處理服務
2. **AC2**: 實現 Pipeline 架構，支援多個處理步驟
3. **AC3**: 支援功能開關，可逐步啟用各項功能
4. **AC4**: 保留原有處理流程作為降級方案
5. **AC5**: 處理單一文件的總延遲增加 < 500ms

---

## 🏗️ 技術設計

### 架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                  UnifiedDocumentProcessor                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ProcessingContext                                               │
│  ├── fileId                                                      │
│  ├── batchId?                                                    │
│  ├── fileType (NATIVE_PDF | SCANNED_PDF | IMAGE)                │
│  ├── processingMethod (DUAL_PROCESSING | GPT_VISION)            │
│  ├── identifiedCompanyId?                                        │
│  ├── documentFormatId?                                           │
│  ├── extractionResult                                            │
│  ├── mappedData                                                  │
│  ├── newTerms[]                                                  │
│  └── overallConfidence                                           │
│                                                                  │
│  Pipeline Steps:                                                 │
│  ┌────────────────────┐                                          │
│  │ 1. FileTypeDetection │ ← 第 1 層                              │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 2. ProcessingRouter │                                         │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 3. AzureDIExtraction│                                         │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 4. IssuerIdentify   │ ← 第 2 層（Epic 15-2）                  │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 5. FormatMatching   │ ← 第 2 層（Epic 15-3）                  │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 6. ConfigResolution │ ← Epic 13/14 配置                       │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 7. GPTEnhanced      │                                         │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 8. FieldMapping     │                                         │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 9. TermRecording    │ ← 第 3 層（Epic 15-4）                  │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 10. ConfidenceCalc  │ ← Epic 15-5                             │
│  └─────────┬──────────┘                                          │
│            ↓                                                     │
│  ┌────────────────────┐                                          │
│  │ 11. RoutingDecision │                                         │
│  └────────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 核心類型定義

```typescript
// src/types/unified-processor.ts

/**
 * @fileoverview 統一處理器類型定義
 * @module src/types/unified-processor
 * @since Epic 15 - Story 15.1
 */

import type { ProcessingMethod, BatchFileStatus } from '@prisma/client';

// === 文件類型 ===

export const FileType = {
  NATIVE_PDF: 'NATIVE_PDF',
  SCANNED_PDF: 'SCANNED_PDF',
  IMAGE: 'IMAGE',
} as const;

export type FileType = (typeof FileType)[keyof typeof FileType];

// === 路由決策 ===

export const RoutingDecision = {
  AUTO_APPROVE: 'AUTO_APPROVE',
  QUICK_REVIEW: 'QUICK_REVIEW',
  FULL_REVIEW: 'FULL_REVIEW',
} as const;

export type RoutingDecision = (typeof RoutingDecision)[keyof typeof RoutingDecision];

// === 處理上下文 ===

/**
 * 文件處理上下文
 * @description 在整個處理 Pipeline 中傳遞的上下文物件
 */
export interface ProcessingContext {
  // === 基本資訊 ===

  /** 文件 ID */
  fileId: string;

  /** 批次 ID（可選，批次處理時提供） */
  batchId?: string;

  /** 原始文件路徑 */
  filePath: string;

  /** 文件名稱 */
  fileName: string;

  // === 第 1 層：文件類型 ===

  /** 檢測到的文件類型 */
  fileType?: FileType;

  /** 決定的處理方法 */
  processingMethod?: ProcessingMethod;

  // === 第 2 層：發行者/格式識別 ===

  /** 識別到的公司 ID */
  identifiedCompanyId?: string;

  /** 發行者識別信心度 */
  issuerConfidence?: number;

  /** 發行者識別方法 */
  issuerIdentificationMethod?: 'LOGO' | 'HEADER' | 'CONTENT';

  /** 匹配到的文件格式 ID */
  documentFormatId?: string;

  /** 格式匹配信心度 */
  formatConfidence?: number;

  // === 動態配置 ===

  /** 欄位映射配置 ID */
  fieldMappingConfigId?: string;

  /** Prompt 配置 ID */
  promptConfigId?: string;

  // === 提取結果 ===

  /** Azure DI 提取結果 */
  azureDIResult?: {
    invoiceData: Record<string, unknown>;
    lineItems: Array<Record<string, unknown>>;
    confidence: number;
  };

  /** GPT Vision 提取/增強結果 */
  gptVisionResult?: {
    classification?: {
      documentIssuer?: string;
      documentFormat?: string;
    };
    enhancement?: Record<string, unknown>;
    confidence: number;
  };

  /** 映射後的數據 */
  mappedData?: Record<string, unknown>;

  // === 第 3 層：術語 ===

  /** 提取到的術語 */
  extractedTerms?: string[];

  /** 新發現的術語（不在現有術語庫中） */
  newTerms?: string[];

  // === 信心度與路由 ===

  /** 綜合信心度 */
  overallConfidence?: number;

  /** 路由決策 */
  routingDecision?: RoutingDecision;

  // === 處理狀態 ===

  /** 處理開始時間 */
  startTime: Date;

  /** 各步驟耗時（毫秒） */
  stepTimings: Record<string, number>;

  /** 處理過程中的錯誤 */
  errors: ProcessingError[];

  /** 處理過程中的警告 */
  warnings: string[];
}

/**
 * 處理錯誤
 */
export interface ProcessingError {
  step: string;
  message: string;
  code?: string;
  recoverable: boolean;
  timestamp: Date;
}

// === 處理步驟 ===

/**
 * 處理步驟接口
 */
export interface ProcessingStep {
  /** 步驟名稱 */
  name: string;

  /** 是否為可選步驟（可選步驟失敗不會中斷處理） */
  isOptional: boolean;

  /** 步驟依賴的功能開關 */
  featureFlag?: string;

  /** 執行步驟 */
  execute(context: ProcessingContext): Promise<void>;

  /** 步驟是否應該執行（可根據上下文決定跳過） */
  shouldExecute?(context: ProcessingContext): boolean;
}

// === 處理結果 ===

/**
 * 處理結果
 */
export interface ProcessingResult {
  success: boolean;
  fileId: string;

  // 識別結果
  companyId?: string;
  documentFormatId?: string;

  // 提取數據
  extractedData: Record<string, unknown>;
  lineItems: Array<Record<string, unknown>>;

  // 信心度與路由
  confidence: number;
  routingDecision: RoutingDecision;

  // 新術語
  newTerms: string[];

  // 處理統計
  processingTime: number;
  stepTimings: Record<string, number>;

  // 錯誤和警告
  errors: ProcessingError[];
  warnings: string[];
}
```

### 功能開關系統

```typescript
// src/lib/feature-flags.ts

/**
 * @fileoverview 功能開關配置
 * @module src/lib/feature-flags
 * @since Epic 15 - Story 15.1
 */

/**
 * 功能開關配置
 * @description 用於漸進式啟用統一處理器的各項功能
 */
export const FEATURE_FLAGS = {
  // === 統一處理器 ===

  /** 啟用統一處理器（總開關） */
  ENABLE_UNIFIED_PROCESSOR:
    process.env.ENABLE_UNIFIED_PROCESSOR === 'true',

  // === 各步驟開關 ===

  /** 啟用發行者識別（第 2 層） */
  ENABLE_ISSUER_IDENTIFICATION:
    process.env.ENABLE_ISSUER_IDENTIFICATION !== 'false',

  /** 啟用格式匹配（第 2 層） */
  ENABLE_FORMAT_MATCHING:
    process.env.ENABLE_FORMAT_MATCHING !== 'false',

  /** 啟用動態配置（Epic 13/14） */
  ENABLE_DYNAMIC_CONFIG:
    process.env.ENABLE_DYNAMIC_CONFIG !== 'false',

  /** 啟用術語學習（第 3 層） */
  ENABLE_TERM_LEARNING:
    process.env.ENABLE_TERM_LEARNING !== 'false',

  /** 啟用增強信心度計算 */
  ENABLE_ENHANCED_CONFIDENCE:
    process.env.ENABLE_ENHANCED_CONFIDENCE !== 'false',

  // === 降級選項 ===

  /** 失敗時是否降級到原有處理流程 */
  FALLBACK_TO_LEGACY:
    process.env.FALLBACK_TO_LEGACY !== 'false',

  // === 調試選項 ===

  /** 記錄詳細處理日誌 */
  VERBOSE_PROCESSING_LOGS:
    process.env.VERBOSE_PROCESSING_LOGS === 'true',
} as const;

/**
 * 檢查功能開關
 */
export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * 獲取所有功能開關狀態
 */
export function getFeatureFlags(): Record<string, boolean> {
  return { ...FEATURE_FLAGS };
}
```

### 統一處理器實現

```typescript
// src/services/unified-document-processor.service.ts

/**
 * @fileoverview 統一文件處理服務
 * @description
 *   整合所有文件處理步驟的統一入口
 *   實現 Pipeline 架構，支援功能開關和降級處理
 *
 * @module src/services/unified-document-processor
 * @since Epic 15 - Story 15.1
 */

import { prisma } from '@/lib/prisma';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags';
import type {
  ProcessingContext,
  ProcessingStep,
  ProcessingResult,
  ProcessingError,
} from '@/types/unified-processor';

// 導入處理步驟（將在後續 Story 實現）
import { FileTypeDetectionStep } from './steps/file-type-detection.step';
import { ProcessingRouterStep } from './steps/processing-router.step';
import { AzureDIExtractionStep } from './steps/azure-di-extraction.step';
import { IssuerIdentificationStep } from './steps/issuer-identification.step';
import { FormatMatchingStep } from './steps/format-matching.step';
import { ConfigResolutionStep } from './steps/config-resolution.step';
import { GPTEnhancedExtractionStep } from './steps/gpt-enhanced-extraction.step';
import { FieldMappingStep } from './steps/field-mapping.step';
import { TermRecordingStep } from './steps/term-recording.step';
import { ConfidenceCalculationStep } from './steps/confidence-calculation.step';
import { RoutingDecisionStep } from './steps/routing-decision.step';

/**
 * 統一文件處理器
 */
export class UnifiedDocumentProcessor {
  private pipeline: ProcessingStep[];

  constructor() {
    this.pipeline = this.buildPipeline();
  }

  /**
   * 建構處理 Pipeline
   */
  private buildPipeline(): ProcessingStep[] {
    return [
      // 第 1 層：文件類型檢測
      new FileTypeDetectionStep(),
      new ProcessingRouterStep(),

      // 基礎提取
      new AzureDIExtractionStep(),

      // 第 2 層：發行者/格式識別
      new IssuerIdentificationStep(),
      new FormatMatchingStep(),

      // 動態配置
      new ConfigResolutionStep(),

      // GPT 增強
      new GPTEnhancedExtractionStep(),

      // 欄位映射
      new FieldMappingStep(),

      // 第 3 層：術語記錄
      new TermRecordingStep(),

      // 信心度與路由
      new ConfidenceCalculationStep(),
      new RoutingDecisionStep(),
    ];
  }

  /**
   * 處理單一文件
   */
  async process(
    fileId: string,
    options?: {
      batchId?: string;
      skipSteps?: string[];
    }
  ): Promise<ProcessingResult> {
    // 檢查統一處理器是否啟用
    if (!isFeatureEnabled('ENABLE_UNIFIED_PROCESSOR')) {
      return this.legacyProcess(fileId, options?.batchId);
    }

    // 獲取文件資訊
    const file = await this.getFileInfo(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // 初始化處理上下文
    const context: ProcessingContext = {
      fileId,
      batchId: options?.batchId,
      filePath: file.storagePath,
      fileName: file.fileName,
      startTime: new Date(),
      stepTimings: {},
      errors: [],
      warnings: [],
    };

    // 執行 Pipeline
    for (const step of this.pipeline) {
      // 檢查是否跳過此步驟
      if (options?.skipSteps?.includes(step.name)) {
        this.log(context, `Skipping step: ${step.name} (requested)`);
        continue;
      }

      // 檢查功能開關
      if (step.featureFlag && !isFeatureEnabled(step.featureFlag as any)) {
        this.log(context, `Skipping step: ${step.name} (feature disabled)`);
        continue;
      }

      // 檢查步驟是否應該執行
      if (step.shouldExecute && !step.shouldExecute(context)) {
        this.log(context, `Skipping step: ${step.name} (condition not met)`);
        continue;
      }

      // 執行步驟
      try {
        const stepStart = Date.now();
        await step.execute(context);
        context.stepTimings[step.name] = Date.now() - stepStart;

        this.log(
          context,
          `Step completed: ${step.name} (${context.stepTimings[step.name]}ms)`
        );
      } catch (error) {
        const processingError: ProcessingError = {
          step: step.name,
          message: error instanceof Error ? error.message : String(error),
          recoverable: step.isOptional,
          timestamp: new Date(),
        };

        context.errors.push(processingError);

        if (!step.isOptional) {
          // 非可選步驟失敗，嘗試降級
          if (isFeatureEnabled('FALLBACK_TO_LEGACY')) {
            this.log(
              context,
              `Critical step failed: ${step.name}, falling back to legacy`
            );
            return this.legacyProcess(fileId, options?.batchId);
          }

          // 無法降級，拋出錯誤
          throw error;
        }

        this.log(
          context,
          `Optional step failed: ${step.name}, continuing...`
        );
      }
    }

    // 建構結果
    return this.buildResult(context);
  }

  /**
   * 批次處理多個文件
   */
  async processBatch(
    fileIds: string[],
    batchId: string,
    options?: {
      concurrency?: number;
      skipSteps?: string[];
    }
  ): Promise<ProcessingResult[]> {
    const concurrency = options?.concurrency ?? 5;
    const results: ProcessingResult[] = [];

    // 分批處理
    for (let i = 0; i < fileIds.length; i += concurrency) {
      const batch = fileIds.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((fileId) =>
          this.process(fileId, {
            batchId,
            skipSteps: options?.skipSteps,
          }).catch((error) => ({
            success: false,
            fileId,
            extractedData: {},
            lineItems: [],
            confidence: 0,
            routingDecision: 'FULL_REVIEW' as const,
            newTerms: [],
            processingTime: 0,
            stepTimings: {},
            errors: [
              {
                step: 'process',
                message: error.message,
                recoverable: false,
                timestamp: new Date(),
              },
            ],
            warnings: [],
          }))
        )
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 獲取文件資訊
   */
  private async getFileInfo(fileId: string) {
    return prisma.batchFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        mimeType: true,
      },
    });
  }

  /**
   * 降級到原有處理流程
   */
  private async legacyProcess(
    fileId: string,
    batchId?: string
  ): Promise<ProcessingResult> {
    // 調用原有的 batch-processor 邏輯
    // 這裡將在整合時實現
    throw new Error('Legacy process not implemented');
  }

  /**
   * 建構處理結果
   */
  private buildResult(context: ProcessingContext): ProcessingResult {
    const processingTime = Date.now() - context.startTime.getTime();

    return {
      success: context.errors.filter((e) => !e.recoverable).length === 0,
      fileId: context.fileId,
      companyId: context.identifiedCompanyId,
      documentFormatId: context.documentFormatId,
      extractedData: context.mappedData ?? {},
      lineItems: (context.azureDIResult?.lineItems ?? []) as Array<
        Record<string, unknown>
      >,
      confidence: context.overallConfidence ?? 0,
      routingDecision: context.routingDecision ?? 'FULL_REVIEW',
      newTerms: context.newTerms ?? [],
      processingTime,
      stepTimings: context.stepTimings,
      errors: context.errors,
      warnings: context.warnings,
    };
  }

  /**
   * 記錄處理日誌
   */
  private log(context: ProcessingContext, message: string): void {
    if (isFeatureEnabled('VERBOSE_PROCESSING_LOGS')) {
      console.log(`[UnifiedProcessor:${context.fileId}] ${message}`);
    }
  }
}

// 導出單例
export const unifiedDocumentProcessor = new UnifiedDocumentProcessor();
```

### 基礎處理步驟

```typescript
// src/services/steps/base.step.ts

/**
 * @fileoverview 處理步驟基礎類別
 * @module src/services/steps/base
 * @since Epic 15 - Story 15.1
 */

import type {
  ProcessingStep,
  ProcessingContext,
} from '@/types/unified-processor';

/**
 * 處理步驟基礎類別
 */
export abstract class BaseProcessingStep implements ProcessingStep {
  abstract name: string;
  abstract isOptional: boolean;
  featureFlag?: string;

  abstract execute(context: ProcessingContext): Promise<void>;

  shouldExecute?(context: ProcessingContext): boolean;

  /**
   * 記錄步驟日誌
   */
  protected log(context: ProcessingContext, message: string): void {
    console.log(`[${this.name}:${context.fileId}] ${message}`);
  }

  /**
   * 添加警告
   */
  protected addWarning(context: ProcessingContext, warning: string): void {
    context.warnings.push(`[${this.name}] ${warning}`);
  }
}
```

### 文件類型檢測步驟

```typescript
// src/services/steps/file-type-detection.step.ts

/**
 * @fileoverview 文件類型檢測步驟
 * @module src/services/steps/file-type-detection
 * @since Epic 15 - Story 15.1
 */

import { BaseProcessingStep } from './base.step';
import type { ProcessingContext, FileType } from '@/types/unified-processor';
import { fileTypeDetectionService } from '@/services/file-type-detection.service';

/**
 * 文件類型檢測步驟
 * @description 第 1 層機制 - 檢測文件是 Native PDF、Scanned PDF 還是 Image
 */
export class FileTypeDetectionStep extends BaseProcessingStep {
  name = 'FileTypeDetection';
  isOptional = false;

  async execute(context: ProcessingContext): Promise<void> {
    const result = await fileTypeDetectionService.detect(context.filePath);

    context.fileType = result.type as FileType;

    this.log(
      context,
      `Detected file type: ${result.type} (confidence: ${result.confidence})`
    );
  }
}
```

### 處理路由步驟

```typescript
// src/services/steps/processing-router.step.ts

/**
 * @fileoverview 處理路由步驟
 * @module src/services/steps/processing-router
 * @since Epic 15 - Story 15.1
 */

import { ProcessingMethod } from '@prisma/client';
import { BaseProcessingStep } from './base.step';
import type { ProcessingContext, FileType } from '@/types/unified-processor';

/**
 * 處理路由步驟
 * @description 根據文件類型決定處理方法
 */
export class ProcessingRouterStep extends BaseProcessingStep {
  name = 'ProcessingRouter';
  isOptional = false;

  async execute(context: ProcessingContext): Promise<void> {
    if (!context.fileType) {
      throw new Error('File type not detected');
    }

    // 路由邏輯
    switch (context.fileType) {
      case 'NATIVE_PDF':
        // Native PDF 使用雙重處理
        context.processingMethod = ProcessingMethod.DUAL_PROCESSING;
        break;

      case 'SCANNED_PDF':
      case 'IMAGE':
        // 掃描件和圖片使用 GPT Vision
        context.processingMethod = ProcessingMethod.GPT_VISION;
        break;

      default:
        throw new Error(`Unknown file type: ${context.fileType}`);
    }

    this.log(
      context,
      `Routing to: ${context.processingMethod} (based on ${context.fileType})`
    );
  }
}
```

---

## 📁 檔案結構

```
新增/修改檔案:
├── src/
│   ├── types/
│   │   └── unified-processor.ts                   # 類型定義
│   ├── lib/
│   │   └── feature-flags.ts                       # 功能開關
│   └── services/
│       ├── unified-document-processor.service.ts  # 主處理器
│       └── steps/
│           ├── base.step.ts                       # 基礎步驟
│           ├── file-type-detection.step.ts        # 文件類型檢測
│           ├── processing-router.step.ts          # 處理路由
│           ├── azure-di-extraction.step.ts        # Azure DI 提取
│           ├── issuer-identification.step.ts      # 發行者識別（空殼）
│           ├── format-matching.step.ts            # 格式匹配（空殼）
│           ├── config-resolution.step.ts          # 配置解析（空殼）
│           ├── gpt-enhanced-extraction.step.ts    # GPT 增強
│           ├── field-mapping.step.ts              # 欄位映射
│           ├── term-recording.step.ts             # 術語記錄（空殼）
│           ├── confidence-calculation.step.ts     # 信心度計算（空殼）
│           └── routing-decision.step.ts           # 路由決策
```

---

## 🧪 測試案例

### 單元測試

```typescript
// tests/unit/services/unified-document-processor.test.ts

describe('UnifiedDocumentProcessor', () => {
  describe('process', () => {
    it('should process file through pipeline', async () => {
      // Mock 文件資訊
      prismaMock.batchFile.findUnique.mockResolvedValue({
        id: 'file-1',
        fileName: 'invoice.pdf',
        storagePath: '/uploads/invoice.pdf',
        mimeType: 'application/pdf',
      });

      const result = await unifiedDocumentProcessor.process('file-1');

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('file-1');
      expect(result.stepTimings).toHaveProperty('FileTypeDetection');
      expect(result.stepTimings).toHaveProperty('ProcessingRouter');
    });

    it('should skip disabled features', async () => {
      // 禁用發行者識別
      process.env.ENABLE_ISSUER_IDENTIFICATION = 'false';

      const result = await unifiedDocumentProcessor.process('file-1');

      expect(result.stepTimings).not.toHaveProperty('IssuerIdentification');
    });

    it('should fallback to legacy on critical failure', async () => {
      // Mock 文件類型檢測失敗
      jest
        .spyOn(fileTypeDetectionService, 'detect')
        .mockRejectedValue(new Error('Detection failed'));

      // 啟用降級
      process.env.FALLBACK_TO_LEGACY = 'true';

      const result = await unifiedDocumentProcessor.process('file-1');

      // 應該調用 legacy 處理
      expect(result).toBeDefined();
    });

    it('should continue on optional step failure', async () => {
      // Mock 術語記錄失敗（可選步驟）
      jest
        .spyOn(termRecordingService, 'record')
        .mockRejectedValue(new Error('Recording failed'));

      const result = await unifiedDocumentProcessor.process('file-1');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].step).toBe('TermRecording');
      expect(result.errors[0].recoverable).toBe(true);
    });
  });

  describe('processBatch', () => {
    it('should process multiple files with concurrency', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3', 'file-4', 'file-5'];

      const results = await unifiedDocumentProcessor.processBatch(
        fileIds,
        'batch-1',
        { concurrency: 2 }
      );

      expect(results).toHaveLength(5);
    });
  });
});
```

### 整合測試

```typescript
// tests/integration/unified-processor.test.ts

describe('Unified Processor Integration', () => {
  it('should process Native PDF with dual processing', async () => {
    const testFile = await createTestFile('native.pdf', 'application/pdf');

    const result = await unifiedDocumentProcessor.process(testFile.id);

    expect(result.success).toBe(true);
    expect(result.stepTimings['FileTypeDetection']).toBeDefined();
    expect(result.stepTimings['AzureDIExtraction']).toBeDefined();
  });

  it('should process scanned PDF with GPT Vision', async () => {
    const testFile = await createTestFile('scanned.pdf', 'application/pdf');

    const result = await unifiedDocumentProcessor.process(testFile.id);

    expect(result.success).toBe(true);
    expect(result.stepTimings['GPTEnhancedExtraction']).toBeDefined();
  });

  it('should record processing time metrics', async () => {
    const testFile = await createTestFile('test.pdf', 'application/pdf');

    const result = await unifiedDocumentProcessor.process(testFile.id);

    expect(result.processingTime).toBeGreaterThan(0);
    expect(result.processingTime).toBeLessThan(30000); // < 30s
  });
});
```

---

## 📋 實施檢查清單

### 開發階段
- [ ] 建立類型定義（unified-processor.ts）
- [ ] 建立功能開關系統（feature-flags.ts）
- [ ] 實現 UnifiedDocumentProcessor
- [ ] 實現基礎步驟（FileTypeDetection, ProcessingRouter）
- [ ] 建立步驟空殼（供後續 Story 實現）
- [ ] 整合現有服務

### 測試階段
- [ ] 單元測試：Pipeline 流程
- [ ] 單元測試：功能開關
- [ ] 整合測試：端到端處理

### 環境配置
- [ ] 新增環境變數文檔
- [ ] 更新 .env.example

---

## 🔗 相關文檔

- **Epic 概覽**: `claudedocs/1-planning/epics/epic-15/epic-15-overview.md`
- **Story 15-2**: 發行者識別整合
- **Story 15-3**: 格式匹配與動態配置
- **Epic 0 參考**: 3 層機制的基礎實現

---

*Story created: 2026-01-02*
*Last updated: 2026-01-02*
