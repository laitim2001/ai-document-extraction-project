/**
 * @fileoverview 審核工作流狀態管理 Store
 * @description
 *   使用 Zustand 管理審核詳情頁面的 UI 狀態，包含：
 *   - 選中欄位追蹤（與 PDF 高亮聯動）
 *   - PDF 瀏覽狀態（頁碼、縮放）
 *   - 欄位修改追蹤（含原始值）
 *   - 編輯模式管理
 *
 * @module src/stores/reviewStore
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 *
 * @features
 *   - Story 3.5: 支援原始值追蹤（用於修正 API）
 *   - Story 3.5: 編輯中欄位 ID 追蹤
 *   - Story 3.5: 取得待提交的修正列表
 */

import { create } from 'zustand'
import type { FieldSourcePosition, PendingCorrection } from '@/types/review'

// ============================================================
// Types
// ============================================================

// Note: FieldChange interface moved to @/types/review.ts as PendingCorrection

/**
 * 審核狀態介面
 */
interface ReviewState {
  // --- 選中欄位 ---
  /** 當前選中的欄位 ID */
  selectedFieldId: string | null
  /** 選中欄位的 PDF 來源位置 */
  selectedFieldPosition: FieldSourcePosition | null

  // --- 編輯狀態 ---
  /** 當前正在編輯的欄位 ID */
  editingFieldId: string | null

  // --- PDF 狀態 ---
  /** 當前頁碼 (1-indexed) */
  currentPage: number
  /** 縮放等級 (0.5 - 3.0) */
  zoomLevel: number

  // --- 修改追蹤 ---
  /** 已修改的欄位 ID 集合 */
  dirtyFields: Set<string>
  /** 待提交的修改值 (fieldId -> newValue) */
  pendingChanges: Map<string, string>
  /** 欄位原始值映射 (fieldId -> originalValue) */
  originalValues: Map<string, string | null>
  /** 欄位名稱映射 (fieldId -> fieldName) */
  fieldNames: Map<string, string>

  // --- Actions ---
  /** 設定選中欄位 */
  setSelectedField: (fieldId: string | null, position?: FieldSourcePosition | null) => void
  /** 設定當前頁碼 */
  setCurrentPage: (page: number) => void
  /** 設定縮放等級 */
  setZoomLevel: (level: number) => void
  /** 開始編輯欄位 */
  startEditing: (fieldId: string) => void
  /** 停止編輯 */
  stopEditing: () => void
  /** 標記欄位為已修改（含原始值） */
  markFieldDirty: (fieldId: string, fieldName: string, originalValue: string | null, newValue: string) => void
  /** 清除欄位的修改狀態 */
  clearDirtyField: (fieldId: string) => void
  /** 重置所有修改 */
  resetChanges: () => void
  /** 檢查是否有未儲存的修改 */
  hasPendingChanges: () => boolean
  /** 取得待提交的修正列表 */
  getPendingCorrections: () => PendingCorrection[]
  /** 重置整個 Store 狀態（用於頁面切換） */
  resetStore: () => void
}

// ============================================================
// Constants
// ============================================================

/** 最小縮放等級 */
const MIN_ZOOM = 0.5
/** 最大縮放等級 */
const MAX_ZOOM = 3.0

// ============================================================
// Store
// ============================================================

/**
 * 審核狀態 Store
 *
 * @example
 * ```tsx
 * const { selectedFieldId, setSelectedField } = useReviewStore()
 *
 * // 選中欄位
 * setSelectedField('field-123', { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.05 })
 *
 * // 取消選中
 * setSelectedField(null)
 * ```
 */
