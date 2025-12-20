/**
 * @fileoverview 資料保留 React Query Hooks
 * @description
 *   提供資料保留相關的資料獲取和操作 Hooks：
 *   - useRetentionPolicies: 取得保留策略列表
 *   - useRetentionPolicy: 取得保留策略詳情
 *   - useCreateRetentionPolicy: 建立保留策略
 *   - useUpdateRetentionPolicy: 更新保留策略
 *   - useDeleteRetentionPolicy: 刪除保留策略
 *   - useArchiveRecords: 取得歸檔記錄列表
 *   - useRunArchiveJob: 執行歸檔任務
 *   - useRestoreRequests: 取得還原請求列表
 *   - useRestoreFromArchive: 發起還原請求
 *   - useDeletionRequests: 取得刪除請求列表
 *   - useCreateDeletionRequest: 建立刪除請求
 *   - useApproveDeletionRequest: 審批刪除請求
 *   - useStorageMetrics: 取得存儲指標
 *
 * @module src/hooks/useRetention
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @tanstack/react-query - 資料獲取
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import type {
  RetentionPoliciesResponse,
  RetentionPolicyWithRelations,
  ArchiveRecordsResponse,
  ArchiveJobResult,
  RestoreRequestsResponse,
  RestoreResult,
  DeletionRequestsResponse,
  StorageMetrics,
  RetentionPolicyFormData,
  DeletionRequestFormData,
  RestoreRequestFormData,
  ArchiveQueryParams,
  DeletionQueryParams,
  RestoreQueryParams,
} from '@/types/retention'
import type { DataType } from '@prisma/client'
import type { DataRetentionPolicy, DataDeletionRequest } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface PolicyListParams {
  page?: number
  limit?: number
  dataType?: DataType
  isActive?: boolean
}

interface RunArchiveParams {
  policyId: string
  dateRangeStart: Date
  dateRangeEnd: Date
}

interface ApprovalParams {
  requestId: string
  approve: boolean
  rejectionReason?: string
}

interface ApprovalResult {
  request: DataDeletionRequest
  deletedCount?: number
}

// ============================================================
// API Functions
// ============================================================

async function fetchPolicies(params: PolicyListParams): Promise<RetentionPoliciesResponse> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.dataType) searchParams.set('dataType', params.dataType)
  if (params.isActive !== undefined) searchParams.set('isActive', params.isActive.toString())

  const response = await fetch(`/api/admin/retention/policies?${searchParams}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch policies')
  }

  return response.json()
}

async function fetchPolicy(id: string): Promise<RetentionPolicyWithRelations> {
  const response = await fetch(`/api/admin/retention/policies/${id}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch policy')
  }

  const data = await response.json()
  return data.data
}

async function createPolicy(data: RetentionPolicyFormData): Promise<DataRetentionPolicy> {
  const response = await fetch('/api/admin/retention/policies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create policy')
  }

  const result = await response.json()
  return result.data
}

async function updatePolicy(
  id: string,
  data: Partial<RetentionPolicyFormData>
): Promise<DataRetentionPolicy> {
  const response = await fetch(`/api/admin/retention/policies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to update policy')
  }

  const result = await response.json()
  return result.data
}

async function deletePolicy(id: string): Promise<void> {
  const response = await fetch(`/api/admin/retention/policies/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete policy')
  }
}

async function fetchArchiveRecords(
  params: ArchiveQueryParams
): Promise<ArchiveRecordsResponse> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.policyId) searchParams.set('policyId', params.policyId)
  if (params.dataType) searchParams.set('dataType', params.dataType)
  if (params.storageTier) searchParams.set('storageTier', params.storageTier)
  if (params.status) searchParams.set('status', params.status)
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom.toISOString())
  if (params.dateTo) searchParams.set('dateTo', params.dateTo.toISOString())

  const response = await fetch(`/api/admin/retention/archives?${searchParams}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch archive records')
  }

  return response.json()
}

async function runArchiveJob(params: RunArchiveParams): Promise<ArchiveJobResult> {
  const response = await fetch('/api/admin/retention/archives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to run archive job')
  }

  const result = await response.json()
  return result.data
}

async function fetchRestoreRequests(
  params: RestoreQueryParams
): Promise<RestoreRequestsResponse> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.archiveRecordId) searchParams.set('archiveRecordId', params.archiveRecordId)
  if (params.status) searchParams.set('status', params.status)
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom.toISOString())
  if (params.dateTo) searchParams.set('dateTo', params.dateTo.toISOString())

  const response = await fetch(`/api/admin/retention/restore?${searchParams}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch restore requests')
  }

  return response.json()
}

async function restoreFromArchive(data: RestoreRequestFormData): Promise<RestoreResult> {
  const response = await fetch('/api/admin/retention/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to submit restore request')
  }

  const result = await response.json()
  return result.data
}

async function fetchDeletionRequests(
  params: DeletionQueryParams
): Promise<DeletionRequestsResponse> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.policyId) searchParams.set('policyId', params.policyId)
  if (params.dataType) searchParams.set('dataType', params.dataType)
  if (params.status) searchParams.set('status', params.status)
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom.toISOString())
  if (params.dateTo) searchParams.set('dateTo', params.dateTo.toISOString())

  const response = await fetch(`/api/admin/retention/deletion?${searchParams}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch deletion requests')
  }

  return response.json()
}

async function createDeletionRequest(
  data: DeletionRequestFormData
): Promise<DataDeletionRequest> {
  const response = await fetch('/api/admin/retention/deletion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create deletion request')
  }

  const result = await response.json()
  return result.data
}

async function approveDeletionRequest(params: ApprovalParams): Promise<ApprovalResult> {
  const { requestId, ...body } = params
  const response = await fetch(`/api/admin/retention/deletion/${requestId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to approve deletion request')
  }

  const result = await response.json()
  return result.data
}

async function fetchStorageMetrics(): Promise<StorageMetrics> {
  const response = await fetch('/api/admin/retention/metrics')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch storage metrics')
  }

  const result = await response.json()
  return result.data
}

// ============================================================
// Query Keys
// ============================================================

export const retentionKeys = {
  all: ['retention'] as const,
  policies: () => [...retentionKeys.all, 'policies'] as const,
  policyList: (params: PolicyListParams) => [...retentionKeys.policies(), 'list', params] as const,
  policyDetail: (id: string) => [...retentionKeys.policies(), 'detail', id] as const,
  archives: () => [...retentionKeys.all, 'archives'] as const,
  archiveList: (params: ArchiveQueryParams) => [...retentionKeys.archives(), 'list', params] as const,
  restores: () => [...retentionKeys.all, 'restores'] as const,
  restoreList: (params: RestoreQueryParams) => [...retentionKeys.restores(), 'list', params] as const,
  deletions: () => [...retentionKeys.all, 'deletions'] as const,
  deletionList: (params: DeletionQueryParams) => [...retentionKeys.deletions(), 'list', params] as const,
  metrics: () => [...retentionKeys.all, 'metrics'] as const,
}

// ============================================================
// Policy Hooks
// ============================================================

/**
 * 取得保留策略列表
 */
