# Phase 2 現狀盤點 — Resi + Gov 領域

> **盤點日期**: 2026-04-28
> **評分模型**: L0 Absent → L1 Initial → L2 Managed → L3 Defined → L4 Optimized
> **盤點範圍**: Resi（韌性災備，零成本版）+ Gov（治理合規）兩領域
> **參考矩陣**: `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2
> **盤點方法**: 文件審查 + 代碼搜尋 + git log 分析（不修改任何代碼）

---

## 領域成熟度匯總

| 領域 | 必查項數 | 平均成熟度 | HIGH 風險未達 L2 | 企業就緒？ |
|------|----------|-----------|-----------------|-----------|
| **Resi 韌性災備** | 10 項（7 必須 + 3 延後） | **L1.4 / 4** | **3 項**（Resi-04 Circuit Breaker、Resi-08 RTO/RPO、Resi-09 IR Plan） | 🔴 **NOT READY** |
| **Gov 治理合規** | 12 項 | **L0.9 / 4** | **3 項**（Gov-02 Code Review 強制、Gov-03 SoD、Gov-10 Access Review） | 🔴 **NOT READY** |
| **合計** | 22 項 | **L1.1 / 4** | **6 項 HIGH 未達 L2** | 🔴 **NOT READY** |

**綜合判定**: 🔴 **Phase 2 結論為 NOT READY**。專案在 Resi 領域有部分基礎建設（FIX-052 Redis、Azure PostgreSQL PITR 規劃），但運維文件（IR Plan、DR Plan、RTO/RPO 正式文檔、Risk Register、Runbook）幾乎完全缺失。Gov 領域因「單人開發 + 單人 Owner」結構，職責分離與 Code Review 強制 機制無從建立。

---

## Resi 領域逐項評分

### Resi-01: Rate Limiting（多實例）— 🔴 HIGH

- **評分**: **L3 Defined**
- **證據**:
  - `package.json:75` 已引入 `@upstash/redis@^1.35.8`
  - `src/services/rate-limit.service.ts` 完整實作雙模式：
    - Lines 1-33（fileoverview）標註 FIX-052 修復、跨實例同步、Redis 優先策略
    - Lines 76-100：`RateLimitService` class — Upstash Redis 為主、in-memory Map 為 fallback
    - Lines 47-58：型別定義含 `retryAfter`（503 響應正確語意）
  - `src/lib/redis.ts` 為 Redis client 單例（`getRedisClient()` + `isRedisConfigured()`）
  - `claudedocs/4-changes/bug-fixes/FIX-052-rate-limit-single-instance-redis-migration.md` 完整修復記錄
  - 矩陣 §5.1 已標註「✅ FIX-052 已修復，Container Apps 多實例 → Upstash Redis 已涵蓋」
- **缺口**:
  - 還未實際在 Container Apps 多實例環境中**驗證**（部署尚未進行；計劃 W7 啟用 — `azure-deployment-plan.md:942`「4.5 Rate limit Upstash Redis 正式啟用」）
  - 全域中間件層 rate limiting **未實作**（目前僅 7 個 `/api/v1/invoices/*` 使用，AppSec-09 Wave 3 範圍）
- **建議**: Phase 2 部署時務必在 staging 用 ≥2 replicas 模擬高併發，驗證 ZSET sliding window 跨實例同步正確性。

### Resi-02: DDoS 防護 — 🟡 MED（標註不採用）

- **評分**: **L1 Initial**（依賴 ACA 內建保護，未顯式啟用驗證）
- **證據**:
  - 矩陣 §5.2 明確標 ⛔「不採用 Azure Front Door / WAF」（成本考量）
  - `azure-deployment-plan.md:559`「DDoS protection」列為 Infra Admin 自行決定
  - `azure-deployment-plan.md:611`「Front Door / WAF — ❌ 不需要（保守方案）」
  - **替代依賴**：ACA Platform 內建 L3/L4 DDoS（Azure 訂閱免費包含）
- **缺口**:
  - **ACA 內建保護的具體規格未經驗證**（用戶明確不採用，但未文件化「保留多少受保護能力」）
  - 內部系統 + IP Allowlist（§9 提及但未定案）能否取代 WAF 未經風險評估
- **建議**: 在 Phase 2 部署的 `network-topology.md` 中由 Infra Admin 補充「ACA L3/L4 保護已啟用，Pilot 階段可接受」的書面紀錄。

### Resi-03: 服務隔離 — 🟡 MED

- **評分**: **L2 Managed**
- **證據**:
  - 已有兩個獨立 Python 服務：`python-services/extraction/Dockerfile`、`python-services/mapping/Dockerfile`（Glob 確認）
  - `docker-compose.yml`（本地）已將 Postgres / pgAdmin / Azurite / Python OCR / Mapping 各自獨立 container
  - `docs/06-codebase-analyze/07-external-integrations/python-services.md` 已盤點：兩個 FastAPI 服務 1,872 LOC
  - Azure 規劃明確：每個服務獨立 ACA app（`azure-deployment-plan.md:540-553` 列出 Container App → 各服務的網路通訊路徑）
  - 矩陣 §5.1 已標「✅ Container Apps 多 app 隔離」
- **缺口**:
  - 服務間**故障隔離測試**（fault domain）尚未進行
  - 資料庫層只有單一 PostgreSQL（無 read replica，不影響此項但相關）
- **建議**: Phase 2 完成首次部署後，做一次 chaos engineering — 故意停掉 Python OCR 服務，驗證 Node.js 主應用是否會 graceful degrade（不 crash 整個 pipeline）。

### Resi-04: Circuit Breaker — 🟡 MED

- **評分**: **L0 Absent**
- **證據**:
  - **Grep 結果**：`circuit|opossum|breaker` 在 `src/` 內**零匹配**（不分大小寫）
  - `package.json` 全文檢視 — **無 opossum、cockatiel、@circuit/breaker 等任何斷路器套件**
  - 外部呼叫核心位置（無 circuit breaker）：
    - `src/services/extraction-v3/unified-gpt-extraction.service.ts:338` — `setTimeout(controller.abort)` 只有 timeout 沒斷路
    - `src/services/extraction-v3/stages/gpt-caller.service.ts:363` — 同上
    - `src/services/extraction.service.ts:185` — Azure DI 呼叫只有 timeout
  - 矩陣 §5.1 標註「應用層實作（opossum / 自建），零成本」— **規劃存在但未實作**
- **缺口**:
  - Azure OpenAI / Azure DI 服務若進入降級狀態（latency 上升 + 高失敗率），**目前會持續送請求並消耗 Azure quota / 成本**
  - 沒有 fallback 機制（Open / Half-Open / Closed 狀態管理）
- **建議**: 對 Azure OpenAI、Azure DI、Microsoft Graph 三個外部依賴實作 `opossum`（npm 免費套件），門檻設「30 秒內失敗率 > 50% 或 5 次連續失敗」即開路。

### Resi-05: Retry / Timeout — 🟡 MED

- **評分**: **L2 Managed**
- **證據**:
  - **Timeout 已普遍存在**：
    - `src/services/extraction-v3/unified-gpt-extraction.service.ts:157` `timeout: 300000` (5 分鐘 Vision)
    - `src/services/extraction-v3/stages/gpt-caller.service.ts:162` `timeout: 300000` (Stage 3)
    - `src/services/extraction.service.ts:47` `REQUEST_TIMEOUT_MS = 120000` (2 分鐘)
    - `unified-gpt-extraction.service.ts:514` `signal: AbortSignal.timeout(10000)` (10 秒 health check)
    - `gpt-caller.service.ts:499` 同上
  - **Retry 局部存在但不一致**：
    - `gpt-caller.service.ts:62-64,163,252,277,280` — `retryCount: 2, retryDelay: 1000` linear backoff
    - `webhook.service.ts:68` — `RETRY_DELAYS_MS = [60000, 300000, 1800000]`（指數型，1分→5分→30分）
    - `extraction.service.ts:301-312` — `if (existingResult.retryCount >= 3) return error 'Maximum retry count exceeded'`
    - `n8n/webhook-config.service.ts:156` — `retryStrategy` 從 input 讀（DB-stored config，可變）
  - 共 **23 個 service 文件包含 retry 概念**（Grep `retry|maxRetries|retryCount`），覆蓋外部呼叫的主要路徑
- **缺口**:
  - **Retry 策略不一致**：linear (1s) vs exponential (1m→5m→30m) vs config-driven，沒有統一 utility / decorator
  - **Azure DI 呼叫缺 retry**（`extraction.service.ts:185` 只有 timeout 沒 retry）
  - Microsoft Graph、SharePoint 服務未檢查 retry 覆蓋率
  - 缺少統一文件記載「哪些外部依賴有 retry / 用什麼策略」
- **建議**: 建立 `src/lib/external-call.ts` utility，統一封裝 timeout + exponential backoff retry + circuit breaker，並在 Resi-04 同步實作。

### Resi-06: 資料庫備份 — 🔴 HIGH

- **評分**: **L2 Managed**（規劃完成 + 已寫入 IaC）
- **證據**:
  - `azure-deployment-plan.md:571-574` 明確列為「✅ 必須 — 資料保護不可妥協」
  - `azure-deployment-plan.md:572-573`：「每日 PITR」+「Blob Storage soft-delete」+「Key Vault soft-delete + purge protection」全部 ✅
  - `infrastructure/manual-setup/resources-checklist.md` Step 2.2「PostgreSQL Flexible Server (B2s Burstable, PG 15, 7-day backup)」`--backup-retention 7 --geo-redundant-backup Disabled`
  - `infrastructure/resources-inventory.md`：UAT 7 天備份 / Prod 14 天備份 + auto-grow enabled
  - `uat-deployment/02-azure-resources-setup.md` 已加入備份配置 az CLI 命令 + verify 步驟
  - `uat-deployment/10-rollback-procedure.md` 列為核心交付物
  - 矩陣 §5.1 標「✅ Azure PostgreSQL Flexible Server 內建，已包含在訂閱費內（PITR 7-35 天）」
- **缺口**:
  - **尚未實際執行**（Azure 環境未建）— 規劃層級完成但無實測
  - **3-2-1 備份原則未完全達成**：
    - 3 份副本：✅（PostgreSQL 自動 + soft delete）
    - 2 種媒體：⚠️ 同 Azure 訂閱單一 region
    - 1 份異地：❌ Geo-redundant backup `Disabled`（成本決策）
  - **備份加密狀態未文檔化**：Azure PostgreSQL Flexible Server 預設 TDE 啟用，但矩陣 DP-09 要求「備份加密 + 異地備份 + 定期還原測試」中後兩項不滿足
- **建議**: 在 `runbooks/backup-restore.md`（待建）中明確記載：(1) RTO/RPO 實測值，(2) 不啟用 geo-redundant 的可接受風險聲明，(3) 備份加密由 Azure TDE 內建提供的書面確認。

### Resi-07: 還原測試 — 🟡 延後項

- **評分**: **L0 Absent**
- **證據**:
  - 矩陣 §5.2 列為「🟡 延後 — 還原本身免費，但需要時間執行；建議每半年手動跑一次」
  - **Glob 結果**：`docs/**/{technical-debt,risk-register,incident-response,disaster-recovery,DR,IR}*.md` — **無檔案匹配**
  - `azure-deployment-plan.md:817-821` W4「首次手動部署到 Azure UAT 成功」—「首次」尚未發生
  - `runbooks/disaster-recovery.md`、`runbooks/backup-restore.md`（`azure-deployment-plan.md:1101-1102`）為 placeholder（待建）
- **缺口**:
  - **無任何還原演練紀錄**（PostgreSQL PITR 還原 / Blob soft-delete 復原 / Key Vault secret 還原）
  - 無「半年一次手動演練」的排程／提醒機制
- **建議**: 在 Phase 2 W4 首次部署完成後**立即**跑一次完整 PITR 還原演練（drop test database → restore from PITR → verify schema + 部分 data），並記錄 RTO 實測值到 `runbooks/backup-restore.md`。

### Resi-08: RTO / RPO 文檔化 — 🟡 MED

- **評分**: **L1 Initial**
- **證據**:
  - `azure-deployment-plan.md:581-584` 已寫出 **預期值**：
    - RTO < 4 小時（單 AZ 故障 + 手動切換 + DB 還原）
    - RPO < 24 小時（每日備份）
    - 「若業務無法接受此 RTO/RPO，需重新討論 HA 決策」
  - **這是規劃文件中的數字，未經業務簽核**
- **缺口**:
  - **無業務 SLA / Owner 簽核文件**（RTO/RPO 是技術假設，不是業務承諾）
  - 沒有針對不同故障情境的 RTO/RPO 矩陣（單 AZ vs Region 故障 vs 資料損毀 vs Ransomware）
  - **「實測 RTO/RPO」未進行**（必須等首次 PITR 演練後才能驗證假設）
- **建議**: 建立 `runbooks/rto-rpo-matrix.md`，至少涵蓋 4 種情境（DB 故障、Storage 故障、ACA 故障、誤刪資料），並由業務 Owner 簽核。

### Resi-09: Incident Response Plan — 🔴 HIGH

- **評分**: **L0 Absent**
- **證據**:
  - **Glob 結果**：`**/incident-response*.md` — **無檔案匹配**（除矩陣 + Azure plan + codebase playbook 提及外）
  - `azure-deployment-plan.md:1100`：`runbooks/incident-response.md` 列為待建 placeholder
  - `claudedocs/5-status/` 只有 `testing/` 子目錄，無 IR 相關文件
  - `docs/04-implementation/sprint-status.yaml` 為 Sprint 進度，非 IR
  - 矩陣 §5.1 已標為 🔴 HIGH
- **缺口**:
  - **完全沒有事件回應流程文件**：
    - 無 Severity 分級（P0/P1/P2/P3）
    - 無 escalation 路徑（誰先通知 / 誰決策 / 誰對外溝通）
    - 無 contact list（on-call / vendor / 業務）
    - 無 post-mortem 模板
  - 沒有事件響應演練紀錄（tabletop exercise）
- **建議**: 在 Phase 4 W7-W8 即建立**最小 IR Plan**（severity 矩陣 + on-call 名單 + Slack/Email 通知模板 + post-mortem 模板），不必等 Pilot 上線。

### Resi-10: 災難演練 — 🟡 延後項

- **評分**: **L0 Absent**
- **證據**:
  - **Glob 結果**：`**/disaster-recovery*.md` — **無檔案匹配**
  - `azure-deployment-plan.md:1101`：`runbooks/disaster-recovery.md` 為待建 placeholder
  - 矩陣 §5.2 標「🟡 延後 — 每年至少一次 DR 演練；初期可用 Tabletop Exercise（桌上推演）替代」
  - 無任何「DR 演練紀錄」存在
- **缺口**:
  - 沒有 DR 計劃文件
  - 無書面 DR 演練紀錄（即使 Tabletop 也應有會議紀錄 + action items）
  - **W10「Review 3：Go-Live Gate」要求「DR 演練通過」**（`azure-deployment-plan.md:868`）但目前無任何演練實施
- **建議**: 在 W8（DR runbook 建立週）同步排定一次 1-小時 Tabletop Exercise，含 4 種情境模擬 + 決策點演練，並把記錄歸檔到 `claudedocs/5-status/dr-exercises/`。

---

## Gov 領域逐項評分

### Gov-01: 變更管理流程（PR + Review + Approval）— 🔴 HIGH

- **評分**: **L1 Initial**
- **證據**:
  - **CHANGE 文件量**：`claudedocs/4-changes/feature-changes/` — **56 份**（CHANGE-001 ~ CHANGE-056）
  - **FIX 文件量**：`claudedocs/4-changes/bug-fixes/` — **57 份**（FIX-001 ~ FIX-054 含 b-suffix 重複編號）
  - 共 **113 份變更文件**，全部採用結構化模板（變更摘要 / 問題描述 / 解決方案 / 驗證方式 / 風險）— 高品質文件化
  - Git log 規範：`feat`、`fix`、`docs` 等 Conventional Commits（git log 顯示 460 commits 全採用此格式）
  - `claudedocs/reference/dev-checklists.md` 已加入「完成 CHANGE/FIX → 更新規劃文件狀態為 ✅ 已完成」規則（MEMORY 記錄 2026-02-26）
- **缺口**:
  - **無 PR + Review + Approval 機制**：
    - Git log 只有 **2 個 merge commits**（`9d79086` Merge feature/change-021-extraction-v3、`3b33cce` Merge branch 'main'）
    - 460 commits 中 **458 是直接 push 到 main**（無 PR 流程）
    - 唯一作者：`laitim2001`（單人 commit history）
  - 無外部審查紀錄（即使 AI 助手扮演 reviewer 角色也未文檔化）
  - **規劃文件存在 ≠ 變更管理流程存在**
- **建議**: Pilot 上線前**必須**強制 main 分支保護 + ≥1 reviewer（即使 reviewer 是 PM 或第二位開發者）。短期變通：要求 self-review 流程 + AI Code Review 強制（gh pr create + 自動化 review summary）。

### Gov-02: Code Review 強制（main 分支保護）— 🔴 HIGH

- **評分**: **L0 Absent**
- **證據**:
  - **無 GitHub branch protection 規則**驗證（gh CLI 不可用，但從 Git log merge 統計推斷）
  - **無 `.github/workflows/`**（唯一 `.github/agents/` 為 BMAD agent 定義，非 CI/CD）
  - `azure-deployment-plan.md:151`「`.github/workflows/`（CI/CD）❌ 不存在」（CHANGE-055 盤點明確列出）
  - 矩陣 §7.1 SDLC-08「CI/CD 守門 — GitHub Actions branch protection」為 🔴 HIGH 必須項，**規劃但未實作**
  - 460 commits 中只有 2 merge commits，意味著 **99.6% 變更未經 PR 流程**
- **缺口**:
  - **完全無 main 分支保護**
  - 無 CI 失敗即 block merge 機制
  - 無 mandatory reviewer 機制
  - 無 mandatory CI checks（type-check、lint、test）
- **建議**: **立即可做**（零成本）：在 GitHub repo settings 啟用 Branch Protection Rules — Require pull request before merging + Require status checks before merging + Require approvals (1)。CI workflow 可後補。

### Gov-03: 職責分離 (SoD)（dev / deploy / audit）— 🟡 MED

- **評分**: **L0 Absent**
- **證據**:
  - **單人專案**：Git log 唯一作者 `laitim2001`（460 commits 100% 同一 author）
  - 無 IAM 角色矩陣（誰可以 commit / merge / deploy / 看 audit log）
  - `azure-deployment-plan.md:858`「4 方參與評審（DevOps + Security + Infra Admin + App Team）」是**未來計劃**，目前單人
  - 矩陣 §6 標「⚠️ 職責分離、Access Review、Risk Register 未確認」
- **缺口**:
  - 開發者 = 部署者 = 審計者（同一人）
  - 無 Azure RBAC 角色設計文件（誰可以對 prod 環境做變更）
  - 無「敏感操作必須 2 人確認」機制
- **建議**: Phase 2 部署時，至少設計 Azure RBAC：(1) Dev role — 只能改 UAT；(2) Deploy role — 由 GitHub Actions Service Principal 執行；(3) Audit role — 只讀 Log Analytics。即使本人扮演 3 個角色，使用不同帳號 + 帳號審計可達 partial SoD。

### Gov-04: 技術債追蹤 — 🟡 MED

- **評分**: **L1 Initial**
- **證據**:
  - **TODO 統計**：`Grep TODO src/` — 共 **42 處 / 27 個文件**（Grep count 結果）
    - 集中區：`extraction-v3/prompt-assembly.service.ts:5`、`backup.service.ts:4`、`stage-3-extraction.service.ts:3`、`services/index.ts:4`
    - 廣度：分布於 services / components / api routes 多層
  - **FIXME 統計**：`Grep FIXME src/` — **0 處**（無 FIXME 標記）
  - **無 `technical-debt.md` 檔**（Glob `docs/**/{technical-debt}*.md` 與 `claudedocs/**/{technical-debt}*.md` 皆 zero match）
  - `.claude/rules/technical-obstacles.md` 是「技術障礙處理規範」，提及「在 `docs/04-implementation/technical-debt.md` 中記錄（如不存在則創建）」— **檔案至今未創建**
  - 矩陣 §6 列為 🟡 MED
- **缺口**:
  - **42 個 TODO 散落代碼，無集中追蹤**
  - 無優先級排序、無 owner 指派、無預計修復時間
  - `.claude/rules/technical-obstacles.md` 第 47 行明確要求創建 `docs/04-implementation/technical-debt.md`，但**從未創建**（規範未落實）
- **建議**: 創建 `docs/04-implementation/technical-debt.md`，從現有 42 個 TODO 開始盤點 + 分級（Critical / Major / Minor）+ 列入 Sprint backlog。

### Gov-05: 第三方風險評估 — 🟡 MED

- **評分**: **L1 Initial**
- **證據**:
  - 第三方依賴清單存在（package.json 依賴 + Azure 服務）：
    - Azure: OpenAI、Document Intelligence、Container Apps、PostgreSQL、Blob Storage、Key Vault、AAD（7 個 Azure 服務）
    - 應用層：next-auth、Prisma、@upstash/redis、ExcelJS、pdfjs-dist 等 77 個 main + 20 dev = 97 個套件
    - 整合：n8n、SharePoint、Outlook、SMTP（4 個外部整合）
  - `docs/06-codebase-analyze/07-external-integrations/integration-map.md` 已盤點 **15+ 主要外部整合**
  - **但無風險評估文件**：
    - 無 vendor risk assessment 文檔
    - 無 SOC2/ISO27001 證明收集（Azure 自有 — 但無存檔）
    - 無「若 OpenAI 服務中斷如何 fallback」評估
- **缺口**:
  - 缺乏正式的 vendor due diligence 文件
  - 沒有「供應商失效 → 應用層備援策略」設計
- **建議**: 創建 `docs/08-security-and-governance/vendor-risk-assessment.md`，列出 Top 10 供應商 + 風險等級 + 備援策略 + SOC2/合規證明連結。

### Gov-06: DPA / 合約 — 🟡 MED（v1.1 已降級）

- **評分**: **L1 Initial**
- **證據**:
  - 矩陣 §6 已 v1.1 降級（HIGH → MED），原因：「本項目無業務 PII，僅員工 PII 由 AAD 處理」
  - 員工 PII 由 Azure AD（公司既有 enterprise tenant）管理，AAD 已內含 Microsoft 標準 DPA
  - 第三方 SaaS：Azure OpenAI / DI 由 Azure 訂閱涵蓋
  - **無顯式收集的 DPA 文件**
- **缺口**:
  - 無書面確認「本系統 PII 處理範圍 + AAD/Azure 已涵蓋之 DPA 連結」
  - n8n 服務（自架/SaaS 未明確）若涉及 PII 流通需獨立評估
- **建議**: 在 vendor-risk-assessment.md 中補上一段「DPA Coverage Map」：員工 PII (User.email/name) → 由 AAD 涵蓋 + Microsoft Online Services Terms（連結提供）。

### Gov-07: 隱私政策 — 🟡 MED（v1.1 已降級）

- **評分**: **L1 Initial**
- **證據**:
  - 矩陣 §6 已 v1.1 降級（HIGH → MED），原因：「對內系統，可簡化」
  - 對內 internal system，沒有外部用戶；但仍有員工資料處理告知義務
  - **無 privacy notice / data handling notice 文件**
- **缺口**:
  - 應提供員工「系統處理我的什麼資料」的告知（即使簡化版）
  - 無「資料保留週期」對員工的書面告知
- **建議**: 創建 1 頁簡化版 `internal-privacy-notice.md` 列出：(1) 系統收集哪些員工資料，(2) 用途，(3) 保留週期，(4) 員工權利（查詢 / 更正 → 走 IT 流程）。

### Gov-08: 安全責任人（Security Officer / DPO）— 🟡 MED

- **評分**: **L0 Absent**
- **證據**:
  - **Grep 結果**：`docs/` 內**無檔案匹配** `securityOfficer|Security Officer|DPO|安全責任`（除矩陣本身提及）
  - `azure-deployment-plan.md:858` 提及「Security Team」為 Review 1 4 方之一，但**無具體人員指派**
  - `azure-deployment-plan.md:887`「Security Team — Review 焦點：Secret rotation、Managed Identity、RBAC、network 邊界、PII handling、Pen-test scope」— 角色定義有，**無 Owner**
  - 矩陣 §6 列為 🟡 MED 但目前狀態未確認
- **缺口**:
  - **沒有指定的 Security Officer**（即使 informal 也沒有）
  - 沒有 escalation contact for security incidents
  - 與 Resi-09 IR Plan 缺失互相關聯（IR 沒有 contact list）
- **建議**: 在 Phase 2 即指定 1 名 Informal Security Owner（即使開發者本人兼任），並在 README 列出 contact + responsibility。

### Gov-09: 員工資安培訓 — 🟡 MED

- **評分**: **L0 Absent**
- **證據**:
  - **Glob 結果**：`**/{training,security-training}*.md` — 無項目相關培訓文件（只有 BMAD 套件的工作流）
  - 無培訓紀錄、無培訓教材、無年度 cadence 安排
  - 對內系統 + 單人開發 → **此項在小團隊階段 minimum viable: 由本人主動參加公司 IT 安全培訓**
- **缺口**:
  - 無培訓計畫文檔
  - 無 secure-coding guideline 引用（`.claude/rules/` 9 個規則文件含部分編碼規範，可視為內部 secure-coding 起點）
- **建議**: 將公司既有員工資安培訓參與紀錄列入 README 或 onboarding-checklist.md（已存在）的 Section。

### Gov-10: Access Review（每季 admin 帳號審查）— 🔴 HIGH

- **評分**: **L0 Absent**
- **證據**:
  - **Glob 結果**：`**/{access-review}*.md` — **無檔案匹配**
  - 矩陣 §6 列為 🔴 HIGH，「目前已知狀態 — ⚠️ 職責分離、Access Review、Risk Register 未確認」
  - **MEMORY 記錄**：Auth coverage 73%（200/331 routes），admin domain 覆蓋 97%（105/108）— 即 **3 個 admin 路由無 auth check**（風險）
  - Prisma schema 有 user / role / permission 模型，但**無「最後審查日期」欄位 / 機制**
- **缺口**:
  - 無季度審查機制
  - 無 admin 帳號 inventory（誰是 admin、何時授予、為何）
  - 無離職員工帳號清理流程文檔
- **建議**: 對應 Resi-09 IR Plan 一併建立 `admin-access-review.md`，至少 1 季 1 次審查 + 異動觸發審查（員工離職 / 角色變更）。

### Gov-11: 文檔治理（版本、審查週期、所有權）— 🟢 LOW

- **評分**: **L1 Initial**
- **證據**:
  - 矩陣本身已**部分自我治理**：
    - `enterprise-security-governance-matrix.md:7` 標註「v1.2（2026-04-28）— 7 大領域全部完成範疇調整」
    - `azure-deployment-plan.md:1153-1156` 修訂歷史表
    - 多個關鍵 sub-CLAUDE.md 含「最後更新」+「版本」+「下次更新時機」
  - `claudedocs/CLAUDE.md` 提供 ClaudeDocs 完整索引（v3.3.0）
  - 但**無統一的文檔治理規則**（哪些文檔需季度 review / 哪些 ad-hoc）
- **缺口**:
  - 無 document lifecycle policy
  - 安全相關文檔（如 IR Plan, DR Plan）尚未存在，無法評估其治理機制
- **建議**: 待 Phase 3 + Phase 4 IR/DR/Risk Register 文件建立後，補一個 `document-governance.md` 統一規範（review cadence、所有權、Change log 規範）。

### Gov-12: 風險登記簿（Risk Register）— 🟡 MED

- **評分**: **L0 Absent**
- **證據**:
  - **Glob 結果**：`docs/**/{risk-register,Risk}*.md`、`claudedocs/**/{risk-register}*.md` — **無檔案匹配**（唯一匹配 `.bmad/bmm/testarch/knowledge/risk-governance.md` 是 BMAD 套件的知識庫，非本專案）
  - 矩陣 §6 列為 🟡 MED「Risk Register 文檔化所有已知風險」
  - 散落但**未集中**的風險記錄：
    - `docs/06-codebase-analyze/05-security-quality/security-audit.md`（codebase 層級風險）
    - 各 CHANGE/FIX 文件的「風險與緩解」區塊（單點風險）
    - MEMORY 中 2026-03-02 的安全評分 6.7/10
- **缺口**:
  - **無集中、可追溯、定期更新的風險登記簿**
  - 風險識別 / 評估 / 緩解 / Owner 沒有單一表格管理
- **建議**: 在 Phase 2 規劃完成後**立即**建立 `docs/08-security-and-governance/risk-register.md`，整合：(1) 6 個本盤點報告中的 HIGH 風險未達 L2，(2) MEMORY 安全審計的 6 個 HIGH 風險點，(3) Azure 部署計劃中的 6 個風險點。

---

## 變更管理流程現況分析（特別章節）

### 量化指標

| 指標 | 數值 | 說明 |
|------|------|------|
| **CHANGE 文件總數** | **56 份**（CHANGE-001 ~ CHANGE-056） | `claudedocs/4-changes/feature-changes/` 統計 |
| **FIX 文件總數** | **57 份**（FIX-001 ~ FIX-054 + b-suffix） | `claudedocs/4-changes/bug-fixes/` 統計 |
| **變更文件總計** | **113 份** | 全部採用結構化模板 |
| **Commit 總數** | **460** | 全部唯一作者 `laitim2001` |
| **Merge commits** | **2** | `9d79086` + `3b33cce`（佔 0.4%） |
| **Direct push 比例** | **99.6%** | 458/460 commits 未經 PR 流程 |
| **CI/CD workflows** | **0** | `.github/workflows/` 不存在 |
| **Branch protection** | **未驗證**（gh CLI 不可用） | 從低 merge 比例推斷無強制 |

### 流程合規程度

```
書面規範層級    ✅✅✅  完善（CHANGE/FIX 模板 + Conventional Commits + dev-checklists）
                              113 份變更文件，結構化記錄
                              ↓
