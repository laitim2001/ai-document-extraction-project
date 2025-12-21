/**
 * @fileoverview 數據恢復管理類型定義
 * @description
 *   定義數據恢復管理系統的所有類型：
 *   - 恢復類型和狀態枚舉
 *   - 恢復記錄和演練類型
 *   - 恢復選項和進度類型
 *   - API 請求和響應類型
 *   - UI 輔助函數
 *
 * @module src/types/restore
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 多種恢復類型支援 (FULL, PARTIAL, DRILL, POINT_IN_TIME)
 *   - 完整的恢復狀態機
 *   - 恢復前自動備份機制
 *   - 恢復演練功能
 *   - 詳細日誌記錄
 *
 * @dependencies
 *   - @prisma/client - Prisma 類型
 *
 * @related
 *   - src/types/backup.ts - 備份類型定義
 *   - src/services/restore.service.ts - 恢復服務
 */

import type {
  RestoreRecord as PrismaRestoreRecord,
  RestoreDrill as PrismaRestoreDrill,
  RestoreLog as PrismaRestoreLog,
  RestoreType as PrismaRestoreType,
  RestoreStatus as PrismaRestoreStatus,
  RestoreScope as PrismaRestoreScope,
  Backup,
  User,
} from '@prisma/client'

// ============================================================================
// 枚舉類型 (與 Prisma schema 保持一致)
// ============================================================================

/**
 * 恢復類型
 */
export const RestoreType = {
  FULL: 'FULL',               // 完整恢復 - 替換所有數據
  PARTIAL: 'PARTIAL',         // 部分恢復 - 選擇特定表/文件
  DRILL: 'DRILL',             // 恢復演練 - 恢復至隔離環境
  POINT_IN_TIME: 'POINT_IN_TIME', // 時間點恢復 - 恢復到特定時間點
} as const
export type RestoreType = PrismaRestoreType

/**
 * 恢復狀態
 */
export const RestoreStatus = {
  PENDING: 'PENDING',         // 等待執行
  VALIDATING: 'VALIDATING',   // 驗證備份中
  PRE_BACKUP: 'PRE_BACKUP',   // 恢復前備份中
  IN_PROGRESS: 'IN_PROGRESS', // 恢復執行中
  VERIFYING: 'VERIFYING',     // 驗證結果中
  COMPLETED: 'COMPLETED',     // 恢復完成
  FAILED: 'FAILED',           // 恢復失敗
  CANCELLED: 'CANCELLED',     // 已取消
  ROLLED_BACK: 'ROLLED_BACK', // 已回滾
} as const
export type RestoreStatus = PrismaRestoreStatus

/**
 * 恢復範圍
 */
export const RestoreScope = {
  DATABASE: 'DATABASE',       // 數據庫
  FILES: 'FILES',             // 上傳文件
  CONFIG: 'CONFIG',           // 系統配置
  ALL: 'ALL',                 // 全部範圍
} as const
export type RestoreScope = PrismaRestoreScope

// ============================================================================
// 確認文字常數
// ============================================================================

/**
 * 二次確認所需的確認文字
 */
export const CONFIRMATION_TEXTS = {
  RESTORE: 'RESTORE-CONFIRM',
  DRILL: 'RESTORE-DRILL',
  ROLLBACK: 'ROLLBACK-CONFIRM',
} as const
export type ConfirmationType = keyof typeof CONFIRMATION_TEXTS

// ============================================================================
// 恢復選項類型
// ============================================================================

/**
 * 恢復選項（建立恢復請求時使用）
 */
export interface RestoreOptions {
  backupId: string
  type: RestoreType
  scope: RestoreScope[]
  selectedTables?: string[]
  selectedFiles?: string[]
  targetEnvironment?: string
  confirmationText: string
}

/**
 * 建立恢復請求 DTO
 */
export interface CreateRestoreRequest {
  backupId: string
  type: RestoreType
  scope: RestoreScope[]
  selectedTables?: string[]
  selectedFiles?: string[]
  targetEnvironment?: string
  confirmationText: string
}

// ============================================================================
// 恢復進度類型
// ============================================================================

/**
 * 恢復進度（即時更新）
 */
export interface RestoreProgress {
  restoreId: string
  status: RestoreStatus
  progress: number             // 0-100
  currentStep: string          // 當前步驟描述
  estimatedTimeRemaining?: number // 秒
  error?: string
}

/**
 * 恢復進度回調函數
 */
export type RestoreProgressCallback = (progress: RestoreProgress) => void

// ============================================================================
// 驗證詳情類型
// ============================================================================

/**
 * 恢復驗證詳情
 */
