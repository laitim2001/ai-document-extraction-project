'use client'

/**
 * @fileoverview 系統配置管理 Hooks
 * @description
 *   提供客戶端系統配置管理功能，包含查詢、更新、回滾等操作。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - 配置列表查詢（支援類別和搜尋過濾）
 *   - 單一配置詳情查詢
 *   - 配置值更新
 *   - 配置歷史查詢
 *   - 配置回滾
 *   - 配置重置為預設值
 *   - 配置快取重新載入
 *   - 配置匯出/匯入
 *
 * @module src/hooks/use-system-config
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *   - @/types/config - 配置類型定義
 *
 * @example
 *   // 查詢配置列表
 *   const { data, isLoading } = useConfigs({ category: 'PROCESSING' })
 *
 *   // 更新配置
 *   const { mutate: updateConfig, isPending } = useUpdateConfig()
 *   updateConfig({ key: 'processing.confidence.threshold', value: 0.85 })
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type {
  ConfigValue,
  ConfigListOptions,
  ConfigCategory,
  ConfigHistoryItem,
  ConfigUpdateInput,
  ConfigImportResult,
} from '@/types/config'

// ============================================================
// Query Keys
// ============================================================

/**
 * 配置相關查詢鍵
 */
export const configQueryKeys = {
  all: ['configs'] as const,
  lists: () => [...configQueryKeys.all, 'list'] as const,
  list: (options: ConfigListOptions) => [...configQueryKeys.lists(), options] as const,
  details: () => [...configQueryKeys.all, 'detail'] as const,
  detail: (key: string) => [...configQueryKeys.details(), key] as const,
  histories: () => [...configQueryKeys.all, 'history'] as const,
  history: (key: string, options?: ConfigHistoryOptions) =>
    [...configQueryKeys.histories(), key, options] as const,
}

// ============================================================
// Types
// ============================================================

/**
 * 配置列表查詢參數
 */
export interface UseConfigsParams {
  /** 配置類別 */
  category?: ConfigCategory
  /** 搜尋關鍵字 */
  search?: string
  /** 是否包含唯讀配置 */
  includeReadOnly?: boolean
  /** 是否啟用查詢 */
  enabled?: boolean
}

/**
 * 配置歷史查詢選項
 */
export interface ConfigHistoryOptions {
  /** 限制返回數量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 配置列表 API 響應
 */
interface ConfigListApiResponse {
  success: boolean
  data?: ConfigValue[]
  meta?: {
    total: number
  }
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 單一配置 API 響應
 */
interface ConfigDetailApiResponse {
  success: boolean
  data?: ConfigValue
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 配置歷史 API 響應
 */
interface ConfigHistoryApiResponse {
  success: boolean
  data?: ConfigHistoryItem[]
  meta?: {
    total: number
    limit: number
    offset: number
  }
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 配置操作 API 響應
 */
interface ConfigOperationApiResponse {
  success: boolean
  message?: string
  requiresRestart?: boolean
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 配置匯出 API 響應
 */
interface ConfigExportApiResponse {
  success: boolean
  data?: {
    exportedAt: string
    exportedBy: string
    configs: Record<string, unknown>
  }
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

/**
 * 配置匯入 API 響應
 */
interface ConfigImportApiResponse {
  success: boolean
  message?: string
  data?: ConfigImportResult
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

// ============================================================
// Fetch Functions
// ============================================================

/**
 * 從 API 獲取配置列表
 */
async function fetchConfigs(params: UseConfigsParams): Promise<ConfigListApiResponse> {
  const searchParams = new URLSearchParams()

  if (params.category) {
    searchParams.set('category', params.category)
  }
  if (params.search) {
    searchParams.set('search', params.search)
  }
  if (params.includeReadOnly !== undefined) {
    searchParams.set('includeReadOnly', String(params.includeReadOnly))
  }

  const response = await fetch(`/api/admin/config?${searchParams}`)
  const json: ConfigListApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '取得配置列表失敗')
  }

  return json
}

/**
 * 從 API 獲取單一配置
 */
async function fetchConfig(key: string): Promise<ConfigDetailApiResponse> {
  const encodedKey = encodeURIComponent(key)
  const response = await fetch(`/api/admin/config/${encodedKey}`)
  const json: ConfigDetailApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '取得配置失敗')
  }

  return json
}

/**
 * 從 API 獲取配置歷史
 */
async function fetchConfigHistory(
  key: string,
  options?: ConfigHistoryOptions
): Promise<ConfigHistoryApiResponse> {
  const searchParams = new URLSearchParams()

  if (options?.limit !== undefined) {
    searchParams.set('limit', String(options.limit))
  }
  if (options?.offset !== undefined) {
    searchParams.set('offset', String(options.offset))
  }

  const encodedKey = encodeURIComponent(key)
  const response = await fetch(`/api/admin/config/${encodedKey}/history?${searchParams}`)
  const json: ConfigHistoryApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '取得配置歷史失敗')
  }

