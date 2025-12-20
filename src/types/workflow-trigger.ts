/**
 * @fileoverview 工作流觸發相關類型定義
 * @description
 *   定義 Story 10-4 手動觸發工作流所需的所有類型，包含：
 *   - 工作流參數類型
 *   - 文件選擇配置
 *   - 觸發輸入/輸出類型
 *   - API 響應類型
 *   - 錯誤代碼類型
 *
 * @module src/types/workflow-trigger
 * @since Epic 10 - Story 10.4
 * @lastModified 2025-12-20
 *
 * @features
 *   - 工作流參數 Schema 定義
 *   - 動態參數驗證支持
 *   - 文件選擇配置
 *   - Webhook 請求格式
 *
 * @dependencies
 *   - @prisma/client - Prisma 生成的類型
 */

import type { WorkflowDefinition as PrismaWorkflowDefinition } from '@prisma/client';

// ============================================================
// 工作流參數類型
// ============================================================

/**
 * 工作流參數類型
 */
export type WorkflowParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'text';

/**
 * 參數驗證規則
 */
export interface ParameterValidation {
  /** 最小值（適用於 number） */
  min?: number;
  /** 最大值（適用於 number） */
  max?: number;
  /** 最小長度（適用於 string/text） */
  minLength?: number;
  /** 最大長度（適用於 string/text） */
  maxLength?: number;
  /** 正則表達式模式（適用於 string/text） */
  pattern?: string;
  /** 驗證失敗的自定義訊息 */
  message?: string;
}

/**
 * 參數依賴配置
 */
export interface ParameterDependency {
  /** 依賴的欄位名稱 */
  field: string;
  /** 依賴的欄位值 */
  value: unknown;
}

/**
 * 工作流參數定義
 */
export interface WorkflowParameter {
  /** 參數名稱（唯一識別符） */
  name: string;
  /** 參數類型 */
  type: WorkflowParameterType;
  /** 顯示標籤 */
  label: string;
  /** 參數說明 */
  description?: string;
  /** 是否必填 */
  required: boolean;
  /** 預設值 */
  default?: unknown;
  /** 選項（適用於 select/multiselect） */
  options?: Array<{ value: string; label: string }>;
  /** 驗證規則 */
  validation?: ParameterValidation;
  /** 依賴條件 */
  dependsOn?: ParameterDependency;
}

// ============================================================
// 文件選擇配置
// ============================================================

/**
 * 文件選擇配置
 */
export interface DocumentSelectionConfig {
  /** 是否啟用文件選擇 */
  enabled: boolean;
  /** 是否必須選擇文件 */
  required: boolean;
  /** 最大可選文件數量 */
  maxCount?: number;
  /** 允許的文件類型 */
  allowedTypes?: string[];
}

// ============================================================
// 參數 Schema
// ============================================================

/**
 * 工作流參數 Schema
 */
export interface WorkflowParametersSchema {
  /** 參數定義列表 */
  parameters: WorkflowParameter[];
  /** 文件選擇配置 */
  documentSelection?: DocumentSelectionConfig;
}

// ============================================================
// 可觸發工作流
// ============================================================

/**
 * 可觸發工作流（含解析後的 schema）
 */
export interface TriggerableWorkflow extends PrismaWorkflowDefinition {
  /** 解析後的參數 Schema */
  parameterSchema: WorkflowParameter[];
  /** 文件選擇配置 */
  documentSelection?: DocumentSelectionConfig;
}

/**
 * 工作流列表項目（用於列表顯示）
 */
export interface WorkflowListItem {
  /** 工作流 ID */
  id: string;
  /** 工作流名稱 */
  name: string;
  /** 工作流描述 */
  description: string | null;
  /** 分類 */
  category: string | null;
  /** 標籤 */
  tags: string[];
  /** 是否啟用 */
  isActive: boolean;
  /** 是否有參數 */
  hasParameters: boolean;
  /** 是否需要選擇文件 */
  requiresDocuments: boolean;
}

// ============================================================
// 觸發輸入
// ============================================================

/**
 * 觸發工作流輸入
 */
