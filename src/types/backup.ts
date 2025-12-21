/**
 * @fileoverview 數據備份管理類型定義
 * @description
 *   定義數據備份管理系統的所有類型：
 *   - 備份類型和狀態枚舉
 *   - 備份記錄和排程類型
 *   - 備份配置和儲存使用量類型
 *   - API 請求和響應類型
 *
 * @module src/types/backup
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import type {
  Backup as PrismaBackup,
  BackupSchedule as PrismaBackupSchedule,
  BackupConfig as PrismaBackupConfig,
  BackupStorageUsage as PrismaBackupStorageUsage,
  BackupType as PrismaBackupType,
  BackupStatus as PrismaBackupStatus,
  BackupSource as PrismaBackupSource,
  BackupTrigger as PrismaBackupTrigger,
} from '@prisma/client'

// ============================================================================
// 枚舉類型 (與 Prisma schema 保持一致)
// ============================================================================

/**
 * 備份類型
 */
export const BackupType = {
  FULL: 'FULL',           // 完整備份
  INCREMENTAL: 'INCREMENTAL', // 增量備份
  DIFFERENTIAL: 'DIFFERENTIAL', // 差異備份
} as const
export type BackupType = PrismaBackupType

/**
 * 備份狀態
 */
export const BackupStatus = {
  PENDING: 'PENDING',       // 等待中
  IN_PROGRESS: 'IN_PROGRESS', // 進行中
  COMPLETED: 'COMPLETED',   // 完成
  FAILED: 'FAILED',         // 失敗
  CANCELLED: 'CANCELLED',   // 取消
} as const
export type BackupStatus = PrismaBackupStatus

/**
 * 備份來源
 */
export const BackupSource = {
  DATABASE: 'DATABASE',     // 數據庫
  FILES: 'FILES',           // 上傳文件
  CONFIG: 'CONFIG',         // 系統配置
  FULL_SYSTEM: 'FULL_SYSTEM', // 完整系統
} as const
export type BackupSource = PrismaBackupSource

/**
 * 備份觸發方式
 */
export const BackupTrigger = {
  SCHEDULED: 'SCHEDULED',   // 排程
  MANUAL: 'MANUAL',         // 手動
  PRE_RESTORE: 'PRE_RESTORE', // 恢復前自動備份
} as const
export type BackupTrigger = PrismaBackupTrigger

// ============================================================================
// 備份記錄類型
// ============================================================================

/**
 * 備份內容明細
 */
export interface BackupContents {
  tables?: string[]           // 備份的資料表名稱
  fileCount?: number          // 備份的檔案數量
  configSections?: string[]   // 備份的配置區塊
}

/**
 * 備份記錄（基本）
 */
export interface BackupRecord {
  id: string
  name: string
  description: string | null
  type: BackupType
  source: BackupSource
  trigger: BackupTrigger
  status: BackupStatus
  progress: number
  errorMessage: string | null
  storagePath: string | null
  sizeBytes: bigint | null
  checksum: string | null
  contents: BackupContents | null
  startedAt: Date | null
  completedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  createdBy: string | null
  scheduleId: string | null
}

/**
 * 備份列表項目（用於顯示）
 */
export interface BackupListItem {
  id: string
  name: string
  type: BackupType
  source: BackupSource
  trigger: BackupTrigger
  status: BackupStatus
  progress: number
  sizeBytes: string | null   // BigInt 序列化為字符串
  startedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  createdAt: string
  createdByName: string | null
  scheduleName: string | null
}

/**
 * 備份詳細資訊
 */
export interface BackupDetail extends BackupListItem {
  description: string | null
  errorMessage: string | null
  storagePath: string | null
  checksum: string | null
  contents: BackupContents | null
  schedule: BackupScheduleBasic | null
  createdByUser: {
    id: string
    name: string | null
    email: string
  } | null
}

// ============================================================================
// 備份排程類型
// ============================================================================

/**
 * 備份排程（基本）
 */
