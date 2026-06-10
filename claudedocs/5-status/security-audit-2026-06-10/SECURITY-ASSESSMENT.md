# 全面安全與風險評估報告

> **審查日期**：2026-06-10
> **審查方式**：file-by-file / line-by-line，36 個範圍並行審查，1,523 個檔案全部逐行讀取
> **審查範圍**：`src/`（app / components / services / hooks / lib / types / middleware 等）、`python-services/`、`scripts/`、`prisma/`、根目錄配置檔
> **方法**：每個檔案以 11 個維度（認證授權、注入、輸入驗證、Secrets、PII、XSS、SSRF、檔案處理、認證機制、資訊洩漏、其他風險）逐行檢查
> **個別報告**：`claudedocs/5-status/security-audit-2026-06-10/reports/`（36 份）

---

## 1. 執行摘要

本次對整個 codebase 進行了最高仔細等級的逐檔逐行安全審查，覆蓋 **1,523 個檔案、約 50 萬行代碼**，分 36 個範圍並行執行，全部完整讀取（無抽樣）。

### 總體發現統計

| 嚴重度 | 數量 | 說明 |
|--------|------|------|
| 🔴 Critical | **10** | 可被未授權者直接利用，造成資料外洩 / 篡改 / 任意檔案寫入 |
| 🟠 High | **37** | 已登入低權限者越權、認證後門、SSRF、ReDoS、硬編碼憑證 |

> **2026-06-10 定級修正**：原 I-01「免密碼登入」經逐行驗證後由 Critical 降為 High（詳見 §2）。登入 `authorize`（`auth.config.ts:129`）採 `NODE_ENV==='development' && !isAzureADConfigured()`，故 `NODE_ENV=production` 下仍走真實密碼驗證，「免密碼登入」僅在本地開發成立。Critical 11→10、High 36→37。
| 🟡 Medium | **75** | 縱深防禦缺層、公式注入、無界查詢、服務層授權缺口 |
| 🔵 Low | **112** | 最佳實踐缺失、理論性風險、倉庫衛生 |
| ⚪ Info | **104** | 觀察與建議 |
| **總計** | **338** | |

### 總體安全評分：**4.5 / 10（中低，需立即處置）**

雖然在**注入防護**（Prisma 全面參數化，幾乎無 SQL injection）、**密鑰儲存**（API Key SHA-256、Webhook AES-256-GCM）、**前端衛生**（零 `dangerouslySetInnerHTML`、零客戶端 import prisma）三方面表現良好，但**認證授權層存在系統性、可被未授權者直接利用的重大缺陷**，且有一個**認證 fail-open 後門被 5 個獨立審查範圍重複命中**，將評分大幅拉低。

---

## 2. 🔴 最高優先：認證 Fail-Open 後門（5 個範圍重複命中，單一根因）

> **這是本次審查最危險的發現，必須最優先修復。**

**根因檔案**：`src/lib/auth.ts`（`getAuthSession` / `isDevelopmentMode`）

**問題**：`auth.ts:92` 的 `isDevelopmentMode()` 用 `NODE_ENV==='development' || !isAzureADConfigured()`，而登入 `authorize`（`auth.config.ts:129`）用 `NODE_ENV==='development' && !isAzureADConfigured()` — **兩處邏輯不一致**（`||` vs `&&`），且 `auth.ts:80-85` 註解錯誤聲稱兩者一致。據此精確區分兩個風險：

