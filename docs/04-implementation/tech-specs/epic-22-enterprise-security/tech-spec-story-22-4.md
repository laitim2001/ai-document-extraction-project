# Tech Spec: Story 22.4 - CI/CD 安全 Pipeline

> **Version**: 1.1.0
> **Created**: 2026-04-28
> **Last Updated**: 2026-04-28（B6 用戶決策套用）
> **Status**: Draft
> **Story Key**: STORY-22-4
> **對應風險**: SDLC-01/04/06/08 + Gov-02 —— Phase 2 全評為 L0
> **一次解決**: 5 個 v1.2 矩陣項目 + 1 個治理基礎

---

## ✅ 用戶決策（2026-04-28）

| ID | 決策 | 影響章節 |
|----|------|----------|
| **B6** | Branch Protection **允許 admin bypass** + audit log 記錄 | AC1、Branch Protection 詳細規則、漸進式 Rollout |

**理由**：保留緊急修復（hot-fix）彈性，但所有 admin bypass 操作必須記錄到 audit log（GitHub audit log + 內部 SecurityLog），維持治理可追溯性。

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 22.4 |
| **Epic** | Epic 22 - Enterprise Security |
| **Estimated Effort** | 5 Story Points（~5-7 person-days） |
| **Dependencies** | Story 22-5（為 AC9 unit-tests check 預留 hook，非硬性） |
| **Blocking** | 無，但是 Story 22-3 的 CI 入口 |
| **修復路線圖位置** | Wave 1 Quick Wins #4 + Wave 2 #6（Trivy 整合） |

---

## Objective

建立完整的 GitHub CI/CD 安全 pipeline，從本機 commit 到 ACR push 全程自動化守門。一次性解決：
- **SDLC-01** Secret Scanning（gitleaks）
- **SDLC-02** SAST（Semgrep CE，連帶提升）
- **SDLC-04** SCA（Dependabot + npm audit）
- **SDLC-06** 容器掃描（Trivy）
- **SDLC-08** CI/CD 守門（Branch Protection + Required Status Checks）
- **Gov-02** Code Review 強制（Branch Protection + CODEOWNERS）

全部使用免費工具，符合 v1.2 矩陣「禁用 Snyk / SonarQube Cloud」原則。

---

## CI/CD Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     開發者本機（Pre-commit）                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  husky pre-commit hook                                        │   │
│  │  └─ gitleaks protect --staged --redact                        │   │
│  │     └─ Block commit if secret detected                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ git push (feature branch)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  GitHub PR Triggered Workflows                       │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ quality-checks.yml  │  │ security-secrets.yml│                   │
│  │ - type-check        │  │ - gitleaks-action   │                   │
│  │ - lint              │  │   (full diff scan)  │                   │
│  │ - i18n-check        │  └─────────────────────┘                   │
│  └─────────────────────┘                                             │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ security-deps.yml   │  │ security-sast.yml   │                   │
│  │ - npm audit         │  │ - Semgrep CE        │                   │
│  │ - pip audit         │  │   (auto + p/owasp)  │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ security-container  │  │ tests.yml           │                   │
│  │ .yml (Dockerfile)   │  │ (Story 22-5)        │                   │
│  │ - Trivy scan        │  │ - Vitest unit tests │                   │
│  │   (HIGH/CRITICAL)   │  │ - Coverage ≥ 60%    │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Branch Protection Rule (main) — ✅ B6 用戶決策 2026-04-28    │   │
│  │  - Required PR + 1 reviewer (CODEOWNERS)                      │   │
│  │  - All status checks must pass                                │   │
│  │  - Linear history required                                    │   │
│  │  - Admin bypass ALLOWED（緊急修復彈性）                      │   │
│  │  - Bypass operations LOGGED to audit trail                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ merge to main
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│           GitHub Main Push Workflow（Future, CHANGE-055）             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ azure-deploy.yml                                            │    │
│  │ 1. Build Docker image (multi-stage)                         │    │
│  │ 2. Trivy scan (HIGH/CRITICAL fail)                          │    │
│  │ 3. Login to ACR (OIDC + Managed Identity)                   │    │
│  │ 4. Push to ACR (Trivy-passed image only)                    │    │
│  │ 5. Deploy to ACA staging                                    │    │
│  │ 6. Health check                                             │    │
│  │ 7. Manual approval → Deploy prod                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria Mapping

