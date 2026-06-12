# Story 22.4: CI/CD 安全 Pipeline

**Status:** 🚧 進行中（codebase CI 配置已建立、advisory 模式，2026-06-12；Branch Protection / Repository Secrets / Week 3 required 升級待 GitHub 平台操作 — 見 `docs/08-security-and-governance/cicd-pipeline-guide.md`）

---

## ✅ 用戶決策確認（2026-04-28）

| ID | 決策 |
|----|------|
| **B6** | Branch Protection **允許 admin bypass**（保留緊急修復彈性）+ 所有 bypass 操作必須記錄到 audit log |

**理由**：
- 保留緊急修復（hot-fix）彈性，避免 CI/CD pipeline 失效時無法緊急部署
- 所有 admin bypass 操作必須寫入 audit log（GitHub audit log + 內部 SecurityLog），以維持治理可追溯性
- 仍維持「require PR + 1 reviewer + status checks」的常規門檻，bypass 為例外手段

---

## Story

**As a** 開發團隊與安全治理負責人,
**I want** 在 GitHub 建立完整 CI/CD 安全 pipeline（branch protection + gitleaks + Dependabot + npm audit + Semgrep + Trivy + 強制 type-check / lint / test）,
**So that** 從 commit 到 ACR push 全程有自動化守門，secret 洩漏 / 已知 CVE / 容器漏洞 / 直接 push 到 main 都會被攔截。

---

## 背景說明

### 問題陳述

依 `phase2-sdlc-assessment.md` 盤點：

- `.github/workflows/` **完全不存在**——僅有 `.github/agents/` 子目錄。
- 460 個 commits 中 **99.6% 直接 push 到 main**（無 branch protection 強制 PR）。
- `package.json` devDependencies **無** husky / lint-staged，scripts **無** `audit` / `test`。
- 無 `.github/dependabot.yml`、無 `.gitleaks.toml`、無 Trivy / Semgrep 配置、無 CODEOWNERS、無 PR template。
- ACR Bicep 中 `quarantinePolicy: disabled` + `trustPolicy: disabled`——任何 image push 後可立即被部署，無 quarantine。
- 一次性可解決 **5 個 v1.2 矩陣項目** + Branch Protection（v1.2 矩陣外的治理基礎）：
  - **SDLC-01** Secret Scanning（L0 → L2）
  - **SDLC-04** SCA / Dependabot（L0 → L2）
  - **SDLC-06** 容器掃描（L0 → L2）
  - **SDLC-08** CI/CD 守門（L0 → L2）
  - **Gov-02** Code Review 強制（L0 → L2）
  - 連帶提升 **SDLC-02** SAST（L0 → L2，透過 Semgrep CE）

### 設計決策（v1.2 矩陣對齊）

- **只用免費工具**（v1.2 §7.1 強制）：gitleaks、Dependabot、npm audit、Trivy、Semgrep CE
- **禁用付費 SaaS**：Snyk、SonarQube Cloud、CodeQL Advanced（私有 repo 收費）
- **漸進式 rollout**：所有 status check 先以 advisory 模式（`continue-on-error: true`）跑 2 週，再升級為 required（`block merge`）
- **Branch Protection 即時啟用**：require PR + 1 reviewer 是治理基礎，零工具依賴，不需 advisory 階段
- **GitHub Free tier 限制**：private repo 無法用 `required_status_checks` API + 部分進階 branch protection 功能；本專案目前是 Team plan 等級——若降級需另行檢討

### 影響範圍

- **不影響應用程式**：純治理流程 + CI 配置
- **影響開發節奏**：所有未來改動必須走 PR，個別開發者效率下降，但治理水位提升
- **可能阻擋 build**：HIGH/CRITICAL CVE 直接 fail；過渡期需有「申請豁免」流程

---

## Acceptance Criteria

### AC1: GitHub Branch Protection 啟用（✅ B6 用戶決策 2026-04-28）

**Given** GitHub repo `ai-document-extraction-project` 的 `main` 分支
**When** 任何人嘗試 `git push origin main`
**Then** 直接 push 被拒絕（必須走 PR）
**And** PR 必須符合：
  - Require pull request before merging（強制 PR）
  - Require approvals: **1**（至少 1 人 review）
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from Code Owners（依 AC11 的 CODEOWNERS）
  - Require status checks to pass before merging（依 AC9 列表）
  - Require branches to be up to date before merging
  - Require linear history（避免 merge commit 混亂）
  - **Allow administrators to bypass these settings ✅（B6 用戶決策 2026-04-28）**：保留緊急修復彈性
  - **所有 admin bypass 操作必須寫入 audit log**：GitHub 內建 audit log（org-level）+ 內部 SecurityLog（透過 webhook 同步），以維持可追溯性

