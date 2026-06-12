# CI/CD 安全 Pipeline 操作指南

> **來源**: Story 22-4（CI/CD 安全 Pipeline）
> **建立日期**: 2026-06-12
> **對應風險**: SDLC-01/02/04/06/08 + Gov-02（v1.2 矩陣全評為 L0）
> **狀態**: codebase 配置已建立（advisory 模式）；Branch Protection 與 Secrets 待 GitHub 操作

---

## 1. 概述

本指南說明 Story 22-4 在本 repo 建立的 CI/CD 安全守門配置，以及上線所需的 GitHub 平台操作。

設計原則（依 v1.2 矩陣 §7.1）：**只用免費工具**（gitleaks / Dependabot / npm audit / Semgrep CE / Trivy），禁用 Snyk / SonarQube Cloud / CodeQL Advanced 等付費 SaaS。

---

## 2. 本次已建立的檔案（codebase 內）

| 檔案 | 對應 AC | 用途 |
|------|---------|------|
| `.github/workflows/quality-checks.yml` | AC8 | type-check + lint + i18n:check（Day 1 required）|
| `.github/workflows/security-secrets.yml` | AC3 | gitleaks secret 掃描（advisory）|
| `.github/workflows/security-deps.yml` | AC5 | npm audit + pip-audit（advisory）|
| `.github/workflows/security-sast.yml` | AC6 | Semgrep CE 靜態分析（advisory）|
| `.github/workflows/security-container.yml` | AC7 | Trivy 容器掃描（advisory）|
| `.github/dependabot.yml` | AC4 | npm/github-actions/docker/pip x2 每週更新 PR |
| `.github/CODEOWNERS` | AC11 | code owner review（單一 owner，見 §5）|
| `.github/PULL_REQUEST_TEMPLATE.md` | AC10 | PR 表單含 security checklist |
| `.gitleaks.toml` | AC3 | gitleaks 白名單（範例 / Azurite 金鑰）|
| `.semgrepignore` | AC6 | Semgrep 路徑白名單 |
| `.trivyignore` | AC7 | Trivy CVE 暫時接受清單（目前空）|

> 所有 security workflow 目前為 **advisory 模式**（`continue-on-error: true`）：會跑、結果可見，但**不 block merge**。依規劃 Week 3 才升 required。

---

## 3. 漸進式 rollout 時程

| 階段 | 動作 | 狀態 |
|------|------|------|
| **Week 0** | Branch Protection 啟用（require PR + 1 reviewer + quality-checks required）| ⏳ 待 GitHub 操作（§4.1）|
| **Week 1** | 所有 security workflow advisory 模式運行，蒐集 false positive | ✅ 配置已就緒 |
| **Week 2** | 調整 `.gitleaks.toml` / `.semgrepignore` / `.trivyignore` 白名單 | 依觀察 |
| **Week 3** | security workflow 升 required（移除 `continue-on-error`，加入 required status checks）| ⏳ 待 §4.3 |
| **Week 4** | 對 main 歷史 commit 跑全量 gitleaks，盤點誤入 secret | ⏳ 待辦 |

---

## 4. ⚠️ 待你在 GitHub 操作的項目

以下需要 repo admin 權限，無法由 codebase 變更達成。

### 4.1 Branch Protection（AC1，含 B6 決策）

B6 用戶決策（2026-04-28）：**允許 admin bypass**（保留緊急修復彈性）+ 所有 bypass 記入 audit log。對應 `enforce_admins=false`。

GitHub CLI 設定（Week 0，僅 quality-checks 列 required）：

```bash
gh api -X PUT repos/laitim2001/ai-document-extraction-project/branches/main/protection \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Quality Checks / type-check' \
  -f 'required_status_checks[contexts][]=Quality Checks / lint' \
  -f 'required_status_checks[contexts][]=Quality Checks / i18n-sync' \
  -F 'enforce_admins=false' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -F 'required_pull_request_reviews[require_code_owner_reviews]=true' \
  -f 'restrictions=' \
  -F 'required_linear_history=true' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

> ⚠️ 單人 repo 注意：開啟 `require_code_owner_reviews` + `required_approving_review_count=1` 後，PR author 無法 approve 自己的 PR。單人開發時 admin bypass（`enforce_admins=false`）正好提供合併路徑；每次 bypass 都會進 GitHub audit log。

### 4.2 Repository Secrets（依需要）

| Secret | 是否必需 | 用途 |
|--------|----------|------|
| `GITHUB_TOKEN` | 內建（免設）| gitleaks-action |
| `GITLEAKS_LICENSE` | 否 | 僅 gitleaks Pro；OSS 版免費不需要 |
| `AZURE_CREDENTIALS` / `ACR_*` | 後續 | CHANGE-055 Azure deploy + ACR push 時才需 |

> 本次 5 個 workflow 在無任何額外 secret 下即可運行（gitleaks 用內建 `GITHUB_TOKEN`）。

### 4.3 Week 3 升 required

1. 編輯各 security workflow，移除 `continue-on-error: true`（Semgrep 另加 `--error`）。
2. 把以下 check 加入 required status checks：
   `Secret Scanning / gitleaks`、`Dependency Audit / npm-audit`、`Dependency Audit / pip-audit`、`SAST / semgrep`、`Container Security / trivy-scan`。

---

## 5. 本次與 Story 規劃的差異（決策記錄）

| 項目 | Story 原規劃 | 本次決策（2026-06-12）| 理由 |
|------|-------------|----------------------|------|
| AC2 本機 pre-commit | husky + lint-staged + gitleaks | **不採用**，secret 守門落在 CI 端（AC3 gitleaks-action）| 避免新增 npm devDependency（H2）與影響每次本機 commit；CI 端仍能 block merge |
| AC11 CODEOWNERS | 多 org team（@data-team 等）| **單一 owner `@laitim2001`**，規劃 team 以註解保留 | org team 尚未建立，指向不存在 owner 會讓規則失效 |
| AC12 失敗告警 | webhook → SecurityLog + email | **本次先靠 GitHub 內建通知**，webhook 整合後續 | webhook→SecurityLog 依賴後端 endpoint，避免半成品 |

---

## 6. 後續待辦（跨 Story / 需平台操作）

- **AC9 `unit-tests` check** — 依賴 Story 22-5（Vitest）完成後加入 required。
- **Task 6 ACR push 整合 Trivy** — 依賴 CHANGE-055 Azure deploy workflow。
- **AC12 webhook → SecurityLog** — 需後端 alerting endpoint（複用 `webhook.service.ts`）。
- **Task 10 歷史 secret 清理** — Week 4 對 main 全 history 跑 gitleaks，必要時 BFG。
- **org team 細分 CODEOWNERS** — org team 建立後，依 §5 註解恢復多 team 規則。

---

*本文件對應 Story 22-4 實作；Branch Protection 截圖另記於 `branch-protection-config.md`（待 §4.1 設定後補）。*