export const useReviewStore = create<ReviewState>((set, get) => ({
  // --- Initial State ---
  selectedFieldId: null,
  selectedFieldPosition: null,
  editingFieldId: null,
  currentPage: 1,
  zoomLevel: 1,
  dirtyFields: new Set(),
  pendingChanges: new Map(),
  originalValues: new Map(),
  fieldNames: new Map(),

  // --- Actions ---

  /**
   * 設定選中的欄位
   * 如果有位置資訊，自動跳轉到對應頁面
   */
  setSelectedField: (fieldId, position = null) => {
    set({
      selectedFieldId: fieldId,
      selectedFieldPosition: position,
    })

    // 如果有位置資訊，自動跳轉到對應頁面
    if (position?.page) {
      set({ currentPage: position.page })
    }
  },

  /**
   * 設定當前頁碼
   */
  setCurrentPage: (page) => {
    set({ currentPage: Math.max(1, page) })
  },

  /**
   * 設定縮放等級
   * 限制在 MIN_ZOOM 到 MAX_ZOOM 範圍內
   */
  setZoomLevel: (level) => {
    set({ zoomLevel: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)) })
  },

  /**
   * 開始編輯欄位
   */
  startEditing: (fieldId) => {
    set({ editingFieldId: fieldId })
  },

  /**
   * 停止編輯
   */
  stopEditing: () => {
    set({ editingFieldId: null })
  },

  /**
   * 標記欄位為已修改（含原始值追蹤）
   * @description Story 3.5 - 支援修正 API 所需的原始值記錄
   */
  markFieldDirty: (fieldId, fieldName, originalValue, newValue) => {
    const { dirtyFields, pendingChanges, originalValues, fieldNames } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)
    const newOriginalValues = new Map(originalValues)
    const newFieldNames = new Map(fieldNames)

    newDirtyFields.add(fieldId)
    newPendingChanges.set(fieldId, newValue)

    // 只在第一次修改時記錄原始值
    if (!originalValues.has(fieldId)) {
      newOriginalValues.set(fieldId, originalValue)
      newFieldNames.set(fieldId, fieldName)
    }

    set({
      dirtyFields: newDirtyFields,
      pendingChanges: newPendingChanges,
      originalValues: newOriginalValues,
      fieldNames: newFieldNames,
      editingFieldId: null, // 儲存後退出編輯模式
    })
  },

  /**
   * 清除欄位的修改狀態
   */
  clearDirtyField: (fieldId) => {
    const { dirtyFields, pendingChanges, originalValues, fieldNames } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)
    const newOriginalValues = new Map(originalValues)
    const newFieldNames = new Map(fieldNames)

    newDirtyFields.delete(fieldId)
    newPendingChanges.delete(fieldId)
    newOriginalValues.delete(fieldId)
    newFieldNames.delete(fieldId)

    set({
      dirtyFields: newDirtyFields,
      pendingChanges: newPendingChanges,
      originalValues: newOriginalValues,
      fieldNames: newFieldNames,
    })
  },

  /**
   * 重置所有修改狀態
   */
  resetChanges: () => {
    set({
      dirtyFields: new Set(),
      pendingChanges: new Map(),
      originalValues: new Map(),
      fieldNames: new Map(),
      selectedFieldId: null,
      selectedFieldPosition: null,
      editingFieldId: null,
    })
  },

  /**
   * 檢查是否有未儲存的修改
   */
  hasPendingChanges: () => get().dirtyFields.size > 0,

  /**
   * 取得待提交的修正列表
   * @description Story 3.5 - 用於修正 API 請求
   */
  getPendingCorrections: () => {
    const { dirtyFields, pendingChanges, originalValues, fieldNames } = get()
    const corrections: PendingCorrection[] = []

    dirtyFields.forEach((fieldId) => {
      const newValue = pendingChanges.get(fieldId)
      const originalValue = originalValues.get(fieldId)
      const fieldName = fieldNames.get(fieldId)

      if (newValue !== undefined && fieldName) {
        corrections.push({
          fieldId,
          fieldName,
          originalValue: originalValue ?? null,
          newValue,
        })
      }
    })

    return corrections
  },

  /**
   * 重置整個 Store 狀態
   * 用於頁面切換或重新載入時
   */
  resetStore: () => {
    set({
      selectedFieldId: null,
      selectedFieldPosition: null,
      editingFieldId: null,
      currentPage: 1,
      zoomLevel: 1,
      dirtyFields: new Set(),
      pendingChanges: new Map(),
      originalValues: new Map(),
      fieldNames: new Map(),
    })
  },
}))
