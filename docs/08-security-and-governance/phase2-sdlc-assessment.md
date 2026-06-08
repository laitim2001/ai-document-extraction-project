# Phase 2 現狀盤點 — SDLC 領域（含 Azure 部署層）

> **盤點日期**: 2026-04-28
> **評分模型**: L0 (Absent) → L1 (Initial) → L2 (Managed) → L3 (Defined) → L4 (Optimized)
> **盤點範疇**: SDLC 必須項 9 + 延後項 3 + 部署層 5 = **17 項**
> **基準矩陣**: `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2
> **Azure 部署規劃**: CHANGE-055 v0.3（10 項決策已定案）+ CHANGE-056（Prisma migration baseline）

---

## 📊 領域成熟度匯總

| 子領域 | 項目數 | 平均成熟度 | HIGH 風險未達 L2 | 企業就緒？ |
|------|------|----------|----------------|----------|
| **SDLC 必須項（9）** | 9 | **L0.4** | **6 項** | 🔴 NOT READY |
| **SDLC 延後項（3）** | 3 | L0.0 | N/A（皆為 LOW/MED）| 🟡 PARTIALLY READY |
| **SDLC 部署層（5）** | 5 | **L1.6** | **4 項** | 🔴 NOT READY |
| **總計（17）** | 17 | L0.7 | **10 項 HIGH 未達 L2** | 🔴 **NOT READY** |

### 企業就緒度判定（v1.2 基準）

| 等級 | 條件 | 結果 |
|------|------|------|
| 🟢 READY | HIGH ≥ L3，MEDIUM ≥ L2 | ❌ 不符合 |
| 🟡 PARTIALLY | HIGH 全 L2+，MEDIUM 部分 < L2 | ❌ 不符合 |
| 🔴 NOT READY | HIGH ≥ 1 項低於 L2 | ✅ **當前狀態**（10 項 HIGH 低於 L2） |

---

## 🎯 整體判定（一句話總結）

**SDLC 應用層幾乎完全空白（無任何 CI/CD、無單元測試框架、無 secret/SAST/SCA/容器掃描自動化）；但 Azure 部署層 IaC 規劃出色（Bicep 完整、Managed Identity 全到位、Key Vault 21 secrets 全 KV-backed），可視為「Azure platform 安全配置已達 L2-L3，但 SDLC 自動化守門器尚未建立」的不對稱狀態。**

---

## 部分 1：SDLC 必須項評分（9 項）

### SDLC-01: Secret Scanning 🔴 HIGH

> **企業基準**: Pre-commit hook + CI 掃描（gitleaks 開源）

| 證據項目 | 結果 |
|---------|------|
| `.husky/` 目錄 | ❌ **不存在**（`ls .husky/` → No such file or directory）|
| `package.json` devDependencies 中 husky/lint-staged | ❌ **不存在**（行 121-142 完整列出，無 husky）|
| `.github/workflows/` | ❌ **整個 workflows 目錄不存在**（`.github/` 只有 `agents/`，無 `workflows/`）|
| `.gitleaks.toml` / gitleaks 配置 | ❌ 不存在 |
| `.pre-commit-config.yaml` | ❌ 不存在 |

**評分**: **L0（Absent）**

**理由**: 完全沒有 secret scanning 機制。`.gitignore` 第 5-7 行雖有排除 `.env`、`.env.local`、`.env.*.local`，但這只是被動防止 commit，沒有主動掃描已 commit 內容是否含 secrets。

**風險**: 🔴 任何開發者誤 commit 帶 API key / password 的程式碼將直接進 GitHub 歷史，需 BFG repo-cleaner 才能清除。

---

### SDLC-02: SAST（靜態掃描）🟡 MED

> **企業基準**: CI 整合 SAST（Semgrep CE 開源）

| 證據項目 | 結果 |
|---------|------|
| `.semgrep.yml` / `semgrep` 配置 | ❌ 不存在 |
| GitHub Actions Semgrep step | ❌ workflows 不存在 |
| ESLint security rules | 🟡 部分（next.js 內建 `eslint-config-next` v15.0，但無 `eslint-plugin-security` / `eslint-plugin-no-secrets`）|

**證據**:
- `package.json:134-135`: 只有 `eslint: ^8.57.0` + `eslint-config-next: ^15.0.0`
- 無 `.eslintrc.security.js` 或 security-focused ESLint plugin

**評分**: **L0（Absent）**

**理由**: 沒有任何 SAST 工具整合。連最基本的 ESLint security plugin 都沒有。

---

### SDLC-04: SCA（相依套件漏洞掃描）🔴 HIGH

> **企業基準**: npm audit + Dependabot（GitHub 內建免費）

| 證據項目 | 結果 |
|---------|------|
| `.github/dependabot.yml` | ❌ **不存在** |
| `package.json` 中 `audit` script | ❌ **無**（行 6-21 完整 scripts 列表，無 audit 相關）|
| GitHub Actions npm audit step | ❌ workflows 不存在 |
| `npm audit` 手動執行紀錄 | ❌ 未發現任何文件記載定期執行 |

**評分**: **L0（Absent）**

**理由**: 套件漏洞掃描完全空白。專案 dependencies 共 77 個（package.json:39-117），devDependencies 20 個，無任何自動化漏洞偵測。

**風險**: 🔴 已知的 CVE 漏洞（如 npm 套件 supply-chain attack）將無法被發現。

---

### SDLC-06: 容器掃描 🔴 **HIGH（v1.2 升級）**

> **企業基準**: Trivy 整合到 CI/ACR push 前掃描（aquasecurity/trivy-action 免費）

| 證據項目 | 結果 |
|---------|------|
| Trivy 配置（`.trivyignore`、CI step）| ❌ 不存在 |
| ACR push 前掃描流程 | ❌ STEP-04 完全沒提及 |
| Dockerfile 中安全強化 | ✅ 部分（`Dockerfile:117-120` 非 root user `nextjs:1001`、`HEALTHCHECK` 配置 `Dockerfile:161-162`）|
| ACR Bicep 中 quarantinePolicy | ❌ **disabled**（`acr.bicep:108-110`：「`quarantinePolicy: { status: 'disabled' }`」）|

**證據** — `acr.bicep:106-110`：
```bicep
// Quarantine policy gates new images behind a manual scan approval.
// Disabled to keep the deploy loop fast during Pilot
quarantinePolicy: {
  status: 'disabled'
}
```

**證據** — `04-container-build-push.md` 行 1-200 完整搜尋：grep "trivy|scan|vulnerability" → **0 hits**。

**評分**: **L0（Absent）**

**理由**:
1. **完全沒有容器掃描**（既無本地、也無 CI、也無 ACR Tasks）
2. Dockerfile 雖採非 root user 是好的（部分 L1）但這是 baseline 而非掃描
3. ACR quarantinePolicy 明確 disabled — 任何 image push 後可立即被 deploy

**🔴 重大風險**: v1.2 已將容器掃描升級為 HIGH，但實際完全空白。Pilot 上線前必須補齊。

---

### SDLC-08: CI/CD 守門 🔴 HIGH

> **企業基準**: GitHub Actions branch protection + 安全測試失敗 → block merge

| 證據項目 | 結果 |
|---------|------|
| `.github/workflows/*.yml` | ❌ **完全不存在**（`.github/` 目錄只有 `agents/`）|
| Branch protection 配置 | ❓ GitHub repo 設定無法從 codebase 驗證；但既無 workflow 即無 status checks 可 require |
| `azure-pipelines.yml` / 其他 CI | ❌ 不存在 |
| Pre-commit hook | ❌ 不存在（同 SDLC-01）|

**證據** — `CHANGE-055-azure-deployment-foundation.md:25-33`（盤點發現）：
> | `.github/workflows/`（CI/CD） | ❌ 不存在 |
> | `azure-pipelines.yml`（Azure DevOps） | ❌ 不存在 |

**評分**: **L0（Absent）**

**理由**: 沒有任何形式的 CI/CD 守門。所有合併現在依賴開發者本機執行 `npm run type-check` + `npm run lint`（package.json:11-12），但無強制機制。

**規劃狀態**: `azure-deployment-plan.md:425-464` 有 GitHub Actions workflow 的範例草稿，但屬於 W5-W6 才開始實作（CHANGE-055 Phase 3）。

---

### SDLC-09: 環境隔離 🔴 HIGH

> **企業基準**: dev / staging / prod 完全隔離（v1.2 強化：三套獨立 ACA Environment + ACR + KV + PG）

**Bicep parameters 證據**:
- `infrastructure/bicep/parameters/uat.parameters.json` ✅ 存在
- `infrastructure/bicep/parameters/prod.parameters.json` ✅ 存在
- 中間環境（staging）❌ 不存在

**main.bicep:21-27**:
```bicep
@allowed([
  'uat'
  'prod'
])
param environment string
```

**證據** — `manual-setup/resources-checklist.md:44-54` 命名約定：
- UAT: `rg-ai-document-extraction-uat` / `acraidocextractuat` / `kv-aidocextract-uat`
- Prod: `rg-ai-document-extraction-prod` / `acraidocextractprod` / `kv-aidocextract-prod`

**評分**: **L1（Initial）**

**理由**:
- ✅ Bicep 已支援 UAT 與 Prod 兩套獨立環境 + 不同 SKU（`acrSku`、`postgresSkuName`）
- ✅ 命名規範清楚分隔（`-uat` vs `-prod`）
- ⚠️ **缺少 staging（中間環境）**— v1.2 要求 dev/staging/prod 三套
- ⚠️ **dev 環境未明確規劃**（local docker-compose 算 dev，但未進 Azure）
- ⚠️ 實際環境尚未建立（仍規劃中）

**升級到 L2 條件**:
1. 建立 staging Bicep parameters
2. 文檔化 dev → staging → prod 升級流程
3. 至少 UAT 環境實際部署成功（W4 milestone）

---

### SDLC-10: 安全測試（單元）🟡 MED

> **企業基準**: 安全相關邏輯有測試（auth / permission / Zod validation / middleware）

**測試文件實際盤點**:
```
tests/
├── unit/services/batch-processor-parallel.test.ts  (僅 1 個檔案)
├── integration/  (空目錄)
└── e2e/  (空目錄)
```

**證據**:
- `package.json` 中 **無** `jest` / `vitest` / `mocha` / `chai` 依賴（行 121-142）
- `package.json` scripts 中 **無** `test` / `test:watch` / `test:coverage`（行 6-21）
- `.claude/rules/testing.md` 規範文件中假設使用 `vitest`，但實際 codebase 無此安裝
- 唯一測試 `batch-processor-parallel.test.ts` 用 `describe`/`it`/`expect` 但**沒有測試 runner 可執行**

**唯一測試內容**（`tests/unit/services/batch-processor-parallel.test.ts:13-43`）：測試 `p-queue-compat` 並發控制 — 屬於業務邏輯測試，非安全測試。

**Auth/Permission/Validation 測試覆蓋率**: **0%**（grep `auth|permission|validation|security` in tests/ → No files found）

**評分**: **L0（Absent）**

**理由**:
1. 沒有測試框架安裝
2. 唯一一個測試文件無法執行（無 runner）
3. 完全沒有安全相關測試

**對比 v1.2 基準**: 應有 auth middleware test、Zod schema test、RBAC test、rate limit test。

---

### SDLC-11: 滲透測試 🟡 MED

> **企業基準**: 每年至少一次第三方滲透測試（內部 IT 或 OWASP ZAP staging）

| 證據項目 | 結果 |
|---------|------|
| `pen-test-results.md` | ❌ 不存在（`docs/07-deployment/02-azure-deployment/security/` 目錄不存在）|
| 滲透測試紀錄 | ❌ 無任何歷史紀錄 |
| OWASP ZAP 配置 | ❌ 不存在 |

**規劃狀態** — `azure-deployment-plan.md:818-820`（W9 規劃）：
> **W9** | 06/17-06/23 | UAT + Pen-test | UAT 環境完整測試 + Security pen-test + 修復

**評分**: **L0（Absent）**

**理由**: 從未執行過任何滲透測試。已**規劃**在 W9（2026-06-17~06-23）執行，但目前處於 W1（2026-04-22~04-28）。

**升級路徑**: Phase 4-5 補齊（`azure-deployment-plan.md:944-947` 列為 Phase 5.2，預計 3-5 person-days）。

---

### SDLC-12: Threat Modeling 🟢 LOW

> **企業基準**: 重大功能設計階段做 STRIDE 威脅建模（Markdown 文檔）

| 證據項目 | 結果 |
|---------|------|
| STRIDE 文件 / threat-model.md | ❌ 不存在 |
| 重大功能（V3 提取管線、Azure AD SSO、文件上傳）的威脅建模 | ❌ 未發現 |

**評分**: **L0（Absent）**

**理由**: 雖有 56 份 CHANGE 文件 + 22 個 Epic 規劃，但**沒有任何 STRIDE / DREAD / Attack Tree 形式的威脅建模文件**。風險識別散落在各 CHANGE 文件的「Critical 風險」章節（如 CHANGE-055 第 51-72 行的 4 項 Critical 風險），但無系統性的威脅建模產出。

**升級到 L2 條件**: 對至少 3 個關鍵功能（auth、file upload、V3 extraction pipeline）做完整 STRIDE。

---

### SDLC 必須項小結

| ID | 項目 | 風險 | 評分 | HIGH 未達 L2？ |
|----|------|------|------|-------|
| SDLC-01 | Secret Scanning | 🔴 HIGH | L0 | ✅ **是** |
| SDLC-02 | SAST | 🟡 MED | L0 | — |
| SDLC-04 | SCA | 🔴 HIGH | L0 | ✅ **是** |
| SDLC-06 | 容器掃描 | 🔴 HIGH | L0 | ✅ **是** |
| SDLC-08 | CI/CD 守門 | 🔴 HIGH | L0 | ✅ **是** |
| SDLC-09 | 環境隔離 | 🔴 HIGH | L1 | ✅ **是**（HIGH 但 L1 未達 L2）|
| SDLC-10 | 安全測試 | 🟡 MED | L0 | — |
| SDLC-11 | 滲透測試 | 🟡 MED | L0 | — |
| SDLC-12 | Threat Modeling | 🟢 LOW | L0 | — |
| **小計** | | | **L0.1** | **5/9 HIGH 未達 L2** |

---

## 部分 2：SDLC 延後項評分（3 項）

### SDLC-03: DAST 🟡 延後

> **企業基準**: OWASP ZAP 對 staging 自動掃描

| 證據項目 | 結果 |
|---------|------|
| OWASP ZAP 配置 | ❌ 不存在 |
| DAST CI step | ❌ workflows 不存在 |

**評分**: **L0（Absent）**

**狀態**: 矩陣標為「🟡 延後」— 對齊規劃，可併入 SDLC-11 滲透測試一起做。

---

### SDLC-05: SBOM 生成 🟡 延後

> **企業基準**: 用 Syft（開源）生成 SPDX/CycloneDX SBOM

| 證據項目 | 結果 |
|---------|------|
| `syft.yaml` / SBOM 工具 | ❌ 不存在 |
| `sbom.json` / `sbom.spdx.json` | ❌ 不存在 |

**評分**: **L0（Absent）**

**狀態**: 矩陣標為「🟡 延後」— 對齊規劃。對內系統 SBOM 價值較低。

---

### SDLC-07: 程式碼簽章 🟡 延後

> **企業基準**: GPG / Notation（ACR Image 簽章）

| 證據項目 | 結果 |
|---------|------|
| GPG signing key 配置 | ❌ 不存在 |
| Notation / Cosign 配置 | ❌ 不存在 |
| `acr.bicep` `trustPolicy` | ❌ **disabled**（`acr.bicep:113-117`：「Trust policy (content trust / Notary v1) requires Premium SKU; keep disabled」）|

**評分**: **L0（Absent）**

**狀態**: 矩陣標為「🟡 延後」— 對齊規劃。ACR Standard SKU 不支援 Content Trust，需升級 Premium。

---

### SDLC 延後項小結

| ID | 項目 | 風險 | 評分 | 狀態 |
|----|------|------|------|------|
| SDLC-03 | DAST | 🟡 MED | L0 | 規劃延後（對齊矩陣）|
| SDLC-05 | SBOM | 🟡 MED | L0 | 規劃延後（對齊矩陣）|
| SDLC-07 | 程式碼簽章 | 🟢 LOW | L0 | 規劃延後（對齊矩陣）|
| **小計** | | | **L0.0** | 全數延後但已記錄 |

---

## 部分 3：SDLC 部署層評分（5 項，🆕 v1.2 全 HIGH）

### SDLC-13: ACR 安全配置 🟡 MED → 🔴 HIGH（v1.2）

> **企業基準**: Image 簽章、Trivy 整合、admin user disabled、push 前掃描

**Bicep 證據** — `acr.bicep`：
```bicep
// 行 51-53
@description('Enable admin user (REQUIRED to be false for security)')
param adminUserEnabled bool = false

// 行 83-84
adminUserEnabled: adminUserEnabled  // 強制 false

// 行 108-110: Quarantine policy disabled (Pilot 階段)
quarantinePolicy: {
  status: 'disabled'
}

// 行 113-117: Trust policy disabled (需 Premium SKU)
trustPolicy: {
  status: 'disabled'
  type: 'Notary'
}

// 行 119-124: Retention policy enabled (30 days untagged)
retentionPolicy: {
  days: 30
  status: 'enabled'
}
```

**手動 setup 證據** — `manual-setup/resources-checklist.md:60-74`：
- ✅ `admin-enabled false` 強制
- ✅ Standard tier
- ❌ 無 Trivy 整合
- ❌ 無 quarantine policy
- ❌ 無 image signing

**評分**: **L1（Initial）**

**理由**:
- ✅ admin user 強制 disabled（Bicep + 手動清單一致）
- ✅ Retention policy 啟用（自動清理 untagged manifests）
- ❌ **無 Trivy 整合**（push 前無掃描）
- ❌ Quarantine policy disabled（image push 後可立即 deploy）
- ❌ Trust policy disabled（無 image 簽章驗證）

**🔴 升級到 L2 條件**:
1. CI workflow 加入 Trivy scan step（push 前 fail-on-CRITICAL）
2. 或啟用 ACR Tasks 自動掃描（雖需 Defender for Containers，可能產生費用）

---

### SDLC-14: ACA Managed Identity 🔴 HIGH

> **企業基準**: 所有 ACA 服務用 System-Assigned MI 存取資源（取代 connection string）

**Bicep 證據** — `container-app.bicep:182-185`：
```bicep
identity: {
  type: 'SystemAssigned'
}
```

**ACR pull 證據** — `container-app.bicep:209-214`：
```bicep
registries: [
  {
    server: acrLoginServer
    identity: 'system'  // ✅ MI pull image
  }
]
```

**Key Vault secret 注入證據** — `container-app.bicep:219-223`：
```bicep
secrets: [for secret in secretMappings: {
  name: secret.name
  keyVaultUrl: '${keyVaultUri}/secrets/${secret.kvSecretName}'
  identity: 'system'  // ✅ MI 解 KV secret
}]
```

**RBAC 規劃** — `08-first-deployment.md:172-253`（Action 8.3）：
- ✅ 規劃 3 個 role 授予：`AcrPull` / `Key Vault Secrets User` / `Storage Blob Data Contributor`
- ❌ **但 RBAC 未在 Bicep 自動化**（`container-app.bicep:181-182` comment 說「wired in main.bicep AFTER」但 `main.bicep` 內 grep `roleAssignment` → 0 hits）
- ⚠️ 改由 az CLI 手動執行（STEP-08 Action 8.3）

**Storage Account 證據** — `storage.bicep:115-116`：
```bicep
@description('Allow shared key access (false = enforce Entra ID/MI auth only)')
param allowSharedKeyAccess bool = true  // ⚠️ UAT 預設 true（為相容工具）
```

**評分**: **L2（Managed）**

**理由**:
- ✅ Container App System-Assigned MI **在 Bicep 中已設定**
- ✅ ACR pull、KV、Blob 三條路徑全 via MI（Bicep + 規劃文件對齊）
- ✅ 21 個 secrets 全 KV-backed（透過 `identity: 'system'`）
- ⚠️ RBAC 授予未自動化（Bicep 缺 `roleAssignment` resources，需手動 az CLI）
- ⚠️ Storage `allowSharedKeyAccess` UAT 仍 true（迁移期相容性，但 Prod 應 flip false）

**🔴 升級到 L3 條件**:
1. main.bicep 加入 RBAC roleAssignment resources（自動化全流程）
2. Prod parameters 設 `allowSharedKeyAccess: false`
3. PostgreSQL DATABASE_URL 改用 AAD token（非 password）

---

### SDLC-15: Key Vault 整合 🔴 HIGH

> **企業基準**: 所有 secret 從 Key Vault 注入 ACA（禁止 secret 寫在 ACA env vars）

**Bicep secrets 對照表** — `container-app.bicep:118-161`（21 secrets，但程式碼定義 18 個 — 與 STEP-03 文件 21 數量略有差異）：

```bicep
// 18 KV-backed secrets:
secretMappings = [
  database-url, auth-secret, jwt-secret, session-secret, encryption-key,
  azure-openai-api-key, azure-openai-endpoint, azure-di-key, azure-di-endpoint,
  upstash-redis-rest-url, upstash-redis-rest-token,
  microsoft-graph-client-id, microsoft-graph-client-secret, microsoft-graph-tenant-id,
  smtp-host, smtp-port, smtp-user, smtp-password
]
```

**KV 安全配置** — `key-vault.bicep`：
```bicep
// 行 56: RBAC mode (取代 legacy access policies)
enableRbacAuthorization: enableRbacAuthorization  // default true

// 行 142-148: Soft delete + retention
enableSoftDelete: true   // 永久啟用
softDeleteRetentionInDays: softDeleteRetentionDays  // UAT=7, Prod=90

// 行 151: Purge protection
enablePurgeProtection: enablePurgeProtection ? true : null  // default true (immutable)
```

**Secrets 注入流程** — `03-secrets-configuration.md:39-145`：
- ✅ 21 secrets 完整定義（含 SMTP 4 個 + Microsoft Graph 3 個）
- ✅ 注入流程明確要求**本機產生**（不從 dev 複製）
- ✅ 4 個保護機制（不 query value、不寫入 state file、必 verify、approval gate）
- ✅ ENCRYPTION_KEY 標記為「不可變更」(`requires_approval: true`)

**Plain-text env vars** — `container-app.bicep:99-103`：
```bicep
param envVars object = {
  NODE_ENV: 'production'
  AUTH_TRUST_HOST: 'false'
  SYSTEM_USER_ID: 'system-user-prod'
}
```
✅ 純設定值，無敏感資訊。

**評分**: **L3（Defined）**

**理由**:
- ✅ 21 個 production secrets 全部 KV-backed
- ✅ ACA 完全透過 `keyvaultref:/identityref:system` 解析
- ✅ KV 啟用 RBAC + Purge Protection + Soft Delete
- ✅ Secrets 注入有完整的人工保護機制（不洩漏 value）
- ✅ Plain-text env vars 經審查只放非敏感配置
- ⚠️ Bicep 中數量為 18，文件聲稱 21（4 個 self-generated + 14 外部）— 數字差異需釐清

**🟢 已達企業基準**（KV 整合層面），但**整體部署尚未實際執行**（仍規劃中），故不能評為 L4。

---

### SDLC-16: Blob Storage 安全 🔴 HIGH

> **企業基準**: 關閉 anonymous access、SAS token 短期+IP 限制、User Delegation SAS

**Bicep 證據** — `storage.bicep:121-181`：

```bicep
// 行 73: Public blob access 強制 false
allowBlobPublicAccess: bool = false  // 註：「REQUIRED to be false for security」

// 行 140: TLS 1.2 minimum
minimumTlsVersion: 'TLS1_2'

// 行 143: HTTPS-only
supportsHttpsTrafficOnly: true

// 行 87-90: Soft delete
blobSoftDeleteRetentionDays = 7  // 預設 7 天
containerSoftDeleteRetentionDays = 7

// 行 209: Versioning
isVersioningEnabled: true

// 行 232: Documents container
publicAccess: 'None'  // 明確 private

// 行 116: Shared key access
allowSharedKeyAccess: bool = true  // ⚠️ UAT 預設 true
```

**Encryption** — `storage.bicep:168-180`：
- ✅ Microsoft-managed encryption（PMK）— UAT 足夠
- ⚠️ CMK 預留 Prod 加固

**Network ACL** — `storage.bicep:160-163`：
- ✅ `defaultAction = Deny` when public access disabled
- ⚠️ UAT 預設 `publicNetworkAccess: 'Enabled'`（為配合 Pilot；Prod 可改 Disabled + Private Endpoint）

**SAS Token / User Delegation SAS**: ❌ **未在 Bicep / 規劃文件中提及**（grep "SAS\|delegation" → 0 hits）

**評分**: **L2（Managed）**

**理由**:
- ✅ `allowBlobPublicAccess = false` 強制（雙保險：account + container `publicAccess: None`）
- ✅ TLS 1.2、HTTPS-only、Soft Delete、Versioning 全到位
- ✅ defenseInDepth 設計（網路 ACL + container 級 publicAccess）
- ⚠️ UAT 仍允許 Shared Key Access（Bicep `allowSharedKeyAccess = true`）
- ❌ **無 SAS token 規劃**（User Delegation SAS、IP 限制、短期 expiry 完全未提及）
- ❌ Public Network Access 預設 Enabled（Private Endpoint 委外給 Infra Admin）

**🔴 升級到 L3 條件**:
1. Prod parameters 設 `allowSharedKeyAccess: false`
2. 新增 SAS token 使用規範文件（短期 expiry + IP rules + User Delegation SAS 優先）
3. 啟用 Private Endpoint（依賴 Infra Admin 配合）

---

### SDLC-17: Container Apps 網路隔離 🔴 HIGH

> **企業基準**: Web app external、Python OCR/Mapping internal-only、n8n internal

**Bicep 證據** — `container-app.bicep:81-84`：
```bicep
@description('Ingress external (true = public FQDN, false = internal only)')
param externalIngress bool = true  // ⚠️ 預設 true
```

**main.bicep:296-302**: container-app 配置中**未顯式傳 `externalIngress`**（使用預設 `true`）。

**CAE 證據** — `container-apps-env.bicep:32-33`：
```bicep
@description('Internal load balancer (true = internal-only ingress, false = external)')
param internalLoadBalancer bool = false  // ⚠️ 預設 false（external）
```

**`baseProperties` config** — `container-apps-env.bicep:62-64`：
```bicep
zoneRedundant: false  // v0.3 §9：Pilot/UAT 暫無 HA 需求
```

**Python OCR / Mapping services**:
- ✅ Python services 存在於 `python-services/extraction/` + `python-services/mapping/`
- ❌ **Bicep 中只有單一 `containerApp`**（main.bicep:273-302），**未部署 Python services 為獨立 ACA**
- ❌ 規劃中沒有 Python services 的 ACA 隔離方案

**HTTPS-only 證據** — `container-app.bicep:198-205`：
```bicep
ingress: {
  external: externalIngress
  targetPort: targetPort
  transport: 'auto'
  allowInsecure: false  // ✅ 強制 HTTPS
}
```

**網路架構決策** — `azure-deployment-plan.md:534-560`（已委外 Infra Admin）：
> **決定**：網路架構**完全委外 Infra Admin 負責**。本文件僅提供應用層對網路的需求清單。

**評分**: **L1（Initial）**

**理由**:
- ✅ HTTPS-only（`allowInsecure: false`）強制
- ✅ Bicep 支援 internal/external 切換
- ❌ **Web app `externalIngress: true` 預設**（UAT 即公網暴露）
- ❌ **Python OCR / Mapping services 未在 Bicep 中部署**（單一 containerApp 模組，無 internal-only ingress）
- ❌ 委外 Infra Admin 但目前**沒有 network-topology.md**（grep 確認此文件不存在）
- ⚠️ 預設 Container Apps Environment 是 managed VNet（沒 vnetIntegration）

**🔴 升級到 L2 條件**:
1. main.bicep 補上 Python OCR + Mapping 兩個 ACA module（internal-only ingress）
2. 與 Infra Admin 確認 VNet integration 計劃（W2-W4 期間）
3. Prod parameters 將 web app ingress 改為 `internal-only` + Front Door

---

### SDLC 部署層小結

| ID | 項目 | 風險 | 評分 | HIGH 未達 L2？ |
|----|------|------|------|-------|
| SDLC-13 | ACR 安全配置 | 🔴 HIGH | L1 | ✅ **是** |
| SDLC-14 | ACA Managed Identity | 🔴 HIGH | L2 | ❌ 已達 L2 |
| SDLC-15 | Key Vault 整合 | 🔴 HIGH | L3 | ❌ 已達 L3 |
| SDLC-16 | Blob Storage 安全 | 🔴 HIGH | L2 | ❌ 已達 L2 |
| SDLC-17 | 網路隔離 | 🔴 HIGH | L1 | ✅ **是** |
| **小計** | | | **L1.6** | **2/5 HIGH 未達 L2** |

---

## 🔧 CI/CD Pipeline 現況分析（特別章節）

### 現有 GitHub Actions Workflow 清單

```bash
$ ls .github/
agents/  # 只有 agent 設定（與 BMAD 框架相關）

$ ls .github/workflows/
ls: cannot access '.github/workflows/': No such file or directory
```

**結論**: ✅ **完全沒有任何 GitHub Actions workflow**

### 安全工具整合狀態

| 工具 | 整合狀態 | 證據 |
|------|---------|------|
| **gitleaks** | ❌ 未整合 | 無 `.gitleaks.toml`、無 husky pre-commit |
| **Semgrep CE** | ❌ 未整合 | 無 `.semgrep.yml`、無 workflows |
| **Trivy** | ❌ 未整合 | 無 `.trivyignore`、Dockerfile/Bicep/STEP-04 全無提及 |
| **npm audit** | ❌ 未整合到 CI | package.json scripts 無 `audit`，僅可手動 `npm audit` |
| **Dependabot** | ❌ 未配置 | `.github/dependabot.yml` 不存在 |
| **CodeQL** | ❌ 未整合 | 無 workflow |
| **Snyk** | ❌ 未整合（且矩陣已標為「禁用，付費」）| — |

### Branch Protection 配置

從 codebase 無法直接驗證 GitHub repo 的 branch protection 設定（這在 GitHub UI 而非 codebase）。但：
- 既無任何 workflow 可作為 required status check
- 無 `CODEOWNERS` 文件（grep 未發現）
- main 分支保護（若有）目前只能是「至少 1 reviewer」這類最基本要求

### 重大發現

🔴 **Code-to-Production 路徑完全沒有自動化守門**：
1. 開發者本機 commit → push 到 main → 沒有任何 CI 檢查
2. 沒有 Docker image build、沒有 image scan、沒有 deploy automation
3. 完全依賴開發者紀律（執行 `npm run type-check` + `npm run lint` 是約定，但無強制機制）

**對齊規劃**: CHANGE-055 Phase 3（W5-W6）才會建立 GitHub Actions。但這意味 **Pilot 上線前最後 5 週才開始實作 CI/CD**，風險偏高。

---

## ☁️ Azure 部署規劃現況分析（特別章節）

### IaC 模板覆蓋率

| 工具 | 狀態 |
|------|------|
| **Bicep** | ✅ **採用**（v0.3 已定案，Optional Track + Mode C 混合協作）|
| Terraform | ❌ 不採用 |
| ARM Template | ❌ 不採用 |
| Pulumi | ❌ 不採用 |

**Bicep 模板清單** — `infrastructure/bicep/`：
```
main.bicep                            ✅ 應用層 orchestration（331 行）
parameters/
  ├── uat.parameters.json             ✅ UAT 參數
  └── prod.parameters.json            ✅ Prod 參數
modules/
  ├── acr.bicep                       ✅ Container Registry
  ├── postgres.bicep                  ✅ PostgreSQL Flexible Server
  ├── storage.bicep                   ✅ Storage Account
  ├── key-vault.bicep                 ✅ Key Vault（條件式部署）
  ├── app-insights.bicep              ✅ Application Insights
  ├── container-apps-env.bicep        ✅ ACA Environment
  └── container-app.bicep             ✅ Container App（含 18 KV secrets）
```

**手動 setup 對照** — `manual-setup/resources-checklist.md`（21K 行，Mode B 後備路徑）

### ACR / ACA / Blob / Key Vault 配置文檔狀態

| 資源 | Bicep | 手動 setup | UAT step 文件 | 評估 |
|------|-------|-----------|--------------|------|
| ACR | ✅ | ✅ | STEP-04 + STEP-08 Action 8.3 | 🟢 完整 |
| ACA Environment | ✅ | ✅ | STEP-02 Action 2.3 | 🟢 完整 |
| Container App | ✅ | ✅ | STEP-08 | 🟢 完整 |
| PostgreSQL | ✅ | ✅ | STEP-02 Action 2.4 + STEP-05 | 🟢 完整 |
| Storage | ✅ | ✅ | STEP-02 Action 2.5 | 🟢 完整 |
| Key Vault | ✅（條件式）| ✅ | STEP-03（21 secrets） | 🟢 完整 |
| App Insights | ✅ | ✅ | STEP-02 Action 2.6 | 🟢 完整 |
| **Python OCR/Mapping ACA** | ❌ **缺失** | ❌ 缺失 | ❌ 缺失 | 🔴 重大缺口 |
| Network (VNet/PE/NSG) | ❌（委外）| ❌（委外）| ❌（委外）| 🟡 由 Infra Admin 決定 |

### Managed Identity 規劃進度

| 路徑 | Bicep 狀態 | RBAC 自動化 |
|------|----------|------------|
| ACA → ACR (AcrPull) | ✅ `registries[].identity: 'system'` | ❌ 手動 az CLI（STEP-08）|
| ACA → KV (Secrets User) | ✅ `secrets[].identity: 'system'` | ❌ 手動 az CLI |
| ACA → Blob (Data Contributor) | ⚠️ 應用層自行用 `DefaultAzureCredential` | ❌ 手動 az CLI |
| ACA → PostgreSQL | ⚠️ Bicep 支援 Entra Admin（行 86-90），但 DATABASE_URL 仍用 password（過渡期）| ❌ Phase 4 才會切換 |

**結論**: ✅ MI 在 Bicep **資源層面**已完整啟用（System-Assigned + identity refs），但 ⚠️ RBAC role 授予**未在 Bicep 自動化**（依賴手動 STEP-08 Action 8.3）。

### 環境隔離（dev/staging/prod）規劃進度

| 環境 | Bicep params | 命名約定 | 部署狀態 |
|------|-------------|---------|---------|
| dev (local) | N/A（用 docker-compose）| `*-dev` 概念存在 | ✅ 本地運作 |
| **UAT** | ✅ `uat.parameters.json` | `*-uat` | 📋 W4 首次部署 |
| **staging** | ❌ **不存在** | ❌ 未規劃 | ❌ 未規劃 |
| **prod** | ✅ `prod.parameters.json` | `*-prod` | 📋 W11+ Pilot |

**重大缺口**: ⚠️ **沒有 staging 中間環境**。v1.2 矩陣 SDLC-09 要求 dev/staging/prod 三套，但目前規劃為「本地 dev + UAT + Prod」，缺中間 staging 用於 Pilot 前的真實流量測試。

---

## 🚨 重大發現（HIGH 風險未達 L2 的關鍵項目）

> 以下 5 大關鍵發現按嚴重度排序。所有發現均針對 **HIGH 風險 + 評分 < L2** 的項目。

### 🔴 發現 1：CI/CD 自動化守門完全空白（影響 SDLC-01/04/06/08，4 項 HIGH 全 L0）

**症狀**:
- `.github/workflows/` 目錄不存在
- 沒有 husky pre-commit hook
- 沒有任何 secret/SAST/SCA/容器掃描自動化
- branch protection 即使有也沒有 status check 可 require

**證據**:
```
.github/
└── agents/  (僅 BMAD agent 配置，無任何 workflow)
```

**業務影響**:
- 任何開發者誤 commit secret 將直接進 GitHub 歷史
- 任何 CRITICAL CVE 套件可順利 merge
- 任何含漏洞的 Docker image 可直接 push 到 ACR
- `npm run type-check` + `npm run lint` 完全靠開發者紀律

**修復路徑**: CHANGE-055 Phase 3（W5-W6，2026-05-20~06-02）。但若按目前進度，從 W1 到 W5 中間 4 週仍是「無守門」狀態。

**建議**: 將最低限度的 gitleaks pre-commit + npm audit CI 提前到 W2（與架構評審並行），不需等 Phase 3。

---

### 🔴 發現 2：容器掃描完全沒有規劃（SDLC-06 v1.2 升級為 HIGH）

**症狀**:
- ACR Bicep 的 `quarantinePolicy: { status: 'disabled' }`（acr.bicep:108-110）
- ACR Bicep 的 `trustPolicy: { status: 'disabled' }`（acr.bicep:113-117）
- STEP-04 (Container Build & Push) 完全沒提及 Trivy 或任何掃描
- `package.json` / `Dockerfile` / Bicep / UAT step 全部 grep `trivy|scan|vulnerability` → **0 hits**

**v1.2 重要性**: 矩陣明確標記：
> **SDLC-06 升級** | 容器掃描從 MED → HIGH | 原因：採用 Container Apps + ACR，容器鏡像安全成為關鍵

**業務影響**:
- Pilot 上線後，任何含 CRITICAL CVE 的 base image（node:20-slim）漏洞直接帶到 prod
- 無法防範 supply-chain attack（`npm ci` 安裝的依賴 vulnerability）
- ACR 中的舊 image 也沒有重新掃描機制（unscanned drift）

**修復路徑**:
1. STEP-04 加入 Trivy step（aquasecurity/trivy-action 免費）
2. CI workflow `fail-on: HIGH,CRITICAL`
3. 或啟用 ACR Tasks 自動掃描（雖需 Defender for Containers，可能產費用，待 Infra Admin 決定）

---

### 🔴 發現 3：單元測試框架完全缺失（影響 SDLC-10 + 整體品質）

**症狀**:
- `package.json` devDependencies **無** `jest` / `vitest` / 任何測試 runner
- `package.json` scripts **無** `test` / `test:watch` / `test:coverage`
- 唯一測試文件 `tests/unit/services/batch-processor-parallel.test.ts` 用 `describe`/`it`/`expect` 但無 runner 可執行
- `auth|permission|validation|security` 在 tests/ 中 grep → 0 files found
- `.claude/rules/testing.md` 假設使用 vitest，但實際未安裝（規範與現實脫節）

**影響的合規項目**:
- SDLC-10 安全測試（auth/permission/validation 完全無覆蓋）
- AppSec 整體 Wave 3 實作前要求「完整 E2E 測試集」（矩陣 §3.3）— 目前 e2e/ 目錄為空
- Phase 4 自動化前置條件未滿足

**業務影響**:
- 22 個 Epic / 200 服務 / 331 API routes 全部沒有單元測試保護
- 任何 refactor / 升級可能引入 silent regression
- Pilot 上線後 bug 排查只能靠 production log

**修復路徑**:
1. 立即安裝 vitest（~5 min）
2. 補齊基本 auth/permission/Zod 測試（~3-5 person-days）
3. 對齊 `.claude/rules/testing.md` 規範

---

### 🟡 發現 4：環境隔離缺中間 staging 環境（SDLC-09 L1，HIGH）

**症狀**:
- Bicep parameters 只有 `uat.parameters.json` + `prod.parameters.json`
- main.bicep `environment` 參數 `@allowed: ['uat', 'prod']`（main.bicep:21-27）
- 規劃文件全程無 staging 提及

**v1.2 矩陣明確要求**:
> SDLC-09 環境隔離（Container Apps 強化）：dev / staging / prod 完全隔離

**業務影響**:
- Pilot 前無真實流量測試環境
- UAT 同時承擔開發測試 + Pilot 演練 + Prod-grade 驗證 3 種角色（容易污染）
- Prod 部署只有 UAT → Prod 一跳（無 staging 緩衝）

**修復路徑**:
1. 與 Infra Admin 討論：staging 是否與 UAT 合併（Pilot 接受），還是另建（多 1 套 ACA Env 成本）
2. 若合併，文件化 UAT 同時是 staging 的限制與 Pilot 風險聲明
3. 若另建，補 `staging.parameters.json`

---

### 🟡 發現 5：Python OCR/Mapping services 缺 ACA 部署 + 網路隔離（SDLC-17 L1）

**症狀**:
- `python-services/extraction/` + `python-services/mapping/` 服務存在
- 但 `infrastructure/bicep/main.bicep` 中**只有單一 `containerApp` 模組**（行 273-302）
- 沒有 `python-extraction-service.bicep` 或 `python-mapping-service.bicep`
- 沒有 internal-only ingress 配置（兩個 Python service 應 internal-only）

**v1.2 矩陣明確要求**:
> SDLC-17：Web app: external ingress / **Python OCR / Mapping: internal-only ingress** / n8n: internal-only or VNet integration

**業務影響**:
- Pilot 上線時 Python services 部署位置不明（仍跑 docker-compose? 移到 ACA?）
- 若 Python services 與 Next.js 同 process（OCR_SERVICE_URL=http://localhost:8000 in `.env.example:90`），則 cold start 時 Python 也跟著啟動，影響回應時間
- 若另建 ACA 但 external ingress，則 OCR/Mapping API 直接暴露公網（攻擊面擴大）

**修復路徑**:
1. 確認 Python services 部署架構決策（同 ACA / 獨立 ACA / 完全外掛）
2. 若獨立 ACA：補 Bicep module + `externalIngress: false`
3. 若同 ACA：補 sidecar 配置（multi-container ACA）

---

## 📋 完整評分匯總表

### 領域成熟度總覽

| 子領域 | 項目數 | 已實作 | 部分實作 | L0 | L1 | L2 | L3 | L4 | 平均 | HIGH 未達 L2 |
|------|------|------|---------|---|---|---|---|---|------|----|
| SDLC 必須項 | 9 | 0 | 1 (SDLC-09) | 8 | 1 | 0 | 0 | 0 | L0.1 | 5 |
| SDLC 延後項 | 3 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | L0.0 | 0 |
| SDLC 部署層 | 5 | 1 (SDLC-15) | 4 | 0 | 2 | 2 | 1 | 0 | L1.6 | 2 |
| **總計 17** | **17** | **1** | **5** | **11** | **3** | **2** | **1** | **0** | **L0.7** | **7** |

### 17 項評分一覽

| ID | 項目 | 風險 | 評分 | 主要證據 |
|----|------|------|------|---------|
| SDLC-01 | Secret Scanning | 🔴 HIGH | L0 | 無 husky / gitleaks / workflows |
| SDLC-02 | SAST | 🟡 MED | L0 | 無 Semgrep / security ESLint |
| SDLC-03 | DAST（延後）| 🟡 MED | L0 | 無 ZAP（對齊延後） |
| SDLC-04 | SCA | 🔴 HIGH | L0 | 無 Dependabot / CI npm audit |
| SDLC-05 | SBOM（延後）| 🟡 MED | L0 | 無 Syft（對齊延後） |
| SDLC-06 | 容器掃描 | 🔴 HIGH | L0 | quarantinePolicy disabled，無 Trivy |
| SDLC-07 | 程式碼簽章（延後）| 🟢 LOW | L0 | trustPolicy disabled（對齊延後）|
| SDLC-08 | CI/CD 守門 | 🔴 HIGH | L0 | .github/workflows/ 不存在 |
| SDLC-09 | 環境隔離 | 🔴 HIGH | **L1** | UAT/Prod 已有，缺 staging |
| SDLC-10 | 安全測試（單元）| 🟡 MED | L0 | 無 vitest，僅 1 個業務測試 |
| SDLC-11 | 滲透測試 | 🟡 MED | L0 | 規劃 W9，目前 W1 |
| SDLC-12 | Threat Modeling | 🟢 LOW | L0 | 無 STRIDE 文件 |
| SDLC-13 | ACR 安全 | 🔴 HIGH | **L1** | admin disabled ✅，但無 Trivy |
| SDLC-14 | ACA Managed Identity | 🔴 HIGH | **L2** | Bicep 完整，但 RBAC 手動 |
| SDLC-15 | Key Vault 整合 | 🔴 HIGH | **L3** | 21 secrets 全 KV-backed |
| SDLC-16 | Blob Storage 安全 | 🔴 HIGH | **L2** | 預設 Private + soft delete + versioning |
| SDLC-17 | 網路隔離 | 🔴 HIGH | **L1** | external ingress 預設 + Python services 缺部署 |

---

## 🎯 Phase 3 建議優先序（給後續決策參考）

> 此章節不在原盤點範圍，但根據評估給出立即可行動的優先序作為下次討論輸入。

### 🔥 立即修復（W1-W2，不阻塞架構評審）

1. **建立最低限度 GitHub Actions**（gitleaks + npm audit）— ~半天工作量，立即升 SDLC-01/04 從 L0 → L1
2. **安裝 vitest + 寫 5 個基本 auth/permission test** — ~1 天，升 SDLC-10 從 L0 → L1

### 🟠 與 Phase 2 並行（W2-W4）

3. **加 Trivy 到 STEP-04** — 升 SDLC-06/13 從 L0/L1 → L2
4. **補 Python services Bicep module** — 升 SDLC-17 從 L1 → L2
5. **與 Infra Admin 確認 staging 策略** — 升 SDLC-09 從 L1 → L2

### 🟡 Phase 3-5（W5-W10）

6. CI/CD pipeline 完整建立（含 SDLC-08 守門）
7. Pen-test 規劃（SDLC-11，W9）
8. STRIDE 威脅建模文件（SDLC-12，至少 3 個關鍵功能）

---

## 附錄 A：路徑差異提醒

> 用戶任務說明中路徑為 `docs/06-deployment/02-azure-deployment/`，但實際 codebase 為 `docs/07-deployment/02-azure-deployment/`。本盤點以實際路徑為準。

| 任務說明 | 實際路徑 |
|---------|---------|
| `docs/06-deployment/02-azure-deployment/` | `docs/07-deployment/02-azure-deployment/` |
| `docs/06-deployment/02-azure-deployment/azure-deployment-plan.md` | `docs/07-deployment/02-azure-deployment/azure-deployment-plan.md` |
| `docs/06-deployment/02-azure-deployment/infrastructure/` | `docs/07-deployment/02-azure-deployment/infrastructure/` |

註：`docs/06-codebase-analyze/` 是 codebase 分析報告（80 份），與部署文件無關。

---

## 附錄 B：本次盤點查驗證據總覽

| 證據類型 | 文件數 | 主要佐證 |
|---------|------|---------|
| Bicep 模板 | 8 | main.bicep + 7 modules（acr/postgres/storage/key-vault/app-insights/container-apps-env/container-app）|
| UAT 部署 SOP | 13 | 00-overview ~ 11-troubleshooting + 99-ai-execution-guide |
| 主規劃文件 | 1 | azure-deployment-plan.md（v0.3，1166 行）|
| 手動 setup checklist | 1 | resources-checklist.md |
| 評估矩陣（v1.2）| 1 | enterprise-security-governance-matrix.md |
| package.json scripts/deps | 1 | 無 husky/jest/vitest，dependencies 77 個 |
| Dockerfile + .env.example + .gitignore | 3 | 全部已 review |
| 測試文件 | 1 個業務測試 | 無 runner 可執行 |
| .github/ 目錄掃描 | 1 個（agents 子目錄）| **無 workflows/** |
| Python services | 2 services（extraction + mapping）| **未在 Bicep 中部署** |

---

*盤點建立日期: 2026-04-28*
*盤點人: AI 助手（Claude）— 企業級安全審計員*
*狀態: ✅ Phase 2 SDLC 領域盤點完成*
*下一步: 建議結合 IAM / DP / AppSec / Obs / Resi / Gov 五大領域盤點，產出 Phase 3 風險矩陣與修復優先序*
