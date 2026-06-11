# Critical / High 修復路線圖

> **來源**：SECURITY-ASSESSMENT.md（11 Critical + 36 High）
> **建立日期**：2026-06-10
> **方法**：依「系統性根因」聚合，而非逐項處理。47 項 Critical/High 收斂為 11 個工作包（WP）。
> **狀態**：📋 規劃中（待用戶確認分批與 H1 架構改動 approve）

---

## 0. 工作包總表

| WP | 標題 | 優先 | 含 Crit | 含 High | H 約束 | 建議文件 | 相依 |
|----|------|------|---------|---------|--------|----------|------|
| WP-1 | 認證 fail-open + dev-bypass 後門 | P0 | 1 | 4 | **H1** | CHANGE | — |
| WP-2 | Middleware `/api` 統一認證閘 | P0 | — | 1* | **H1** | CHANGE | — |
| WP-3 | Critical 無認證端點補認證/授權 | P0 | 9 | 6 | H6 | FIX×5 | WP-1, WP-2 |
| WP-4 | 城市隔離 IDOR 統一修復 | P1 | — | 6 | H1（helper） | CHANGE | WP-2 |
| WP-5 | SSRF host 白名單（共用 safeFetch） | P1 | — | 4 | — | FIX | — |
| WP-6 | ReDoS 安全 regex 執行工具 | P1 | — | 2 | — | FIX | — |
| WP-7 | 硬編碼憑證 / 弱加密金鑰 | P1 | — | 2 | H4 | FIX | — |
| WP-8 | Python 服務認證 + rate limit | P1 | — | 1 | H1（python 架構） | CHANGE | — |
| WP-9 | 成本型 DoS + 檔案大小上限 | P1 | — | 2 | — | FIX | WP-3 |
| WP-10 | 審計來源偽造 + 表達式求值加固 | P1 | — | 2 | — | FIX | WP-1 |
| WP-11 | 頁面層授權 gate（admin/report） | P1 | — | 4 | H6 | FIX | WP-3 |

> *WP-2 的 V1-0-A-01「37 端點 0% 認證」屬系統性 High，由 WP-2 的 middleware 閘 + WP-3e 收口。

**P0 = 地基（WP-1/2/3），必須最先做；P1 可在 P0 後並行分組。**

---

## P0 — 認證地基（最高優先，必須先做）

### WP-1 — 認證 fail-open + dev-bypass 後門 🔴【H1 架構改動，需 approve】

**涵蓋**：I-01(Critical)、I-02、ADMIN0-06、ADMIN-1-004、AUTH-01（4 High，5 範圍重複命中同一根因）

**根因**：
- `src/lib/auth.ts:92` `isDevelopmentMode()` 含 `|| !isAzureADConfigured()`
- `src/lib/auth.ts:394-399` `getAuthSession` 在 dev mode 下，帶 `X-Dev-Bypass-Auth: true` header 即回傳 `DEV_MOCK_SESSION`（管理員）
- 連鎖：`:135` dev mode 不掛 Prisma adapter（改 Credentials 可任意登入）

**修復策略**：
1. `isDevelopmentMode()` **只認** `process.env.NODE_ENV === 'development'`，移除 `|| !isAzureADConfigured()`。
2. `X-Dev-Bypass-Auth` 邏輯額外加 `NODE_ENV === 'development'` 硬 gate，並考慮以建置期環境旗標完全剝除。
3. Azure AD 未配置時 **fail-closed**：生產環境拒絕登入並記錄告警，而非降級放行。
4. 保留本地開發體驗（`DevLoginForm` 在 `NODE_ENV==='development'` 仍可用）。

**H1 說明**：屬認證架構行為改變。需用戶 approve 後才實作，並記錄於 CHANGE 文件。
**風險**：若生產目前正依賴「Azure AD 未配置時可登入」運作（如 UAT），修復後該環境將無法登入 → 需先確認各環境 Azure AD 配置狀態。
**規模**：單檔（auth.ts）+ 連帶確認 auth.config.ts；小改動、高影響。

---

### WP-2 — Middleware `/api` 統一認證閘 🔴【H1 架構改動，需 approve】

