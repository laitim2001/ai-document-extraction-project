/**
 * @fileoverview 文件預覽整合測試頁面狀態管理 Store
 * @description
 *   使用 Zustand 管理文件預覽整合測試頁面的 UI 狀態，包含：
 *   - 文件上傳與處理狀態
 *   - 提取欄位列表與選中狀態
 *   - PDF 瀏覽狀態（頁碼、縮放）
 *   - 映射配置狀態（範圍、公司、格式）
 *
 * @module src/stores/document-preview-test-store
 * @since Epic 13 - Story 13.6 (文件預覽整合測試頁面)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 整合 PDF 預覽、欄位面板、映射配置三大區塊的狀態
 *   - 支援欄位選中與 PDF 高亮的雙向聯動
 *   - 支援三層映射配置範圍切換
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ExtractedField, FieldFilterState, DEFAULT_FILTER_STATE } from '@/types/extracted-field';
import type { VisualMappingRule, ConfigScope } from '@/types/field-mapping';

// ============================================================
// Types
// ============================================================

/**
 * 上傳文件資訊
 */
export interface UploadedFile {
  /** 文件 ID */
  id: string;
  /** 文件名稱 */
  fileName: string;
  /** 文件類型 */
  mimeType: string;
  /** 文件大小（bytes） */
  size: number;
  /** 文件 URL（用於預覽） */
  url?: string;
  /** 上傳時間 */
  uploadedAt: string;
}

/**
 * 處理狀態
 */
export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

/**
 * 錯誤資訊
 */
export interface ProcessingError {
  /** 錯誤代碼 */
  code: string;
  /** 錯誤訊息 */
  message: string;
  /** 詳細資訊 */
  details?: string;
}

/**
 * 文件預覽測試頁面狀態介面
 */
interface DocumentPreviewTestState {
  // --- 文件狀態 ---
  /** 當前上傳的文件 */
  currentFile: UploadedFile | null;
  /** 處理狀態 */
  processingStatus: ProcessingStatus;
  /** 處理進度（0-100） */
  processingProgress: number;
  /** 錯誤資訊 */
  error: ProcessingError | null;

  // --- 提取結果 ---
  /** 提取欄位列表 */
  extractedFields: ExtractedField[];
  /** 選中的欄位 ID */
  selectedFieldId: string | null;
  /** 欄位過濾狀態 */
  fieldFilters: FieldFilterState;

  // --- 映射配置 ---
  /** 當前配置範圍 */
  currentScope: ConfigScope;
  /** 選中的公司 ID（當 scope 為 COMPANY 時） */
  selectedCompanyId: string | null;
  /** 選中的文件格式 ID（當 scope 為 FORMAT 時） */
  selectedFormatId: string | null;
  /** 當前映射規則列表 */
  mappingRules: VisualMappingRule[];

  // --- PDF 狀態 ---
  /** 當前頁碼（1-indexed） */
  currentPage: number;
  /** 總頁數 */
  totalPages: number;
  /** 縮放等級（0.5 - 2.0） */
  zoomLevel: number;

  // --- Actions ---
  /** 設定當前文件 */
  setCurrentFile: (file: UploadedFile | null) => void;
  /** 設定處理狀態 */
  setProcessingStatus: (status: ProcessingStatus) => void;
  /** 設定處理進度 */
  setProcessingProgress: (progress: number) => void;
  /** 設定錯誤 */
  setError: (error: ProcessingError | null) => void;
  /** 設定提取欄位 */
  setExtractedFields: (fields: ExtractedField[]) => void;
  /** 設定選中欄位 */
  setSelectedField: (fieldId: string | null) => void;
  /** 設定欄位過濾器 */
  setFieldFilters: (filters: Partial<FieldFilterState>) => void;
  /** 設定配置範圍 */
  setCurrentScope: (scope: ConfigScope) => void;
  /** 設定選中的公司 ID */
  setSelectedCompanyId: (companyId: string | null) => void;
  /** 設定選中的格式 ID */
  setSelectedFormatId: (formatId: string | null) => void;
  /** 設定映射規則 */
  setMappingRules: (rules: VisualMappingRule[]) => void;
  /** 設定當前頁碼 */
  setCurrentPage: (page: number) => void;
  /** 設定總頁數 */
  setTotalPages: (pages: number) => void;
  /** 設定縮放等級 */
  setZoomLevel: (level: number) => void;
  /** 更新單個欄位 */
  updateField: (fieldId: string, updates: Partial<ExtractedField>) => void;
  /** 重置所有狀態 */
  reset: () => void;
  /** 清除文件（保留配置） */
  clearFile: () => void;
}