  return json
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * 配置列表查詢 Hook
 *
 * @description
 *   使用 React Query 管理配置列表的獲取、緩存和狀態。
 *   支援類別過濾和關鍵字搜尋。
 *
 * @param params - 查詢參數
 * @returns React Query 查詢結果
 *
 * @example
 *   // 基本用法
 *   const { data, isLoading } = useConfigs({})
 *
 *   // 按類別過濾
 *   const { data } = useConfigs({ category: 'PROCESSING' })
 *
 *   // 帶搜尋
 *   const { data } = useConfigs({ search: 'confidence' })
 */
export function useConfigs(params: UseConfigsParams = {}) {
  const { enabled = true, ...queryParams } = params

  return useQuery({
    queryKey: configQueryKeys.list(queryParams),
    queryFn: () => fetchConfigs(queryParams),
    enabled,
    staleTime: 30 * 1000, // 30 秒
    placeholderData: keepPreviousData,
  })
}

/**
 * 單一配置查詢 Hook
 *
 * @description
 *   使用 React Query 獲取單一配置詳情。
 *
 * @param key - 配置鍵
 * @param options - 查詢選項
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useConfig('processing.confidence.threshold')
 *   const config = data?.data
 */
export function useConfig(key: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: configQueryKeys.detail(key),
    queryFn: () => fetchConfig(key),
    enabled: options?.enabled ?? !!key,
    staleTime: 30 * 1000,
  })
}

/**
 * 配置歷史查詢 Hook
 *
 * @description
 *   使用 React Query 獲取配置變更歷史記錄。
 *   支援分頁。
 *
 * @param key - 配置鍵
 * @param options - 查詢選項
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useConfigHistory('processing.confidence.threshold', {
 *     limit: 20,
 *     offset: 0,
 *   })
 */
export function useConfigHistory(
  key: string,
  options?: ConfigHistoryOptions & { enabled?: boolean }
) {
  const { enabled = true, ...historyOptions } = options || {}

  return useQuery({
    queryKey: configQueryKeys.history(key, historyOptions),
    queryFn: () => fetchConfigHistory(key, historyOptions),
    enabled: enabled && !!key,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 更新配置輸入
 */
interface UpdateConfigInput {
  /** 配置鍵 */
  key: string
  /** 更新資料 */
  data: ConfigUpdateInput
}

/**
 * 更新配置 API 呼叫
 */
async function updateConfigRequest(input: UpdateConfigInput): Promise<ConfigOperationApiResponse> {
  const encodedKey = encodeURIComponent(input.key)
  const response = await fetch(`/api/admin/config/${encodedKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.data),
  })

  const json: ConfigOperationApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '更新配置失敗')
  }

  return json
}

/**
 * 更新配置 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理配置更新操作。
 *   成功後自動刷新配置列表和單一配置詳情。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: updateConfig, isPending, data } = useUpdateConfig()
 *
 *   const handleSubmit = (key: string, value: unknown) => {
 *     updateConfig(
 *       { key, data: { value, changeReason: 'Updated via admin panel' } },
 *       {
 *         onSuccess: (res) => {
 *           if (res.requiresRestart) {
 *             toast({ title: '配置已更新', description: '需要重啟服務才能生效' })
 *           } else {
 *             toast({ title: '配置已更新' })
 *           }
 *         },
 *         onError: (error) => toast({ title: '錯誤', description: error.message }),
 *       }
 *     )
 *   }
 */
export function useUpdateConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateConfigRequest,
    onSuccess: (_data, variables) => {
      // 成功後刷新配置列表和單一配置詳情
      queryClient.invalidateQueries({ queryKey: configQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.detail(variables.key) })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.history(variables.key) })
    },
  })
}

/**
 * 回滾配置輸入
 */
interface RollbackConfigInput {
  /** 配置鍵 */
  key: string
  /** 歷史記錄 ID */
  historyId: string
  /** 回滾原因 */
  reason?: string
}

/**
 * 回滾配置 API 呼叫
 */
async function rollbackConfigRequest(
  input: RollbackConfigInput
): Promise<ConfigOperationApiResponse> {
  const encodedKey = encodeURIComponent(input.key)
  const response = await fetch(`/api/admin/config/${encodedKey}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      historyId: input.historyId,
      reason: input.reason,
    }),
  })

  const json: ConfigOperationApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '回滾配置失敗')
  }

  return json
}

/**
 * 回滾配置 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理配置回滾操作。
 *   成功後自動刷新配置列表和歷史記錄。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: rollbackConfig, isPending } = useRollbackConfig()
 *
 *   const handleRollback = (key: string, historyId: string) => {
 *     rollbackConfig(
 *       { key, historyId, reason: 'Rollback due to issue' },
 *       {
 *         onSuccess: () => toast({ title: '配置已回滾' }),
 *         onError: (error) => toast({ title: '錯誤', description: error.message }),
 *       }
 *     )
 *   }
 */
export function useRollbackConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: rollbackConfigRequest,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: configQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.detail(variables.key) })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.history(variables.key) })
    },
  })
}

/**
 * 重置配置輸入
 */
interface ResetConfigInput {
  /** 配置鍵 */
  key: string
  /** 重置原因 */
  reason?: string
}

/**
 * 重置配置 API 呼叫
 */