### AC2: gitleaks Pre-commit Hook（husky + gitleaks）

**Given** 開發者本機執行 `git commit`
**When** husky pre-commit hook 觸發
**Then** 自動執行 `gitleaks protect --staged --redact`
**And** 偵測到 secret pattern（API key、password、JWT、PEM key）時阻擋 commit 並顯示 redacted 提示
**And** `.gitleaks.toml` 包含本專案專屬 allow rule（如 `.env.example` 中的 demo connection string）

### AC3: gitleaks GitHub Action（PR 觸發掃描）

**Given** 任何 PR 開啟或更新
**When** GitHub Action `security-secrets.yml` 觸發
**Then** 執行 `gitleaks/gitleaks-action@v2` 對整個 PR diff 掃描
**And** 偵測到 secret 時 PR check 顯示 ❌ 並 block merge
**And** Action 報告連結到 GitHub Security tab（若有 SARIF 上傳）

### AC4: Dependabot 配置（npm + GitHub Actions ecosystem）

**Given** `.github/dependabot.yml` 已配置
**When** Dependabot 每日掃描
**Then** 對下列 ecosystem 自動產生 PR：
  - `npm` (package.json) — weekly schedule，僅 security 與 patch 自動 PR
  - `github-actions` (.github/workflows/) — weekly
  - `docker` (Dockerfile) — weekly（base image 更新）
  - `pip` (python-services/extraction/requirements.txt + python-services/mapping/requirements.txt) — weekly
**And** PR 標題格式統一（`chore(deps): bump X from a to b`）
**And** PR 自動加 `dependencies` label

### AC5: npm audit GitHub Action（HIGH/CRITICAL fail）

**Given** PR 觸發或 main push
**When** GitHub Action `security-deps.yml` 執行
**Then** 跑 `npm audit --audit-level=high --production`
**And** 發現 HIGH 或 CRITICAL 漏洞時 fail（block merge）
**And** 漸進式：第一週 advisory（`continue-on-error: true`），第二週起強制 block

### AC6: Semgrep CE GitHub Action（PR 觸發 SAST）

**Given** PR 觸發
**When** GitHub Action `security-sast.yml` 執行
**Then** 執行 `semgrep --config=auto --config=p/typescript --config=p/owasp-top-ten`
**And** 發現 ERROR 級別 finding 時 fail
**And** 結果上傳為 SARIF 到 GitHub Security tab

### AC7: Trivy GitHub Action（Docker image 掃描）

**Given** PR 變動 `Dockerfile` 或 main push 觸發 image build
**When** GitHub Action `security-container.yml` 執行
**Then** 執行 `aquasecurity/trivy-action`：
  - `vuln-type: 'os,library'`
  - `severity: 'HIGH,CRITICAL'`
  - `exit-code: 1`（HIGH/CRITICAL fail build）
  - `ignore-unfixed: true`（暫時忽略無修復的漏洞）
**And** 整合到 ACR push pipeline——push 前必須通過 Trivy
**And** 結果上傳為 SARIF + 在 PR comment 顯示 summary

### AC8: TypeScript + ESLint check 在 CI 中強制

**Given** PR 觸發
**When** GitHub Action `quality-checks.yml` 執行
**Then** 執行 `npm run type-check`、`npm run lint`、`npm run i18n:check`
**And** 任一 step 失敗則 block merge
**And** 執行時間 < 5 分鐘（依現況預估）

### AC9: Branch Protection 要求所有 status checks 通過

**Given** PR 即將 merge
**When** 檢查 required status checks
**Then** 下列 check 必須全部 ✅：
  - `Quality Checks / type-check`
  - `Quality Checks / lint`
  - `Quality Checks / i18n-sync`
  - `Security / gitleaks`
  - `Security / npm-audit`
  - `Security / semgrep`
  - `Security / trivy`（僅 Dockerfile 變動時）
  - `Tests / unit-tests`（依 Story 22-5 完成後加入）