export interface BackupScheduleBasic {
  id: string
  name: string
  isEnabled: boolean
}

/**
 * 備份排程記錄
 */
export interface BackupScheduleRecord {
  id: string
  name: string
  description: string | null
  isEnabled: boolean
  backupType: BackupType
  backupSource: BackupSource
  cronExpression: string
  timezone: string
  retentionDays: number
  maxBackups: number
  nextRunAt: Date | null
  lastRunAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
}

/**
 * 備份排程列表項目
 */
export interface BackupScheduleListItem {
  id: string
  name: string
  description: string | null
  isEnabled: boolean
  backupType: BackupType
  backupSource: BackupSource
  cronExpression: string
  timezone: string
  retentionDays: number
  maxBackups: number
  nextRunAt: string | null
  lastRunAt: string | null
  createdAt: string
  backupCount: number
  lastBackupStatus: BackupStatus | null
}

/**
 * 備份排程詳細資訊
 */
export interface BackupScheduleDetail extends BackupScheduleListItem {
  updatedAt: string
  createdByUser: {
    id: string
    name: string | null
    email: string
  } | null
  recentBackups: BackupListItem[]
}

// ============================================================================
// 備份配置類型
// ============================================================================

/**
 * 加密配置
 */
export interface EncryptionSettings {
  enabled: boolean
  algorithm: string
  keyRotationDays: number
}

/**
 * Azure Blob Storage 配置
 */
export interface StorageSettings {
  provider: 'azure-blob' | 'local'
  containerName: string
  connectionString?: string
  maxStorageBytes: string   // BigInt 序列化
}

/**
 * 備份配置記錄
 */
export interface BackupConfigRecord {
  id: string
  key: string
  value: string
  description: string | null
  isEnabled: boolean
  updatedAt: Date
  updatedBy: string | null
}

/**
 * 系統備份配置
 */
export interface SystemBackupConfig {
  autoBackupEnabled: boolean
  defaultRetentionDays: number
  maxConcurrentBackups: number
  encryption: EncryptionSettings
  storage: StorageSettings
  notifications: {
    onSuccess: boolean
    onFailure: boolean
    recipients: string[]
  }
}

// ============================================================================
// 儲存使用量類型
// ============================================================================

/**
 * 儲存使用量記錄
 */
export interface BackupStorageUsageRecord {
  id: string
  date: Date
  totalBytes: bigint
  databaseBytes: bigint
  filesBytes: bigint
  configBytes: bigint
  backupCount: number
  createdAt: Date
}

/**
 * 儲存使用量摘要
 */
export interface StorageUsageSummary {
  totalBytes: string           // BigInt 序列化
  usedBytes: string
  availableBytes: string
  usagePercent: number
  bySource: {
    database: string
    files: string
    config: string
  }
  backupCount: number
  oldestBackupDate: string | null
  newestBackupDate: string | null
}

/**
 * 儲存趨勢數據點
 */
export interface StorageTrendPoint {
  date: string
  totalBytes: string
  backupCount: number
}

// ============================================================================
// 備份狀態摘要
// ============================================================================

/**
 * 備份狀態摘要
 */
export interface BackupStatusSummary {
  autoBackupEnabled: boolean
  lastBackup: {
    id: string
    name: string
    status: BackupStatus
    completedAt: string
    sizeBytes: string
  } | null
  nextScheduledBackup: {
    scheduleName: string
    scheduledAt: string
    source: BackupSource
    type: BackupType
  } | null
  retentionPolicy: {
    defaultDays: number
    scheduleOverrides: {
      scheduleName: string
      retentionDays: number
    }[]
  }
  storageUsage: StorageUsageSummary
  recentBackups: {
    total: number
    successful: number
    failed: number
    pending: number
  }
}

// ============================================================================
// API 請求類型
// ============================================================================

/**
 * 備份列表查詢參數
 */
