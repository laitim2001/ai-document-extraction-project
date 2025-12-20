/**
 * @fileoverview 數據變更追蹤服務
 * @description
 *   提供數據變更追蹤的核心功能。
 *   負責記錄、查詢和比較資源的版本歷史。
 *
 *   主要功能：
 *   - recordChange: 記錄資源變更並創建版本快照
 *   - getHistory: 獲取資源的變更歷史
 *   - getVersionSnapshot: 獲取特定版本的快照
 *   - getSnapshotAtTime: 獲取特定時間點的資料狀態
 *   - compareVersions: 比較兩個版本之間的差異
 *
 * @module src/services/change-tracking.service
 * @author Development Team
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 版本化資料快照
 *   - 變更差異計算
 *   - 歷史記錄查詢
 *   - 版本比較
 *   - 時間點還原
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/change-tracking - 變更追蹤類型
 *
 * @related
 *   - src/lib/prisma/change-tracking-middleware.ts - Prisma 中間件
 *   - src/app/api/history/[resourceType]/[resourceId]/route.ts - API 端點
 *   - prisma/schema.prisma - DataChangeHistory 模型定義
 */

import { prisma } from '@/lib/prisma';
import { HistoryChangeType, Prisma } from '@prisma/client';
import type {
  TrackedModel,
  DataChangeHistoryEntry,
  VersionSnapshot,
  VersionCompareResult,
  RecordChangeParams,
  GetHistoryParams,
  HistoryQueryResult,
  ChangeDetails,
  TimelineItem,
} from '@/types/change-tracking';
import {
  calculateDiff,
  filterExcludedFields,
  toTimelineItem,
} from '@/types/change-tracking';

// ============================================================
// Change Tracking Service Class
// ============================================================

/**
 * 變更追蹤服務
 *
 * @description
 *   管理資源的版本歷史記錄，提供版本快照、差異計算和歷史查詢功能。
 *
 * @example
 * ```typescript
 * // 記錄變更
 * await changeTrackingService.recordChange({
 *   resourceType: 'user',
 *   resourceId: 'user-123',
 *   changeType: 'UPDATE',
 *   snapshot: { name: 'New Name', email: 'new@email.com' },
 *   beforeData: { name: 'Old Name', email: 'old@email.com' },
 *   changedBy: 'admin-123',
 *   changedByName: 'Admin User',
 * });
 *
 * // 獲取歷史記錄
 * const history = await changeTrackingService.getHistory({
 *   resourceType: 'user',
 *   resourceId: 'user-123',
 *   limit: 20,
 * });
 *
 * // 比較版本
 * const diff = await changeTrackingService.compareVersions(
 *   'user',
 *   'user-123',
 *   1,
 *   3
 * );
 * ```
 */
class ChangeTrackingService {
  // ============================================================
  // Record Changes
  // ============================================================

  /**
   * 記錄資源變更
   *
   * @description
   *   創建新的變更歷史記錄，包含完整快照和變更差異。
   *   自動計算版本號和前一版本的關聯。
   *
   * @param params - 記錄變更的參數
   * @returns 新創建的變更歷史記錄
   *
   * @example
   * ```typescript
   * const entry = await changeTrackingService.recordChange({
   *   resourceType: 'mappingRule',
   *   resourceId: 'rule-123',
   *   changeType: 'UPDATE',
   *   snapshot: { pattern: 'new-pattern', confidence: 0.9 },
   *   beforeData: { pattern: 'old-pattern', confidence: 0.8 },
   *   changedBy: 'user-123',
   *   changedByName: 'John Doe',
   *   changeReason: 'Improved extraction accuracy',
   * });
   * ```
   */
  async recordChange(
    params: RecordChangeParams
  ): Promise<DataChangeHistoryEntry> {
    const {
      resourceType,
      resourceId,
      changeType,
      snapshot,
      beforeData,
      changedBy,
      changedByName,
      changeReason,
      cityCode,
    } = params;

    // 過濾敏感和排除的欄位
    const filteredSnapshot = filterExcludedFields(snapshot);
    const filteredBeforeData = beforeData
      ? filterExcludedFields(beforeData)
      : undefined;

    // 獲取當前最新版本
    const latestVersion = await prisma.dataChangeHistory.findFirst({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        id: true,
        version: true,
      },
    });

    const newVersion = (latestVersion?.version ?? 0) + 1;

    // 計算變更差異
    let changes: ChangeDetails | null = null;
    if (filteredBeforeData && changeType !== 'CREATE') {
      const diffs = calculateDiff(filteredBeforeData, filteredSnapshot);
      changes = {
        before: filteredBeforeData,
        after: filteredSnapshot,
        changedFields: diffs.map((d) => d.field),
      };
    }

