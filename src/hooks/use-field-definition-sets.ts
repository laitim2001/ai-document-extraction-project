'use client';

/**
 * @fileoverview FieldDefinitionSet 查詢與操作 Hooks
 * @description
 *   提供客戶端 FieldDefinitionSet CRUD 操作功能。
 *   使用 React Query 進行資料緩存和狀態管理。
 *
 *   Query Hooks:
 *   - useFieldDefinitionSets: 列表查詢（支援分頁、篩選、排序）
 *   - useFieldDefinitionSet: 單一記錄查詢
 *   - useFieldDefinitionSetFields: 僅回傳 fields 陣列
 *   - useFieldCandidates: 候選欄位列表
 *   - useFieldCoverage: 覆蓋率分析
 *   - useResolvedFields: 三層合併解析
 *
 *   Mutation Hooks:
 *   - useCreateFieldDefinitionSet: 建立
 *   - useUpdateFieldDefinitionSet: 更新
 *   - useDeleteFieldDefinitionSet: 刪除
 *   - useToggleFieldDefinitionSet: 切換啟用狀態
 *
 * @module src/hooks/use-field-definition-sets
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - @tanstack/react-query - 資料查詢和緩存
 *
 * @related
 *   - src/app/api/v1/field-definition-sets/ - API 端點
 *   - src/services/field-definition-set.service.ts - 服務層
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FieldDefinitionEntry } from '@/types/extraction-v3.types';

// ============================================================
// 類型定義
// ============================================================

/** FieldDefinitionSet 列表項目 */
export interface FieldDefinitionSetItem {
  id: string;
  name: string;
  scope: string;
  companyId: string | null;
  companyName: string | null;
  documentFormatId: string | null;
  documentFormatName: string | null;
  description: string | null;
  isActive: boolean;
  version: number;
  fieldsCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** FieldDefinitionSet 詳情 */
export interface FieldDefinitionSetDetail extends FieldDefinitionSetItem {
  fields: FieldDefinitionEntry[];
}

/** 分頁資訊 */
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 列表 API 響應 */
interface ListResponse {
  success: boolean;
  data?: FieldDefinitionSetItem[];
  meta?: { pagination: PaginationInfo };
  type?: string;
  detail?: string;
}

/** 詳情 API 響應 */
interface DetailResponse {
  success: boolean;
  data?: FieldDefinitionSetDetail;
  type?: string;
  detail?: string;
}

/** Fields API 響應 */
interface FieldsResponse {
  success: boolean;
  data?: FieldDefinitionEntry[];
  type?: string;
  detail?: string;
}

/** 覆蓋率 API 響應 */
interface CoverageResponse {
  success: boolean;
  data?: FieldCoverageData;
  type?: string;
  detail?: string;
}

/** Resolve API 響應 */
interface ResolveResponse {
  success: boolean;
  data?: {
    fields: FieldDefinitionEntry[];
    setId?: string;
    source: string;
  };
  type?: string;
  detail?: string;
}

/** 覆蓋率數據 */
export interface FieldCoverageData {
  totalExtractions: number;
  overallCoverageRate: number;
  fields: FieldCoverageItem[];
  unexpectedFields: UnexpectedFieldItem[];
}

/** 單欄位覆蓋率 */
export interface FieldCoverageItem {
  key: string;
  label: string;
  foundCount: number;
  missingCount: number;
  totalCount: number;
  coverageRate: number;
  status: 'healthy' | 'warning' | 'critical';
}

/** 意外欄位 */
export interface UnexpectedFieldItem {
  key: string;
  occurrenceCount: number;
  percentage: number;
}

/** 查詢參數 */
export interface FieldDefinitionSetFilters {
  page?: number;
  limit?: number;
  scope?: string;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 建立輸入 */
export interface CreateFieldDefinitionSetInput {
  name: string;
  scope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  companyId?: string | null;
  documentFormatId?: string | null;
  description?: string | null;
  isActive?: boolean;
  fields: FieldDefinitionEntry[];
}

/** 更新輸入 */
export interface UpdateFieldDefinitionSetInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  fields?: FieldDefinitionEntry[];
}

// ============================================================
// Constants
// ============================================================

const API_BASE = '/api/v1/field-definition-sets';
const QUERY_KEY = 'field-definition-sets';

// ============================================================
// Helper
// ============================================================

function buildQueryString(filters: FieldDefinitionSetFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.companyId) params.set('companyId', filters.companyId);
  if (filters.documentFormatId) params.set('documentFormatId', filters.documentFormatId);
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  return params.toString();
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * 列表查詢 Hook
 */
export function useFieldDefinitionSets(filters: FieldDefinitionSetFilters = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await fetch(`${API_BASE}?${qs}`);
      const json: ListResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to fetch field definition sets');
      }
      return {
        items: json.data ?? [],
        pagination: json.meta?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    },
  });
}

/**
 * 單一記錄查詢 Hook
 */
export function useFieldDefinitionSet(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${id}`);
      const json: DetailResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to fetch field definition set');
      }
      return json.data!;
    },
    enabled: !!id,
  });
}

/**
 * 僅回傳 fields 陣列 Hook（給 SourceFieldCombobox）
 */
export function useFieldDefinitionSetFields(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'fields', id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${id}/fields`);
      const json: FieldsResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to fetch fields');
      }
      return json.data ?? [];
    },
    enabled: !!id,
  });
}

/**
 * 候選欄位列表 Hook
 */
export function useFieldCandidates() {
  return useQuery({
    queryKey: [QUERY_KEY, 'candidates'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/candidates`);
      const json: FieldsResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to fetch candidates');
      }
      return json.data ?? [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour — candidates rarely change
  });
}

/**
 * 覆蓋率分析 Hook
 */
export function useFieldCoverage(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'coverage', id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${id}/coverage`);
      const json: CoverageResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to fetch coverage');
      }
      return json.data!;
    },
    enabled: !!id,
  });
}

/**
 * 三層合併解析 Hook
 */
export function useResolvedFields(companyId?: string, formatId?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'resolve', companyId, formatId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (formatId) params.set('documentFormatId', formatId);
      const res = await fetch(`${API_BASE}/resolve?${params.toString()}`);
      const json: ResolveResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to resolve fields');
      }
      return json.data!;
    },
  });
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * 建立 FieldDefinitionSet Mutation
 */
export function useCreateFieldDefinitionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFieldDefinitionSetInput) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json: DetailResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to create field definition set');
      }
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * 更新 FieldDefinitionSet Mutation
 */
export function useUpdateFieldDefinitionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateFieldDefinitionSetInput }) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json: DetailResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to update field definition set');
      }
      return json.data!;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', variables.id] });
    },
  });
}

/**
 * 刪除 FieldDefinitionSet Mutation
 */
export function useDeleteFieldDefinitionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to delete field definition set');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * 切換啟用狀態 Mutation
 */
export function useToggleFieldDefinitionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${id}/toggle`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ?? 'Failed to toggle status');
      }
      return json.data as { id: string; isActive: boolean };
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', id] });
    },
  });
}
