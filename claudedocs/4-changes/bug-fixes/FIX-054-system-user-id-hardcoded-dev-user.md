# FIX-054: SYSTEM_USER_ID 硬編碼為 'dev-user-1' 導致生產部署風險

> **建立日期**: 2026-04-21
> **發現方式**: 新環境部署可靠性 session 討論（延伸自 `/en/documents` 頁面崩潰修復）
> **影響頁面/功能**: 公司自動建立、批次處理、SharePoint/Outlook 文件抓取、Issuer Identification 預設值
> **優先級**: 🔴 高（生產部署風險）
> **狀態**: ✅ 已修復（2026-04-22）
> **類型**: 設計缺陷修復
> **關聯**: CHANGE-054（新環境部署可靠性強化）

---

## 問題描述

`src/services/company-auto-create.service.ts:103` 將 `SYSTEM_USER_ID` 常量硬編碼為 `'dev-user-1'`，這個命名語義暗示「開發專用」，但實際上是**生產代碼的系統級依賴**——多個服務在寫入資料庫時以此為 `createdById`（外鍵參照 `users.id`）。若新環境未建立此用戶或生產環境刪除該用戶，將觸發 FK 違規讓多個核心服務崩潰。

### 硬編碼依賴證據表

| # | 檔案 | 行 | 依賴方式 | 失效後果 |
|---|------|----|---------|---------|
| 1 | `src/services/company-auto-create.service.ts` | 103 | `export const SYSTEM_USER_ID = 'dev-user-1'` | 🔴 常量源頭 |
| 2 | `src/services/batch-processor.service.ts` | 76, 289, 382, 753 | `createdById: SYSTEM_USER_ID` / `userId: SYSTEM_USER_ID` | 🔴 批次處理寫入 FK 違規 |
| 3 | `src/services/sharepoint-document.service.ts` | 407, 439 | `process.env.SYSTEM_USER_ID` 覆蓋，否則拋「找不到系統用戶」 | 🟡 支援 env，但需配置 |
| 4 | `src/services/outlook-document.service.ts` | 660, 689 | 同 #3 | 🟡 同 #3 |
| 5 | `src/types/issuer-identification.ts` | 350 | `createdById: 'dev-user-1'` // FIX-028 註釋 | 🔴 Issuer 識別預設值 FK 違規 |
| 6 | `src/lib/auth.config.ts` | 141 | Dev mode 登入 mock `id: 'dev-user-1'` | 🟢 Dev 登入，非生產依賴 |
| 7 | `src/lib/auth.ts` | 352 | DEV_MOCK_SESSION 用 `'dev-user-1'` | 🟢 同 #6 |
| 8 | `prisma/seed.ts` | 423-443 | Seed upsert `id: 'dev-user-1', email: 'dev@example.com'` | 🔴 部署必跑，否則 #1-5 全崩 |

### Seed 現有兩個「系統級」用戶的混亂

`prisma/seed.ts` 在第 385-445 行實際建立了兩個用戶：

| 順序 | 位置 | Email | ID | 內部 seed 用途 | 運行時用途 |
|------|------|-------|-----|--------------|-----------|
| A | L397 | `system@ai-document-extraction.internal` | **自動 UUID** | Seed 內 `creator.connect` 建立公司/警報規則（L511, L1042, L1147） | **無** — 運行時服務層找不到此 ID |
| B | L423 | `dev@example.com` | **固定 `'dev-user-1'`** | 無 | **是** — 所有 `SYSTEM_USER_ID` 依賴都指向這裡 |

命名語義（`system@...internal` 比 `dev@example.com` 更像系統用戶）與實際用途**完全反過來**，造成認知負擔與部署陷阱。

---

## 重現步驟

### 情境 1：新環境跳過或中斷 seed

```bash
npx prisma db push --accept-data-loss   # schema 同步
# 若跳過下一步，或 seed.ts 執行中途失敗（例如 L423 之前）
npx prisma db seed
```

啟動應用並觸發 SharePoint 文件抓取：
```
Error: Foreign key constraint violation on companies.createdById → users.id
  (users.id = 'dev-user-1' 不存在)
```

### 情境 2：生產環境安全清理

生產 DBA 看到 `dev@example.com` 帳號認為是殘留測試資料，執行 `DELETE FROM users WHERE email = 'dev@example.com'`：

- ❌ 公司自動建立失敗
- ❌ 批次處理（排程任務）崩潰
- ❌ SharePoint/Outlook 文件抓取崩潰
- ❌ Issuer Identification FIX-028 預設路徑崩潰