| AC | 實作位置 | 對應 v1.2 |
|----|---------|----------|
| AC1 Branch Protection | GitHub UI（手動配置 + 文檔化） | Gov-02 |
| AC2 gitleaks pre-commit | `.husky/pre-commit` + `.gitleaks.toml` | SDLC-01 |
| AC3 gitleaks Action | `.github/workflows/security-secrets.yml` | SDLC-01 |
| AC4 Dependabot | `.github/dependabot.yml` | SDLC-04 |
| AC5 npm audit | `.github/workflows/security-deps.yml` | SDLC-04 |
| AC6 Semgrep | `.github/workflows/security-sast.yml` | SDLC-02 |
| AC7 Trivy | `.github/workflows/security-container.yml` | SDLC-06 |
| AC8 type-check + lint | `.github/workflows/quality-checks.yml` | SDLC-08 |
| AC9 Required status checks | GitHub UI（手動）+ AC1-AC8 整合 | SDLC-08 |
| AC10 PR Template | `.github/PULL_REQUEST_TEMPLATE.md` | Gov-02 |
| AC11 CODEOWNERS | `.github/CODEOWNERS` | Gov-02 |
| AC12 Workflow 失敗告警 | Email 告警（複用 Obs-05-lite） | Obs-05-lite 連帶 |

---

## GitHub Actions YAML 範例

### `.github/workflows/quality-checks.yml`

```yaml
name: Quality Checks

on:
  pull_request:
    branches: [main]

concurrency:
  group: quality-${{ github.ref }}
  cancel-in-progress: true

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run type-check

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  i18n-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run i18n:check
```

### `.github/workflows/security-secrets.yml`

```yaml
name: Secret Scanning

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 必須完整 history 才能 scan
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}  # 若用 Pro 版（免費 OSS 不需要）
        # 第 1-2 週：advisory mode
        # continue-on-error: true
```

### `.github/workflows/security-deps.yml`

```yaml
name: Dependency Audit

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1'  # 每週一 08:00 UTC

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm audit --audit-level=high --production
        # continue-on-error: true  (week 1-2)

  pip-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install pip-audit
      - run: pip-audit -r python-services/extraction/requirements.txt
      - run: pip-audit -r python-services/mapping/requirements.txt
```

### `.github/workflows/security-sast.yml`

```yaml
name: SAST (Semgrep)

on:
  pull_request:
    branches: [main]

jobs:
  semgrep:
    runs-on: ubuntu-latest
    container:
      image: returntocorp/semgrep
    steps:
      - uses: actions/checkout@v4
      - run: |
          semgrep \
            --config=auto \
            --config=p/typescript \
            --config=p/owasp-top-ten \
            --config=p/javascript \
            --config=p/react \
            --severity=ERROR \
            --error \
            --sarif \
            --output=semgrep.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif
```

### `.github/workflows/security-container.yml`

```yaml
name: Container Security (Trivy)

on:
  pull_request:
    branches: [main]
    paths:
      - 'Dockerfile'
      - 'package.json'
      - 'package-lock.json'
      - 'python-services/**/requirements.txt'
  push:
    branches: [main]

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t local/aidocextract:pr-${{ github.event.pull_request.number }} .
      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'local/aidocextract:pr-${{ github.event.pull_request.number }}'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'
          ignore-unfixed: true
          vuln-type: 'os,library'
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
      - name: Comment PR with Trivy summary
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            // 解析 trivy-results.sarif 並 post comment
            // ...
```

### `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "08:00"
      timezone: "Asia/Hong_Kong"
    open-pull-requests-limit: 10
    labels: ["dependencies", "npm"]
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    groups:
      patch-updates:
        update-types: ["patch"]
      dev-dependencies:
        dependency-type: "development"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels: ["dependencies", "github-actions"]

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    labels: ["dependencies", "docker"]

  - package-ecosystem: "pip"
    directory: "/python-services/extraction"
    schedule:
      interval: "weekly"
    labels: ["dependencies", "python"]

  - package-ecosystem: "pip"
    directory: "/python-services/mapping"
    schedule:
      interval: "weekly"
    labels: ["dependencies", "python"]
```

---

## Branch Protection 詳細規則

### 透過 GitHub UI 設定（main 分支）

```
Branch name pattern: main

[X] Require a pull request before merging
    [X] Require approvals: 1
    [X] Dismiss stale pull request approvals when new commits are pushed
    [X] Require review from Code Owners
    [ ] Require approval of the most recent reviewable push
    [X] Require conversation resolution before merging