**涵蓋**：放大全部無認證 API 端點問題；直接收口 V1-0-A-01（系統性 High）

**根因**：`src/middleware.ts:91-98` 對 `/api` 直接放行；`matcher`（`:181`）`'/((?!api|...).*)'` 根本不匹配 `/api`；JSDoc（`:13-14`）謊稱 `/api/v1/*` 受保護。

**修復策略**：
1. 新增獨立的 API 認證檢查（middleware 或共用 wrapper），對 `/api/*` 預設要求登入 session。
2. 建立**公開端點白名單**（需逐一盤點確認）：`/api/auth/*`、`/api/health`、n8n webhook（改用簽章驗證）、其他設計上公開者。
3. 修正 middleware JSDoc 與實際行為矛盾。
4. middleware 只負責「第一層：是否登入」；角色與城市範圍仍由各 handler（WP-3/WP-4）負責。

**H1 說明**：全站認證架構改動。需 approve。
**風險**：白名單盤點不全會誤擋現有正常端點 → 必須先完整列出所有「設計上公開」的端點再上線。建議分兩階段：先「監測模式」記錄會被擋的端點，確認白名單後再強制。
**規模**：中（middleware + 白名單盤點 + 共用 wrapper）。

---

### WP-3 — Critical 無認證端點補認證 / 授權 🔴【H6】

> 即使 WP-2 加了「登入閘」，這些端點仍需補**角色檢查 + 城市範圍**，且部分有額外漏洞。建議拆 5 個 FIX 並行。

| 子任務 | 涵蓋 | 端點 | 額外動作 |
|--------|------|------|----------|
| WP-3a | ADMIN0-01/02/03/04、ADMIN0-05、ADMIN-1-001、ADMIN-1-002、ADMIN-1-003 | `api/admin/historical-data/*`、`term-analysis`、`document-preview-test/extract`、`settings` | 補 `auth()` + admin 角色；統一 `requireAdmin` |
| WP-3b | RPT-001/002/003 | `api/cost/pricing`（GET/POST/PATCH） | 補認證 + 角色；移除 `changedBy='system-admin'` 硬編碼 |
| WP-3c | DOCFLOW-01 | `api/mapping`、`api/mapping/[id]` | 補認證 + 城市範圍 |
| WP-3d | API-MISC-01、API-MISC-02 | `api/test/extraction-compare`、`extraction-v2` | **生產禁用 test 端點**；修 path traversal（檔名清洗） |
| WP-3e | V1-1-A-01、V1-0-A-01、CONF-01、PROMPT-01、A-01/COMP4-01 | `api/v1/*`、`confidence`、`prompts/resolve`、`companies/[id]/classified-as-values` | 逐端點補認證 + 權限 |

**H6 說明**：補既有端點的認證屬 bug fix，不偏離設計（設計本就應有認證）。但 WP-3d「生產禁用 test 端點」是行為決策，需確認。
**相依**：建議在 WP-1/WP-2 完成後做（避免白工），但角色/城市檢查邏輯本身可獨立開發。

---

## P1 — 系統性風險（P0 後分組並行）

### WP-4 — 城市隔離 IDOR 統一修復 🟠【H1：新增共用 helper】
**涵蓋**：DOCFLOW-02/03/04/05、API-MISC-03、CITYCOST-01（6 High）+ 大量同類 Medium（DOCFLOW-06~11、A-04、services 層 IDOR）
**策略**：建立統一 `requireCityScope(session, resourceCityCode)` / 服務層 `assertCityAccess`；對 `documents` 域 blob/source/list/search、`n8n/webhook`、`city-cost` 套用。以同目錄已正確實作者（`documents/progress`、`audit-query.service`）為範本。
**規模**：中大（橫跨 api + services）。

### WP-5 — SSRF host 白名單 🟠
**涵蓋**：PY-02、services-n8n G-01/G-02、services-root-2 G-01（4 High）+ Medium（v1-1 G-01、services-root-3 D-02/D-03、CORE-02）
**策略**：抽共用「安全外呼」工具，封鎖內網/雲端 metadata 位址（127/10/172.16-31/192.168/169.254/::1），對 callbackUrl/baseUrl/SharePoint/Graph URL/webhook 套用。Python 側獨立實作對等防護。

