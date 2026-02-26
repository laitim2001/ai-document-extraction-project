/**
 * @fileoverview 參考號碼類型定義
 * @description
 *   定義參考號碼管理系統的相關類型。
 *   包含 ReferenceNumber 的 API 請求/響應類型、枚舉常量和輔助函數。
 *
 * @module src/types/reference-number
 * @author Development Team
 * @since Epic 20 - Story 20.1 (Reference Number Master Setup)
 * @lastModified 2026-02-04
 */

// ================================
// 枚舉類型
// ================================

/**
 * 參考號碼類型
 */
export type ReferenceNumberType =
  | 'SHIPMENT'    // 運輸單號
  | 'DELIVERY'    // 交貨單號
  | 'BOOKING'     // 訂艙號
  | 'CONTAINER'   // 櫃號
  | 'HAWB'        // House Air Waybill
  | 'MAWB'        // Master Air Waybill
  | 'BL'          // Bill of Lading
  | 'CUSTOMS'     // 報關單號
  | 'OTHER';      // 其他

/**
 * 參考號碼狀態
 */
export type ReferenceNumberStatus =
  | 'ACTIVE'      // 有效
  | 'EXPIRED'     // 已過期
  | 'CANCELLED';  // 已取消

// ================================
// 常量定義
// ================================

/**
 * 參考號碼類型標籤（繁體中文）
 */
export const REFERENCE_NUMBER_TYPE_LABELS: Record<ReferenceNumberType, string> = {
  SHIPMENT: '運輸單號',
  DELIVERY: '交貨單號',
  BOOKING: '訂艙號',
  CONTAINER: '櫃號',
  HAWB: '分提單',
  MAWB: '主提單',
  BL: '提單',
  CUSTOMS: '報關單',
  OTHER: '其他',
};

/**
 * 參考號碼狀態標籤（繁體中文）
 */
export const REFERENCE_NUMBER_STATUS_LABELS: Record<ReferenceNumberStatus, string> = {
  ACTIVE: '有效',
  EXPIRED: '已過期',
  CANCELLED: '已取消',
};

/**
 * 參考號碼類型選項（用於下拉選單）
 */
export const REFERENCE_NUMBER_TYPE_OPTIONS = Object.entries(REFERENCE_NUMBER_TYPE_LABELS).map(
  ([value, label]) => ({
    value: value as ReferenceNumberType,
    label,
  })
);

/**
 * 參考號碼狀態選項（用於下拉選單）
 */
export const REFERENCE_NUMBER_STATUS_OPTIONS = Object.entries(REFERENCE_NUMBER_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as ReferenceNumberStatus,
    label,
  })
);

// ================================
// 介面定義
// ================================

/**
 * 參考號碼完整資訊
 */
export interface ReferenceNumber {
  id: string;
  code: string;
  number: string;
  type: ReferenceNumberType;
  status: ReferenceNumberStatus;
  year: number;
  regionId: string;
  region: {
    id: string;
    code: string;
    name: string;
  };
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  matchCount: number;
  lastMatchedAt: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 參考號碼列表項目（精簡版）
 */
export interface ReferenceNumberListItem {
  id: string;
  code: string;
  number: string;
  type: ReferenceNumberType;
  status: ReferenceNumberStatus;
  year: number;
  regionCode: string;
  regionName: string;
  matchCount: number;
  isActive: boolean;
  updatedAt: string;
}

/**
 * 建立參考號碼請求
 */
export interface CreateReferenceNumberInput {
  code: string;
  number: string;
  type: ReferenceNumberType;
  year: number;
  regionId: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
}

/**
 * 更新參考號碼請求
 */
export interface UpdateReferenceNumberInput {
  description?: string | null;
  status?: ReferenceNumberStatus;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
}

/**
 * 參考號碼查詢參數
 */
export interface ReferenceNumberQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: ReferenceNumberType | 'all';
  status?: ReferenceNumberStatus | 'all';
  year?: number;
  regionId?: string;
  isActive?: boolean;
  sortBy?: 'number' | 'updatedAt' | 'matchCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 參考號碼列表響應
 */
export interface ReferenceNumberListResponse {
  success: boolean;
  data: ReferenceNumberListItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * 參考號碼詳情響應
 */
export interface ReferenceNumberDetailResponse {
  success: boolean;
  data: ReferenceNumber;
}

/**
 * 批量匯入參考號碼項目
 */
export interface ReferenceNumberImportItem {
  code: string;
  number: string;
  type: ReferenceNumberType;
  year: number;
  regionCode: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
}

/**
 * 批量匯入結果
 */
export interface ReferenceNumberImportResult {
  success: boolean;
  totalCount: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    code: string;
    message: string;
  }>;
}

// ================================
// 輔助函數
// ================================

/**
 * 取得參考號碼類型標籤
 */
export function getReferenceNumberTypeLabel(type: ReferenceNumberType): string {
  return REFERENCE_NUMBER_TYPE_LABELS[type] || type;
}

/**
 * 取得參考號碼狀態標籤
 */
export function getReferenceNumberStatusLabel(status: ReferenceNumberStatus): string {
  return REFERENCE_NUMBER_STATUS_LABELS[status] || status;
}

/**
 * 判斷參考號碼是否有效
 * @param refNumber 參考號碼物件
 * @param checkDate 檢查日期（預設為當前日期）
 */
export function isReferenceNumberValid(
  refNumber: Pick<ReferenceNumber, 'status' | 'isActive' | 'validFrom' | 'validUntil'>,
  checkDate: Date = new Date()
): boolean {
  // 狀態必須為 ACTIVE
  if (refNumber.status !== 'ACTIVE' || !refNumber.isActive) {
    return false;
  }

  // 檢查有效期
  if (refNumber.validFrom) {
    const validFrom = new Date(refNumber.validFrom);
    if (checkDate < validFrom) {
      return false;
    }
  }

  if (refNumber.validUntil) {
    const validUntil = new Date(refNumber.validUntil);
    if (checkDate > validUntil) {
      return false;
    }
  }

  return true;
}

/**
 * 產生參考號碼唯一識別碼
 * 格式: {TYPE}-{REGION}-{YEAR}-{NUMBER}
 */
export function generateReferenceNumberCode(
  type: ReferenceNumberType,
  regionCode: string,
  year: number,
  number: string
): string {
  // 清理號碼中的特殊字符
  const cleanNumber = number.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${type}-${regionCode}-${year}-${cleanNumber}`;
}
