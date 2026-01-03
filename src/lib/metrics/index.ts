/**
 * @fileoverview Metrics 模組導出
 * @description
 *   統一導出度量收集相關功能。
 *
 * @module src/lib/metrics
 * @since Epic 14 - Story 14-4
 * @lastModified 2026-01-03
 */

export {
  PromptMetricsCollector,
  createPromptMetricsCollector,
  getGlobalPromptMetricsCollector,
  resetGlobalPromptMetricsCollector,
  type ExtendedPromptMetrics,
  type MetricsCollectorOptions,
} from './prompt-metrics';
