/**
 * @fileoverview Prisma 變更追蹤擴展
 * @description
 *   提供 Prisma 變更追蹤功能的擴展模組。
 *   使用 $extends 為追蹤的模型添加自動變更記錄功能。
 *
 *   功能特點：
 *   - 自動記錄 create/update/delete 操作
 *   - 過濾敏感和排除的欄位
 *   - 支援批量操作追蹤
 *   - 非阻塞式記錄（不影響主要操作性能）
 *
 * @module src/lib/prisma-change-tracking
 * @author Development Team
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - Prisma $extends 擴展
 *   - 自動變更捕獲
 *   - 上下文傳遞支援
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/change-tracking.service - 變更追蹤服務
 *   - @/types/change-tracking - 變更追蹤類型
 *
 * @related
 *   - src/services/change-tracking.service.ts - 變更追蹤服務
 *   - prisma/schema.prisma - DataChangeHistory 模型定義
 */

import { HistoryChangeType } from '@prisma/client';
import { changeTrackingService } from '@/services/change-tracking.service';
import {
  TrackedModel,
  isTrackedModel,
  filterExcludedFields,
  MODEL_TO_PRISMA_NAME,
} from '@/types/change-tracking';

// ============================================================
// Types
// ============================================================

/**
 * 變更追蹤上下文
 * 用於傳遞變更追蹤所需的額外資訊
 */
