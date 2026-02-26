/**
 * @fileoverview 模版匹配整合測試類型定義
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/types
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

import type { TemplateFieldMappingRule } from '@/types/template-field-mapping';
import type { DataTemplateField } from '@/types/data-template';

/**
 * 測試步驟
 */
export type TestStep =
  | 'select-data'
  | 'select-template'
  | 'review-mapping'
  | 'execute-match'
  | 'view-results'
  | 'test-export';

/**
 * 數據來源類型
 */
export type DataSourceType = 'documents' | 'mock';

/**
 * 模擬文件數據
 */
export interface MockDocument {
  id: string;
  name: string;
  mappedFields: Record<string, unknown>;
}

/**
 * 選中的模版資訊
 */
export interface SelectedTemplate {
  id: string;
  name: string;
  fields: DataTemplateField[];
}

/**
 * 解析後的映射配置
 */
export interface ResolvedMappingInfo {
  sources: Array<{
    id: string;
    scope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
    name: string;
  }>;
  mappings: TemplateFieldMappingRule[];
}

/**
 * 匹配結果
 */
export interface MatchResult {
  instanceId: string;
  instanceName: string;
  totalDocuments: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorRows: number;
  results: RowResult[];
}

/**
 * 行結果
 */
export interface RowResult {
  documentId: string;
  rowId: string | null;
  rowKey: string | null;
  status: 'VALID' | 'INVALID' | 'ERROR';
  fieldValues?: Record<string, unknown>;
  errors?: Record<string, string>;
}

/**
 * 導出結果
 */
export interface ExportResult {
  format: 'xlsx' | 'csv';
  filename: string;
  fileSize: number;
  rowCount: number;
  blob: Blob;
}

/**
 * 步驟結果
 */
export interface StepResult {
  status: 'passed' | 'failed' | 'warning';
  message?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * 測試狀態
 */
export interface TestState {
  // Step 1: 數據選擇
  selectedDocuments: string[];
  mockData: MockDocument[] | null;
  dataSource: DataSourceType;

  // Step 2: 模版選擇
  selectedTemplate: SelectedTemplate | null;

  // Step 3: 映射預覽
  resolvedMappings: ResolvedMappingInfo | null;
  tempMappings?: TemplateFieldMappingRule[];

  // Step 4: 執行匹配
  instanceId: string | null;
  matchResult: MatchResult | null;

  // Step 5: 結果查看 (使用 matchResult)

  // Step 6: 導出測試
  exportResult: ExportResult | null;

  // 步驟結果記錄
  stepResults: Partial<Record<TestStep, StepResult>>;
}

/**
 * 步驟組件 Props
 */
export interface StepComponentProps {
  testState: TestState;
  onUpdate: (updates: Partial<TestState>) => void;
  onRecordResult: (result: StepResult) => void;
}

/**
 * 預設模擬數據
 */
export const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: 'mock-1',
    name: 'Mock Invoice 1',
    mappedFields: {
      invoice_number: 'INV-2026-001',
      invoice_date: '2026-01-15',
      vendor_name: 'DHL Express',
      sea_freight: 500,
      terminal_handling: 100,
      documentation_fee: 50,
      total_amount: 650,
      shipment_no: 'S001',
      currency: 'USD',
    },
  },
  {
    id: 'mock-2',
    name: 'Mock Invoice 2',
    mappedFields: {
      invoice_number: 'INV-2026-002',
      invoice_date: '2026-01-16',
      vendor_name: 'Maersk',
      sea_freight: 450,
      terminal_handling: 120,
      documentation_fee: 45,
      total_amount: 615,
      shipment_no: 'S002',
      currency: 'USD',
    },
  },
  {
    id: 'mock-3',
    name: 'Mock Invoice 3 (Error)',
    mappedFields: {
      invoice_number: 'INV-2026-003',
      invoice_date: '2026-01-17',
      vendor_name: 'CMA CGM',
      sea_freight: 480,
      // 缺少 terminal_handling
      documentation_fee: 55,
      total_amount: null, // 缺少 total_amount - 測試必填欄位錯誤
      shipment_no: 'S003',
      currency: 'USD',
    },
  },
];
