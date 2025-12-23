/**
 * @fileoverview Company List Hook
 * @description
 *   提供公司列表查詢功能：
 *   - 使用 React Query 進行資料獲取和快取
 *   - 支援自動刷新
 *   - 整合 DashboardFilterContext
 *   - 支援 CompanyType 篩選 (REFACTOR-001)
 *
 * @module src/hooks/useCompanyList
 * @since REFACTOR-001: Forwarder → Company
 * @lastModified 2025-12-22
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和快取
 *   - @/types/company-filter - 類型定義
 *
 * @related
 *   - src/app/api/companies/list/route.ts - API 端點
 *   - src/components/dashboard/CompanyMultiSelect.tsx - UI 組件
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type {
  CompanyOption,
  CompanyListResponse,
} from '@/types/company-filter';
import type { CompanyType } from '@/types/company';

// ============================================================
// Re-export Types for backward compatibility
// ============================================================

export type { CompanyOption };

// ============================================================
// Constants
// ============================================================

/**
 * Query key for company list
 */
export const COMPANY_LIST_QUERY_KEY = ['companies', 'list'] as const;

/**
 * Stale time for company list (5 minutes)
 */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Cache time for company list (10 minutes)
 */
const CACHE_TIME = 10 * 60 * 1000;

// ============================================================
// Hook Options
// ============================================================

/**
 * Hook 選項
 */
interface UseCompanyListOptions {
  /** 是否只獲取啟用的 Company（預設 true） */
  activeOnly?: boolean;
  /** 公司類型篩選 (REFACTOR-001) */
  type?: CompanyType;
  /** 是否啟用查詢（預設 true） */
  enabled?: boolean;
  /** 是否在 window focus 時重新獲取 */
  refetchOnWindowFocus?: boolean;
  /** React Query 額外選項 */
  queryOptions?: Omit<
    UseQueryOptions<CompanyOption[], Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

// ============================================================
// API Functions
// ============================================================

/**
 * 獲取公司列表（使用新的 /api/companies/list 端點）
 * @param type - 可選的公司類型篩選
 * @returns 公司列表
 */
async function fetchCompanyListFromApi(type?: CompanyType): Promise<CompanyOption[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);

  const url = params.toString()
    ? `/api/companies/list?${params}`
    : '/api/companies/list';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'Failed to fetch company list');
  }

  const data: CompanyListResponse = await response.json();

  if (!data.success) {
    throw new Error('Failed to fetch company list');
  }

  return data.data;
}

// ============================================================
// Hook
// ============================================================

/**
 * Company 列表 Hook
 * @description 獲取公司列表，支援快取和自動刷新
 * @param options - 查詢選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function CompanySelect({ value, onChange }) {
 *   const { data: companies, isLoading } = useCompanyList()
 *
 *   return (
 *     <Select value={value} onValueChange={onChange}>
 *       <SelectTrigger>
 *         <SelectValue placeholder="選擇公司" />
 *       </SelectTrigger>
 *       <SelectContent>
 *         {companies?.map((company) => (
 *           <SelectItem key={company.id} value={company.id}>
 *             {company.displayName} ({company.code})
 *           </SelectItem>
 *         ))}
 *       </SelectContent>
 *     </Select>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Filter by company type (REFACTOR-001)
 * const { data: forwarders } = useCompanyList({ type: 'FORWARDER' })
 * const { data: exporters } = useCompanyList({ type: 'EXPORTER' })
 * ```
 */
export function useCompanyList(options?: UseCompanyListOptions) {
  const {
    // Note: activeOnly is kept for API compatibility but new endpoint returns active-only by default
    activeOnly: _activeOnly = true,
    type,
    enabled = true,
    refetchOnWindowFocus = false,
    queryOptions,
  } = options ?? {};

  return useQuery<CompanyOption[], Error>({
    queryKey: type ? [...COMPANY_LIST_QUERY_KEY, { type }] : COMPANY_LIST_QUERY_KEY,
    queryFn: () => fetchCompanyListFromApi(type),
    enabled,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus,
    ...queryOptions,
  });
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 */
export const companyListKeys = {
  all: ['companies'] as const,
  list: () => COMPANY_LIST_QUERY_KEY,
  listWithFilter: (activeOnly: boolean) =>
    [...companyListKeys.all, { activeOnly }] as const,
  listByType: (type: CompanyType) =>
    [...COMPANY_LIST_QUERY_KEY, { type }] as const,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 根據 ID 獲取單個公司
 * @param companies - 公司列表
 * @param id - 公司 ID
 * @returns 公司物件或 undefined
 */
export function getCompanyById(
  companies: CompanyOption[],
  id: string
): CompanyOption | undefined {
  return companies.find((c) => c.id === id);
}

/**
 * 根據 IDs 獲取多個公司
 * @param companies - 公司列表
 * @param ids - 公司 ID 列表
 * @returns 公司物件列表
 */
export function getCompaniesByIds(
  companies: CompanyOption[],
  ids: string[]
): CompanyOption[] {
  return companies.filter((c) => ids.includes(c.id));
}

/**
 * 根據 Code 獲取公司
 * @param companies - 公司列表
 * @param code - 公司 Code
 * @returns 公司物件或 undefined
 */
export function getCompanyByCode(
  companies: CompanyOption[],
  code: string
): CompanyOption | undefined {
  return companies.find((c) => c.code === code);
}

/**
 * 根據類型過濾公司
 * @param companies - 公司列表
 * @param type - 公司類型
 * @returns 過濾後的公司物件列表
 */
export function getCompaniesByType(
  companies: CompanyOption[],
  type: CompanyType
): CompanyOption[] {
  return companies.filter((c) => c.type === type);
}

// ============================================================
// Backward Compatibility Aliases (REFACTOR-001)
// ============================================================

/**
 * @deprecated Use COMPANY_LIST_QUERY_KEY instead (REFACTOR-001)
 */
export const FORWARDER_LIST_QUERY_KEY = COMPANY_LIST_QUERY_KEY;

/**
 * @deprecated Use UseCompanyListOptions instead (REFACTOR-001)
 */
export type UseForwarderListOptions = UseCompanyListOptions;

/**
 * @deprecated Use useCompanyList instead (REFACTOR-001)
 */
export const useForwarderList = useCompanyList;

/**
 * @deprecated Use companyListKeys instead (REFACTOR-001)
 */
export const forwarderListKeys = companyListKeys;

/**
 * @deprecated Use getCompanyById instead (REFACTOR-001)
 */
export const getForwarderById = getCompanyById;

/**
 * @deprecated Use getCompaniesByIds instead (REFACTOR-001)
 */
export const getForwardersByIds = getCompaniesByIds;

/**
 * @deprecated Use getCompanyByCode instead (REFACTOR-001)
 */
export const getForwarderByCode = getCompanyByCode;

// Re-export ForwarderOption for backward compatibility
export type { CompanyOption as ForwarderOption };