// ============================================================
// Constants
// ============================================================

/** 最小縮放等級 */
const MIN_ZOOM = 0.5;
/** 最大縮放等級 */
const MAX_ZOOM = 2.0;
/** 預設縮放等級 */
const DEFAULT_ZOOM = 1.0;

/** 預設過濾狀態 */
const defaultFilterState: FieldFilterState = {
  search: '',
  confidenceLevel: 'ALL',
  source: 'ALL',
  showEditedOnly: false,
  sortBy: 'category',
  sortOrder: 'asc',
};

/** 初始狀態 */
const initialState = {
  currentFile: null,
  processingStatus: 'idle' as ProcessingStatus,
  processingProgress: 0,
  error: null,
  extractedFields: [],
  selectedFieldId: null,
  fieldFilters: defaultFilterState,
  currentScope: 'GLOBAL' as ConfigScope,
  selectedCompanyId: null,
  selectedFormatId: null,
  mappingRules: [],
  currentPage: 1,
  totalPages: 0,
  zoomLevel: DEFAULT_ZOOM,
};

// ============================================================
// Store
// ============================================================

/**
 * 文件預覽測試頁面狀態 Store
 *
 * @example
 * ```tsx
 * const { currentFile, setCurrentFile, selectedFieldId, setSelectedField } = useDocumentPreviewTestStore();
 *
 * // 設定文件
 * setCurrentFile({ id: '123', fileName: 'invoice.pdf', ... });
 *
 * // 選中欄位
 * setSelectedField('field-123');
 *
 * // 重置
 * reset();
 * ```
 */
