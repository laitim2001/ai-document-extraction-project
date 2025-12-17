# Tech Spec: Story 8-2 數據變更追蹤

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 8.2 |
| Epic | Epic 8: 審計追溯與合規 |
| 優先級 | High |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| 依賴 | Story 8.1 (用戶操作日誌記錄) |

## 1. 概述

### 1.1 目標
實現完整的數據變更追蹤系統，記錄所有業務數據的變更歷史，支援版本控制、時間點快照和差異比較。

### 1.2 用戶故事
**As a** 系統
**I want** 記錄所有數據變更（修改人、時間、原因）
**So that** 可以完整追蹤數據的演變歷史

### 1.3 範圍
- 數據變更歷史模型設計
- 版本控制機制
- 變更追蹤服務（自動捕獲）
- Prisma 中間件整合
- 差異比較功能
- 變更歷史 UI 組件

---

## 2. 數據庫設計

### 2.1 DataChangeHistory 模型

```prisma
model DataChangeHistory {
  id            String      @id @default(uuid())

  // 資源識別
  resourceType  String      @map("resource_type")
  resourceId    String      @map("resource_id")

  // 版本控制
  version       Int
  previousId    String?     @map("previous_id")

  // 變更內容
  snapshot      Json        // 完整數據快照
  changes       Json?       // 差異記錄

  // 變更資訊
  changedBy     String      @map("changed_by")
  changedByName String      @map("changed_by_name")
  changeReason  String?     @map("change_reason")
  changeType    ChangeType  @map("change_type")

  // 城市隔離
  cityCode      String?     @map("city_code")

  // 時間戳
  createdAt     DateTime    @default(now()) @map("created_at")

  // 關聯
  changedByUser User        @relation(fields: [changedBy], references: [id])

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

---

## 3. 類型定義

```typescript
// src/types/change-tracking.ts

export interface ChangeHistoryEntry {
  id: string;
  resourceType: string;
  resourceId: string;
  version: number;
  snapshot: Record<string, any>;
  changes?: {
    added: Record<string, any>;
    removed: Record<string, any>;
    updated: Record<string, { old: any; new: any }>;
  };
  changedBy: string;
  changedByName: string;
  changeReason?: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  cityCode?: string;
  createdAt: string;
}

export interface VersionComparison {
  resourceType: string;
  resourceId: string;
  version1: number;
  version2: number;
  differences: DifferenceItem[];
}

export interface DifferenceItem {
  field: string;
  path: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'removed' | 'modified';
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
] as const;

// 排除追蹤的欄位
export const EXCLUDED_FIELDS = ['updatedAt', 'lastAccessedAt', 'version'];
```

---

## 4. 變更追蹤服務

```typescript
// src/services/change-tracking.service.ts