    // 創建變更歷史記錄
    const entry = await prisma.dataChangeHistory.create({
      data: {
        resourceType,
        resourceId,
        version: newVersion,
        previousId: latestVersion?.id ?? null,
        snapshot: filteredSnapshot as Prisma.InputJsonValue,
        changes: changes ? (changes as Prisma.InputJsonValue) : Prisma.JsonNull,
        changedBy,
        changedByName,
        changeReason: changeReason ?? null,
        changeType,
        cityCode: cityCode ?? null,
      },
    });

    return this.mapToEntry(entry);
  }

  // ============================================================
  // Query History
  // ============================================================

  /**
   * 獲取資源的變更歷史
   *
   * @description
   *   返回資源的所有變更歷史記錄，按版本號降序排列。
   *
   * @param params - 查詢參數
   * @returns 歷史記錄查詢結果
   */
  async getHistory(params: GetHistoryParams): Promise<HistoryQueryResult> {
    const { resourceType, resourceId, limit = 20, offset = 0 } = params;

    const [entries, total] = await Promise.all([
      prisma.dataChangeHistory.findMany({
        where: {
          resourceType,
          resourceId,
        },
        orderBy: {
          version: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.dataChangeHistory.count({
        where: {
          resourceType,
          resourceId,
        },
      }),
    ]);

    return {
      data: entries.map((entry) => this.mapToEntry(entry)),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total,
      },
    };
  }

  /**
   * 獲取資源的時間線
   *
   * @description
   *   返回適合 UI 展示的時間線項目列表。
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @param limit - 返回數量限制
   * @returns 時間線項目列表
   */
  async getTimeline(
    resourceType: TrackedModel,
    resourceId: string,
    limit: number = 50
  ): Promise<TimelineItem[]> {
    const entries = await prisma.dataChangeHistory.findMany({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: {
        version: 'desc',
      },
      take: limit,
    });

    return entries.map((entry, index) =>
      toTimelineItem(this.mapToEntry(entry), index === 0)
    );
  }

  // ============================================================
  // Version Snapshots
  // ============================================================

  /**
   * 獲取特定版本的快照
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @param version - 版本號
   * @returns 版本快照，如果不存在則返回 null
   */
  async getVersionSnapshot(
    resourceType: TrackedModel,
    resourceId: string,
    version: number
  ): Promise<VersionSnapshot | null> {
    const entry = await prisma.dataChangeHistory.findUnique({
      where: {
        resourceType_resourceId_version: {
          resourceType,
          resourceId,
          version,
        },
      },
    });

    if (!entry) {
      return null;
    }

    return {
      version: entry.version,
      data: entry.snapshot as Record<string, unknown>,
      changeType: entry.changeType,
      changedByName: entry.changedByName,
      changeReason: entry.changeReason,
      timestamp: entry.createdAt,
    };
  }

  /**
   * 獲取最新版本的快照
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @returns 最新版本快照，如果不存在則返回 null
   */
  async getLatestSnapshot(
    resourceType: TrackedModel,
    resourceId: string
  ): Promise<VersionSnapshot | null> {
    const entry = await prisma.dataChangeHistory.findFirst({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!entry) {
      return null;
    }

    return {
      version: entry.version,
      data: entry.snapshot as Record<string, unknown>,
      changeType: entry.changeType,
      changedByName: entry.changedByName,
      changeReason: entry.changeReason,
      timestamp: entry.createdAt,
    };
  }

  /**
   * 獲取特定時間點的資料快照
   *
   * @description
   *   返回在指定時間點之前最近一次變更的快照。
   *   用於查看歷史狀態。
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @param timestamp - 時間點
   * @returns 該時間點的快照，如果不存在則返回 null
   */
  async getSnapshotAtTime(
    resourceType: TrackedModel,
    resourceId: string,
    timestamp: Date
  ): Promise<VersionSnapshot | null> {
    const entry = await prisma.dataChangeHistory.findFirst({
      where: {
        resourceType,
        resourceId,
        createdAt: {
          lte: timestamp,
        },
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!entry) {
      return null;
    }

    return {
      version: entry.version,
      data: entry.snapshot as Record<string, unknown>,
      changeType: entry.changeType,
      changedByName: entry.changedByName,
      changeReason: entry.changeReason,
      timestamp: entry.createdAt,
    };
  }

  // ============================================================
  // Version Comparison
  // ============================================================

  /**
   * 比較兩個版本之間的差異
   *
   * @description
   *   計算兩個版本之間的欄位差異，返回詳細的比較結果。
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @param fromVersion - 起始版本號
   * @param toVersion - 目標版本號
   * @returns 版本比較結果，如果任一版本不存在則返回 null
   *
   * @example
   * ```typescript
   * const result = await changeTrackingService.compareVersions(
   *   'mappingRule',
   *   'rule-123',
   *   1,
   *   3
   * );
   *
   * // result.diffs 包含所有欄位差異
   * result.diffs.forEach(diff => {
   *   console.log(`${diff.field}: ${diff.oldValue} -> ${diff.newValue}`);
   * });
   * ```
   */
  async compareVersions(
    resourceType: TrackedModel,
    resourceId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionCompareResult | null> {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.getVersionSnapshot(resourceType, resourceId, fromVersion),
      this.getVersionSnapshot(resourceType, resourceId, toVersion),
    ]);

    if (!fromSnapshot || !toSnapshot) {
      return null;
    }

    const diffs = calculateDiff(fromSnapshot.data, toSnapshot.data);

    return {
      fromVersion,
      toVersion,
      diffs,
      fromSnapshot,
      toSnapshot,
    };
  }

  /**
   * 獲取版本之間的變更摘要
   *
   * @description
   *   返回從指定版本到最新版本之間的所有變更摘要。
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @param fromVersion - 起始版本號
   * @returns 變更摘要列表
   */
  async getChangesSummary(
    resourceType: TrackedModel,
    resourceId: string,
    fromVersion: number
  ): Promise<{
    totalChanges: number;
    changesByType: Record<HistoryChangeType, number>;
    changedFields: string[];
    latestVersion: number;
  }> {
    const entries = await prisma.dataChangeHistory.findMany({
      where: {
        resourceType,
        resourceId,
        version: {
          gt: fromVersion,
        },
      },
      orderBy: {
        version: 'asc',
      },
    });

    const changesByType: Record<HistoryChangeType, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      RESTORE: 0,
    };

    const changedFieldsSet = new Set<string>();

    for (const entry of entries) {
      changesByType[entry.changeType]++;

      const changes = entry.changes as ChangeDetails | null;
      if (changes?.changedFields) {
        changes.changedFields.forEach((field) => changedFieldsSet.add(field));
      }
    }

    return {
      totalChanges: entries.length,
      changesByType,
      changedFields: Array.from(changedFieldsSet),
      latestVersion: entries.length > 0 ? entries[entries.length - 1].version : fromVersion,
    };
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * 檢查資源是否有變更歷史
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @returns 是否有歷史記錄
   */
  async hasHistory(
    resourceType: TrackedModel,
    resourceId: string
  ): Promise<boolean> {
    const count = await prisma.dataChangeHistory.count({
      where: {
        resourceType,
        resourceId,
      },
    });
    return count > 0;
  }

  /**
   * 獲取資源的當前版本號
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @returns 當前版本號，如果沒有歷史記錄則返回 0
   */
  async getCurrentVersion(
    resourceType: TrackedModel,
    resourceId: string
  ): Promise<number> {
    const latest = await prisma.dataChangeHistory.findFirst({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        version: true,
      },
    });

    return latest?.version ?? 0;
  }

  /**
   * 刪除資源的所有變更歷史
   *
   * @description
   *   當資源被永久刪除時調用。注意：這是不可逆操作。
   *
   * @param resourceType - 資源類型
   * @param resourceId - 資源 ID
   * @returns 刪除的記錄數量
   */
  async deleteHistory(
    resourceType: TrackedModel,
    resourceId: string
  ): Promise<number> {
    const result = await prisma.dataChangeHistory.deleteMany({
      where: {
        resourceType,
        resourceId,
      },
    });

    return result.count;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * 將 Prisma 記錄映射為 DataChangeHistoryEntry
   */
  private mapToEntry(
    record: {
      id: string;
      resourceType: string;
      resourceId: string;
      version: number;
      previousId: string | null;
      snapshot: unknown;
      changes: unknown;
      changedBy: string;
      changedByName: string;
      changeReason: string | null;
      changeType: HistoryChangeType;
      cityCode: string | null;
      createdAt: Date;
    }
  ): DataChangeHistoryEntry {
    return {
      id: record.id,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      version: record.version,
      previousId: record.previousId,
      snapshot: record.snapshot as Record<string, unknown>,
      changes: record.changes as ChangeDetails | null,
      changedBy: record.changedBy,
      changedByName: record.changedByName,
      changeReason: record.changeReason,
      changeType: record.changeType,
      cityCode: record.cityCode,
      createdAt: record.createdAt,
    };
  }
}

// ============================================================
// Export Singleton Instance
// ============================================================

/**
 * 變更追蹤服務單例
 */
export const changeTrackingService = new ChangeTrackingService();

/**
 * 導出類供測試使用
 */
export { ChangeTrackingService };