**And** 任何一個失敗即無法 merge

### AC10: PR Template（含 security checklist）

**Given** 開發者開新 PR
**When** GitHub 顯示 PR 表單
**Then** 自動帶入 `.github/PULL_REQUEST_TEMPLATE.md` 內容，含：
  - Summary 區塊
  - Type of change（feature / fix / docs / refactor）
  - Security Checklist：
    - [ ] 無新增 secret hardcoding
    - [ ] 新增 API 已加 Zod 驗證
    - [ ] 新增 API 已加 auth middleware（除非明列為 public）
    - [ ] 無 `$executeRawUnsafe` / `$queryRawUnsafe`
    - [ ] 新增使用者輸入處 `dangerouslySetInnerHTML` 已 sanitize
    - [ ] 新增外部 fetch 已加 SSRF guard（若適用）
    - [ ] 已執行 `npm run i18n:check`
  - Testing notes
  - Screenshots（UI 變動時）

### AC11: CODEOWNERS 文件

**Given** PR 修改特定路徑
**When** GitHub 評估 review requirement
**Then** `.github/CODEOWNERS` 規則生效：
  - `prisma/schema.prisma` → @data-team
  - `src/services/extraction-v3/` → @ai-team
  - `infrastructure/bicep/` → @infra-team
  - `.github/` + `Dockerfile` + `next.config.ts` → @security-team
  - `messages/` → @i18n-team
  - 預設 fallback → @maintainers
**And** 對應 owner 必須核准才能 merge

### AC12: Workflow 失敗時的告警機制

**Given** 任何 GitHub Action workflow run 失敗
**When** 失敗事件觸發
**Then** 透過下列其中一種機制通知 admin：
  - GitHub Notifications（預設，team-level subscription）
  - Email 通知（透過既有 Nodemailer + 新增 `workflow-failure` alert rule）—— 複用 Obs-05-lite 機制
**And** 連續 3 次同一 workflow 失敗時升級為 HIGH severity 告警
**And** workflow 失敗事件寫入 `SecurityLog`（eventType=`SUSPICIOUS_ACTIVITY` 若是 security workflow）

---

## Tasks / Subtasks

