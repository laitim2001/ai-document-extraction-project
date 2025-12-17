# Tech Spec: Story 8-6 長期數據保留

## Story 資訊
| 屬性 | 值 |
|------|-----|
| Epic | Epic 8: 審計追溯與合規 |
| Story ID | 8.6 |
| 標題 | 長期數據保留 |
| FR 覆蓋 | FR53 |
| 估計點數 | 8 |

---

## 概述

實作數據保留管理系統，支援 7 年合規保留要求、自動分層儲存歸檔、歸檔數據還原、及需審批的刪除流程。

### 核心功能
- 數據保留政策配置（熱/溫/冷儲存期限）
- 自動歸檔至 Azure Blob 冷儲存
- 歸檔數據查詢與還原（支援延遲載入）
- 刪除請求審批流程

---

## 資料模型

### Prisma Schema

```prisma
// 數據保留政策
model DataRetentionPolicy {
  id                String    @id @default(cuid())
  policyName        String    @unique
  description       String?
  dataType          DataType

  // 保留期限（天數）
  hotStorageDays    Int       @default(90)    // 熱儲存
  warmStorageDays   Int       @default(365)   // 溫儲存
  coldStorageDays   Int       @default(2555)  // 冷儲存 (7年)

  // 保護設定
  deletionProtection Boolean  @default(true)
  requireApproval    Boolean  @default(true)
  minApprovalLevel   String   @default("ADMIN")

  // 排程
  archiveSchedule   String?   // Cron 表達式
  lastArchiveAt     DateTime?
  nextArchiveAt     DateTime?
  isActive          Boolean   @default(true)

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       String
  createdBy         User      @relation(fields: [createdById], references: [id])

  @@index([dataType])
  @@index([isActive])
}

// 數據類型
enum DataType {
  AUDIT_LOG
  DATA_CHANGE_HISTORY
  DOCUMENT
  EXTRACTION_RESULT
  PROCESSING_RECORD
  USER_SESSION
  API_USAGE_LOG
  SYSTEM_LOG
}

// 歸檔記錄
model DataArchiveRecord {
  id                String        @id @default(cuid())
  archiveBatchId    String
  dataType          DataType
  sourceTable       String
  recordCount       Int
  dateRangeFrom     DateTime
  dateRangeTo       DateTime

  // 檔案資訊
  archiveFileUrl    String
  archiveFileSize   BigInt
  compressionType   String        @default("gzip")
  checksum          String        // SHA-256

  // 儲存層級
  storageTier       StorageTier   @default(COOL)
  status            ArchiveStatus @default(COMPLETED)

  // 保留資訊
  retentionUntil    DateTime
  deletionProtected Boolean       @default(true)

  // 還原統計
  lastRestoredAt    DateTime?
  restoreCount      Int           @default(0)

  createdAt         DateTime      @default(now())
  archivedById      String?
  archivedBy        User?         @relation(fields: [archivedById], references: [id])

  restoreRequests   DataRestoreRequest[]

  @@index([archiveBatchId])
  @@index([dataType])
  @@index([storageTier])
  @@index([retentionUntil])
}

enum StorageTier {
  HOT       // 即時存取
  COOL      // 快速存取
  COLD      // 延遲存取
  ARCHIVE   // 需要還原 (最長12小時)
}

enum ArchiveStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  RESTORING
  RESTORED
  DELETED
}

// 刪除請求
model DataDeletionRequest {
  id                String                @id @default(cuid())
  dataType          DataType
  dateRangeFrom     DateTime
  dateRangeTo       DateTime
  estimatedRecords  Int
  reason            String

  status            DeletionRequestStatus @default(PENDING)

  // 請求者
  requestedById     String
  requestedBy       User                  @relation("DeletionRequester", fields: [requestedById], references: [id])
  requestedAt       DateTime              @default(now())

  // 審批
  approvedById      String?
  approvedBy        User?                 @relation("DeletionApprover", fields: [approvedById], references: [id])
  approvedAt        DateTime?
  approvalComments  String?

  // 執行
  executedAt        DateTime?
  deletedRecords    Int?
  executionLog      Json?

  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  @@index([status])
  @@index([dataType])
}

enum DeletionRequestStatus {
  PENDING
  APPROVED
  REJECTED
  EXECUTING
  COMPLETED
  FAILED
  CANCELLED
}

// 還原請求
model DataRestoreRequest {
  id                String               @id @default(cuid())
  archiveRecordId   String
  archiveRecord     DataArchiveRecord    @relation(fields: [archiveRecordId], references: [id])
  reason            String

  status            RestoreRequestStatus @default(PENDING)
  estimatedTime     Int?                 // 秒

  requestedById     String
  requestedBy       User                 @relation(fields: [requestedById], references: [id])
  requestedAt       DateTime             @default(now())

  // 還原結果
  restoredAt        DateTime?
  tempAccessUrl     String?
  accessExpiresAt   DateTime?

  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  @@index([archiveRecordId])
  @@index([status])
}

enum RestoreRequestStatus {
  PENDING
  RESTORING
  COMPLETED
  FAILED
  EXPIRED
}
```

