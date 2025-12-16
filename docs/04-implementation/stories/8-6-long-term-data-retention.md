# Story 8-6: 長期數據保留

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 8: 審計追溯與合規 |
| Story ID | 8.6 |
| 標題 | 長期數據保留 |
| FR 覆蓋 | FR53 |
| 狀態 | ready-for-dev |
| 優先級 | High |
| 估計點數 | 8 |

---

## 用戶故事

**As a** 系統,
**I want** 保留數據和日誌至少 7 年,
**So that** 符合審計和合規要求。

---

## 驗收標準

### AC1: 數據保留期限保護

**Given** 數據和日誌記錄
**When** 達到保留期限（7 年）
**Then** 系統不會自動刪除
**And** 需要管理員手動審批才能清理

### AC2: 自動歸檔至冷儲存

**Given** 歷史數據
**When** 超過 1 年
**Then** 系統自動移至歸檔儲存（冷儲存）
**And** 降低儲存成本

### AC3: 歸檔數據可查詢

**Given** 歸檔數據
**When** 需要查詢
**Then** 系統可以從歸檔中讀取
**And** 支援延遲載入（最長 30 秒）

### AC4: 數據保留政策配置

**Given** 數據保留政策
**When** 系統配置
**Then** 可以設定：
- 活躍儲存期限（預設 1 年）
- 歸檔儲存期限（預設 7 年）
- 清理審批流程

---

## 技術實作規格

### 1. 資料模型

#### Prisma Schema 擴展

```prisma
// 數據保留政策配置
model DataRetentionPolicy {
  id                    String    @id @default(cuid())

  // 政策識別
  policyName            String    @unique
  description           String?

  // 數據類型
  dataType              DataType  // 適用的數據類型

  // 保留期限設定（天數）
  hotStorageDays        Int       @default(90)   // 熱儲存（即時存取）
  warmStorageDays       Int       @default(365)  // 溫儲存（快速存取）
  coldStorageDays       Int       @default(2555) // 冷儲存（7 年）

  // 保護設定
  deletionProtection    Boolean   @default(true)  // 刪除保護
  requireApproval       Boolean   @default(true)  // 需要審批
  minApprovalLevel      String    @default("ADMIN") // 最低審批層級

  // 排程設定
  archiveSchedule       String?   // Cron 表達式
  lastArchiveAt         DateTime?
  nextArchiveAt         DateTime?

  // 狀態
  isActive              Boolean   @default(true)

  // 時間戳
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  createdById           String
  createdBy             User      @relation(fields: [createdById], references: [id])

  @@index([dataType])
  @@index([isActive])
}

// 數據類型枚舉
enum DataType {
  AUDIT_LOG           // 審計日誌
  DATA_CHANGE_HISTORY // 數據變更歷史
  DOCUMENT            // 文件
  EXTRACTION_RESULT   // 提取結果
  PROCESSING_RECORD   // 處理記錄
  USER_SESSION        // 用戶會話
  API_USAGE_LOG       // API 使用日誌
  SYSTEM_LOG          // 系統日誌
}

// 數據歸檔記錄
model DataArchiveRecord {
  id                String              @id @default(cuid())

  // 歸檔識別
  archiveBatchId    String              // 批次 ID
  dataType          DataType            // 數據類型

  // 來源資訊
  sourceTable       String              // 來源資料表
  recordCount       Int                 // 記錄數量
  dateRangeFrom     DateTime            // 數據日期範圍起
  dateRangeTo       DateTime            // 數據日期範圍迄

  // 歸檔檔案資訊
  archiveFileUrl    String              // 歸檔檔案 URL
  archiveFileSize   BigInt              // 檔案大小
  compressionType   String              @default("gzip") // 壓縮類型
  checksum          String              // SHA-256 雜湊值

  // 儲存層級
  storageTier       StorageTier         @default(COOL)

  // 狀態
  status            ArchiveStatus       @default(COMPLETED)

  // 保留資訊
  retentionUntil    DateTime            // 保留至日期
  deletionProtected Boolean             @default(true)

  // 還原資訊
  lastRestoredAt    DateTime?           // 最後還原時間
  restoreCount      Int                 @default(0) // 還原次數

  // 時間戳
  createdAt         DateTime            @default(now())
  archivedById      String?
  archivedBy        User?               @relation(fields: [archivedById], references: [id])

  @@index([archiveBatchId])
  @@index([dataType])
  @@index([storageTier])
  @@index([retentionUntil])
  @@index([dateRangeFrom, dateRangeTo])
}

// 儲存層級
enum StorageTier {
  HOT       // 熱儲存 - 即時存取
  COOL      // 溫儲存 - 快速存取
  COLD      // 冷儲存 - 延遲存取
  ARCHIVE   // 歸檔 - 需要還原
}

// 歸檔狀態
enum ArchiveStatus {
  PENDING       // 待歸檔
  IN_PROGRESS   // 歸檔中
  COMPLETED     // 已完成
  FAILED        // 失敗
  RESTORING     // 還原中
  RESTORED      // 已還原
  DELETED       // 已刪除
}

// 數據刪除請求
model DataDeletionRequest {
  id                String              @id @default(cuid())

  // 請求內容
  dataType          DataType            // 數據類型
  dateRangeFrom     DateTime            // 刪除範圍起
  dateRangeTo       DateTime            // 刪除範圍迄
  estimatedRecords  Int                 // 預估記錄數
  reason            String              // 刪除原因

  // 審批流程
  status            DeletionRequestStatus @default(PENDING)
  requestedById     String
  requestedBy       User                @relation("DeletionRequester", fields: [requestedById], references: [id])
  requestedAt       DateTime            @default(now())

  // 審批資訊
  approvedById      String?
  approvedBy        User?               @relation("DeletionApprover", fields: [approvedById], references: [id])
  approvedAt        DateTime?
  approvalComments  String?

  // 執行資訊
  executedAt        DateTime?
  deletedRecords    Int?
  executionLog      Json?

  // 時間戳
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([status])
  @@index([requestedById])
  @@index([dataType])
}

// 刪除請求狀態
enum DeletionRequestStatus {
  PENDING     // 待審批
  APPROVED    // 已核准
  REJECTED    // 已拒絕
  EXECUTING   // 執行中
  COMPLETED   // 已完成
  FAILED      // 執行失敗
  CANCELLED   // 已取消
}

// 數據還原請求
model DataRestoreRequest {
  id                String              @id @default(cuid())

  // 請求內容
  archiveRecordId   String              // 歸檔記錄 ID
  archiveRecord     DataArchiveRecord   @relation(fields: [archiveRecordId], references: [id])
  reason            String              // 還原原因

  // 狀態
  status            RestoreRequestStatus @default(PENDING)
  estimatedTime     Int?                // 預估等待時間（秒）

  // 請求者
  requestedById     String
  requestedBy       User                @relation(fields: [requestedById], references: [id])
  requestedAt       DateTime            @default(now())

  // 還原結果
  restoredAt        DateTime?
  tempAccessUrl     String?             // 臨時存取 URL
  accessExpiresAt   DateTime?           // 存取過期時間

  // 時間戳
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([archiveRecordId])
  @@index([status])
  @@index([requestedById])
}

// 還原請求狀態
enum RestoreRequestStatus {
  PENDING       // 待處理
  RESTORING     // 還原中
  COMPLETED     // 已完成
  FAILED        // 失敗
  EXPIRED       // 已過期
}
```