工具強制層級    ❌      缺失（無 PR 流程、無 CI、無 branch protection）
                              依賴文化自律，無系統性檢查點
                              ↓
人員審查層級    ❌      缺失（單人 commit history，無外部 reviewer）
                              即使 AI 協作扮演 reviewer 角色也未產生 audit trail
```

### 結論

- **記錄優秀，執行薄弱**：113 份高品質變更文件展示強烈的「文件化驅動」開發文化
- **單人專案結構限制**：Conventional Commits + 113 份 CHANGE/FIX 是單人能達到的高水位，但缺 SoD / Code Review 是結構性問題
- **Pilot 上線前必補**：在跨多人團隊（W2 評審後 4 方參與）前，必須建立 main 分支保護 + PR 流程 + CI/CD（即使 1 人也走流程）

---

## 技術債務現況（特別章節）

### 量化盤點

| 項目 | 數值 | 證據 |
|------|------|------|
| **`docs/04-implementation/technical-debt.md`** | ❌ **不存在** | Glob 確認，但 `.claude/rules/technical-obstacles.md:47` 明確要求創建 |
| **TODO in src/** | **42 處 / 27 個文件** | Grep `TODO src/` |
| **FIXME in src/** | **0 處** | Grep `FIXME src/` |
| **HACK / XXX in src/** | 未顯式統計（但 grep 包含於上） | 偏低 |
| **CHANGE/FIX 中標註的 known issue** | 散見於各 CHANGE 風險區塊 | 113 份文件未集中提取 |

### TODO 集中區（需重點關注）

| 文件 | TODO 數 | 子模組 |
|------|---------|--------|
| `src/services/extraction-v3/prompt-assembly.service.ts` | **5** | Prompt 組裝（核心 V3 管線） |
| `src/services/backup.service.ts` | **4** | 備份服務（與 Resi-06 直接相關 ⚠️） |
| `src/services/index.ts` | **4** | 服務層入口 |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | **3** | Stage 3 欄位提取 |
| `src/services/health-check.service.ts` | **2** | 健康檢查（與 Obs-11 相關） |
| `src/services/extraction-v3/extraction-v3.service.ts` | **2** | V3 主入口 |
| `src/services/n8n/n8n-document.service.ts` | **2** | n8n 整合 |
| `src/lib/prompts/optimized-extraction-prompt.ts` | **2** | Prompt 庫 |
| 其他 19 個文件 | 各 1 個 | 散落 |

### 關鍵發現

1. **`backup.service.ts:4 個 TODO` 直接對應 Resi-06 備份能力**：技術債的存在意味著備份服務本身可能未完成
2. **V3 提取管線（核心業務邏輯）累積 12 個 TODO**：分布於 prompt-assembly、stage-3、extraction-v3、prompt-merger 等
3. **`technical-debt.md` 未創建是規範違反**：`.claude/rules/technical-obstacles.md` 明確要求

### 結論

技術債存在但量級**可控**（42 個 TODO + 0 FIXME），**主要問題在於缺乏集中追蹤機制**。創建 `docs/04-implementation/technical-debt.md` 是**最低成本最高 ROI** 的改善項。

---

## 重大發現（HIGH 風險未達 L2 的關鍵項）

按嚴重性排序的 6 個關鍵發現：

### 🔴 Finding 1: Resi-09 Incident Response Plan 完全缺失（L0）

**影響**: HIGH — 一旦 Pilot 上線，發生事件無 SOP 可循。

**證據**: `**/incident-response*.md` Glob 零匹配；`runbooks/incident-response.md` 為 placeholder（`azure-deployment-plan.md:1100`）。

**建議行動**: Phase 4 W7-W8 即建立最小 IR Plan（severity matrix + on-call list + post-mortem template），不必等 Pilot 上線。

### 🔴 Finding 2: Resi-04 Circuit Breaker 完全缺失（L0）

**影響**: HIGH — Azure OpenAI / DI 服務降級時，應用會持續送請求消耗成本 + 把使用者體驗拖垮。

**證據**: `Grep circuit|opossum|breaker src/` 零匹配；`package.json` 無斷路器套件；3 個外部呼叫點僅有 timeout 沒斷路。

**建議行動**: 引入 `opossum`（npm 免費）對 Azure OpenAI / DI / Microsoft Graph 加斷路器，搭配 Resi-05 統一 retry + timeout utility。

### 🔴 Finding 3: Gov-02 Code Review 強制機制完全缺失（L0）

**影響**: HIGH — 99.6% commits 直接 push 到 main，無外部審查機制，企業級合規無法滿足。

**證據**: 460 commits 中只有 2 個 merge commits；無 `.github/workflows/`；唯一作者 `laitim2001`。

**建議行動**: **零成本立即可做** — 在 GitHub repo settings 啟用 Branch Protection（Require PR + Require approval），CI workflow 後補。

### 🔴 Finding 4: Gov-10 Access Review 無機制（L0）

**影響**: HIGH — 對應 MEMORY 記錄中「3 個 admin 路由無 auth」(Auth coverage 73%)，admin 帳號變動無審查 trail。

**證據**: `**/access-review*.md` 零匹配；Prisma schema 無「最後審查日期」欄位。

**建議行動**: 與 Gov-12 Risk Register 一併建立 `admin-access-review.md`，至少 1 季 1 次。

### 🔴 Finding 5: Resi-08 RTO/RPO 僅有技術假設未經業務簽核（L1）

**影響**: HIGH — RTO < 4h / RPO < 24h 是技術假設，無業務 Owner 簽核 → Pilot 後若發生事件，業務可能不接受 4 小時 downtime。

**證據**: `azure-deployment-plan.md:581-584` 數字存在但無 SLA 文件。

**建議行動**: 建立 `runbooks/rto-rpo-matrix.md` 涵蓋 4 種故障情境 + 業務 Owner 簽核（即使 informal sign-off 也可）。

### 🔴 Finding 6: Gov-12 Risk Register 完全缺失（L0）

**影響**: HIGH — 散落於 113 份 CHANGE/FIX、6 份 codebase analysis、MEMORY 中的風險點，**沒有集中、可追溯的登記**。

**證據**: `docs/**/{risk-register}*.md` 零匹配；`claudedocs/**/{risk-register}*.md` 零匹配。

**建議行動**: 立即建立 `docs/08-security-and-governance/risk-register.md`，整合：
- 本盤點 6 項 HIGH 風險未達 L2
- MEMORY 2026-03-02 安全審計 6 項 HIGH（Auth coverage / PII / SQL Injection 等，多項 FIX-050~053 已修復）
- Azure 部署計劃 §⏰時程規劃 6 項風險（評審延遲 / Infra 延遲 / Pen-test / 等）

---

## 補充：未列入必查但影響評分的觀察

1. **單人專案結構是 Gov 領域多項 L0 的根因**：開發者 = reviewer = deployer = auditor 是結構性限制，非執行不力。一旦進入 Pilot（W10）4 方參與，許多 Gov 項可從 L0 → L2。

2. **Phase 1 規劃文件品質高於業界平均**：v1.2 矩陣 + Azure plan v0.3 + 12 份 UAT 部署文件規劃 + CHANGE-055/056 已展現「規劃驅動」成熟度。**痛點在於規劃 → 執行的轉化未發生**。

3. **零成本原則限制 Resi-02 / Obs-04 等項可達上限**：用戶決策不採用 Azure Front Door / Application Insights / Sentinel 等付費服務，本盤點不應視為缺陷，而是「現有預算下的合理 trade-off」。

4. **W10 Review 3 Go-Live Gate 要求項目 vs 本盤點 GAP**：
   - `azure-deployment-plan.md:868` Review 3 要求「Pen-test 通過 + DR 演練通過 + Runbook 完整」
   - 本盤點顯示 IR/DR/Runbook 全部 L0
   - **W7-W8（Phase 4）必須完成至少 5 份新文件**：IR Plan、DR Plan、Backup-Restore Runbook、RTO/RPO Matrix、Risk Register
   - 否則 Review 3 必然 fail

---

## 路徑建議（Phase 3 規劃輸入）

### 立即可做（零成本，本週內）

1. **啟用 GitHub Branch Protection**（Gov-02：L0 → L2）— 30 分鐘
2. **創建 `docs/04-implementation/technical-debt.md`**（Gov-04：L1 → L2）— 1 小時
3. **創建 `docs/08-security-and-governance/risk-register.md`**（Gov-12：L0 → L2）— 2 小時整合既有資料

### Phase 4（W7-W8）必補

4. **`runbooks/incident-response.md`**（Resi-09：L0 → L2）— 1 day
5. **`runbooks/disaster-recovery.md` + Tabletop Exercise**（Resi-10：L0 → L1）— 1 day
6. **`runbooks/backup-restore.md` + 首次 PITR 還原演練**（Resi-06：L2 → L3、Resi-07：L0 → L2）— 1 day
7. **`runbooks/rto-rpo-matrix.md` + 業務 Owner 簽核**（Resi-08：L1 → L2）— 0.5 day

### Phase 4 + W11（Pilot 後可補）

8. **`opossum` 斷路器整合**（Resi-04：L0 → L2）— 2 days
9. **`vendor-risk-assessment.md`**（Gov-05：L1 → L2）— 1 day
10. **`admin-access-review.md` + 季度提醒**（Gov-10：L0 → L2）— 0.5 day

### 結構性問題（短期難以根治）

11. **Gov-03 SoD**：仰賴團隊擴編；Phase 2 用 Azure RBAC 角色拆分達到 partial SoD
12. **Gov-01 PR 強制**：依 Gov-02 啟用後逐步建立 PR 文化

---

## 結論

| 領域 | 平均成熟度 | HIGH 未達 L2 | 評估 |
|------|-----------|-------------|------|
| **Resi 韌性災備** | L1.4 / 4 | 3 項 | 🔴 NOT READY — 規劃完整但運維文件全缺 |
| **Gov 治理合規** | L0.9 / 4 | 3 項 | 🔴 NOT READY — 結構性 SoD/PR 缺失 |

**整體評估**: 🔴 **Phase 2 結論為 NOT READY for Pilot Go-Live**，但「規劃驅動」基礎堅實，預期在 Phase 4（W7-W8）若執行 6 個運維文件（IR/DR/Backup-Restore/RTO-RPO/Risk-Register/Tech-Debt）+ 啟用 GitHub Branch Protection，可達 🟡 PARTIALLY READY 進入 W10 Review 3 Gate。

**最高 ROI 立即動作**: GitHub Branch Protection 啟用（30 分鐘工作量）+ Risk Register 整合（2 小時工作量）= 一個下午可從 6 個 HIGH 未達 L2 降為 3 個。

---

*盤點建立日期: 2026-04-28*
*盤點方法: 文件審查 + Grep / Glob / Git log 量化分析（不修改任何代碼）*
*下一步: 進入 Phase 3 — 差距分析與路線圖（30/60/90 天）*
