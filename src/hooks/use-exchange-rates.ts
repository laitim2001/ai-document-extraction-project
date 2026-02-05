'use client'

/**
 * @fileoverview Exchange Rate 查詢與操作 Hooks
 * @description
 *   提供客戶端 Exchange Rate CRUD 操作功能。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   主要功能：
 *   - useExchangeRates: 列表查詢（支援分頁、篩選、排序）
 *   - useExchangeRate: 單一記錄查詢（含反向匯率資訊）
 *   - useCreateExchangeRate: 建立新記錄（含可選反向匯率）
 *   - useUpdateExchangeRate: 更新記錄（部分更新）
 *   - useDeleteExchangeRate: 刪除記錄（含反向記錄級聯刪除）
 *   - useToggleExchangeRate: 切換啟用/停用狀態
 *
 * @module src/hooks/use-exchange-rates
 * @since Epic 21 - Story 21.3
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @related
 *   - src/lib/validations/exchange-rate.schema.ts - 驗證 Schema
 *   - src/app/api/v1/exchange-rates/ - API 端點
 *   - src/services/exchange-rate.service.ts - 服務層
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================================
// 類型定義
// ============================================================

/**
 * Exchange Rate 列表項目
 */
export interface ExchangeRateItem {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveYear: number
  effectiveFrom: string | null
  effectiveTo: string | null
  isActive: boolean
  source: string
  inverseOfId: string | null
  description: string | null
  createdById: string | null
  hasInverse: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Exchange Rate 詳情（含反向匯率資訊）
 */
export interface ExchangeRateDetail extends ExchangeRateItem {
  inverseRate?: {
    id: string
    rate: number
  }
}

/**
 * 分頁資訊
 */
interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Exchange Rate 列表 API 響應
 */
interface ExchangeRateListResponse {
  success: boolean
  data?: ExchangeRateItem[]
  meta?: {
    pagination: PaginationInfo
  }
  type?: string
  title?: string
  status?: number
  detail?: string
}

/**
 * Exchange Rate 單一 API 響應
 */
interface ExchangeRateResponse {
  success: boolean
  data?: ExchangeRateDetail
  type?: string
  title?: string
  status?: number
  detail?: string
}

/**
 * 操作 API 響應
 */
interface OperationResponse {
  success: boolean
  type?: string
  title?: string
  status?: number
  detail?: string
}

/**
 * Exchange Rate 查詢參數
 */
export interface ExchangeRateQueryParams {
  page?: number
  limit?: number
  year?: number
  fromCurrency?: string
  toCurrency?: string
  isActive?: boolean
  source?: 'MANUAL' | 'IMPORTED' | 'AUTO_INVERSE'
  sortBy?: 'fromCurrency' | 'toCurrency' | 'rate' | 'effectiveYear' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 建立 Exchange Rate 輸入
 */
export interface CreateExchangeRateInput {
  fromCurrency: string
  toCurrency: string
  rate: number | string
  effectiveYear: number
  effectiveFrom?: string
  effectiveTo?: string
  description?: string
  createInverse?: boolean
}

/**
 * 更新 Exchange Rate 輸入
 */
export interface UpdateExchangeRateInput {
  rate?: number | string
  effectiveFrom?: string | null
  effectiveTo?: string | null
  description?: string | null
  isActive?: boolean
}

// ============================================================
// Constants
// ============================================================

/** Query Key 前綴 */
const QUERY_KEY = 'exchange-rates'

// ============================================================
// API 函數
// ============================================================

/**
 * 從 API 獲取 Exchange Rate 列表
 */
async function fetchExchangeRates(
  params: ExchangeRateQueryParams
): Promise<{ items: ExchangeRateItem[]; pagination: PaginationInfo }> {
  const url = new URL('/api/v1/exchange-rates', window.location.origin)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  const response = await fetch(url.toString())
  const json: ExchangeRateListResponse = await response.json()

  if (!response.ok || !json.success) {
    throw new Error(json.detail || 'Failed to fetch exchange rates')
  }

  return {
    items: json.data ?? [],
    pagination: json.meta?.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  }
}

/**
 * 從 API 獲取單一 Exchange Rate
 */
async function fetchExchangeRate(id: string): Promise<ExchangeRateDetail> {
  const response = await fetch(`/api/v1/exchange-rates/${id}`)
  const json: ExchangeRateResponse = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.detail || 'Failed to fetch exchange rate')
  }

  return json.data
}

/**
 * 建立新 Exchange Rate
 */
async function createExchangeRateApi(
  input: CreateExchangeRateInput
): Promise<ExchangeRateDetail> {
  const response = await fetch('/api/v1/exchange-rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json: ExchangeRateResponse = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.detail || 'Failed to create exchange rate')
  }

  return json.data
}

/**
 * 更新 Exchange Rate
 */
async function updateExchangeRateApi(
  id: string,
  input: UpdateExchangeRateInput
): Promise<ExchangeRateDetail> {
  const response = await fetch(`/api/v1/exchange-rates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json: ExchangeRateResponse = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.detail || 'Failed to update exchange rate')
  }

  return json.data
}

/**
 * 刪除 Exchange Rate（含反向記錄級聯刪除）
 */
async function deleteExchangeRateApi(id: string): Promise<void> {
  const response = await fetch(`/api/v1/exchange-rates/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const json: OperationResponse = await response.json()
    throw new Error(json.detail || 'Failed to delete exchange rate')
  }
}

/**
 * 切換 Exchange Rate 啟用狀態
 */
async function toggleExchangeRateApi(id: string): Promise<ExchangeRateDetail> {
  const response = await fetch(`/api/v1/exchange-rates/${id}/toggle`, {
    method: 'POST',
  })

  const json: ExchangeRateResponse = await response.json()

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.detail || 'Failed to toggle exchange rate')
  }

  return json.data
}

// ============================================================
// Hooks
// ============================================================

/**
 * Exchange Rate 列表查詢 Hook
 *
 * @param params - 查詢參數（分頁、篩選、排序）
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data, isLoading } = useExchangeRates({ year: 2026 })
 *   const items = data?.items ?? []
 *   const pagination = data?.pagination
 */
export function useExchangeRates(params: ExchangeRateQueryParams = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => fetchExchangeRates(params),
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 30 * 60 * 1000, // 30 分鐘
  })
}

/**
 * 單一 Exchange Rate 查詢 Hook
 *
 * @param id - Exchange Rate ID
 * @returns React Query 查詢結果
 *
 * @example
 *   const { data: item, isLoading } = useExchangeRate('xxx-id')
 */
export function useExchangeRate(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => fetchExchangeRate(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * 建立 Exchange Rate Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: create, isPending } = useCreateExchangeRate()
 *   create({ fromCurrency: 'HKD', toCurrency: 'USD', rate: 0.128, effectiveYear: 2026 })
 */
export function useCreateExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createExchangeRateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

/**
 * 更新 Exchange Rate Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: update, isPending } = useUpdateExchangeRate()
 *   update({ id: 'xxx', input: { rate: 0.129 } })
 */
export function useUpdateExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExchangeRateInput }) =>
      updateExchangeRateApi(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

/**
 * 刪除 Exchange Rate Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: remove, isPending } = useDeleteExchangeRate()
 *   remove('xxx-id')
 */
export function useDeleteExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteExchangeRateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

/**
 * 切換 Exchange Rate 啟用狀態 Mutation Hook
 *
 * @returns React Query mutation 結果
 *
 * @example
 *   const { mutate: toggle, isPending } = useToggleExchangeRate()
 *   toggle('xxx-id')
 */
export function useToggleExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: toggleExchangeRateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}