import { prisma } from '@/lib/prisma';
import { ChangeHistoryEntry, VersionComparison, EXCLUDED_FIELDS } from '@/types/change-tracking';

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
    const latestVersion = await this.getLatestVersion(resourceType, resourceId);

    let changes: ChangeHistoryEntry['changes'] | undefined;
    if (latestVersion && changeType !== 'CREATE') {
      changes = this.calculateChanges(
        latestVersion.snapshot as Record<string, any>,
        newData
      );
    }

    const snapshot = this.filterExcludedFields(newData);

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
    });

    return this.toEntry(entry);
  }

  /**
   * 獲取變更歷史
   */
  async getHistory(
    resourceType: string,
    resourceId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ entries: ChangeHistoryEntry[]; total: number }> {
    const where = {
      resourceType,
      resourceId,
      ...(options?.startDate && options?.endDate && {
        createdAt: { gte: options.startDate, lte: options.endDate }
      })
    };

    const [entries, total] = await Promise.all([
      prisma.dataChangeHistory.findMany({
        where,
        orderBy: { version: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0
      }),
      prisma.dataChangeHistory.count({ where })
    ]);

    return { entries: entries.map(e => this.toEntry(e)), total };
  }

  /**
   * 獲取特定版本快照
   */
  async getVersionSnapshot(
    resourceType: string,
    resourceId: string,
    version: number
  ): Promise<Record<string, any> | null> {
    const entry = await prisma.dataChangeHistory.findUnique({
      where: {
        resourceType_resourceId_version: { resourceType, resourceId, version }
      }
    });
    return entry?.snapshot as Record<string, any> | null;
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
    });
    return entry?.snapshot as Record<string, any> | null;
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
    ]);

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both versions not found');
    }

    return {
      resourceType,
      resourceId,
      version1,
      version2,
      differences: this.computeDifferences(snapshot1, snapshot2)
    };
  }

  private async getLatestVersion(resourceType: string, resourceId: string) {
    return prisma.dataChangeHistory.findFirst({
      where: { resourceType, resourceId },
      orderBy: { version: 'desc' }
    });
  }

  private calculateChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>
  ): ChangeHistoryEntry['changes'] {
    const added: Record<string, any> = {};
    const removed: Record<string, any> = {};
    const updated: Record<string, { old: any; new: any }> = {};

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      if (EXCLUDED_FIELDS.includes(key)) continue;

      const oldValue = oldData[key];
      const newValue = newData[key];

      if (oldValue === undefined && newValue !== undefined) {
        added[key] = newValue;
      } else if (oldValue !== undefined && newValue === undefined) {
        removed[key] = oldValue;
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        updated[key] = { old: oldValue, new: newValue };
      }
    }

    return { added, removed, updated };
  }

  private computeDifferences(
    snapshot1: Record<string, any>,
    snapshot2: Record<string, any>,
    path: string = ''
  ): VersionComparison['differences'] {
    const differences: VersionComparison['differences'] = [];
    const allKeys = new Set([...Object.keys(snapshot1), ...Object.keys(snapshot2)]);

    for (const key of allKeys) {
      if (EXCLUDED_FIELDS.includes(key)) continue;

      const currentPath = path ? `${path}.${key}` : key;
      const value1 = snapshot1[key];
      const value2 = snapshot2[key];

      if (value1 === undefined && value2 !== undefined) {
        differences.push({ field: key, path: currentPath, oldValue: undefined, newValue: value2, type: 'added' });
      } else if (value1 !== undefined && value2 === undefined) {
        differences.push({ field: key, path: currentPath, oldValue: value1, newValue: undefined, type: 'removed' });
      } else if (typeof value1 === 'object' && typeof value2 === 'object' &&
                 value1 !== null && value2 !== null &&
                 !Array.isArray(value1) && !Array.isArray(value2)) {
        differences.push(...this.computeDifferences(value1, value2, currentPath));
      } else if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        differences.push({ field: key, path: currentPath, oldValue: value1, newValue: value2, type: 'modified' });
      }
    }

    return differences;
  }

  private filterExcludedFields(data: Record<string, any>): Record<string, any> {
    const filtered = { ...data };
    for (const field of EXCLUDED_FIELDS) {
      delete filtered[field];
    }
    return filtered;
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
    };
  }
}

export const changeTrackingService = new ChangeTrackingService();
```

---

## 5. Prisma 中間件

```typescript
// src/lib/prisma-change-tracking.middleware.ts

import { Prisma } from '@prisma/client';
import { changeTrackingService } from '@/services/change-tracking.service';
import { TRACKED_MODELS } from '@/types/change-tracking';