export interface ValidationDetails {
  database?: {
    accessible: boolean
    sampleCount?: number
    error?: string
  }
  files?: {
    directoryExists: boolean
    fileCount?: number
  }
  config?: {
    configCount: number
  }
}

// ============================================================================
// 備份預覽類型
// ============================================================================

/**
 * 備份表格預覽項目
 */
export interface BackupTablePreview {
  name: string
  rowCount: number
}

/**
 * 備份文件預覽項目
 */
export interface BackupFilePreview {
  path: string
  size?: number
}

/**
 * 備份內容預覽
 */
export interface BackupPreview {
  tables: BackupTablePreview[]
  files: BackupFilePreview[]
  configs: string[]
  summary: {
    databaseRecords: number
    fileCount: number
    configCount: number
  }
}

// ============================================================================
// 恢復記錄類型
// ============================================================================

/**
 * 恢復記錄（基本）
 */
export interface RestoreRecord {
  id: string
  backupId: string
  type: RestoreType
  scope: RestoreScope[]
  status: RestoreStatus
  progress: number
  currentStep: string | null
  estimatedTimeRemaining: number | null
  selectedTables: string[]
  selectedFiles: string[]
  targetEnvironment: string | null
  preRestoreBackupId: string | null
  restoredRecords: Record<string, number> | null
  restoredFiles: number | null
  restoredConfigs: number | null
  validationPassed: boolean | null
  validationDetails: ValidationDetails | null
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  createdBy: string
}

/**
 * 恢復記錄（含關聯）
 */
export interface RestoreRecordWithRelations {
  id: string
  backupId: string
  type: RestoreType
  scope: RestoreScope[]
  status: RestoreStatus
  progress: number
  currentStep?: string | null
  estimatedTimeRemaining?: number | null
  selectedTables: string[]
  selectedFiles: string[]
  targetEnvironment?: string | null
  preRestoreBackupId?: string | null
  restoredRecords?: Record<string, number> | null
  restoredFiles?: number | null
  restoredConfigs?: number | null
  validationPassed?: boolean | null
  validationDetails?: ValidationDetails | null
  errorMessage?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  createdAt: Date
  backup: {
    id: string
    name: string
    type: string
    source: string
    sizeBytes: bigint | null
    completedAt: Date | null
  }
  createdByUser: {
    id: string
    name: string | null
  }
  logs?: RestoreLogItem[]
  preRestoreBackup?: {
    id: string
    name: string
  } | null
}

/**
 * 恢復列表項目（用於列表顯示）
 */
export interface RestoreListItem {
  id: string
  backupId: string
  backupName: string
  type: RestoreType
  scope: RestoreScope[]
  status: RestoreStatus
  progress: number
  currentStep: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  createdByName: string
  errorMessage: string | null
}

// ============================================================================
// 恢復演練類型
// ============================================================================

/**
 * 恢復演練記錄
 */
export interface RestoreDrill {
  id: string
  restoreRecordId: string
  drillEnvironment: string
  drillDatabaseName: string | null
  drillStoragePath: string | null
  drillStatus: 'passed' | 'failed' | 'partial' | null
  drillReport: Record<string, unknown> | null
  cleanedUp: boolean
  cleanedUpAt: Date | null
  createdAt: Date
}

/**
 * 演練驗證檢查項目
 */
export interface DrillVerificationChecks {
  databaseConnectivity: boolean
  tableIntegrity: boolean
  recordCounts: boolean
  sampleDataVerification: boolean
  referentialIntegrity: boolean
}

// ============================================================================
// 恢復日誌類型
// ============================================================================

/**
 * 日誌等級
 */
export type RestoreLogLevel = 'info' | 'warn' | 'error'

/**
 * 恢復日誌項目
 */
export interface RestoreLogItem {
  id: string
  restoreRecordId: string
  timestamp: Date
  level: RestoreLogLevel
  step: string
  message: string
  details?: Record<string, unknown> | null
}

/**
 * 恢復日誌條目（UI 用途，兼容 RestoreLogItem）
 */
export type RestoreLogEntry = RestoreLogItem

/**
 * 建立日誌請求
 */
export interface CreateRestoreLogRequest {
  restoreRecordId: string
  level: RestoreLogLevel
  step: string
  message: string
  details?: Record<string, unknown>
}

// ============================================================================
// 列表查詢選項
// ============================================================================

/**
 * 恢復列表查詢選項
 */
export interface RestoreListOptions {
  status?: RestoreStatus
  type?: RestoreType
  backupId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'startedAt' | 'completedAt'
  order?: 'asc' | 'desc'
  sortBy?: 'createdAt' | 'completedAt' | 'status' | 'type'
  sortOrder?: 'asc' | 'desc'
}

