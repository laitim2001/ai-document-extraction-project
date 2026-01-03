/**
 * @fileoverview Prompt 解析錯誤類別
 * @description
 *   定義 Prompt 解析過程中可能發生的錯誤類型。
 *
 * @module src/lib/errors/prompt-resolution-errors
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 結構化錯誤資訊
 *   - 錯誤代碼標準化
 *   - 詳細資訊附加
 *
 * @related
 *   - src/services/prompt-resolver.service.ts - 解析服務
 */

/**
 * Prompt 解析基礎錯誤
 */
export class PromptResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PromptResolutionError';
    Object.setPrototypeOf(this, PromptResolutionError.prototype);
  }
}

/**
 * 無全域 Prompt 錯誤
 * @description 當指定類型沒有 GLOBAL 層配置時拋出
 */
export class NoGlobalPromptError extends PromptResolutionError {
  constructor(promptType: string) {
    super(
      `No global prompt configuration found for type: ${promptType}`,
      'NO_GLOBAL_PROMPT',
      { promptType }
    );
    this.name = 'NoGlobalPromptError';
    Object.setPrototypeOf(this, NoGlobalPromptError.prototype);
  }
}

/**
 * 變數解析錯誤
 * @description 當變數無法解析時拋出
 */
export class VariableResolutionError extends PromptResolutionError {
  constructor(variableName: string, reason: string) {
    super(
      `Failed to resolve variable "${variableName}": ${reason}`,
      'VARIABLE_RESOLUTION_FAILED',
      { variableName, reason }
    );
    this.name = 'VariableResolutionError';
    Object.setPrototypeOf(this, VariableResolutionError.prototype);
  }
}

/**
 * 配置合併錯誤
 * @description 當配置合併失敗時拋出
 */
export class ConfigMergeError extends PromptResolutionError {
  constructor(reason: string, configIds: string[]) {
    super(
      `Failed to merge configurations: ${reason}`,
      'CONFIG_MERGE_FAILED',
      { configIds, reason }
    );
    this.name = 'ConfigMergeError';
    Object.setPrototypeOf(this, ConfigMergeError.prototype);
  }
}

/**
 * 快取錯誤
 * @description 當快取操作失敗時拋出
 */
export class CacheError extends PromptResolutionError {
  constructor(operation: string, reason: string) {
    super(
      `Cache operation "${operation}" failed: ${reason}`,
      'CACHE_OPERATION_FAILED',
      { operation, reason }
    );
    this.name = 'CacheError';
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

/**
 * 無效請求錯誤
 * @description 當解析請求參數無效時拋出
 */
export class InvalidResolutionRequestError extends PromptResolutionError {
  constructor(reason: string, field?: string) {
    super(
      `Invalid resolution request: ${reason}`,
      'INVALID_RESOLUTION_REQUEST',
      { reason, field }
    );
    this.name = 'InvalidResolutionRequestError';
    Object.setPrototypeOf(this, InvalidResolutionRequestError.prototype);
  }
}
