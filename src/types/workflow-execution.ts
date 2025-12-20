/**
 * @fileoverview 工作流執行狀態相關類型定義
 * @description
 *   定義 Story 10-3 工作流執行狀態檢視所需的所有類型，包含：
 *   - 列表查詢選項
 *   - 執行摘要和詳情
 *   - 執行步驟類型
 *   - 統計類型
 *   - API 響應類型
 *
 * @module src/types/workflow-execution
 * @since Epic 10 - Story 10.3
 * @lastModified 2025-12-20
 *
 * @features
 *   - 工作流執行列表查詢
 *   - 執行狀態追蹤
 *   - 執行步驟詳情
 *   - 執行統計
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的類型
 */

import type {
  WorkflowExecutionStatus,
  WorkflowTriggerType,
  StepExecutionStatus,
} from '@prisma/client';

// ============================================================
// 列表查詢選項
// ============================================================

/**
 * 工作流執行列表查詢選項
 */
export interface ListExecutionsOptions {
  /** 城市代碼（用於權限過濾） */
  cityCode?: string;
  /** 執行狀態（單個或多個） */
  status?: WorkflowExecutionStatus | WorkflowExecutionStatus[];
  /** 工作流名稱（模糊搜尋） */
  workflowName?: string;
  /** 觸發類型 */
  triggerType?: WorkflowTriggerType;
  /** 觸發者 ID */
  triggeredBy?: string;
  /** 開始時間範圍 - 起始 */
  startDate?: Date;
  /** 開始時間範圍 - 結束 */
  endDate?: Date;
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  pageSize?: number;
  /** 排序欄位 */
  orderBy?: 'startedAt' | 'createdAt' | 'completedAt';
  /** 排序方向 */
  orderDirection?: 'asc' | 'desc';
}

// ============================================================
// 執行摘要（列表顯示用）
// ============================================================

/**
 * 工作流執行摘要
 * 用於列表頁面顯示
 */
export interface ExecutionSummary {
  /** 執行 ID */
  id: string;
  /** 工作流名稱 */
  workflowName: string;
  /** 觸發類型 */
  triggerType: WorkflowTriggerType;
  /** 觸發來源描述 */
  triggerSource?: string;
  /** 執行狀態 */
  status: WorkflowExecutionStatus;
  /** 執行進度（0-100） */
  progress: number;
  /** 當前步驟名稱 */
  currentStep?: string;
  /** 開始時間 */
  startedAt?: Date;
  /** 完成時間 */
  completedAt?: Date;
  /** 執行耗時（毫秒） */
  durationMs?: number;
  /** 關聯文件數量 */
  documentCount: number;
  /** 錯誤訊息（如有） */
  errorMessage?: string;
}

// ============================================================
// 執行詳情（詳情頁面用）
// ============================================================

/**
 * 工作流執行詳情
 * 繼承摘要並添加完整資訊
 */
export interface ExecutionDetail extends ExecutionSummary {
  /** n8n 執行 ID */
  n8nExecutionId?: string;
  /** n8n 工作流 ID */
  workflowId?: string;
  /** 觸發者 ID */
  triggeredBy?: string;
  /** 城市代碼 */
  cityCode: string;
  /** 執行結果 */
  result?: Record<string, unknown>;
  /** 錯誤詳情 */
  errorDetails?: ErrorDetails;
  /** 執行步驟列表 */
  steps: ExecutionStepSummary[];
  /** 關聯文件列表 */
  documents: ExecutionDocumentSummary[];
}

// ============================================================
// 執行步驟摘要
// ============================================================

/**
 * 執行步驟摘要
 */
export interface ExecutionStepSummary {
  /** 步驟順序 */
  stepNumber: number;
  /** 步驟名稱 */
  stepName: string;
  /** n8n 節點類型 */
  stepType?: string;
  /** 步驟狀態 */
  status: StepExecutionStatus;
  /** 開始時間 */
  startedAt?: Date;
  /** 完成時間 */
  completedAt?: Date;
  /** 執行耗時（毫秒） */
  durationMs?: number;
  /** 錯誤訊息（如有） */
  errorMessage?: string;
}

// ============================================================
// 執行文件摘要
// ============================================================

/**
 * 執行關聯文件摘要
 */
export interface ExecutionDocumentSummary {
  /** 文件 ID */
  id: string;
  /** 文件名稱 */
  fileName: string;
  /** 文件狀態 */
  status: string;
}

// ============================================================
// 錯誤詳情結構
// ============================================================

/**
 * 錯誤詳情結構
 */
export interface ErrorDetails {
  /** 錯誤訊息 */
  message: string;
  /** 錯誤代碼 */
  code?: string;
  /** 錯誤堆疊 */
  stack?: string;
  /** 發生錯誤的 n8n 節點類型 */
  nodeType?: string;
  /** 發生錯誤的 n8n 節點名稱 */
  nodeName?: string;
  /** 錯誤發生時間 */
  timestamp?: string;
}

// ============================================================
// 執行統計
// ============================================================

/**
 * 執行統計資料
 */
export interface ExecutionStats {
  /** 總執行數 */
  total: number;
  /** 按狀態分組的數量 */
  byStatus: Partial<Record<WorkflowExecutionStatus, number>>;
  /** 按觸發類型分組的數量 */
  byTriggerType: Partial<Record<WorkflowTriggerType, number>>;
  /** 平均執行時間（毫秒） */
  avgDurationMs: number;
  /** 成功率（0-1） */
  successRate: number;
}