export interface BackupListParams {
  page?: number
  limit?: number
  status?: BackupStatus
  source?: BackupSource
  type?: BackupType
  trigger?: BackupTrigger
  scheduleId?: string
  startDate?: string
  endDate?: string
  sortBy?: 'createdAt' | 'completedAt' | 'sizeBytes' | 'name'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 建立手動備份請求
 */
export interface CreateBackupRequest {
  name: string
  description?: string
  source: BackupSource
  type: BackupType
  options?: {
    compress?: boolean
    encrypt?: boolean
    includeTables?: string[]
    excludeTables?: string[]
    includeConfigs?: string[]
  }
}

/**
 * 建立備份排程請求
 */
export interface CreateBackupScheduleRequest {
  name: string
  description?: string
  backupType: BackupType
  backupSource: BackupSource
  cronExpression: string
  timezone?: string
  retentionDays?: number
  maxBackups?: number
  isEnabled?: boolean
}

/**
 * 更新備份排程請求
 */
export interface UpdateBackupScheduleRequest {
  name?: string
  description?: string
  backupType?: BackupType
  backupSource?: BackupSource
  cronExpression?: string
  timezone?: string
  retentionDays?: number
  maxBackups?: number
  isEnabled?: boolean
}

/**
 * 備份排程列表查詢參數
 */
export interface BackupScheduleListParams {
  page?: number
  limit?: number
  isEnabled?: boolean
  backupSource?: BackupSource
  backupType?: BackupType
  sortBy?: 'name' | 'nextRunAt' | 'lastRunAt' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 儲存趨勢查詢參數
 */
export interface StorageTrendParams {
  days?: number   // 預設 30 天
  groupBy?: 'day' | 'week' | 'month'
}

// ============================================================================
// API 響應類型
// ============================================================================

/**
 * 備份列表響應
 */
export interface BackupListResponse {
  success: true
  data: {
    backups: BackupListItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

/**
 * 備份詳情響應
 */
export interface BackupDetailResponse {
  success: true
  data: BackupDetail
}

/**
 * 建立備份響應
 */
export interface CreateBackupResponse {
  success: true
  data: {
    backup: BackupListItem
    message: string
  }
}

/**
 * 備份排程列表響應
 */
export interface BackupScheduleListResponse {
  success: true
  data: {
    schedules: BackupScheduleListItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

/**
 * 備份排程詳情響應
 */
export interface BackupScheduleDetailResponse {
  success: true
  data: BackupScheduleDetail
}

/**
 * 備份排程切換響應
 */
export interface BackupScheduleToggleResponse {
  success: true
  data: {
    schedule: BackupScheduleListItem
    message: string
  }
}

/**
 * 備份狀態摘要響應
 */
export interface BackupStatusSummaryResponse {
  success: true
  data: BackupStatusSummary
}

/**
 * 儲存使用量響應
 */
export interface StorageUsageResponse {
  success: true
  data: {
    summary: StorageUsageSummary
    trend: StorageTrendPoint[]
  }
}

// ============================================================================
// 備份進度回調類型
// ============================================================================

/**
 * 備份進度事件
 */
export interface BackupProgressEvent {
  backupId: string
  status: BackupStatus
  progress: number          // 0-100
  currentStep: string       // 當前步驟描述
  bytesProcessed?: string   // BigInt 序列化
  estimatedTotalBytes?: string
  startedAt: string
  estimatedCompletionAt?: string
  error?: string
}

/**
 * 備份進度回調函數
 */
export type BackupProgressCallback = (event: BackupProgressEvent) => void

// ============================================================================
// 常用預設常數
// ============================================================================

/**
 * 預設備份設定
 */
export const DEFAULT_BACKUP_CONFIG = {
  retentionDays: 30,
  maxBackups: 10,
  maxConcurrentBackups: 2,
  compressionEnabled: true,
  encryptionEnabled: true,
  encryptionAlgorithm: 'aes-256-cbc',
} as const

/**
 * 常用 Cron 表達式
 */
export const COMMON_CRON_EXPRESSIONS = {
  EVERY_DAY_MIDNIGHT: '0 0 * * *',           // 每天午夜
  EVERY_DAY_2AM: '0 2 * * *',                // 每天凌晨 2 點
  EVERY_WEEK_SUNDAY: '0 0 * * 0',            // 每週日午夜
  EVERY_MONTH_1ST: '0 0 1 * *',              // 每月 1 號午夜
  EVERY_6_HOURS: '0 */6 * * *',              // 每 6 小時
  EVERY_12_HOURS: '0 */12 * * *',            // 每 12 小時
} as const

/**
 * 備份類型顯示配置
 */
export const BACKUP_TYPE_CONFIG: Record<BackupType, { label: string; description: string; color: string }> = {
  [BackupType.FULL]: {
    label: '完整備份',
    description: '備份所有資料，適合定期完整備份',
    color: 'blue',
  },
  [BackupType.INCREMENTAL]: {
    label: '增量備份',
    description: '只備份上次備份後的變更，速度快但需依賴先前備份',
    color: 'green',
  },
  [BackupType.DIFFERENTIAL]: {
    label: '差異備份',
    description: '備份上次完整備份後的所有變更',
    color: 'orange',
  },
}

/**
 * 備份狀態顯示配置
 */
export const BACKUP_STATUS_CONFIG: Record<BackupStatus, { label: string; color: string; icon: string }> = {
  [BackupStatus.PENDING]: {
    label: '等待中',
    color: 'gray',
    icon: 'clock',
  },
  [BackupStatus.IN_PROGRESS]: {
    label: '進行中',
    color: 'blue',
    icon: 'loader',
  },
  [BackupStatus.COMPLETED]: {
    label: '已完成',
    color: 'green',
    icon: 'check-circle',
  },
  [BackupStatus.FAILED]: {
    label: '失敗',
    color: 'red',
    icon: 'x-circle',
  },
  [BackupStatus.CANCELLED]: {
    label: '已取消',
    color: 'orange',
    icon: 'slash',
  },
}

/**
 * 備份來源顯示配置
 */
export const BACKUP_SOURCE_CONFIG: Record<BackupSource, { label: string; description: string; icon: string }> = {
  [BackupSource.DATABASE]: {
    label: '數據庫',
    description: '備份 PostgreSQL 資料庫',
    icon: 'database',
  },
  [BackupSource.FILES]: {
    label: '上傳文件',
    description: '備份使用者上傳的文件',
    icon: 'file',
  },
  [BackupSource.CONFIG]: {
    label: '系統配置',
    description: '備份系統設定檔',
    icon: 'settings',
  },
  [BackupSource.FULL_SYSTEM]: {
    label: '完整系統',
    description: '備份數據庫、文件和配置',
    icon: 'server',
  },
}

/**
 * 備份觸發方式顯示配置
 */
export const BACKUP_TRIGGER_CONFIG: Record<BackupTrigger, { label: string; color: string }> = {
  [BackupTrigger.SCHEDULED]: {
    label: '排程',
    color: 'purple',
  },
  [BackupTrigger.MANUAL]: {
    label: '手動',
    color: 'blue',
  },
  [BackupTrigger.PRE_RESTORE]: {
    label: '恢復前備份',
    color: 'orange',
  },
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 取得備份類型配置
 */
export function getBackupTypeConfig(type: BackupType) {
  return BACKUP_TYPE_CONFIG[type]
}

/**
 * 取得備份狀態配置
 */
export function getBackupStatusConfig(status: BackupStatus) {
  return BACKUP_STATUS_CONFIG[status]
}

/**
 * 取得備份來源配置
 */
export function getBackupSourceConfig(source: BackupSource) {
  return BACKUP_SOURCE_CONFIG[source]
}

/**
 * 取得備份觸發方式配置
 */
export function getBackupTriggerConfig(trigger: BackupTrigger) {
  return BACKUP_TRIGGER_CONFIG[trigger]
}

// ============================================================================
// UI 輔助函數（用於組件顯示）
// ============================================================================

/**
 * Badge 變體類型
 */
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/**
 * 取得狀態顯示資訊（用於 UI 組件）
 */
export function getStatusInfo(status: BackupStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'PENDING':
      return { label: '待處理', variant: 'secondary' }
    case 'IN_PROGRESS':
      return { label: '執行中', variant: 'default' }
    case 'COMPLETED':
      return { label: '已完成', variant: 'outline' }
    case 'FAILED':
      return { label: '失敗', variant: 'destructive' }
    case 'CANCELLED':
      return { label: '已取消', variant: 'secondary' }
    default:
      return { label: status, variant: 'secondary' }
  }
}

/**
 * 取得來源顯示資訊（用於 UI 組件）
 */
export function getSourceInfo(source: BackupSource): { label: string; icon: string } {
  switch (source) {
    case 'DATABASE':
      return { label: '資料庫', icon: 'database' }
    case 'FILES':
      return { label: '檔案', icon: 'file' }
    case 'CONFIG':
      return { label: '系統設定', icon: 'settings' }
    case 'FULL_SYSTEM':
      return { label: '完整系統', icon: 'server' }
    default:
      return { label: source, icon: 'folder' }
  }
}

/**
 * 取得類型顯示資訊（用於 UI 組件）
 */
export function getTypeInfo(type: BackupType): { label: string; description: string } {
  switch (type) {
    case 'FULL':
      return { label: '完整備份', description: '備份所有資料' }
    case 'INCREMENTAL':
      return { label: '增量備份', description: '只備份變更的資料' }
    case 'DIFFERENTIAL':
      return { label: '差異備份', description: '備份自上次完整備份後的變更' }
    default:
      return { label: type, description: '' }
  }
}

/**
 * 格式化檔案大小（與 formatStorageSize 相同，用於組件相容）
 */
export function formatFileSize(bytes: string | number | bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return '--'

  let numBytes: number
  if (typeof bytes === 'string') {
    numBytes = Number(BigInt(bytes))
  } else if (typeof bytes === 'bigint') {
    numBytes = Number(bytes)
  } else {
    numBytes = bytes
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0

  while (numBytes >= 1024 && unitIndex < units.length - 1) {
    numBytes /= 1024
    unitIndex++
  }

  return `${numBytes.toFixed(2)} ${units[unitIndex]}`
}

/**
 * 格式化儲存大小
 */
export function formatStorageSize(bytes: string | bigint | null): string {
  if (bytes === null) return '--'

  const numBytes = typeof bytes === 'string' ? BigInt(bytes) : bytes
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = Number(numBytes)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * 解析 Cron 表達式為人類可讀描述
 */
export function describeCronExpression(cron: string): string {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // 簡單的常見情況描述
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return '每天午夜'
  }
  if (minute === '0' && hour === '2' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return '每天凌晨 2 點'
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '0') {
    return '每週日午夜'
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
    return '每月 1 號午夜'
  }
  if (minute === '0' && hour.startsWith('*/')) {
    const interval = hour.substring(2)
    return `每 ${interval} 小時`
  }

  return cron
}

/**
 * 計算備份過期日期
 */
export function calculateExpiryDate(createdAt: Date, retentionDays: number): Date {
  const expiryDate = new Date(createdAt)
  expiryDate.setDate(expiryDate.getDate() + retentionDays)
  return expiryDate
}

/**
 * 檢查備份是否即將過期（7 天內）
 */
export function isBackupExpiringSoon(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return expiryDate <= sevenDaysFromNow && expiryDate > now
}

/**
 * 檢查備份是否已過期
 */
export function isBackupExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return expiryDate <= new Date()
}

// ============================================================================
// Re-export Prisma types
// ============================================================================
export type { PrismaBackup as Backup }
export type { PrismaBackupSchedule as BackupSchedule }
export type { PrismaBackupConfig as BackupConfig }
export type { PrismaBackupStorageUsage as BackupStorageUsage }
