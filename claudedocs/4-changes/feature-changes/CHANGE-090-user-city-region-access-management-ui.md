# CHANGE-090: 城市/區域存取權限管理 UI/API（修復權限資料來源脫節）

> **日期**: 2026-06-23
> **狀態**: ⏳ 待實作
> **優先級**: High
> **類型**: Feature + Bug Fix（補缺口 + 修脫節）
> **影響範圍**: 用戶管理（admin/users）＋權限授權鏈＋auth session＋i18n

---

## 變更背景

### 觸發事件

Azure DEV 上 `corrie.lai@rapo.com.hk` 登入後，dashboard 統計 API 回 **403 Forbidden**。追查後發現：`withCityFilter` 中間件對「非 globalAdmin 且無城市存取權限」的用戶回 403（`src/middlewares/city-filter.ts:149-163`）。最終只能靠把她設為 **globalAdmin**（直接改 `User.is_global_admin` 欄位、繞過整個城市機制）解決——因為**沒有任何 UI/API 可以給她授予城市存取權限**。

### 核心問題：權限「判斷來源」與「設定來源」是兩張不同的表

```
登入後資料存取 / 403 判斷鏈：
  withCityFilter → session.user.cityCodes
                 → auth.ts:225  CityAccessService.getUserCityCodes(userId)
                 → 讀【UserCityAccess 表】          ← 真正決定 403 的表

admin 用戶管理 UI（EditUserDialog / AddUserDialog 的「城市」欄位）：
  PATCH /api/admin/users/[id] → updateUserWithRoles()
                              → 寫【UserRole.cityId】 ← 完全不同的表！
```

| 表 | 誰寫入 | 影響什麼 |
|----|--------|----------|
| `UserCityAccess` | **只有** `CityAccessService.grantAccess/revokeAccess/setPrimaryCity`，而這些**只被 `regional-manager.service.ts` 內部呼叫，沒有任何對外 API/UI 端點** | `session.cityCodes` → 資料存取 / **403** |
| `UserRole.cityId` | admin UI 的「城市」下拉（`updateUserWithRoles` `src/services/user.service.ts:414/421`、`createUser:591`） | City Manager「能管哪個城市的用戶」（`checkCityEditPermission`），**不影響資料存取 403** |

### 由此造成的三個缺陷

1. **無管理入口** — 沒有任何 UI/API 能給一般用戶授予/撤銷「城市資料存取權限」（`UserCityAccess`）。掃描 `src/app/api` 確認無任何端點呼叫 `CityAccessService.grantAccess`。
2. **誤導性 UI** — `EditUserDialog`/`AddUserDialog` 有「城市」下拉，admin 設了它（存到 `UserRole.cityId`），但這**不會解除 403**（403 看的是 `UserCityAccess`，仍是空的）。管理者會誤以為「設了城市就有權限」。
3. **只能改 DB** — 非 globalAdmin 用戶要城市權限，目前唯一途徑是直接改資料庫（如本次 corrie.lai 靠 gated script 設 globalAdmin 繞過）。

> 相關既有設計：`CHANGE-079`（city-scope IDOR 統一修復）、Epic 6（多城市資料隔離）。本 CHANGE 補上 Epic 6 缺失的「城市權限指派」管理面。

---

## 變更內容

補上「用戶 ↔ 城市存取權限（`UserCityAccess`）」的完整管理鏈，並消除 `UserRole.cityId` 造成的誤導。**好消息**：service 層（`CityAccessService.grantAccess/revokeAccess/getUserCityAccesses/setPrimaryCity`）與 `CitySelector` 組件**皆已存在**，本變更主要是**補 API + 接 UI + 釐清雙軌語意**，不需重寫權限核心。

### 變更項目

1. **新增城市存取權限管理 API** — 暴露既有 `CityAccessService` 方法（列出 / 授予 / 撤銷 / 設主要城市），受 `USER_MANAGE` 權限保護。
2. **新增用戶城市權限管理 UI** — 在用戶管理（EditUserDialog 或用戶詳情）加「城市存取權限」面板（多城市授予/撤銷/設主要城市），接新 API。
3. **消除誤導性「城市」欄位** — 釐清 `UserRole.cityId`（City Manager 管理範圍）與 `UserCityAccess`（資料存取）的語意，避免管理者混淆（**處理方式見 Open Question OQ-2**）。
4. **（待確認）區域權限** — 是否一併處理 `UserRegionAccess` / `isRegionalManager` 的管理 UI（見 OQ-3）。