1. **`X-Dev-Bypass-Auth` HTTP header 後門（屬實，High）**：`getAuthSession(request)` 在 `isDevelopmentMode()`（`||` 版本）為真時，帶此 header → 回傳全域管理員 mock session。在「`NODE_ENV=production` 但 Azure AD 未配置」即生效。**影響面：僅 5 個使用 `getAuthSession(request)` 的 historical-data 端點**（已 grep 確認，非系統性）。
2. **「免密碼登入」（降級為 High — 部署陷阱）**：登入 `authorize` 用 `&&`，故 `NODE_ENV=production` 下即使 Azure AD 未配置仍走**真實 bcrypt 密碼驗證**，「免密碼登入」**僅在 `NODE_ENV=development` 成立**。真正風險是 `.env.example:56` 預設 `NODE_ENV="development"`，生產若沿用此預設則完整 dev 後門全開。
3. **本地帳號不受影響**：seed 的 `admin@ai-document-extraction.com`（有密碼、isGlobalAdmin）走獨立真實驗證，故 fail-closed 修復對正常登入幾乎零影響。

**重複命中此根因的範圍**：
- `api-identity` I-01（Critical）+ I-02（High）
- `api-admin-0` ADMIN0-06（High）
- `api-admin-1` ADMIN-1-004（High）
- `lib-0` AUTH-01（High）

**影響**：若任何可達環境（UAT、staging、或 Azure AD 配置中斷期間的生產）處於此狀態，整個系統等同無認證，攻擊者可冒充全域管理員執行任意操作。配合 §3 的 middleware 缺陷，後果最大化。

**建議**：
1. `isDevelopmentMode()` **只認 `NODE_ENV === 'development'`**，移除 `|| !isAzureADConfigured()` 條件。
2. `X-Dev-Bypass-Auth` 邏輯加上 `NODE_ENV === 'development'` 硬性 gate，並在 build 時對 production bundle 完全剝除。
3. Azure AD 未配置時應 **fail-closed**（拒絕所有登入），而非降級放行。

---

## 3. 🔴 系統性根因：Middleware 不保護任何 /api 路由

**根因檔案**：`src/middleware.ts:90-98`（matcher 與函數體雙重排除所有 `/api`）

**問題**：全域 middleware 對**所有** `/api/*` 路徑直接放行，API 的認證完全依賴每個 route handler 自行呼叫 `auth()`。更危險的是 `src/middleware.ts:14` 的 JSDoc **聲稱** `/api/v1/*` 是「受保護路由」，與實際行為矛盾，形成危險的錯誤安全假設。

**影響**：這是所有「無認證 API 端點」Critical/High 的放大器——任何忘記寫 `auth()` 的 handler 等同**對全網際網路公開**。由於授權是逐 handler 手寫、無統一封裝（審查發現至少 5 種不同的角色檢查寫法），遺漏無可避免。

**建議**：
1. 在 middleware 層為 `/api/*`（白名單少數公開端點如 health / auth callback 除外）加上統一的 session 前置檢查。
2. 建立統一的 `requireAuth()` / `requireAdmin()` / `requireCityScope()` 封裝，強制所有 handler 使用。
3. 修正 middleware JSDoc 與實際行為的矛盾。

---

## 4. 🔴 Critical 問題完整清單（10 項）

> 原 I-01 已於 2026-06-10 降級為 High（移至 §5 主題 A'），詳見 §2。

| # | 編號 | 位置 | 問題 |
|---|------|------|------|
| 1 | ADMIN0-01 | `api/admin/historical-data/files/[id]/detail/route.ts:111` | GET 完全無認證，洩漏 storagePath 內部路徑與發票業務資料 |
| 2 | ADMIN0-02 | `api/admin/historical-data/batches/[batchId]/company-stats/route.ts:73` | GET 完全無認證 |
| 3 | ADMIN0-03 | `api/admin/historical-data/batches/[batchId]/term-stats/route.ts:91,154,229` | GET/POST/DELETE 全無認證，POST 可未授權觸發昂貴 LLM 聚合 |
| 4 | ADMIN0-04 | `api/admin/document-preview-test/extract/route.ts:278` | POST 無認證且無檔案大小限制，可耗盡 Azure DI / GPT Vision 成本 |
| 5 | ADMIN-1-001 | `api/admin/term-analysis/route.ts:63,130` | GET/POST 完全無認證，可讀歷史術語並觸發 GPT 分類 |
| 6 | DOCFLOW-01 | `api/mapping/[id]/route.ts:28`、`api/mapping/route.ts:50,111` | mapping API 完全無認證，可未登入讀取任意文件提取結果並觸發處理 |
| 7 | API-MISC-01 | `api/test/extraction-compare/route.ts:435` | 未認證 + 暫存檔名用使用者可控 `file.name` 造成 path traversal 任意檔案寫入（最壞 RCE） |
| 8 | RPT-001 | `api/cost/pricing/route.ts:143` | POST 完全無認證，未授權者可篡改 AI 成本計算基準 |
| 9 | RPT-002 | `api/cost/pricing/[id]/route.ts:125` | PATCH 完全無認證，且 `changedBy` 硬編碼 `'system-admin'`，審計歸屬偽造 |
| 10 | V1-1-A-01 | `api/v1/**`（prompt-configs 等內部管理路由） | 整批 /api/v1 內部管理路由完全缺乏認證/授權 |

