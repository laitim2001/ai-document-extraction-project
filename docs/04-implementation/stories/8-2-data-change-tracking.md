# Story 8.2: 數據變更追蹤

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 記錄所有數據變更（修改人、時間、原因）,
**So that** 可以完整追蹤數據的演變歷史。

---

## Acceptance Criteria

### AC1: 完整變更記錄

**Given** 業務數據被修改
**When** 如發票提取結果、規則、用戶資料
**Then** 系統記錄：
- 變更前的完整值
- 變更後的完整值
- 變更人 ID
- 變更時間
- 變更原因（如有）

### AC2: 變更歷史鏈

**Given** 數據有多次變更
**When** 查詢變更歷史
**Then** 可以看到完整的變更鏈
**And** 支援時間軸視圖

### AC3: 時間點快照

**Given** 變更記錄
**When** 查詢特定版本
**Then** 可以查看該時間點的數據快照

### AC4: 差異比較

**Given** 變更歷史
**When** 選擇兩個版本進行比較
**Then** 高亮顯示差異欄位
**And** 支援逐欄位對比

---

## Tasks / Subtasks

- [ ] **Task 1: 變更歷史模型設計** (AC: #1)
  - [ ] 1.1 創建 `DataChangeHistory` Prisma 模型
  - [ ] 1.2 設計版本號機制
  - [ ] 1.3 添加 JSON 欄位儲存快照
  - [ ] 1.4 創建 Database Migration

- [ ] **Task 2: 變更追蹤服務** (AC: #1, #2)
  - [ ] 2.1 創建 `ChangeTrackingService`
  - [ ] 2.2 實現自動變更捕獲
  - [ ] 2.3 實現版本號遞增邏輯
  - [ ] 2.4 處理關聯數據變更

- [ ] **Task 3: Prisma 中間件整合** (AC: #1)
  - [ ] 3.1 創建變更追蹤中間件
  - [ ] 3.2 配置追蹤模型列表
  - [ ] 3.3 處理批次操作
  - [ ] 3.4 優化效能

- [ ] **Task 4: 變更歷史查詢 API** (AC: #2, #3)
  - [ ] 4.1 創建 `GET /api/history/:resourceType/:resourceId` 端點
  - [ ] 4.2 支援分頁和排序
  - [ ] 4.3 實現時間點快照查詢
  - [ ] 4.4 支援時間範圍篩選

- [ ] **Task 5: 差異比較功能** (AC: #4)
  - [ ] 5.1 創建差異計算工具
  - [ ] 5.2 實現 JSON 深度比較
  - [ ] 5.3 創建差異比較 API
  - [ ] 5.4 處理陣列和巢狀物件

- [ ] **Task 6: UI 組件** (AC: #2, #3, #4)
  - [ ] 6.1 創建變更歷史時間軸組件
  - [ ] 6.2 創建版本比較對話框
  - [ ] 6.3 創建差異高亮顯示
  - [ ] 6.4 整合到詳情頁面

- [ ] **Task 7: 測試** (AC: #1-4)
  - [ ] 7.1 測試變更記錄完整性
  - [ ] 7.2 測試版本號正確性
  - [ ] 7.3 測試差異計算
  - [ ] 7.4 效能測試

---

## Dev Notes

### 依賴項

- **Story 8.1**: 用戶操作日誌記錄

### Architecture Compliance

```prisma
// prisma/schema.prisma - 數據變更歷史模型
model DataChangeHistory {
  id            String    @id @default(uuid())

  // 資源識別
  resourceType  String    @map("resource_type")  // 'document', 'extractionResult', 'mappingRule', etc.
  resourceId    String    @map("resource_id")

  // 版本控制
  version       Int       // 遞增版本號
  previousId    String?   @map("previous_id")  // 上一版本的 ID

  // 變更內容
  snapshot      Json      // 該版本的完整數據快照
  changes       Json?     // 與上一版本的差異（可選）

  // 變更資訊
  changedBy     String    @map("changed_by")
  changedByName String    @map("changed_by_name")
  changeReason  String?   @map("change_reason")
  changeType    ChangeType @map("change_type")

  // 城市（用於數據隔離）
  cityCode      String?   @map("city_code")

  // 時間戳
  createdAt     DateTime  @default(now()) @map("created_at")

  // 關聯
  changedByUser User      @relation(fields: [changedBy], references: [id])

  @@unique([resourceType, resourceId, version])
  @@index([resourceType, resourceId])
  @@index([changedBy])
  @@index([createdAt])
  @@index([cityCode])
  @@map("data_change_history")
}

enum ChangeType {
  CREATE
  UPDATE
  DELETE
  RESTORE
}
```

```typescript
// src/types/change-tracking.ts
export interface ChangeHistoryEntry {
  id: string
  resourceType: string
  resourceId: string
  version: number
  snapshot: Record<string, any>
  changes?: {
    added: Record<string, any>
    removed: Record<string, any>
    updated: Record<string, { old: any; new: any }>
  }
  changedBy: string
  changedByName: string
  changeReason?: string
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
  cityCode?: string
  createdAt: string
}

export interface VersionComparison {
  resourceType: string
  resourceId: string
  version1: number
  version2: number
  differences: {
    field: string
    path: string
    oldValue: any
    newValue: any
    type: 'added' | 'removed' | 'modified'
  }[]
}

// 需要追蹤變更的模型
export const TRACKED_MODELS = [
  'document',
  'extractionResult',
  'mappingRule',
  'forwarder',
  'user',
  'role',
  'city',
  'systemConfig'
]

// 不需要記錄變更的欄位（如時間戳）
export const EXCLUDED_FIELDS = [
  'updatedAt',
  'lastAccessedAt',
  'version'
]
```

```typescript
// src/services/change-tracking.service.ts
import { prisma } from '@/lib/prisma'
import {
  ChangeHistoryEntry,
  VersionComparison,
  TRACKED_MODELS,
  EXCLUDED_FIELDS
} from '@/types/change-tracking'
import { diff } from 'deep-object-diff'

export class ChangeTrackingService {
  /**
   * 記錄數據變更
   */
  async recordChange(
    resourceType: string,
    resourceId: string,
    newData: Record<string, any>,
    changedBy: { id: string; name: string },
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
    changeReason?: string,
    cityCode?: string
  ): Promise<ChangeHistoryEntry> {
    // 獲取當前最新版本
    const latestVersion = await this.getLatestVersion(resourceType, resourceId)

    // 計算差異（如果有上一版本）
    let changes: ChangeHistoryEntry['changes'] | undefined
    if (latestVersion && changeType !== 'CREATE') {
      changes = this.calculateChanges(latestVersion.snapshot, newData)
    }

    // 過濾排除欄位
    const snapshot = this.filterExcludedFields(newData)

    // 創建新版本
    const entry = await prisma.dataChangeHistory.create({
      data: {
        resourceType,
        resourceId,
        version: (latestVersion?.version || 0) + 1,
        previousId: latestVersion?.id,
        snapshot,
        changes,
        changedBy: changedBy.id,
        changedByName: changedBy.name,
        changeReason,
        changeType,
        cityCode
      }
    })

    return this.toEntry(entry)
  }

  /**
   * 獲取變更歷史
   */
  async getHistory(
    resourceType: string,
    resourceId: string,
    options?: {
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
    }
  ): Promise<{ entries: ChangeHistoryEntry[]; total: number }> {
    const where = {
      resourceType,
      resourceId,
      ...(options?.startDate && options?.endDate && {
        createdAt: {
          gte: options.startDate,
          lte: options.endDate
        }
      })
    }

    const [entries, total] = await Promise.all([
      prisma.dataChangeHistory.findMany({
        where,
        orderBy: { version: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          changedByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.dataChangeHistory.count({ where })
    ])

    return {
      entries: entries.map(e => this.toEntry(e)),
      total
    }
  }

  /**
   * 獲取特定版本的快照
   */
  async getVersionSnapshot(
    resourceType: string,
    resourceId: string,
    version: number
  ): Promise<Record<string, any> | null> {
    const entry = await prisma.dataChangeHistory.findUnique({
      where: {
        resourceType_resourceId_version: {
          resourceType,
          resourceId,
          version
        }
      }
    })

    return entry?.snapshot as Record<string, any> | null
  }

  /**
   * 獲取指定時間點的快照
   */
  async getSnapshotAtTime(
    resourceType: string,
    resourceId: string,
    timestamp: Date
  ): Promise<Record<string, any> | null> {
    const entry = await prisma.dataChangeHistory.findFirst({
      where: {
        resourceType,
        resourceId,
        createdAt: { lte: timestamp }
      },
      orderBy: { version: 'desc' }
    })

    return entry?.snapshot as Record<string, any> | null
  }

  /**
   * 比較兩個版本
   */
  async compareVersions(
    resourceType: string,
    resourceId: string,
    version1: number,
    version2: number
  ): Promise<VersionComparison> {
    const [snapshot1, snapshot2] = await Promise.all([
      this.getVersionSnapshot(resourceType, resourceId, version1),
      this.getVersionSnapshot(resourceType, resourceId, version2)
    ])

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both versions not found')
    }

    const differences = this.computeDifferences(snapshot1, snapshot2)

    return {
      resourceType,
      resourceId,
      version1,
      version2,
      differences
    }
  }

  private async getLatestVersion(
    resourceType: string,
    resourceId: string
  ) {
    return prisma.dataChangeHistory.findFirst({
      where: { resourceType, resourceId },
      orderBy: { version: 'desc' }
    })
  }

  private calculateChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>
  ): ChangeHistoryEntry['changes'] {
    const added: Record<string, any> = {}
    const removed: Record<string, any> = {}
    const updated: Record<string, { old: any; new: any }> = {}

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

    for (const key of allKeys) {
      if (EXCLUDED_FIELDS.includes(key)) continue

      const oldValue = oldData[key]
      const newValue = newData[key]

      if (oldValue === undefined && newValue !== undefined) {
        added[key] = newValue
      } else if (oldValue !== undefined && newValue === undefined) {
        removed[key] = oldValue
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        updated[key] = { old: oldValue, new: newValue }
      }
    }

    return { added, removed, updated }
  }

  private computeDifferences(
    snapshot1: Record<string, any>,
    snapshot2: Record<string, any>,
    path: string = ''
  ): VersionComparison['differences'] {
    const differences: VersionComparison['differences'] = []

    const allKeys = new Set([...Object.keys(snapshot1), ...Object.keys(snapshot2)])

    for (const key of allKeys) {
      if (EXCLUDED_FIELDS.includes(key)) continue

      const currentPath = path ? `${path}.${key}` : key
      const value1 = snapshot1[key]
      const value2 = snapshot2[key]

      if (value1 === undefined && value2 !== undefined) {
        differences.push({
          field: key,
          path: currentPath,
          oldValue: undefined,
          newValue: value2,
          type: 'added'
        })
      } else if (value1 !== undefined && value2 === undefined) {
        differences.push({
          field: key,
          path: currentPath,
          oldValue: value1,
          newValue: undefined,
          type: 'removed'
        })
      } else if (typeof value1 === 'object' && typeof value2 === 'object' &&
                 value1 !== null && value2 !== null &&
                 !Array.isArray(value1) && !Array.isArray(value2)) {
        // 遞迴比較巢狀物件
        differences.push(...this.computeDifferences(value1, value2, currentPath))
      } else if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        differences.push({
          field: key,
          path: currentPath,
          oldValue: value1,
          newValue: value2,
          type: 'modified'
        })
      }
    }

    return differences
  }

  private filterExcludedFields(data: Record<string, any>): Record<string, any> {
    const filtered = { ...data }
    for (const field of EXCLUDED_FIELDS) {
      delete filtered[field]
    }
    return filtered
  }

  private toEntry(record: any): ChangeHistoryEntry {
    return {
      id: record.id,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      version: record.version,
      snapshot: record.snapshot as Record<string, any>,
      changes: record.changes as ChangeHistoryEntry['changes'],
      changedBy: record.changedBy,
      changedByName: record.changedByName,
      changeReason: record.changeReason,
      changeType: record.changeType,
      cityCode: record.cityCode,
      createdAt: record.createdAt.toISOString()
    }
  }
}

export const changeTrackingService = new ChangeTrackingService()
```

```typescript
// src/lib/prisma-change-tracking.middleware.ts
import { Prisma } from '@prisma/client'
import { changeTrackingService } from '@/services/change-tracking.service'
import { TRACKED_MODELS } from '@/types/change-tracking'

// Prisma 中間件：自動追蹤數據變更
export const changeTrackingMiddleware: Prisma.Middleware = async (params, next) => {
  // 檢查是否為追蹤模型
  if (!params.model || !TRACKED_MODELS.includes(params.model.toLowerCase())) {
    return next(params)
  }

  const resourceType = params.model.toLowerCase()

  // 獲取當前用戶（從擴展參數）
  const currentUser = (params.args as any).__currentUser as {
    id: string
    name: string
  } | undefined

  // 如果沒有用戶資訊，跳過追蹤（系統操作）
  if (!currentUser) {
    return next(params)
  }

  // 移除擴展參數
  delete (params.args as any).__currentUser
  const changeReason = (params.args as any).__changeReason
  delete (params.args as any).__changeReason

  let result: any

  switch (params.action) {
    case 'create':
      result = await next(params)
      await changeTrackingService.recordChange(
        resourceType,
        result.id,
        result,
        currentUser,
        'CREATE',
        changeReason,
        result.cityCode
      )
      break

    case 'update':
      result = await next(params)
      await changeTrackingService.recordChange(
        resourceType,
        result.id,
        result,
        currentUser,
        'UPDATE',
        changeReason,
        result.cityCode
      )
      break

    case 'delete':
      // 刪除前獲取數據
      const toDelete = await (prisma as any)[params.model].findUnique({
        where: params.args.where
      })
      result = await next(params)
      if (toDelete) {
        await changeTrackingService.recordChange(
          resourceType,
          toDelete.id,
          toDelete,
          currentUser,
          'DELETE',
          changeReason,
          toDelete.cityCode
        )
      }
      break

    default:
      result = await next(params)
  }

  return result
}
```

```typescript
// src/app/api/history/[resourceType]/[resourceId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { changeTrackingService } from '@/services/change-tracking.service'

export async function GET(
  request: NextRequest,
  { params }: { params: { resourceType: string; resourceId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const { entries, total } = await changeTrackingService.getHistory(
      params.resourceType,
      params.resourceId,
      {
        limit,
        offset,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        entries,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit
      }
    })
  } catch (error) {
    console.error('Change history error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch change history' },
      { status: 500 }
    )
  }
}
```

```typescript
// src/components/audit/ChangeHistoryTimeline.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { User, Clock, FileEdit, Plus, Trash2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChangeHistoryEntry } from '@/types/change-tracking'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChangeHistoryTimelineProps {
  resourceType: string
  resourceId: string
  onVersionClick?: (version: number) => void
  onCompareClick?: (version1: number, version2: number) => void
}

const changeTypeIcons = {
  CREATE: Plus,
  UPDATE: FileEdit,
  DELETE: Trash2,
  RESTORE: RotateCcw
}

const changeTypeLabels = {
  CREATE: '建立',
  UPDATE: '更新',
  DELETE: '刪除',
  RESTORE: '還原'
}

export function ChangeHistoryTimeline({
  resourceType,
  resourceId,
  onVersionClick,
  onCompareClick
}: ChangeHistoryTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['change-history', resourceType, resourceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/history/${resourceType}/${resourceId}`
      )
      if (!response.ok) throw new Error('Failed to fetch history')
      const result = await response.json()
      return result.data
    }
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse flex gap-4">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const entries: ChangeHistoryEntry[] = data?.entries || []

  return (
    <ScrollArea className="h-[400px]">
      <div className="relative pl-8">
        {/* 時間軸線 */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

        {entries.map((entry, index) => {
          const Icon = changeTypeIcons[entry.changeType]
          const label = changeTypeLabels[entry.changeType]

          return (
            <div key={entry.id} className="relative pb-6">
              {/* 時間軸點 */}
              <div className={cn(
                'absolute left-0 w-6 h-6 rounded-full flex items-center justify-center',
                entry.changeType === 'CREATE' && 'bg-green-100 text-green-600',
                entry.changeType === 'UPDATE' && 'bg-blue-100 text-blue-600',
                entry.changeType === 'DELETE' && 'bg-red-100 text-red-600',
                entry.changeType === 'RESTORE' && 'bg-purple-100 text-purple-600'
              )}>
                <Icon className="h-3 w-3" />
              </div>

              {/* 內容 */}
              <div className="ml-4 bg-card border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        v{entry.version}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {entry.changedByName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.createdAt), {
                          addSuffix: true,
                          locale: zhTW
                        })}
                      </span>
                    </div>
                    {entry.changeReason && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        原因：{entry.changeReason}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onVersionClick?.(entry.version)}
                    >
                      查看
                    </Button>
                    {index < entries.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCompareClick?.(
                          entries[index + 1].version,
                          entry.version
                        )}
                      >
                        對比
                      </Button>
                    )}
                  </div>
                </div>

                {/* 變更摘要 */}
                {entry.changes && (
                  <div className="mt-2 text-xs">
                    {Object.keys(entry.changes.added || {}).length > 0 && (
                      <span className="text-green-600 mr-2">
                        +{Object.keys(entry.changes.added).length} 新增
                      </span>
                    )}
                    {Object.keys(entry.changes.updated || {}).length > 0 && (
                      <span className="text-blue-600 mr-2">
                        ~{Object.keys(entry.changes.updated).length} 修改
                      </span>
                    )}
                    {Object.keys(entry.changes.removed || {}).length > 0 && (
                      <span className="text-red-600">
                        -{Object.keys(entry.changes.removed).length} 刪除
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
```

### 效能考量

- **快照儲存**: 使用 JSON 欄位儲存完整快照
- **差異計算**: 可選儲存差異以減少空間
- **索引策略**: 複合索引支援高效查詢
- **分區**: 考慮按時間分區大表

### References

- [Source: docs/03-epics/sections/epic-8-audit-trail-compliance.md#story-82]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR49]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 8.2 |
| Story Key | 8-2-data-change-tracking |
| Epic | Epic 8: 審計追溯與合規 |
| FR Coverage | FR49 |
| Dependencies | Story 8.1 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
