# FIX-071: 成本型 DoS — 昂貴 AI/OCR 端點補速率限制、檔案大小上限與 MIME magic byte 驗證

> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `/api/v1/prompt-configs/test`、`/api/admin/document-preview-test/extract`、`/api/test/extraction-v2`、`/api/test/extraction-compare`、`/api/analytics/city-comparison`
> **優先級**: 高（成本型 DoS，P1）
> **狀態**: ✅ 核心已完成（2026-06-11，程式碼層面；BUG-3 dev-only 端點依範圍判斷略過；執行期 staging 驗證待部署）
> **來源**: SECURITY-ASSESSMENT.md §5 主題 E、§6 模式 7、REMEDIATION-ROADMAP.md WP-9
> **相依**: 與 FIX-066（test 端點生產禁用）部分重疊，本 FIX 聚焦 rate limit + 檔案上限 + MIME 驗證

---

## 問題描述

多個昂貴的 AI/OCR 端點（觸發 Azure Document Intelligence + Azure OpenAI GPT Vision）缺乏成本濫用防護：無速率限制、無（或不一致的）檔案大小上限、MIME 類型僅依賴客戶端宣告的 `file.type`（可偽造）。未授權或低權限呼叫者可無限次呼叫，造成 Azure OpenAI/DI 帳單暴增（financial DoS）、暫存磁碟耗盡與運算資源耗盡，並等同把公司付費的 LLM/OCR 能力當成免費代理對外提供。

| # | 問題 | 嚴重度 | 端點:行 |
|---|------|--------|---------|
| BUG-1 (K-01) | POST 完全無認證、無速率限制、無每使用者配額，直接觸發 `scale: 2` PDF→最多 10 張 PNG 轉換 + `max_completion_tokens: 8192` 的真實 GPT Vision 呼叫 | High | `v1/prompt-configs/test/route.ts:275`（呼叫於 449-458） |
| BUG-2 (H-01) | 同上端點：上傳檔案無大小上限，MIME 僅檢查 `file.type`（客戶端宣告，可偽造），檔案寫入 `os.tmpdir()` 後做 PDF→圖片轉換 | Medium | `v1/prompt-configs/test/route.ts:298-323、365-373` |
| BUG-3 (API-MISC-02) | `extraction-v2`、`extraction-compare` 觸發 Azure DI + OpenAI 的昂貴操作仍缺速率限制與 MIME magic byte 驗證（生產禁用與 path traversal 已由 FIX-066 處理） | High | `test/extraction-v2/route.ts:136,177`、`test/extraction-compare/route.ts:392` |
| BUG-4 (補強) | `document-preview-test/extract` 已由 FIX-063 補 `auth()` + admin + 檔案上限（413），但仍缺速率限制與 MIME magic byte 驗證 | Medium | `admin/document-preview-test/extract/route.ts:278,328` |
| BUG-5 (RPT-005) | `city-comparison` 的 `cities` 參數無數量上限，每個城市觸發 6 個查詢（含 raw SQL 聚合）以 `Promise.all` 並行，全域管理員路徑甚至跳過城市代碼合法性驗證 → N 倍查詢放大 DoS | Medium | `analytics/city-comparison/route.ts:64-68、262-326` |

---

## 重現步驟

### BUG-1/BUG-2（prompt-configs/test）
1. 不帶任何認證，POST `/api/v1/prompt-configs/test`，附 `configId` 與一個大型 PDF（或宣告為 `application/pdf` 但內容為其他格式的檔案）
2. 觀察現象：端點接受請求並呼叫付費 GPT Vision；可無限次重複呼叫無速率限制（應為 401 + 受速率限制）

### BUG-5（city-comparison）
1. 以多城市授權帳號（或全域管理員）GET `/api/analytics/city-comparison?cities=<數百個逗號分隔代碼>`
2. 觀察現象：單一請求觸發數百倍資料庫查詢（應拒絕超過數量上限的請求）

---

## 根本原因