// ============================================================================
// API 請求類型 (前端 -> 後端)
// ============================================================================

/**
 * 恢復列表查詢參數（用於 React Query）
 */
export interface RestoreListParams {
  page?: number
  limit?: number
  status?: RestoreStatus
  type?: RestoreType
  backupId?: string
  startDate?: string
  endDate?: string
  sortBy?: 'createdAt' | 'completedAt' | 'status' | 'type'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 啟動恢復請求
 */
export interface StartRestoreRequest {
  backupId: string
  type: RestoreType
  scope: RestoreScope | RestoreScope[]
  selectedTables?: string[]
  selectedFiles?: string[]
  confirmationText: string
  targetPointInTime?: string
  drillName?: string
}

/**
 * 回滾恢復請求
 */
export interface RollbackRequest {
  confirmationText: string
}

// ============================================================================
// API 響應類型
// ============================================================================

/**
 * 恢復列表 API 響應
 */
export interface RestoreListResponse {
  success: boolean
  data: {
    records: RestoreListItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

/**
 * 恢復詳情 API 響應
 */
export interface RestoreDetailResponse {
  success: boolean
  data: {
    record: RestoreRecordWithRelations
    message?: string
  }
}

/**
 * 恢復日誌列表 API 響應
 */
export interface RestoreLogsResponse {
  success: boolean
  data: {
    logs: RestoreLogItem[]
  }
}

/**
 * 備份預覽 API 響應
 */
export interface BackupPreviewResponse {
  success: boolean
  data: BackupPreview
}

/**
 * 恢復統計 API 響應
 */
export interface RestoreStatsResponse {
  success: boolean
  data: {
    totalRestores: number
    successfulRestores: number
    failedRestores: number
    averageRestoreTime: number // 秒
    lastRestoreAt: Date | null
    drillsCompleted: number
  }
}

// ============================================================================
// 恢復步驟類型
// ============================================================================

/**
 * 恢復執行步驟
 */
export const RestoreSteps = {
  VALIDATING: 'validating',
  DOWNLOADING_BACKUP: 'downloading_backup',
  DECRYPTING: 'decrypting',
  PRE_BACKUP: 'pre_backup',
  RESTORING_DATABASE: 'restoring_database',
  RESTORING_FILES: 'restoring_files',
  RESTORING_CONFIG: 'restoring_config',
  VERIFYING: 'verifying',
  CLEANUP: 'cleanup',
  COMPLETED: 'completed',
} as const
export type RestoreStep = typeof RestoreSteps[keyof typeof RestoreSteps]

/**
 * 恢復步驟配置
 */
export interface RestoreStepConfig {
  key: RestoreStep
  label: string
  description: string
  progressWeight: number // 此步驟佔總進度的權重
}

/**
 * 恢復步驟配置表
 */
export const RESTORE_STEP_CONFIG: Record<RestoreStep, RestoreStepConfig> = {
  validating: {
    key: 'validating',
    label: '驗證備份',
    description: '驗證備份檔案完整性和可用性',
    progressWeight: 5,
  },
  downloading_backup: {
    key: 'downloading_backup',
    label: '下載備份',
    description: '從儲存系統下載備份檔案',
    progressWeight: 15,
  },
  decrypting: {
    key: 'decrypting',
    label: '解密備份',
    description: '解密備份檔案內容',
    progressWeight: 5,
  },
  pre_backup: {
    key: 'pre_backup',
    label: '建立恢復前備份',
    description: '在恢復前建立當前數據的備份',
    progressWeight: 15,
  },
  restoring_database: {
    key: 'restoring_database',
    label: '恢復資料庫',
    description: '還原資料庫數據',
    progressWeight: 25,
  },
  restoring_files: {
    key: 'restoring_files',
    label: '恢復檔案',
    description: '還原上傳的檔案',
    progressWeight: 15,
  },
  restoring_config: {
    key: 'restoring_config',
    label: '恢復系統設定',
    description: '還原系統配置',
    progressWeight: 5,
  },
  verifying: {
    key: 'verifying',
    label: '驗證結果',
    description: '驗證恢復結果的完整性',
    progressWeight: 10,
  },
  cleanup: {
    key: 'cleanup',
    label: '清理',
    description: '清理臨時檔案',
    progressWeight: 3,
  },
  completed: {
    key: 'completed',
    label: '完成',
    description: '恢復作業完成',
    progressWeight: 2,
  },
}

// ============================================================================
// UI 配置類型
// ============================================================================

/**
 * 恢復類型配置
 */
export interface RestoreTypeConfig {
  label: string
  description: string
  icon: string
  requiresConfirmation: boolean
  confirmationText: string
}

/**
 * 恢復類型配置表
 */
export const RESTORE_TYPE_CONFIG: Record<RestoreType, RestoreTypeConfig> = {
  FULL: {
    label: '完整恢復',
    description: '完全替換所有現有數據，恢復至備份時的完整狀態',
    icon: 'database',
    requiresConfirmation: true,
    confirmationText: CONFIRMATION_TEXTS.RESTORE,
  },
  PARTIAL: {
    label: '部分恢復',
    description: '只恢復選定的資料表或檔案，保留其他現有數據',
    icon: 'file-check',
    requiresConfirmation: true,
    confirmationText: CONFIRMATION_TEXTS.RESTORE,
  },
  DRILL: {
    label: '恢復演練',
    description: '在隔離環境中測試恢復流程，不影響正式數據',
    icon: 'test-tube',
    requiresConfirmation: true,
    confirmationText: CONFIRMATION_TEXTS.DRILL,
  },
  POINT_IN_TIME: {
    label: '時間點恢復',
    description: '恢復至指定的時間點狀態',
    icon: 'clock',
    requiresConfirmation: true,
    confirmationText: CONFIRMATION_TEXTS.RESTORE,
  },
}

/**
 * 恢復範圍配置
 */
export interface RestoreScopeConfig {
  label: string
  description: string
  icon: string
}

/**
 * 恢復範圍配置表
 */
export const RESTORE_SCOPE_CONFIG: Record<RestoreScope, RestoreScopeConfig> = {
  DATABASE: {
    label: '資料庫',
    description: '恢復資料庫中的所有表和記錄',
    icon: 'database',
  },
  FILES: {
    label: '檔案',
    description: '恢復上傳的文件和附件',
    icon: 'folder',
  },
  CONFIG: {
    label: '系統設定',
    description: '恢復系統配置和設定值',
    icon: 'settings',
  },
  ALL: {
    label: '全部',
    description: '恢復所有數據，包括資料庫、檔案和設定',
    icon: 'layers',
  },
}

/**
 * 恢復狀態配置
 */
export interface RestoreStatusConfig {
  label: string
  description: string
  color: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
  isTerminal: boolean
}

/**
 * 恢復狀態配置表
 */
export const RESTORE_STATUS_CONFIG: Record<RestoreStatus, RestoreStatusConfig> = {
  PENDING: {
    label: '等待中',
    description: '恢復作業已建立，等待執行',
    color: 'secondary',
    isTerminal: false,
  },
  VALIDATING: {
    label: '驗證中',
    description: '正在驗證備份檔案的完整性',
    color: 'default',
    isTerminal: false,
  },
  PRE_BACKUP: {
    label: '備份中',
    description: '正在建立恢復前的安全備份',
    color: 'default',
    isTerminal: false,
  },
  IN_PROGRESS: {
    label: '執行中',
    description: '正在執行恢復作業',
    color: 'default',
    isTerminal: false,
  },
  VERIFYING: {
    label: '驗證中',
    description: '正在驗證恢復結果',
    color: 'default',
    isTerminal: false,
  },
  COMPLETED: {
    label: '已完成',
    description: '恢復作業已成功完成',
    color: 'success',
    isTerminal: true,
  },
  FAILED: {
    label: '失敗',
    description: '恢復作業失敗',
    color: 'destructive',
    isTerminal: true,
  },
  CANCELLED: {
    label: '已取消',
    description: '恢復作業已被取消',
    color: 'secondary',
    isTerminal: true,
  },
  ROLLED_BACK: {
    label: '已回滾',
    description: '恢復失敗後已回滾至原始狀態',
    color: 'warning',
    isTerminal: true,
  },
}

// ============================================================================
// UI 輔助函數
// ============================================================================

/**
 * Badge 變體類型
 */
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/**
 * 取得恢復狀態顯示資訊（用於 UI Badge 組件）
 */
export function getRestoreStatusInfo(status: RestoreStatus): { label: string; variant: BadgeVariant } {
  const config = RESTORE_STATUS_CONFIG[status]
  let variant: BadgeVariant = 'secondary'

  switch (config.color) {
    case 'success':
      variant = 'outline'
      break
    case 'destructive':
      variant = 'destructive'
      break
    case 'warning':
      variant = 'secondary'
      break
    case 'default':
      variant = 'default'
      break
    default:
      variant = 'secondary'
  }

  return { label: config.label, variant }
}

/**
 * 取得恢復類型顯示資訊
 */
export function getRestoreTypeInfo(type: RestoreType): { label: string; description: string; icon: string } {
  const config = RESTORE_TYPE_CONFIG[type]
  return {
    label: config.label,
    description: config.description,
    icon: config.icon,
  }
}

/**
 * 取得恢復範圍顯示資訊
 */
export function getRestoreScopeInfo(scope: RestoreScope): { label: string; description: string; icon: string } {
  const config = RESTORE_SCOPE_CONFIG[scope]
  return {
    label: config.label,
    description: config.description,
    icon: config.icon,
  }
}

/**
 * 取得恢復步驟顯示資訊
 */
export function getRestoreStepInfo(step: RestoreStep): RestoreStepConfig {
  return RESTORE_STEP_CONFIG[step]
}

/**
 * 取得確認文字
 */
export function getConfirmationText(type: RestoreType): string {
  if (type === 'DRILL') {
    return CONFIRMATION_TEXTS.DRILL
  }
  return CONFIRMATION_TEXTS.RESTORE
}

/**
 * 驗證確認文字是否正確
 */
export function validateConfirmationText(type: RestoreType, input: string): boolean {
  const expected = getConfirmationText(type)
  return input === expected
}

/**
 * 格式化恢復持續時間
 */
export function formatRestoreDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt) return '--'

