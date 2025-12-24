/**
 * @fileoverview 待審核公司查詢 Hook
 * @description
 *   提供待審核公司列表的查詢和管理功能。
 *
 * @module src/hooks/use-pending-companies
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 分頁查詢
 *   - 自動刷新
 *   - 錯誤處理
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *
 * @related
 *   - src/app/api/admin/companies/pending/route.ts - API 端點
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CompanyType, CompanyStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

export interface PossibleDuplicate {
  id: string
  name: string
  matchScore: number
  matchedName: string
}

export interface PendingCompany {
  id: string
  name: string
  displayName: string
  type: CompanyType
  status: CompanyStatus
  source: string
  documentCount: number
  firstSeenAt: string
  possibleDuplicates: PossibleDuplicate[]
}

export interface PendingCompaniesResponse {
  success: boolean
  data?: {
    companies: PendingCompany[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  error?: string
}

export interface UpdateCompanyRequest {
  type?: CompanyType
  status?: CompanyStatus
  displayName?: string
  description?: string
}

export interface MergeCompaniesRequest {
  primaryId: string
  secondaryIds: string[]
}

// ============================================================
// API Functions
// ============================================================

async function fetchPendingCompanies(
  page: number,
  limit: number
): Promise<PendingCompaniesResponse> {
  const response = await fetch(
    `/api/admin/companies/pending?page=${page}&limit=${limit}`
  )
  if (!response.ok) {
    throw new Error('獲取待審核公司列表失敗')
  }
  return response.json()
}

async function updateCompany(
  id: string,
  data: UpdateCompanyRequest
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const response = await fetch(`/api/admin/companies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '更新公司失敗')
  }
  return response.json()
}

async function mergeCompanies(
  data: MergeCompaniesRequest
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const response = await fetch('/api/admin/companies/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '合併公司失敗')
  }
  return response.json()
}

// ============================================================
// Hooks
// ============================================================

/**
 * 待審核公司列表查詢 Hook
 *
 * @param options - 查詢選項
 * @returns 待審核公司列表和分頁資訊
 */
export function usePendingCompanies(
  options: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 20 } = options

  return useQuery({
    queryKey: ['pending-companies', page, limit],
    queryFn: () => fetchPendingCompanies(page, limit),
    staleTime: 30 * 1000, // 30 秒
  })
}

/**
 * 更新公司 Mutation Hook
 *
 * @returns 更新公司的 mutation
 */
export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyRequest }) =>
      updateCompany(id, data),
    onSuccess: () => {
      // 刷新待審核列表
      queryClient.invalidateQueries({ queryKey: ['pending-companies'] })
    },
  })
}

/**
 * 合併公司 Mutation Hook
 *
 * @returns 合併公司的 mutation
 */
export function useMergeCompanies() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: mergeCompanies,
    onSuccess: () => {
      // 刷新待審核列表
      queryClient.invalidateQueries({ queryKey: ['pending-companies'] })
    },
  })
}