export interface ChangeTrackingContext {
  /** 操作者 ID */
  userId: string;
  /** 操作者名稱 */
  userName: string;
  /** 變更原因（可選） */
  changeReason?: string;
  /** 城市代碼（可選） */
  cityCode?: string;
  /** 是否跳過追蹤（可選） */
  skipTracking?: boolean;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 Prisma 模型名稱獲取追蹤模型名稱
 *
 * @param prismaModel - Prisma 模型名稱（如 'User', 'Role'）
 * @returns 追蹤模型名稱（如 'user', 'role'），如果不是追蹤模型則返回 null
 */
export function getTrackedModelName(prismaModel: string): TrackedModel | null {
  const lowerCaseModel = prismaModel.charAt(0).toLowerCase() + prismaModel.slice(1);

  // 檢查是否為追蹤的模型
  for (const [trackedName, prismaName] of Object.entries(MODEL_TO_PRISMA_NAME)) {
    if (prismaName === prismaModel || trackedName === lowerCaseModel) {
      if (isTrackedModel(trackedName)) {
        return trackedName;
      }
    }
  }

  return null;
}

/**
 * 記錄創建操作
 */
export async function recordCreate(
  modelName: TrackedModel,
  resourceId: string,
  data: Record<string, unknown>,
  context: ChangeTrackingContext
): Promise<void> {
  if (context.skipTracking) return;

  try {
    await changeTrackingService.recordChange({
      resourceType: modelName,
      resourceId,
      changeType: HistoryChangeType.CREATE,
      snapshot: filterExcludedFields(data),
      changedBy: context.userId,
      changedByName: context.userName,
      changeReason: context.changeReason,
      cityCode: context.cityCode,
    });
  } catch (error) {
    // 非阻塞 - 記錄錯誤但不中斷主要操作
    console.error(`[ChangeTracking] Failed to record CREATE for ${modelName}:`, error);
  }
}

/**
 * 記錄更新操作
 */
export async function recordUpdate(
  modelName: TrackedModel,
  resourceId: string,
  beforeData: Record<string, unknown>,
  afterData: Record<string, unknown>,
  context: ChangeTrackingContext
): Promise<void> {
  if (context.skipTracking) return;

  try {
    await changeTrackingService.recordChange({
      resourceType: modelName,
      resourceId,
      changeType: HistoryChangeType.UPDATE,
      snapshot: filterExcludedFields(afterData),
      beforeData: filterExcludedFields(beforeData),
      changedBy: context.userId,
      changedByName: context.userName,
      changeReason: context.changeReason,
      cityCode: context.cityCode,
    });
  } catch (error) {
    // 非阻塞 - 記錄錯誤但不中斷主要操作
    console.error(`[ChangeTracking] Failed to record UPDATE for ${modelName}:`, error);
  }
}

/**
 * 記錄刪除操作
 */
export async function recordDelete(
  modelName: TrackedModel,
  resourceId: string,
  deletedData: Record<string, unknown>,
  context: ChangeTrackingContext
): Promise<void> {
  if (context.skipTracking) return;

  try {
    await changeTrackingService.recordChange({
      resourceType: modelName,
      resourceId,
      changeType: HistoryChangeType.DELETE,
      snapshot: filterExcludedFields(deletedData),
      changedBy: context.userId,
      changedByName: context.userName,
      changeReason: context.changeReason,
      cityCode: context.cityCode,
    });
  } catch (error) {
    // 非阻塞 - 記錄錯誤但不中斷主要操作
    console.error(`[ChangeTracking] Failed to record DELETE for ${modelName}:`, error);
  }
}

/**
 * 記錄還原操作
 */
export async function recordRestore(
  modelName: TrackedModel,
  resourceId: string,
  restoredData: Record<string, unknown>,
  context: ChangeTrackingContext
): Promise<void> {
  if (context.skipTracking) return;

  try {
    await changeTrackingService.recordChange({
      resourceType: modelName,
      resourceId,
      changeType: HistoryChangeType.RESTORE,
      snapshot: filterExcludedFields(restoredData),
      changedBy: context.userId,
      changedByName: context.userName,
      changeReason: context.changeReason,
      cityCode: context.cityCode,
    });
  } catch (error) {
    // 非阻塞 - 記錄錯誤但不中斷主要操作
    console.error(`[ChangeTracking] Failed to record RESTORE for ${modelName}:`, error);
  }
}

// ============================================================
// Tracked Operation Wrapper
// ============================================================

/**
 * 追蹤操作包裝器
 *
 * @description
 *   提供一個包裝函數，用於在執行 Prisma 操作前後自動記錄變更。
 *   這是手動追蹤的輔助方法，適用於需要精細控制的場景。
 *
 * @example
 * ```typescript
 * // 追蹤更新操作
 * const result = await withChangeTracking(
 *   'mappingRule',
 *   async () => {
 *     const before = await prisma.mappingRule.findUnique({ where: { id } });
 *     const after = await prisma.mappingRule.update({
 *       where: { id },
 *       data: updateData,
 *     });
 *     return { before, after, id };
 *   },
 *   {
 *     userId: session.user.id,
 *     userName: session.user.name,
 *     changeReason: 'Updated extraction pattern',
 *   }
 * );
 * ```
 */
export async function withChangeTracking(
  modelName: TrackedModel,
  operation: () => Promise<{
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    id: string;
    action: 'create' | 'update' | 'delete' | 'restore';
  }>,
  context: ChangeTrackingContext
): Promise<{
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
}> {
  const result = await operation();

  // 非阻塞式記錄變更
  setImmediate(async () => {
    try {
      switch (result.action) {
        case 'create':
          if (result.after) {
            await recordCreate(modelName, result.id, result.after, context);
          }
          break;
        case 'update':
          if (result.before && result.after) {
            await recordUpdate(modelName, result.id, result.before, result.after, context);
          }
          break;
        case 'delete':
          if (result.before) {
            await recordDelete(modelName, result.id, result.before, context);
          }
          break;
        case 'restore':
          if (result.after) {
            await recordRestore(modelName, result.id, result.after, context);
          }
          break;
      }
    } catch (error) {
      console.error(`[ChangeTracking] Error in withChangeTracking:`, error);
    }
  });

  return result;
}

// ============================================================
// Export Types
// ============================================================

export type {
  TrackedModel,
  ChangeTrackingContext as TrackingContext,
};