---

## 5. 🟠 High 問題清單（37 項，依主題歸類）

### 主題 A'：認證後門（由 Critical I-01 降級併入，2026-06-10）
- **I-01（降級）**（`src/lib/auth.ts:92,394`）`X-Dev-Bypass-Auth` header 後門 +「免密碼登入」部署陷阱。經驗證僅在 `NODE_ENV=development`（或生產誤用 `.env.example` 預設）時成立；header 後門影響 5 個 `getAuthSession` 端點。詳見 §2。

### 主題 A：完全無認證的 API 端點（除 Critical 外）
- **CONF-01**（`api/confidence/[id]/route.ts:49,147`、`review/route.ts:55`）信心度三端點無認證，可讀取、觸發重算、污染審核歷史
- **PROMPT-01**（`api/prompts/resolve/route.ts:53,145`）Prompt 解析端點無認證，洩漏公司特定 Prompt 配置（內部智財）
- **V1-0-A-01**（`api/v1/*` 37 個檔案 60+ handler）版本化 API 認證覆蓋率實測 0%
- **K-01**（`api/v1/prompt-configs/test`）無認證且無速率限制的昂貴 Azure OpenAI 呼叫
- **RPT-003**（`api/cost/pricing` GET ×2）無認證讀取內部計價資料與含內部用戶 ID 的變更歷史
- **COMP4-01 / A-01**（`api/companies/[id]/classified-as-values/route.ts:64-155`）無認證 + IDOR 枚舉任意公司業務術語

### 主題 B：城市隔離 IDOR（跨城市資料越權）
- **DOCFLOW-02**（`api/documents/[id]/source/route.ts:58`）回傳預簽名下載 URL，僅驗登入無城市授權
- **DOCFLOW-03**（`api/documents/[id]/blob/route.ts:71`）Blob 串流跨城市可讀
- **DOCFLOW-04**（`api/documents/route.ts:83`）文件列表無城市過濾，已登入者見全部城市
- **DOCFLOW-05**（`api/documents/search`、`sources/stats`、`sources/trend`）接受任意 cityId 無權限比對
- **API-MISC-03**（`api/n8n/webhook/route.ts:258`）單城市金鑰可跨城市竄改任意文件狀態與工作流
- **CITYCOST-01**（`services/city-cost.service.ts:173,385,553`）城市成本查詢未對 cityCodes 做權限交集過濾

### 主題 C：管理端越權（只驗登入未驗 admin 角色）
- **ADMIN-1-002**（`api/admin/settings/route.ts:131`、`[key]/route.ts:145,234`）低權限者可竄改/重置全系統設定
- **ADMIN-1-003**（`api/admin/historical-data/files`、`files/bulk`、`upload`）低權限者可列檔、批次刪 DB+實體檔（`fs.unlink`）、寫檔到磁碟
- **ADMIN0-05**（`api/admin/historical-data/batches`、`process`、`files/[id]` 等）多個寫操作含級聯刪除只驗登入
- **A-01 / A-02**（`pages-0`：`(dashboard)` route group + `template-field-mappings/*` server component）admin 頁面缺角色 gate，server component 直接查 DB 回傳
- **PAGES-A-01 / A-02**（`pages-1`：`admin/test/*` 頁面 + `/api/test/extraction-v2`）admin test 工具無角色 gate，其 API 無認證

