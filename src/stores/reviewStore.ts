/**
 * @fileoverview 審核工作流狀態管理 Store
 * @description
 *   使用 Zustand 管理審核詳情頁面的 UI 狀態，包含：
 *   - 選中欄位追蹤（與 PDF 高亮聯動）
 *   - PDF 瀏覽狀態（頁碼、縮放）
 *   - 欄位修改追蹤
 *
 * @module src/stores/reviewStore
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

import { create } from 'zustand'
import type { FieldSourcePosition } from '@/types/review'

// ============================================================
// Types
// ============================================================

/**
 * 審核狀態介面
 */
interface ReviewState {
  // --- 選中欄位 ---
  /** 當前選中的欄位 ID */
  selectedFieldId: string | null
  /** 選中欄位的 PDF 來源位置 */
  selectedFieldPosition: FieldSourcePosition | null

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

  // --- Actions ---
  /** 設定選中欄位 */
  setSelectedField: (fieldId: string | null, position?: FieldSourcePosition | null) => void
  /** 設定當前頁碼 */
  setCurrentPage: (page: number) => void
  /** 設定縮放等級 */
  setZoomLevel: (level: number) => void
  /** 標記欄位為已修改 */
  markFieldDirty: (fieldId: string, newValue: string) => void
  /** 清除欄位的修改狀態 */
  clearDirtyField: (fieldId: string) => void
  /** 重置所有修改 */
  resetChanges: () => void
  /** 檢查是否有未儲存的修改 */
  hasPendingChanges: () => boolean
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
  currentPage: 1,
  zoomLevel: 1,
  dirtyFields: new Set(),
  pendingChanges: new Map(),

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
   * 標記欄位為已修改
   */
  markFieldDirty: (fieldId, newValue) => {
    const { dirtyFields, pendingChanges } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)

    newDirtyFields.add(fieldId)
    newPendingChanges.set(fieldId, newValue)

    set({
      dirtyFields: newDirtyFields,
      pendingChanges: newPendingChanges,
    })
  },

  /**
   * 清除欄位的修改狀態
   */
  clearDirtyField: (fieldId) => {
    const { dirtyFields, pendingChanges } = get()
    const newDirtyFields = new Set(dirtyFields)
    const newPendingChanges = new Map(pendingChanges)

    newDirtyFields.delete(fieldId)
    newPendingChanges.delete(fieldId)

    set({
      dirtyFields: newDirtyFields,
      pendingChanges: newPendingChanges,
    })
  },

  /**
   * 重置所有修改狀態
   */
  resetChanges: () => {
    set({
      dirtyFields: new Set(),
      pendingChanges: new Map(),
      selectedFieldId: null,
      selectedFieldPosition: null,
    })
  },

  /**
   * 檢查是否有未儲存的修改
   */
  hasPendingChanges: () => get().dirtyFields.size > 0,

  /**
   * 重置整個 Store 狀態
   * 用於頁面切換或重新載入時
   */
  resetStore: () => {
    set({
      selectedFieldId: null,
      selectedFieldPosition: null,
      currentPage: 1,
      zoomLevel: 1,
      dirtyFields: new Set(),
      pendingChanges: new Map(),
    })
  },
}))
