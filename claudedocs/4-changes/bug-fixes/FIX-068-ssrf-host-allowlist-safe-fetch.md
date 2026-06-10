# FIX-068: SSRF host 白名單（共用 safeFetch + Python 對等防護）

> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `python-services/extraction`（`/extract/url`）、`src/services/n8n/*`（webhook 投遞與連線測試）、`src/services/invoice-submission.service.ts`（URL 抓檔）
> **優先級**: 高
> **狀態**: ✅ 已修復（2026-06-10）
> **實作摘要**: 新建 `src/lib/security/safe-fetch.ts`（`assertSafeUrl`/`safeFetch`/`isBlockedIp`，含 DNS rebinding 防護 + IPv4-mapped IPv6 正規化 + `SSRF_ALLOWED_HOSTS` env 覆寫）；3 個 Node 端點（n8n-webhook、webhook-config、invoice-submission）改用 `safeFetch`；新建 Python `security/` package（`safe_url.py` + `__init__.py`），`extract/url` handler 加 `assert_safe_url` 前置驗證；`.env.example` 補 `SSRF_ALLOWED_HOSTS`。type-check `src/` 零錯誤、eslint 本批無 error、Python `py_compile` 通過、新檔 `ruff` 乾淨。
> **來源**: SECURITY-ASSESSMENT.md §5 主題 D、§6 模式 4、REMEDIATION-ROADMAP.md WP-5
> **相依**: Node 側共用 safeFetch；Python 側獨立實作（與 WP-8 同檔但不同議題）

---

## 問題描述

多個端點以「使用者可控制的 URL」直接發出出站請求，且未對目標 host 做白名單／私網位址封鎖。攻擊者可指定內網位址（如雲端 metadata 端點 `169.254.169.254`、容器內部服務、資料庫管理介面）誘使伺服器代為請求，造成 SSRF（Server-Side Request Forgery）。部分端點的回應內容會被寫入資料庫並可被回讀，進一步形成「盲打 → 內容外洩」鏈。

| # | 端點:行 | 問題 | 嚴重度 |
|---|---------|------|--------|
| PY-02 | `python-services/extraction/src/main.py:200`（`/extract/url`）→ `src/ocr/processor.py:76` `process_from_url` | 接收使用者任意 `documentUrl`，未驗證 host 即交由 Azure DI 抓取（`analyze_document_from_url`） | High |
| G-01 (n8n) | `src/services/n8n/n8n-webhook.service.ts:169` | 以 `event.webhookUrl`（使用者配置）直接 `fetch` POST，回應 body 被儲存可回讀 | High |
| G-02 (n8n) | `src/services/n8n/webhook-config.service.ts:514,521` | 以使用者提供的 `baseUrl` 組 `testUrl` 後 `fetch`，連線測試回應內容回傳前端 | High |
| G-01 (invoice) | `src/services/invoice-submission.service.ts:293`（`fetchFromUrl`）→ 實際 `fetch` 在第 305 行 | 僅驗證 protocol 為 http/https，未封鎖私網 host，即抓取使用者 URL 內容 | High |

> **附帶範圍（Medium，可同批一併套用 safeFetch，不另立 FIX）**：
> - v1-1 G-01、services-root-3 D-02/D-03、CORE-02（SECURITY-ASSESSMENT §6 模式 4 命中 python / n8n / services-root-2/3）。
> - REMEDIATION-ROADMAP WP-5 策略另提及「SharePoint URL / Graph URL」套用點（`sharepoint-document.service.ts`、`microsoft-graph.service.ts`）；惟此類 host 通常為固定信任端點（`*.sharepoint.com`、`graph.microsoft.com`），是否納入 allowlist 由實作時確認，不在本 FIX 的 4 個 High 核心內。