[X] Require status checks to pass before merging
    [X] Require branches to be up to date before merging
    Required checks:
      - Quality Checks / type-check
      - Quality Checks / lint
      - Quality Checks / i18n-sync
      - Secret Scanning / gitleaks
      - Dependency Audit / npm-audit
      - SAST / semgrep
      - Container Security / trivy-scan (僅 Dockerfile 變動)
      - Tests / unit-tests (Story 22-5 完成後加入)

[X] Require linear history
[ ] Do not allow bypassing the above settings  ← ✅ B6 用戶決策 2026-04-28：保留 admin bypass
[ ] Allow force pushes
[ ] Allow deletions
```

> ✅ **B6 用戶決策（2026-04-28）**：取消勾選「Do not allow bypassing the above settings」，保留 admin bypass 緊急修復彈性。所有 bypass 操作必須記錄到 audit log（GitHub 內建 + 內部 SecurityLog 同步）。配套設定：
>
> 1. 啟用 GitHub webhook 訂閱 `protected_branch.policy_override` 等事件 → 推送至 `webhook.service.ts` → 寫入 SecurityLog
> 2. 在 `docs/05-governance/risk-register.md` 建立 RISK 條目「Branch Protection admin bypass usage」追蹤季度 bypass 次數
> 3. Bypass 使用次數異常（> 3 次/季）→ 觸發告警（與 CHANGE-066 整合）

### 透過 GitHub CLI（自動化備案）

```bash
# ✅ B6 用戶決策 2026-04-28：enforce_admins=false（允許 admin bypass）
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["Quality Checks / type-check","Secret Scanning / gitleaks",...]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  -f restrictions=null \
  -f required_linear_history=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

> 📋 `enforce_admins=false` 配套設定：
> - GitHub Org-level audit log 自動記錄所有 admin bypass 操作（內建功能）
> - 透過 GitHub webhook 將 protected_branch override 事件同步到內部 SecurityLog
> - 季度 review bypass 使用頻率，記錄於 `docs/05-governance/risk-register.md`

---

## Required Status Checks 清單

| Check Name | Workflow File | Required? | 何時加入 required |
|------------|---------------|-----------|------------------|
| `Quality Checks / type-check` | `quality-checks.yml` | ✅ Required | Day 1 |
| `Quality Checks / lint` | `quality-checks.yml` | ✅ Required | Day 1 |
| `Quality Checks / i18n-sync` | `quality-checks.yml` | ✅ Required | Day 1 |
| `Secret Scanning / gitleaks` | `security-secrets.yml` | ⏱️ Advisory→Required | Week 3 |
| `Dependency Audit / npm-audit` | `security-deps.yml` | ⏱️ Advisory→Required | Week 3 |
| `Dependency Audit / pip-audit` | `security-deps.yml` | ⏱️ Advisory→Required | Week 3 |
| `SAST / semgrep` | `security-sast.yml` | ⏱️ Advisory→Required | Week 3 |
| `Container Security / trivy-scan` | `security-container.yml` | ⏱️ Advisory→Required | Week 3 |
| `Tests / unit-tests` | `tests.yml`（22-5）| ⏱️ Required | Story 22-5 完成後 |

---

## Secret 管理

### GitHub Repository Secrets（透過 GitHub UI 設定）

| Secret Name | 用途 | 來源 |
|-------------|------|------|
| `GITHUB_TOKEN` | 預設 token，無需手動設定 | GitHub 內建 |
| `GITLEAKS_LICENSE` | gitleaks Pro 版 license（OSS 版不需要） | 若購買 |
| `AZURE_CREDENTIALS` | Azure deployment（CHANGE-055） | Azure Service Principal JSON |
| `ACR_NAME` | ACR 名稱 | Azure |
| `ACR_LOGIN_SERVER` | ACR endpoint | Azure |
| `WORKFLOW_FAILURE_RECIPIENTS` | Email 告警收件人 | Application config |

### 使用 OIDC 取代長期憑證（推薦）

未來 ACR push 流程應使用 GitHub OIDC + Managed Identity 而非 service principal long-lived secret：

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

設定 federated credentials 對應 GitHub repo 的 main 分支。

---

## 失敗時的處理流程

### Workflow 失敗 → PR 阻擋

```
1. PR 建立
2. workflow 自動觸發
3. workflow 失敗 → status check 顯示 ❌
4. PR 顯示「Some checks were not successful」
5. Branch Protection 阻擋 merge button
6. 開發者修正問題 → 推新 commit → workflow 重跑
```

