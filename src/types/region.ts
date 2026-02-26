/**
 * @fileoverview 地區類型定義
 * @description
 *   定義地區配置的相關類型，用於 Reference Number 管理系統。
 *   包含 Region 的 API 請求/響應類型和輔助函數。
 *
 * @module src/types/region
 * @author Development Team
 * @since Epic 20 - Story 20.1 (Reference Number Master Setup)
 * @lastModified 2026-02-04
 */

/**
 * 地區完整資訊
 */
export interface Region {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE';
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 地區列表項目（精簡版）
 */
export interface RegionListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

/**
 * 地區下拉選項
 */
export interface RegionOption {
  value: string;
  label: string;
  code: string;
  isDefault: boolean;
}

/**
 * 建立地區請求
 */
export interface CreateRegionInput {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  timezone?: string;
  sortOrder?: number;
}

/**
 * 更新地區請求
 */
export interface UpdateRegionInput {
  name?: string;
  description?: string | null;
  timezone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  sortOrder?: number;
}

/**
 * 地區查詢參數
 */
export interface RegionQueryParams {
  status?: 'ACTIVE' | 'INACTIVE' | 'all';
  includeDefault?: boolean;
  parentId?: string;
}

/**
 * 地區列表響應
 */
export interface RegionListResponse {
  success: boolean;
  data: RegionListItem[];
  meta?: {
    total: number;
  };
}

/**
 * 預設地區代碼
 */
export const DEFAULT_REGION_CODES = ['GLOBAL', 'APAC', 'EMEA', 'AMER'] as const;

export type DefaultRegionCode = (typeof DEFAULT_REGION_CODES)[number];

/**
 * 地區代碼對應名稱
 */
export const REGION_CODE_LABELS: Record<DefaultRegionCode, string> = {
  GLOBAL: '全球',
  APAC: '亞太',
  EMEA: '歐非中東',
  AMER: '美洲',
};

/**
 * 判斷是否為預設地區
 */
export function isDefaultRegion(code: string): code is DefaultRegionCode {
  return DEFAULT_REGION_CODES.includes(code as DefaultRegionCode);
}

/**
 * 取得地區顯示名稱
 */
export function getRegionDisplayName(code: string, name: string): string {
  if (isDefaultRegion(code)) {
    return `${name} (${REGION_CODE_LABELS[code]})`;
  }
  return name;
}