1. **無全域速率限制中間件**：專案的 `rateLimitService`（`src/services/rate-limit.service.ts`）目前**僅服務外部 API Key 端點**——`checkLimit()` 簽章只接受 `ExternalApiKey` 實體，鍵格式固定為 `rate_limit:external_api:${apiKeyId}`，僅被 8 個 `/api/v1/invoices/*` 端點使用。內部（session / 匿名）端點沒有現成的以 userId / IP 為鍵的速率限制方法。
2. **MIME 類型僅依客戶端宣告**：`prompt-configs/test` 與 `document-preview-test/extract` 皆以 `file.type`（multipart 表單由客戶端宣告，可偽造）或副檔名字串判斷類型，全專案無 magic byte（檔案頭位元組）內容驗證工具。
3. **檔案大小上限不一致**：`document-preview-test/extract`（FIX-063）已套用 `UPLOAD_CONFIG.MAX_FILE_SIZE`（10MB，回 413），但 `prompt-configs/test` 完全沒有大小上限。
4. **聚合查詢參數無上限**：`city-comparison` 的 `cities` 只驗證 `min(1)`，無數量上限與格式驗證。

---

## 解決方案

### 策略總覽（對齊 REMEDIATION-ROADMAP.md WP-9）

對昂貴 AI/OCR 端點補三層防護：**速率限制** + **檔案大小上限** + **MIME magic byte 內容驗證**；對無界聚合查詢補**參數數量上限**。

### 1. 速率限制（H1 注意：擴充既有服務的能力）

`rateLimitService.checkLimit()` 目前只支援 `ExternalApiKey`。內部端點需要以 **session userId（已登入）或 client IP（匿名）** 為鍵的速率限制。

> ⚠️ **H1 設計決策（需用戶 approve）**：擴充 `rate-limit.service.ts` 新增通用方法（如 `checkLimitByKey(key: string, limit: number)`），重用既有 sliding-window 邏輯（Redis 優先 + in-memory fallback），不改變現有 `checkLimit(ExternalApiKey)` 介面與 8 個 invoices 端點的行為。此屬對既有認證/限流基礎設施的能力擴充，依 §Hard Constraints H1 應先取得 approve；若不擴充服務，替代方案為在各端點以最小封裝呼叫 Redis（較易產生分歧寫法，不建議）。
>
> **相依**：以 userId 為鍵的速率限制需要可信的 session，理想在 CHANGE-077（WP-1 認證 fail-open 修復）+ CHANGE-078（WP-2 middleware 認證閘）之後落地；以 IP 為鍵的匿名限流可獨立先行。

對 BUG-1/3/4 端點套用：超過配額回 429（含 `Retry-After` 標頭，沿用 `RateLimitResult.retryAfter`）。

### 2. 檔案大小上限

沿用 `src/lib/upload/constants.ts` 既有工具（`UPLOAD_CONFIG.MAX_FILE_SIZE` 10MB、`isAllowedSize()`、`UPLOAD_ERRORS.FILE_TOO_LARGE`）：
- BUG-2（`prompt-configs/test`）：在讀取 / 寫入暫存檔前加 `file.size > UPLOAD_CONFIG.MAX_FILE_SIZE` 檢查，超限回 413（與 FIX-063 對 `document-preview-test/extract` 的做法一致）。

### 3. MIME magic byte 內容驗證（H2 注意：可能需新工具）

新增共用工具（建議 `src/lib/upload/magic-byte.ts`）：讀取上傳檔案前 N 個位元組比對檔案簽章（PDF `%PDF`、JPEG `FF D8 FF`、PNG `89 50 4E 47`），與宣告的 `file.type` 不符即拒絕（400）。

> ⚠️ **H2 注意**：優先以 Node.js 原生 `Buffer` 比對位元組實作（零新依賴）；若評估後需引入 `file-type` 套件，屬 H2 dependency trigger，須先取得 approve。本 FIX 預設採原生實作。

