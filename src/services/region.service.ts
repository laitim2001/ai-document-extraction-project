/**
 * @fileoverview Region 服務層
 * @description
 *   提供 Region 相關的業務邏輯，包含查詢、創建、更新、刪除等功能。
 *   Region 用於分類管理城市和 Reference Number。
 *
 *   主要功能：
 *   - Region 列表查詢（支援 isActive 篩選）
 *   - Region CRUD 操作
 *   - 刪除保護邏輯（系統預設不可刪除、有關聯記錄不可刪除）
 *
 * @module src/services/region.service
 * @author Development Team
 * @since Epic 20 - Story 20.2 (Region Management API & UI)
 * @lastModified 2026-02-05
 *
 * @features
 *   - 列表查詢功能（getRegions, getRegionById）
 *   - CRUD 操作（createRegion, updateRegion, deleteRegion）
 *   - 刪除保護邏輯（系統預設、有關聯記錄）
 *   - 代碼唯一性檢查
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 單例實例
 *
 * @related
 *   - src/app/api/v1/regions/route.ts - Region API 端點
 *   - src/lib/validations/region.schema.ts - Zod 驗證
 *   - src/components/features/region/RegionSelect.tsx - Region 選擇組件
 *   - prisma/schema.prisma - Region 模型定義
 */

import { prisma } from '@/lib/prisma'
import type { Prisma, Region, RegionStatus } from '@prisma/client'
import type { CreateRegionInput, UpdateRegionInput } from '@/lib/validations/region.schema'

// ============================================================
// 類型定義
// ============================================================

/**
 * Region 列表項目
 */
export interface RegionListItem {
  /** Region ID */
  id: string
  /** Region 代碼 */
  code: string
  /** Region 名稱 */
  name: string
  /** Region 描述 */
  description: string | null
  /** 是否為系統預設 */
  isDefault: boolean
  /** 是否啟用 */
  isActive: boolean
  /** 排序順序 */
  sortOrder: number
  /** 建立時間 */
  createdAt: Date
  /** 更新時間 */
  updatedAt: Date
}

/**
 * Region 選項（用於下拉選單）
 */
export interface RegionOption {
  /** Region ID */
  value: string
  /** 顯示標籤 */
  label: string
  /** Region 代碼 */
  code: string
}

// ============================================================
// 輔助函數
// ============================================================

/**
 * 將 RegionStatus 轉換為 isActive 布林值
 */
function statusToIsActive(status: RegionStatus): boolean {
  return status === 'ACTIVE'
}

/**
 * 將 isActive 布林值轉換為 RegionStatus
 */
function isActiveToStatus(isActive: boolean): RegionStatus {
  return isActive ? 'ACTIVE' : 'INACTIVE'
}

/**
 * 將 Prisma Region 轉換為 RegionListItem
 */
function toRegionListItem(region: Region): RegionListItem {
  return {
    id: region.id,
    code: region.code,
    name: region.name,
    description: region.description,
    isDefault: region.isDefault,
    isActive: statusToIsActive(region.status),
    sortOrder: region.sortOrder,
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  }
}

// ============================================================
// 列表查詢
// ============================================================

/**
 * 獲取 Region 列表
 *
 * @description
 *   查詢所有 Region，支援 isActive 篩選。
 *   按 sortOrder 和 name 排序。
 *
 * @param isActive - 可選，篩選啟用/停用的 Region
 * @returns Region 列表
 *
 * @example
 *   // 獲取所有 Region
 *   const allRegions = await getRegions()
 *
 *   // 只獲取啟用的 Region
 *   const activeRegions = await getRegions(true)
 */
export async function getRegions(isActive?: boolean): Promise<RegionListItem[]> {
  const where: Prisma.RegionWhereInput = {}

  if (isActive !== undefined) {
    where.status = isActiveToStatus(isActive)
  }

  const regions = await prisma.region.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  })

  return regions.map(toRegionListItem)
}

/**
 * 根據 ID 獲取 Region
 *
 * @param id - Region ID
 * @returns Region 或 null
 *
 * @example
 *   const region = await getRegionById('xxx-xxx')
 *   if (!region) {
 *     // 處理不存在的情況
 *   }
 */
export async function getRegionById(id: string): Promise<RegionListItem | null> {
  const region = await prisma.region.findUnique({
    where: { id },
  })

  if (!region) {
    return null
  }

  return toRegionListItem(region)
}

/**
 * 根據代碼獲取 Region
 *
 * @param code - Region 代碼
 * @returns Region 或 null
 */
export async function getRegionByCode(code: string): Promise<RegionListItem | null> {
  const region = await prisma.region.findUnique({
    where: { code: code.toUpperCase() },
  })

  if (!region) {
    return null
  }

  return toRegionListItem(region)
}

/**
 * 獲取啟用的 Region 選項（用於下拉選單）
 *
 * @returns Region 選項列表
 */