### 主題 D：SSRF（使用者控制 URL 出站無 host 白名單）
- **PY-02**（`python-services/extraction/src/main.py:200`）`/extract/url` 抓取使用者任意 URL
- **G-01 / G-02**（`services/n8n/n8n-webhook.service.ts:169`、`webhook-config.service.ts:521`）callbackUrl / baseUrl SSRF，回應內容被儲存可回讀
- **G-01**（`services/invoice-submission.service.ts:293`）外部 API 提交以使用者 URL 直接 fetch

### 主題 E：成本型 DoS（無認證昂貴操作）
- **API-MISC-02**（`api/test/extraction-v2`、`extraction-compare`）未認證觸發 Azure DI + OpenAI 且無檔案大小限制
- **PY-01**（`python-services` extraction:8000 / mapping:8001）兩個 FastAPI 服務完全無認證且無速率限制

### 主題 F：ReDoS（使用者 regex 對大文本執行無逾時）
- **RULES-01**（`api/rules/test/route.ts:121,141`）使用者 regex 對任意 OCR 全文執行
- **RULES-02**（`api/rules/[id]/preview/route.ts:466,467`）同模式

### 主題 G：硬編碼憑證 / 弱加密
- **INFRA-01**（`prisma/seed.ts:460-483`）dev seed 硬編碼預設全域管理員密碼 `ChangeMe@2026!`（明文於 repo，CLAUDE.md 指示新環境必跑此 seed）
- **D-01**（`services/system-config.service.ts:68,71`）系統配置加密 fallback 用硬編碼預設金鑰 `'default-key-for-development-only'` + 靜態鹽值

### 主題 H：審計來源偽造
- **V1-0-A-02**（`api/v1/exchange-rates/route.ts:104`、`import/route.ts:68`）寫入硬編碼 `createdById = 'system'`，掩蓋缺認證並污染審計

### 主題 I：表達式求值
- **TRANSFORM-01**（`services/transform/formula.transform.ts:155`）FORMULA 用 `Function()` 動態求值（目前白名單正則緩解，但放寬即退化為 RCE）

---

## 6. 系統性風險模式（去重後的根因）

| # | 模式 | 命中範圍數 | 根因 / 修復方向 |
|---|------|-----------|----------------|
| 1 | **認證 fail-open + dev-bypass 後門** | 5 | `src/lib/auth.ts` — 移除 `!isAzureADConfigured()` 條件，fail-closed |
| 2 | **middleware 不保護 /api** | 全部 API 範圍 | `src/middleware.ts` — 加統一 session 前置檢查 + 統一授權封裝 |
| 3 | **城市隔離 IDOR** | docflow / misc / services-root-0/2/3 / n8n | 服務層公開方法不自帶城市範圍驗證，授權上推路由層但路由層普遍漏檢 |
| 4 | **SSRF 無 host 白名單** | python / n8n / services-root-2/3 | 抽共用「安全外呼」工具，封鎖內網位址（169.254/127/10/192.168 等） |
| 5 | **ReDoS 無逾時** | rules / mapping / cf-2 / services-root-1/3 | 使用者 regex 統一限長 + RE2 引擎或 worker timeout |
| 6 | **CSV/Excel 公式注入** | lib-1 / services-root-0/1/3 / template-export | 匯出前中和 `= + - @ Tab` 開頭儲存格 |
| 7 | **成本型 DoS** | admin-0 / misc / python / v1-1 | 昂貴 AI/OCR 端點補認證 + 速率限制 + 檔案大小上限 |
| 8 | **授權寫法分歧** | 全部 admin/api | 無統一 `requireAdmin`，5 種寫法並存導致逐檔遺漏 |
| 9 | **缺 security headers / 全域 rate limit** | core-infra / infra-config | `next.config.ts` 無 CSP / HSTS / X-Frame-Options |

