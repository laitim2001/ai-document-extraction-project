/**
 * @fileoverview 資源城市範圍授權 helper（CHANGE-079 / WP-4）
 * @description
 *   提供「資源層級」的城市範圍授權，補齊 CHANGE-078 middleware 登入閘之後的第二層授權
 *   （middleware 在 Edge runtime 無法查 DB，城市範圍須在 handler/service 層做）。
 *
 *   與 `src/lib/auth/city-permission.ts`（聚焦使用者管理權限）並列：本檔聚焦「資源城市範圍」。
 *   Session 城市欄位以 `src/types/next-auth.d.ts` 標準 shape 為準（`cityCodes` / `isGlobalAdmin`）。
 *
 *   - `requireCityScope`：單一資源 cityCode 比對（路由層用）
 *   - `intersectCityCodes`：請求 cityCodes 與授權 cityCodes 取交集（服務層用，取代覆蓋寫法）
 *
 * @module src/lib/auth/city-scope
 * @since CHANGE-079 - 城市隔離 IDOR 統一修復（WP-4）
 * @lastModified 2026-06-10
 */

/**
 * 城市範圍授權所需的 session 使用者子集（與 next-auth.d.ts 的 session.user 結構相容）。
 */
export interface SessionCityUser {
  /** 可存取的城市代碼列表 */
  cityCodes: string[]
  /** 是否為全域管理員 */
  isGlobalAdmin: boolean
}

/**
 * `requireCityScope` 的結果。未授權時帶 RFC 7807 top-level 相容欄位供路由組裝。
 */
export interface CityScopeResult {
  authorized: boolean
  status?: number
  title?: string
  detail?: string
}

/**
 * 不可能條件 sentinel（對齊 `src/middlewares/city-filter.ts` 的 `buildCityWhereClause`）。
 * 用於非全域使用者的「空交集」情境，避免「空陣列 = 查全部」的危險反轉。
 */
export const CITY_SCOPE_NONE = '__NONE__'

/**
 * 驗證 session 使用者是否有權存取指定城市的資源（單一資源比對）。
 *
 * - 全域管理員：永遠通過
 * - `resourceCityCode` 為 null/undefined：fail-closed（403），不放行
 * - 其他：`resourceCityCode` 必須在 `user.cityCodes` 內，否則 403
 *
 * @param user - session 使用者（cityCodes + isGlobalAdmin）
 * @param resourceCityCode - 目標資源的城市代碼
 * @returns 授權結果；未授權時含 status/title/detail
 */
export function requireCityScope(
  user: SessionCityUser,
  resourceCityCode: string | null | undefined
): CityScopeResult {
  if (user.isGlobalAdmin) {
    return { authorized: true }
  }

  if (!resourceCityCode) {
    // fail-closed：資源缺城市資訊一律拒絕，避免「缺欄位」變成繞過漏洞
    return {
      authorized: false,
      status: 403,
      title: 'Forbidden',
      detail: '此資源缺少城市資訊，無法驗證存取權限',
    }
  }

  if (!user.cityCodes.includes(resourceCityCode)) {
    return {
      authorized: false,
      status: 403,
      title: 'Forbidden',
      detail: '您沒有存取此城市資源的權限',
    }
  }

  return { authorized: true }
}

/**
 * 將客戶端請求的 cityCodes 與授權 cityCodes 取交集（取代 `params.cityCodes || authorized` 的覆蓋寫法）。
 *
 * 語意對齊 `src/middlewares/city-filter.ts` 的 `validateRequestedCities` 與
 * `src/services/audit-query.service.ts` 的 `buildWhereClause`：
 * - 全域管理員：指定則用 requested，未指定回 `[]`（呼叫端視為「不限城市」）
 * - 非全域 + 未指定 requested：回全部授權城市
 * - 非全域 + 指定 requested：回 `requested ∩ authorized`；空交集回 `[CITY_SCOPE_NONE]`（不可能條件，避免空=全部反轉）
 *
 * @param requested - 客戶端請求的城市代碼
 * @param authorized - 使用者授權的城市代碼
 * @param isGlobalAdmin - 是否為全域管理員
 * @returns 實際應查詢的城市代碼清單
 */
export function intersectCityCodes(
  requested: string[] | undefined,
  authorized: string[],
  isGlobalAdmin: boolean
): string[] {
  if (isGlobalAdmin) {
    return requested && requested.length > 0 ? requested : []
  }

  if (!requested || requested.length === 0) {
    return authorized
  }

  const intersection = requested.filter((c) => authorized.includes(c))
  return intersection.length > 0 ? intersection : [CITY_SCOPE_NONE]
}