### 行號偏移註記
- `invoice-submission.service.ts`：SECURITY-ASSESSMENT 標 `:293`，實測第 293 行為 `fetchFromUrl` 函數定義開頭，真正的 `fetch(url, ...)` 在第 305 行（前置有 protocol 檢查在 300-303 行）。本文件以「函數 293 / fetch 305」如實標註。
- `webhook-config.service.ts`：SECURITY-ASSESSMENT 標 `:521`，第 521 行確為 `fetch(testUrl, ...)`；`testUrl` 由第 514 行的使用者 `baseUrl` 組成。

---

## 重現步驟

以 PY-02 為例：
1. 對 extraction service 發送 `POST /extract/url`，body 帶 `{ "documentUrl": "http://169.254.169.254/latest/meta-data/", "documentId": "x" }`
2. 觀察現象：伺服器代為向雲端 metadata 端點發出請求（應在 host 驗證階段即拒絕並回 400/403）

以 G-02 為例：
1. 呼叫 webhook 連線測試，`baseUrl` 設為 `http://127.0.0.1:5432`（或其他內網服務）
2. 觀察現象：伺服器對內網位址發出請求，連線測試回應內容回傳前端，洩漏內部服務探測結果

---

## 根本原因

- **缺共用「安全外呼」工具**：Node 與 Python 兩側皆無統一的 URL 驗證 / 私網封鎖層；各 handler 各自 `fetch`／`process_from_url`，逐點手寫導致全數遺漏。
- **既有檢查不足**：`invoice-submission.service.ts` 僅檢查 protocol（http/https），未做 host／IP 層判斷；其餘端點連 protocol 檢查都沒有。
- **DNS rebinding 未防護**：即使檢查 hostname，未在「解析後的實際 IP」層再驗證，仍可被 DNS rebinding 繞過。
- **回應內容回讀放大風險**：n8n webhook event 與連線測試會儲存／回傳回應內容，使盲打 SSRF 升級為內容外洩。

> **既有工具盤點結果（已用 Grep 驗證）**：`src/lib/` 下**無任何**現成的 URL 驗證／SSRF 防護／safeFetch 工具可擴充（搜尋 `safeFetch`、`validateUrl`、`isPrivateIp`、`ssrf`、`169.254`、`blockPrivate` 等均無命中）。`invoice-submission.service.ts` 內僅有零散的 protocol 檢查（300-303 行），不足以複用。因此需**新建**共用工具，而非擴充既有。

---

## 解決方案

### 核心策略（roadmap WP-5）

抽出共用「安全外呼」工具 `safeFetch`，在發出任何使用者可控 URL 的出站請求前，封鎖內網／雲端 metadata 位址；對 callbackUrl / baseUrl / SharePoint / Graph URL / webhook 等套用。Python 側因屬獨立 runtime，獨立實作對等防護。

### Node 側：`src/lib/security/safe-fetch.ts`（新建）

設計要點：
1. **`assertSafeUrl(url: string)`**（純驗證，可單元測試）
   - 解析 `new URL(url)`；protocol 僅允許 `http:` / `https:`（拒絕 `file:`、`gopher:`、`ftp:` 等）。
   - 取得 hostname，拒絕 `localhost`、`*.localhost`、`.local`、空 host、IP 字面值落在封鎖網段者。
   - **DNS 解析後再驗證**：`dns.lookup(hostname, { all: true })` 取得所有解析 IP，逐一比對封鎖網段；任一落入私網即拒絕（防 DNS rebinding）。
2. **`safeFetch(url, init)`**：先 `await assertSafeUrl(url)`，通過才呼叫原生 `fetch`；保留呼叫端原有的 `AbortController` / timeout / headers 行為（僅插入前置驗證，不改變回傳介面）。
3. 失敗時 throw 既有 `ApiError`／服務層自訂 Error（如 `n8n-webhook` 既有錯誤模式），由呼叫端轉為 4xx，符合 RFC 7807。

### 封鎖位址清單（Node 與 Python 共用同一份語意）

