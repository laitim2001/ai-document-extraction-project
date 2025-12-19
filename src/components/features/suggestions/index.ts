/**
 * @fileoverview 規則建議組件模組入口
 * @description
 *   導出規則建議相關的所有組件，包括：
 *   - 影響分析組件
 *   - 模擬測試組件
 *
 * @module src/components/features/suggestions
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 */

// 影響分析組件
export { ImpactAnalysisPanel } from './ImpactAnalysisPanel'
export { ImpactStatisticsCards } from './ImpactStatisticsCards'
export { RiskCasesTable } from './RiskCasesTable'
export { ImpactTimeline } from './ImpactTimeline'

// 模擬測試組件
export { SimulationConfigForm } from './SimulationConfigForm'
export { SimulationResultsPanel } from './SimulationResultsPanel'
