/**
 * @fileoverview 批量處理公司識別類型定義
 * @description
 *   定義批量處理流程中公司識別相關的類型：
 *   - 公司匹配類型枚舉
 *   - 文件公司識別結果
 *   - 批量公司識別配置
 *   - 批量公司統計數據
 *
 * @module src/types/batch-company
 * @since Epic 0 - Story 0.6 (批量處理公司識別整合)
 * @lastModified 2025-12-25
 *
 * @related
 *   - src/services/batch-processor.service.ts - 使用這些類型的主要服務
 *   - src/services/company-auto-create.service.ts - 公司識別服務
 *   - src/services/company-matcher.service.ts - 三層匹配策略
 */

/**
 * 公司匹配類型
 * @description 描述公司識別的匹配方式
 * - EXACT: 完全匹配（公司名稱完全相同）
 * - VARIANT: 變體匹配（使用已知的名稱變體）
 * - FUZZY: 模糊匹配（使用相似度算法）
 * - NEW: 新建公司（無法匹配到現有公司）
 */
export type CompanyMatchType = 'EXACT' | 'VARIANT' | 'FUZZY' | 'NEW';

/**
 * 文件公司識別結果
 * @description 單個文件的公司識別結果，包含識別到的公司信息和匹配詳情
 */
export interface FileCompanyIdentification {
  /** 文件 ID */
  fileId: string;
  /** 識別到的公司 ID */
  companyId: string;
  /** 公司名稱 */
  companyName: string;
  /** 匹配類型 */
  matchType: CompanyMatchType;
  /** 匹配分數 (0-1) */
  matchScore: number;
  /** 是否為新建的公司 */
  isNew: boolean;
}

/**
 * 批量公司識別配置
 * @description 控制批量處理時公司識別的行為
 */
export interface BatchCompanyConfig {
  /** 是否啟用公司識別 */
  enabled: boolean;
  /** 模糊匹配閾值 (0-1)，預設 0.9 */
  fuzzyThreshold: number;
  /** 是否自動合併相似公司 */
  autoMergeSimilar: boolean;
}

/**
 * 批量公司統計
 * @description 批量處理完成後的公司識別統計數據
 */
export interface BatchCompanyStats {
  /** 成功識別公司的文件總數 */
  totalIdentified: number;
  /** 新建公司數量 */
  newCreated: number;
  /** 匹配到現有公司的數量 */
  existingMatched: number;
  /** 按匹配類型分類的統計 */
  matchTypeBreakdown: {
    /** 精確匹配數量 */
    exact: number;
    /** 變體匹配數量 */
    variant: number;
    /** 模糊匹配數量 */
    fuzzy: number;
    /** 新建公司數量 */
    new: number;
  };
  /** 按公司分類的文件統計 */
  companyBreakdown: CompanyFileCount[];
}

/**
 * 公司文件數量統計
 * @description 單個公司在批量處理中的文件統計
 */
export interface CompanyFileCount {
  /** 公司 ID */
  companyId: string;
  /** 公司名稱 */
  companyName: string;
  /** 關聯的文件數量 */
  fileCount: number;
  /** 是否為新建的公司 */
  isNew: boolean;
}

/**
 * 公司識別錯誤
 * @description 公司識別過程中的錯誤信息
 */
export interface CompanyIdentificationError {
  /** 文件 ID */
  fileId: string;
  /** 錯誤代碼 */
  errorCode: string;
  /** 錯誤訊息 */
  errorMessage: string;
  /** 原始提取的公司名稱（如果有） */
  extractedName?: string;
}

/**
 * 批量公司識別結果
 * @description 整個批量處理的公司識別彙總結果
 */
export interface BatchCompanyIdentificationResult {
  /** 批次 ID */
  batchId: string;
  /** 統計數據 */
  stats: BatchCompanyStats;
  /** 成功識別的結果列表 */
  identifications: FileCompanyIdentification[];
  /** 識別錯誤列表 */
  errors: CompanyIdentificationError[];
}