async function resetConfigRequest(input: ResetConfigInput): Promise<ConfigOperationApiResponse> {
  const encodedKey = encodeURIComponent(input.key)
  const response = await fetch(`/api/admin/config/${encodedKey}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: input.reason }),
  })

  const json: ConfigOperationApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '重置配置失敗')
  }

  return json
}

/**
 * 重置配置為預設值 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理配置重置操作。
 *   將配置值重置為預設值。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: resetConfig, isPending } = useResetConfig()
 *
 *   const handleReset = (key: string) => {
 *     resetConfig(
 *       { key, reason: 'Reset to default' },
 *       {
 *         onSuccess: () => toast({ title: '配置已重置為預設值' }),
 *         onError: (error) => toast({ title: '錯誤', description: error.message }),
 *       }
 *     )
 *   }
 */
export function useResetConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetConfigRequest,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: configQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.detail(variables.key) })
      queryClient.invalidateQueries({ queryKey: configQueryKeys.history(variables.key) })
    },
  })
}

/**
 * 重新載入配置快取 API 呼叫
 */
async function reloadConfigsRequest(): Promise<ConfigOperationApiResponse> {
  const response = await fetch('/api/admin/config/reload', {
    method: 'POST',
  })

  const json: ConfigOperationApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '重新載入配置失敗')
  }

  return json
}

/**
 * 重新載入配置快取 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理配置快取重新載入操作。
 *   成功後自動刷新所有配置相關查詢。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: reloadConfigs, isPending } = useReloadConfigs()
 *
 *   const handleReload = () => {
 *     reloadConfigs(undefined, {
 *       onSuccess: () => toast({ title: '配置快取已重新載入' }),
 *       onError: (error) => toast({ title: '錯誤', description: error.message }),
 *     })
 *   }
 */
export function useReloadConfigs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reloadConfigsRequest,
    onSuccess: () => {
      // 刷新所有配置相關查詢
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
    },
  })
}

/**
 * 匯出配置 API 呼叫
 */
async function exportConfigsRequest(): Promise<ConfigExportApiResponse> {
  const response = await fetch('/api/admin/config/export', {
    method: 'POST',
  })

  const json: ConfigExportApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '匯出配置失敗')
  }

  return json
}

/**
 * 匯出配置 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理配置匯出操作。
 *   匯出所有非敏感配置為 JSON 格式。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: exportConfigs, isPending, data } = useExportConfigs()
 *
 *   const handleExport = () => {
 *     exportConfigs(undefined, {
 *       onSuccess: (res) => {
 *         // 下載 JSON 文件
 *         const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
 *         const url = URL.createObjectURL(blob)
 *         const a = document.createElement('a')
 *         a.href = url
 *         a.download = `config-export-${new Date().toISOString()}.json`
 *         a.click()
 *       },
 *       onError: (error) => toast({ title: '錯誤', description: error.message }),
 *     })
 *   }
 */
export function useExportConfigs() {
  return useMutation({
    mutationFn: exportConfigsRequest,
  })
}

/**
 * 匯入配置輸入
 */
interface ImportConfigsInput {
  /** 配置鍵值對 */
  configs: Record<string, unknown>
}

/**
 * 匯入配置 API 呼叫
 */
async function importConfigsRequest(input: ImportConfigsInput): Promise<ConfigImportApiResponse> {
  const response = await fetch('/api/admin/config/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json: ConfigImportApiResponse = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || '匯入配置失敗')
  }

  return json
}

/**
 * 匯入配置 Mutation Hook
 *
 * @description
 *   使用 React Query 的 useMutation 管理配置匯入操作。
 *   從 JSON 格式匯入配置，只會更新已存在的配置。
 *
 * @returns React Query Mutation 結果
 *
 * @example
 *   const { mutate: importConfigs, isPending, data } = useImportConfigs()
 *
 *   const handleImport = (file: File) => {
 *     const reader = new FileReader()
 *     reader.onload = (e) => {
 *       const configs = JSON.parse(e.target?.result as string)
 *       importConfigs(
 *         { configs },
 *         {
 *           onSuccess: (res) => {
 *             toast({
 *               title: '匯入完成',
 *               description: `已匯入 ${res.data?.imported} 項，跳過 ${res.data?.skipped} 項`,
 *             })
 *           },
 *           onError: (error) => toast({ title: '錯誤', description: error.message }),
 *         }
 *       )
 *     }
 *     reader.readAsText(file)
 *   }
 */
export function useImportConfigs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: importConfigsRequest,
    onSuccess: () => {
      // 成功後刷新所有配置相關查詢
      queryClient.invalidateQueries({ queryKey: configQueryKeys.all })
    },
  })
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * 獲取配置值的便捷 Hook
 *
 * @description
 *   便捷取得單一配置的值，自動處理 loading 和 error 狀態。
 *
 * @param key - 配置鍵
 * @param defaultValue - 預設值
 * @returns 配置值或預設值
 *
 * @example
 *   const threshold = useConfigValue<number>('processing.confidence.threshold', 0.8)
 */
export function useConfigValue<T>(key: string, defaultValue: T): T {
  const { data } = useConfig(key)
  return (data?.data?.value as T) ?? defaultValue
}