### 情境 3：SharePoint/Outlook 服務已支援但其他服務未支援

```env
# .env 設定
SYSTEM_USER_ID="some-real-user-uuid"
```

- ✅ SharePoint/Outlook 服務讀到 env → 用 `some-real-user-uuid`
- ❌ `company-auto-create` / `batch-processor` / `issuer-identification` 仍硬編碼 `'dev-user-1'` → 不一致

---

## 根本原因

### 設計演進歷史推測

1. 早期 seed 建立了 `systemUser`（自動 UUID）作為 Company Creator
2. `SystemAdmin` 級操作（批次處理、外部 API 抓取）需要 `createdById`，但 `systemUser.id` 不固定 → 無法寫成常量
3. 當時快速解決：建立固定 ID 的 `dev-user-1` 並硬編碼為 `SYSTEM_USER_ID`
4. 後續 SharePoint/Outlook 服務意識到部署彈性問題，加入 `process.env.SYSTEM_USER_ID` 覆蓋，但 `company-auto-create` 和 `batch-processor` 未同步更新

### 關鍵觀察

- **命名矛盾**：`dev-user-1` 命名明顯是 dev 用途，但服務層誤用為生產系統 ID
- **常量可變性缺失**：4 個服務之中只有 2 個支援 env 覆蓋
- **兩個 systemUser 並存**：`system@...internal`（seed 內部用）與 `dev@example.com`（運行時用）語義互換，維運時容易混淆
- **Seed 與服務層耦合**：服務層假設 seed 一定會建立 `dev-user-1`，但未在程式啟動時驗證

---

## 解決方案（採用方案 H：固定 ID + env 可覆蓋）

### 設計方針

1. **重新建立「真正系統用戶」** — 在 seed 中給 `systemUser` 固定 ID `'system-user-1'`，讓 email 與 ID 的語義對齊
2. **統一常量策略** — 所有 `SYSTEM_USER_ID` 依賴都改讀 `process.env.SYSTEM_USER_ID ?? 'system-user-1'`
3. **向後相容 dev 登入** — `dev-user-1` 保留作為純粹的 dev mode 登入 mock（`auth.config.ts` / `auth.ts` 不動）
4. **既有環境無需動 DB** — 既有環境只需在 `.env` 設 `SYSTEM_USER_ID=<現有 systemUser UUID>`，不必執行 FK 級資料遷移

### 實作步驟

**Step 1**：`prisma/seed.ts` L397 — 為 `systemUser` 加上固定 ID

```typescript
const SYSTEM_USER_FALLBACK_ID = process.env.SYSTEM_USER_ID ?? 'system-user-1'

const systemUser = await prisma.user.upsert({
  where: { id: SYSTEM_USER_FALLBACK_ID },  // 改用 id 查詢（原本是 email）
  update: {
    name: 'System',
    status: 'ACTIVE',
  },
  create: {
    id: SYSTEM_USER_FALLBACK_ID,            // 新增：固定 ID
    email: 'system@ai-document-extraction.internal',
    name: 'System',
    status: 'ACTIVE',
    roles: {
      create: { roleId: systemAdminRole.id },
    },
  },
})
```

**Step 2**：`src/services/company-auto-create.service.ts:103` — 常量改為可覆蓋

```typescript
// 變更前
export const SYSTEM_USER_ID = 'dev-user-1'

// 變更後
export const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID ?? 'system-user-1'
```

**Step 3**：`src/types/issuer-identification.ts:350` — 匯入共用常量

```typescript
// 變更前
createdById: 'dev-user-1', // FIX-028: 使用有效的系統用戶 ID

// 變更後
import { SYSTEM_USER_ID } from '@/services/company-auto-create.service'
// ...
createdById: SYSTEM_USER_ID, // FIX-028 + FIX-054
```

**Step 4**：`src/services/sharepoint-document.service.ts` + `outlook-document.service.ts` — **不變動**（兩者已支援 env 覆蓋，語義與 Step 2 一致）

**Step 5**：`src/lib/auth.config.ts` + `src/lib/auth.ts` — **不變動**（dev mock session 繼續用 `'dev-user-1'`，與 `SYSTEM_USER_ID` 解耦）

**Step 6**：`.env.example` — 新增 `SYSTEM_USER_ID` 註解