---

## 核心類型

```typescript
// lib/types/retention.ts

// 儲存層級配置
export const STORAGE_TIER_CONFIG = {
  HOT: { accessLatencyMs: 0, costPerGb: 0.0184 },
  COOL: { accessLatencyMs: 0, costPerGb: 0.01 },
  COLD: { accessLatencyMs: 0, costPerGb: 0.0036 },
  ARCHIVE: { accessLatencyMs: 43200000, costPerGb: 0.00099 } // 12小時
} as const

// 預設保留天數
export const DEFAULT_RETENTION_DAYS: Record<DataType, RetentionDays> = {
  AUDIT_LOG: { hot: 90, warm: 365, cold: 2555 },           // 7年
  DATA_CHANGE_HISTORY: { hot: 90, warm: 365, cold: 2555 }, // 7年
  DOCUMENT: { hot: 30, warm: 180, cold: 2555 },            // 7年
  EXTRACTION_RESULT: { hot: 90, warm: 365, cold: 2555 },   // 7年
  PROCESSING_RECORD: { hot: 90, warm: 365, cold: 2555 },   // 7年
  USER_SESSION: { hot: 30, warm: 90, cold: 365 },          // 1年
  API_USAGE_LOG: { hot: 30, warm: 180, cold: 1095 },       // 3年
  SYSTEM_LOG: { hot: 30, warm: 90, cold: 365 }             // 1年
}

export interface RetentionDays {
  hot: number
  warm: number
  cold: number
}

export interface ArchiveJobResult {
  batchId: string
  recordsArchived: number
  archiveFileUrl: string
}

export interface RestoreResult {
  requestId: string
  estimatedTime: number // 秒
  status: RestoreRequestStatus
}

export interface StorageMetrics {
  hotStorage: number    // bytes
  coolStorage: number
  coldStorage: number
  archiveStorage: number
  monthlySavings: number // USD
}
```

---

## 服務層

### DataRetentionService