對 BUG-2（`prompt-configs/test`）、BUG-4（`document-preview-test/extract`）、BUG-3（`extraction-v2`/`extraction-compare`，僅在 FIX-066 保留端點時）套用。

### 4. 聚合查詢參數上限

BUG-5（`city-comparison`）：`cities` 加 `.refine(arr => arr.length <= 20)` 數量上限 + 城市代碼格式驗證（2-10 位英數字），全域管理員路徑亦須驗證代碼合法性。

---

## 與 FIX-066 的界線說明

`api/test/extraction-compare`、`extraction-v2` 由多個 FIX 共同涵蓋，職責劃分如下：

| 防護面 | 負責 FIX | 狀態 |
|--------|---------|------|
| 生產禁用 test 端點（`NODE_ENV` gate，非 development 回 404） | **FIX-066** | ✅ 已修復 |
| path traversal 修復（`extraction-compare` 暫存檔名改 `randomUUID()` + 副檔名白名單，不用 `file.name`） | **FIX-066** | ✅ 已修復 |
| 認證（保留端點時補 `auth()`） | **FIX-066**（縱深防禦條款 3） | ✅ 已修復 |
| **速率限制（rate limit）** | **本 FIX-071** | 🚧 待修復 |
| **MIME magic byte 內容驗證** | **本 FIX-071** | 🚧 待修復 |
| 檔案大小上限 | FIX-066 已規劃於保留端點；本 FIX-071 確認落實並對齊其他端點 | 🚧 待確認 |

**界線原則**：FIX-066 處理 test 端點的「存取控制（生產禁用 / 認證）」與「path traversal」；FIX-071 處理「成本濫用防護（速率限制 + 檔案上限 + MIME 內容驗證）」這一橫切面，並擴及非 test 的昂貴端點（`prompt-configs/test`、`document-preview-test/extract`、`city-comparison`）。兩者**不修改對方已完成的程式碼行為**，僅在同檔案疊加互補防護。

> 同理，`document-preview-test/extract`（BUG-4）的「認證 + admin 角色 + 檔案大小上限」已由 **FIX-063** 完成；本 FIX-071 僅在其上補「速率限制 + MIME magic byte 驗證」，不重複處理認證。

---

## 修改的檔案

| 檔案 | 修改內容 | 與既有 FIX 界線 |
|------|----------|----------------|
| `src/services/rate-limit.service.ts` | 新增以 userId/IP 為鍵的通用 `checkLimitByKey()`（H1，需 approve），重用既有 sliding-window；不動 `checkLimit(ExternalApiKey)` | 新增能力 |
| `src/lib/upload/magic-byte.ts`（新增） | MIME magic byte 驗證工具（原生 Buffer 比對 PDF/JPEG/PNG 簽章） | 新增工具 |
| `src/app/api/v1/prompt-configs/test/route.ts` | 補認證（依賴 WP-2/WP-3e）+ 速率限制 + 檔案大小上限（413）+ magic byte 驗證 | 全新防護（無既有 FIX 觸碰） |
| `src/app/api/admin/document-preview-test/extract/route.ts` | 補速率限制 + magic byte 驗證 | 認證/admin/檔案上限已由 FIX-063 完成，本 FIX 僅疊加 |
| `src/app/api/test/extraction-v2/route.ts` | （保留端點時）補速率限制 + magic byte 驗證 | 生產禁用/認證已由 FIX-066 完成 |
| `src/app/api/test/extraction-compare/route.ts` | （保留端點時）補速率限制 + magic byte 驗證 | 生產禁用/path traversal/認證已由 FIX-066 完成 |
| `src/app/api/analytics/city-comparison/route.ts` | `cities` 加數量上限（≤20）+ 代碼格式驗證（含全域管理員路徑） | 全新防護 |

---

## 其他昂貴端點盤點（本 FIX 範圍判定）

審查時盤點所有可能觸發昂貴 AI/OCR 的端點，判定是否屬本 FIX：

