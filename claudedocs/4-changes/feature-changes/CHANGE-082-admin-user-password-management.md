# CHANGE-082: Admin 用戶密碼管理（設定初始密碼 + 重設密碼）

> **日期**: 2026-06-17
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Feature（擴充本地帳號認證）
> **影響範圍**: `/admin/users` 用戶管理（schema / API / service / UI / i18n）

---

## 變更背景

Admin 在 `/admin/users` 建立用戶後，無法設定或修改其密碼。根因：原設計假設用戶走 Azure AD SSO（`createUserSchema` 註解「email 必須與 Azure AD 帳號一致」）：

- `createUserSchema` / `updateUserSchema` 皆**無 password 欄位**（`user.schema.ts:40-113`）。
- `PATCH /api/admin/users/[id]` 明確只更新 name / roleIds / cityId（`[id]/route.ts:319-323`）。
- 唯一密碼端點 `/api/v1/users/me/password` 只能改**自己**、需舊密碼、且擋 Azure AD 用戶。

本地帳號密碼原本只能靠自助註冊（Epic 18 `/auth/register`）或忘記密碼重設取得。User model 已有 `password` / `mustChangePassword` 欄位（FIX-074 用過），底層基礎齊全，**僅缺 admin 端的設定 / 重設介面與 API**。

## 變更內容

### 1. 建立用戶時設定初始密碼

`createUserSchema` 新增**可選** `password`；`createUser` service 若有 password 則 `hashPassword` 後寫入；`AddUserDialog` 新增密碼欄（可選）。未填則維持現狀（Azure AD 用戶向後相容）。

### 2. Admin 重設既有用戶密碼

新增 `PATCH /api/admin/users/[id]/password`（admin 直接設新密碼，**不需舊密碼**，需 USER_MANAGE + 城市權限）；新增 `adminResetPassword` service；`EditUserDialog` 新增「重設密碼」區塊。

---

## 技術設計

### 修改範圍

| 文件 | 類型 | 變更內容 |
|------|------|----------|
| `src/lib/validations/user.schema.ts` | 🔧 修改 | `createUserSchema` 加可選 `password`；新增 `adminResetPasswordSchema`（newPassword + confirmPassword + refine 相符） |
| `src/services/user.service.ts` | 🔧 修改 | `createUser` 若有 password 則 `hashPassword` 寫入 `tx.user.create`；新增 `adminResetPassword(userId, newPassword, adminId)`（擋 Azure AD、`validatePasswordStrength`、審計但不記密碼明文） |
| `src/app/api/admin/users/route.ts` | ⚪ 無需修改 | POST 透過 `{ ...validationResult.data }` 自動透傳 password（schema 已含），無需改動程式碼 |
| `src/app/api/admin/users/[id]/password/route.ts` | 🆕 新增 | PATCH：認證 + USER_MANAGE + `checkCityEditPermission` + Zod 驗證 + 呼叫 `adminResetPassword` |
| `src/components/features/admin/AddUserDialog.tsx` | 🔧 修改 | 新增可選密碼欄（+ 強度提示） |
| `src/components/features/admin/EditUserDialog.tsx` | 🔧 修改 | 新增「重設密碼」欄位 + 送出 |
| `src/hooks/use-users.ts` | 🔧 修改 | 新增 `useResetUserPassword` mutation；建立 mutation 帶 password |
| `messages/en/admin.json` | 🔧 修改 | 密碼欄 / 重設密碼 / 強度提示 / 成功訊息 key |
| `messages/zh-TW/admin.json` | 🔧 修改 | 同上（繁中） |
| `messages/zh-CN/admin.json` | 🔧 修改 | 同上（簡中） |

### i18n 影響

| 語言 | 文件 | 需要更新的 Key（前綴 `users.`） |
|------|------|---------------------------------|
| en | `messages/en/admin.json` | `addDialog.password*`、`resetPassword.*`（label / placeholder / help / submit / success / azureAdBlocked） |
| zh-TW | `messages/zh-TW/admin.json` | 同上 |
| zh-CN | `messages/zh-CN/admin.json` | 同上 |

> 確切 key 命名於實作時依 `AddUserDialog` / `EditUserDialog` 既有 namespace 結構定案；完成前執行 `npm run i18n:check`。

### 資料庫影響

