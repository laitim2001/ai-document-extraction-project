/**
 * @fileoverview 城市/區域存取權限與 globalAdmin 切換驗證 Schema
 * @description
 *   使用 Zod 定義「用戶 ↔ 城市/區域資料存取權限」管理與 globalAdmin 切換的輸入驗證。
 *   用於 admin 用戶管理面板與後端 API 輸入驗證（CHANGE-090）。
 *
 *   注意：cityCode / regionCode 是「代碼」（如 HKG / APAC），非資料庫 cuid，
 *   故以一般字串驗證，城市/區域是否存在由 service 層（CityAccessService /
 *   RegionalManagerService）檢查。
 *
 * @module src/lib/validations/city-region-access.schema
 * @author Development Team
 * @since CHANGE-090 - 城市/區域存取權限管理 UI/API
 * @lastModified 2026-06-24
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *
 * @related
 *   - src/services/city-access.service.ts - 城市存取權限服務
 *   - src/services/regional-manager.service.ts - 區域存取權限服務
 *   - src/services/global-admin.service.ts - 全域管理者服務
 *   - src/app/api/admin/users/[id]/city-access/route.ts - 城市存取 API
 *   - src/app/api/admin/users/[id]/region-access/route.ts - 區域存取 API
 *   - src/app/api/admin/users/[id]/global-admin/route.ts - globalAdmin 切換 API
 */

import { z } from 'zod'

// ============================================================
// Shared Fragments
// ============================================================

/** 存取等級（對應 Prisma enum AccessLevel） */
const accessLevelSchema = z.enum(['FULL', 'READ_ONLY'], {
  message: '無效的存取等級',
})

/** 城市/區域代碼（如 HKG / APAC） */
const codeSchema = z
  .string()
  .min(1, '請提供代碼')
  .max(20, '代碼不能超過 20 字元')

/**
 * 過期時間（可選、可為 null = 永不過期）
 * @description 前端傳 ISO 字串時自動轉 Date；未填或 null 視為永久權限。
 */
const expiresAtSchema = z.coerce.date().nullable().optional()

/** 授權原因（可選） */
const reasonSchema = z.string().max(500, '原因不能超過 500 字元').optional()

// ============================================================
// City Access
// ============================================================

/**
 * 授予城市存取權限 Schema
 *
 * @description
 *   對應 `CityAccessService.grantAccess`。`cityCode` 必填，其餘可選。
 */
export const grantCityAccessSchema = z.object({
  /** 城市代碼 */
  cityCode: codeSchema,
  /** 是否設為主要城市（預設 false） */
  isPrimary: z.boolean().optional(),
  /** 存取等級（預設 FULL） */
  accessLevel: accessLevelSchema.optional(),
  /** 過期時間（可選） */
  expiresAt: expiresAtSchema,
  /** 授權原因（可選） */
  reason: reasonSchema,
})

/** 授予城市存取權限輸入類型 */
export type GrantCityAccessInput = z.infer<typeof grantCityAccessSchema>

/**
 * 設定主要城市 Schema（PATCH city-access/[cityCode]）
 */
export const setPrimaryCitySchema = z.object({
  /** 是否設為主要城市；目前僅支援 true（將指定城市設為主要） */
  isPrimary: z.literal(true),
})

/** 設定主要城市輸入類型 */
export type SetPrimaryCityInput = z.infer<typeof setPrimaryCitySchema>

// ============================================================
// Region Access
// ============================================================

/**
 * 授予區域存取權限 Schema
 *
 * @description
 *   對應 `RegionalManagerService.grantRegionAccess`。授予區域存取會
 *   連帶授予該區域內所有城市的存取權限（service 層處理）。
 */
export const grantRegionAccessSchema = z.object({
  /** 區域代碼 */
  regionCode: codeSchema,
  /** 存取等級（預設 FULL） */
  accessLevel: accessLevelSchema.optional(),
  /** 過期時間（可選） */
  expiresAt: expiresAtSchema,
  /** 授權原因（可選） */
  reason: reasonSchema,
})

/** 授予區域存取權限輸入類型 */
export type GrantRegionAccessInput = z.infer<typeof grantRegionAccessSchema>

// ============================================================
// Global Admin Toggle
// ============================================================

/**
 * 切換 globalAdmin Schema（PATCH global-admin）
 *
 * @description
 *   對應 `GlobalAdminService.grantGlobalAdminRole` / `revokeGlobalAdminRole`。
 *   `isGlobalAdmin=true` 授予、`false` 撤銷。
 */
export const setGlobalAdminSchema = z.object({
  /** 目標 globalAdmin 狀態 */
  isGlobalAdmin: z.boolean({ message: '請提供 isGlobalAdmin 布林值' }),
})

/** 切換 globalAdmin 輸入類型 */
export type SetGlobalAdminInput = z.infer<typeof setGlobalAdminSchema>
