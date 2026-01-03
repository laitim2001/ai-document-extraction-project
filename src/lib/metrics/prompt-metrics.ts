/**
 * @fileoverview Prompt 度量收集器
 * @description
 *   追蹤 Prompt 請求的度量數據，包括：
 *   - 請求次數統計（依來源分類）
 *   - 解析時間追蹤
 *   - 錯誤率監控
 *   - 降級事件記錄
 *
 *   度量數據用於：
 *   - 監控動態 Prompt 系統健康狀態
 *   - 優化 Prompt 解析性能
 *   - 識別需要靜態備援的高頻場景
 *
 * @module src/lib/metrics/prompt-metrics
 * @since Epic 14 - Story 14-4 (GPT Vision 服務整合)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 請求統計（總數、按來源分類）
 *   - 性能追蹤（平均解析時間）
 *   - 錯誤監控（錯誤計數、錯誤率）
 *   - 滑動窗口統計（最近 N 筆記錄）
 *
 * @dependencies
 *   - src/services/prompt-provider.interface.ts - PromptRequestMetrics 類型
 *
 * @related
 *   - src/services/hybrid-prompt-provider.service.ts - 度量收集來源
 *   - src/services/gpt-vision.service.ts - 使用者
 */

import type {
  PromptRequestMetrics,
  PromptUsageMetrics,
  PromptSource,
  IMetricsCollector,
} from '@/services/prompt-provider.interface';
import { PromptType } from '@/types/prompt-config';

// ============================================================================
// Types
// ============================================================================

/**
 * 擴展度量資訊
 */
export interface ExtendedPromptMetrics extends PromptUsageMetrics {
  /** 各 Prompt 類型的請求統計 */
  byPromptType: Record<PromptType, number>;
  /** 最近的錯誤訊息 */
  recentErrors: string[];
  /** 降級事件次數 */
  fallbackEvents: number;
  /** 最後請求時間 */
  lastRequestTime: Date | null;
}

/**
 * 度量收集器配置
 */
export interface MetricsCollectorOptions {
  /** 滑動窗口大小（保留多少筆歷史記錄） */
  windowSize?: number;
  /** 最大錯誤訊息保留數量 */
  maxErrorMessages?: number;
  /** 是否啟用詳細日誌 */
  enableVerboseLogging?: boolean;
}

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

/**
 * Prompt 度量收集器
 * @description
 *   收集和追蹤 Prompt 系統的使用度量。
 *   支援滑動窗口統計和實時監控。
 */
export class PromptMetricsCollector implements IMetricsCollector {
  private readonly options: Required<MetricsCollectorOptions>;
  private requestHistory: PromptRequestMetrics[] = [];
  private recentErrors: string[] = [];

  // 計數器
  private totalRequests = 0;
  private dynamicRequests = 0;
  private staticRequests = 0;
  private fallbackRequests = 0;
  private errorCount = 0;
  private totalResolutionTimeMs = 0;

  // 按類型統計
  private byPromptType: Record<string, number> = {};

  // 時間戳
  private lastRequestTime: Date | null = null;

  constructor(options: MetricsCollectorOptions = {}) {
    this.options = {
      windowSize: options.windowSize ?? 1000,
      maxErrorMessages: options.maxErrorMessages ?? 50,
      enableVerboseLogging: options.enableVerboseLogging ?? false,
    };

    // 初始化類型計數器
    for (const type of Object.values(PromptType)) {
      this.byPromptType[type] = 0;
    }
  }

  /**
   * 記錄單次請求度量
   * @param metrics - 請求度量資料
   */
  recordRequest(metrics: PromptRequestMetrics): void {
    // 更新總數
    this.totalRequests++;
    this.lastRequestTime = metrics.timestamp;
    this.totalResolutionTimeMs += metrics.resolutionTimeMs;

    // 按來源統計
    this.updateSourceCount(metrics.source);

    // 按類型統計
    if (metrics.promptType) {
      this.byPromptType[metrics.promptType] =
        (this.byPromptType[metrics.promptType] ?? 0) + 1;
    }

    // 錯誤追蹤
    if (!metrics.success) {
      this.errorCount++;
      if (metrics.errorMessage) {
        this.addErrorMessage(metrics.errorMessage);
      }
    }

    // 保存到歷史記錄
    this.addToHistory(metrics);

    // 詳細日誌
    if (this.options.enableVerboseLogging) {
      this.logMetrics(metrics);
    }
  }

  /**
   * 獲取當前使用度量
   * @returns 彙總的使用度量
   */
  getMetrics(): PromptUsageMetrics {
    return {
      totalRequests: this.totalRequests,
      dynamicRequests: this.dynamicRequests,
      staticRequests: this.staticRequests,
      fallbackRequests: this.fallbackRequests,
      avgResolutionTimeMs:
        this.totalRequests > 0
          ? this.totalResolutionTimeMs / this.totalRequests
          : 0,
      errorCount: this.errorCount,
    };
  }