```env
# System User ID for server-side operations (company auto-create, batch processing,
# SharePoint/Outlook document fetching, issuer identification defaults).
# Default: "system-user-1" (seeded by prisma/seed.ts).
# Override for existing deployments where systemUser has a different UUID.
SYSTEM_USER_ID="system-user-1"
```

**Step 7**：遷移指引（在本 FIX 文件內提供）

既有開發環境操作：
```bash
# 1. 查詢既有 systemUser 的 UUID
psql "$DATABASE_URL" -c "SELECT id FROM users WHERE email = 'system@ai-document-extraction.internal';"

# 2. 將查到的 UUID 寫入 .env
echo "SYSTEM_USER_ID=<查到的 UUID>" >> .env

# 3. 啟動應用，服務層會讀到 env 並指向既有用戶 — 無需動資料
```

全新環境操作：
```bash
# 直接跑 seed，systemUser 會以固定 ID 'system-user-1' 建立
npx prisma db seed
# 應用不需設 SYSTEM_USER_ID（讀到 fallback 'system-user-1'）
```

---

## 修改的檔案（實際）

| 檔案 | 變更內容 | 實際行數 |
|------|---------|---------|
| `prisma/seed.ts` | L381-L414：`systemUser.upsert` 改用 `SYSTEM_USER_SEED_ID`（`process.env.SYSTEM_USER_ID ?? 'system-user-1'`）為查詢鍵與 create `id` | +7 -3 |
| `src/services/company-auto-create.service.ts` | L103：常量改為 `process.env.SYSTEM_USER_ID ?? 'system-user-1'` + 更新 JSDoc 說明 | +7 -1 |
| `src/types/issuer-identification.ts` | L350：`createdById` 硬編碼改為 `process.env.SYSTEM_USER_ID ?? 'system-user-1'` + 新增 `@remarks` 註解 | +6 -1 |
| `.env.example` | L78-L89：新增 `SYSTEM_USER_ID` 區塊（含 FIX-054 說明、既有/全新環境指引） | +12 |
| `src/services/sharepoint-document.service.ts` | **不變** | 0 |
| `src/services/outlook-document.service.ts` | **不變** | 0 |
| `src/lib/auth.config.ts` | **不變** | 0 |
| `src/lib/auth.ts` | **不變** | 0 |

### 為何 `issuer-identification.ts` 沒有匯入 `SYSTEM_USER_ID` 常量

原規劃中 Step 3 想用 `import { SYSTEM_USER_ID } from '@/services/company-auto-create.service'`。
實作時改為內聯 `process.env.SYSTEM_USER_ID ?? 'system-user-1'`（完整遷移指引見 `docs/06-deployment/01-local-deployment/cross-computer-workflow.md` §FIX-054 SYSTEM_USER_ID 跨電腦遷移），理由：

- `issuer-identification.ts` 屬於 `src/types/`（類型定義層），避免反向依賴 `src/services/`（業務邏輯層）
- 避免潛在的 circular import 風險
- 代碼形式與 `company-auto-create.service.ts:103` 完全對稱，語義與行為一致

---

## 測試驗證

### 自動化檢查（已完成）

- [x] `npx tsc --noEmit` 對 FIX-054 修改的 3 個檔案無新錯誤（2026-04-22）
  - 既存 `@types/jest` 相關錯誤不屬於本 FIX 範圍
- [ ] `npm run lint` — 待執行

### 全新環境驗證（待執行）

- [ ] 刪除本地資料庫或使用 Docker volume reset
- [ ] 執行 `npx prisma db push --accept-data-loss && npx prisma db seed`
- [ ] 查詢確認：`SELECT id, email FROM users WHERE id = 'system-user-1';` 返回一筆
- [ ] 查詢確認：`SELECT id, email FROM users WHERE id = 'dev-user-1';` 返回一筆（dev 登入用）
- [ ] 觸發公司自動建立流程（上傳新公司文件）→ 無 FK 違規
- [ ] 觸發批次處理 → 無 FK 違規

### 既有環境（env 覆蓋）驗證（待執行）

