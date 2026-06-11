# CHANGE-079: 城市隔離 IDOR 統一修復

> **日期**: 2026-06-10
> **狀態**: ✅ 已實作（程式碼層面，2026-06-10）：6 套用點全部完成；單元測試 + 執行期待驗證
> **實作摘要**: 新增 `src/lib/auth/city-scope.ts`（`requireCityScope` + `intersectCityCodes`，採 next-auth.d.ts 標準 shape）。6 套用點全部套用：#1 `source`、#2 `blob`（select 補 cityCode）、#3 `documents` list（`getDocuments` 加 `cityScope`，唯一呼叫端）、#4 `search`/`sources/stats`/`sources/trend`（`DocumentSourceService` 加 `authorizedCityCodes`+`isGlobalAdmin`，private `resolveCityCodes` 統一交集，各方法皆單一呼叫端）、#5 `n8n/webhook` document.status_changed 城市比對（`CITY_MISMATCH` 403）、#6 `city-cost.service` 3 處交集取代覆蓋。type-check `src/` 零錯誤、eslint 本批無 error（未新增 console）。
> **優先級**: High（P1）
> **類型**: Security
> **影響範圍**: `src/app/api/documents/*`（blob/source/list/search/sources）、`src/app/api/n8n/webhook`、`src/services/city-cost.service.ts`、新增 `src/lib/auth/city-scope.ts`（共用 helper）
> **來源**: 2026-06-10 全面安全審查 — SECURITY-ASSESSMENT.md §5 主題 B、§6 模式 3、REMEDIATION-ROADMAP.md WP-4
> **H1 approval**: 用戶於 2026-06-10 明確 approve 此架構改動（新增共用 city-scope helper）
> **相依**: 建立於 CHANGE-078（middleware 登入閘）之上；middleware 只驗登入，城市範圍須由 handler/service 層補

---

## 變更背景

全面安全審查（SECURITY-ASSESSMENT.md §5 主題 B、§6 模式 3）發現一個**系統性根因**：

> **城市隔離 IDOR**：服務層公開方法不自帶城市範圍驗證，授權責任上推到路由層，但路由層普遍漏檢。

CHANGE-078 的 middleware 認證閘只負責「第一層：是否登入」（Edge runtime 不查 DB，無法做城市範圍判斷）。因此**已登入的低權限使用者**（例如只被授權單一城市的 City Manager）仍可透過下列端點越權存取或竄改其他城市的資料：

- 直接下載任意文件的原始檔（預簽名 URL / Blob 串流）
- 列出 / 搜尋全部城市的文件
- 透過單一城市綁定的 n8n ApiKey 竄改任意城市的文件狀態與工作流
- 查詢任意城市的 AI 成本資料

本變更建立**統一的城市範圍授權機制**（路由層 `requireCityScope` + 服務層 `assertCityAccess` / cityCodes 交集過濾），並套用到所有受影響端點，以**同專案內已正確實作城市範圍者為範本**，避免再次出現「逐 handler 手寫、不一致、易遺漏」的問題（§6 模式 3、模式 8）。

---

## 涵蓋發現

> 行號已於 2026-06-10 逐一以 Read/Grep 驗證；如下表「驗證」欄。

