/**
 * @fileoverview Forwarder 列表 Hook
 * @description
 *   使用 React Query 獲取 Forwarder 列表，用於：
 *   - 篩選選單
 *   - 表單選項
 *   - 自動快取管理
 *
 * @module src/hooks/useForwarderList
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'

// ============================================================
// Types
// ============================================================

/**
 * Forwarder 選項
 */
export interface ForwarderOption {
  id: string
  name: string
  code: string
}

/**
 * API 響應
 */
interface ForwardersResponse {
  success: boolean
  data: ForwarderOption[]
}

/**
 * Hook 選項
 */
interface UseForwarderListOptions {
  /** 是否只獲取啟用的 Forwarder */
  activeOnly?: boolean
  /** 是否啟用查詢 */
  enabled?: boolean
  /** React Query 選項 */
  queryOptions?: Omit<
    UseQueryOptions<ForwarderOption[], Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >
}

// ============================================================
// API Function
// ============================================================

/**
 * 獲取 Forwarder 列表
 *
 * @param activeOnly - 是否只獲取啟用的
 * @returns Forwarder 列表
 */
async function fetchForwarderList(
  activeOnly: boolean = true
): Promise<ForwarderOption[]> {
  const url = `/api/forwarders${activeOnly ? '?active=true' : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const result = (await response.json()) as ForwardersResponse

  if (!response.ok || !result.success) {
    throw new Error('Failed to fetch forwarders')
  }

  return result.data
}

// ============================================================
// Hook
// ============================================================

/**
 * Forwarder 列表 Hook
 *
 * @param options - Hook 選項
 * @returns React Query 結果
 *
 * @example
 * ```tsx
 * function ForwarderSelect({ value, onChange }) {
 *   const { data: forwarders, isLoading } = useForwarderList()
 *
 *   return (
 *     <Select value={value} onValueChange={onChange}>
 *       <SelectTrigger>
 *         <SelectValue placeholder="選擇 Forwarder" />
 *       </SelectTrigger>
 *       <SelectContent>
 *         {forwarders?.map((fw) => (
 *           <SelectItem key={fw.id} value={fw.id}>
 *             {fw.name} ({fw.code})
 *           </SelectItem>
 *         ))}
 *       </SelectContent>
 *     </Select>
 *   )
 * }
 * ```
 */
export function useForwarderList(options?: UseForwarderListOptions) {
  const { activeOnly = true, enabled = true, queryOptions } = options ?? {}

  return useQuery<ForwarderOption[], Error>({
    queryKey: ['forwarders', { activeOnly }],
    queryFn: () => fetchForwarderList(activeOnly),
    enabled,
    // Forwarder 列表不常變化，設定較長的 stale time
    staleTime: 10 * 60 * 1000, // 10 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘快取
    ...queryOptions,
  })
}

// ============================================================
// Query Key Factory
// ============================================================

/**
 * Query Key 工廠函數
 */
export const forwarderListKeys = {
  all: ['forwarders'] as const,
  list: (activeOnly: boolean) =>
    [...forwarderListKeys.all, { activeOnly }] as const,
}