> **本機環境操作指引（待 Docker 恢復後執行）**
>
> 1. 確認 Docker 引擎正常運行並啟動 `ai-doc-extraction-db` 容器
> 2. 查詢既有 `systemUser.id`：
>    ```bash
>    docker exec ai-doc-extraction-db psql -U postgres -d ai_document_extraction \
>      -c "SELECT id, email FROM users WHERE email = 'system@ai-document-extraction.internal';"
>    ```
>    或透過 Node.js：
>    ```bash
>    node -e "require('dotenv').config(); const {Pool}=require('pg'); \
>      const p=new Pool({connectionString:process.env.DATABASE_URL}); \
>      p.query(\"SELECT id,email FROM users WHERE email='system@ai-document-extraction.internal'\") \
>      .then(r=>{console.log(r.rows);p.end();});"
>    ```
> 3. 將查到的 UUID 加入本機 `.env`（取代 `.env.example` 預設的 `system-user-1`）：
>    ```env
>    SYSTEM_USER_ID="<查到的現有 UUID>"
>    ```
> 4. 重啟 dev server，服務層會讀到 env 並指向既有用戶 — 無需動資料庫

- [ ] 設定 `SYSTEM_USER_ID=<既有 systemUser.id>`
- [ ] 重啟服務，觸發公司自動建立 → `createdById` 寫入 env 指向的 UUID
- [ ] 不執行 seed，既有資料不變

### Dev mode 登入驗證（待執行）

- [ ] 未設 Azure AD，`NODE_ENV=development` 下以任意 email 登入
- [ ] Session `user.id` 仍為 `'dev-user-1'`
- [ ] Dev 模式下的導航與權限檢查正常

---

## 關聯文件

- **CHANGE-054**: 新環境部署可靠性強化 — 本 FIX 完成後，`.env.example` 變更會併入 CHANGE-054 的 env 重寫；`verify-environment.ts` 自檢腳本會加上「SYSTEM_USER_ID 指向的 User 存在」檢查
- **FIX-028**: Issuer Identification FK 約束修復 — 當初將 `createdById` 改為 `'dev-user-1'` 的歷史原因，本 FIX 將其抽為常量
- **既有 env 行為**: `src/services/sharepoint-document.service.ts:407-408` 與 `outlook-document.service.ts:660-661` 已實作的 `process.env.SYSTEM_USER_ID` 覆蓋模式，本 FIX 將此模式擴展到所有相關服務

---

## 風險提示

- **既有 session 需重啟**：改常量宣告後，已在記憶體中的 `SYSTEM_USER_ID` 值需要重啟服務才會讀到新值
- **既有環境若直接跑新 seed** 而未設 `SYSTEM_USER_ID`：seed 會用 `id: 'system-user-1'` 嘗試 upsert — 若該 ID 不存在則 create 新用戶；舊的 `system@...internal` UUID 仍保留但被孤立。建議既有環境先執行 Step 7 的遷移指引後再跑新 seed
- **Dev 登入不受影響**：`dev-user-1` 與 `dev@example.com` 的 seed 區塊完全保留，`auth.config.ts` / `auth.ts` 的 dev mock 邏輯不動
- **batch-processor 的 `userId: SYSTEM_USER_ID`**（L289）：批次建立的 audit log 會從「dev-user-1」變成「system-user-1」(或 env 值)，過往歷史記錄不會回填

---

## 業務決策記錄

用戶於 2026-04-21 確認採用方案 **H**（相對於方案 G 的固定 ID 無 env 覆蓋、方案 H'/H'' 的動態讀 DB）。理由：

1. **避開資料遷移風險**：既有環境只需設 env，不必執行 `UPDATE users SET id = ...` + 級聯更新所有 FK
2. **生產彈性**：企業可在生產環境設 `SYSTEM_USER_ID` 為任意現有用戶 ID，不必強制出現 `system-user-1` 字串
3. **向後相容**：dev 登入行為完全保留
4. **命名正確性**：新環境的 `systemUser.id` 將與 email 語義一致（`system@...`）

備選方案對比：

| 方案 | 做法 | 為何不選 |
|------|------|---------|
| A | 全部 hardcoded → 全部讀 env，但 fallback 仍 `'dev-user-1'` | ✅ 可行但保留誤導命名 |
| B | 重命名 seed 中的 `dev-user-1` → `system-user-1`（整體替換） | 既有 DB FK 遷移風險高 |
| G | H 但不提供 env 覆蓋 | 鎖定 `system-user-1`，既有環境無彈性 |
| H | **固定 ID + env 可覆蓋（本選）** | ✅ |
| H'' | 移除固定 ID 常量，改由服務層動態查詢 `User.findFirst({ email: 'system@...' })` | 啟動時多 DB 查詢；需處理快取失效 |

---

*文件建立日期: 2026-04-21*
*最後更新: 2026-04-22（已完成代碼修改並通過 TypeScript 檢查，待真實環境驗證）*