export const changeTrackingMiddleware: Prisma.Middleware = async (params, next) => {
  if (!params.model || !TRACKED_MODELS.includes(params.model.toLowerCase() as any)) {
    return next(params);
  }

  const resourceType = params.model.toLowerCase();
  const currentUser = (params.args as any).__currentUser as { id: string; name: string } | undefined;

  if (!currentUser) {
    return next(params);
  }

  delete (params.args as any).__currentUser;
  const changeReason = (params.args as any).__changeReason;
  delete (params.args as any).__changeReason;

  let result: any;

  switch (params.action) {
    case 'create':
      result = await next(params);
      await changeTrackingService.recordChange(
        resourceType, result.id, result, currentUser, 'CREATE', changeReason, result.cityCode
      );
      break;

    case 'update':
      result = await next(params);
      await changeTrackingService.recordChange(
        resourceType, result.id, result, currentUser, 'UPDATE', changeReason, result.cityCode
      );
      break;

    case 'delete':
      const toDelete = await (prisma as any)[params.model].findUnique({
        where: params.args.where
      });
      result = await next(params);
      if (toDelete) {
        await changeTrackingService.recordChange(
          resourceType, toDelete.id, toDelete, currentUser, 'DELETE', changeReason, toDelete.cityCode
        );
      }
      break;

    default:
      result = await next(params);
  }

  return result;
};
```

---

## 6. API 端點

### 6.1 變更歷史查詢

```typescript
// src/app/api/history/[resourceType]/[resourceId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { changeTrackingService } from '@/services/change-tracking.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { resourceType: string; resourceId: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { entries, total } = await changeTrackingService.getHistory(
    params.resourceType,
    params.resourceId,
    { limit, offset }
  );

  return NextResponse.json({
    success: true,
    data: { entries, total, page: Math.floor(offset / limit) + 1, pageSize: limit }
  });
}
```

### 6.2 版本比較

```typescript
// src/app/api/history/[resourceType]/[resourceId]/compare/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { changeTrackingService } from '@/services/change-tracking.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { resourceType: string; resourceId: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const version1 = parseInt(searchParams.get('v1') || '0');
  const version2 = parseInt(searchParams.get('v2') || '0');

  if (!version1 || !version2) {
    return NextResponse.json({ success: false, error: 'Both versions required' }, { status: 400 });
  }

  const comparison = await changeTrackingService.compareVersions(
    params.resourceType,
    params.resourceId,
    version1,
    version2
  );

  return NextResponse.json({ success: true, data: comparison });
}
```

---

## 7. UI 組件

### 7.1 變更歷史時間軸

```typescript
// src/components/audit/ChangeHistoryTimeline.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { User, Clock, FileEdit, Plus, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChangeHistoryEntry } from '@/types/change-tracking';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChangeHistoryTimelineProps {
  resourceType: string;
  resourceId: string;
  onVersionClick?: (version: number) => void;
  onCompareClick?: (version1: number, version2: number) => void;
}

const changeTypeConfig = {
  CREATE: { icon: Plus, label: '建立', color: 'bg-green-100 text-green-600' },
  UPDATE: { icon: FileEdit, label: '更新', color: 'bg-blue-100 text-blue-600' },
  DELETE: { icon: Trash2, label: '刪除', color: 'bg-red-100 text-red-600' },
  RESTORE: { icon: RotateCcw, label: '還原', color: 'bg-purple-100 text-purple-600' }
};