### 2. Azure Blob Storage 生命週期管理

#### 生命週期政策配置

```json
// azure-lifecycle-policy.json
{
  "rules": [
    {
      "enabled": true,
      "name": "audit-logs-tier-policy",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": {
              "daysAfterModificationGreaterThan": 90
            },
            "tierToCold": {
              "daysAfterModificationGreaterThan": 365
            },
            "tierToArchive": {
              "daysAfterModificationGreaterThan": 730
            }
          }
        },
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["audit-logs/", "data-changes/"]
        }
      }
    },
    {
      "enabled": true,
      "name": "documents-tier-policy",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": {
              "daysAfterModificationGreaterThan": 30
            },
            "tierToCold": {
              "daysAfterModificationGreaterThan": 180
            },
            "tierToArchive": {
              "daysAfterModificationGreaterThan": 365
            }
          }
        },
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["documents/processed/", "documents/archived/"]
        }
      }
    },
    {
      "enabled": true,
      "name": "legal-hold-protection",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "enableAutoTierToHotFromCool": false
          }
        },
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["legal-hold/"]
        }
      }
    }
  ]
}
```

### 3. 數據歸檔服務

```typescript
// lib/services/data-retention.service.ts
import { BlobServiceClient, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob'
import { createGzip, createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'

// 儲存層級配置
const STORAGE_TIER_CONFIG = {
  HOT: { accessLatencyMs: 0, costPerGb: 0.0184 },
  COOL: { accessLatencyMs: 0, costPerGb: 0.01 },
  COLD: { accessLatencyMs: 0, costPerGb: 0.0036 },
  ARCHIVE: { accessLatencyMs: 43200000, costPerGb: 0.00099 } // 12 小時
}

// 數據類型預設保留配置
const DEFAULT_RETENTION_DAYS: Record<DataType, { hot: number; warm: number; cold: number }> = {
  AUDIT_LOG: { hot: 90, warm: 365, cold: 2555 },           // 7 年
  DATA_CHANGE_HISTORY: { hot: 90, warm: 365, cold: 2555 }, // 7 年
  DOCUMENT: { hot: 30, warm: 180, cold: 2555 },            // 7 年
  EXTRACTION_RESULT: { hot: 90, warm: 365, cold: 2555 },   // 7 年
  PROCESSING_RECORD: { hot: 90, warm: 365, cold: 2555 },   // 7 年
  USER_SESSION: { hot: 30, warm: 90, cold: 365 },          // 1 年
  API_USAGE_LOG: { hot: 30, warm: 180, cold: 1095 },       // 3 年
  SYSTEM_LOG: { hot: 30, warm: 90, cold: 365 }             // 1 年
}

export class DataRetentionService {
  private blobServiceClient: BlobServiceClient
  private containerClient: any

  constructor(
    private prisma: PrismaClient,
    connectionString: string
  ) {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = this.blobServiceClient.getContainerClient('data-archive')
  }

  // 執行歸檔任務
  async runArchiveJob(dataType: DataType): Promise<{
    batchId: string
    recordsArchived: number
    archiveFileUrl: string
  }> {
    const policy = await this.getRetentionPolicy(dataType)
    const batchId = `archive-${dataType}-${Date.now()}`

    // 計算歸檔截止日期
    const archiveCutoffDate = new Date()
    archiveCutoffDate.setDate(archiveCutoffDate.getDate() - policy.warmStorageDays)

    // 根據數據類型取得待歸檔記錄
    const records = await this.fetchRecordsToArchive(dataType, archiveCutoffDate)

    if (records.length === 0) {
      return { batchId, recordsArchived: 0, archiveFileUrl: '' }
    }

    // 壓縮並上傳歸檔檔案
    const { archiveUrl, checksum, fileSize, dateRange } = await this.compressAndUpload(
      batchId,
      dataType,
      records
    )

    // 建立歸檔記錄
    await this.prisma.dataArchiveRecord.create({
      data: {
        archiveBatchId: batchId,
        dataType,
        sourceTable: this.getSourceTable(dataType),
        recordCount: records.length,
        dateRangeFrom: dateRange.from,
        dateRangeTo: dateRange.to,
        archiveFileUrl: archiveUrl,
        archiveFileSize: BigInt(fileSize),
        checksum,
        storageTier: 'COOL',
        retentionUntil: this.calculateRetentionDate(policy.coldStorageDays),
        deletionProtected: policy.deletionProtection
      }
    })

    // 刪除已歸檔的原始記錄（保留歸檔記錄作為參照）
    await this.deleteArchivedRecords(dataType, records)

    // 更新政策最後執行時間
    await this.prisma.dataRetentionPolicy.update({
      where: { id: policy.id },
      data: {
        lastArchiveAt: new Date(),
        nextArchiveAt: this.calculateNextArchiveTime(policy.archiveSchedule)
      }
    })

    return {
      batchId,
      recordsArchived: records.length,
      archiveFileUrl: archiveUrl
    }
  }

  // 取得待歸檔記錄
  private async fetchRecordsToArchive(
    dataType: DataType,
    cutoffDate: Date
  ): Promise<any[]> {
    const batchSize = 10000

    switch (dataType) {
      case 'AUDIT_LOG':
        return this.prisma.auditLog.findMany({
          where: {
            timestamp: { lt: cutoffDate },
            isArchived: { not: true }
          },
          take: batchSize,
          orderBy: { timestamp: 'asc' }
        })

      case 'DATA_CHANGE_HISTORY':
        return this.prisma.dataChangeHistory.findMany({
          where: {
            createdAt: { lt: cutoffDate },
            isArchived: { not: true }
          },
          take: batchSize,
          orderBy: { createdAt: 'asc' }
        })

      case 'PROCESSING_RECORD':
        return this.prisma.processingRecord.findMany({
          where: {
            processedAt: { lt: cutoffDate },
            isArchived: { not: true }
          },
          take: batchSize,
          orderBy: { processedAt: 'asc' }
        })

      default:
        throw new Error(`Unsupported data type for archiving: ${dataType}`)
    }
  }

  // 壓縮並上傳
  private async compressAndUpload(
    batchId: string,
    dataType: DataType,
    records: any[]
  ): Promise<{
    archiveUrl: string
    checksum: string
    fileSize: number
    dateRange: { from: Date; to: Date }
  }> {
    // 準備數據
    const jsonData = JSON.stringify(records, null, 0)
    const buffer = Buffer.from(jsonData, 'utf-8')

    // 壓縮
    const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
      const gzip = createGzip({ level: 9 })
      const chunks: Buffer[] = []

      gzip.on('data', (chunk) => chunks.push(chunk))
      gzip.on('end', () => resolve(Buffer.concat(chunks)))
      gzip.on('error', reject)

      gzip.write(buffer)
      gzip.end()
    })

    // 計算雜湊值
    const checksum = createHash('sha256').update(compressedBuffer).digest('hex')

    // 計算日期範圍
    const timestamps = records.map(r =>
      new Date(r.timestamp || r.createdAt || r.processedAt)
    ).sort((a, b) => a.getTime() - b.getTime())

    const dateRange = {
      from: timestamps[0],
      to: timestamps[timestamps.length - 1]
    }

    // 上傳到 Blob Storage
    const blobName = `${dataType.toLowerCase()}/${dateRange.from.getFullYear()}/${batchId}.json.gz`
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.upload(compressedBuffer, compressedBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/gzip',
        blobContentEncoding: 'gzip'
      },
      metadata: {
        dataType,
        batchId,
        recordCount: records.length.toString(),
        originalSize: buffer.length.toString(),
        compressedSize: compressedBuffer.length.toString(),
        checksum
      },
      tier: 'Cool' // 初始存放在 Cool 層
    })

    return {
      archiveUrl: blockBlobClient.url,
      checksum,
      fileSize: compressedBuffer.length,
      dateRange
    }
  }

  // 刪除已歸檔的原始記錄
  private async deleteArchivedRecords(
    dataType: DataType,
    records: any[]
  ): Promise<void> {
    const ids = records.map(r => r.id)

    switch (dataType) {
      case 'AUDIT_LOG':
        // 審計日誌不刪除，只標記為已歸檔
        await this.prisma.auditLog.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: true }
        })
        break

      case 'DATA_CHANGE_HISTORY':
        await this.prisma.dataChangeHistory.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: true }
        })
        break

      case 'PROCESSING_RECORD':
        await this.prisma.processingRecord.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: true }
        })
        break
    }
  }

  // 從歸檔還原數據
  async restoreFromArchive(
    archiveRecordId: string,
    requestedById: string,
    reason: string
  ): Promise<{
    requestId: string
    estimatedTime: number
    status: RestoreRequestStatus
  }> {
    const archiveRecord = await this.prisma.dataArchiveRecord.findUniqueOrThrow({
      where: { id: archiveRecordId }
    })

    // 檢查儲存層級，決定還原時間
    const tierConfig = STORAGE_TIER_CONFIG[archiveRecord.storageTier]
    const estimatedTime = Math.ceil(tierConfig.accessLatencyMs / 1000)

    // 建立還原請求
    const request = await this.prisma.dataRestoreRequest.create({
      data: {
        archiveRecordId,
        reason,
        requestedById,
        estimatedTime,
        status: archiveRecord.storageTier === 'ARCHIVE' ? 'PENDING' : 'RESTORING'
      }
    })

    // 如果是 Archive 層，需要先 rehydrate
    if (archiveRecord.storageTier === 'ARCHIVE') {
      await this.initiateRehydration(archiveRecord.archiveFileUrl)
    } else {
      // 非 Archive 層可以直接存取
      await this.processRestore(request.id)
    }

    return {
      requestId: request.id,
      estimatedTime,
      status: request.status
    }
  }

  // 啟動 Archive 層 rehydration
  private async initiateRehydration(archiveFileUrl: string): Promise<void> {
    const blobUrl = new URL(archiveFileUrl)
    const blobName = blobUrl.pathname.split('/').slice(2).join('/')
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)

    // 設定 rehydrate 優先級（Standard: 15 小時，High: 1 小時但較貴）
    await blockBlobClient.setAccessTier('Cool', {
      rehydratePriority: 'Standard'
    })
  }

  // 處理還原
  async processRestore(requestId: string): Promise<void> {
    const request = await this.prisma.dataRestoreRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { archiveRecord: true }
    })

    try {
      await this.prisma.dataRestoreRequest.update({
        where: { id: requestId },
        data: { status: 'RESTORING' }
      })

      // 下載歸檔檔案
      const blobUrl = new URL(request.archiveRecord.archiveFileUrl)
      const blobName = blobUrl.pathname.split('/').slice(2).join('/')
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)

      const downloadResponse = await blockBlobClient.download()
      const compressedBuffer = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      // 解壓縮
      const decompressedBuffer = await new Promise<Buffer>((resolve, reject) => {
        const gunzip = createGunzip()
        const chunks: Buffer[] = []

        gunzip.on('data', (chunk) => chunks.push(chunk))
        gunzip.on('end', () => resolve(Buffer.concat(chunks)))
        gunzip.on('error', reject)

        gunzip.write(compressedBuffer)
        gunzip.end()
      })

      // 驗證 checksum
      const checksum = createHash('sha256').update(compressedBuffer).digest('hex')
      if (checksum !== request.archiveRecord.checksum) {
        throw new Error('Archive integrity check failed')
      }

      // 產生臨時存取 URL
      const tempBlobName = `temp-restore/${requestId}.json`
      const tempBlobClient = this.containerClient.getBlockBlobClient(tempBlobName)

      await tempBlobClient.upload(decompressedBuffer, decompressedBuffer.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      })

      // 產生 SAS URL（24 小時有效）
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const sasUrl = await tempBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: expiresAt
      })

      // 更新請求狀態
      await this.prisma.dataRestoreRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          restoredAt: new Date(),
          tempAccessUrl: sasUrl,
          accessExpiresAt: expiresAt
        }
      })

      // 更新歸檔記錄
      await this.prisma.dataArchiveRecord.update({
        where: { id: request.archiveRecordId },
        data: {
          lastRestoredAt: new Date(),
          restoreCount: { increment: 1 }
        }
      })

    } catch (error) {
      await this.prisma.dataRestoreRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED' }
      })
      throw error
    }
  }

  // 建立數據刪除請求
  async createDeletionRequest(
    dataType: DataType,
    dateRange: { from: Date; to: Date },
    reason: string,
    requestedById: string
  ): Promise<DataDeletionRequest> {
    // 檢查保留政策
    const policy = await this.getRetentionPolicy(dataType)

    // 計算最小保留日期
    const minRetentionDate = new Date()
    minRetentionDate.setDate(minRetentionDate.getDate() - policy.coldStorageDays)

    // 檢查是否在保留期限內
    if (dateRange.to > minRetentionDate) {
      throw new Error(
        `Data within retention period cannot be deleted. ` +
        `Retention policy requires ${policy.coldStorageDays} days.`
      )
    }

    // 預估受影響記錄數
    const estimatedRecords = await this.estimateAffectedRecords(dataType, dateRange)

    return this.prisma.dataDeletionRequest.create({
      data: {
        dataType,
        dateRangeFrom: dateRange.from,
        dateRangeTo: dateRange.to,
        estimatedRecords,
        reason,
        requestedById,
        status: 'PENDING'
      }
    })
  }

  // 審批刪除請求
  async approveDeletionRequest(
    requestId: string,
    approvedById: string,
    comments?: string
  ): Promise<void> {
    const request = await this.prisma.dataDeletionRequest.findUniqueOrThrow({
      where: { id: requestId }
    })

    if (request.status !== 'PENDING') {
      throw new Error('Request is not pending approval')
    }

    // 檢查審批權限
    const approver = await this.prisma.user.findUniqueOrThrow({
      where: { id: approvedById }
    })

    const policy = await this.getRetentionPolicy(request.dataType)
    if (!this.hasApprovalAuthority(approver.role, policy.minApprovalLevel)) {
      throw new Error('Insufficient approval authority')
    }

    await this.prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
        approvalComments: comments
      }
    })
  }

  // 執行數據刪除
  async executeDeletion(requestId: string): Promise<{
    deletedRecords: number
  }> {
    const request = await this.prisma.dataDeletionRequest.findUniqueOrThrow({
      where: { id: requestId }
    })

    if (request.status !== 'APPROVED') {
      throw new Error('Request is not approved')
    }

    await this.prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: 'EXECUTING' }
    })

    try {
      // 刪除歸檔記錄和檔案
      const archiveRecords = await this.prisma.dataArchiveRecord.findMany({
        where: {
          dataType: request.dataType,
          dateRangeFrom: { gte: request.dateRangeFrom },
          dateRangeTo: { lte: request.dateRangeTo },
          deletionProtected: false
        }
      })

      let deletedRecords = 0

      for (const archive of archiveRecords) {
        // 刪除 Blob 檔案
        const blobUrl = new URL(archive.archiveFileUrl)
        const blobName = blobUrl.pathname.split('/').slice(2).join('/')
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
        await blockBlobClient.delete()

        deletedRecords += archive.recordCount

        // 更新歸檔記錄狀態
        await this.prisma.dataArchiveRecord.update({
          where: { id: archive.id },
          data: { status: 'DELETED' }
        })
      }

      await this.prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          executedAt: new Date(),
          deletedRecords,
          executionLog: {
            archiveRecordsDeleted: archiveRecords.length,
            totalRecordsDeleted: deletedRecords
          }
        }
      })

      return { deletedRecords }

    } catch (error) {
      await this.prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'FAILED',
          executionLog: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
      throw error
    }
  }

  // 取得保留政策
  private async getRetentionPolicy(dataType: DataType): Promise<DataRetentionPolicy> {
    let policy = await this.prisma.dataRetentionPolicy.findFirst({
      where: { dataType, isActive: true }
    })

    if (!policy) {
      // 使用預設政策
      const defaults = DEFAULT_RETENTION_DAYS[dataType]
      policy = {
        id: 'default',
        policyName: `default-${dataType}`,
        dataType,
        hotStorageDays: defaults.hot,
        warmStorageDays: defaults.warm,
        coldStorageDays: defaults.cold,
        deletionProtection: true,
        requireApproval: true,
        minApprovalLevel: 'ADMIN'
      } as DataRetentionPolicy
    }

    return policy
  }

  // 計算保留截止日期
  private calculateRetentionDate(days: number): Date {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date
  }

  // 預估受影響記錄數
  private async estimateAffectedRecords(
    dataType: DataType,
    dateRange: { from: Date; to: Date }
  ): Promise<number> {
    return this.prisma.dataArchiveRecord.aggregate({
      where: {
        dataType,
        dateRangeFrom: { gte: dateRange.from },
        dateRangeTo: { lte: dateRange.to }
      },
      _sum: { recordCount: true }
    }).then(result => result._sum.recordCount || 0)
  }

  // 輔助方法
  private getSourceTable(dataType: DataType): string {
    const tableMap: Record<DataType, string> = {
      AUDIT_LOG: 'AuditLog',
      DATA_CHANGE_HISTORY: 'DataChangeHistory',
      DOCUMENT: 'Document',
      EXTRACTION_RESULT: 'ExtractionResult',
      PROCESSING_RECORD: 'ProcessingRecord',
      USER_SESSION: 'UserSession',
      API_USAGE_LOG: 'ApiUsageLog',
      SYSTEM_LOG: 'SystemLog'
    }
    return tableMap[dataType]
  }

  private calculateNextArchiveTime(cronExpression?: string | null): Date {
    // 簡化實作：下次執行在明天凌晨 2 點
    const next = new Date()
    next.setDate(next.getDate() + 1)
    next.setHours(2, 0, 0, 0)
    return next
  }

  private hasApprovalAuthority(userRole: string, requiredLevel: string): boolean {
    const roleHierarchy = ['USER', 'CITY_MANAGER', 'REGIONAL_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    const userLevel = roleHierarchy.indexOf(userRole)
    const requiredLevelIndex = roleHierarchy.indexOf(requiredLevel)
    return userLevel >= requiredLevelIndex
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }
}
```