export async function getActiveRegionOptions(): Promise<RegionOption[]> {
  const regions = await prisma.region.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
    select: {
      id: true,
      code: true,
      name: true,
    },
  })

  return regions.map((region) => ({
    value: region.id,
    label: region.name,
    code: region.code,
  }))
}

// ============================================================
// 驗證函數
// ============================================================

/**
 * 檢查 Region 代碼是否已存在
 *
 * @param code - Region 代碼
 * @param excludeId - 排除的 ID（用於更新時檢查）
 * @returns 是否已存在
 */
export async function regionCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const count = await prisma.region.count({
    where: {
      code: code.toUpperCase(),
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  })
  return count > 0
}

// ============================================================
// CRUD 操作
// ============================================================

/**
 * 創建新 Region
 *
 * @description
 *   創建新的 Region。
 *   - 代碼會自動轉換為大寫
 *   - isDefault 預設為 false
 *   - status 預設為 ACTIVE
 *
 * @param input - 創建參數
 * @returns 創建的 Region
 * @throws Error 當代碼已存在時
 *
 * @example
 *   const region = await createRegion({
 *     code: 'APAC',
 *     name: 'Asia Pacific',
 *     description: 'Asia Pacific Region',
 *     sortOrder: 10,
 *   })
 */
export async function createRegion(input: CreateRegionInput): Promise<RegionListItem> {
  const upperCode = input.code.toUpperCase()

  // 檢查代碼唯一性
  const exists = await regionCodeExists(upperCode)
  if (exists) {
    throw new Error(`Region 代碼 "${upperCode}" 已存在`)
  }

  const region = await prisma.region.create({
    data: {
      code: upperCode,
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
      isDefault: false,
      status: 'ACTIVE',
    },
  })

  return toRegionListItem(region)
}

/**
 * 更新 Region
 *
 * @description
 *   更新 Region 資訊。
 *   - 不允許更新 code
 *   - isActive 會轉換為 status
 *
 * @param id - Region ID
 * @param input - 更新參數
 * @returns 更新後的 Region
 * @throws Error 當 Region 不存在時
 *
 * @example
 *   const region = await updateRegion('xxx-xxx', {
 *     name: 'Asia Pacific (Updated)',
 *     isActive: true,
 *   })
 */
export async function updateRegion(
  id: string,
  input: UpdateRegionInput
): Promise<RegionListItem> {
  // 檢查 Region 是否存在
  const existing = await prisma.region.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new Error('Region 不存在')
  }

  // 構建更新資料
  const updateData: Prisma.RegionUpdateInput = {}

  if (input.name !== undefined) {
    updateData.name = input.name
  }
  if (input.description !== undefined) {
    updateData.description = input.description
  }
  if (input.sortOrder !== undefined) {
    updateData.sortOrder = input.sortOrder
  }
  if (input.isActive !== undefined) {
    updateData.status = isActiveToStatus(input.isActive)
  }

  const region = await prisma.region.update({
    where: { id },
    data: updateData,
  })

  return toRegionListItem(region)
}

/**
 * 刪除 Region（軟刪除）
 *
 * @description
 *   軟刪除 Region（將 status 設為 INACTIVE）。
 *   限制：
 *   - isDefault = true 的 Region 不可刪除
 *   - 有關聯 ReferenceNumber 的 Region 不可刪除
 *
 * @param id - Region ID
 * @throws Error 當無法刪除時
 *
 * @example
 *   try {
 *     await deleteRegion('xxx-xxx')
 *   } catch (error) {
 *     // 處理刪除失敗
 *   }
 */
export async function deleteRegion(id: string): Promise<void> {
  // 獲取 Region 及其關聯數量
  const region = await prisma.region.findUnique({
    where: { id },
    include: {
      _count: {
        select: { referenceNumbers: true },
      },
    },
  })

  if (!region) {
    throw new Error('Region 不存在')
  }

  // 檢查是否為系統預設
  if (region.isDefault) {
    throw new Error('無法刪除系統預設地區')
  }

  // 檢查是否有關聯的 ReferenceNumber
  if (region._count.referenceNumbers > 0) {
    throw new Error('此地區有關聯的 Reference Number，無法刪除')
  }

  // 軟刪除：將 status 設為 INACTIVE
  await prisma.region.update({
    where: { id },
    data: { status: 'INACTIVE' },
  })
}

// ============================================================
// 統計函數
// ============================================================

/**
 * 獲取 Region 統計資訊
 *
 * @returns 統計資訊
 */
export async function getRegionStats(): Promise<{
  total: number
  active: number
  inactive: number
  default: number
}> {
  const [total, active, inactive, defaultCount] = await prisma.$transaction([
    prisma.region.count(),
    prisma.region.count({ where: { status: 'ACTIVE' } }),
    prisma.region.count({ where: { status: 'INACTIVE' } }),
    prisma.region.count({ where: { isDefault: true } }),
  ])

  return {
    total,
    active,
    inactive,
    default: defaultCount,
  }
}
