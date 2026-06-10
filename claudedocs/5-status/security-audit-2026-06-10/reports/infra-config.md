# 安全審查報告 — 基礎設施與配置（infra-config）

> 審查日期：2026-06-10 | Scope：scopes/infra-config.txt | Agent：infra-config 審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | .env.example | 158 | ✅ |
| 2 | .gitignore | 106 | ✅ |
| 3 | batch-result.json | 1（單行 56,122 bytes） | ✅（含全文敏感字串掃描） |
| 4 | components.json | 20 | ✅ |
| 5 | docker-compose.yml | 103 | ✅ |
| 6 | Dockerfile | 201 | ✅ |
| 7 | next.config.ts | 67 | ✅ |
| 8 | package.json | 143 | ✅ |
| 9 | postcss.config.mjs | 9 | ✅ |
| 10 | prisma.config.ts | 15 | ✅ |
| 11 | prisma/bootstrap-db.js | 68 | ✅ |
| 12 | prisma/schema.prisma | 4,364 | ✅（分 3 段全文讀畢） |
| 13 | prisma/seed.ts | 1,463 | ✅ |
| 14 | prisma/seed-prod-essential.ts | 575 | ✅ |
| 15 | prisma/seed-prod-reference.ts | 575 | ✅ |
| 16 | tailwind.config.ts | 85 | ✅ |
| 17 | temp_response.json | 1（40 bytes） | ✅ |
| 18 | tests/unit/services/batch-processor-parallel.test.ts | 290 | ✅ |
| 19 | tests/unit/services/monthly-cost-report.test.ts | 154 | ✅ |
| 20 | tsconfig.json | 42 | ✅ |
| 21 | Usersrci.ChrisLaiDocumentsGitHubai-document-extraction-projecttemp_configs.json | 1（836 bytes） | ✅ |

合計約 8,440 行。輔助交叉確認（不在 scope 內、僅佐證用）：.dockerignore、package-lock.json（套件版本）、src/services/sharepoint-config.service.ts、src/services/n8n/n8n-api-key.service.ts、src/app/api/auth/forgot-password/route.ts、src/services/backup.service.ts。

---

## 2. 發現

### [High] INFRA-01 dev seed 硬編碼預設全域管理員密碼 `ChangeMe@2026!`
- **檔案**：prisma/seed.ts:460-483
- **類別**：D（Secrets 與設定）/ I（認證機制）
- **描述**：seed.ts 以硬編碼密碼建立本地登入的全域管理員帳號 `admin@ai-document-extraction.com`（`isGlobalAdmin: true`），密碼明文寫在 repo 並印到 console。CLAUDE.md 指示「新環境首次需 `npx prisma db seed`」，任何跑過 dev seed 且可達登入端點的環境（本地、共用 DEV、UAT 演示機）都存在這組公開已知的最高權限憑證；只要無人手動改密碼即可被接管。雖然 upsert 的 update 分支不會重設密碼（已改過則保留），但 create 分支永遠用這組已知密碼。
- **證據**：
  ```typescript
  const adminPassword = await hashPassword('ChangeMe@2026!')
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ai-document-extraction.com' },
    ...
      isGlobalAdmin: true,
  console.warn('  ⚠️  Default credentials: admin@ai-document-extraction.com / ChangeMe@2026!')
  ```
- **建議**：比照 seed-prod-essential.ts 的做法——密碼改由 `SEED_ADMIN_PASSWORD` 環境變數提供，未設定則跳過建立；或建立後強制 `mustChangePassword` 流程。同時從 console 輸出移除明文憑證。

### [Medium] INFRA-02 dev seed 建立無密碼的全域管理員 `dev-user-1`，與 dev mode 認證旁路疊加
- **檔案**：prisma/seed.ts:430-452；.env.example:63-64
- **類別**：A（認證授權）/ I
- **描述**：seed.ts 建立 `dev-user-1`（`dev@example.com`，`isGlobalAdmin: true`，無密碼）。.env.example 第 64 行明示「缺少 Azure AD 時：系統進入 dev mode，接受任何含 @ 的 email 登入」。兩者疊加表示任何未配置 Azure AD 的環境，攻擊者僅需知道 email 即可以全域管理員身分進入。若 dev seed 被誤用於非本地環境，風險直接成立。
- **證據**：
  ```typescript
  const devUser = await prisma.user.upsert({
    where: { id: 'dev-user-1' },
    ... create: { id: 'dev-user-1', email: 'dev@example.com', ..., isGlobalAdmin: true,
  ```