export const useDocumentPreviewTestStore = create<DocumentPreviewTestState>()(
  devtools(
    (set, get) => ({
      // --- Initial State ---
      ...initialState,

      // --- Actions ---

      /**
       * 設定當前上傳的文件
       */
      setCurrentFile: (file) => {
        set({ currentFile: file }, false, 'setCurrentFile');
      },

      /**
       * 設定處理狀態
       */
      setProcessingStatus: (status) => {
        set({ processingStatus: status }, false, 'setProcessingStatus');
      },

      /**
       * 設定處理進度
       */
      setProcessingProgress: (progress) => {
        set(
          { processingProgress: Math.max(0, Math.min(100, progress)) },
          false,
          'setProcessingProgress'
        );
      },

      /**
       * 設定錯誤資訊
       */
      setError: (error) => {
        set({ error }, false, 'setError');
      },

      /**
       * 設定提取欄位列表
       */
      setExtractedFields: (fields) => {
        set({ extractedFields: fields }, false, 'setExtractedFields');
      },

      /**
       * 設定選中的欄位 ID
       * 如果欄位有 boundingBox，會自動跳轉到對應頁面
       */
      setSelectedField: (fieldId) => {
        const { extractedFields } = get();
        const field = fieldId
          ? extractedFields.find((f) => f.id === fieldId)
          : null;

        // 如果欄位有位置資訊，自動跳轉到對應頁面
        if (field?.boundingBox?.page) {
          set(
            {
              selectedFieldId: fieldId,
              currentPage: field.boundingBox.page,
            },
            false,
            'setSelectedField'
          );
        } else {
          set({ selectedFieldId: fieldId }, false, 'setSelectedField');
        }
      },

      /**
       * 設定欄位過濾器（部分更新）
       */
      setFieldFilters: (filters) => {
        const { fieldFilters } = get();
        set(
          { fieldFilters: { ...fieldFilters, ...filters } },
          false,
          'setFieldFilters'
        );
      },

      /**
       * 設定當前配置範圍
       * 切換範圍時會清除相關的 ID 選擇
       */
      setCurrentScope: (scope) => {
        const updates: Partial<DocumentPreviewTestState> = { currentScope: scope };

        // 切換範圍時清除相關選擇
        if (scope === 'GLOBAL') {
          updates.selectedCompanyId = null;
          updates.selectedFormatId = null;
        } else if (scope === 'COMPANY') {
          updates.selectedFormatId = null;
        }

        set(updates, false, 'setCurrentScope');
      },

      /**
       * 設定選中的公司 ID
       */
      setSelectedCompanyId: (companyId) => {
        set({ selectedCompanyId: companyId }, false, 'setSelectedCompanyId');
      },

      /**
       * 設定選中的格式 ID
       */
      setSelectedFormatId: (formatId) => {
        set({ selectedFormatId: formatId }, false, 'setSelectedFormatId');
      },

      /**
       * 設定映射規則列表
       */
      setMappingRules: (rules) => {
        set({ mappingRules: rules }, false, 'setMappingRules');
      },

      /**
       * 設定當前頁碼
       */
      setCurrentPage: (page) => {
        const { totalPages } = get();
        set(
          { currentPage: Math.max(1, Math.min(page, totalPages || 1)) },
          false,
          'setCurrentPage'
        );
      },

      /**
       * 設定總頁數
       */
      setTotalPages: (pages) => {
        set({ totalPages: Math.max(0, pages) }, false, 'setTotalPages');
      },

      /**
       * 設定縮放等級
       * 限制在 MIN_ZOOM 到 MAX_ZOOM 範圍內
       */
      setZoomLevel: (level) => {
        set(
          { zoomLevel: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)) },
          false,
          'setZoomLevel'
        );
      },

      /**
       * 更新單個欄位的屬性
       */
      updateField: (fieldId, updates) => {
        const { extractedFields } = get();
        const updatedFields = extractedFields.map((field) =>
          field.id === fieldId
            ? { ...field, ...updates, originalValue: field.originalValue ?? field.value }
            : field
        );
        set({ extractedFields: updatedFields }, false, 'updateField');
      },

      /**
       * 重置所有狀態
       */
      reset: () => {
        set(initialState, false, 'reset');
      },

      /**
       * 清除文件（保留配置設定）
       */
      clearFile: () => {
        set(
          {
            currentFile: null,
            processingStatus: 'idle',
            processingProgress: 0,
            error: null,
            extractedFields: [],
            selectedFieldId: null,
            currentPage: 1,
            totalPages: 0,
          },
          false,
          'clearFile'
        );
      },
    }),
    { name: 'document-preview-test-store' }
  )
);

// ============================================================
// Selector Hooks (for performance optimization)
// ============================================================

/**
 * 選取文件狀態
 */
export const useFileState = () =>
  useDocumentPreviewTestStore((state) => ({
    currentFile: state.currentFile,
    processingStatus: state.processingStatus,
    processingProgress: state.processingProgress,
    error: state.error,
  }));

/**
 * 選取提取欄位狀態
 */
export const useFieldsState = () =>
  useDocumentPreviewTestStore((state) => ({
    extractedFields: state.extractedFields,
    selectedFieldId: state.selectedFieldId,
    fieldFilters: state.fieldFilters,
  }));

/**
 * 選取映射配置狀態
 */
export const useMappingState = () =>
  useDocumentPreviewTestStore((state) => ({
    currentScope: state.currentScope,
    selectedCompanyId: state.selectedCompanyId,
    selectedFormatId: state.selectedFormatId,
    mappingRules: state.mappingRules,
  }));

/**
 * 選取 PDF 狀態
 */
export const usePdfState = () =>
  useDocumentPreviewTestStore((state) => ({
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    zoomLevel: state.zoomLevel,
  }));