```typescript
// lib/services/data-retention.service.ts
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob'
import { createGzip, createGunzip } from 'zlib'
import { createHash } from 'crypto'

export class DataRetentionService {
  private blobServiceClient: BlobServiceClient
  private containerClient: ContainerClient

  constructor(
    private prisma: PrismaClient,
    connectionString: string
  ) {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = this.blobServiceClient.getContainerClient('data-archive')
  }

  // 執行歸檔任務
  async runArchiveJob(dataType: DataType): Promise<ArchiveJobResult> {
    const policy = await this.getRetentionPolicy(dataType)
    const batchId = `archive-${dataType}-${Date.now()}`

    const archiveCutoffDate = new Date()
    archiveCutoffDate.setDate(archiveCutoffDate.getDate() - policy.warmStorageDays)

    const records = await this.fetchRecordsToArchive(dataType, archiveCutoffDate)

    if (records.length === 0) {
      return { batchId, recordsArchived: 0, archiveFileUrl: '' }
    }

    const { archiveUrl, checksum, fileSize, dateRange } =
      await this.compressAndUpload(batchId, dataType, records)

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

    await this.markRecordsAsArchived(dataType, records)

    return { batchId, recordsArchived: records.length, archiveFileUrl: archiveUrl }
  }

  // 從歸檔還原
  async restoreFromArchive(
    archiveRecordId: string,
    requestedById: string,
    reason: string
  ): Promise<RestoreResult> {
    const archiveRecord = await this.prisma.dataArchiveRecord.findUniqueOrThrow({
      where: { id: archiveRecordId }
    })

    const tierConfig = STORAGE_TIER_CONFIG[archiveRecord.storageTier]
    const estimatedTime = Math.ceil(tierConfig.accessLatencyMs / 1000)

    const request = await this.prisma.dataRestoreRequest.create({
      data: {
        archiveRecordId,
        reason,
        requestedById,
        estimatedTime,
        status: archiveRecord.storageTier === 'ARCHIVE' ? 'PENDING' : 'RESTORING'
      }
    })

    if (archiveRecord.storageTier === 'ARCHIVE') {
      await this.initiateRehydration(archiveRecord.archiveFileUrl)
    } else {
      await this.processRestore(request.id)
    }

    return { requestId: request.id, estimatedTime, status: request.status }
  }

  // 建立刪除請求
  async createDeletionRequest(
    dataType: DataType,
    dateRange: { from: Date; to: Date },
    reason: string,
    requestedById: string
  ): Promise<DataDeletionRequest> {
    const policy = await this.getRetentionPolicy(dataType)

    const minRetentionDate = new Date()
    minRetentionDate.setDate(minRetentionDate.getDate() - policy.coldStorageDays)

    if (dateRange.to > minRetentionDate) {
      throw new Error(
        `Data within retention period cannot be deleted. ` +
        `Retention requires ${policy.coldStorageDays} days.`
      )
    }

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

  // 執行刪除
  async executeDeletion(requestId: string): Promise<{ deletedRecords: number }> {
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
        await this.deleteBlobFile(archive.archiveFileUrl)
        deletedRecords += archive.recordCount

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
          executionLog: { archiveRecordsDeleted: archiveRecords.length }
        }
      })

      return { deletedRecords }
    } catch (error) {
      await this.prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'FAILED',
          executionLog: { error: error instanceof Error ? error.message : 'Unknown' }
        }
      })
      throw error
    }
  }

  // 取得儲存統計
  async getStorageMetrics(): Promise<StorageMetrics> {
    const tierSums = await this.prisma.dataArchiveRecord.groupBy({
      by: ['storageTier'],
      where: { status: { not: 'DELETED' } },
      _sum: { archiveFileSize: true }
    })

    const metrics: StorageMetrics = {
      hotStorage: 0,
      coolStorage: 0,
      coldStorage: 0,
      archiveStorage: 0,
      monthlySavings: 0
    }

    let totalIfHot = 0
    let actualCost = 0

    for (const tier of tierSums) {
      const size = Number(tier._sum.archiveFileSize || 0)
      const sizeGb = size / (1024 * 1024 * 1024)
      const tierKey = tier.storageTier.toLowerCase() + 'Storage'

      if (tierKey in metrics) {
        (metrics as any)[tierKey] = size
      }

      totalIfHot += sizeGb * STORAGE_TIER_CONFIG.HOT.costPerGb
      actualCost += sizeGb * STORAGE_TIER_CONFIG[tier.storageTier].costPerGb
    }

    metrics.monthlySavings = totalIfHot - actualCost

    return metrics
  }

  // 私有方法
  private async compressAndUpload(
    batchId: string,
    dataType: DataType,
    records: any[]
  ): Promise<{ archiveUrl: string; checksum: string; fileSize: number; dateRange: { from: Date; to: Date } }> {
    const jsonData = JSON.stringify(records)
    const buffer = Buffer.from(jsonData, 'utf-8')

    const compressedBuffer = await this.compress(buffer)
    const checksum = createHash('sha256').update(compressedBuffer).digest('hex')

    const timestamps = records.map(r =>
      new Date(r.timestamp || r.createdAt || r.processedAt)
    ).sort((a, b) => a.getTime() - b.getTime())

    const dateRange = { from: timestamps[0], to: timestamps[timestamps.length - 1] }

    const blobName = `${dataType.toLowerCase()}/${dateRange.from.getFullYear()}/${batchId}.json.gz`
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.upload(compressedBuffer, compressedBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'application/gzip' },
      metadata: { dataType, batchId, checksum },
      tier: 'Cool'
    })

    return { archiveUrl: blockBlobClient.url, checksum, fileSize: compressedBuffer.length, dateRange }
  }

  private async compress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip({ level: 9 })
      const chunks: Buffer[] = []
      gzip.on('data', chunk => chunks.push(chunk))
      gzip.on('end', () => resolve(Buffer.concat(chunks)))
      gzip.on('error', reject)
      gzip.write(buffer)
      gzip.end()
    })
  }

  private async initiateRehydration(archiveFileUrl: string): Promise<void> {
    const blobName = new URL(archiveFileUrl).pathname.split('/').slice(2).join('/')
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    await blockBlobClient.setAccessTier('Cool', { rehydratePriority: 'Standard' })
  }

  private getSourceTable(dataType: DataType): string {
    const map: Record<DataType, string> = {
      AUDIT_LOG: 'AuditLog',
      DATA_CHANGE_HISTORY: 'DataChangeHistory',
      DOCUMENT: 'Document',
      EXTRACTION_RESULT: 'ExtractionResult',
      PROCESSING_RECORD: 'ProcessingRecord',
      USER_SESSION: 'UserSession',
      API_USAGE_LOG: 'ApiUsageLog',
      SYSTEM_LOG: 'SystemLog'
    }
    return map[dataType]
  }

  private hasApprovalAuthority(userRole: string, requiredLevel: string): boolean {
    const hierarchy = ['USER', 'CITY_MANAGER', 'REGIONAL_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredLevel)
  }
}
```