  const end = completedAt || new Date()
  const start = new Date(startedAt)
  const durationMs = end.getTime() - start.getTime()

  if (durationMs < 0) return '--'

  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

/**
 * 格式化預估剩餘時間
 */
export function formatEstimatedTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return '--'

  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `約 ${hours} 小時 ${minutes % 60} 分鐘`
  }
  if (minutes > 0) {
    return `約 ${minutes} 分鐘`
  }
  return `約 ${seconds} 秒`
}

/**
 * 計算恢復進度百分比（基於步驟權重）
 */
export function calculateProgressFromStep(currentStep: RestoreStep, stepProgress: number = 100): number {
  const steps = Object.keys(RESTORE_STEP_CONFIG) as RestoreStep[]
  const currentIndex = steps.indexOf(currentStep)

  if (currentIndex === -1) return 0

  let completedWeight = 0
  for (let i = 0; i < currentIndex; i++) {
    completedWeight += RESTORE_STEP_CONFIG[steps[i]].progressWeight
  }

  const currentWeight = RESTORE_STEP_CONFIG[currentStep].progressWeight
  const currentStepContribution = (currentWeight * stepProgress) / 100

  const totalWeight = steps.reduce((sum, step) => sum + RESTORE_STEP_CONFIG[step].progressWeight, 0)

  return Math.round(((completedWeight + currentStepContribution) / totalWeight) * 100)
}