/**
 * 執行統計查詢選項
 */
export interface ExecutionStatsOptions {
  /** 城市代碼 */
  cityCode?: string;
  /** 開始時間 */
  startDate?: Date;
  /** 結束時間 */
  endDate?: Date;
}

// ============================================================
// 分頁結果
// ============================================================

/**
 * 分頁執行結果
 */
export interface PaginatedExecutions {
  /** 執行列表 */
  items: ExecutionSummary[];
  /** 總數量 */
  total: number;
}

// ============================================================
// API 響應類型
// ============================================================

/**
 * 工作流執行分頁資訊
 *
 * @description
 *   與 forwarder.ts 中的 PaginationInfo 相同結構，
 *   但為避免導出衝突，此處定義為內部使用。
 *   在 types/index.ts 中使用 ForwarderPaginationInfo。
 */
interface ExecutionPaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 執行列表 API 響應
 */
export interface ExecutionListResponse {
  data: ExecutionSummary[];
  pagination: ExecutionPaginationInfo;
}

/**
 * 執行詳情 API 響應
 */
export interface ExecutionDetailResponse {
  data: ExecutionDetail;
}

/**
 * 執行中工作流 API 響應
 */
export interface RunningExecutionsResponse {
  data: ExecutionSummary[];
}

/**
 * 執行統計 API 響應
 */
export interface ExecutionStatsResponse {
  data: ExecutionStats;
}

// ============================================================
// 前端狀態類型
// ============================================================

/**
 * 執行篩選值
 */
export interface ExecutionFilterValues {
  /** 執行狀態 */
  status?: WorkflowExecutionStatus | '';
  /** 觸發類型 */
  triggerType?: WorkflowTriggerType | '';
  /** 工作流名稱 */
  workflowName?: string;
  /** 開始日期 */
  startDate?: Date | null;
  /** 結束日期 */
  endDate?: Date | null;
}

/**
 * 狀態顯示配置
 */
export interface StatusConfig {
  /** 狀態標籤 */
  label: string;
  /** 顏色類型 */
  color: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'secondary';
  /** 圖標名稱 */
  iconName: string;
}

// ============================================================
// 狀態配置常數
// ============================================================

/**
 * 執行狀態顯示配置
 */
export const EXECUTION_STATUS_CONFIG: Record<WorkflowExecutionStatus, StatusConfig> = {
  PENDING: {
    label: '等待中',
    color: 'default',
    iconName: 'Clock',
  },
  QUEUED: {
    label: '排隊中',
    color: 'secondary',
    iconName: 'List',
  },
  RUNNING: {
    label: '執行中',
    color: 'primary',
    iconName: 'Loader2',
  },
  COMPLETED: {
    label: '已完成',
    color: 'success',
    iconName: 'CheckCircle',
  },
  FAILED: {
    label: '失敗',
    color: 'error',
    iconName: 'XCircle',
  },
  CANCELLED: {
    label: '已取消',
    color: 'warning',
    iconName: 'Ban',
  },
  TIMEOUT: {
    label: '超時',
    color: 'error',
    iconName: 'AlertTriangle',
  },
};

/**
 * 觸發類型顯示配置
 */
export const TRIGGER_TYPE_CONFIG: Record<WorkflowTriggerType, { label: string; iconName: string }> = {
  SCHEDULED: {
    label: '排程觸發',
    iconName: 'Calendar',
  },
  MANUAL: {
    label: '手動觸發',
    iconName: 'Hand',
  },
  WEBHOOK: {
    label: 'Webhook 觸發',
    iconName: 'Webhook',
  },
  DOCUMENT: {
    label: '文件觸發',
    iconName: 'FileText',
  },
  EVENT: {
    label: '事件觸發',
    iconName: 'Zap',
  },
};

// ============================================================
// 類型守衛
// ============================================================

/**
 * 檢查是否為有效的執行狀態
 */
export function isValidExecutionStatus(value: unknown): value is WorkflowExecutionStatus {
  const validStatuses: WorkflowExecutionStatus[] = [
    'PENDING',
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'TIMEOUT',
  ];
  return typeof value === 'string' && validStatuses.includes(value as WorkflowExecutionStatus);
}

/**
 * 檢查是否為有效的觸發類型
 */
export function isValidTriggerType(value: unknown): value is WorkflowTriggerType {
  const validTypes: WorkflowTriggerType[] = [
    'SCHEDULED',
    'MANUAL',
    'WEBHOOK',
    'DOCUMENT',
    'EVENT',
  ];
  return typeof value === 'string' && validTypes.includes(value as WorkflowTriggerType);
}

/**
 * 檢查執行是否為運行中狀態
 */
export function isRunningExecution(status: WorkflowExecutionStatus): boolean {
  return status === 'PENDING' || status === 'QUEUED' || status === 'RUNNING';
}

/**
 * 檢查執行是否為終態
 */
export function isTerminalStatus(status: WorkflowExecutionStatus): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    status === 'TIMEOUT'
  );
}

// ============================================================
// Re-exports
// ============================================================

export type { WorkflowExecutionStatus, WorkflowTriggerType, StepExecutionStatus } from '@prisma/client';