### 4. API 路由

```typescript
// app/api/admin/retention/policies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

// GET - 取得保留政策列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const policies = await prisma.dataRetentionPolicy.findMany({
      orderBy: { dataType: 'asc' }
    })

    return NextResponse.json(policies)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch policies' },
      { status: 500 }
    )
  }
}

// POST - 建立或更新保留政策
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const {
      dataType,
      policyName,
      hotStorageDays,
      warmStorageDays,
      coldStorageDays,
      deletionProtection,
      requireApproval,
      minApprovalLevel
    } = body

    const policy = await prisma.dataRetentionPolicy.upsert({
      where: { policyName },
      update: {
        hotStorageDays,
        warmStorageDays,
        coldStorageDays,
        deletionProtection,
        requireApproval,
        minApprovalLevel
      },
      create: {
        policyName,
        dataType,
        hotStorageDays,
        warmStorageDays,
        coldStorageDays,
        deletionProtection,
        requireApproval,
        minApprovalLevel,
        createdById: session.user.id
      }
    })

    return NextResponse.json(policy)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save policy' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/retention/archives/route.ts
import { NextRequest, NextResponse } from 'next/server'

// GET - 取得歸檔記錄列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !['ADMIN', 'AUDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dataType = searchParams.get('dataType')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    const where: any = {}
    if (dataType) {
      where.dataType = dataType
    }

    const [archives, total] = await Promise.all([
      prisma.dataArchiveRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.dataArchiveRecord.count({ where })
    ])

    return NextResponse.json({
      items: archives,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch archives' },
      { status: 500 }
    )
  }
}

// POST - 手動執行歸檔
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { dataType } = await request.json()

    const retentionService = new DataRetentionService(
      prisma,
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )

    const result = await retentionService.runArchiveJob(dataType)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to run archive job' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/retention/restore/route.ts
import { NextRequest, NextResponse } from 'next/server'

// POST - 建立還原請求
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !['ADMIN', 'AUDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { archiveRecordId, reason } = await request.json()

    const retentionService = new DataRetentionService(
      prisma,
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )

    const result = await retentionService.restoreFromArchive(
      archiveRecordId,
      session.user.id,
      reason
    )

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create restore request' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/retention/deletion/route.ts
import { NextRequest, NextResponse } from 'next/server'

// GET - 取得刪除請求列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const requests = await prisma.dataDeletionRequest.findMany({
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(requests)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch deletion requests' },
      { status: 500 }
    )
  }
}

// POST - 建立刪除請求
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { dataType, dateRange, reason } = await request.json()

    const retentionService = new DataRetentionService(
      prisma,
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )

    const result = await retentionService.createDeletionRequest(
      dataType,
      {
        from: new Date(dateRange.from),
        to: new Date(dateRange.to)
      },
      reason,
      session.user.id
    )

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create request' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/retention/deletion/[requestId]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'

// POST - 審批刪除請求
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { comments } = await request.json()

    const retentionService = new DataRetentionService(
      prisma,
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )

    await retentionService.approveDeletionRequest(
      params.requestId,
      session.user.id,
      comments
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve request' },
      { status: 500 }
    )
  }
}
```