---

## 技術設計

### 修復方向（設計決策，待用戶拍板 — 見 OQ-1）

| 方向 | 做法 | 觸發 H1？ | 優劣 |
|------|------|-----------|------|
| **A（推薦）補管理 UI/API** | 新增 API 暴露既有 `CityAccessService`，用戶管理頁加面板接它。`withCityFilter` / `getUserCityCodes` 核心**不動** | ❌ 不觸發（service 已存在，僅補對外暴露 + UI） | 風險低、改動聚焦、與既有資料模型一致；缺點是仍有 `UserRole.cityId` 與 `UserCityAccess` 雙軌（靠 OQ-2 釐清） |
| **B 統一資料來源** | 讓 `getUserCityCodes` 也認 `UserRole.cityId`，或讓 admin UI 城市欄位改寫 `UserCityAccess` | ✅ **觸發 H1**（改權限判斷核心邏輯 / 既有資料語意） | 消除雙軌；但動到 auth/權限核心，影響面大、需嚴格回歸與既有資料相容性驗證 |

> **建議採方向 A**：成本最低、風險最小，且因 service 層已完備，主要是「補洞」而非「改架構」。`UserRole.cityId` 的誤導問題以 OQ-2 處理（移除欄位或改為唯讀說明）。

### 既有可複用資產（已確認存在）

| 資產 | 位置 | 能力 |
|------|------|------|
| `CityAccessService.grantAccess` | `src/services/city-access.service.ts:268` | upsert `UserCityAccess` + 審計 GRANT |
| `CityAccessService.revokeAccess` | `src/services/city-access.service.ts:~350` | 刪 `UserCityAccess` + 審計 REVOKE |
| `CityAccessService.setPrimaryCity` | `src/services/city-access.service.ts:~400` | 設主要城市 |
| `CityAccessService.getUserCityAccesses` | `src/services/city-access.service.ts:221` | 回 `CityAccessInfo[]` |
| `CitySelector` 組件 | `src/components/features/admin/CitySelector.tsx` | 城市選擇 UI |
| `useCities` hook | `src/hooks/use-cities.ts` | 城市列表 |

### 修改範圍（依方向 A）

| 文件 | 類型 | 變更內容 |
|------|------|----------|
| `src/app/api/admin/users/[id]/city-access/route.ts` | 🆕 新增 | `GET`（列該用戶城市權限）、`POST`（授予：body `{ cityCode, isPrimary?, accessLevel?, expiresAt?, reason? }`）；皆 `USER_MANAGE` 權限 + Zod 驗證 + RFC 7807 |
| `src/app/api/admin/users/[id]/city-access/[cityCode]/route.ts` | 🆕 新增 | `DELETE`（撤銷指定城市）、`PATCH`（設為主要城市） |
| `src/lib/validations/user.schema.ts` | 🔧 修改 | 新增 `grantCityAccessSchema` / `cityAccessQuerySchema` |
| `src/services/user.service.ts` | 🔧 修改（視 OQ-2） | 若移除誤導欄位：`updateUserWithRoles` / `createUser` 不再以 `cityId` 寫 `UserRole.cityId`（或保留但僅供 City Manager scope，加註解） |
| `src/components/features/admin/UserCityAccessPanel.tsx` | 🆕 新增 | 列出/新增/移除用戶城市權限 + 設主要城市，複用 `CitySelector`、`CityAccessService` API |
| `src/components/features/admin/EditUserDialog.tsx` | 🔧 修改 | 嵌入 `UserCityAccessPanel`；「城市」欄位依 OQ-2 移除或改唯讀說明（標示其僅為 City Manager 管理範圍、非資料存取權限） |
| `src/components/features/admin/AddUserDialog.tsx` | 🔧 修改 | 同上（建立後可在編輯時指派城市權限，或建立流程一併支援） |
| `src/hooks/use-user-city-access.ts` | 🆕 新增 | React Query hooks：list / grant / revoke / setPrimary |
| `messages/{en,zh-TW,zh-CN}/admin.json` | 🔧 修改 | `users.cityAccess.*`（標題/授予/撤銷/主要城市/說明/Toast/誤導欄位釐清文案） |

### i18n 影響

> **🔴 H5 觸發**：新增顯示字串必須 en / zh-TW / zh-CN 三語同步，完成後執行 `npm run i18n:check`。