| 類別 | 範圍 |
|------|------|
| Loopback (IPv4) | `127.0.0.0/8` |
| Loopback / unspecified (IPv6) | `::1`、`::` |
| 私網 A | `10.0.0.0/8` |
| 私網 B | `172.16.0.0/12`（即 `172.16.x` ~ `172.31.x`） |
| 私網 C | `192.168.0.0/16` |
| Link-local / 雲端 metadata | `169.254.0.0/16`（含 `169.254.169.254`） |
| IPv6 link-local | `fe80::/10` |
| IPv6 unique-local | `fc00::/7` |
| 主機名 | `localhost`、`*.localhost`、`.local` 結尾、空 host |
| Protocol | 僅允許 `http:` / `https:` |

> IPv4-mapped IPv6（如 `::ffff:127.0.0.1`）需正規化後再比對，避免繞過。

### Node 側套用點

| 端點 | 改法 |
|------|------|
| `src/services/n8n/n8n-webhook.service.ts:169` | `fetch(event.webhookUrl, ...)` → `safeFetch(event.webhookUrl, ...)` |
| `src/services/n8n/webhook-config.service.ts:521` | `fetch(testUrl, ...)` → `safeFetch(testUrl, ...)`（`testUrl` 源自使用者 `baseUrl`） |
| `src/services/invoice-submission.service.ts:305` | `fetch(url, ...)` → `safeFetch(url, ...)`，並移除／合併原 300-303 行的 protocol 重複檢查 |

### Python 側：`python-services/extraction/src/security/safe_url.py`（新建，對等防護）

設計要點：
1. **`assert_safe_url(url: str) -> None`**：解析 URL，protocol 限 http/https；`socket.getaddrinfo(host, None)` 取得解析 IP，以 `ipaddress.ip_address(ip).is_private / is_loopback / is_link_local / is_reserved` 判斷並封鎖；另顯式封鎖 `169.254.169.254`、`localhost`。
2. **套用點**：`src/main.py:200` `extract_from_url` handler 在呼叫 `processor.process_from_url(...)` 前先 `assert_safe_url(request.documentUrl)`；驗證失敗回 `400`／`403`。
   - 備選：在 `processor.py:76` `process_from_url` 入口統一守門（集中度更高，但 handler 層攔截可更早回應）。實作時擇一，避免雙重維護。
3. 與 WP-8（Python 服務認證 + rate limit）**同檔案範圍但不同議題**：WP-8 處理「誰能呼叫服務」，本 FIX 處理「服務能呼叫哪些外部 host」，兩者互補，可同批改但需分別記錄。

### i18n / RFC 7807 影響

- SSRF 拒絕屬伺服器端安全攔截，錯誤訊息為**開發者導向**（如 `throw new ApiError('SSRF_BLOCKED', 'Target host is not allowed', 403)`），不直接面向終端使用者 UI，故**不觸發 H5 i18n 同步**。若呼叫端 API route 需回前端友善訊息，沿用既有 `i18n-api-error` 包裝層即可，本 FIX 不新增 UI 字串。
- Node 側錯誤回應沿用 RFC 7807 top-level 格式（`type`/`title`/`status`/`detail`）。

---

## 修改的檔案

| 檔案 | 修改內容 | 側 |
|------|----------|-----|
| `src/lib/security/safe-fetch.ts`（新建） | `assertSafeUrl` + `safeFetch`，含封鎖網段判斷 + DNS 解析後驗證 | Node |
| `src/services/n8n/n8n-webhook.service.ts` | `fetch` → `safeFetch`（webhookUrl 投遞） | Node |
| `src/services/n8n/webhook-config.service.ts` | `fetch` → `safeFetch`（baseUrl 連線測試） | Node |
| `src/services/invoice-submission.service.ts` | `fetch` → `safeFetch`（URL 抓檔），整併原 protocol 檢查 | Node |
| `python-services/extraction/src/security/safe_url.py`（新建） | `assert_safe_url`，對等封鎖私網／metadata | Python |
| `python-services/extraction/src/main.py` | `/extract/url` handler 加 `assert_safe_url` 前置驗證 | Python |

