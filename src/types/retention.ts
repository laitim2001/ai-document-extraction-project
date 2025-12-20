/**
 * @fileoverview 資料保留與歸檔相關類型定義
 * @description
 *   定義資料保留策略、歸檔記錄、刪除請求和還原請求的類型。
 *   支援 Azure Blob Storage 分層存儲（HOT, COOL, COLD, ARCHIVE）。
 *
 * @module src/types/retention
 * @since Epic 8 - Story 8.6 (長期數據保留)
 * @lastModified 2025-12-20
 */

import type {
  DataType,
  StorageTier,
  ArchiveStatus,
  DeletionRequestStatus,
  RestoreRequestStatus,
  DataRetentionPolicy,
  DataArchiveRecord,
  DataDeletionRequest,
  DataRestoreRequest,
} from '@prisma/client';

// ============================================================
// Re-export Prisma Enums
// ============================================================

export {
  DataType,
  StorageTier,
  ArchiveStatus,
  DeletionRequestStatus,
  RestoreRequestStatus,
};

// ============================================================
// Constants
// ============================================================

/**
 * 存儲層級配置
 * 定義每個層級的訪問延遲和成本特性
 */
export const STORAGE_TIER_CONFIG = {
  HOT: {
    label: '熱存儲',
    description: '頻繁訪問，即時可用',
    accessLatency: 0, // 毫秒
    costPerGBMonth: 0.0184, // USD
    minDays: 0,
    maxDays: 90,
    color: 'red',
  },
  COOL: {
    label: '冷存儲',
    description: '較少訪問，快速可用',
    accessLatency: 30000, // 30秒
    costPerGBMonth: 0.01, // USD
    minDays: 90,
    maxDays: 365,
    color: 'blue',
  },
  COLD: {
    label: '冷藏存儲',
    description: '很少訪問，需要時間還原',
    accessLatency: 60000, // 1分鐘
    costPerGBMonth: 0.0036, // USD
    minDays: 365,
    maxDays: 730,
    color: 'cyan',
  },
  ARCHIVE: {
    label: '歸檔存儲',
    description: '極少訪問，需要較長時間還原',
    accessLatency: 43200000, // 12小時
    costPerGBMonth: 0.00099, // USD
    minDays: 730,
    maxDays: Infinity,
    color: 'gray',
  },
} as const;

/**
 * 預設保留天數配置
 */
export const DEFAULT_RETENTION_DAYS = {
  AUDIT_LOG: { hot: 90, warm: 365, cold: 2555 },
  DATA_CHANGE_HISTORY: { hot: 90, warm: 365, cold: 2555 },
  DOCUMENT: { hot: 90, warm: 365, cold: 2555 },
  EXTRACTION_RESULT: { hot: 90, warm: 365, cold: 2555 },
  PROCESSING_RECORD: { hot: 90, warm: 365, cold: 2555 },
  USER_SESSION: { hot: 30, warm: 90, cold: 365 },
  API_USAGE_LOG: { hot: 90, warm: 365, cold: 2555 },
  SYSTEM_LOG: { hot: 30, warm: 90, cold: 365 },
} as const;

/**
 * 資料類型標籤
 */
export const DATA_TYPE_LABELS: Record<DataType, string> = {
  AUDIT_LOG: '審計日誌',
  DATA_CHANGE_HISTORY: '數據變更歷史',
  DOCUMENT: '文件',
  EXTRACTION_RESULT: '提取結果',
  PROCESSING_RECORD: '處理記錄',
  USER_SESSION: '用戶會話',
  API_USAGE_LOG: 'API 使用記錄',
  SYSTEM_LOG: '系統日誌',
};

/**
 * 存儲層級標籤
 */
export const STORAGE_TIER_LABELS: Record<StorageTier, string> = {
  HOT: '熱存儲',
  COOL: '冷存儲',
  COLD: '冷藏存儲',
  ARCHIVE: '歸檔存儲',
};

/**
 * 歸檔狀態標籤
 */
export const ARCHIVE_STATUS_LABELS: Record<ArchiveStatus, string> = {
  PENDING: '等待歸檔',
  ARCHIVING: '歸檔中',
  ARCHIVED: '已歸檔',
  FAILED: '歸檔失敗',
  RESTORING: '還原中',
  RESTORED: '已還原',
};

/**
 * 刪除請求狀態標籤
 */
export const DELETION_STATUS_LABELS: Record<DeletionRequestStatus, string> = {
  PENDING: '等待審批',
  APPROVED: '已批准',
  REJECTED: '已拒絕',
  EXECUTING: '執行中',
  COMPLETED: '已完成',
  FAILED: '執行失敗',
};

/**
 * 還原請求狀態標籤
 */
export const RESTORE_STATUS_LABELS: Record<RestoreRequestStatus, string> = {
  PENDING: '等待處理',
  IN_PROGRESS: '處理中',
  COMPLETED: '已完成',
  FAILED: '失敗',
  EXPIRED: '已過期',
};