### 緊急修復豁免流程

當 HIGH/CRITICAL CVE 阻擋緊急修復時：

```
1. 開發者在 PR comment 標記 /security-bypass-request
2. Security Officer review 並 approve（comment /security-bypass-approved）
3. 在 docs/08-security-and-governance/risk-register.md 新增記錄：
   - 風險描述
   - 豁免時程（≤ 7 天）
   - 補救計劃
4. CI workflow 偵測到「security-bypass-approved」label 後跳過 fail
5. 7 天後若 risk register 未更新狀態為「resolved」→ 自動建立 follow-up issue
```

### 連續失敗告警

```yaml
# 在 security-secrets.yml 等 workflow 失敗時
- name: Notify on failure
  if: failure()
  run: |
    curl -X POST ${{ secrets.WORKFLOW_FAILURE_WEBHOOK }} \
      -H "Content-Type: application/json" \
      -d '{
        "workflow": "${{ github.workflow }}",
        "run_id": "${{ github.run_id }}",
        "actor": "${{ github.actor }}",
        "ref": "${{ github.ref }}"
      }'
```

`webhook.service.ts` 收到 → 寫 SecurityLog + 評估是否觸發 spike 告警。

---

## 漸進式 Rollout 計劃

### Week 0：立即啟用（治理基礎）

| 動作 | 影響 |
|------|------|
| Branch Protection 啟用（**允許 admin bypass + audit log**，✅ B6 2026-04-28） | 所有未來 commit 必須走 PR；admin 保留緊急修復彈性，但所有 bypass 記入 audit log |
| GitHub webhook → SecurityLog 同步 | Bypass 操作即時可追溯 |
| CODEOWNERS 建立 | 對應 owner 必須 review |
| PR Template 啟用 | PR 表單顯示 checklist |

### Week 1：所有 workflow 部署為 advisory

```yaml
# 所有 security workflow 加入：
continue-on-error: true
```

| 目的 | 收集資料 |
|------|---------|
| 觀察 false positive 數量 | gitleaks / semgrep 對既有 codebase 的警告 |
| 觀察平均 CI 時間 | 確認 < 5 分鐘預算 |
| 觀察開發者體感 | gitleaks pre-commit 是否拖慢本機 commit |

### Week 2：調整白名單

```
.gitleaks.toml      ← 加 false positive allowlist
.semgrepignore      ← 加 false positive
.trivyignore        ← 加無修復的 CVE（暫時忽略）
.dependabot.yml     ← 調整 group 配置減少 PR 噪音
```

### Week 3：升級 required status checks

```bash
# 透過 GitHub CLI 一次更新
gh api -X PUT repos/{owner}/{repo}/branches/main/protection ...
```

所有 security workflow 改為 required（block merge）。

### Week 4：歷史 secret backlog 清理

```bash
gitleaks detect --log-opts="--all" --report-format=json --report-path=gitleaks-history.json
```

若發現歷史 commit 含 secret：
1. 評估是否仍 valid（已輪替的 secret 可忽略）
2. 仍 valid → 立即輪替（Azure / OpenAI / Microsoft Graph）
3. 評估是否需 BFG repo-cleaner（force push 警告 + 全團隊配合）

---

## Risks & Mitigations

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| HIGH/CRITICAL CVE 阻擋緊急修復 | 🔴 HIGH | 🔴 HIGH | 緊急修復豁免流程 + risk register 追蹤 |
| Trivy 對 base image 大量 false positive | 🟡 MED | 🟡 MED | `.trivyignore` + `ignore-unfixed: true` |
| Semgrep 對舊 codebase 大量警告 | 🟡 MED | 🟡 MED | Week 1-2 advisory + `.semgrepignore` |
| gitleaks pre-commit 影響本機體驗 | 🟢 LOW | 🟢 LOW | 使用 `gitleaks protect --staged`（只掃 staged，不掃 history） |
| Branch protection 阻擋 hot-fix | 🟢 LOW（B6 已緩解）| 🔴 HIGH | ✅ B6 用戶決策 2026-04-28：保留 admin bypass + audit log；緊急時 admin 可直接 push（極少數情況），所有 bypass 記入 audit log 並季度 review |
| Dependabot PR 過多 | 🟡 MED | 🟢 LOW | `groups` 配置 group 多個 patch；weekly 而非 daily |
| 既有 460 commits 含 secret | 🟢 LOW | 🔴 HIGH | Week 4 全 history scan + 必要時 BFG |
| PR review 拖慢開發節奏 | 🟡 MED | 🟡 MED | CODEOWNERS 自動分派 + slack 提醒 |