  /**
   * 獲取擴展度量資訊
   * @returns 包含詳細統計的擴展度量
   */
  getExtendedMetrics(): ExtendedPromptMetrics {
    return {
      ...this.getMetrics(),
      byPromptType: { ...this.byPromptType } as Record<PromptType, number>,
      recentErrors: [...this.recentErrors],
      fallbackEvents: this.fallbackRequests,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * 獲取錯誤率
   * @returns 錯誤率（0-1 之間的小數）
   */
  getErrorRate(): number {
    return this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0;
  }

  /**
   * 獲取動態 Prompt 使用率
   * @returns 動態 Prompt 佔比（0-1 之間的小數）
   */
  getDynamicUsageRate(): number {
    return this.totalRequests > 0
      ? this.dynamicRequests / this.totalRequests
      : 0;
  }

  /**
   * 獲取最近 N 筆請求的歷史
   * @param count - 要獲取的記錄數量
   * @returns 最近的請求記錄
   */
  getRecentHistory(count = 10): PromptRequestMetrics[] {
    return this.requestHistory.slice(-count);
  }

  /**
   * 獲取指定時間範圍內的度量
   * @param since - 起始時間
   * @returns 時間範圍內的請求記錄
   */
  getMetricsSince(since: Date): PromptRequestMetrics[] {
    return this.requestHistory.filter((m) => m.timestamp >= since);
  }

  /**
   * 重置所有度量
   */
  reset(): void {
    this.totalRequests = 0;
    this.dynamicRequests = 0;
    this.staticRequests = 0;
    this.fallbackRequests = 0;
    this.errorCount = 0;
    this.totalResolutionTimeMs = 0;
    this.requestHistory = [];
    this.recentErrors = [];
    this.lastRequestTime = null;

    for (const type of Object.keys(this.byPromptType)) {
      this.byPromptType[type] = 0;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 更新來源計數
   */
  private updateSourceCount(source: PromptSource): void {
    switch (source) {
      case 'dynamic':
        this.dynamicRequests++;
        break;
      case 'static':
        this.staticRequests++;
        break;
      case 'fallback':
        this.fallbackRequests++;
        break;
    }
  }

  /**
   * 添加錯誤訊息到歷史
   */
  private addErrorMessage(message: string): void {
    this.recentErrors.push(message);
    if (this.recentErrors.length > this.options.maxErrorMessages) {
      this.recentErrors.shift();
    }
  }

  /**
   * 添加到請求歷史
   */
  private addToHistory(metrics: PromptRequestMetrics): void {
    this.requestHistory.push(metrics);
    if (this.requestHistory.length > this.options.windowSize) {
      this.requestHistory.shift();
    }
  }

  /**
   * 記錄詳細日誌
   */
  private logMetrics(metrics: PromptRequestMetrics): void {
    console.log(
      `[PromptMetrics] ${metrics.promptType} | ` +
        `Source: ${metrics.source} | ` +
        `Time: ${metrics.resolutionTimeMs}ms | ` +
        `Success: ${metrics.success}`
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 創建度量收集器實例
 *
 * @description
 *   工廠函數用於創建配置完整的度量收集器。
 *
 * @param options - 配置選項
 * @returns PromptMetricsCollector 實例
 *
 * @example
 * ```typescript
 * const metrics = createPromptMetricsCollector({
 *   windowSize: 500,
 *   enableVerboseLogging: true
 * });
 *
 * // 使用度量收集器
 * promptProvider.setMetricsCollector(metrics);
 *
 * // 獲取度量
 * const usage = metrics.getMetrics();
 * console.log(`Total requests: ${usage.totalRequests}`);
 * ```
 */
export function createPromptMetricsCollector(
  options?: MetricsCollectorOptions
): PromptMetricsCollector {
  return new PromptMetricsCollector(options);
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * 全域度量收集器單例
 * @description 用於共享的度量收集實例
 */
let globalMetricsCollector: PromptMetricsCollector | null = null;

/**
 * 獲取全域度量收集器
 *
 * @description
 *   返回共享的全域度量收集器實例。
 *   首次調用時會自動創建。
 *
 * @returns 全域度量收集器實例
 */
export function getGlobalPromptMetricsCollector(): PromptMetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = createPromptMetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * 重置全域度量收集器
 *
 * @description
 *   清除並重置全域度量收集器。
 *   主要用於測試環境。
 */
export function resetGlobalPromptMetricsCollector(): void {
  if (globalMetricsCollector) {
    globalMetricsCollector.reset();
  }
}