| 端點 | 是否昂貴 | 防護現狀 | 歸屬 |
|------|---------|---------|------|
| `v1/prompt-configs/test` | ✅ GPT Vision | 無認證/限流/上限/magic byte | **本 FIX 主範圍** |
| `admin/document-preview-test/extract` | ✅ Azure DI + GPT Vision | 認證/admin/檔案上限已修（FIX-063） | **本 FIX 補限流 + magic byte** |
| `test/extraction-v2` | ✅ Azure DI + GPT Mini | 生產禁用/認證已修（FIX-066） | **本 FIX 補限流 + magic byte** |
| `test/extraction-compare` | ✅ Azure DI + OpenAI | 生產禁用/path traversal/認證已修（FIX-066） | **本 FIX 補限流 + magic byte** |
| `analytics/city-comparison` | ✅ N 倍 DB 聚合查詢 | 無數量上限 | **本 FIX 補參數上限** |
| `admin/term-analysis`、`batches/[batchId]/term-stats` | ✅ GPT 分類/聚合 | 認證 + admin 已修（FIX-063） | FIX-063 已補認證；速率限制屬未來統一治理（暫不納入，避免 scope 膨脹） |
| `documents/upload`、`/[id]/process` | ✅ 完整提取管線 | 有認證 + `UPLOAD_CONFIG` 檔案上限 | 已有基線防護，不在本 FIX |
| `rules/test`、`rules/[id]/preview` | ⚠️ ReDoS（非 AI 成本） | — | 屬 WP-6（ReDoS），非本 FIX |
| `python-services` extraction:8000 / mapping:8001 | ✅ Azure DI + OpenAI | 無認證/限流 | 屬 WP-8（Python 架構），非本 FIX |

> **scope 邊界（H3）**：`admin/term-analysis` 等已由 FIX-063 補認證的 admin 端點，理論上也應加速率限制；但其昂貴度與成本暴露遠低於無認證的 `prompt-configs/test`，且已有 admin 角色 gate 限縮攻擊面。為避免 task scope 膨脹，本 FIX 聚焦「無認證 / 公開可達」的高成本端點與三個 test/preview 端點，admin 端點的速率限制留待 WP-8「授權寫法統一」階段一併治理。

---

## 測試驗證

### 程式碼層面
- [x] `prompt-configs/test`：補認證（未登入 → 401）+ 速率限制（429 + `Retry-After`）+ 檔案上限（413）+ magic byte（內容不符 → 400）
- [x] `document-preview-test/extract`：補速率限制（429）+ magic byte（400）；既有 401/403/413（FIX-063）行為不回歸
- [➡️] `extraction-v2`/`extraction-compare`：**依範圍判斷略過**（dev-only，生產 404；詳見 Implementation Notes）
- [x] `city-comparison`：`cities` > 20 → 400；非法城市代碼格式（非 2-10 位英數字）→ 400；schema 於入口套用於所有角色（含全域管理員）
- [x] magic byte 工具：涵蓋 PDF/JPEG/PNG/TIFF/WebP + `image/jpg` 別名正規化（與端點 isValidFileType 一致，不誤拒合法上傳）
- [x] `rateLimitService.checkLimitByKey()`：抽出共用窗口邏輯，重用 sliding-window；既有 `checkLimit(ExternalApiKey)` 介面與 8 個 invoices 端點行為不變
- [x] `npm run type-check`：`src/` + `prisma/` 零錯誤
- [x] `npm run lint`：本批新增程式碼無 error（既有 `no-console` warning 不在本 FIX 範圍，H3 不動）
- [ ] ⏸️ 單元測試（magic byte / checkLimitByKey）：待專案測試框架就緒

### 執行期（待 staging 驗證）
- [ ] 連續超量呼叫昂貴端點 → 確實回 429 並阻斷
- [ ] 既有正常使用（含 8 個 invoices 端點的既有限流）迴歸正常
- [ ] Redis 配置與未配置（in-memory fallback）兩種模式皆生效

---

## 待用戶決策事項（已決，2026-06-11）