---

## 7. 依賴漏洞（npm audit）

`npm audit` 回報 **54 個漏洞（1 Critical、15 High、34 Moderate、4 Low）**，重點：

| 套件 | 等級 | 漏洞 |
|------|------|------|
| `fast-xml-parser` | 🔴 Critical | DoS 經數值實體展開 / DOCTYPE 實體編碼繞過 |
| `axios` (1.0–1.15.2) | 🟠 High | NO_PROXY 繞過 SSRF、prototype pollution 認證繞過、CRLF 注入 |
| `lodash` | 🟠 High | `_.template` 代碼注入、prototype pollution |
| `hono` | 🟠 High | JWT 演算法混淆 auth bypass、IP 限制繞過 |
| `defu` / `flatted` / `immutable` | 🟠 High | prototype pollution |

**建議**：先跑 `npm audit fix`（多數可無痛升級），`axios` / `fast-xml-parser` 需確認 breaking change 後升級。

---

## 8. 倉庫衛生（主 session 直接掃描）

| 項目 | 狀態 |
|------|------|
| `.env` / `.env.local` / `.env.production` | ✅ 未被 git 追蹤（`.gitignore` 第 5-7 行涵蓋） |
| git 歷史是否曾提交 .env | ✅ 無紀錄 |
| 硬編碼私鑰 / AccountKey（追蹤檔案） | ✅ 僅 `.env.example` 與文檔中的 placeholder |
| `temp_response.json` | ⚠️ **被 git 追蹤**（內容為 `{"success":false,"error":"Unauthorized"}`，無 secret，但屬殘留暫存檔應移除） |
| `Usersrci...temp_configs.json` | ⚠️ **被 git 追蹤**（含真實公司 MSC 的 cuid 與配置 API 回應，建議移除並加 `.gitignore`） |
| `batch-result.json`（56KB） | ⚠️ 根目錄殘留，已掃描無 secret，建議移除 |
| `.env.production` 不在 `.gitignore` 明確排除 | ⚠️ 見 infra-config 報告，建議補上 |
| `.env.azure-dev.local` 不在 `.dockerignore` | ⚠️ 會被 `COPY . .` 帶進 builder layer |

---

## 9. 各區域統計表（36 範圍）

| 區域 | C | H | M | L | I | 檔案 |
|------|---|---|---|---|---|------|
| api-admin-0 | 4 | 2 | 0 | 2 | 1 | 53 |
| api-admin-1 | 1 | 3 | 0 | 1 | 3 | 53 |
| api-docflow | 1 | 4 | 6 | 3 | 2 | 28 |
| api-identity | 0 | 3 | 5 | 3 | 2 | 34 |
| api-misc | 1 | 2 | 3 | 2 | 2 | 28 |
| api-reports | 2 | 1 | 4 | 2 | 4 | 32 |
| api-rules | 0 | 4 | 4 | 3 | 3 | 26 |
| api-v1-0 | 0 | 2 | 2 | 2 | 1 | 37 |
| api-v1-1 | 1 | 1 | 3 | 3 | 2 | 40 |
| components-features-0 | 0 | 0 | 0 | 2 | 2 | 76 |
| components-features-1 | 0 | 0 | 0 | 3 | 3 | 71 |
| components-features-2 | 0 | 0 | 2 | 0 | 0 | 70 |
| components-features-3 | 0 | 0 | 1 | 0 | 0 | 72 |
| components-features-4 | 0 | 1 | 0 | 1 | 2 | 69 |
| components-other | 0 | 0 | 0 | 2 | 5 | 72 |
| core-infra | 0 | 0 | 2 | 4 | 3 | 32 |
| hooks-0 | 0 | 0 | 1 | 5 | 6 | 52 |
| hooks-1 | 0 | 0 | 1 | 6 | 6 | 52 |
| infra-config | 0 | 1 | 6 | 6 | 1 | 21 |
| lib-0 | 0 | 1 | 2 | 4 | 3 | 38 |
| lib-1 | 0 | 0 | 2 | 4 | 2 | 32 |
| pages-0 | 0 | 2 | 2 | 2 | 2 | 51 |
| pages-1 | 0 | 2 | 3 | 4 | 2 | 55 |
| python | 0 | 2 | 4 | 4 | 3 | 18 |
| scripts-0 | 0 | 0 | 1 | 3 | 2 | 63 |
| scripts-1 | 0 | 0 | 2 | 3 | 2 | 55 |
| services-extract | 0 | 0 | 2 | 6 | 3 | 26 |
| services-mapping | 0 | 1 | 1 | 2 | 4 | 26 |
| services-n8n | 0 | 2 | 4 | 4 | 4 | 13 |
| services-root-0 | 0 | 1 | 2 | 4 | 3 | 29 |
| services-root-1 | 0 | 0 | 2 | 4 | 5 | 27 |
| services-root-2 | 0 | 1 | 2 | 5 | 3 | 27 |
| services-root-3 | 0 | 1 | 4 | 3 | 2 | 28 |
| services-unified | 0 | 0 | 1 | 5 | 3 | 24 |
| types-0 | 0 | 0 | 1 | 3 | 7 | 46 |
| types-1 | 0 | 0 | 0 | 2 | 6 | 47 |
| **總計** | **10** | **37** | **75** | **112** | **104** | **1,523** |