export function ChangeHistoryTimeline({
  resourceType,
  resourceId,
  onVersionClick,
  onCompareClick
}: ChangeHistoryTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['change-history', resourceType, resourceId],
    queryFn: async () => {
      const response = await fetch(`/api/history/${resourceType}/${resourceId}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return (await response.json()).data;
    }
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => (
      <div key={i} className="flex gap-4">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
      </div>
    ))}</div>;
  }

  const entries: ChangeHistoryEntry[] = data?.entries || [];

  return (
    <ScrollArea className="h-[400px]">
      <div className="relative pl-8">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
        {entries.map((entry, index) => {
          const config = changeTypeConfig[entry.changeType];
          const Icon = config.icon;

          return (
            <div key={entry.id} className="relative pb-6">
              <div className={cn('absolute left-0 w-6 h-6 rounded-full flex items-center justify-center', config.color)}>
                <Icon className="h-3 w-3" />
              </div>
              <div className="ml-4 bg-card border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">v{entry.version}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{entry.changedByName}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: zhTW })}
                      </span>
                    </div>
                    {entry.changeReason && <p className="mt-2 text-sm text-muted-foreground">原因：{entry.changeReason}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onVersionClick?.(entry.version)}>查看</Button>
                    {index < entries.length - 1 && (
                      <Button variant="ghost" size="sm" onClick={() => onCompareClick?.(entries[index + 1].version, entry.version)}>對比</Button>
                    )}
                  </div>
                </div>
                {entry.changes && (
                  <div className="mt-2 text-xs">
                    {Object.keys(entry.changes.added || {}).length > 0 && <span className="text-green-600 mr-2">+{Object.keys(entry.changes.added).length} 新增</span>}
                    {Object.keys(entry.changes.updated || {}).length > 0 && <span className="text-blue-600 mr-2">~{Object.keys(entry.changes.updated).length} 修改</span>}
                    {Object.keys(entry.changes.removed || {}).length > 0 && <span className="text-red-600">-{Object.keys(entry.changes.removed).length} 刪除</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
```

---

## 8. 測試規格

```typescript
// src/services/__tests__/change-tracking.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeTrackingService } from '../change-tracking.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma');

describe('ChangeTrackingService', () => {
  let service: ChangeTrackingService;

  beforeEach(() => {
    service = new ChangeTrackingService();
    vi.clearAllMocks();
  });

  describe('recordChange', () => {
    it('should create version 1 for new resource', async () => {
      vi.mocked(prisma.dataChangeHistory.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.dataChangeHistory.create).mockResolvedValue({
        id: 'change-1', resourceType: 'document', resourceId: 'doc-1',
        version: 1, snapshot: { title: 'Test' }, changeType: 'CREATE',
        changedBy: 'user-1', changedByName: 'User', createdAt: new Date()
      } as any);

      const result = await service.recordChange(
        'document', 'doc-1', { title: 'Test' },
        { id: 'user-1', name: 'User' }, 'CREATE'
      );

      expect(result.version).toBe(1);
      expect(result.changeType).toBe('CREATE');
    });

    it('should increment version for existing resource', async () => {
      vi.mocked(prisma.dataChangeHistory.findFirst).mockResolvedValue({
        id: 'change-1', version: 2, snapshot: { title: 'Old' }
      } as any);
      vi.mocked(prisma.dataChangeHistory.create).mockResolvedValue({
        id: 'change-2', version: 3, changeType: 'UPDATE'
      } as any);

      const result = await service.recordChange(
        'document', 'doc-1', { title: 'New' },
        { id: 'user-1', name: 'User' }, 'UPDATE'
      );

      expect(result.version).toBe(3);
    });
  });

  describe('compareVersions', () => {
    it('should identify field differences', async () => {
      vi.mocked(prisma.dataChangeHistory.findUnique)
        .mockResolvedValueOnce({ snapshot: { title: 'Old', status: 'draft' } } as any)
        .mockResolvedValueOnce({ snapshot: { title: 'New', status: 'draft' } } as any);

      const result = await service.compareVersions('document', 'doc-1', 1, 2);

      expect(result.differences).toContainEqual(
        expect.objectContaining({ field: 'title', type: 'modified' })
      );
    });
  });
});
```

---

## 9. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 完整變更記錄 | DataChangeHistory 模型 + snapshot/changes JSON |
| AC2 | 變更歷史鏈 | version + previousId 建立版本鏈 |
| AC3 | 時間點快照 | getVersionSnapshot / getSnapshotAtTime |
| AC4 | 差異比較 | compareVersions + computeDifferences 遞迴比較 |

---

## 10. 效能考量

- **快照儲存**: JSON 欄位儲存完整快照，支援任意結構
- **差異計算**: 可選儲存差異減少儲存空間
- **索引策略**: 複合唯一索引 + 時間索引支援高效查詢
- **分區策略**: 大表可按 createdAt 時間分區

---

## 11. 相關文件

- [Story 8-1: 用戶操作日誌記錄](./tech-spec-story-8-1.md)
- [Story 8-3: 處理記錄查詢](./tech-spec-story-8-3.md)
- [Epic 8: 審計追溯與合規](../03-epics/sections/epic-8-audit-trail-compliance.md)