/**
 * 檢查恢復是否為終端狀態
 */
export function isRestoreTerminal(status: RestoreStatus): boolean {
  return RESTORE_STATUS_CONFIG[status].isTerminal
}

/**
 * 檢查恢復是否為活躍狀態（可輪詢）
 */
export function isActiveRestoreStatus(status: RestoreStatus): boolean {
  return !RESTORE_STATUS_CONFIG[status].isTerminal
}

/**
 * 檢查恢復是否可以取消
 */
export function canCancelRestore(status: RestoreStatus): boolean {
  const nonCancellableStatuses: RestoreStatus[] = [
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'ROLLED_BACK',
    'VERIFYING', // 驗證階段不可取消
  ]
  return !nonCancellableStatuses.includes(status)
}

/**
 * 檢查恢復是否可以回滾
 */
export function canRollbackRestore(record: RestoreRecordWithRelations): boolean {
  // 只有已完成且有恢復前備份的記錄可以回滾
  return (
    record.status === 'COMPLETED' &&
    record.preRestoreBackupId !== null &&
    record.type !== 'DRILL' // 演練不需要回滾
  )
}

/**
 * 取得日誌等級顏色
 */
export function getLogLevelColor(level: RestoreLogLevel): string {
  switch (level) {
    case 'info':
      return 'text-blue-500'
    case 'warn':
      return 'text-yellow-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

/**
 * 取得日誌等級圖示
 */
export function getLogLevelIcon(level: RestoreLogLevel): string {
  switch (level) {
    case 'info':
      return 'info'
    case 'warn':
      return 'alert-triangle'
    case 'error':
      return 'x-circle'
    default:
      return 'circle'
  }
}

// ============================================================================
// Re-export Prisma types
// ============================================================================
export type { PrismaRestoreRecord }
export type { PrismaRestoreDrill }
export type { PrismaRestoreLog }