| 編號 | 端點 : 行 | 現狀 | 問題 |
|------|-----------|------|------|
| DOCFLOW-02 | `src/app/api/documents/[id]/source/route.ts:58`（`handleGet`） | 僅 `auth()` 驗登入後 `traceabilityService.getDocumentSource(id)` | 回傳預簽名下載 URL，未驗該文件 `cityCode` 是否在使用者授權範圍 → 任意已登入者可下載任意城市文件 |
| DOCFLOW-03 | `src/app/api/documents/[id]/blob/route.ts:71`（`GET`） | 僅 `auth()` 驗登入；`document.findUnique` 只 `select { blobName, fileName, fileType }`（未取 `cityCode`） | Blob 串流跨城市可讀，且查詢未取出 `cityCode` 故根本無從比對 |
| DOCFLOW-04 | `src/app/api/documents/route.ts:83`（`GET`，`Promise.all([getDocuments...])`） | 僅 `auth()` 驗登入；`getDocuments({ page, pageSize, status, search, sortBy, sortOrder })` 無城市參數 | 文件列表完全無城市過濾，已登入者見全部城市文件 |
| DOCFLOW-05 | `src/app/api/documents/search/route.ts:51`、`sources/stats/route.ts:38`、`sources/trend/route.ts:37` | 三端點皆把客戶端 `cityId` query 參數**原樣**傳入 `DocumentSourceService`，無權限比對 | 接受任意 `cityId`，未驗證該城市是否在使用者授權範圍；不傳則無過濾（見全部） |
| API-MISC-03 | `src/app/api/n8n/webhook/route.ts:258`（`handleDocumentStatusChanged`） | `n8nApiMiddleware(request, 'webhook:receive')` 只驗 ApiKey + 權限；`handleDocumentStatusChanged` 對 `data.documentId` 直接 `prisma.document.updateMany({ where: { id } })` | ApiKey 帶 `cityCode`（`types/n8n.ts:46`）卻**完全不比對**目標文件城市；單城市金鑰可跨城市竄改任意文件狀態。`N8nErrorCode.CITY_MISMATCH`（`n8n-api.middleware.ts:67`）已定義但 webhook 路徑未使用 |
| CITYCOST-01 | `src/services/city-cost.service.ts:173`、`385`、`553` | 三方法（`getCityCostSummary` / `getCityCostTrend` / `getCityCostComparison`）皆 `const cityCodes = params.cityCodes \|\| cityFilter.cityCodes` | 客戶端傳入的 `params.cityCodes` **直接覆蓋** `cityFilter.cityCodes`，未做交集；非全域使用者傳任意 `cityCodes` 即可查任意城市成本 |

### 行號偏移 / 已修狀態盤點

- 上述 6 項行號於 2026-06-10 驗證**全部與審查報告一致**，無偏移、無已修復項。
- DOCFLOW-03 額外發現：`findUnique` 的 `select` 未包含 `cityCode`，修復時須一併補上 select 欄位才能比對（屬實作細節，已記於技術設計）。

---

## 根本原因

| # | 根因 | 對應 |
|---|------|------|
| 1 | **服務層公開方法不自帶城市範圍** | `getDocumentSource(documentId)`、`getDocuments(...)`、`DocumentSourceService` 各方法皆以「呼叫端已驗權限」為隱含假設，但呼叫端（路由）普遍未驗（§6 模式 3） |
| 2 | **客戶端參數覆蓋授權上下文** | `city-cost.service` 用 `params.cityCodes \|\| cityFilter.cityCodes`，使客戶端可繞過 filter（無交集邏輯） |
| 3 | **ApiKey 城市綁定未落實** | n8n ApiKey 帶 `cityCode`，但 webhook handler 寫操作未比對目標資源城市 |
| 4 | **無統一城市授權封裝** | 城市檢查散落各 handler，寫法不一（有的查 `session.user.cityAccess`、有的查 `cityCodes`），導致逐檔遺漏（§6 模式 8） |

---

## 技術設計

### 1. 新增共用 helper：`src/lib/auth/city-scope.ts`

> 與既有 `src/lib/auth/city-permission.ts`（聚焦使用者管理權限）並列；本檔聚焦「資源城市範圍」授權。Session 城市欄位以 `src/types/next-auth.d.ts` 標準 shape 為準：`user.cityCodes: string[]`、`user.isGlobalAdmin: boolean`、`user.isRegionalManager: boolean`、`user.primaryCityCode`。

#### 1.1 路由層：`requireCityScope`

```typescript
/**
 * 驗證 session 使用者是否有權存取指定城市的資源。
 * - 全域管理員：永遠通過
 * - 其他：resourceCityCode 必須在 user.cityCodes 內
 *
 * @returns { authorized: true } 或 { authorized: false; status: 403; detail: string }
 */
export function requireCityScope(
  user: SessionUserCityInfo,
  resourceCityCode: string | null | undefined
): CityScopeResult
```

設計要點：
- 全域管理員（`isGlobalAdmin === true`）直接通過。
- `resourceCityCode` 為 null/undefined 時：fail-closed（回 403），不可放行（與 `documents/[id]/progress` 既有範本一致）。
- 非全域使用者：`user.cityCodes.includes(resourceCityCode)` 為 false → 403。
- 回傳 RFC 7807 top-level 相容的 `{ status, title, detail }` 供路由組裝（依 §When in Doubt：新 API 採 top-level）。