1. **H1 approve** → **同意**擴充 `rate-limit.service.ts` 新增 `checkLimitByKey()`（重用 sliding-window，不動現有介面）。
2. **H2 確認** → **採 Node.js 原生 Buffer 比對**（零新依賴），未引入 `file-type` 套件。
3. **速率限制配額** → **嚴格 10 次/分鐘**（昂貴測試/預覽端點），`city-comparison` 的 `cities` 上限 20。
4. **相依排序** → `prompt-configs/test` 補認證以 `auth()` session（CHANGE-078 middleware 閘為 monitor 模式，此處 handler 內補登入檢查為縱深防禦）；rate limit 以 userId 為鍵。

---

## Implementation Notes（2026-06-11）

### 已實作

| BUG | 端點 / 檔案 | 防護 |
|-----|------------|------|
| BUG-1/2 (K-01/H-01) | `v1/prompt-configs/test` | 補 `auth()` 登入（401）+ rate limit（userId, 10/min, 429+Retry-After）+ 檔案上限（413）+ magic byte（400）|
| BUG-4 | `admin/document-preview-test/extract` | 補 rate limit（429）+ magic byte（400）；認證/admin/上限已由 FIX-063 完成，不重複 |
| BUG-5 (RPT-005) | `analytics/city-comparison` | `cities` schema 加數量上限（≤20）+ 代碼格式（2-10 位英數字）；於入口套用所有角色 |
| 服務擴充（H1）| `services/rate-limit.service.ts` | 抽出 `checkLimitForKey` / `checkWindowRedis` / `checkWindowMemory`，新增 `checkLimitByKey(key, limit)`；`checkLimit(ExternalApiKey)` 對外行為不變 |
| 共用工具 | `src/lib/upload/magic-byte.ts`（新增）| 原生 Buffer 比對 PDF/JPEG/PNG/TIFF/WebP，`image/jpg` 別名正規化 |

### BUG-3（extraction-v2 / extraction-compare）依範圍判斷略過

- 這兩個端點已由 **FIX-066** 設為 **dev-only**（`NODE_ENV === 'production'` → 404），生產環境不可達。
- 其「成本型 DoS」攻擊面在生產為 **0**（404）；rate limit 對生產不可達端點無實際安全價值，依 Karpathy「不處理不可能發生的場景」+ §H3（不擴大 scope）**略過**。
- 此外這兩端點接受的類型集（含 TIFF/多種 image）與主流程不同；如未來移除其 dev-only 限制，再一併補 rate limit + magic byte（另開 FIX）。

### magic byte 相容性（避免誤拒合法上傳）

- 端點 `isValidFileType` 接受 PDF/JPEG/JPG/PNG/TIFF/WebP；magic-byte 工具同步涵蓋全部，並將 `image/jpg` 正規化為 `image/jpeg`，確保合法 JPG 別名與 WebP 不被誤拒。
- 驗證語義：內容須為已知安全類型（擋偽裝為 PDF 的可執行檔/壓縮炸彈），且偵測類型須與宣告一致（擋類型偽造）。

### scope 邊界（H3）

- `admin/term-analysis`、`batches/[batchId]/term-stats` 等已由 FIX-063 補認證的 admin 端點，其速率限制留待 WP-8「授權寫法統一」一併治理（立案 §其他端點盤點），本 FIX 不納入。
- 既有 `console.log`（GPT/Azure 處理日誌）屬本批檔案既有，未動（漸進 logger 化另案）。

### 待 staging 驗證

- 連續超量呼叫 → 確實 429 並阻斷；Redis 配置 / in-memory fallback 兩模式皆生效。
- 既有 8 個 invoices 端點限流（`checkLimit`）行為迴歸正常。
- 合法 PDF/JPEG/PNG/TIFF/WebP 上傳不被 magic byte 誤拒；偽造類型被擋。

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-11（核心已完成：rate-limit 擴充 + magic-byte 工具 + 3 端點防護；BUG-3 dev-only 略過）*