---

## 10. 修復優先序建議

### P0（立即，本週內）
1. **修復認證 fail-open 後門**（§2）— `src/lib/auth.ts`，影響全系統
2. **middleware 為 /api 加統一認證**（§3）— 一次性堵住所有無認證端點的放大器
3. **11 個 Critical 端點逐一補 `auth()` + 角色檢查**（§4）

### P1（2 週內）
4. 城市隔離 IDOR（主題 B）— 服務層補 cityScope 驗證
5. Python 服務補認證 + 網路隔離確認（不要 bind 0.0.0.0）
6. SSRF host 白名單（主題 D）
7. 移除 `prisma/seed.ts` 硬編碼密碼，改為環境變數注入 + 強制首次登入改密碼
8. `npm audit fix` + 升級 axios / fast-xml-parser

### P2（1 個月內）
9. 建立統一 `requireAuth/requireAdmin/requireCityScope` 封裝，全面改寫
10. ReDoS 防護（RE2 / timeout）
11. CSV/Excel 公式注入中和
12. `next.config.ts` 補 security headers（CSP / HSTS / X-Frame-Options）
13. 移除倉庫殘留暫存檔（§8）

---

## 11. 正面確認（值得保留的良好實踐）

- **注入防護優秀**：1,523 檔中幾乎全部 DB 存取走 Prisma 參數化；少數 raw SQL（dashboard / monthly-cost / reference-number / city-trend）均正確使用 `Prisma.sql` / `Prisma.join`，**FIX-051 無回歸**。
- **密鑰儲存正確**：API Key 採 `randomBytes(32)` + SHA-256、Webhook token AES-256-GCM、歷史僅存遮蔽版、`ApiKeyResponse` 不含 rawKey。
- **前端衛生良好**：430 個組件中**零** `dangerouslySetInnerHTML`、**零**客戶端 import prisma、`target="_blank"` 均帶 `rel="noopener noreferrer"`。
- **PII 日誌**：逐行確認**未發現** email / token / 密碼寫入 plaintext log，**FIX-050 無回歸**。
- **Zod 驗證**：分頁/批量上限普遍設置合理，多數寫入端點有 schema 驗證。
- **Next.js 15.5.9** 已修補 CVE-2025-29927（middleware 繞過）。

---

*報告產出：2026-06-10 | 36 個並行審查 agent，全部檔案逐行讀取 | 個別詳細報告見 `reports/` 子目錄*