#### 1.2 服務層：`assertCityAccess` / `intersectCityCodes`

```typescript
/**
 * 將客戶端請求的 cityCodes 與授權 cityCodes 取交集（全域管理員例外）。
 * 取代 `params.cityCodes || cityFilter.cityCodes` 的覆蓋寫法。
 */
export function intersectCityCodes(
  requested: string[] | undefined,
  authorized: string[],
  isGlobalAdmin: boolean
): string[]
```

設計要點：
- 沿用 `src/middlewares/city-filter.ts` 既有 `CityFilterContext` 與 `validateRequestedCities` 的語意（交集而非覆蓋），抽成可供服務層直接呼叫的純函數。
- 全域管理員：回傳 `requested ?? []`（不限制）。
- 非全域 + 未指定 requested：回傳 `authorized`（預設只看授權城市）。
- 非全域 + 指定 requested：回傳 `requested ∩ authorized`。

### 2. 套用點清單

| # | 套用點 | 修改方式 |
|---|--------|----------|
| 1 | `documents/[id]/source/route.ts` | `getDocumentSource` 後（或前）取出文件 `cityCode`，呼叫 `requireCityScope`；不通過回 403 |
| 2 | `documents/[id]/blob/route.ts` | `findUnique` 的 `select` 補 `cityCode`，呼叫 `requireCityScope`；不通過回 403 |
| 3 | `documents/route.ts` | 取 session 城市上下文，傳入 `getDocuments`（`document.service.ts` 需接受城市過濾參數，套 `buildCityWhereClause` / `intersectCityCodes`）|
| 4 | `documents/search`、`sources/stats`、`sources/trend` | 將客戶端 `cityId` 以 `intersectCityCodes` / `requireCityScope` 校驗後再傳入 `DocumentSourceService`；`DocumentSourceService` 對應方法接受授權城市範圍 |
| 5 | `n8n/webhook/route.ts` `handleDocumentStatusChanged` | 寫操作前查目標文件 `cityCode`，與 `authResult.apiKey.cityCode` 比對；不符回 `CITY_MISMATCH`（403）。其餘 workflow 事件依設計評估是否需綁城市 |
| 6 | `city-cost.service.ts`（3 處 `:173/:385/:553`） | 將 `params.cityCodes \|\| cityFilter.cityCodes` 改為 `intersectCityCodes(params.cityCodes, cityFilter.cityCodes, cityFilter.isGlobalAdmin)` |

> 服務層改動（`document.service.ts`、`document-source.service.ts`、`traceability.service.ts`）以「新增可選城市範圍參數 + 內部過濾」為原則，維持向後相容，避免破壞既有呼叫端（Karpathy §1.3 外科手術式修改）。

### 3. 可參考的既有正確範本

> 實作時**必須**對齊以下既有正確寫法，避免引入第 5 種城市檢查寫法（§6 模式 8）。

| 範本 | 位置 | 可借鏡之處 |
|------|------|-----------|
| **路由層資源城市比對** | `src/app/api/documents/[id]/progress/route.ts:80-102` | 先 `findUnique({ select: { cityCode } })` → 比對 `GLOBAL_ADMIN` + 授權城市 → 不符回 403。`requireCityScope` 即抽取自此模式 |
| **路由層城市過濾 HOF + 交集驗證** | `src/middlewares/city-filter.ts`（`withCityFilter`、`validateRequestedCities`、`buildCityWhereClause`） | `CityFilterContext` 結構、交集（非覆蓋）語意、Prisma where 子句建構（含「無城市 → 不可能條件」防護） |
| **服務層 cityCodes 交集過濾** | `src/services/audit-query.service.ts:219-236`（`buildWhereClause`） | 標準寫法：非全域 → `where.cityCode = { in: cityFilter.cityCodes }`；指定城市時 `params.cityCodes.filter(c => cityFilter.cityCodes.includes(c))`。`intersectCityCodes` 即抽取自此模式 |
| **使用者管理城市權限 helper** | `src/lib/auth/city-permission.ts`（`getCityFilter`、`getManagedCityIds`、`hasPermission`） | helper 命名 / 回傳結構 / JSDoc 風格參考（注意該檔聚焦使用者管理權限，本變更聚焦資源城市範圍，兩者並列） |
| **ApiKey 城市比對錯誤碼** | `src/lib/middleware/n8n-api.middleware.ts:67`（`CITY_MISMATCH: 403`） | n8n 路徑城市不符應回此既有錯誤碼，不需新增 |

