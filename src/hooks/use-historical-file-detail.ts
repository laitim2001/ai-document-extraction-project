/**
 * @fileoverview useHistoricalFileDetail Hook - 歷史文件詳情資料獲取
 * @description
 *   提供歷史文件完整詳情的 React Query Hook，包含：
 *   - 自動快取和重新驗證
 *   - Loading 和 Error 狀態管理
 *   - 類型安全的資料結構
 *
 * @module src/hooks/use-historical-file-detail
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 *
 * @dependencies
 *   - @tanstack/react-query - 資料獲取和快取
 *
 * @related
 *   - src/app/api/admin/historical-data/files/[id]/detail/route.ts - API 端點
 *   - src/hooks/use-historical-data.ts - 相關 Hooks
 */

import { useQuery } from '@tanstack/react-query';

// ============================================================
// Types
// ============================================================

/**
 * 時間軸資料結構
 * 注意：欄位名稱對應 Prisma Schema 中的 HistoricalFile 模型
 */
export interface FileTimeline {
  createdAt: string;
  detectedAt: string | null;
  processingStartAt: string | null;
  processingEndAt: string | null;
  processedAt: string | null;
  updatedAt: string;
}

/**
 * 匹配的公司資訊
 * documentIssuer 關聯指向 Company 模型
 */
export interface MatchedCompany {
  id: string;
  name: string;
  code: string | null;
  displayName: string | null;
}

/**
 * 發行者識別資料結構
 */
export interface IssuerIdentification {
  method: string | null;
  confidence: number | null;
  matchedCompany: MatchedCompany | null;
}

/**
 * 文件格式資料結構
 * 對應 Prisma Schema 中的 DocumentFormat 模型
 */
export interface DocumentFormatInfo {
  id: string;
  name: string;
  documentType: string | null;
  documentSubtype: string | null;
}

/**
 * 批次資訊
 * 對應 Prisma Schema 中的 HistoricalBatch 模型
 */
export interface BatchInfo {
  id: string;
  name: string | null;
  description: string | null;
}

/**
 * 提取結果中的 Line Item 結構
 */
export interface LineItem {
  description?: string;
  amount?: number;
  quantity?: number;
  unitPrice?: number;
  [key: string]: unknown;
}

/**
 * 提取結果中的 Invoice Data 結構
 */
export interface InvoiceData {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  vendorName?: string;
  vendorAddress?: string;
  customerName?: string;
  customerAddress?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;
  lineItems?: LineItem[];
  [key: string]: unknown;
}

/**
 * 完整的提取結果結構
 */
export interface ExtractionResult {
  invoiceData?: InvoiceData;
  confidence?: number;
  rawText?: string;
  [key: string]: unknown;
}

/**
 * 歷史文件詳情資料結構
 * 注意：欄位名稱對應 Prisma Schema 中的 HistoricalFile 模型
 */
export interface HistoricalFileDetail {
  // 基本資訊
  id: string;
  fileName: string;
  originalName: string | null;
  fileSize: number;
  detectedType: string | null;
  mimeType: string | null;
  status: string;
  storagePath: string | null;

  // 處理資訊
  processingMethod: string | null;
  actualCost: number | null;

  // 時間軸
  timeline: FileTimeline;

  // 提取結果
  extractionResult: ExtractionResult | null;

  // 發行者識別
  issuerIdentification: IssuerIdentification;

  // 文件格式
  documentFormat: DocumentFormatInfo | null;
  formatConfidence: number | null;

  // 批次資訊
  batch: BatchInfo | null;
}

/**
 * API 響應結構
 */
interface FileDetailResponse {
  success: boolean;
  data: HistoricalFileDetail;
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取歷史文件詳情
 *
 * @param fileId - 文件 ID
 * @returns 文件詳情資料
 * @throws 當 API 返回錯誤時拋出異常
 */
async function fetchFileDetail(fileId: string): Promise<HistoricalFileDetail> {
  const response = await fetch(`/api/admin/historical-data/files/${fileId}/detail`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch file detail');
  }

  const result: FileDetailResponse = await response.json();
  return result.data;
}

// ============================================================
// Hook
// ============================================================

/**
 * 歷史文件詳情 Hook
 *
 * @description
 *   使用 React Query 獲取單一歷史文件的完整詳情，
 *   包含自動快取、錯誤處理和 Loading 狀態。
 *
 * @param fileId - 文件 ID（可為 null 或 undefined 以禁用查詢）
 * @returns React Query 查詢結果
 *
 * @example
 * ```tsx
 * function FileDetailPage({ fileId }: { fileId: string }) {
 *   const { data, isLoading, error } = useHistoricalFileDetail(fileId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!data) return <NotFound />;
 *
 *   return <FileInfoCard file={data} />;
 * }
 * ```
 */
export function useHistoricalFileDetail(fileId: string | null | undefined) {
  return useQuery({
    queryKey: ['historical-file-detail', fileId],
    queryFn: () => fetchFileDetail(fileId!),
    enabled: !!fileId,
    staleTime: 30 * 1000, // 30 秒內資料視為新鮮
    gcTime: 5 * 60 * 1000, // 5 分鐘後垃圾回收
  });
}
