/**
 * @fileoverview 欄位映射配置組件模組
 * @description
 *   提供完整的欄位映射配置介面組件，支援：
 *   - 三層級映射配置（通用/公司/文件格式）
 *   - 拖放式規則排序
 *   - 來源/目標欄位選擇器
 *   - 轉換類型配置
 *   - 規則編輯與預覽
 *
 * @module src/components/features/mapping-config
 * @since Epic 13 - Story 13.3 (欄位映射配置介面)
 * @lastModified 2025-01-02
 *
 * @features
 *   - ConfigSelector: 配置範圍選擇器（GLOBAL/COMPANY/FORMAT）
 *   - SortableRuleItem: 可拖放的規則項目
 *   - MappingRuleList: 規則列表（含拖放排序）
 *   - SourceFieldSelector: 來源欄位選擇器（支援搜尋、分類分組）
 *   - TargetFieldSelector: 目標欄位選擇器（支援搜尋、分類分組）
 *   - TransformConfigPanel: 轉換參數配置面板
 *   - RuleEditor: 規則編輯對話框（新增/編輯模式）
 *   - MappingPreview: 映射轉換預覽
 *   - MappingConfigPanel: 主配置面板（整合所有組件）
 *
 * @dependencies
 *   - @dnd-kit/core - 拖放核心功能
 *   - @dnd-kit/sortable - 排序功能
 *   - shadcn/ui - UI 組件
 *   - @/types/field-mapping - 類型定義
 */

// ============================================================
// 配置選擇器
// ============================================================
export { ConfigSelector, type ConfigSelectorProps } from './ConfigSelector';

// ============================================================
// 規則列表組件
// ============================================================
export { SortableRuleItem, type SortableRuleItemProps } from './SortableRuleItem';
export { MappingRuleList, type MappingRuleListProps } from './MappingRuleList';

// ============================================================
// 欄位選擇器
// ============================================================
export { SourceFieldSelector, type SourceFieldSelectorProps } from './SourceFieldSelector';
export { TargetFieldSelector, type TargetFieldSelectorProps } from './TargetFieldSelector';

// ============================================================
// 轉換配置
// ============================================================
export { TransformConfigPanel, type TransformConfigPanelProps } from './TransformConfigPanel';

// ============================================================
// 規則編輯器
// ============================================================
export { RuleEditor, type RuleEditorProps } from './RuleEditor';

// ============================================================
// 預覽組件
// ============================================================
export { MappingPreview, type MappingPreviewProps } from './MappingPreview';

// ============================================================
// 主面板
// ============================================================
export { MappingConfigPanel, type MappingConfigPanelProps } from './MappingConfigPanel';