---

## Testing & Validation

### Branch Protection 驗證（✅ B6 用戶決策 2026-04-28）

```bash
# 1. 一般用戶：驗證直接 push 被阻擋
git checkout main
echo "test" >> README.md
git commit -am "test direct push"
git push origin main
# 預期：remote rejected（一般用戶必須走 PR）

# 2. Admin 用戶：驗證 bypass 仍可行（B6 預期行為）
# Admin 直接 push（緊急修復場景）→ 預期 push 成功
# 預期：GitHub audit log 出現 protected_branch override event
# 預期：內部 SecurityLog 接收到對應事件並記錄
```

### gitleaks 驗證

```bash
# 在測試 branch 上 commit 一個假 secret
echo "AKIAIOSFODNN7EXAMPLE" >> test-secret.txt
git add test-secret.txt
git commit -m "test"
# 預期：husky pre-commit 阻擋
```

### Workflow 驗證 checklist

- [ ] PR 建立後 5 個 workflow 都觸發
- [ ] type-check fail 時 PR 阻擋
- [ ] lint fail 時 PR 阻擋
- [ ] gitleaks 偵測到 secret 時 PR 阻擋
- [ ] npm audit HIGH 時 PR 阻擋
- [ ] Semgrep ERROR 時 PR 阻擋
- [ ] Trivy HIGH/CRITICAL 時 PR 阻擋（修改 Dockerfile 觸發）
- [ ] CODEOWNERS 對應 owner 必須 review
- [ ] 連續 3 次 workflow 失敗觸發告警

---

## File Structure

```
.github/
├── workflows/
│   ├── quality-checks.yml             # 新增
│   ├── security-secrets.yml           # 新增
│   ├── security-deps.yml              # 新增
│   ├── security-sast.yml              # 新增
│   └── security-container.yml         # 新增
├── dependabot.yml                     # 新增
├── CODEOWNERS                         # 新增
└── PULL_REQUEST_TEMPLATE.md           # 新增

.husky/
└── pre-commit                         # 新增（gitleaks）

.gitleaks.toml                         # 新增（allowlist）
.semgrepignore                         # 新增
.trivyignore                           # 新增

package.json                           # 修改：husky + lint-staged

docs/08-security-and-governance/
├── branch-protection-config.md        # 新增（截圖記錄）
├── cicd-pipeline-guide.md             # 新增
└── risk-register.md                   # 新增（豁免流程）

docs/06-deployment/01-local-deployment/
└── onboarding-checklist.md            # 修改：加 gitleaks 安裝
```

---

## v1.2 矩陣對齊（一次性解決 5 + 1 項）

| 項目 | Phase 2 評分 | 完成 22-4 後 | 風險等級 |
|------|-------------|-------------|---------|
| **SDLC-01** Secret Scanning | L0 | L2 | 🔴 HIGH |
| **SDLC-02** SAST（連帶提升）| L0 | L2 | 🟡 MED |
| **SDLC-04** SCA / Dependabot | L0 | L2 | 🔴 HIGH |
| **SDLC-06** 容器掃描 | L0 | L2 | 🔴 HIGH |
| **SDLC-08** CI/CD 守門 | L0 | L2 | 🔴 HIGH |
| **Gov-02** Code Review 強制 | L0 | L2 | 🔴 HIGH |

**整體影響**：HIGH 未達 L2 從 22 → 17（降 5 項）。

---

## Definition of Done

- [ ] AC1-AC12 全部通過驗證
- [ ] 5 個 workflow YAML 在 PR 上實際觸發並通過
- [ ] gitleaks pre-commit 在本機驗證有效
- [ ] Dependabot 已產生第一批 weekly PR
- [ ] Branch Protection 規則截圖記錄於 `branch-protection-config.md`
- [ ] CODEOWNERS 所有 path 都有對應 team
- [ ] PR template 在新 PR 上正確顯示
- [ ] Workflow 失敗告警手動觸發測試成功
- [ ] `cicd-pipeline-guide.md` 完成
- [ ] 開發團隊 walkthrough 完成（30 分鐘）
- [ ] Week 4 歷史 secret scan 完成（無遺漏）