| 語言 | 文件 | 需要更新的 Key（前綴 `users.cityAccess.`） |
|------|------|---------------------------------------------|
| en | `messages/en/admin.json` | `title` / `grant` / `revoke` / `setPrimary` / `primary` / `empty` / `accessLevel` / `expiresAt` / `reason` / `description`（釐清資料存取 vs 管理範圍）/ `toast.*` |
| zh-TW | `messages/zh-TW/admin.json` | 同上（繁中） |
| zh-CN | `messages/zh-CN/admin.json` | 同上（簡中） |

> `admin` 命名空間已存在並註冊於 `src/i18n/request.ts`，**無需**新增命名空間。

### 資料庫影響

- **方向 A：無 schema 變更**（`UserCityAccess` 表已存在，service 已能讀寫）。
- 方向 B 亦無新增表，但會改變 `getUserCityCodes` 讀取邏輯（程式層，非 schema）。

---

## 設計決策

1. **採方向 A（補 UI/API 暴露既有 service）** — service 層與組件皆已完備，補洞成本最低、不動權限核心邏輯，**不觸發 H1**。方向 B 改 auth/權限核心 → 觸發 H1，列為備選待用戶明確要求。

2. **權限保護** — 城市權限管理 API 受 `USER_MANAGE` 保護，並沿用 `checkCityEditPermission`（City Manager 只能管自己城市範圍的用戶／授權）；globalAdmin 不受限。

3. **審計** — 複用 `CityAccessService` 既有的 GRANT/REVOKE 審計日誌，無需另寫。

4. **session 刷新提醒** — 城市權限存於 JWT/session（`auth.ts` jwt callback 計算 `cityCodes`），**被授權的用戶需重新登入**才生效。此限制需在 UI 上對管理者明示（與本次 corrie.lai globalAdmin 同樣行為）。

5. **誤導性「城市」欄位** — `UserRole.cityId` 並非無用（供 City Manager 管理範圍 `checkCityEditPermission`），但放在用戶表單會被誤解為資料存取權限。處理方式待 OQ-2 確認（移除 / 改唯讀標註 / 保留但加說明）。

---

## 影響範圍評估