---

## API 路由

### 保留政策 API

```typescript
// app/api/admin/retention/policies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

// GET - 取得政策列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const policies = await prisma.dataRetentionPolicy.findMany({
    orderBy: { dataType: 'asc' }
  })

  return NextResponse.json(policies)
}

// POST - 更新政策
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const policy = await prisma.dataRetentionPolicy.upsert({
    where: { policyName: body.policyName },
    update: {
      hotStorageDays: body.hotStorageDays,
      warmStorageDays: body.warmStorageDays,
      coldStorageDays: body.coldStorageDays,
      deletionProtection: body.deletionProtection
    },
    create: {
      ...body,
      createdById: session.user.id
    }
  })

  return NextResponse.json(policy)
}
```

### 歸檔 API

```typescript
// app/api/admin/retention/archives/route.ts

// GET - 取得歸檔列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['ADMIN', 'AUDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dataType = searchParams.get('dataType')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where: Prisma.DataArchiveRecordWhereInput = {}
  if (dataType) where.dataType = dataType as DataType

  const [items, total] = await Promise.all([
    prisma.dataArchiveRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.dataArchiveRecord.count({ where })
  ])

  return NextResponse.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  })
}

// POST - 手動執行歸檔
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { dataType } = await request.json()
  const service = new DataRetentionService(prisma, process.env.AZURE_STORAGE_CONNECTION_STRING!)
  const result = await service.runArchiveJob(dataType)

  return NextResponse.json(result)
}
```

### 還原 API

```typescript
// app/api/admin/retention/restore/route.ts

// POST - 建立還原請求
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['ADMIN', 'AUDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { archiveRecordId, reason } = await request.json()
  const service = new DataRetentionService(prisma, process.env.AZURE_STORAGE_CONNECTION_STRING!)

  const result = await service.restoreFromArchive(
    archiveRecordId,
    session.user.id,
    reason
  )

  return NextResponse.json(result)
}
```

### 刪除請求 API

```typescript
// app/api/admin/retention/deletion/route.ts

// GET - 取得刪除請求列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await prisma.dataDeletionRequest.findMany({
    include: {
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(requests)
}

// POST - 建立刪除請求
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { dataType, dateRange, reason } = await request.json()
  const service = new DataRetentionService(prisma, process.env.AZURE_STORAGE_CONNECTION_STRING!)

  const result = await service.createDeletionRequest(
    dataType,
    { from: new Date(dateRange.from), to: new Date(dateRange.to) },
    reason,
    session.user.id
  )

  return NextResponse.json(result)
}
```

```typescript
// app/api/admin/retention/deletion/[requestId]/approve/route.ts

// POST - 審批刪除請求
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { comments } = await request.json()
  const service = new DataRetentionService(prisma, process.env.AZURE_STORAGE_CONNECTION_STRING!)

  await service.approveDeletionRequest(params.requestId, session.user.id, comments)

  return NextResponse.json({ success: true })
}
```

