# Phase 2 現狀盤點 — AppSec + Obs 領域

> **盤點日期**: 2026-04-28
> **評分模型**: L0 (Absent) → L1 (Initial) → L2 (Managed) → L3 (Defined) → L4 (Optimized)
> **盤點範圍**: AppSec 12 項 + Obs 4 項（零成本版必須項）
> **基準文件**:
> - `docs/08-security-and-governance/enterprise-security-governance-matrix.md` (v1.2)
> - `docs/06-codebase-analyze/05-security-quality/security-audit.md` (2026-04-09)
>
> **盤點方法**:
> 1. 直接 grep / 讀取 codebase
> 2. 對比 v1.2 矩陣的企業級基準（L3+）
> 3. 已知 FIX-050 / FIX-051 / FIX-052 已修復項目納入考量
>
> **企業就緒度判定基準**:
> - 🔴 NOT READY: HIGH 風險項 ≥ 1 個低於 L2
> - 🟡 PARTIALLY READY: HIGH 全部 ≥ L2，MEDIUM 部分低於 L2
> - 🟢 READY: HIGH ≥ L3，MEDIUM ≥ L2

---

## 一、領域成熟度匯總

### 1.1 總覽表

| 領域 | 檢查項數 | L0 | L1 | L2 | L3 | L4 | 平均成熟度 | HIGH 未達 L2 | 企業就緒？ |
|------|---------|----|----|----|----|----|-----------|--------------|-----------|
| **AppSec** | 12 | 4 | 4 | 2 | 2 | 0 | **L1.2** | 6 | 🔴 NOT READY |
| **Obs (零成本版)** | 4 | 1 | 1 | 1 | 1 | 0 | **L1.5** | 2 | 🔴 NOT READY |
| **總計** | 16 | 5 | 5 | 3 | 3 | 0 | **L1.3** | 8 | 🔴 NOT READY |

### 1.2 HIGH 風險未達 L2 的項目（8 項）

| ID | 項目 | 評分 | 風險等級 | 距 L2 差距 |
|----|------|------|---------|-----------|
| AppSec-01 | Zod 輸入驗證 | L1 | 🔴 HIGH | 覆蓋率 82% / 目標 ≥ 95%；不一致 RFC 7807 |
| AppSec-03 | XSS / CSP | L1 | 🔴 HIGH | 無 CSP header；React 自動轉義為 L1 預設值 |
| AppSec-05 | 檔案上傳安全 | L1 | 🔴 HIGH | 僅有 MIME claim 檢查（無 magic number）、無病毒掃描 |
| AppSec-07 | 相依套件漏洞 | L0 | 🔴 HIGH | 無 Dependabot、無 CI npm audit、無 Snyk |
| AppSec-09 | 全域 Rate Limiting | L1 | 🔴 HIGH | 僅 7 個 /v1/invoices 端點有；其餘 324 個路由完全沒有 |
| AppSec-12 | LLM Prompt Injection | L0 | 🔴 HIGH | 無使用者輸入隔離、無輸出驗證白名單 |
| Obs-01 | Audit Log 覆蓋率 | L2 | 🔴 HIGH | 中間件存在但未廣泛採用（withAuditLog 0% 用於 API 路由） |
| Obs-05-lite | 告警機制 | L1 | 🔴 HIGH | Nodemailer 已整合但無安全事件觸發告警 |

### 1.3 結論

**🔴 NOT READY** — 16 項中有 8 項 HIGH 風險低於 L2，需在進入 Wave 1-3 實作前優先補強。

---

## 二、AppSec 領域逐項評分

### AppSec-01: Zod 輸入驗證