- **建議**：dev-user-1 的建立加上 `NODE_ENV !== 'production'` 守門；在 auth 層確保 dev mode 旁路絕不可能在 production build 啟用（此部分屬 auth scope，請與該區報告交叉比對）。

### [Medium] INFRA-03 docker-compose 弱憑證 + 服務端口綁定所有介面
- **檔案**：docker-compose.yml:8-13（postgres）、29-34（pgadmin）、47-48 / 68-69（Python 服務）、71（mapping 服務 DATABASE_URL）、89-92（azurite）
- **類別**：D / A
- **描述**：
  1. PostgreSQL 使用 `postgres/postgres` 弱憑證，且 `"5433:5432"` 預設綁定 0.0.0.0——本開發機為 Windows Server（常駐公司網路），同網段任何主機可直連資料庫。
  2. pgAdmin `admin@admin.com` / `admin` 且 `PGADMIN_CONFIG_SERVER_MODE: 'False'`（desktop mode 免登入），5050 端口對外即等同開放 DB 管理介面。
  3. Python OCR（8000）/ Mapping（8001）服務無認證即對外（mapping 服務內嵌 DB 連線字串），Azurite 10010-10012 同理。
- **證據**：
  ```yaml
  ports: - "5433:5432"
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  PGADMIN_DEFAULT_PASSWORD: admin
  ```
- **建議**：所有 dev-only 端口改綁 loopback（`"127.0.0.1:5433:5432"` 等）；憑證改由 `.env` 注入（compose 已支援 `${VAR}` 語法，AZURE_DI_KEY 即此模式）。此為 dev 配置，但機器位於網路可達環境，不應視為純本機風險。