> 附帶 Medium 套用點（v1-1、services-root-3、SharePoint/Graph）若一併處理，於實作時補入本表並標註「附帶範圍」。

---

## 測試驗證

**程式碼層面（已驗證 2026-06-10）**
- [x] 4 個 High 端點皆改用 `safeFetch` / `assert_safe_url`（grep 確認無殘留裸 `await fetch(`）
- [x] `npm run type-check`：`src/` 零錯誤
- [x] `npm run lint`（eslint）：本批 Node 檔案無 error/warning
- [x] Python `py_compile` 通過；新檔 `security/` `ruff` All checks passed
- [x] 封鎖邏輯已實作於 `safe-fetch.ts` / `safe_url.py`（含全封鎖清單、IPv4-mapped IPv6 正規化、DNS 解析後驗證、protocol 限制、`SSRF_ALLOWED_HOSTS` 覆寫）

**單元測試（待測試框架就緒）**
- [ ] ⚠️ 專案目前**無** vitest/jest 依賴與 test script（`tests/` 既有 .test.ts 未配置）；裝測試框架屬另一議題（H2/獨立 FIX）。下列待框架就緒後補：
  - [ ] `assertSafeUrl` / `assert_safe_url` 對封鎖清單每網段（`127.0.0.1`/`10.0.0.1`/`172.16.0.1`/`192.168.1.1`/`169.254.169.254`/`::1`/`localhost`/`foo.local`）皆拒絕
  - [ ] 合法外部 host（`https://example.com`）允許通過；`file://`/`gopher://` 被拒絕
  - [ ] DNS rebinding（mock `dns.lookup`/`getaddrinfo` 解析到私網）被拒絕；`::ffff:127.0.0.1` 正規化後被拒絕

**執行期（待 staging 驗證）**
- [ ] PY-02：`POST /extract/url` 帶 `169.254.169.254` → 400/403，不發出實際請求
- [ ] G-01 (n8n)：webhookUrl 設內網位址 → 投遞被攔截，event 標記失敗
- [ ] G-02：連線測試 `baseUrl` 設 `127.0.0.1:5432` → 攔截，不洩漏內部探測結果
- [ ] G-01 (invoice)：URL 抓檔指向內網 → 攔截
- [ ] 合法外部 webhook / URL 回歸正常（無誤殺）

---

## 已知差異 / 待確認

| 項目 | 說明 |
|------|------|
| SharePoint / Graph 是否納入 allowlist | roadmap 提及套用點，但其 host 多為固定信任端點；實作時確認是否需 allowlist 或維持現狀（可能為 false positive 風險） |
| Node 內網部署誤殺 | 若有合法的內部服務 webhook（如 docker network 內 n8n），需提供「允許清單覆寫」設定（env-driven，預設全封鎖）；此屬實作時與部署拓撲確認 |
| Python 守門層級 | handler 層 vs `processor.py` 入口層，擇一實作避免雙重維護 |

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10（已實作：safe-fetch.ts + Python safe_url.py + 4 端點套用）*

---

## 實作差異 / 既知事項

| 項目 | 說明 |
|------|------|
| `SSRF_ALLOWED_HOSTS` env 覆寫 | 依立案「已知差異」加入，供 docker network 內合法 n8n 等內部服務放行；預設空（全封鎖） |
| 附帶 Medium 範圍（SharePoint/Graph、v1-1、services-root-3） | 本次未納入，維持 4 個 High 核心；可後續分批以同一 `safeFetch` 套用 |
| Python 守門層級 | 採 handler 層（`extract/url`）攔截，可更早回應；未在 `processor.py` 重複守門，避免雙重維護 |
| `main.py` 既有 `import os` unused（ruff F401） | **非本批造成**（grep 確認無 `os.` 使用），依 H3 未順手移除，建議另立清理 |
| 單元測試 | 專案無 vitest/jest 配置，未能撰寫可執行單測；封鎖邏輯經程式碼審查確認，待測試框架就緒補單測 |