### 5. React 元件

```typescript
// components/admin/DataRetentionDashboard.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RetentionPolicyList } from './RetentionPolicyList'
import { ArchiveRecordList } from './ArchiveRecordList'
import { DeletionRequestList } from './DeletionRequestList'
import { StorageMetrics } from './StorageMetrics'

export function DataRetentionDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">數據保留管理</h1>
        <p className="text-muted-foreground">
          管理數據保留政策、歸檔記錄和刪除請求
        </p>
      </div>

      <StorageMetrics />

      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">保留政策</TabsTrigger>
          <TabsTrigger value="archives">歸檔記錄</TabsTrigger>
          <TabsTrigger value="deletions">刪除請求</TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <RetentionPolicyList />
        </TabsContent>

        <TabsContent value="archives">
          <ArchiveRecordList />
        </TabsContent>

        <TabsContent value="deletions">
          <DeletionRequestList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

```typescript
// components/admin/RetentionPolicyList.tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Edit2, Save, Shield, Clock, Database } from 'lucide-react'
import { useState } from 'react'

const DATA_TYPE_LABELS: Record<string, string> = {
  AUDIT_LOG: '審計日誌',
  DATA_CHANGE_HISTORY: '數據變更歷史',
  DOCUMENT: '文件',
  EXTRACTION_RESULT: '提取結果',
  PROCESSING_RECORD: '處理記錄',
  USER_SESSION: '用戶會話',
  API_USAGE_LOG: 'API 使用日誌',
  SYSTEM_LOG: '系統日誌'
}

