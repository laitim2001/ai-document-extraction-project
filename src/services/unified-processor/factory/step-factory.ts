/**
 * @fileoverview 步驟處理器工廠
 * @description
 *   負責創建和管理 11 個處理步驟的處理器實例：
 *   - 根據步驟類型創建對應處理器
 *   - 維護處理器的執行順序
 *   - 支援 Feature Flag 控制
 *
 * @module src/services/unified-processor/factory
 * @since Epic 15 - Story 15.1 (處理流程重構 - 統一入口)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 步驟處理器工廠模式
 *   - 按順序創建所有處理器
 *   - 步驟配置注入
 *
 * @related
 *   - src/services/unified-processor/interfaces/step-handler.interface.ts - 介面定義
 *   - src/services/unified-processor/steps/ - 步驟實現
 */

import { ProcessingStep } from '@/types/unified-processor';
import {
  DEFAULT_STEP_CONFIGS,
  PROCESSING_STEP_ORDER,
  getStepConfig,
} from '@/constants/processing-steps';
import {
  IStepHandler,
  IStepHandlerFactory,
} from '../interfaces/step-handler.interface';

// 步驟處理器導入
import { FileTypeDetectionStep } from '../steps/file-type-detection.step';
import { SmartRoutingStep } from '../steps/smart-routing.step';
import { AzureDiExtractionStep } from '../steps/azure-di-extraction.step';
import { IssuerIdentificationStep } from '../steps/issuer-identification.step';
import { FormatMatchingStep } from '../steps/format-matching.step';
import { ConfigFetchingStep } from '../steps/config-fetching.step';
import { GptEnhancedExtractionStep } from '../steps/gpt-enhanced-extraction.step';
import { FieldMappingStep } from '../steps/field-mapping.step';
import { TermRecordingStep } from '../steps/term-recording.step';
import { ConfidenceCalculationStep } from '../steps/confidence-calculation.step';
import { RoutingDecisionStep } from '../steps/routing-decision.step';

// ============================================================================
// Step Handler Factory
// ============================================================================

/**
 * 步驟處理器工廠實現
 * @description 創建和管理所有處理步驟的處理器
 */
export class StepHandlerFactory implements IStepHandlerFactory {
  /** 處理器快取 */
  private handlerCache: Map<ProcessingStep, IStepHandler> = new Map();

  /**
   * 創建指定步驟的處理器
   * @param step - 步驟類型
   * @returns 步驟處理器實例
   */
  createHandler(step: ProcessingStep): IStepHandler {
    // 檢查快取
    const cached = this.handlerCache.get(step);
    if (cached) {
      return cached;
    }

    // 創建新處理器
    const config = getStepConfig(step);
    if (!config) {
      throw new Error(`Unknown processing step: ${step}`);
    }

    const handler = this.instantiateHandler(step, config);
    this.handlerCache.set(step, handler);

    return handler;
  }

  /**
   * 創建所有步驟處理器（按順序）
   * @returns 按執行順序排列的處理器列表
   */
  createAllHandlers(): IStepHandler[] {
    return PROCESSING_STEP_ORDER.map((step) => this.createHandler(step));
  }

  /**
   * 實例化處理器
   * @param step - 步驟類型
   * @param config - 步驟配置
   * @returns 處理器實例
   */
  private instantiateHandler(
    step: ProcessingStep,
    config: typeof DEFAULT_STEP_CONFIGS[number]
  ): IStepHandler {
    switch (step) {
      case ProcessingStep.FILE_TYPE_DETECTION:
        return new FileTypeDetectionStep(config);

      case ProcessingStep.SMART_ROUTING:
        return new SmartRoutingStep(config);

      case ProcessingStep.AZURE_DI_EXTRACTION:
        return new AzureDiExtractionStep(config);

      case ProcessingStep.ISSUER_IDENTIFICATION:
        return new IssuerIdentificationStep(config);

      case ProcessingStep.FORMAT_MATCHING:
        return new FormatMatchingStep(config);

      case ProcessingStep.CONFIG_FETCHING:
        return new ConfigFetchingStep(config);

      case ProcessingStep.GPT_ENHANCED_EXTRACTION:
        return new GptEnhancedExtractionStep(config);

      case ProcessingStep.FIELD_MAPPING:
        return new FieldMappingStep(config);

      case ProcessingStep.TERM_RECORDING:
        return new TermRecordingStep(config);

      case ProcessingStep.CONFIDENCE_CALCULATION:
        return new ConfidenceCalculationStep(config);

      case ProcessingStep.ROUTING_DECISION:
        return new RoutingDecisionStep(config);

      default:
        throw new Error(`No handler implementation for step: ${step}`);
    }
  }

  /**
   * 清除處理器快取
   */
  clearCache(): void {
    this.handlerCache.clear();
  }

  /**
   * 取得已快取的處理器數量
   */
  getCacheSize(): number {
    return this.handlerCache.size;
  }
}

// ============================================================================
// Factory Singleton
// ============================================================================

let factoryInstance: StepHandlerFactory | null = null;

/**
 * 取得步驟處理器工廠單例
 */
export function getStepHandlerFactory(): StepHandlerFactory {
  if (!factoryInstance) {
    factoryInstance = new StepHandlerFactory();
  }
  return factoryInstance;
}

/**
 * 重置工廠單例（用於測試）
 */
export function resetStepHandlerFactory(): void {
  if (factoryInstance) {
    factoryInstance.clearCache();
  }
  factoryInstance = null;
}