export function useRetentionPolicies(
  params: PolicyListParams = {},
  options?: Omit<UseQueryOptions<RetentionPoliciesResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: retentionKeys.policyList(params),
    queryFn: () => fetchPolicies(params),
    ...options,
  })
}

/**
 * 取得保留策略詳情
 */
export function useRetentionPolicy(
  id: string,
  options?: Omit<UseQueryOptions<RetentionPolicyWithRelations>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: retentionKeys.policyDetail(id),
    queryFn: () => fetchPolicy(id),
    enabled: !!id,
    ...options,
  })
}

/**
 * 建立保留策略
 */
export function useCreateRetentionPolicy(
  options?: UseMutationOptions<DataRetentionPolicy, Error, RetentionPolicyFormData>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.policies() })
    },
    ...options,
  })
}

/**
 * 更新保留策略
 */
export function useUpdateRetentionPolicy(
  options?: UseMutationOptions<
    DataRetentionPolicy,
    Error,
    { id: string; data: Partial<RetentionPolicyFormData> }
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => updatePolicy(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.policies() })
      queryClient.invalidateQueries({ queryKey: retentionKeys.policyDetail(id) })
    },
    ...options,
  })
}

/**
 * 刪除保留策略
 */
export function useDeleteRetentionPolicy(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.policies() })
    },
    ...options,
  })
}

// ============================================================
// Archive Hooks
// ============================================================

/**
 * 取得歸檔記錄列表
 */
export function useArchiveRecords(
  params: ArchiveQueryParams = {},
  options?: Omit<UseQueryOptions<ArchiveRecordsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: retentionKeys.archiveList(params),
    queryFn: () => fetchArchiveRecords(params),
    ...options,
  })
}

/**
 * 執行歸檔任務
 */
export function useRunArchiveJob(
  options?: UseMutationOptions<ArchiveJobResult, Error, RunArchiveParams>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runArchiveJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.archives() })
      queryClient.invalidateQueries({ queryKey: retentionKeys.metrics() })
    },
    ...options,
  })
}

// ============================================================
// Restore Hooks
// ============================================================

/**
 * 取得還原請求列表
 */
export function useRestoreRequests(
  params: RestoreQueryParams = {},
  options?: Omit<UseQueryOptions<RestoreRequestsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: retentionKeys.restoreList(params),
    queryFn: () => fetchRestoreRequests(params),
    refetchInterval: (query) => {
      // 如果有處理中的還原請求，自動刷新
      const hasProcessing = query.state.data?.data.some(
        (req) => req.archiveRecord && ['PENDING', 'IN_PROGRESS'].includes(String(query.state.data?.data[0]?.archiveRecord.storageTier))
      )
      return hasProcessing ? 10000 : false
    },
    ...options,
  })
}

/**
 * 發起還原請求
 */
export function useRestoreFromArchive(
  options?: UseMutationOptions<RestoreResult, Error, RestoreRequestFormData>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: restoreFromArchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.restores() })
      queryClient.invalidateQueries({ queryKey: retentionKeys.archives() })
    },
    ...options,
  })
}

// ============================================================
// Deletion Hooks
// ============================================================

/**
 * 取得刪除請求列表
 */
export function useDeletionRequests(
  params: DeletionQueryParams = {},
  options?: Omit<UseQueryOptions<DeletionRequestsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: retentionKeys.deletionList(params),
    queryFn: () => fetchDeletionRequests(params),
    ...options,
  })
}

/**
 * 建立刪除請求
 */
export function useCreateDeletionRequest(
  options?: UseMutationOptions<DataDeletionRequest, Error, DeletionRequestFormData>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDeletionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.deletions() })
    },
    ...options,
  })
}

/**
 * 審批刪除請求
 */
export function useApproveDeletionRequest(
  options?: UseMutationOptions<ApprovalResult, Error, ApprovalParams>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveDeletionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.deletions() })
      queryClient.invalidateQueries({ queryKey: retentionKeys.metrics() })
    },
    ...options,
  })
}

// ============================================================
// Metrics Hook
// ============================================================

/**
 * 取得存儲指標
 */
export function useStorageMetrics(
  options?: Omit<UseQueryOptions<StorageMetrics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: retentionKeys.metrics(),
    queryFn: fetchStorageMetrics,
    staleTime: 30000, // 30 秒快取
    ...options,
  })
}