export function RetentionPolicyList() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})

  const { data: policies, isLoading } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: async () => {
      const response = await fetch('/api/admin/retention/policies')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (policy: any) => {
      const response = await fetch('/api/admin/retention/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      })
      if (!response.ok) throw new Error('Failed to save')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
      setEditingId(null)
    }
  })

  const handleEdit = (policy: any) => {
    setEditingId(policy.id)
    setEditValues({
      hotStorageDays: policy.hotStorageDays,
      warmStorageDays: policy.warmStorageDays,
      coldStorageDays: policy.coldStorageDays,
      deletionProtection: policy.deletionProtection
    })
  }

  const handleSave = (policy: any) => {
    saveMutation.mutate({
      ...policy,
      ...editValues
    })
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">載入中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">保留政策配置</h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>數據類型</TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                熱儲存（天）
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Database className="h-4 w-4" />
                溫儲存（天）
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Database className="h-4 w-4 text-blue-500" />
                冷儲存（天）
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Shield className="h-4 w-4" />
                刪除保護
              </div>
            </TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies?.map((policy: any) => {
            const isEditing = editingId === policy.id

            return (
              <TableRow key={policy.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {DATA_TYPE_LABELS[policy.dataType] || policy.dataType}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {policy.policyName}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      className="w-20 mx-auto"
                      value={editValues.hotStorageDays}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        hotStorageDays: parseInt(e.target.value)
                      })}
                    />
                  ) : (
                    <Badge variant="outline">{policy.hotStorageDays}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      className="w-20 mx-auto"
                      value={editValues.warmStorageDays}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        warmStorageDays: parseInt(e.target.value)
                      })}
                    />
                  ) : (
                    <Badge variant="outline">{policy.warmStorageDays}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      className="w-20 mx-auto"
                      value={editValues.coldStorageDays}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        coldStorageDays: parseInt(e.target.value)
                      })}
                    />
                  ) : (
                    <Badge variant="secondary">
                      {policy.coldStorageDays} (~{Math.round(policy.coldStorageDays / 365)} 年)
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <Switch
                      checked={editValues.deletionProtection}
                      onCheckedChange={(checked) => setEditValues({
                        ...editValues,
                        deletionProtection: checked
                      })}
                    />
                  ) : (
                    <Badge variant={policy.deletionProtection ? 'default' : 'outline'}>
                      {policy.deletionProtection ? '啟用' : '停用'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Button
                      size="sm"
                      onClick={() => handleSave(policy)}
                      disabled={saveMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      儲存
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(policy)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">保留政策說明</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>熱儲存：即時存取，成本最高</li>
          <li>溫儲存：快速存取（毫秒級），成本中等</li>
          <li>冷儲存：延遲存取（可能需要數小時還原），成本最低</li>
          <li>啟用刪除保護後，數據在保留期限內無法被刪除</li>
        </ul>
      </div>
    </div>
  )
}
```

```typescript
// components/admin/ArchiveRecordList.tsx
'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Archive, RotateCcw, HardDrive, Loader2 } from 'lucide-react'
import { useState } from 'react'

const TIER_STYLES: Record<string, { label: string; variant: any; icon: string }> = {
  HOT: { label: '熱儲存', variant: 'destructive', icon: '🔥' },
  COOL: { label: '溫儲存', variant: 'default', icon: '💧' },
  COLD: { label: '冷儲存', variant: 'secondary', icon: '❄️' },
  ARCHIVE: { label: '歸檔', variant: 'outline', icon: '📦' }
}

const STATUS_STYLES: Record<string, { label: string; variant: any }> = {
  COMPLETED: { label: '已完成', variant: 'success' },
  RESTORING: { label: '還原中', variant: 'default' },
  RESTORED: { label: '已還原', variant: 'success' },
  DELETED: { label: '已刪除', variant: 'outline' }
}

export function ArchiveRecordList() {
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('')
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<any>(null)
  const [restoreReason, setRestoreReason] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['archive-records', dataTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dataTypeFilter) params.set('dataType', dataTypeFilter)

      const response = await fetch(`/api/admin/retention/archives?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }
  })

  const restoreMutation = useMutation({
    mutationFn: async ({ archiveRecordId, reason }: { archiveRecordId: string; reason: string }) => {
      const response = await fetch('/api/admin/retention/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveRecordId, reason })
      })
      if (!response.ok) throw new Error('Failed to restore')
      return response.json()
    },
    onSuccess: (result) => {
      setRestoreDialogOpen(false)
      setRestoreReason('')
      refetch()

      if (result.estimatedTime > 0) {
        toast.info(`還原請求已提交，預計等待時間：${Math.ceil(result.estimatedTime / 60)} 分鐘`)
      } else {
        toast.success('還原已完成')
      }
    }
  })

  const handleRestoreClick = (archive: any) => {
    setSelectedArchive(archive)
    setRestoreDialogOpen(true)
  }

  const handleRestoreConfirm = () => {
    if (selectedArchive && restoreReason) {
      restoreMutation.mutate({
        archiveRecordId: selectedArchive.id,
        reason: restoreReason
      })
    }
  }

  const formatFileSize = (bytes: bigint | number): string => {
    const size = Number(bytes)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">歸檔記錄</h3>
        <Select value={dataTypeFilter} onValueChange={setDataTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="所有數據類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有類型</SelectItem>
            <SelectItem value="AUDIT_LOG">審計日誌</SelectItem>
            <SelectItem value="DATA_CHANGE_HISTORY">數據變更歷史</SelectItem>
            <SelectItem value="DOCUMENT">文件</SelectItem>
            <SelectItem value="PROCESSING_RECORD">處理記錄</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>批次 ID</TableHead>
            <TableHead>數據類型</TableHead>
            <TableHead>記錄數</TableHead>
            <TableHead>日期範圍</TableHead>
            <TableHead>檔案大小</TableHead>
            <TableHead>儲存層級</TableHead>
            <TableHead>保留至</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items?.map((archive: any) => {
            const tier = TIER_STYLES[archive.storageTier]
            const status = STATUS_STYLES[archive.status]

            return (
              <TableRow key={archive.id}>
                <TableCell className="font-mono text-xs">
                  {archive.archiveBatchId.slice(-12)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{archive.dataType}</Badge>
                </TableCell>
                <TableCell>{archive.recordCount.toLocaleString()}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(archive.dateRangeFrom), 'yyyy/MM/dd')} -
                  {format(new Date(archive.dateRangeTo), 'yyyy/MM/dd')}
                </TableCell>
                <TableCell>{formatFileSize(archive.archiveFileSize)}</TableCell>
                <TableCell>
                  <Badge variant={tier?.variant}>
                    {tier?.icon} {tier?.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(archive.retentionUntil), 'yyyy/MM/dd')}
                </TableCell>
                <TableCell className="text-right">
                  {archive.status === 'COMPLETED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreClick(archive)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      還原
                    </Button>
                  )}
                  {archive.status === 'RESTORING' && (
                    <Badge variant="default">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      還原中
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* 還原對話框 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>還原歸檔數據</DialogTitle>
            <DialogDescription>
              請輸入還原原因，此操作將被記錄在審計日誌中
            </DialogDescription>
          </DialogHeader>

          {selectedArchive && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">數據類型：</span>
                    <span className="ml-2">{selectedArchive.dataType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">記錄數：</span>
                    <span className="ml-2">{selectedArchive.recordCount.toLocaleString()}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">儲存層級：</span>
                    <span className="ml-2">
                      {TIER_STYLES[selectedArchive.storageTier]?.label}
                      {selectedArchive.storageTier === 'ARCHIVE' && (
                        <span className="text-yellow-600 ml-2">
                          （還原可能需要數小時）
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">還原原因</label>
                <Textarea
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="請說明還原此歸檔數據的原因..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleRestoreConfirm}
              disabled={!restoreReason || restoreMutation.isPending}
            >
              {restoreMutation.isPending ? '處理中...' : '確認還原'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

```typescript
// components/admin/StorageMetrics.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { HardDrive, Database, Archive, TrendingDown } from 'lucide-react'

export function StorageMetrics() {
  const { data: metrics } = useQuery({
    queryKey: ['storage-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/retention/metrics')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }
  })

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">熱儲存</CardTitle>
          <HardDrive className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics ? formatSize(metrics.hotStorage) : '-'}
          </div>
          <p className="text-xs text-muted-foreground">
            即時存取
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">溫儲存</CardTitle>
          <Database className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics ? formatSize(metrics.coolStorage) : '-'}
          </div>
          <p className="text-xs text-muted-foreground">
            快速存取
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">冷儲存</CardTitle>
          <Archive className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics ? formatSize(metrics.coldStorage) : '-'}
          </div>
          <p className="text-xs text-muted-foreground">
            延遲存取
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">本月節省</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {metrics ? `$${metrics.monthlySavings.toFixed(2)}` : '-'}
          </div>
          <p className="text-xs text-muted-foreground">
            透過分層儲存
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/data-retention.service.test.ts
import { DataRetentionService } from '@/lib/services/data-retention.service'