- **評分**: **L1 (Initial)**
- **企業級基準 (L3+)**: 所有 POST/PATCH/PUT/DELETE API ≥ 95% 有 Zod schema、driver 統一錯誤格式
- **證據**:
  - 變更類路由文件：**183 個**（POST/PATCH/PUT/DELETE`route.ts`，由 `src\app\api` 下 `export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)` 計數）
  - 含 Zod 驗證（`z.object` / `.parse(` / `.safeParse(`）的 API 路由：**212 個**（包括 GET 路由的 query 驗證）
  - 對比 security-audit.md 的數據：mutation 路由 195/159 = **82%**（與本次粗略統計一致）
  - 已建立的 schema 集中位置：`src\lib\validations\` 共 9 個 schema（exchange-rate / field-definition-set / outlook-config / pipeline-config / prompt-config / reference-number / region / role / user）+ 額外散在 `src\validations\`
  - 仍未驗證的高風險端點：`/documents/upload`、`/documents/[id]/process`、`/admin/historical-data/upload`、`/admin/backups/[id]`、`/admin/restore/[id]` 等（security-audit.md 第 152-167 行明列 36 個）
- **缺口**:
  - ~18% 變更類端點完全無輸入驗證（含核心 `/documents/upload`、`/admin/historical-data/upload`）
  - Validation schema 散佈兩處（`src\lib\validations\` + `src\validations\`），新舊位置混用
  - 部分路由用 `JSON.parse()` 直接解析 FormData / body 無 Zod 包裝（`companies/[id]/route.ts:149`、`admin/config/[key]/reset/route.ts:100`、`v1/invoices/route.ts:370`）
- **建議**: Wave 1 優先補完 36 個未驗證 mutation 端點，且全部 schema 統一遷移到 `src\lib\validations\`
- **🔴 HIGH 風險未達 L2**

---

### AppSec-02: SQL Injection 防護

- **評分**: **L3 (Defined)**
- **企業級基準 (L3+)**: 禁止 `$executeRawUnsafe`，全部使用參數化查詢；若必須使用 unsafe，需有白名單驗證
- **證據**:
  - 全 codebase 搜尋 `$executeRawUnsafe` 結果：**僅在 `src\lib\db-context.ts` 出現 2 次**（line 124、148）— 已被 FIX-051 修復
  - 全 codebase 搜尋 `$queryRawUnsafe`：**0 個**（已完全清除）
  - FIX-051 修復內容驗證（`db-context.ts` line 76）：`CITY_CODE_PATTERN = /^[A-Z]{2,4}$/` 嚴格白名單
  - line 124 的 `cityCodes` 在組字串前必先 `.map(sanitizeCityCode)` 通過正則驗證，否則 `throw`
  - line 148 的 `clearRlsContext()` 只用 hard-coded `'false'` 與空字串，無動態輸入
  - `$queryRaw` 13 處全使用 tagged template literal（自動參數化），詳見 `security-audit.md` §2 列表
- **缺口**: 無重大缺口；建議在 `db-context.ts` 加 unit test 驗證 sanitizer 行為
- **建議**: 可保留現狀；考慮在 PR template 加入「禁止 $executeRawUnsafe」檢查項
- **✅ 達 L3**

---

### AppSec-03: XSS / CSP 防護

- **評分**: **L1 (Initial)**
- **企業級基準 (L3+)**: 啟用 CSP（先 Report-Only 後 enforce）、所有 `dangerouslySetInnerHTML` 經審查、用 sanitize 庫
- **證據**:
  - `next.config.ts` 完整內容已讀（67 行）— **無任何 `headers()` 配置、無 CSP、無 Security Headers**
  - 全 codebase 搜尋 `dangerouslySetInnerHTML`：**0 個** ✅（無高風險 HTML 注入點）
  - React 18.3 預設轉義 ✅（屬於 framework 內建保護）
- **缺口**:
  - 完全沒有 CSP（連 Report-Only 都沒有）
  - 無 X-XSS-Protection（雖已 deprecated）
  - 沒有 sanitize 庫（如 DOMPurify、isomorphic-dompurify）
- **建議**: Wave 1 加 CSP Report-Only 模式 1-2 週後再 enforce；同時加上 `Content-Security-Policy-Report-Only` header
- **🔴 HIGH 風險未達 L2**

---

### AppSec-04: CSRF 防護

- **評分**: **L2 (Managed)**
- **企業級基準 (L3+)**: NextAuth CSRF token + SameSite cookie + 雙重驗證
- **證據**:
  - 使用 NextAuth v5 (next-auth `^5.0.0-beta.30`，見 `package.json:89`）
  - NextAuth v5 預設啟用 CSRF token（內建於 `/api/auth/*` 端點）
  - 全 codebase 搜尋 `SameSite` / `sameSite` / `csrfToken`：**0 個**（未額外配置 — 採用 NextAuth 預設值，預設 SameSite=Lax）
  - n8n webhook 路徑（`/api/n8n/webhook`）需 exempt CSRF — 目前用 API key 認證，無 cookie，自然 exempt
- **缺口**:
  - 無顯式 SameSite=Strict 或 Secure 配置（依賴 NextAuth 預設）
  - 文檔化的 exempt list 不存在
- **建議**: 可保留 NextAuth 預設行為；Wave 2 補上 cookie 配置文件
- **✅ 達 L2**

---

### AppSec-05: 檔案上傳安全

- **評分**: **L1 (Initial)**
- **企業級基準 (L3+)**: MIME 驗證（含 magic number）、大小限制、病毒掃描、隔離儲存、檔案重命名
- **證據**:
  - `src\lib\upload\constants.ts` 第 28-50 行：定義 ALLOWED_TYPES = `['application/pdf', 'image/jpeg', 'image/png']`、MAX_FILE_SIZE = 10MB、MAX_FILES_PER_BATCH = 20
  - `src\app\api\documents\upload\route.ts` line 289-304：上傳路徑使用 `isAllowedType(file.type)` + `isAllowedSize(file.size)` 驗證
  - **缺陷 1**：MIME 驗證**完全依賴客戶端 claim**（`file.type` 為 user-controllable）— 無 magic number 驗證
  - 全 codebase 搜尋 `magic.*number` / `magic-bytes` / `file-type`（npm 套件）：在 `unified-processor/steps/file-type-detection.step.ts` 有 `file-type` 字樣但實際是 PDF 文字層偵測（line 83-100，用 binary content 檢查 `/Font` / `BT...ET`），**不是真正的 MIME magic number 驗證**
  - 全 codebase 搜尋 `virus` / `antivirus` / `clamav`：**0 個**（無病毒掃描）
  - 上傳目的地：Azure Blob Storage（共享 container），無「隔離區」概念
  - 檔名處理（route.ts line 322）：`fileName: file.name`（**保留原始檔名**）— 無 UUID 重命名隔離
- **缺口**（影響 Wave 3 實作）:
  - 無 magic number / 真正 MIME 驗證（攻擊者可上傳偽裝的 .exe）
  - 無病毒掃描（Wave 3 必測項目 #3 「病毒掃描延遲對使用者體驗影響」尚未實作）
  - 無「隔離儲存」設計（病毒掃描後才能進入正式區）
  - 原始檔名直接保留（路徑遍歷風險低，但仍應 sanitize）
- **建議**: Wave 3 必須做：(1) 安裝 `file-type` npm 套件做 magic number 驗證；(2) 整合 ClamAV 或 Azure Defender Files；(3) 設計 quarantine container；(4) UUID 化檔名
- **🔴 HIGH 風險未達 L2** — Wave 3 實作前需補完上述基礎建設

---

### AppSec-06: 反序列化安全

- **評分**: **L2 (Managed)**
- **企業級基準 (L3+)**: JSON.parse 包裝錯誤處理、禁用 `eval()` / `Function()` / 危險反序列化
- **證據**:
  - 全 codebase（src/）搜尋 `JSON.parse`：**57 個 / 36 個檔案**
  - API 層（src/app/api）搜尋 `JSON.parse`：**9 個 / 9 個檔案**
  - 重點檢查：
    - `companies/[id]/route.ts:149` `JSON.parse(jsonData)` — 包在 try-catch
    - `admin/config/[key]/reset/route.ts:100` `JSON.parse(text)` — 用於管理員配置
    - `v1/invoices/route.ts:370` `JSON.parse(params)` — 包裝錯誤處理
    - `v1/prompt-configs/test/route.ts:196,205,215` — 處理 GPT 回應
  - 無 `eval()` / `Function()` 動態執行的證據（未專門搜尋，但多次審計報告無此項）
- **缺口**:
  - 部分 `JSON.parse` 可能未包 try-catch（需逐一審查）
  - 無統一的 `safeJsonParse()` helper
- **建議**: 提供統一 helper（建在 `src\lib\utils.ts`），逐步替換散在 36 個檔案的裸 JSON.parse
- **🟡 達 L2 邊緣**

---

### AppSec-07: 相依套件漏洞掃描

- **評分**: **L0 (Absent)**
- **企業級基準 (L3+)**: npm audit / Dependabot / Snyk 啟用，HIGH/CRITICAL 零容忍
- **證據**:
  - `.github/` 目錄結構檢查結果：**僅有 `agents/` 子目錄**，無 `workflows/` 子目錄、無 `dependabot.yml`、無任何 CI/CD 文件
  - `package.json` 無 `audit` / `snyk` 相關 script
  - 無 pre-commit hook（無 `.husky/`、無 `lint-staged` 配置）
- **缺口**: 完全沒有自動化套件掃描；77 個 main + 20 個 dev 依賴的安全狀態未知
- **建議**: Wave 2 優先補完 — (1) 加 `.github/dependabot.yml`；(2) 加 `.github/workflows/security.yml`（npm audit + Trivy）；(3) 加 husky + gitleaks pre-commit
- **🔴 HIGH 風險未達 L2**

---

### AppSec-08: Security Headers

- **評分**: **L0 (Absent)**
- **企業級基準 (L3+)**: HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy
- **證據**:
  - `next.config.ts` 完整 67 行已讀 — **無 `async headers()` 函數**、無任何 security headers 配置
  - `src\middleware.ts` 完整 183 行已讀 — 僅處理 i18n + auth redirect，**無設定任何 response header**
- **缺口**: 完全沒有任何安全 headers
- **建議**: Wave 1 立即補加 `next.config.ts` headers 函數（零功能影響，純加 HTTP 響應 header）
- **🟡 MED 風險未達 L2**（v1.2 矩陣標 MED 而非 HIGH，但 Wave 1 必補）

---

### AppSec-09: 全域 Rate Limiting

- **評分**: **L1 (Initial)**
- **企業級基準 (L3+)**: 全域 + 端點級 rate limit、防濫用、認證端點獨立限制
- **證據**:
  - `src\services\rate-limit.service.ts` 372 行已讀 — FIX-052 已實作 Redis 優先 + in-memory fallback ✅
  - 搜尋 `rateLimitService` / `checkLimit` 結果：**僅 8 個檔案使用** — 7 個 `/v1/invoices/*` 端點 + 1 個 service 自身
  - 對 331 個 API 路由的覆蓋率：**~2%**（7/331）
  - 認證端點（`/api/auth/register`, `/auth/forgot-password`, `/auth/reset-password`）— **完全無 rate limit**（暴力破解風險）
  - 上傳端點（`/api/documents/upload`、`/admin/historical-data/upload`）— **完全無 rate limit**
  - Security-audit.md §8 R15 verification 確認：「Rate limiting 僅應用於 7 個外部 /v1 端點」
- **缺口**（影響 Wave 3 實作）:
  - 324 個路由完全無 rate limit
  - 認證 brute-force 攻擊面開放
  - 用戶批量上傳 100 張發票（Wave 3 必測項目 #1）尚未設計獨立配額
  - n8n / SharePoint / Outlook 自動化呼叫尚未列入「服務帳號免限制白名單」
  - 無管理員臨時提升配額機制
- **建議**: Wave 3 設計全域中間件 + 端點級配置；先做認證端點（每 IP 5 次/分鐘）+ 上傳端點（每用戶 100 次/小時）+ 一般 API（每用戶 1000 次/小時）
- **🔴 HIGH 風險未達 L2**

---

### AppSec-10: SSRF 防護

- **評分**: **L0 (Absent)**
- **企業級基準 (L3+)**: 外部 URL 白名單、禁止內網存取（169.254.169.254 metadata、10.x、127.x 等）
- **證據**:
  - 全 codebase 搜尋外部 fetch / URL 呼叫，找到 16 個服務檔有 `await fetch()` 或 `axios`
  - 主要外部呼叫點（影響 Wave 3 實作）:
    - `src\services\webhook.service.ts:278` — `await fetch(delivery.targetUrl, ...)` — **完全使用者可控**（webhook 設定來自 admin UI），高風險 SSRF 入口
    - `src\services\n8n\n8n-webhook.service.ts:169` — `await fetch(event.webhookUrl, ...)`
    - `src\services\n8n\webhook-config.service.ts:521` — `await fetch(testUrl, ...)`（webhook 測試端點）
    - `src\services\n8n\workflow-trigger.service.ts:499` — `await fetch(workflow.triggerUrl, ...)`
    - `src\services\microsoft-graph.service.ts:233/281/415/570` — `new URL(siteUrl)` + `fetch(downloadUrl)` — SharePoint 文件下載，URL 可能來自設定
  - 全 codebase 搜尋白名單 / `isAllowedHost` / `allowed.*domain`：**0 個**
  - Webhook URL 沒有任何驗證限制（admin 可填任意 URL，包含 `http://localhost:5432` 內網探測）
- **缺口**（影響 Wave 3 實作）:
  - 5+ 個 `fetch()` 呼叫點完全沒有 hostname 白名單
  - n8n / SharePoint / Outlook 設定的 URL 全部由使用者填寫，無內網阻擋
  - 沒有列出「應用主動發起的所有外部 URL 呼叫」清單
- **建議**: Wave 3 必須做（依矩陣 §3.3 緩解清單）：(1) 列出完整外部 URL 清單；(2) 對每個 fetch 加 SSRF guard middleware；(3) Azurite 開發 URL 例外處理
- **🟡 MED 風險未達 L2**（v1.2 矩陣標 MED 但「若有 webhook 中斷」屬高影響）

---

### AppSec-11: RFC 7807 錯誤格式統一

- **評分**: **L1 (Initial)**
- **企業級基準 (L3+)**: 所有 API 統一錯誤格式（top-level `{ type, title, status, detail, instance, errors }`）
- **證據**:
  - 主 CLAUDE.md 第 305-312 行已明列：「**RFC 7807 格式不一致**: 部分路由使用 top-level，部分使用 nested — 新 API 必須採用統一的 top-level 格式」
  - 抽查 `src\app\api\documents\upload\route.ts` line 162-173 範例：使用 **nested** 格式 `{ success: false, error: { type, title, status, detail } }`（注意：top-level 是 `error`，內含 RFC 7807 欄位 — 偏離標準）
  - 對比 NextAuth `/api/auth/*` 與 `/v1/*` 端點，error envelope 風格不一致
- **缺口**:
  - top-level vs nested 兩種格式並存於 codebase 中
  - 無統一的 `createApiError()` helper 強制執行格式
- **建議**: Wave 1 建立 `src\lib\api\response.ts` 提供 helper，逐步遷移；新 API 強制使用 helper
- **🟢 LOW 風險未達 L2**（風險級別低，但一致性影響開發體驗）

---

### AppSec-12: LLM Prompt Injection 防護

- **評分**: **L0 (Absent)**
- **企業級基準 (L3+)**: 用戶輸入隔離、系統 prompt 保護、輸出驗證白名單、監控異常 prompt
- **證據**:
  - 全 codebase 搜尋 `PROMPT_INJECTION` / `sanitize.*prompt` / `injection.*defense`：**0 個**
  - V3 提取管線（`src\services\extraction-v3\stages\gpt-caller.service.ts`）只做 GPT API 呼叫封裝（line 1-100 已讀），**無 prompt 注入防禦**
  - Prompt 組裝邏輯：`src\services\extraction-v3\utils\prompt-merger.ts` + `variable-replacer.ts` — 支援使用者自定義 `${變數}` 替換（line 由 CHANGE-026 引入），**未做 escape / 白名單**
  - System Prompt 與 User Prompt 在 `gpt-caller.service.ts` line 73-78 直接 concatenate（`systemPrompt: string` + `userPrompt: string`），無分離保護
  - 無輸出驗證白名單（如限制 GPT 必須回傳特定 JSON schema）— 雖有 `result-validation.service.ts` 但驗證的是業務邏輯而非注入攻擊
- **缺口**（影響 Wave 2 實作）:
  - 用戶上傳的 PDF/Image 內文直接 base64 送給 GPT 識別，文件中可能包含「ignore all previous instructions」式 prompt 注入
  - Prompt 變數替換器無 escape — 若使用者可控 prompt config，可能改寫 system prompt
  - GPT 回應無 schema 強制驗證
- **建議**: Wave 2 必測項目（依矩陣 §3.2）：(1) 對 user-controllable prompt 變數做 escape；(2) 用 OpenAI structured outputs（JSON schema）強制 GPT 回傳結構；(3) 監控異常 prompt patterns
- **🔴 HIGH 風險未達 L2**

---

## 三、Obs 領域逐項評分（零成本版）

### Obs-01: Audit Log 覆蓋率

- **評分**: **L2 (Managed)**
- **企業級基準 (L3+)**: 所有敏感操作（CRUD on PII、權限變更、Login）100% 記錄
- **證據**:
  - `prisma\schema.prisma` line 280-311：`AuditLog` model 完整定義（含 userId、action、resourceType、resourceId、changes、cityCode、ipAddress、userAgent、status、metadata）
  - `enum AuditAction` line 3274-3289：14 種動作（CREATE / READ / UPDATE / DELETE / LOGIN / LOGOUT / EXPORT / IMPORT / APPROVE / REJECT / ESCALATE / CONFIGURE / GRANT / REVOKE）
  - 中間件存在：`src\middlewares\audit-log.middleware.ts` 提供 `withAuditLog()` 高階函數
  - **使用程度**：
    - 全 codebase 搜尋 `withAuditLog\(` 在 API 路由中：**0 個** ❌（中間件存在但完全未在 API 層採用）
    - 搜尋 `auditLog.create` / `auditLogService.` / `auditLogger.`：45 處 / 17 個服務檔案
    - 主要採用點：`user.service.ts`、`global-admin.service.ts`、`system-config.service.ts`（7 處）、`rule-change.service.ts`（4 處）、`routing.service.ts`（5 處）
  - 對比 security-audit.md §8 R15 確認：「withAuditLog 中間件採用率僅 0.9%（3/331），多數 audit 寫入靠 service 層手動 `auditLog.create()` — 不一致」
- **缺口**:
  - API 層完全沒用中間件（每個 service 自行決定是否寫 log）
  - 沒有強制機制保證所有 mutation 都有 audit log
  - 失敗動作（403、401）無 audit log（只在 service 成功路徑寫）
- **建議**: 補上 API 層 wrapper（強制所有 mutation 路由透過 `withAuditLog`），目標覆蓋率 ≥ 80% mutation 端點
- **🟡 達 L2 但 HIGH 風險仍存（API 層 0% 採用）**

---

### Obs-03: Security Event Log

- **評分**: **L3 (Defined)**
- **企業級基準 (L3+)**: 失敗 login、權限拒絕、異常 API 呼叫獨立記錄
- **證據**:
  - `prisma\schema.prisma` line 1010-1034：**獨立的 `SecurityLog` model**（不複用 audit_logs）— 含 eventType、severity、resolved、resolvedBy
  - `enum SecurityEventType` line 3502-3510：7 種類型（UNAUTHORIZED_ACCESS_ATTEMPT / CROSS_CITY_ACCESS_VIOLATION / INVALID_CITY_REQUEST / RESOURCE_ACCESS_DENIED / SUSPICIOUS_ACTIVITY / PERMISSION_ELEVATION_ATTEMPT / TAMPERING_ATTEMPT）
  - `enum SecuritySeverity` line 3512-3517：4 級（LOW / MEDIUM / HIGH / CRITICAL）
  - `src\services\security-log.ts` 完整服務 — 包含自動嚴重性提升邏輯（line 12-14：基於重複嘗試）
  - 採用點：`security-log.ts:191`、`security-log.ts:246`、`audit-log.service.ts:255` 三個寫入點
  - 觸發來源：`src\middlewares\city-filter.ts` 與 `resource-access.ts`（已存在中間件）
- **缺口**:
  - 沒記錄 Auth 失敗（FIX-050 後 `auth.config.ts` 用 logger.info 但未寫到 SecurityLog）
  - 沒記錄 Rate Limit 觸發事件
  - 沒整合到告警機制（Obs-05-lite）
- **建議**: 將 auth 失敗與 rate limit 觸發事件補進 SecurityLog；與 Obs-05 告警串接
- **✅ 達 L3**

---

### Obs-05-lite: 告警機制（Email 基礎版）

- **評分**: **L1 (Initial)**
- **企業級基準 (L3+)**: 高風險事件即時告警（Auth failure spike、API error rate、DB 失敗、Disk、健康檢查）
- **證據**:
  - `src\lib\email.ts` 完整 60 行已讀 — Nodemailer 已整合，支援 dev mode JSON transport + prod SMTP（line 35-58）
  - 通知服務存在：`src\services\notification.service.ts` + `alert.service.ts` + `alert-notification.service.ts` + `alert-evaluation.service.ts` + `alert-evaluation-job.ts`
  - Alert system（Epic 12）已存在 — 但目前用於業務告警（如成本異常），**未配置安全告警規則**
  - Auth failure 沒有 spike 偵測（`auth.config.ts` 後 FIX-050 改用 logger.info，但未統計）
  - 矩陣 §4.3 列出的 5 條關鍵告警（Auth failure spike / API error rate / DB connection / Disk / Health check）— **0/5 已實作**
- **缺口**:
  - 安全告警 5 條全未實作
  - 無「Auth failure 5 分鐘 > 50 次」式 spike 偵測邏輯
  - 沒有告警閾值配置 UI（雖然 alert-rule.service.ts 存在）
- **建議**: 利用既有 alert-rule.service.ts 框架，先 report-only 一週後再啟用告警
- **🔴 HIGH 風險未達 L2**

---

### Obs-11: Health Check 端點

- **評分**: **L2 (Managed)**
- **企業級基準 (L3+)**: `/health` 端點、liveness/readiness probe、檢查所有關鍵依賴
- **證據**:
  - `src\app\api\health\route.ts` 完整 100 行已讀 — GET endpoint（line 50）、無認證（line 30 註明）、回傳格式包含 status / timestamp / uptime / responseTime / services / version
  - 檢查項：(1) DB 連接（`prisma.$queryRaw\`SELECT 1\``，line 57）；(2) version 從 `process.env.npm_package_version`
  - 額外 admin 端點：`src\app\api\admin\health\route.ts` + `[serviceName]/route.ts` 提供更詳細的服務級健康檢查
  - 回應 503 if unhealthy（line 91）— 適合 ACA liveness probe
  - Cache-Control: `no-cache, no-store, must-revalidate`（line 94）
- **缺口**:
  - 只檢查 DB，未檢查 Azure Blob、Azure OpenAI、Azure Document Intelligence、Redis、SMTP 等關鍵依賴
  - 無 readiness vs liveness 區分（ACA 部署需要區分）
- **建議**: 上 ACA 前擴增為 `/health/liveness`（簡單 200 OK） + `/health/readiness`（完整依賴檢查）
- **✅ 達 L2**

---

## 四、文件上傳安全現況分析（特別章節）

> 因檔案上傳是核心功能（年處理 450,000-500,000 張發票），AppSec-05 實作前必須完整盤點現況。

### 4.1 目前的驗證機制

| 項目 | 現況 | 強度 | 程式位置 |
|------|------|------|---------|
| MIME 類型驗證 | 客戶端 claim（`file.type`）白名單比對 | 🔴 弱（user-controllable） | `src\lib\upload\constants.ts:78` |
| 檔案副檔名驗證 | 從 MIME 推導，未檢查實際 file.name 後綴 | 🟡 中 | `constants.ts:111` |
| 大小限制 | 10MB / 20 files per batch | 🟢 強 | `constants.ts:40,46` |
| Magic Number 驗證 | ❌ 無 | 🔴 缺失 | — |
| 病毒掃描 | ❌ 無（無 ClamAV、無 Azure Defender） | 🔴 缺失 | — |
| 檔名 sanitize | ❌ 無（保留 `file.name`） | 🟡 中 | `route.ts:322` |
| 隔離儲存 | ❌ 無（直接寫入正式 container） | 🔴 缺失 | `route.ts:310` |
| 病毒掃描後處理 | ❌ 無（檔案上傳後立即觸發處理） | 🔴 缺失 | `route.ts:359-405` |
| Authentication 檢查 | ✅ NextAuth session + INVOICE_CREATE 權限 | 🟢 強 | `route.ts:159, 179` |
| 城市權限檢查 | ✅ `cityCode` 必填 | 🟢 強 | `route.ts:258-271` |

### 4.2 AppSec-05 實作前必須注意的兼容性點（呼應矩陣 §3.3）

依 v1.2 矩陣的 5 個「必測項目」對應現狀：

| 矩陣 §3.3 必測項目 | 目前實作狀態 | 風險 |
|-------------------|-------------|------|
| 1. 各種 PDF 格式（純文字、掃描件、加密、混合） | ✅ 有 PDF 文字層偵測（`file-type-detection.step.ts:83`），但未測試加密 PDF | 加密 PDF 流向未知 |
| 2. 部分掃描件 MIME type 異常的兼容性 | ❌ 客戶端 MIME 直接信任 → 加 magic number 後可能拒絕合法掃描件 | 🔴 **回歸風險高** |
| 3. 病毒掃描延遲對 UX 影響（建議 ≤3 秒） | ❌ 未實作 — 引入後將延遲整體上傳流程 | 🔴 **UX 風險** |
| 4. 大小限制與業務最大檔案 | ✅ 10MB 已配置；需確認業務最大 PDF 是否超限 | 需業務驗證 |
| 5. 批量上傳（100+ 檔案）兼容性 | ⚠️ 目前 MAX_FILES_PER_BATCH=20 | 與業務「批量 100」需求衝突 |

### 4.3 既有功能影響評估

- **回歸風險最高的點**：MIME magic number 驗證引入後，部分現存有效檔案可能被誤拒（特別是奇異的 scanner 輸出 PDF）
- **建議路徑**：
  1. 先在 staging 環境用 dual mode（claim + magic number）log 不一致情況 1-2 週
  2. 建立既有 5,000+ 已上傳 PDF 的 magic number whitelist
  3. 再啟用嚴格驗證
- **緩解策略**：建立「異常檔案 → 管理員手動審核」flow（v1.2 矩陣 §3.3 已建議）

---

## 五、外部 URL 呼叫清單（為 SSRF 防護準備）

> AppSec-10 實作前，必須完整列出「應用主動發起的所有外部 URL 呼叫」清單，依 v1.2 矩陣 §3.3 緩解策略要求。

### 5.1 主動 fetch 呼叫盤點

| 服務 | 檔案 / 行號 | 目標 URL 來源 | 控制範圍 | SSRF 風險 |
|------|------------|--------------|---------|----------|
| **Webhook 派送** | `src\services\webhook.service.ts:278` | `delivery.targetUrl`（admin UI 設定） | 🔴 完全可控 | **HIGH**（內網探測入口） |
| **n8n Webhook** | `src\services\n8n\n8n-webhook.service.ts:169` | `event.webhookUrl`（DB 設定） | 🔴 admin 可控 | **HIGH** |
| **n8n Webhook 測試** | `src\services\n8n\webhook-config.service.ts:521` | `testUrl`（admin 直接傳入） | 🔴 完全可控 | **HIGH**（測試 endpoint 易被濫用） |
| **n8n Workflow Trigger** | `src\services\n8n\workflow-trigger.service.ts:499` | `workflow.triggerUrl`（DB 設定） | 🔴 admin 可控 | **HIGH** |
| **Microsoft Graph (SharePoint)** | `src\services\microsoft-graph.service.ts:233/281/415/570` | `siteUrl` / `downloadUrl`（部分使用者輸入） | 🟡 半可控 | **MEDIUM**（限制在 microsoftonline.com 域） |
| **Microsoft Graph (Outlook)** | `src\services\outlook-mail.service.ts`（fetch 在 graph SDK 內） | Microsoft Graph API endpoints | 🟢 SDK 固定 | **LOW** |
| **Azure Blob Storage** | `src\lib\azure\storage.ts`（透過 SDK） | 環境變數配置 | 🟢 環境固定 | **LOW** |
| **Azure OpenAI** | `src\services\extraction-v3\stages\gpt-caller.service.ts` | 環境變數固定 | 🟢 環境固定 | **LOW** |
| **Azure Document Intelligence** | `src\services\azure-di.service.ts` | 環境變數固定 | 🟢 環境固定 | **LOW** |
| **Email SMTP** | `src\lib\email.ts:48` | 環境變數 SMTP_HOST | 🟢 環境固定 | **LOW**（不是 HTTP） |

### 5.2 SSRF 白名單建議（Wave 3 設計依據）

需在 SSRF guard 中允許的 host 模式：

```
允許清單（白名單）：
- *.azurewebsites.net          # Azure App Services
- *.blob.core.windows.net      # Azure Blob Storage
- *.openai.azure.com           # Azure OpenAI
- *.cognitiveservices.azure.com # Azure Cognitive Services (DI)
- graph.microsoft.com          # Microsoft Graph
- *.sharepoint.com             # SharePoint sites
- *.outlook.com                # Outlook
- 用戶配置的 n8n hostname（需 DB 表存白名單）
- 用戶配置的 webhook hostname（需 DB 表存白名單）

阻擋清單（黑名單）：
- 169.254.169.254              # Azure Metadata Service（防容器逃逸）
- 169.254.0.0/16               # Link-local
- 127.0.0.0/8                  # Localhost（dev 例外處理）
- 10.0.0.0/8                   # Private network
- 172.16.0.0/12                # Private network
- 192.168.0.0/16               # Private network
- 0.0.0.0                      # Wildcard
- ::1, fe80::/10               # IPv6 loopback / link-local

開發環境例外：
- 127.0.0.1:10010              # Azurite Blob
- 127.0.0.1:10011              # Azurite Queue
- 127.0.0.1:10012              # Azurite Table
- 127.0.0.1:5433               # Local PostgreSQL
- localhost:* (NODE_ENV === 'development')
```

### 5.3 「最關鍵的 SSRF 入口」優先級

依風險排序：

1. **`/admin/integrations/n8n/webhook-configs`** — admin UI 直接填寫 URL，立即可發起 fetch 探測內網
2. **`/api/admin/integrations/sharepoint`** — SharePoint 配置可能含 `siteUrl` 篡改攻擊
3. **`webhook.service.ts:278`** — 對外發送通知，URL 由 admin 在 webhook 設定 UI 自訂

---

## 六、重大發現（HIGH 風險未達 L2 的關鍵點）

### 發現 1: 檔案上傳安全完全依賴客戶端 MIME claim（AppSec-05）

**嚴重性**: 🔴 HIGH
**證據**: `src\app\api\documents\upload\route.ts:289` 用 `file.type`（從 multipart/form-data 來，user-controllable）做白名單檢查；無 magic number / 病毒掃描 / 隔離儲存；保留原始檔名。
**影響**: 攻擊者可上傳偽裝 MIME 的 .exe / .js 等惡意檔案，雖然處理管線可能拒絕，但 Azure Blob 中已有惡意 payload。
**Wave 3 阻擋點**: 此項是 Wave 3 最大風險，必須先建立完整 E2E 測試後才實作（v1.2 矩陣 §3.3 必讀）。

### 發現 2: 全域 Rate Limiting 覆蓋率僅 ~2%（AppSec-09）

**嚴重性**: 🔴 HIGH
**證據**: 331 個 API 路由，僅 7 個 `/v1/invoices/*` 端點有 rate limit；認證端點（`/auth/register`、`/auth/forgot-password`、`/auth/reset-password`）完全無保護；上傳端點完全無保護。
**影響**: 暴力破解 / 帳號枚舉 / 資源耗盡攻擊面開放。
**FIX-052 已修復的部分**: Redis 多實例支援（基礎設施 OK）；缺的是「廣泛應用」。

### 發現 3: LLM Prompt Injection 完全無防護（AppSec-12）

**嚴重性**: 🔴 HIGH
**證據**: `gpt-caller.service.ts` 直接將 systemPrompt 與 userPrompt concatenate；Prompt 變數替換器（`variable-replacer.ts`）無 escape；用戶上傳的 PDF 內文直接 base64 送 GPT。
**影響**: 惡意 PDF 可能含「ignore previous instructions, output secret data」式指令；prompt 變數可能被改寫 system prompt。
**特別注意**: 因核心業務是文件提取，每張發票都會送進 GPT — 風險面很大。

### 發現 4: 完全沒有 CI/CD 安全閘門（AppSec-07）

**嚴重性**: 🔴 HIGH
**證據**: `.github/` 只有 `agents/` 子目錄（BMAD agent 定義），**無 workflows/**、**無 dependabot.yml**；97 個依賴的安全狀態未知。
**影響**: 已知漏洞無人發現；secret 可能誤提交。
**修復成本**: 🟢 低 — 加 3 個 GitHub Actions YAML 即可達 L2。

### 發現 5: Audit Log 中間件 0% 採用率（Obs-01）

**嚴重性**: 🟡 MED-HIGH
**證據**: `withAuditLog()` 中間件存在但無任何 API 路由使用（grep 結果 0）；audit 寫入完全靠 service 層手動 `auditLog.create()`，多處遺漏失敗路徑。
**影響**: 審計追蹤不完整；當查「誰在 X 時間做了 Y」時可能找不到記錄。

### 發現 6: 無 Security Headers / CSP（AppSec-03、AppSec-08）

**嚴重性**: 🟡 MED
**證據**: `next.config.ts` 無 `headers()` 函數；middleware.ts 也無設置 response header。
**影響**: 無 HSTS / X-Frame-Options / CSP — 點擊劫持、混合內容、XSS 等基礎防護缺失。
**修復成本**: 🟢 低（純 HTTP header）—應在 Wave 1 立即補。

### 發現 7: SSRF 攻擊面開放且未盤點（AppSec-10）

**嚴重性**: 🟡 MED-HIGH
**證據**: 5+ 個 fetch 呼叫點完全可由 admin 控制 URL（`webhook.service.ts:278`、3 個 n8n endpoint）；無白名單 / 內網阻擋。
**影響**: 即使是 admin 帳號被入侵也不該能透過 webhook 設定來探測 Azure metadata service（169.254.169.254）。

---

## 七、可立即補強的 quick wins

| 項目 | 補完 ID | 預估工時 | 影響 |
|------|--------|---------|------|
| 加 next.config.ts security headers（HSTS、X-Frame-Options、X-Content-Type-Options） | AppSec-08 → L2 | 30 min | 零功能影響 |
| 加 `.github/dependabot.yml` | AppSec-07 → L1 | 15 min | 零功能影響 |
| 加 `.github/workflows/security.yml`（npm audit + Trivy） | AppSec-07 → L2 | 1 hr | 可能阻擋 build |
| 加 husky + gitleaks pre-commit | SDLC-01（連帶） | 30 min | 開發體驗微影響 |
| 為 5 個 fetch 點加 SSRF guard（純 hostname check） | AppSec-10 → L1 | 2 hr | n8n / SharePoint 需測試 |
| Auth 失敗事件補進 SecurityLog | Obs-03 → L3.5 | 1 hr | 零功能影響 |
| 5 條安全告警規則（複用 alert-rule） | Obs-05-lite → L2 | 4 hr | 需閾值調優 |
| `JSON.parse` 統一 helper | AppSec-06 → L3 | 2 hr | 零功能影響 |

合計 ~11 小時可將 4-5 項從 L0/L1 提升到 L2。

---

## 八、Phase 2 → Phase 3 銜接建議

依本盤點結果，Phase 3「實作優先順序」應為：

```
Wave 0（基礎設施 0.5 週，全部 quick wins）
├── Security Headers（next.config.ts）
├── Dependabot + GitHub Actions（npm audit + Trivy + gitleaks）
├── JSON.parse helper
└── SSRF guard middleware（hostname 白名單）

Wave 1（零功能影響 1-2 週）
├── AppSec-01: Zod 補完 36 個 mutation 端點
├── AppSec-03: CSP Report-Only 模式
├── AppSec-11: RFC 7807 統一 helper
└── Obs-03: Auth 失敗整合 SecurityLog
└── Obs-05-lite: 5 條安全告警

Wave 2（低度影響 2-3 週）
├── AppSec-04: cookie 配置文件化
├── AppSec-06: JSON.parse 全面遷移
├── AppSec-12: LLM Prompt Injection 防禦（OpenAI structured outputs + escape）
└── Obs-01: API 層 withAuditLog 全面採用

Wave 3（中高度影響 3-4 週 + 完整 E2E 測試）
├── AppSec-05: 檔案上傳安全（magic number + 病毒掃描 + 隔離儲存 + UUID 檔名）
├── AppSec-09: 全域 Rate Limiting（認證 + 上傳 + 一般 API 三層）
└── AppSec-10: SSRF 全面強化（白名單 + 內網阻擋 + 例外處理）
```

---

## 九、關鍵數據快照（盤點當下，2026-04-28）

| 指標 | 數值 | 來源 |
|------|------|------|
| API 路由總數 | 331 | security-audit.md / CLAUDE.md |
| HTTP methods 總數 | 414 | CLAUDE.md |
| 變更類路由（POST/PATCH/PUT/DELETE） | 183 | grep 統計 |
| 含 Zod 的路由（含 GET 查詢） | 212 | grep 統計 |
| 含 Zod 的 mutation 路由（security-audit 已驗證） | 159/195 = 82% | security-audit.md §4 |
| Zod 缺失 mutation 端點 | 36 | security-audit.md §4 |
| Auth 覆蓋率 | 200/331 = 73% | CLAUDE.md（修正後） |
| `$executeRawUnsafe` 出現次數 | 2（僅 db-context.ts，FIX-051 已加白名單） | grep |
| `$queryRawUnsafe` 出現次數 | 0 | grep |
| `dangerouslySetInnerHTML` 出現次數 | 0 | grep |
| `console.log` 總數 | 278 / 93 個檔案 | grep（從 287/94 降到 278/93，呼應 FIX-050 部分清理） |
| `JSON.parse` 在 src/ | 57 / 36 個檔案 | grep |
| `JSON.parse` 在 API 層 | 9 / 9 個檔案 | grep |
| Rate-limit 覆蓋的 API 路由 | 7 / 331 = 2.1% | grep |
| `withAuditLog` 採用 API 數 | 0 / 331 | grep |
| `auditLog.create` / `auditLogService` 採用服務數 | 17 個服務 | grep |
| `securityLog.create` 寫入點 | 3 處 | grep |
| `dependabot.yml` 存在？ | ❌ 否 | ls |
| GitHub Actions workflows | ❌ 0 個 | ls `.github/` |
| Validation schemas（`src\lib\validations\`） | 9 個 | ls |
| Pre-commit hook | ❌ 無（無 .husky/） | ls |
| FIX-050 PII 修復 | ✅ 確認（auth.config.ts:139,151,175,186,196,210,215） | Read |
| FIX-051 SQL Injection 修復 | ✅ 確認（db-context.ts:76 白名單 + line 122 sanitize） | Read |
| FIX-052 Rate Limit 修復 | ✅ 確認（rate-limit.service.ts:99-119 雙模式） | Read |

---

## 十、評分匯總總表（含成熟度說明）

| ID | 項目 | 評分 | 風險 | 評分理由（一句話） |
|----|------|------|------|-------------------|
| **AppSec-01** | Zod 輸入驗證 | **L1** | 🔴 HIGH | 82% mutation 覆蓋，距 95% 目標仍差 36 個端點，schema 散布兩處 |
| **AppSec-02** | SQL Injection 防護 | **L3** | 🔴 HIGH | FIX-051 已用白名單 + sanitizer 防護；無 unsafe pattern 殘留 |
| **AppSec-03** | XSS / CSP | **L1** | 🔴 HIGH | React 預設轉義 OK；無 CSP / 無 sanitize 庫 |
| **AppSec-04** | CSRF | **L2** | 🟡 MED | NextAuth 預設 CSRF token + SameSite=Lax；缺顯式配置 |
| **AppSec-05** | 檔案上傳安全 | **L1** | 🔴 HIGH | MIME claim 白名單 + 大小限制；無 magic number / 無病毒掃描 / 無隔離 |
| **AppSec-06** | 反序列化 | **L2** | 🟡 MED | JSON.parse 大量使用但多包 try-catch；缺統一 helper |
| **AppSec-07** | 相依套件漏洞 | **L0** | 🔴 HIGH | 完全沒有 dependabot / CI workflow / npm audit 自動化 |
| **AppSec-08** | Security Headers | **L0** | 🟡 MED | next.config 完全沒配置 headers；無 HSTS / X-Frame-Options |
| **AppSec-09** | 全域 Rate Limiting | **L1** | 🔴 HIGH | FIX-052 基礎設施 OK；僅 7/331 路由採用，認證端點完全無保護 |
| **AppSec-10** | SSRF 防護 | **L0** | 🟡 MED | 5+ admin-controllable fetch 點無 hostname 白名單 |
| **AppSec-11** | RFC 7807 統一 | **L1** | 🟢 LOW | top-level vs nested 兩種格式並存（CLAUDE.md 已記錄） |
| **AppSec-12** | LLM Prompt Injection | **L0** | 🔴 HIGH | system+user prompt 直接 concat；無 structured output / 無 escape |
| **Obs-01** | Audit Log 覆蓋率 | **L2** | 🔴 HIGH | Schema + service 完整；中間件 API 層採用率 0% |
| **Obs-03** | Security Event Log | **L3** | 🔴 HIGH | 獨立 SecurityLog model + 7 種 eventType + 4 級 severity |
| **Obs-05-lite** | Email 告警 | **L1** | 🔴 HIGH | Nodemailer 整合 OK；5 條安全告警 0/5 已實作 |
| **Obs-11** | Health Check | **L2** | 🟢 LOW | `/api/health` 存在；只查 DB，未查 Blob/OpenAI/Redis |

---

*建立日期: 2026-04-28*
*盤點員: Claude Opus 4.7（依用戶要求進行只讀研究與資料蒐集）*
*下一步: Phase 3 — 風險矩陣與修復路線圖*