### [Medium] INFRA-04 next.config.ts 完全未配置 security headers
- **檔案**：next.config.ts:6-65（全檔無 `headers()`）
- **類別**：F（XSS 與前端）/ J（資訊洩漏）
- **描述**：next.config.ts 沒有 `headers()` 配置；經全 src 交叉搜尋，整個專案亦無任何位置設置 `Content-Security-Policy`、`X-Frame-Options`、`Strict-Transport-Security`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`（僅 src/lib/i18n-api-error.ts 命中 `headers()` 且與此無關）。`poweredByHeader` 亦未關閉（預設送出 `X-Powered-By: Next.js`）。本專案以 Docker 部署到 Azure（Dockerfile 註明 Container Apps），無前置層補 header 時瀏覽器端缺乏 clickjacking / MIME-sniffing / 降級攻擊防護。
- **證據**：
  ```typescript
  const nextConfig: NextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    eslint: { ignoreDuringBuilds: true },
    ...  // 無 headers()、無 poweredByHeader: false
  ```
- **建議**：在 next.config.ts 加入 `headers()` 設置基本安全標頭（至少 X-Frame-Options: DENY、X-Content-Type-Options: nosniff、Referrer-Policy、HSTS〔生產〕、最小化 CSP），並設 `poweredByHeader: false`。

### [Medium] INFRA-05 `.env.production` 不在 .gitignore；`.env.azure-dev.local` 不在 .dockerignore
- **檔案**：.gitignore:5-7；.dockerignore（Environment 區塊）；Dockerfile:71
- **類別**：D
- **描述**：
  1. .gitignore 只有 `.env`、`.env.local`、`.env.*.local` 三個 pattern——`.env.production`、`.env.development` 都不會被忽略（已以 `git check-ignore` 證實）。一旦有人建立 `.env.production` 即會被 git 追蹤並可能提交真實生產 secrets。
  2. .dockerignore 列出 `.env`、`.env.local`、`.env.development` 等，但漏掉 `.env.production` 與萬用 pattern；工作目錄現存的 `.env.azure-dev.local`（1,445 bytes，極可能含 Azure DEV 憑證）不被任何 .dockerignore 規則匹配，Dockerfile 第 71 行 `COPY . .` 會把它複製進 builder stage image layer（雖不入 runner stage，但會殘留在 build agent / 本機 layer cache）。
- **證據**：
  ```
  # .gitignore
  .env
  .env.local
  .env.*.local        ← .env.production 不匹配任何規則
  # .dockerignore Environment 區塊：無 .env.production、無 .env.azure-dev.local
  ```
- **建議**：兩檔皆改用萬用規則 `.env*` + 白名單 `!.env.example`，一次封死所有變體。

### [Medium] INFRA-06 bootstrap-db.js 對 Azure PostgreSQL 停用 TLS 憑證驗證
- **檔案**：prisma/bootstrap-db.js:19-25
- **類別**：G（外部呼叫）/ I
- **描述**：偵測到 Azure PostgreSQL 主機或 `sslmode=require` 時，pg Client 的 ssl 設為 `{ rejectUnauthorized: false }`——加密但不驗證伺服器憑證，容器啟動時的 schema bootstrap 連線可被中間人攔截（取得 DB 憑證與全部 DDL 流量）。
- **證據**：
  ```javascript
  if (/sslmode=require/i.test(url) || /\.postgres\.database\.azure\.com/i.test(url)) {
    return { rejectUnauthorized: false }
  }
  ```
- **建議**：改為驗證憑證（Azure PostgreSQL 提供 DigiCert/Microsoft RSA 根憑證，可 `ssl: { ca: fs.readFileSync(...) }` 或至少 `rejectUnauthorized: true` 搭配系統 CA）。同時檢查 app 本身的 pg Pool 是否同樣設定（超出本 scope，建議交叉確認 src/lib/prisma.ts）。

### [Medium] INFRA-07 passwordResetToken / emailVerificationToken 以明文存放 DB
- **檔案**：prisma/schema.prisma:23-27；佐證 src/app/api/auth/forgot-password/route.ts:82-92
- **類別**：I / K（縱深防禦）
- **描述**：User model 的 `passwordResetToken`、`emailVerificationToken` 設計為明文唯一欄位，forgot-password route 直接把 `generateToken(32)` 原始值寫入 DB，重設時以明文比對。DB dump、備份外洩或唯讀 SQL injection 任一發生時，攻擊者可在 token 有效期（1 小時）內接管任何剛發起重設的帳號。業界慣例是只存 token 的 SHA-256 雜湊。
- **證據**：
  ```prisma
  emailVerificationToken     String?  @unique @map("email_verification_token")
  passwordResetToken         String?  @unique @map("password_reset_token")
  ```
- **建議**：改存 `sha256(token)`，查詢時先雜湊再比對；欄位語意不變、migration 成本低。

### [Low] INFRA-08 兩個 API 回應暫存檔被 git 追蹤（含內部資料與本機路徑洩漏）
- **檔案**：temp_response.json；Usersrci.ChrisLaiDocumentsGitHubai-document-extraction-projecttemp_configs.json
- **類別**：D / J
- **描述**：兩檔皆為開發期 API 回應 dump 且**已提交進 repo**（`git ls-files` 證實）。temp_response.json 內容為 `{"success":false,"error":"Unauthorized"}`（無敏感）；temp_configs.json 含內部 mapping config ID、公司資料（MSC）與分頁結構；後者檔名本身把開發者本機路徑 `Users\rci.ChrisLai\...` 攤平成檔名（Windows 路徑寫入失誤）。內容目前無 secrets，但此類檔案進 repo 屬流程缺口——下一次 dump 可能就含 token。batch-result.json（56KB，131 筆真實發票檔名 + `admin@example.com`）未被追蹤且已在 .gitignore:47，屬工作目錄殘留。
- **建議**：`git rm --cached` 移除兩個追蹤檔並刪除；在 .gitignore 加 `temp_*.json` 類 pattern；刪除工作目錄的 batch-result.json。

### [Low] INFRA-09 BackupConfig 設計為在 DB 明文存放加密金鑰與儲存連線字串
- **檔案**：prisma/schema.prisma:2566-2583
- **類別**：D
- **描述**：`BackupConfig.encryptionKey`、`storageConnectionString` 為一般 String 欄位——備份加密金鑰與被其保護的資料同庫存放，違反金鑰隔離原則。交叉搜尋顯示服務層目前未寫入此 model（backup.service.ts 無對應引用），屬尚未引爆的設計隱患。
- **證據**：
  ```prisma
  storageConnectionString String?  @map("storage_connection_string")
  encryptionKey           String?  @map("encryption_key")
  ```
- **建議**：若啟用此 model，金鑰改放環境變數 / Key Vault，DB 僅存引用名稱；或至少以 `encryption.service.ts`（ENCRYPTION_KEY）加密後存放。

### [Low] INFRA-10 多個 model 儲存可能含敏感內容的原始 payload
- **檔案**：prisma/schema.prisma:99-105（Account.refresh_token/access_token/id_token）、577-578（ExtractionResult.gptPrompt/gptResponse）、1703-1704（N8nApiCall.requestBody/requestHeaders）、2207-2208（ApiAuditLog.requestBody）
- **類別**：E / K
- **描述**：OAuth token（NextAuth 標準行為）、完整 GPT prompt/回應（含發票全文商業資料）、API 呼叫的原始 headers 與 body 皆明文落庫。requestHeaders 若未在服務層遮罩，會把 `Authorization` / API key 寫進日誌表。.env.example:154-158 的 `DEBUG_EXTRACTION_V3_*` 旗標亦警告同類風險（預設關閉，正確）。
- **建議**：服務層寫入前對 headers 做白名單/遮罩（請與 services scope 報告交叉確認實作）；對 gptPrompt/gptResponse 評估保留期限與存取權限。

### [Low] INFRA-11 生產 build 跳過 ESLint gate
- **檔案**：next.config.ts:19-23
- **類別**：K
- **描述**：`eslint.ignoreDuringBuilds: true`（註解自承 temporary for testing）使含 lint 錯誤的代碼可進生產 image，削弱了一道靜態檢查防線（包括 react 安全規則）。
- **建議**：修復現存 warning 後移除此旗標。

### [Low] INFRA-12 認證庫使用 beta 版本 + 測試 runner 缺失
- **檔案**：package.json:89（`next-auth ^5.0.0-beta.30`）、6-21（scripts 無 `test`）；tests/unit/services/monthly-cost-report.test.ts:13-17
- **類別**：K
- **描述**：(1) 認證核心 next-auth 鎖在 beta channel（lockfile 實際 5.0.0-beta.30），beta 版的安全修補節奏與 semver 保證較弱。(2) package.json 無 `test` script、無 vitest/jest 依賴——monthly-cost-report.test.ts 檔頭自承「專案目前未安裝測試 runner」，現存單元測試（含本 scope 兩檔）實際無法執行，CLAUDE.md Self-Verification 的 `npm run test` 形同虛設，回歸（含安全修復回歸）無自動化防線。
- **建議**：追蹤 next-auth v5 正式版發布並升級；安裝 vitest 並補 `test` script。

### [Low] INFRA-13 seed-prod-essential 硬編碼組織 email 預設值，且每次部署覆蓋管理員密碼
- **檔案**：prisma/seed-prod-essential.ts:56-57、449-467
- **類別**：D / I
- **描述**：(1) `SEED_ADMIN_EMAIL` 預設值硬編碼 `admin@rci-t.com`（洩漏組織 domain，違反「不 hardcode 資源名」精神）。(2) `seedAdminUser` 的 upsert **update 分支也會重寫 password**——Azure DEV 容器每次啟動跑 essential seed，意味管理員若透過 UI 改密碼，下次重啟即被重設回 `SEED_ADMIN_PASSWORD`；該 env var 因此成為永久有效的最高權限憑證，削弱密碼輪換。其餘設計良好（密碼來自 env、未設定即跳過、system user password=null 不可登入、log 不含 secrets）。
- **建議**：update 分支只在 `password IS NULL` 時補設密碼；email 預設值改為必填 env。

### [Info] INFRA-14 正面觀察與已驗證項目
- **Dockerfile**（全檔）：多階段建置、非 root user（uid 1001）、builder stage 的 dummy secrets（ENCRYPTION_KEY 全零、NEXTAUTH_SECRET dummy）僅存在 builder layer、runner 為獨立 FROM 不繼承——設計正確；healthcheck 指向 /api/health。
- **套件版本**：next 15.5.9 已修補 CVE-2025-29927（middleware 認證旁路，影響 <15.2.3，本專案以 middleware 做認證故此項關鍵）；pdfjs-dist 4.10.38 已修補 CVE-2024-4367。
- **.env.example**：全為佔位值，無真實 secrets；Azurite 金鑰為微軟公開的開發帳戶金鑰（可接受）；對 DEBUG flags 與 ENCRYPTION_KEY 不可變更有正確警示。
- **schema 金鑰存放一致性**：`ApiKey.keyHash`、`ExternalApiKey.keyHash` 存雜湊（正確）；`N8nApiKey.key` 欄位名易誤導，但經交叉確認 n8n-api-key.service.ts:112-119 實際寫入 SHA-256 雜湊（安全，建議改名 keyHash 消歧義）；SharePointConfig/OutlookConfig 的 clientSecret 經 encryption.service 加密後存放（sharepoint-config.service.ts:141 證實）。
- **seed-prod-reference.ts**：安全閘設計良好（--confirm + env allow + lock file 檢查 + 數量/枚舉驗證）；`getSystemCreatorId` 以 `email contains 'admin'` 模糊匹配選 creator（完整性疑慮，非安全漏洞）。
- **docker-compose CORS_ORIGINS** 固定 `http://localhost:3000`，與實際 dev 端口（3005/3200）不符——屬功能性配置漂移，非安全問題。
- **tests/ 兩檔**：純邏輯測試，無 secrets、無危險操作。
- **tsconfig.json / tailwind.config.ts / postcss.config.mjs / components.json / prisma.config.ts**：無安全問題。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 6 | 6 | 1（彙整多項正面觀察） |