### i18n / 資料庫影響

- **i18n**：本變更回傳的 403 屬 API 層 RFC 7807 錯誤（開發者 / API 客戶端可見），非前端 UI 字串，不觸發 H5。前端若需顯示友善訊息，沿用既有 `errors.json` 既有 key（不新增命名空間）。
- **資料庫**：無 schema 變更。`blob/route.ts` 僅在既有 `select` 補 `cityCode` 欄位（讀取既有欄位）。

---

## 設計決策

1. **middleware 不做城市範圍** — 沿用 CHANGE-078 設計：Edge runtime 不查 DB，城市範圍須在 handler/service 層（可存取 Prisma）做。本變更即補齊此層。
2. **資源 cityCode 為 null 時 fail-closed** — 缺城市資訊一律回 403，不放行（對齊 §H4 與 `progress` 範本），避免「資料缺欄位」變成繞過漏洞。
3. **服務層採交集而非覆蓋** — 取代 `params.cityCodes || cityFilter.cityCodes`，杜絕客戶端參數凌駕授權上下文。
4. **新增 helper 而非各自手寫** — 統一封裝 `requireCityScope` / `intersectCityCodes`，收斂 §6 模式 8「5 種授權寫法並存」（屬 H1 架構改動，已 approve）。
5. **n8n 城市不符用既有 `CITY_MISMATCH`** — 不新增錯誤碼，對齊既有 n8n 錯誤模型。
6. **服務層改動向後相容** — 城市範圍參數設為可選 + 內部過濾，避免波及未涉及本次 scope 的呼叫端（§H3）。

---

## ⚠️ 風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| 既有前端依賴「無城市過濾」的列表 / 搜尋（過去可見全部城市）→ 修復後資料量變少 | 中 | 此即修復目標；上線前確認前端不依賴跨城市資料；全域管理員行為不變 |
| `document.service.getDocuments` 加城市參數可能波及其他呼叫端 | 中 | 參數設為可選 + 預設行為向後相容；grep 全部呼叫端確認 |
| n8n 既有工作流以單一金鑰跨城市操作（若現行運維如此依賴）| 中 | 上線前盤點各 ApiKey 的 `cityCode` 綁定與實際工作流城市；必要時改發多城市金鑰或全域金鑰 |
| `requireCityScope` 對 `cityCode=null` 的舊資料一律 403 | 低 | 盤點是否有 `cityCode` 為空的歷史文件；如有需先回填或明確標記 |
| 與 CHANGE-078 監測→強制切換的時序交互 | 低 | 本變更為登入後的第二層授權，與登入閘正交；建議 CHANGE-078 enforce 後再驗收本變更 403 行為 |
| 服務層交集導致全域管理員被誤限 | 低 | `intersectCityCodes` 對 `isGlobalAdmin` 短路；單元測試覆蓋全域 / 城市 / 跨城市三情境 |

## 回滾計劃

- 各套用點為獨立小改動，可逐一 revert。
- 新增的 `city-scope.ts` helper 為純新增檔案，移除即回滾。
- 無 schema 變更，無 migration 回滾顧慮。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 跨城市文件來源 | City Manager（單城市）請求他城市文件 `/[id]/source` → 403 | High |
| 2 | 跨城市 Blob | 同上請求 `/[id]/blob` → 403；且查詢已 select `cityCode` | High |
| 3 | 文件列表過濾 | City Manager 呼叫 `/api/documents` 僅回傳其授權城市文件 | High |
| 4 | search / sources cityId 校驗 | 傳入未授權 `cityId` → 該城市資料不外洩（403 或僅回授權交集） | High |
| 5 | n8n 跨城市竄改 | 單城市 ApiKey 對他城市 `documentId` 發 `document.status_changed` → `CITY_MISMATCH`（403），文件狀態不變 | High |
| 6 | city-cost 交集 | 非全域使用者傳 `params.cityCodes` 含未授權城市 → 僅回授權交集，不洩漏他城市成本 | High |
| 7 | 全域管理員迴歸 | 全域管理員所有上述端點行為不變（可跨城市） | High |
| 8 | 單元測試 | `requireCityScope` / `intersectCityCodes` 覆蓋全域 / 授權內 / 授權外 / null 城市四情境 | Medium |
| 9 | 型別 / Lint | `npm run type-check` + `npm run lint` 通過無 warning | High |