// ============================================================
// Types
// ============================================================

/**
 * 保留天數配置
 */
export interface RetentionDays {
  hot: number;
  warm: number;
  cold: number;
}

/**
 * 歸檔任務結果
 */
export interface ArchiveJobResult {
  success: boolean;
  archiveRecordId?: string;
  recordCount: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  blobPath: string;
  checksum: string;
  error?: string;
  duration: number; // 毫秒
}

/**
 * 還原結果
 */
export interface RestoreResult {
  success: boolean;
  restoreRequestId: string;
  archiveRecordId: string;
  status: RestoreRequestStatus;
  blobUrl?: string;
  expiresAt?: Date;
  estimatedWaitTime?: number; // 秒
  actualWaitTime?: number; // 秒
  error?: string;
}

/**
 * 存儲指標
 */
export interface StorageMetrics {
  totalSizeBytes: number;
  byTier: {
    [K in StorageTier]: {
      sizeBytes: number;
      recordCount: number;
      estimatedCost: number;
    };
  };
  byDataType: {
    [K in DataType]?: {
      sizeBytes: number;
      recordCount: number;
    };
  };
  compressionStats: {
    totalOriginalBytes: number;
    totalCompressedBytes: number;
    averageCompressionRatio: number;
    savedBytes: number;
    savedPercentage: number;
  };
  archiveStats: {
    totalArchived: number;
    pendingArchive: number;
    failedArchive: number;
    lastArchiveAt?: Date;
  };
  deletionStats: {
    pendingDeletions: number;
    completedDeletions: number;
    totalDeletedRecords: number;
  };
  restoreStats: {
    pendingRestores: number;
    completedRestores: number;
    averageRestoreTime: number; // 秒
  };
}

/**
 * 策略表單資料
 */
export interface RetentionPolicyFormData {
  policyName: string;
  description?: string;
  dataType: DataType;
  hotStorageDays: number;
  warmStorageDays: number;
  coldStorageDays: number;
  deletionProtection: boolean;
  requireApproval: boolean;
  minApprovalLevel: string;
  archiveSchedule?: string | null;
  isActive: boolean;
}

/**
 * 刪除請求表單資料
 */
export interface DeletionRequestFormData {
  policyId: string;
  dataType: DataType;
  sourceTable: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  reason: string;
  notes?: string;
}

/**
 * 還原請求表單資料
 */
export interface RestoreRequestFormData {
  archiveRecordId: string;
  reason: string;
  notes?: string;
}

/**
 * 歸檔查詢參數
 */
export interface ArchiveQueryParams {
  policyId?: string;
  dataType?: DataType;
  storageTier?: StorageTier;
  status?: ArchiveStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

/**
 * 刪除請求查詢參數
 */
export interface DeletionQueryParams {
  policyId?: string;
  dataType?: DataType;
  status?: DeletionRequestStatus;
  requestedById?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

/**
 * 還原請求查詢參數
 */
export interface RestoreQueryParams {
  archiveRecordId?: string;
  status?: RestoreRequestStatus;
  requestedById?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

// ============================================================
// Extended Types with Relations
// ============================================================

/**
 * 帶關聯的保留策略
 */
export interface RetentionPolicyWithRelations extends DataRetentionPolicy {
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    archiveRecords: number;
    deletionRequests: number;
  };
}

/**
 * 帶關聯的歸檔記錄
 */
export interface ArchiveRecordWithRelations extends DataArchiveRecord {
  policy: {
    id: string;
    policyName: string;
  };
  _count?: {
    restoreRequests: number;
  };
}

/**
 * 帶關聯的刪除請求
 */
export interface DeletionRequestWithRelations extends DataDeletionRequest {
  policy: {
    id: string;
    policyName: string;
  };
  requestedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  approvedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

/**
 * 帶關聯的還原請求
 */
export interface RestoreRequestWithRelations extends DataRestoreRequest {
  archiveRecord: {
    id: string;
    dataType: DataType;
    sourceTable: string;
    recordCount: number;
    storageTier: StorageTier;
    blobPath: string;
  };
  requestedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 策略列表響應
 */
export interface RetentionPoliciesResponse {
  success: boolean;
  data: RetentionPolicyWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 歸檔列表響應
 */
export interface ArchiveRecordsResponse {
  success: boolean;
  data: ArchiveRecordWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 刪除請求列表響應
 */
export interface DeletionRequestsResponse {
  success: boolean;
  data: DeletionRequestWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 還原請求列表響應
 */
export interface RestoreRequestsResponse {
  success: boolean;
  data: RestoreRequestWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 存儲指標響應
 */
export interface StorageMetricsResponse {
  success: boolean;
  data: StorageMetrics;
}

/**
 * 歸檔任務響應
 */
export interface ArchiveJobResponse {
  success: boolean;
  data: ArchiveJobResult;
}

/**
 * 還原請求響應
 */
export interface RestoreResponse {
  success: boolean;
  data: RestoreResult;
}
