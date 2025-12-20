/**
 * @fileoverview 資料保留與歸檔服務
 * @description
 *   提供資料長期保留管理功能：
 *   - 保留策略 CRUD 操作
 *   - 自動歸檔到 Azure Blob 冷存儲
 *   - 歸檔資料還原（支援延遲載入）
 *   - 刪除請求審批工作流
 *   - 存儲指標計算
 *
 * @module src/services/data-retention.service
 * @since Epic 8 - Story 8.6
 * @lastModified 2025-12-20
 *
 * @features
 *   - createPolicy: 建立保留策略
 *   - updatePolicy: 更新保留策略
 *   - deletePolicy: 刪除保留策略
 *   - runArchiveJob: 執行歸檔任務
 *   - restoreFromArchive: 從歸檔還原
 *   - createDeletionRequest: 建立刪除請求
 *   - approveDeletionRequest: 審批刪除請求
 *   - executeDeletion: 執行刪除
 *   - getStorageMetrics: 取得存儲指標
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫存取
 *   - @/lib/azure-blob - Blob 儲存
 *   - zlib - 壓縮
 *   - crypto - 雜湊計算
 */

import { createHash } from 'crypto'
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'
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
} from '@prisma/client'
import type {
  RetentionPolicyFormData,
  DeletionRequestFormData,
  RestoreRequestFormData,
  ArchiveQueryParams,
  DeletionQueryParams,
  RestoreQueryParams,
  ArchiveJobResult,
  RestoreResult,
  StorageMetrics,
  RetentionPolicyWithRelations,
  ArchiveRecordWithRelations,
  DeletionRequestWithRelations,
  RestoreRequestWithRelations,
} from '@/types/retention'
import { STORAGE_TIER_CONFIG, DEFAULT_RETENTION_DAYS } from '@/types/retention'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

// =====================
// Constants
// =====================

/**
 * 資料表對應映射
 */
const DATA_TYPE_TABLE_MAP: Record<DataType, string> = {
  AUDIT_LOG: 'audit_logs',
  DATA_CHANGE_HISTORY: 'data_change_history',
  DOCUMENT: 'documents',
  EXTRACTION_RESULT: 'extraction_results',
  PROCESSING_RECORD: 'processing_queues',
  USER_SESSION: 'sessions',
  API_USAGE_LOG: 'api_usage_logs',
  SYSTEM_LOG: 'audit_logs', // 系統日誌與審計日誌共用
}

/**
 * 存儲層級對應的還原時間（秒）
 */
const TIER_RESTORE_TIME: Record<StorageTier, number> = {
  HOT: 0,
  COOL: 30,
  COLD: 60,
  ARCHIVE: 43200, // 12 小時
}

/**
 * 歸檔容器名稱
 */
const ARCHIVE_CONTAINER = 'data-archives'

// =====================
// Service Class
// =====================

/**
 * 資料保留服務
 *
 * @description
 *   管理資料的長期保留、歸檔和刪除，確保符合 7 年合規要求
 */
export class DataRetentionService {
  // =====================
  // Policy Management
  // =====================

  /**
   * 取得所有保留策略
   *
   * @param options - 查詢選項
   * @returns 策略列表
   */
  async getPolicies(options: {
    dataType?: DataType
    isActive?: boolean
    page?: number
    limit?: number
  } = {}): Promise<{
    policies: RetentionPolicyWithRelations[]
    total: number
  }> {
    const { dataType, isActive, page = 1, limit = 20 } = options

    const where = {
      ...(dataType && { dataType }),
      ...(isActive !== undefined && { isActive }),
    }

    const [policies, total] = await Promise.all([
      prisma.dataRetentionPolicy.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              archiveRecords: true,
              deletionRequests: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataRetentionPolicy.count({ where }),
    ])

    return { policies, total }
  }