export interface TriggerWorkflowInput {
  /** 工作流定義 ID */
  workflowId: string;
  /** 參數值 */
  parameters?: Record<string, unknown>;
  /** 選中的文件 ID 列表 */
  documentIds?: string[];
  /** 觸發者 ID */
  triggeredBy: string;
  /** 城市代碼 */
  cityCode: string;
}

// ============================================================
// 觸發結果
// ============================================================

/**
 * 觸發結果
 */
export interface TriggerResult {
  /** 是否成功 */
  success: boolean;
  /** 執行記錄 ID */
  executionId?: string;
  /** n8n 執行 ID */
  n8nExecutionId?: string;
  /** 錯誤訊息 */
  error?: string;
  /** 錯誤代碼 */
  errorCode?: TriggerErrorCode;
}

// ============================================================
// 錯誤類型
// ============================================================

/**
 * 觸發錯誤代碼
 */
export type TriggerErrorCode =
  | 'WORKFLOW_NOT_FOUND'
  | 'WORKFLOW_INACTIVE'
  | 'CITY_ACCESS_DENIED'
  | 'ROLE_ACCESS_DENIED'
  | 'VALIDATION_ERROR'
  | 'DOCUMENT_NOT_FOUND'
  | 'WEBHOOK_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * 觸發錯誤
 */
export interface TriggerError {
  /** 錯誤代碼 */
  code: TriggerErrorCode;
  /** 錯誤訊息 */
  message: string;
  /** 錯誤詳情 */
  details?: Record<string, unknown>;
}

// ============================================================
// Webhook 請求
// ============================================================

/**
 * Webhook 觸發 Payload
 */
export interface WebhookTriggerPayload {
  /** 執行記錄 ID */
  executionId: string;
  /** n8n 工作流 ID */
  workflowId: string;
  /** 觸發類型 */
  triggerType: 'manual';
  /** 觸發者 ID */
  triggeredBy: string;
  /** 城市代碼 */
  cityCode: string;
  /** 觸發時間戳 */
  timestamp: string;
  /** 參數值 */
  parameters: Record<string, unknown>;
  /** 文件列表 */
  documents: Array<{
    id: string;
    fileName: string;
    blobUrl?: string;
  }>;
}

// ============================================================
// API 響應類型
// ============================================================

/**
 * 可觸發工作流列表 API 響應
 */
export interface TriggerableWorkflowsResponse {
  data: TriggerableWorkflow[];
}

/**
 * 觸發工作流 API 響應
 */
export interface TriggerWorkflowResponse {
  data: {
    executionId: string;
    n8nExecutionId?: string;
  };
}

/**
 * 重試工作流 API 響應
 */
export interface RetryWorkflowResponse {
  data: {
    executionId: string;
    n8nExecutionId?: string;
  };
}

/**
 * 取消執行 API 響應
 */
export interface CancelExecutionResponse {
  data: {
    success: boolean;
    executionId: string;
  };
}

// ============================================================
// API 請求類型
// ============================================================

/**
 * 可觸發工作流列表查詢參數
 */
export interface TriggerableWorkflowsParams {
  /** 城市代碼 */
  cityCode?: string;
  /** 分類篩選 */
  category?: string;
}

/**
 * 觸發工作流請求
 */
export interface TriggerWorkflowRequest {
  /** 工作流定義 ID */
  workflowId: string;
  /** 參數值 */
  parameters?: Record<string, unknown>;
  /** 選中的文件 ID 列表 */
  documentIds?: string[];
  /** 城市代碼 */
  cityCode: string;
}

// ============================================================
// 前端狀態類型
// ============================================================

/**
 * 觸發對話框狀態
 */
export interface TriggerDialogState {
  /** 是否開啟 */
  isOpen: boolean;
  /** 當前步驟 */
  step: 'select' | 'configure' | 'confirm' | 'result';
  /** 選中的工作流 */
  selectedWorkflow: TriggerableWorkflow | null;
  /** 參數值 */
  parameterValues: Record<string, unknown>;
  /** 選中的文件 ID */
  selectedDocumentIds: string[];
  /** 是否正在提交 */
  isSubmitting: boolean;
  /** 提交結果 */
  result: TriggerResult | null;
}