### 文件影響清單（方向 A）

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/app/api/admin/users/[id]/city-access/route.ts` | 🆕 新增 | GET list + POST grant |
| `src/app/api/admin/users/[id]/city-access/[cityCode]/route.ts` | 🆕 新增 | DELETE revoke + PATCH setPrimary |
| `src/lib/validations/user.schema.ts` | 🔧 修改 | grant / query schema |
| `src/services/user.service.ts` | 🔧 修改（視 OQ-2） | 城市欄位語意調整 |
| `src/components/features/admin/UserCityAccessPanel.tsx` | 🆕 新增 | 城市權限管理面板 |
| `src/components/features/admin/EditUserDialog.tsx` | 🔧 修改 | 嵌入面板 + 處理誤導欄位 |
| `src/components/features/admin/AddUserDialog.tsx` | 🔧 修改 | 同上 |
| `src/hooks/use-user-city-access.ts` | 🆕 新增 | React Query hooks |
| `messages/{en,zh-TW,zh-CN}/admin.json` | 🔧 修改 | `users.cityAccess.*` |

### 向後兼容性

- **資料庫**：無 schema 變更（方向 A），既有 `UserCityAccess` / `UserRole` 資料不動。
- **既有權限**：`withCityFilter` / `getUserCityCodes` 邏輯不動，現有 globalAdmin / 有城市權限用戶行為零變化。
- **誤導欄位處理**：若移除 UI「城市」欄位，需確認沒有依賴 `UserRole.cityId` 的 City Manager 流程被破壞（`checkCityEditPermission` 仍可運作）。
- **i18n**：僅在現有 `admin` 命名空間新增 key。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 授予城市權限 | admin 在用戶管理面板給某用戶授予城市 → `UserCityAccess` 新增記錄 + 審計 GRANT | High |
| 2 | 解除 403 | 被授予城市權限的用戶**重新登入後**，dashboard 統計等城市過濾 API 不再 403、且只看到授權城市資料 | High |
| 3 | 撤銷城市權限 | 移除某城市 → `UserCityAccess` 刪除 + 審計 REVOKE；用戶重新登入後失去該城市資料 | High |
| 4 | 設主要城市 | 設定主要城市 → `isPrimary` 正確切換（其他城市取消主要） | Medium |
| 5 | 列出城市權限 | 面板正確顯示該用戶目前所有城市權限與主要城市標記 | High |
| 6 | 權限保護 | 無 `USER_MANAGE` 權限者呼叫 API 回 403；City Manager 僅能管自己範圍 | High |
| 7 | 誤導欄位釐清 | 用戶表單不再讓管理者誤以為「設城市＝給資料權限」（依 OQ-2 結果驗收） | High |
| 8 | i18n | 三語顯示正確，`npm run i18n:check` 通過，無 IntlError | High |
| 9 | 型別 / lint | `npm run type-check` + `npm run lint` 通過無 warning | High |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 新用戶無城市權限 403 | 建立一般用戶（非 globalAdmin、無城市權限）登入看 dashboard | 統計 API 回 403「未被分配城市權限」（重現缺口） |
| 2 | 授予城市後解除 403 | admin 在面板授予該用戶 HKG → 用戶登出重登 → 看 dashboard | 不再 403，僅顯示 HKG 城市資料 |
| 3 | 多城市 | 授予 HKG + SIN | 重登後可見兩城市資料；面板顯示兩筆，主要城市標記正確 |
| 4 | 撤銷 | 移除 SIN | 重登後 SIN 資料消失；審計有 REVOKE |
| 5 | 設主要城市 | 將 SIN 設為主要 | HKG 取消主要、SIN 為主要 |
| 6 | 權限保護 | 以非 USER_MANAGE 帳號呼叫 city-access API | 403 RFC 7807 |
| 7 | City Manager 範圍 | City Manager 嘗試授予非自己城市的權限 | 被 `checkCityEditPermission` 擋下 |
| 8 | session 未刷新提醒 | 授予權限後不登出直接刷新 | 仍 403（預期）；UI 有「需重新登入」提示 |
| 9 | i18n 三語 | 切換 en/zh-TW/zh-CN 檢視面板 | 三語正確、無 IntlError |

---

## Hard Constraint 自檢

| 約束 | 是否觸發 | 說明 |
|------|----------|------|
| **H1** 架構 | ⚠️ 視方向 | **方向 A 不觸發**（補 API/UI 暴露既有 service，不動權限判斷核心）；**方向 B 觸發**（改 `getUserCityCodes`/權限核心邏輯或既有資料語意），須先取得用戶 approve |
| **H2** 依賴 | ❌ 不觸發 | 無新套件、不換 vendor |
| **H3** 範圍 | ✅ 範圍內 | 圍繞「城市權限管理 UI/API」缺口；區域權限（UserRegionAccess）列為 OQ-3 待確認是否納入，不擅自擴張 |
| **H4** 安全 | ⚠️ 需注意 | 新 API 必須 `USER_MANAGE` 權限 + City Manager scope 檢查（避免越權授權＝權限提升風險）；審計沿用既有 GRANT/REVOKE |
| **H5** i18n | 🔴 觸發 | 新增顯示字串，三語同步 + `npm run i18n:check` |
| **H6** 設計偏離 | ⚠️ 需確認 | 移除/改動既有「城市」欄位屬 UX 變更，依 OQ-2 用戶確認後實作，不擅自 approximate |

---

## Open Questions

| 編號 | 問題 | 狀態 | 預設處理 |
|------|------|------|----------|
| **OQ-1** | 採**方向 A**（補 UI/API、不動核心，推薦）還是**方向 B**（統一資料來源、觸發 H1）？ | ⏳ 待用戶確認 | 預設 A；未確認前不進實作 |
| **OQ-2** | 用戶表單既有「城市」下拉（寫 `UserRole.cityId`）如何處理？(a) 移除 (b) 改唯讀並標註「僅 City Manager 管理範圍、非資料存取」 (c) 保留現狀僅加說明 | ⏳ 待用戶確認 | 預設 (b) |
| **OQ-3** | 是否一併補 `UserRegionAccess` / `isRegionalManager`（區域層級）的管理 UI？還是本 CHANGE 只做城市層級、區域另立 CHANGE？ | ⏳ 待用戶確認 | 預設「只做城市，區域另立」 |
| **OQ-4** | 是否同時提供「設 globalAdmin」的 UI（避免未來又要靠 DB script）？ | ⏳ 待用戶確認 | 預設不在本 CHANGE（globalAdmin 屬高權限，另行評估） |

---

## 備註

- 本 CHANGE 由 2026-06-23 corrie.lai 登入問題排查衍生（FIX-092 解登入郵件驗證、grant-global-admin script 繞過城市機制；本 CHANGE 補上根因——缺城市權限管理面）。
- 實作前須先解決 OQ-1（方向）與 OQ-2（誤導欄位）；OQ-3/OQ-4 可決定範圍邊界。