### 儲存統計 API

```typescript
// app/api/admin/retention/metrics/route.ts

// GET - 取得儲存統計
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = new DataRetentionService(prisma, process.env.AZURE_STORAGE_CONNECTION_STRING!)
  const metrics = await service.getStorageMetrics()

  return NextResponse.json(metrics)
}
```

---

## UI 元件

### DataRetentionDashboard

```typescript
// components/admin/DataRetentionDashboard.tsx
'use client'

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
        <p className="text-muted-foreground">管理保留政策、歸檔記錄和刪除請求</p>
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

### StorageMetrics

```typescript
// components/admin/StorageMetrics.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Database, Archive, TrendingDown } from 'lucide-react'

export function StorageMetrics() {
  const { data: metrics } = useQuery({
    queryKey: ['storage-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/retention/metrics')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
          <p className="text-xs text-muted-foreground">即時存取</p>
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
          <p className="text-xs text-muted-foreground">快速存取</p>
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
          <p className="text-xs text-muted-foreground">延遲存取</p>
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
          <p className="text-xs text-muted-foreground">透過分層儲存</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### RetentionPolicyList

```typescript
// components/admin/RetentionPolicyList.tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Edit2, Save } from 'lucide-react'
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
      const res = await fetch('/api/admin/retention/policies')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (policy: any) => {
      const res = await fetch('/api/admin/retention/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
      setEditingId(null)
    }
  })

  if (isLoading) return <div className="flex justify-center p-8">載入中...</div>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>數據類型</TableHead>
          <TableHead className="text-center">熱儲存（天）</TableHead>
          <TableHead className="text-center">溫儲存（天）</TableHead>
          <TableHead className="text-center">冷儲存（天）</TableHead>
          <TableHead className="text-center">刪除保護</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies?.map((policy: any) => {
          const isEditing = editingId === policy.id
          return (
            <TableRow key={policy.id}>
              <TableCell>
                <div className="font-medium">
                  {DATA_TYPE_LABELS[policy.dataType] || policy.dataType}
                </div>
              </TableCell>
              <TableCell className="text-center">
                {isEditing ? (
                  <Input
                    type="number"
                    className="w-20 mx-auto"
                    value={editValues.hotStorageDays}
                    onChange={e => setEditValues({...editValues, hotStorageDays: +e.target.value})}
                  />
                ) : <Badge variant="outline">{policy.hotStorageDays}</Badge>}
              </TableCell>
              <TableCell className="text-center">
                {isEditing ? (
                  <Input
                    type="number"
                    className="w-20 mx-auto"
                    value={editValues.warmStorageDays}
                    onChange={e => setEditValues({...editValues, warmStorageDays: +e.target.value})}
                  />
                ) : <Badge variant="outline">{policy.warmStorageDays}</Badge>}
              </TableCell>
              <TableCell className="text-center">
                {isEditing ? (
                  <Input
                    type="number"
                    className="w-20 mx-auto"
                    value={editValues.coldStorageDays}
                    onChange={e => setEditValues({...editValues, coldStorageDays: +e.target.value})}
                  />
                ) : (
                  <Badge variant="secondary">
                    {policy.coldStorageDays} (~{Math.round(policy.coldStorageDays / 365)}年)
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-center">
                {isEditing ? (
                  <Switch
                    checked={editValues.deletionProtection}
                    onCheckedChange={checked => setEditValues({...editValues, deletionProtection: checked})}
                  />
                ) : (
                  <Badge variant={policy.deletionProtection ? 'default' : 'outline'}>
                    {policy.deletionProtection ? '啟用' : '停用'}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {isEditing ? (
                  <Button size="sm" onClick={() => saveMutation.mutate({...policy, ...editValues})}>
                    <Save className="h-4 w-4 mr-1" />儲存
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditingId(policy.id)
                    setEditValues({
                      hotStorageDays: policy.hotStorageDays,
                      warmStorageDays: policy.warmStorageDays,
                      coldStorageDays: policy.coldStorageDays,
                      deletionProtection: policy.deletionProtection
                    })
                  }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/data-retention.service.test.ts
describe('DataRetentionService', () => {
  describe('runArchiveJob', () => {
    it('should archive records older than warm storage period', async () => {
      mockPrisma.dataRetentionPolicy.findFirst.mockResolvedValue({
        warmStorageDays: 365,
        coldStorageDays: 2555,
        deletionProtection: true
      })
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { id: '1', timestamp: new Date('2023-01-01') },
        { id: '2', timestamp: new Date('2023-01-02') }
      ])

      const result = await service.runArchiveJob('AUDIT_LOG')

      expect(result.recordsArchived).toBe(2)
      expect(result.archiveFileUrl).toContain('audit_log')
    })

    it('should return zero when nothing to archive', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      const result = await service.runArchiveJob('AUDIT_LOG')
      expect(result.recordsArchived).toBe(0)
    })
  })

  describe('createDeletionRequest', () => {
    it('should reject deletion within retention period', async () => {
      mockPrisma.dataRetentionPolicy.findFirst.mockResolvedValue({
        coldStorageDays: 2555
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
      mockPrisma.dataRetentionPolicy.findFirst.mockResolvedValue({ coldStorageDays: 2555 })
      mockPrisma.dataArchiveRecord.aggregate.mockResolvedValue({ _sum: { recordCount: 1000 } })
      mockPrisma.dataDeletionRequest.create.mockResolvedValue({ id: 'req-1', estimatedRecords: 1000 })

      const result = await service.createDeletionRequest(
        'AUDIT_LOG',
        { from: new Date('2015-01-01'), to: new Date('2016-12-31') },
        'Compliance cleanup',
        'admin-1'
      )

      expect(result.estimatedRecords).toBe(1000)
    })
  })

  describe('restoreFromArchive', () => {
    it('should immediately restore from COOL tier', async () => {
      mockPrisma.dataArchiveRecord.findUniqueOrThrow.mockResolvedValue({
        storageTier: 'COOL'
      })

      const result = await service.restoreFromArchive('archive-1', 'user-1', 'Audit')
      expect(result.estimatedTime).toBe(0)
      expect(result.status).toBe('RESTORING')
    })

    it('should queue restore for ARCHIVE tier', async () => {
      mockPrisma.dataArchiveRecord.findUniqueOrThrow.mockResolvedValue({
        storageTier: 'ARCHIVE'
      })

      const result = await service.restoreFromArchive('archive-1', 'user-1', 'Historical')
      expect(result.estimatedTime).toBeGreaterThan(0)
      expect(result.status).toBe('PENDING')
    })
  })
})
```

### 整合測試

```typescript
// __tests__/api/retention.test.ts
describe('Retention API', () => {
  describe('POST /api/admin/retention/deletion', () => {
    it('should create deletion request for admin', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          dataType: 'AUDIT_LOG',
          dateRange: { from: '2015-01-01', to: '2016-12-31' },
          reason: 'Annual cleanup'
        }
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(200)
    })

    it('should reject non-admin users', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })

      const { req, res } = createMocks({ method: 'POST', body: {} })
      await handler(req, res)
      expect(res._getStatusCode()).toBe(403)
    })
  })
})
```

---

## AC 對應

| AC | 實作項目 |
|----|---------|
| AC1: 數據保留期限保護 | `DataRetentionPolicy.deletionProtection` + `createDeletionRequest` 保留期限檢查 |
| AC2: 自動歸檔至冷儲存 | `runArchiveJob` + Azure Blob Lifecycle Policy |
| AC3: 歸檔數據可查詢 | `restoreFromArchive` + 延遲還原支援 (最長30秒 for COOL, 12小時 for ARCHIVE) |
| AC4: 數據保留政策配置 | `DataRetentionPolicy` model + RetentionPolicyList UI |

---

## 相依性

### 前置 Stories
- Story 8-1: 用戶操作日誌記錄（AuditLog 歸檔來源）
- Story 8-2: 數據變更追蹤（DataChangeHistory 歸檔來源）
- Story 8-4: 原始文件追溯（Document 歸檔管理）

### 外部相依
- Azure Blob Storage（分層儲存）
- Azure Blob Lifecycle Management
- Node.js zlib（壓縮/解壓縮）