---

## 4. 區域整體觀察

1. **「dev 便利性」與「生產安全」的邊界是本區最大系統性風險**：dev seed 同時種下已知密碼的全域管理員（INFRA-01）與無密碼全域管理員（INFRA-02），而 CLAUDE.md 又指示新環境一律跑 `npx prisma db seed`——只要任何共用環境沿用 dev seed，最高權限即等於公開。相對地，CHANGE-055 之後的生產 seed 鏈（seed-prod-essential / seed-prod-reference / bootstrap-db / .dockerignore 排除 dev seed）整體設計明顯成熟得多，顯示團隊已有正確方向，但 dev 路徑未同步收斂。
2. **ignore 規則靠枚舉而非萬用 pattern**（INFRA-05、INFRA-08）：.gitignore / .dockerignore 都用逐一列舉 `.env` 變體的方式，已實際漏掉 `.env.production` 與 `.env.azure-dev.local`；暫存 dump 檔也已兩度進 repo。建議統一改 `.env*` + 白名單，並對 `temp_*` / `*-result.json` 類 dev 產物建立 pattern。
3. **HTTP 層安全 hardening 整體缺位**（INFRA-04）：應用層認證/授權投入很多（middleware、RBAC、城市隔離），但傳輸層的 security headers 一項都沒有，屬於低成本高回報的補強點。
4. **Schema 的 secrets-at-rest 紀律不一致**：API key 雜湊（好）、整合 clientSecret 服務層加密（好），但 reset token 明文（INFRA-07）、BackupConfig 金鑰欄位明文設計（INFRA-09）、raw headers/body 落庫（INFRA-10）——建議制定統一的「DB 敏感欄位分級表」，新 model 評審時對照。
5. **測試防線缺失**（INFRA-12）放大其他所有風險：無可執行的單元測試 gate，安全修復（如 FIX-050/051）的回歸只能靠人工。
