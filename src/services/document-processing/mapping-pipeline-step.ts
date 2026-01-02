/**
 * @fileoverview 映射管線步驟
 * @description
 *   將動態欄位映射服務整合到文件處理管線中。
 *   作為管線的一個步驟，接收提取的欄位，返回映射後的結果。
 *
 * @module src/services/document-processing/mapping-pipeline-step
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - 管線步驟抽象實現
 *   - 與 DynamicMappingService 整合
 *   - 支援跳過條件和錯誤處理
 *   - 執行時間追蹤
 *
 * @dependencies
 *   - @/types/field-mapping - 類型定義
 *   - ../mapping/dynamic-mapping.service - 映射服務
 */

import type {
  PipelineStep,
  MappingPipelineInput,
  MappingPipelineOutput,
} from '@/types/field-mapping';
import {
  DynamicMappingService,
  dynamicMappingService,
} from '../mapping/dynamic-mapping.service';

// ============================================================================
// MappingPipelineStep 實現
// ============================================================================

/**
 * 映射管線步驟
 * @description
 *   文件處理管線中的映射步驟，負責將提取的欄位根據配置規則進行映射。
 *   實現 PipelineStep 介面，可無縫整合到現有管線架構。
 */
export class MappingPipelineStep
  implements PipelineStep<MappingPipelineInput, MappingPipelineOutput>
{
  readonly name = 'FieldMapping';
  readonly description = '根據配置規則映射提取的欄位';

  private readonly mappingService: DynamicMappingService;

  constructor(mappingService?: DynamicMappingService) {
    this.mappingService = mappingService ?? dynamicMappingService;
  }

  /**
   * 執行映射步驟
   * @description
   *   接收管線輸入，執行欄位映射，返回映射結果。
   *   會根據上下文中的 companyId 和 documentFormatId 解析對應的配置。
   *
   * @param input 管線輸入（提取的欄位和上下文）
   * @returns 管線輸出（映射結果）
   */
  async execute(input: MappingPipelineInput): Promise<MappingPipelineOutput> {
    const startTime = Date.now();

    try {
      // 檢查是否應該跳過
      if (this.shouldSkip(input)) {
        return {
          result: {
            success: true,
            mappedFields: [],
            unmappedFields: input.extractedFields.map((f) => f.fieldName),
            executionTimeMs: Date.now() - startTime,
            configsUsed: 0,
            rulesApplied: 0,
          },
          originalFields: input.extractedFields,
        };
      }

      // 建立映射上下文
      const mappingContext = {
        companyId: input.context.companyId,
        documentFormatId: input.context.documentFormatId,
        userId: input.context.userId,
        documentId: input.context.documentId,
        enableCache: input.context.enableCache,
        forceRefresh: input.context.forceRefresh,
      };

      // 執行映射
      const mappingResult = await this.mappingService.mapFields(
        input.extractedFields,
        mappingContext
      );

      return {
        result: mappingResult,
        originalFields: input.extractedFields,
      };
    } catch (error) {
      console.error('[MappingPipelineStep] Error executing mapping:', error);

      return {
        result: {
          success: false,
          mappedFields: [],
          unmappedFields: input.extractedFields.map((f) => f.fieldName),
          error: error instanceof Error ? error.message : '映射步驟執行失敗',
          executionTimeMs: Date.now() - startTime,
        },
        originalFields: input.extractedFields,
      };
    }
  }

  /**
   * 檢查是否應該跳過此步驟
   * @description
   *   根據輸入條件判斷是否應該跳過映射步驟。
   *   例如：沒有提取欄位、明確禁用映射等。
   *
   * @param input 管線輸入
   * @returns 是否跳過
   */
  shouldSkip(input: MappingPipelineInput): boolean {
    // 沒有提取欄位
    if (!input.extractedFields || input.extractedFields.length === 0) {
      return true;
    }

    // 上下文明確禁用映射
    if (input.context.skipMapping === true) {
      return true;
    }

    return false;
  }

  /**
   * 驗證輸入
   * @description
   *   驗證管線輸入是否有效。
   *
   * @param input 管線輸入
   * @returns 驗證結果
   */
  validate(input: MappingPipelineInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input) {
      errors.push('輸入不能為空');
      return { valid: false, errors };
    }

    if (!input.extractedFields) {
      errors.push('extractedFields 不能為空');
    }

    if (!input.context) {
      errors.push('context 不能為空');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// 擴展映射上下文類型
// ============================================================================

/**
 * 擴展 MappingContext 以支援跳過映射
 */
declare module '@/types/field-mapping' {
  interface MappingContext {
    /** 是否跳過映射步驟 */
    skipMapping?: boolean;
  }
}

// ============================================================================
// 管線建構器輔助函數
// ============================================================================

/**
 * 建立映射管線步驟
 * @description 工廠函數，建立配置好的映射管線步驟實例
 */
export function createMappingPipelineStep(
  options?: {
    mappingService?: DynamicMappingService;
  }
): MappingPipelineStep {
  return new MappingPipelineStep(options?.mappingService);
}

/**
 * 將映射步驟整合到現有管線
 * @description
 *   輔助函數，將映射步驟加入到管線步驟陣列中。
 *   自動處理步驟順序和依賴關係。
 *
 * @param pipeline 現有管線步驟陣列
 * @param options 配置選項
 * @returns 加入映射步驟後的管線
 */
export function addMappingStepToPipeline<TInput, TOutput>(
  pipeline: PipelineStep<TInput, TOutput>[],
  options?: {
    position?: 'start' | 'end' | number;
    mappingService?: DynamicMappingService;
  }
): PipelineStep<unknown, unknown>[] {
  const mappingStep = createMappingPipelineStep({
    mappingService: options?.mappingService,
  });

  const position = options?.position ?? 'end';

  if (position === 'start') {
    return [mappingStep, ...pipeline] as PipelineStep<unknown, unknown>[];
  } else if (position === 'end') {
    return [...pipeline, mappingStep] as PipelineStep<unknown, unknown>[];
  } else if (typeof position === 'number') {
    const result = [...pipeline] as PipelineStep<unknown, unknown>[];
    result.splice(position, 0, mappingStep);
    return result;
  }

  return [...pipeline, mappingStep] as PipelineStep<unknown, unknown>[];
}

// ============================================================================
// 導出
// ============================================================================

/**
 * MappingPipelineStep 單例實例
 */
export const mappingPipelineStep = new MappingPipelineStep();