無。`User.password`（nullable）與 `User.mustChangePassword` 欄位已存在，**不需 Prisma migration**。

### 安全與重用

- 重用 `src/lib/password.ts` 的 `hashPassword` / `validatePasswordStrength` / `PASSWORD_REQUIREMENTS`（**不新增依賴**，符合 H2）。
- Azure AD 用戶（`azureAdId != null`）一律擋下，回 RFC 7807 400（與 `me/password` 一致）。
- 審計日誌記錄重設動作，但 **metadata 絕不含密碼明文**（H4）；logger 亦不得輸出密碼。

---

## 設計決策

1. **重設不需舊密碼** — admin 權限操作，只驗 USER_MANAGE + 城市範圍（沿用既有 `checkCityEditPermission`，與 `[id]` PATCH 一致）。
2. **初始密碼可選** — 向後相容，Azure AD 用戶仍可不設密碼建立。
3. **錯誤格式** — 新端點沿用 `/admin/users` 既有 nested `{ success, error }` 格式（模組內一致 + 既有 dialog 錯誤處理相容）；偏離「新 API 統一 top-level」指引，屬模組一致性取捨，記為 OQ（後續隨模組整體遷移）。
4. **不含** 強制首次改密（`mustChangePassword` 維持 false）與寄送重設連結 — 依用戶選擇排除。

## 影響範圍評估

### 向後兼容性

- `password` 為可選 → 既有建立流程不受影響。
- 不改 Prisma schema（欄位已存在）→ 無 migration、無資料遷移風險。
- 不動 `me/password` 自助改密與 Epic 18 註冊/忘記密碼流程。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 建立用戶時設密 | 填密碼建立後，該用戶可用該密碼登入（本地帳號） | High |
| 2 | 重設密碼 | admin 在 EditUserDialog 設新密碼後，用戶可用新密碼登入 | High |
| 3 | 強度驗證 | 弱密碼（<8 / 無大小寫數字）被擋並顯示錯誤訊息 | High |
| 4 | Azure AD 擋下 | 對 `azureAdId` 用戶重設 → 400「密碼由 Azure AD 管理」 | High |
| 5 | 權限 | 無 USER_MANAGE / 跨城市操作 → 403 | High |
| 6 | i18n | 3 語言齊全，`npm run i18n:check` 通過 | Medium |
| 7 | 安全 | 審計日誌與 logger 均無密碼明文 | High |
| 8 | 品質 | `npm run type-check` + `npx eslint` 0 errors | High |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 建立含密碼用戶 | AddUserDialog 填 email/name/role + 密碼 `Test1234` → 建立 → 用該帳密登入 | 登入成功 |
| 2 | 建立不含密碼用戶 | 同上但不填密碼 → 建立 | 建立成功（向後相容），無本地密碼 |
| 3 | 重設密碼 | EditUserDialog 對既有本地用戶設 `New1234` → 用新密碼登入 | 登入成功 |
| 4 | 弱密碼 | 重設填 `123` | 顯示強度錯誤，未更新 |
| 5 | Azure AD 用戶重設 | 對 `azureAdId` 用戶重設 | 400「密碼由 Azure AD 管理」 |
| 6 | 權限不足 | 非 USER_MANAGE 用戶呼叫端點 | 403 |

---

## 實作備註

- **schema 不使用 `.transform`**：原規劃為 `password` 加 `.transform('' → undefined)`，但 transform 會使 Zod schema 的輸入/輸出型別分歧，破壞 `react-hook-form` 的 `zodResolver` 泛型對齊（type-check 報 TFieldValues 不符）。改為 `z.union([strongPassword, z.literal('')]).optional()`（不 transform），空字串於服務層以 `if (password)` 視為不設密碼。
- **route.ts 無需改動**：POST 透過既有 `{ ...validationResult.data }` 自動透傳 password。
- **EditUserDialog 用兩個獨立 `<form>`**：主編輯表單與重設密碼表單為 DialogContent 內的並列 sibling（避免巢狀 `<form>` 的無效 HTML）。
- **驗證結果**：`npm run type-check` 通過；`npx eslint`（6 檔）0 問題；`npm run i18n:check` 通過；3 語言 admin.json JSON 合法且 8 個新 key 齊全。

*文件建立日期: 2026-06-17*
*最後更新: 2026-06-17*