---

## 實作進度記錄

### 階段 1（2026-06-10）✅
| 套用點 | 檔案 | 做法 | 狀態 |
|--------|------|------|------|
| helper | `src/lib/auth/city-scope.ts`（新建） | `requireCityScope`（單一資源比對，fail-closed on null）+ `intersectCityCodes`（交集 + `__NONE__` sentinel） | ✅ |
| #1 DOCFLOW-02 | `documents/[id]/source/route.ts` | findUnique select cityCode → `requireCityScope` → 403 | ✅ |
| #2 DOCFLOW-03 | `documents/[id]/blob/route.ts` | select 補 `cityCode` → `requireCityScope` → 403 | ✅ |
| #5 API-MISC-03 | `n8n/webhook/route.ts` | document.status_changed 寫入前比對 apiKey.cityCode vs 目標文件 → `CITY_MISMATCH` 403（全域金鑰不限制） | ✅ |
| #6 CITYCOST-01 | `city-cost.service.ts`（3 處） | `intersectCityCodes` 取代 `params.cityCodes \|\| cityFilter.cityCodes` | ✅ |

**驗證**：type-check `src/` 零錯誤、eslint 本批無 error/warning。

### 階段 2（2026-06-10）✅
| 套用點 | 檔案 | 做法 | 狀態 |
|--------|------|------|------|
| #3 DOCFLOW-04 | `documents/route.ts` + `document.service.ts` `getDocuments` | `GetDocumentsParams` 加可選 `cityScope`，內部 `intersectCityCodes` 構建 `cityCode: { in }`；route 傳 `session.user`。**grep 確認 `getDocuments` 唯一呼叫端**，無向後相容顧慮 | ✅ |
| #4 DOCFLOW-05 | `documents/search`、`sources/stats`、`sources/trend` + `DocumentSourceService` | 3 方法 options 加 `authorizedCityCodes`+`isGlobalAdmin`，private `resolveCityCodes` 統一交集（未傳授權上下文時維持 cityId 舊行為，向後相容）；3 route 傳 `session.user.cityCodes`+`isGlobalAdmin`。**grep 確認三方法各自單一呼叫端** | ✅ |

**驗證**：type-check `src/` 零錯誤、eslint 本批無 error（既有 console warning 非本批）。

> 階段 2 涉及服務層方法簽章變更，已 grep 確認所有受影響方法（`getDocuments`/`getSourceTypeStats`/`getSourceTypeTrend`/`searchBySource`）皆**單一呼叫端**，並設可選參數維持向後相容（§H3、Karpathy §1.3）。

### 已知未納入範圍（§H3，避免擴大）
- `documents/route.ts` 並行的 `getProcessingStatsEnhanced()` 統計未加城市過濾（DOCFLOW-04 明確範圍為文件列表）；若統計需城市範圍屬獨立議題，另立後續。

### 單元測試（待測試框架就緒）⏳
- 專案無 vitest/jest 配置；`requireCityScope` / `intersectCityCodes` 的四情境（全域 / 授權內 / 授權外 / null 城市）單測待框架就緒補。

---

## 相關文件

- SECURITY-ASSESSMENT.md §5 主題 B（城市隔離 IDOR）、§6 模式 3、模式 8
- REMEDIATION-ROADMAP.md WP-4
- CHANGE-078（middleware `/api` 統一認證閘，本變更相依的登入閘）
- CHANGE-077（WP-1，認證 fail-open / dev-bypass 修復）
- 既有正確範本：`src/app/api/documents/[id]/progress/route.ts`、`src/middlewares/city-filter.ts`、`src/services/audit-query.service.ts`、`src/lib/auth/city-permission.ts`
- 型別來源：`src/types/next-auth.d.ts`（session 城市欄位 shape）