- [ ] **Task 1: GitHub Branch Protection 設定** (AC: #1) ✅ B6 用戶決策（2026-04-28）
  - [ ] 1.1 透過 GitHub UI 設定 main 分支保護規則（依 AC1 條目）
  - [ ] 1.2 截圖記錄保護規則於 `docs/05-governance/branch-protection-config.md`（路徑與 CHANGE-067 治理目錄一致）
  - [ ] 1.3 **保留 admin bypass 設定**（B6 用戶決策）：取消勾選「Do not allow bypassing the above settings」
  - [ ] 1.4 設定 GitHub webhook 將 audit log 事件同步到內部 SecurityLog（複用 webhook.service.ts）
  - [ ] 1.5 在 `docs/05-governance/risk-register.md` 建立 RISK 條目追蹤 admin bypass 使用頻率（季度 review）

- [ ] **Task 2: husky + gitleaks Pre-commit** (AC: #2)
  - [ ] 2.1 `npm install -D husky lint-staged @husky/init`
  - [ ] 2.2 `npx husky init` 建立 `.husky/pre-commit`
  - [ ] 2.3 安裝 gitleaks binary（`brew install gitleaks` 或 `scoop install gitleaks`）—— 文檔化在 onboarding-checklist
  - [ ] 2.4 建立 `.gitleaks.toml`（含 `.env.example` allow rule）
  - [ ] 2.5 pre-commit hook 執行 `gitleaks protect --staged --redact`
  - [ ] 2.6 README / onboarding doc 加入 gitleaks 安裝指引

- [ ] **Task 3: 建立 .github/workflows/ 目錄與 GitHub Actions** (AC: #3, #5, #6, #7, #8)
  - [ ] 3.1 `.github/workflows/quality-checks.yml`（type-check + lint + i18n）
  - [ ] 3.2 `.github/workflows/security-secrets.yml`（gitleaks-action）
  - [ ] 3.3 `.github/workflows/security-deps.yml`（npm audit + pip audit）
  - [ ] 3.4 `.github/workflows/security-sast.yml`（Semgrep CE）
  - [ ] 3.5 `.github/workflows/security-container.yml`（Trivy，path filter Dockerfile）
  - [ ] 3.6 所有 workflow 第一週使用 `continue-on-error: true`（advisory）
  - [ ] 3.7 兩週後改為 required + 加入 branch protection 的 required status checks 列表

- [ ] **Task 4: Dependabot 配置** (AC: #4)
  - [ ] 4.1 建立 `.github/dependabot.yml`
  - [ ] 4.2 配置 4 個 ecosystem（npm + github-actions + docker + pip）
  - [ ] 4.3 第一次跑時手動處理 backlog（既有 77 deps + 20 devDeps 的安全缺口）

- [ ] **Task 5: PR Template + CODEOWNERS** (AC: #10, #11)
  - [ ] 5.1 建立 `.github/PULL_REQUEST_TEMPLATE.md`
  - [ ] 5.2 建立 `.github/CODEOWNERS`（依 AC11 路徑）
  - [ ] 5.3 確認所有 owner team 在 GitHub org 已建立

- [ ] **Task 6: ACR Push 整合 Trivy** (AC: #7)
  - [ ] 6.1 修改 Azure deployment workflow（依 CHANGE-055 W5-W6 規劃）—— Trivy 必須 push 前
  - [ ] 6.2 ACR Bicep 評估啟用 `quarantinePolicy: enabled`（v0.4 v1.2 升級）
  - [ ] 6.3 文檔化「Trivy fail 時的部署中斷處理流程」

- [ ] **Task 7: Workflow 失敗告警整合** (AC: #12)
  - [ ] 7.1 建立 alert rule `workflow-failure-spike`
  - [ ] 7.2 GitHub webhook → 內部 alerting endpoint（複用 webhook.service.ts）
  - [ ] 7.3 配置 `WORKFLOW_FAILURE_RECIPIENTS` env var

- [ ] **Task 8: 漸進式 rollout 計劃** (AC: 全部)
  - [ ] 8.1 第 0 週：Branch Protection 立即啟用
  - [ ] 8.2 第 1 週：所有 workflow 部署為 advisory（continue-on-error: true）
  - [ ] 8.3 第 2 週：監控 false positive，調整 .gitleaks.toml / .semgrepignore
  - [ ] 8.4 第 3 週：升級 required status checks（block merge）
  - [ ] 8.5 第 4 週：盤點漏掉的舊 commit secrets（用 gitleaks 全 history scan）

- [ ] **Task 9: 文檔與培訓** (AC: 全部)
  - [ ] 9.1 更新 `docs/06-deployment/01-local-deployment/onboarding-checklist.md`（加 gitleaks 安裝）
  - [ ] 9.2 建立 `docs/08-security-and-governance/cicd-pipeline-guide.md`
  - [ ] 9.3 開發團隊 30 分鐘 walkthrough（PR 流程演示）

- [ ] **Task 10: 既有 secret backlog 清理** (AC: #2, #3)
  - [ ] 10.1 對 main 分支 460 commits 跑 `gitleaks detect --log-opts="--all"`
  - [ ] 10.2 識別誤 commit 的 secret（若有）
  - [ ] 10.3 必要時用 BFG repo-cleaner 清理（需 force push 警告 + 全團隊配合）

---

## Dev Notes

### 依賴項

- ✅ GitHub repo 已存在
- ✅ 既有 Nodemailer（Obs-05-lite）—— 用於 workflow 失敗告警
- ⚠️ Story 22-5 Vitest 框架需先完成，AC9 的 `unit-tests` check 才能加入 required list

### 影響的文件

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
└── pre-commit                         # 新增

.gitleaks.toml                         # 新增
.semgrepignore                         # 新增（false positive whitelist）

package.json                           # 修改：加 husky + lint-staged devDeps
docs/08-security-and-governance/
├── branch-protection-config.md        # 新增
└── cicd-pipeline-guide.md             # 新增

docs/06-deployment/01-local-deployment/
└── onboarding-checklist.md            # 修改：加 gitleaks 安裝
```

### v1.2 矩陣對齊

本 story 一次性解決：

| ID | 項目 | 改善 |
|----|------|------|
| SDLC-01 | Secret Scanning | L0 → L2 |
| SDLC-02 | SAST（連帶提升）| L0 → L2 |
| SDLC-04 | SCA / Dependabot | L0 → L2 |
| SDLC-06 | 容器掃描 | L0 → L2 |
| SDLC-08 | CI/CD 守門 | L0 → L2 |
| Gov-02 | Code Review 強制 | L0 → L2 |

### 不採用的工具（v1.2 矩陣明列禁用）

- ❌ Snyk（付費）
- ❌ SonarQube Cloud（付費）
- ❌ Snyk Container（付費）
- ❌ ACR Defender for Containers（會產生 Azure 費用，由 Infra Admin 決定是否啟用）
- ❌ CodeQL Advanced（私有 repo 收費）

### 風險與緩解

| 風險 | 緩解 |
|------|------|
| HIGH/CRITICAL CVE 阻擋緊急修復 | 提供「申請豁免」流程：admin 透過 GitHub PR comment `/bypass-security` + 在 risk-register.md 記錄 |
| Trivy 對既有 base image 大量 false positive | `.trivyignore` whitelist + `ignore-unfixed: true` |
| Semgrep 對舊 codebase 大量警告 | 第 1-2 週 advisory + `.semgrepignore` 補白名單 |
| Branch protection 阻擋 hot-fix | 設置「emergency procedure」：admin commit 仍走 PR，但允許自我 review（標 emergency label） |
| Dependabot PR 過多 | 一次 group 多個 patch（`groups` 配置） |

### 與其他 Story 的關係

- **Story 22-5（Vitest 框架）**：本 story AC9 需要 unit-tests check 才能完整—— Story 22-5 完成後再加入 required status checks
- **Story 22-3（Prompt Injection）**：本 story 完成後，22-3 的測試可以納入 CI
- **CHANGE-055（Azure 部署）**：本 story 的 Trivy 必須整合到 ACR push pipeline（CHANGE-055 Phase 3 W5-W6）

### 漸進式 rollout 時程

```
Week 0 (立即)：Branch Protection 啟用
Week 1：所有 workflow advisory 模式（continue-on-error: true）
Week 2：監控 false positive、調整白名單
Week 3：升級 required status checks（強制 block）
Week 4：盤點 main 分支歷史 secret + 必要時 BFG 清理
```

---

## 實作記錄（2026-06-12）

### 已完成（codebase 配置，advisory 模式）

| Task | AC | 產出 |
|------|-----|------|
| Task 3 | AC3/5/6/7/8 | 5 個 workflow：`quality-checks`／`security-secrets`／`security-deps`／`security-sast`／`security-container` |
| Task 4 | AC4 | `.github/dependabot.yml`（npm／github-actions／docker／pip x2）|
| Task 5 | AC10/AC11 | `.github/PULL_REQUEST_TEMPLATE.md` + `.github/CODEOWNERS`（單一 owner）|
| — | AC3/6/7 | `.gitleaks.toml`／`.semgrepignore`／`.trivyignore` 白名單 |
| Task 9.2 | — | `docs/08-security-and-governance/cicd-pipeline-guide.md` 操作指南 |

- 所有 security workflow 採 advisory（`continue-on-error: true`），符合規劃 Week 1，不立即 block merge。
- YAML 語法已驗證可解析（6 檔全通過）。

### 決策偏離（用戶確認 2026-06-12）

| AC | 原規劃 | 實際 | 理由 |
|----|--------|------|------|
| AC2 | husky + lint-staged 本機 pre-commit | 不採用，secret 守門落 CI 端 gitleaks（AC3）| 避免新增 npm devDependency（H2）+ 不影響本機 commit |
| AC11 | 多 org team（@data-team 等）| 單一 owner `@laitim2001`，規劃 team 以註解保留 | org team 未建立，避免指向不存在 owner 使規則失效 |
| AC12 | webhook → SecurityLog | 先靠 GitHub 內建通知，webhook 後續 | webhook 依賴後端 endpoint，避免半成品 |

### 待續（平台操作／跨 Story／多週）

- **Task 1**：Branch Protection（GitHub 操作）— 命令見 cicd-pipeline-guide.md §4.1
- **Task 6**：ACR push 整合 Trivy — 依賴 CHANGE-055
- **Task 7 / AC12**：workflow 失敗 webhook → SecurityLog
- **Task 8**：Week 3 升 required、Week 4 歷史 secret scan
- **AC9**：`unit-tests` check — 依賴 Story 22-5（Vitest）
- **Task 10**：main 歷史 secret 全量掃描