/**
 * 參數表單狀態
 */
export interface ParameterFormState {
  /** 表單值 */
  values: Record<string, unknown>;
  /** 欄位錯誤 */
  errors: Record<string, string>;
  /** 是否已驗證 */
  isValid: boolean;
}

// ============================================================
// 工作流定義管理類型
// ============================================================

/**
 * 創建工作流定義輸入
 */
export interface CreateWorkflowDefinitionInput {
  /** 工作流名稱 */
  name: string;
  /** 工作流描述 */
  description?: string;
  /** n8n 工作流 ID */
  n8nWorkflowId: string;
  /** 觸發 URL */
  triggerUrl: string;
  /** 觸發方法 */
  triggerMethod?: string;
  /** 參數 Schema */
  parameters?: WorkflowParametersSchema;
  /** 城市代碼 */
  cityCode?: string;
  /** 允許的角色 */
  allowedRoles?: string[];
  /** 分類 */
  category?: string;
  /** 標籤 */
  tags?: string[];
  /** 創建者 ID */
  createdBy: string;
}

/**
 * 更新工作流定義輸入
 */
export interface UpdateWorkflowDefinitionInput {
  /** 工作流名稱 */
  name?: string;
  /** 工作流描述 */
  description?: string;
  /** 觸發 URL */
  triggerUrl?: string;
  /** 觸發方法 */
  triggerMethod?: string;
  /** 參數 Schema */
  parameters?: WorkflowParametersSchema;
  /** 允許的角色 */
  allowedRoles?: string[];
  /** 分類 */
  category?: string;
  /** 標籤 */
  tags?: string[];
  /** 是否啟用 */
  isActive?: boolean;
  /** 更新者 ID */
  updatedBy: string;
}

/**
 * 工作流定義列表查詢選項
 */
export interface ListWorkflowDefinitionsOptions {
  /** 城市代碼 */
  cityCode?: string;
  /** 分類 */
  category?: string;
  /** 是否啟用 */
  isActive?: boolean;
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  pageSize?: number;
}

/**
 * 工作流定義列表結果
 */
export interface WorkflowDefinitionListResult {
  /** 工作流定義列表 */
  items: PrismaWorkflowDefinition[];
  /** 總數 */
  total: number;
}

// ============================================================
// 常數
// ============================================================

/**
 * 觸發超時時間（毫秒）
 */
export const TRIGGER_TIMEOUT_MS = 30000;

/**
 * 參數類型配置
 */
export const PARAMETER_TYPE_CONFIG: Record<
  WorkflowParameterType,
  { label: string; inputType: string }
> = {
  string: { label: '文字', inputType: 'text' },
  number: { label: '數字', inputType: 'number' },
  boolean: { label: '布林', inputType: 'checkbox' },
  date: { label: '日期', inputType: 'date' },
  select: { label: '選單', inputType: 'select' },
  multiselect: { label: '多選', inputType: 'multiselect' },
  text: { label: '多行文字', inputType: 'textarea' },
};

/**
 * 錯誤代碼訊息配置
 */
export const TRIGGER_ERROR_MESSAGES: Record<TriggerErrorCode, string> = {
  WORKFLOW_NOT_FOUND: '找不到工作流定義',
  WORKFLOW_INACTIVE: '工作流已停用',
  CITY_ACCESS_DENIED: '無權存取此城市的工作流',
  ROLE_ACCESS_DENIED: '無權觸發此工作流',
  VALIDATION_ERROR: '參數驗證失敗',
  DOCUMENT_NOT_FOUND: '找不到指定的文件',
  WEBHOOK_FAILED: 'Webhook 請求失敗',
  NETWORK_ERROR: '網路錯誤',
  TIMEOUT: '請求超時',
  UNKNOWN: '未知錯誤',
};

// ============================================================
// Re-exports
// ============================================================

export type { WorkflowDefinition as PrismaWorkflowDefinition } from '@prisma/client';