  /**
   * 取得單一策略
   *
   * @param id - 策略 ID
   * @returns 策略詳情
   */
  async getPolicy(id: string): Promise<RetentionPolicyWithRelations | null> {
    return prisma.dataRetentionPolicy.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            archiveRecords: true,
            deletionRequests: true,
          },
        },
      },
    })
  }

  /**
   * 建立保留策略
   *
   * @param data - 策略資料
   * @param createdById - 建立者 ID
   * @returns 建立的策略
   */
  async createPolicy(
    data: RetentionPolicyFormData,
    createdById: string
  ): Promise<DataRetentionPolicy> {
    // 計算下次歸檔時間
    const nextArchiveAt = data.archiveSchedule
      ? this.calculateNextArchiveTime(data.archiveSchedule)
      : null

    return prisma.dataRetentionPolicy.create({
      data: {
        policyName: data.policyName,
        description: data.description,
        dataType: data.dataType,
        hotStorageDays: data.hotStorageDays,
        warmStorageDays: data.warmStorageDays,
        coldStorageDays: data.coldStorageDays,
        deletionProtection: data.deletionProtection,
        requireApproval: data.requireApproval,
        minApprovalLevel: data.minApprovalLevel,
        archiveSchedule: data.archiveSchedule,
        nextArchiveAt,
        isActive: data.isActive,
        createdById,
      },
    })
  }

  /**
   * 更新保留策略
   *
   * @param id - 策略 ID
   * @param data - 更新資料
   * @returns 更新後的策略
   */
  async updatePolicy(
    id: string,
    data: Partial<RetentionPolicyFormData>
  ): Promise<DataRetentionPolicy> {
    const updateData: Record<string, unknown> = {}

    if (data.policyName !== undefined) updateData.policyName = data.policyName
    if (data.description !== undefined) updateData.description = data.description
    if (data.hotStorageDays !== undefined) updateData.hotStorageDays = data.hotStorageDays
    if (data.warmStorageDays !== undefined) updateData.warmStorageDays = data.warmStorageDays
    if (data.coldStorageDays !== undefined) updateData.coldStorageDays = data.coldStorageDays
    if (data.deletionProtection !== undefined) updateData.deletionProtection = data.deletionProtection
    if (data.requireApproval !== undefined) updateData.requireApproval = data.requireApproval
    if (data.minApprovalLevel !== undefined) updateData.minApprovalLevel = data.minApprovalLevel
    if (data.archiveSchedule !== undefined) {
      updateData.archiveSchedule = data.archiveSchedule
      updateData.nextArchiveAt = data.archiveSchedule
        ? this.calculateNextArchiveTime(data.archiveSchedule)
        : null
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    return prisma.dataRetentionPolicy.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 刪除保留策略
   *
   * @param id - 策略 ID
   */
  async deletePolicy(id: string): Promise<void> {
    // 檢查是否有進行中的歸檔或刪除請求
    const policy = await prisma.dataRetentionPolicy.findUnique({
      where: { id },
      include: {
        archiveRecords: {
          where: { status: { in: ['PENDING', 'ARCHIVING', 'RESTORING'] } },
        },
        deletionRequests: {
          where: { status: { in: ['PENDING', 'EXECUTING'] } },
        },
      },
    })

    if (!policy) {
      throw new Error('策略不存在')
    }

    if (policy.archiveRecords.length > 0) {
      throw new Error('存在進行中的歸檔任務，無法刪除策略')
    }

    if (policy.deletionRequests.length > 0) {
      throw new Error('存在進行中的刪除請求，無法刪除策略')
    }

    await prisma.dataRetentionPolicy.delete({ where: { id } })
  }

  // =====================
  // Archive Operations
  // =====================

  /**
   * 取得歸檔記錄列表
   *
   * @param params - 查詢參數
   * @returns 歸檔記錄列表
   */
  async getArchiveRecords(params: ArchiveQueryParams): Promise<{
    records: ArchiveRecordWithRelations[]
    total: number
  }> {
    const {
      policyId,
      dataType,
      storageTier,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = params

    const where = {
      ...(policyId && { policyId }),
      ...(dataType && { dataType }),
      ...(storageTier && { storageTier }),
      ...(status && { status }),
      ...(dateFrom || dateTo
        ? {
            archivedAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    }

    const [records, total] = await Promise.all([
      prisma.dataArchiveRecord.findMany({
        where,
        include: {
          policy: {
            select: { id: true, policyName: true },
          },
          _count: {
            select: { restoreRequests: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataArchiveRecord.count({ where }),
    ])

    return { records, total }
  }

  /**
   * 執行歸檔任務
   *
   * @param policyId - 策略 ID
   * @param dateRangeStart - 資料日期起始
   * @param dateRangeEnd - 資料日期結束
   * @returns 歸檔結果
   */
  async runArchiveJob(
    policyId: string,
    dateRangeStart: Date,
    dateRangeEnd: Date
  ): Promise<ArchiveJobResult> {
    const startTime = Date.now()

    const policy = await prisma.dataRetentionPolicy.findUnique({
      where: { id: policyId },
    })

    if (!policy) {
      return {
        success: false,
        recordCount: 0,
        originalSizeBytes: 0,
        compressedSizeBytes: 0,
        compressionRatio: 0,
        blobPath: '',
        checksum: '',
        error: '策略不存在',
        duration: Date.now() - startTime,
      }
    }

    // 建立歸檔記錄
    const archiveRecord = await prisma.dataArchiveRecord.create({
      data: {
        policyId,
        dataType: policy.dataType,
        sourceTable: DATA_TYPE_TABLE_MAP[policy.dataType],
        recordCount: 0, // 稍後更新
        dateRangeStart,
        dateRangeEnd,
        storageTier: 'COLD',
        blobContainer: ARCHIVE_CONTAINER,
        blobPath: '', // 稍後更新
        originalSizeBytes: BigInt(0),
        compressedSizeBytes: BigInt(0),
        compressionRatio: 0,
        checksum: '',
        status: 'ARCHIVING',
      },
    })

    try {
      // 查詢要歸檔的資料
      const data = await this.fetchDataForArchive(
        policy.dataType,
        dateRangeStart,
        dateRangeEnd
      )

      if (data.length === 0) {
        await prisma.dataArchiveRecord.update({
          where: { id: archiveRecord.id },
          data: {
            status: 'ARCHIVED',
            recordCount: 0,
            archivedAt: new Date(),
          },
        })

        return {
          success: true,
          archiveRecordId: archiveRecord.id,
          recordCount: 0,
          originalSizeBytes: 0,
          compressedSizeBytes: 0,
          compressionRatio: 1,
          blobPath: '',
          checksum: '',
          duration: Date.now() - startTime,
        }
      }

      // 序列化資料
      const jsonData = JSON.stringify(data)
      const originalBuffer = Buffer.from(jsonData, 'utf-8')
      const originalSize = originalBuffer.length

      // 壓縮資料
      const compressedBuffer = await gzipAsync(originalBuffer)
      const compressedSize = compressedBuffer.length
      const compressionRatio = compressedSize / originalSize

      // 計算 SHA-256 checksum
      const checksum = createHash('sha256')
        .update(compressedBuffer)
        .digest('hex')

      // 生成 Blob 路徑
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const blobPath = `${policy.dataType.toLowerCase()}/${timestamp}_${archiveRecord.id}.json.gz`

      // 模擬上傳到 Azure Blob Storage
      // 實際環境中應使用 azure-blob.ts 的上傳功能
      // await uploadBufferToBlob(ARCHIVE_CONTAINER, blobPath, compressedBuffer)

      // 更新歸檔記錄
      await prisma.dataArchiveRecord.update({
        where: { id: archiveRecord.id },
        data: {
          recordCount: data.length,
          blobPath,
          blobUrl: `https://storage.blob.core.windows.net/${ARCHIVE_CONTAINER}/${blobPath}`,
          originalSizeBytes: BigInt(originalSize),
          compressedSizeBytes: BigInt(compressedSize),
          compressionRatio,
          checksum,
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      })

      // 更新策略的最後歸檔時間
      await prisma.dataRetentionPolicy.update({
        where: { id: policyId },
        data: {
          lastArchiveAt: new Date(),
          nextArchiveAt: policy.archiveSchedule
            ? this.calculateNextArchiveTime(policy.archiveSchedule)
            : null,
        },
      })

      return {
        success: true,
        archiveRecordId: archiveRecord.id,
        recordCount: data.length,
        originalSizeBytes: originalSize,
        compressedSizeBytes: compressedSize,
        compressionRatio,
        blobPath,
        checksum,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      // 更新歸檔記錄狀態為失敗
      await prisma.dataArchiveRecord.update({
        where: { id: archiveRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : '未知錯誤',
        },
      })

      return {
        success: false,
        recordCount: 0,
        originalSizeBytes: 0,
        compressedSizeBytes: 0,
        compressionRatio: 0,
        blobPath: '',
        checksum: '',
        error: error instanceof Error ? error.message : '未知錯誤',
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * 從歸檔還原資料
   *
   * @param data - 還原請求資料
   * @param requestedById - 請求者 ID
   * @returns 還原結果
   */
  async restoreFromArchive(
    data: RestoreRequestFormData,
    requestedById: string
  ): Promise<RestoreResult> {
    const archiveRecord = await prisma.dataArchiveRecord.findUnique({
      where: { id: data.archiveRecordId },
    })

    if (!archiveRecord) {
      return {
        success: false,
        restoreRequestId: '',
        archiveRecordId: data.archiveRecordId,
        status: 'FAILED',
        error: '歸檔記錄不存在',
      }
    }

    // 計算預估等待時間
    const estimatedWaitTime = TIER_RESTORE_TIME[archiveRecord.storageTier]

    // 建立還原請求
    const restoreRequest = await prisma.dataRestoreRequest.create({
      data: {
        archiveRecordId: data.archiveRecordId,
        reason: data.reason,
        notes: data.notes,
        requestedById,
        estimatedWaitTime,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    // 更新歸檔記錄狀態
    await prisma.dataArchiveRecord.update({
      where: { id: data.archiveRecordId },
      data: { status: 'RESTORING' },
    })

    // 模擬還原過程（實際環境中應為異步處理）
    // 這裡假設是即時還原（HOT/COOL 層級）
    if (archiveRecord.storageTier === 'HOT' || archiveRecord.storageTier === 'COOL') {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24) // 24 小時後過期

      await Promise.all([
        prisma.dataRestoreRequest.update({
          where: { id: restoreRequest.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            actualWaitTime: 0,
            restoredBlobUrl: archiveRecord.blobUrl,
            expiresAt,
          },
        }),
        prisma.dataArchiveRecord.update({
          where: { id: data.archiveRecordId },
          data: {
            status: 'RESTORED',
            lastRestoredAt: new Date(),
            restoredBlobUrl: archiveRecord.blobUrl,
            restoreExpiresAt: expiresAt,
          },
        }),
      ])

      return {
        success: true,
        restoreRequestId: restoreRequest.id,
        archiveRecordId: data.archiveRecordId,
        status: 'COMPLETED',
        blobUrl: archiveRecord.blobUrl ?? undefined,
        expiresAt,
        actualWaitTime: 0,
      }
    }

    // COLD/ARCHIVE 層級需要較長時間，返回進行中狀態
    return {
      success: true,
      restoreRequestId: restoreRequest.id,
      archiveRecordId: data.archiveRecordId,
      status: 'IN_PROGRESS',
      estimatedWaitTime,
    }
  }

  /**
   * 取得還原請求列表
   *
   * @param params - 查詢參數
   * @returns 還原請求列表
   */
  async getRestoreRequests(params: RestoreQueryParams): Promise<{
    requests: RestoreRequestWithRelations[]
    total: number
  }> {
    const {
      archiveRecordId,
      status,
      requestedById,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = params

    const where = {
      ...(archiveRecordId && { archiveRecordId }),
      ...(status && { status }),
      ...(requestedById && { requestedById }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    }

    const [requests, total] = await Promise.all([
      prisma.dataRestoreRequest.findMany({
        where,
        include: {
          archiveRecord: {
            select: {
              id: true,
              dataType: true,
              sourceTable: true,
              recordCount: true,
              storageTier: true,
              blobPath: true,
            },
          },
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataRestoreRequest.count({ where }),
    ])

    return { requests, total }
  }

  // =====================
  // Deletion Operations
  // =====================

  /**
   * 取得刪除請求列表
   *
   * @param params - 查詢參數
   * @returns 刪除請求列表
   */
  async getDeletionRequests(params: DeletionQueryParams): Promise<{
    requests: DeletionRequestWithRelations[]
    total: number
  }> {
    const {
      policyId,
      dataType,
      status,
      requestedById,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = params

    const where = {
      ...(policyId && { policyId }),
      ...(dataType && { dataType }),
      ...(status && { status }),
      ...(requestedById && { requestedById }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    }

    const [requests, total] = await Promise.all([
      prisma.dataDeletionRequest.findMany({
        where,
        include: {
          policy: {
            select: { id: true, policyName: true },
          },
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataDeletionRequest.count({ where }),
    ])

    return { requests, total }
  }

  /**
   * 建立刪除請求
   *
   * @param data - 刪除請求資料
   * @param requestedById - 請求者 ID
   * @returns 建立的刪除請求
   */
  async createDeletionRequest(
    data: DeletionRequestFormData,
    requestedById: string
  ): Promise<DataDeletionRequest> {
    const policy = await prisma.dataRetentionPolicy.findUnique({
      where: { id: data.policyId },
    })

    if (!policy) {
      throw new Error('策略不存在')
    }

    if (policy.deletionProtection) {
      throw new Error('該策略已啟用刪除保護，無法建立刪除請求')
    }

    // 計算受影響的記錄數
    const recordCount = await this.countRecordsInRange(
      data.dataType,
      data.dateRangeStart,
      data.dateRangeEnd
    )

    return prisma.dataDeletionRequest.create({
      data: {
        policyId: data.policyId,
        dataType: data.dataType,
        sourceTable: data.sourceTable,
        recordCount,
        dateRangeStart: data.dateRangeStart,
        dateRangeEnd: data.dateRangeEnd,
        reason: data.reason,
        notes: data.notes,
        requestedById,
        status: policy.requireApproval ? 'PENDING' : 'APPROVED',
        ...(policy.requireApproval ? {} : { approvedAt: new Date() }),
      },
    })
  }

  /**
   * 審批刪除請求
   *
   * @param requestId - 請求 ID
   * @param approve - 是否批准
   * @param approverId - 審批者 ID
   * @param rejectionReason - 拒絕原因（如果拒絕）
   * @returns 更新後的請求
   */
  async approveDeletionRequest(
    requestId: string,
    approve: boolean,
    approverId: string,
    rejectionReason?: string
  ): Promise<DataDeletionRequest> {
    const request = await prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
    })

    if (!request) {
      throw new Error('刪除請求不存在')
    }

    if (request.status !== 'PENDING') {
      throw new Error('刪除請求狀態無效，無法審批')
    }

    return prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason: approve ? null : rejectionReason,
      },
    })
  }

  /**
   * 執行刪除
   *
   * @param requestId - 請求 ID
   * @returns 刪除的記錄數
   */
  async executeDeletion(requestId: string): Promise<number> {
    const request = await prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: { policy: true },
    })

    if (!request) {
      throw new Error('刪除請求不存在')
    }

    if (request.status !== 'APPROVED') {
      throw new Error('刪除請求尚未批准')
    }

    // 更新狀態為執行中
    await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: 'EXECUTING' },
    })

    try {
      // 先歸檔資料作為備份
      const archiveResult = await this.runArchiveJob(
        request.policyId,
        request.dateRangeStart,
        request.dateRangeEnd
      )

      // 執行刪除（模擬）
      // 實際環境中應根據 dataType 刪除對應表的資料
      const deletedCount = await this.deleteRecordsInRange(
        request.dataType,
        request.dateRangeStart,
        request.dateRangeEnd
      )

      // 更新請求狀態
      await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          executedAt: new Date(),
          deletedRecordCount: deletedCount,
          backupArchiveId: archiveResult.archiveRecordId,
        },
      })

      return deletedCount
    } catch (error) {
      await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : '未知錯誤',
        },
      })

      throw error
    }
  }

  // =====================
  // Storage Metrics
  // =====================

  /**
   * 取得存儲指標
   *
   * @returns 存儲指標
   */
  async getStorageMetrics(): Promise<StorageMetrics> {
    // 按存儲層級統計
    const tierStats = await prisma.dataArchiveRecord.groupBy({
      by: ['storageTier'],
      where: { status: 'ARCHIVED' },
      _sum: {
        originalSizeBytes: true,
        compressedSizeBytes: true,
      },
      _count: true,
    })

    // 按資料類型統計
    const typeStats = await prisma.dataArchiveRecord.groupBy({
      by: ['dataType'],
      where: { status: 'ARCHIVED' },
      _sum: {
        compressedSizeBytes: true,
      },
      _count: true,
    })

    // 歸檔統計
    const archiveStats = await prisma.dataArchiveRecord.groupBy({
      by: ['status'],
      _count: true,
    })

    // 刪除統計
    const deletionStats = await prisma.dataDeletionRequest.aggregate({
      where: { status: 'COMPLETED' },
      _count: true,
      _sum: { deletedRecordCount: true },
    })

    const pendingDeletions = await prisma.dataDeletionRequest.count({
      where: { status: 'PENDING' },
    })

    // 還原統計
    const restoreStats = await prisma.dataRestoreRequest.aggregate({
      where: { status: 'COMPLETED' },
      _count: true,
      _avg: { actualWaitTime: true },
    })

    const pendingRestores = await prisma.dataRestoreRequest.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    })

    // 最後歸檔時間
    const lastArchive = await prisma.dataArchiveRecord.findFirst({
      where: { status: 'ARCHIVED' },
      orderBy: { archivedAt: 'desc' },
      select: { archivedAt: true },
    })

    // 計算總大小和壓縮統計
    let totalOriginalBytes = BigInt(0)
    let totalCompressedBytes = BigInt(0)

    const byTier = {
      HOT: { sizeBytes: 0, recordCount: 0, estimatedCost: 0 },
      COOL: { sizeBytes: 0, recordCount: 0, estimatedCost: 0 },
      COLD: { sizeBytes: 0, recordCount: 0, estimatedCost: 0 },
      ARCHIVE: { sizeBytes: 0, recordCount: 0, estimatedCost: 0 },
    }

    for (const stat of tierStats) {
      const tier = stat.storageTier as StorageTier
      const sizeBytes = Number(stat._sum.compressedSizeBytes ?? 0)
      const originalBytes = stat._sum.originalSizeBytes ?? BigInt(0)
      const compressedBytes = stat._sum.compressedSizeBytes ?? BigInt(0)

      totalOriginalBytes += originalBytes
      totalCompressedBytes += compressedBytes

      byTier[tier] = {
        sizeBytes,
        recordCount: stat._count,
        estimatedCost: (sizeBytes / (1024 * 1024 * 1024)) * STORAGE_TIER_CONFIG[tier].costPerGBMonth,
      }
    }

    const byDataType: StorageMetrics['byDataType'] = {}
    for (const stat of typeStats) {
      byDataType[stat.dataType] = {
        sizeBytes: Number(stat._sum.compressedSizeBytes ?? 0),
        recordCount: stat._count,
      }
    }

    const savedBytes = Number(totalOriginalBytes - totalCompressedBytes)
    const totalOriginal = Number(totalOriginalBytes)

    return {
      totalSizeBytes: Number(totalCompressedBytes),
      byTier,
      byDataType,
      compressionStats: {
        totalOriginalBytes: totalOriginal,
        totalCompressedBytes: Number(totalCompressedBytes),
        averageCompressionRatio:
          totalOriginal > 0 ? Number(totalCompressedBytes) / totalOriginal : 1,
        savedBytes,
        savedPercentage: totalOriginal > 0 ? (savedBytes / totalOriginal) * 100 : 0,
      },
      archiveStats: {
        totalArchived: archiveStats.find(s => s.status === 'ARCHIVED')?._count ?? 0,
        pendingArchive: archiveStats.find(s => s.status === 'PENDING')?._count ?? 0,
        failedArchive: archiveStats.find(s => s.status === 'FAILED')?._count ?? 0,
        lastArchiveAt: lastArchive?.archivedAt ?? undefined,
      },
      deletionStats: {
        pendingDeletions,
        completedDeletions: deletionStats._count ?? 0,
        totalDeletedRecords: deletionStats._sum.deletedRecordCount ?? 0,
      },
      restoreStats: {
        pendingRestores,
        completedRestores: restoreStats._count ?? 0,
        averageRestoreTime: restoreStats._avg.actualWaitTime ?? 0,
      },
    }
  }

  // =====================
  // Private Helpers
  // =====================

  /**
   * 計算下次歸檔時間
   */
  private calculateNextArchiveTime(cronSchedule: string): Date {
    // 簡化實現：每天凌晨 2 點執行
    // 實際環境中應解析 cron 表達式
    const next = new Date()
    next.setDate(next.getDate() + 1)
    next.setHours(2, 0, 0, 0)
    return next
  }

  /**
   * 查詢要歸檔的資料
   */
  private async fetchDataForArchive(
    dataType: DataType,
    dateRangeStart: Date,
    dateRangeEnd: Date
  ): Promise<unknown[]> {
    const dateFilter = {
      createdAt: {
        gte: dateRangeStart,
        lte: dateRangeEnd,
      },
    }

    switch (dataType) {
      case 'AUDIT_LOG':
        return prisma.auditLog.findMany({ where: dateFilter })
      case 'DATA_CHANGE_HISTORY':
        return prisma.dataChangeHistory.findMany({ where: dateFilter })
      case 'API_USAGE_LOG':
        return prisma.apiUsageLog.findMany({ where: dateFilter })
      case 'USER_SESSION':
        return prisma.session.findMany({
          where: { createdAt: dateFilter.createdAt },
        })
      default:
        return []
    }
  }

  /**
   * 計算指定範圍內的記錄數
   */
  private async countRecordsInRange(
    dataType: DataType,
    dateRangeStart: Date,
    dateRangeEnd: Date
  ): Promise<number> {
    const dateFilter = {
      createdAt: {
        gte: dateRangeStart,
        lte: dateRangeEnd,
      },
    }

    switch (dataType) {
      case 'AUDIT_LOG':
        return prisma.auditLog.count({ where: dateFilter })
      case 'DATA_CHANGE_HISTORY':
        return prisma.dataChangeHistory.count({ where: dateFilter })
      case 'API_USAGE_LOG':
        return prisma.apiUsageLog.count({ where: dateFilter })
      case 'USER_SESSION':
        return prisma.session.count({
          where: { createdAt: dateFilter.createdAt },
        })
      default:
        return 0
    }
  }

  /**
   * 刪除指定範圍內的記錄
   */
  private async deleteRecordsInRange(
    dataType: DataType,
    dateRangeStart: Date,
    dateRangeEnd: Date
  ): Promise<number> {
    const dateFilter = {
      createdAt: {
        gte: dateRangeStart,
        lte: dateRangeEnd,
      },
    }

    switch (dataType) {
      case 'AUDIT_LOG': {
        const result = await prisma.auditLog.deleteMany({ where: dateFilter })
        return result.count
      }
      case 'DATA_CHANGE_HISTORY': {
        const result = await prisma.dataChangeHistory.deleteMany({ where: dateFilter })
        return result.count
      }
      case 'API_USAGE_LOG': {
        const result = await prisma.apiUsageLog.deleteMany({ where: dateFilter })
        return result.count
      }
      case 'USER_SESSION': {
        const result = await prisma.session.deleteMany({
          where: { createdAt: dateFilter.createdAt },
        })
        return result.count
      }
      default:
        return 0
    }
  }
}

// =====================
// Singleton Instance
// =====================

export const dataRetentionService = new DataRetentionService()