### WP-6 — ReDoS 安全 regex 執行工具 🟠
**涵蓋**：RULES-01、RULES-02（2 High）+ Medium（TRANSFORM-02、CF2-01、services-root-1/3、PY-04、lib-1-M2）
**策略**：統一 regex 安全執行（pattern 限長 + 執行 timeout / 改 RE2）；前端提交前 `try{new RegExp()}` 語法驗證。

### WP-7 — 硬編碼憑證 / 弱加密金鑰 🟠【H4】
**涵蓋**：INFRA-01（seed 密碼 `ChangeMe@2026!`）、services-root-3 D-01（加密 fallback 金鑰）（2 High）+ Medium（INFRA-02 無密碼 dev-user-1、scripts D-01）
**策略**：seed 密碼改環境變數注入 + 強制首登改密；`system-config.service` 缺金鑰時 fail（對齊 `encryption.service` 行為），移除 `'default-key-for-development-only'`。

### WP-8 — Python 服務認證 + rate limit 🟠【H1：python 架構】
**涵蓋**：PY-01（High）+ Medium（PY-03 CORS、PY-06 依賴）
**策略**：兩個 FastAPI 服務加內部 API Key 驗證（或確認僅綁私網不對外）；收緊 CORS；升級有 CVE 的依賴。需確認部署網路拓撲。

### WP-9 — 成本型 DoS + 檔案大小上限 🟠
**涵蓋**：K-01（prompt-configs/test）、API-MISC-02（2 High）+ Medium（H-01、RPT-005）
**策略**：昂貴 AI/OCR 端點加 rate limit + 檔案大小上限 + MIME 內容驗證（magic byte）。與 WP-3d 部分合併。

### WP-10 — 審計來源偽造 + 表達式求值加固 🟠
**涵蓋**：V1-0-A-02（`createdById='system'`）、TRANSFORM-01（`Function()` 加固）（2 High）+ Low（EX-07、reference-numbers D-01）
**策略**：寫入操作以真實 session user 記錄 createdById（依賴 WP-1/2 提供可信 session）；FORMULA 求值加固或改 AST 白名單解析器。

### WP-11 — 頁面層授權 gate 🟠【H6】
**涵蓋**：pages-0 A-01/A-02、PAGES-A-01/A-02（4 High）
**策略**：`(dashboard)` route group 或各 admin/report 頁面 server component 加角色 gate；`template-field-mappings` server component 補角色檢查。其消費的 API 由 WP-3 收口。

---

## 橫切項（非程式碼 Critical/High，但建議同批處理）

- **依賴漏洞**：`npm audit`（1 Critical fast-xml-parser、15 High 含 axios SSRF）→ 先 `npm audit fix`，axios/fast-xml-parser 確認 breaking 後升級。
- **倉庫衛生**：移除 git 追蹤的 `temp_response.json`、`temp_configs.json`、`batch-result.json`。

---

## 建議執行順序

```
階段 1（P0 地基）：WP-1 → WP-2（兩者需 H1 approve）→ WP-3（5 FIX 並行）
階段 2（P1 第一組）：WP-4、WP-5、WP-7（相對獨立，可並行）
階段 3（P1 第二組）：WP-6、WP-8、WP-9、WP-10、WP-11
階段 4（橫切）：依賴升級 + 倉庫衛生
```

---

## 待用戶決策事項

1. **H1 approve**：WP-1、WP-2、WP-8（python）、WP-4（helper）屬架構改動，需明確同意方可實作。
2. **各環境 Azure AD 配置狀態**：WP-1 修復後，未配置 Azure AD 的環境將無法登入，需先確認 UAT/staging/prod 狀態。
3. **WP-3d**：test 端點是否生產禁用（建議是）。
4. **分批方式**：是否依「建議執行順序」逐階段進行？
5. **規劃文件形式**：是否要為每個 WP 用 `/plan-fix`、`/plan-change` 建立正式 FIX-XXX / CHANGE-XXX 規劃文件？