describe('DataRetentionService', () => {
  let service: DataRetentionService

  beforeEach(() => {
    service = new DataRetentionService(
      mockPrisma,
      'DefaultEndpointsProtocol=https;...'
    )
  })

  describe('runArchiveJob', () => {
    it('should archive records older than warm storage period', async () => {
      mockPrisma.dataRetentionPolicy.findFirst.mockResolvedValue({
        warmStorageDays: 365,
        coldStorageDays: 2555,
        deletionProtection: true
      })

      mockPrisma.auditLog.findMany.mockResolvedValue([
        { id: '1', timestamp: new Date('2023-01-01'), actionType: 'CREATE' },
        { id: '2', timestamp: new Date('2023-01-02'), actionType: 'UPDATE' }
      ])

      const result = await service.runArchiveJob('AUDIT_LOG')

      expect(result.recordsArchived).toBe(2)
      expect(result.archiveFileUrl).toContain('audit_log')
    })

    it('should return zero records when nothing to archive', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])

      const result = await service.runArchiveJob('AUDIT_LOG')

      expect(result.recordsArchived).toBe(0)
    })
  })

  describe('createDeletionRequest', () => {
    it('should reject deletion within retention period', async () => {
      mockPrisma.dataRetentionPolicy.findFirst.mockResolvedValue({
        coldStorageDays: 2555 // 7 年
      })

      await expect(
        service.createDeletionRequest(
          'AUDIT_LOG',
          { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
          'Cleanup',
          'user-1'
        )
      ).rejects.toThrow('Data within retention period cannot be deleted')
    })

    it('should allow deletion after retention period', async () => {
      mockPrisma.dataRetentionPolicy.findFirst.mockResolvedValue({
        coldStorageDays: 2555
      })

      // 設定超過保留期限的日期
      const dateRange = {
        from: new Date('2015-01-01'),
        to: new Date('2016-12-31')
      }

      mockPrisma.dataArchiveRecord.aggregate.mockResolvedValue({
        _sum: { recordCount: 1000 }
      })

      mockPrisma.dataDeletionRequest.create.mockResolvedValue({
        id: 'request-1',
        estimatedRecords: 1000
      })

      const result = await service.createDeletionRequest(
        'AUDIT_LOG',
        dateRange,
        'Compliance cleanup',
        'admin-1'
      )

      expect(result.estimatedRecords).toBe(1000)
    })
  })

  describe('restoreFromArchive', () => {
    it('should immediately restore from COOL tier', async () => {
      mockPrisma.dataArchiveRecord.findUniqueOrThrow.mockResolvedValue({
        id: 'archive-1',
        storageTier: 'COOL',
        archiveFileUrl: 'https://storage.blob.core.windows.net/...'
      })

      const result = await service.restoreFromArchive(
        'archive-1',
        'user-1',
        'Audit review'
      )

      expect(result.estimatedTime).toBe(0)
      expect(result.status).toBe('RESTORING')
    })

    it('should queue restore for ARCHIVE tier with estimated time', async () => {
      mockPrisma.dataArchiveRecord.findUniqueOrThrow.mockResolvedValue({
        id: 'archive-1',
        storageTier: 'ARCHIVE'
      })

      const result = await service.restoreFromArchive(
        'archive-1',
        'user-1',
        'Historical audit'
      )

      expect(result.estimatedTime).toBeGreaterThan(0)
      expect(result.status).toBe('PENDING')
    })
  })
})
```

### 整合測試

```typescript
// __tests__/api/retention.test.ts
describe('POST /api/admin/retention/deletion', () => {
  it('should create deletion request for admin users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' }
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        dataType: 'AUDIT_LOG',
        dateRange: {
          from: '2015-01-01',
          to: '2016-12-31'
        },
        reason: 'Annual cleanup per policy'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
  })

  it('should reject non-admin users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'USER' }
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { /* ... */ }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(403)
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 8-1**: 用戶操作日誌記錄（AuditLog 歸檔來源）
- **Story 8-2**: 數據變更追蹤（DataChangeHistory 歸檔來源）
- **Story 8-4**: 原始文件追溯（Document 歸檔管理）

### 後續 Stories
- 無直接後續 Stories（Epic 8 最後一個 Story）

### 外部相依
- Azure Blob Storage（分層儲存）
- Azure Blob Lifecycle Management（自動分層）
- Node.js zlib（壓縮/解壓縮）

---

## 備註

### 合規要求
1. 7 年數據保留符合大多數審計和法規要求
2. 刪除保護確保數據不被意外刪除
3. 刪除需要審批流程確保合規
4. 所有操作都有完整審計追蹤

### 成本優化
1. 分層儲存大幅降低長期儲存成本
2. 熱 → 溫 → 冷自動轉換減少人工管理
3. 壓縮歸檔檔案減少儲存空間
4. 儀表板提供成本可見性

### 效能考量
1. 批次處理歸檔操作減少系統負擔
2. 延遲還原設計適應冷儲存特性
3. 分批讀取大量記錄避免記憶體溢出
4. 非同步還原不阻塞用戶操作
