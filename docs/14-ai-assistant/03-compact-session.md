# SITUATION AI Document Extraction — Compact Summary Prompt（每個 session `/compact` 之前用）

> **用法**：直接 copy「複製貼上區」呢段入 Claude Code 對話框送出即可。下方「設計說明」係畀維護者睇嘅背景，**唔需要每次貼**。
>
> **適用範圍**：AI Document Extraction Project Phase 2（功能變更模式）期間任何 CHANGE/FIX 相關 session。非項目相關 work（如 ad-hoc explore / 學習 task）可以用通用 800 字 compact。

---

## ✂️ 複製貼上區（直接送出，毋須修改）

```
/compact

## AI Document Extraction Compact 格式（≤1500 字，繁體中文）

### 0. Task 座標
Task: CHANGE-XXX / FIX-XXX / Tech Spec X.Y / Trivial fix
Epic 範圍: Epic N - {name}（如涉及 Epic 層）
Branch: feature/change-XXX / fix/XXX / main
Working tree 狀態: clean / dirty（X files modified, Y untracked）
累計: 70 CHANGE + 59 FIX（Phase 1 22 Epic done）→ 本 session +N

### 1. 本次主要任務（一句話）

### 2. 已完成（按 dev-checklists 順序）
- 規劃文件變更：CHANGE-XXX / FIX-XXX 路徑 + 新建/更新/狀態 flip 為 ✅ 已完成（dev-checklists 第 1 條 🔴）
- Code 變更：新建 / 修改 / 刪除（每 file 標明所屬 Epic + 層級 src/services|app/api|components|hooks|lib|types）
- Schema 變更：Prisma model 增/改/刪 + migration 名 + dry-run 驗證？
- i18n 變更：messages/{en,zh-TW,zh-CN}/<namespace>.json 3 語言同步？npm run i18n:check pass？
- 測試：npm run type-check + npm run lint + npm run test pass/fail 數
- Commits：hash + Conventional Commits subject（每個對應 1 個 CHANGE/FIX 子項）

### 3. Strict Mode 9 項自檢（每項 ✅/⚠️/❌/N/A）
1. H1 Architecture lock（三層映射 / 信心度路由 / 122 Prisma models 結構未動，或已 user-approved）
2. H2 Vendor lock（無新 npm dep / Azure stack / Prisma / Next.js 未動，或已 ask + approve）
3. H3 Task scope（無「順手做埋」/ 無超出 CHANGE/FIX scope 嘅 refactor）
4. H4 Security & Privacy（無 hardcode secret / 無 PII log to plaintext / 無 client component 直接 DB）
5. H5 i18n & Hard-coding（無 UI 字串硬編碼 / 3 語言 JSON 同步 / 新 namespace 已註冊 request.ts）
6. H6 Design deviation（無偏離 Tech Spec / UX pattern；如偏離已 user-approved + 技術債務記錄 3 處）
7. Karpathy baseline（think before / simplicity first / surgical / goal-driven — 每行改動可 trace 回 user 請求）
8. Task type classification（task → Phase / Change / Bug-fix / Trivial 之前 propose to user）
9. 規劃文件狀態 sync（完成 CHANGE/FIX → 文件狀態 flip 為 ✅ 已完成）

### 4. 進行中 / 阻塞 / 🚧 延後項
（per CLAUDE.md §絕不 touch 清單 + 用戶 working tree 未追蹤檔案保留紀律）

### 5. 關鍵決策 / OQ 變更
- Spec-aligned implementation 決策（non-architectural）
- OQ resolved → docs/open-questions.md 同步狀態
- Hard Constraint triggered（H1-H6 violation approved）→ 技術債務記錄 3 處（CHANGE/FIX 文件 + known-discrepancies.md + commit message）
- 信心度閾值 decision（如涉及）→ 注意 OQ-Q1 代碼 90%/70% vs 文檔 95%/80% 誤差

### 6. Commit ↔ CHANGE/FIX mapping
| Hash | Subject | CHANGE/FIX 子項 |
|---|---|---|
| ... | feat(scope): ... | CHANGE-XXX §N.M / FIX-XXX Sev2 root-cause |

### 7. 下一步
- Next session 第 1 件事
- 當前 CHANGE/FIX 剩 X 個子項 / Y 個 acceptance criteria
- 下個 CHANGE/FIX 規劃狀態（未開 / 已 draft / 已 approve / 進行中）
- Open items / carry-overs（從 規劃文件 + 🚧 延後項 + OQ 列表）
- 即將觸發嘅 milestone（Azure 部署 Phase 3 / Auth 95% / Zod 95% / RFC 7807 統一 / console.log 清零）

### 8. CHANGE/FIX 紀律自檢
☐ 沒擅自決定不寫規劃文件直接 code（trivial < 30 min 例外）
☐ 沒「順手」refactor 周邊代碼（H3 trigger）
☐ 沒在 commit 後忘記更新規劃文件狀態為 ✅ 已完成
☐ 沒搜尋 CHANGE/FIX 編號時用數字前綴 Glob（必須 CHANGE-*.md / FIX-*.md 全量搜尋）
☐ 沒並行修改同一文件（並行 Agent 編排紀律）
☐ 沒在 Agent 內執行 git 操作（commit / push 必須主 Session）

### 9. 已知差異 / 技術債務變更
- 新加技術債務？（PII / SQL injection / 規格偏離）→ 記錄 3 處：CHANGE/FIX 文件 + known-discrepancies.md + commit message
- 已修復差異 flip 狀態？→ known-discrepancies.md「已修復」section 移動
- Phase 2 治理進度：Auth 60.7%→? / Zod 60-65%→? / console.log 279 處→?

### 10. 紅旗（若有）
任何 H1–H6 violation hint / spec drift / vendor swap proposal / Tier 2 feature 滲入 / 未經 user-approval 嘅設計偏離 / Open OQ default behavior 未標 commit note → 第一句寫，之後解釋
```

> **就係咁 — 上面代碼塊整段 copy 後送出即可。** 下面都係背景說明，唔需要每次貼。

---

## 為何比通用 compact 多 6 項

通用 800 字 compact 唔檢查本項目 specific 紀律。Phase 2 期間，以下違反屬**直接 PR revert / CHANGE/FIX 重做級**問題，必須每次 compact 強制驗證：

1. **Task 座標**（§0）— CHANGE/FIX 編號 + Epic 範圍是 traceability 必要前提
2. **Strict Mode H1-H6 合規**（§3 #1-6）— 任何 violation = STOP and ask + 技術債務記錄
3. **Karpathy baseline 合規**（§3 #7）— over-engineering / speculative abstraction = 重寫 cost
4. **Task type classification**（§3 #8）— Phase / Change / Bug-fix / Trivial 走錯 workflow = 缺 traceability + 漏 verification
5. **規劃文件狀態 sync**（§3 #9）— 完成 CHANGE/FIX 後忘記 flip 為 ✅ 已完成 = sprint-status / progress 跟唔上現實
6. **CHANGE/FIX 紀律自檢**（§8）— 防 AI 喺 compact 中漏 surface 「順手」refactor / 編號搜尋錯 / Agent 內 git 操作等違規

---

## 何時用本 compact、何時用通用 compact

| 場景 | 用邊個 |
|---|---|
| Phase 2 CHANGE/FIX working session | **本 compact**（本檔上方代碼塊）|
| CHANGE/FIX 收尾 review session | 本 compact + 額外 paste 該 CHANGE/FIX 規劃文件嘅 Implementation Notes |
| Bug-fix 期間（FIX-NNN session） | 本 compact + 強調 §3 #8 task classification + §9 技術債務 |
| Change request 期間（CHANGE-NNN session） | 本 compact + 強調 §3 #8 + §3 #1（若改三層映射 / 信心度路由 / Prisma 結構） |
| 並行 Agent 編排 session（多 CHANGE/FIX 同時做） | 本 compact + 強調 §8 並行紀律（同文件 / Agent 內 git） |
| 非項目 work（ad-hoc explore / 學習 task） | 通用 800 字 compact |
| 緊急 token 壓力（context > 90%） | 通用 800 字 compact（省 700 字 budget，但記低本項目紀律未驗證） |

---

## 比較：通用 compact vs 本項目 compact

| 項目 | 通用 compact（800 字） | 本項目 compact（本檔） |
|---|---|---|
| 字數 | 800 字 | 1500 字 |
| Task 座標（CHANGE/FIX 編號 + Epic） | ❌ | ✅ §0 |
| Strict Mode H1–H6 抽查 | ❌ | ✅ §3 #1-6 |
| Karpathy baseline 合規 | ❌ | ✅ §3 #7 |
| Task type classification | ❌ | ✅ §3 #8 |
| 規劃文件狀態 sync | ❌ | ✅ §3 #9 |
| 🚧 延後項追蹤 | ❌ 隱含 | ✅ §4 + 絕不 touch 清單提醒 |
| Commit ↔ CHANGE/FIX mapping | ❌ | ✅ §6 |
| CHANGE/FIX 紀律自檢 | ❌ | ✅ §8 |
| OQ + 技術債務 + 已知差異同步 | ❌ | ✅ §5 + §9 |
| Phase 2 治理進度（Auth/Zod/console.log）| ❌ | ✅ §9 |
| 紅旗 spec drift surface | ❌ | ✅ §10 |

---

## §3 Strict Mode 9 項對應 source

| # | Item | 權威 source |
|---|---|---|
| 1 | H1 Architecture lock | `CLAUDE.md §Hard Constraints H1` + `.claude/rules/hard-constraints.md §H1` |
| 2 | H2 Vendor lock | `CLAUDE.md §Hard Constraints H2` + `.claude/rules/hard-constraints.md §H2` + `claudedocs/reference/tech-stack.md` |
| 3 | H3 Task scope | `CLAUDE.md §Hard Constraints H3` + `.claude/rules/hard-constraints.md §H3` |
| 4 | H4 Security & Privacy | `CLAUDE.md §Hard Constraints H4` + `.claude/rules/hard-constraints.md §H4` |
| 5 | H5 i18n & Hard-coding | `CLAUDE.md §Hard Constraints H5` + `.claude/rules/i18n.md` |
| 6 | H6 Design deviation | `CLAUDE.md §Hard Constraints H6` + `.claude/rules/hard-constraints.md §H6` |
| 7 | Karpathy baseline | `CLAUDE.md §編碼核心原則` + `andrej-karpathy-skills:karpathy-guidelines` plugin |
| 8 | Task type classification | `CLAUDE.md §AI 開發輔助` + `/plan-story` / `/plan-change` / `/plan-fix` skill |
| 9 | 規劃文件狀態 sync | `claudedocs/reference/dev-checklists.md` 第 1 條（🔴 必須） |

---

## §8 CHANGE/FIX 紀律對應 source

per [`CLAUDE.md`](../../CLAUDE.md) + [`.claude/rules/agent-orchestration.md`](../../.claude/rules/agent-orchestration.md)：

- **規劃先行**：任何 multi-file 變更必須先有 CHANGE-XXX / FIX-XXX 規劃文件（trivial < 30 min 例外）
- **編號搜尋全量**：搜尋編號用 `CHANGE-*.md` / `FIX-*.md`（無數字前綴）— 避免漏看高編號（FIX-044 事件教訓）
- **狀態 sync 強制**：完成 → 規劃文件狀態 flip 為 ✅ 已完成（dev-checklists 第 1 條 🔴）
- **單一 CHANGE/FIX 對應獨立 commit 序列**：不混合多個 CHANGE/FIX 改動
- **並行 Agent 紀律**：禁止並行修改同文件 + 禁止 Agent 內 git 操作（commit/push 主 Session 統一處理）
- **Schema 變更不並行**：必須單一 Agent / 主 Session 處理 + 先 migration dry-run 驗證

---

## §10 紅旗信號（本項目 specific watch list）

任何 compact 偵測到以下任一信號，**第一句就寫紅旗**：

- **「順手做埋 GraphRAG / multi-agent / workflow builder / multi-tenancy」** → Tier 2 feature 滲入 Phase 2，H1 violation
- **「換 vendor」**（如 Azure Document Intelligence → Azure Computer Vision / Azure OpenAI → OpenAI direct / Prisma → TypeORM）→ H2 violation，需 STOP and ask
- **「hardcode tenant ID / subscription ID / connection string / API key」** → H4 violation
- **「console.log(user.email)」/「log token」/「log PII to plaintext」** → H4 violation（參考 FIX-050 事件）
- **「$executeRawUnsafe（未 escape input）」** → H4 SQL injection risk（參考 FIX-051 事件）
- **「硬編碼 UI 字串」/「只改一個語言 JSON」/「新 namespace 未註冊 request.ts」** → H5 violation
- **「跳過 Tech Spec 自行 approximate」/「替代方案未經 user-approve」** → H6 violation（必須 STOP）
- **「跳過規劃文件直接 code」**（非 trivial）→ Task scope discipline violation
- **「順手 refactor 無關文件」/「『為將來預留』加 abstraction」** → H3 + Karpathy §1.2 violation
- **「同一個 file 跨 Epic 大改」**（同時改多個 epic-X / epic-Y services） → 應拆 CHANGE/FIX
- **「未經 user 同意改 PRD v1.0 frozen 內容」** → 絕不 touch 清單 violation
- **「`git reset --hard` / `git push --force` / `--no-verify` 未經 explicit 授權」** → CLAUDE.md §執行行動 violation
- **「Open OQ default behavior 未在 commit message 標 `Note: depends on OQ-Q<N>`」** → OQ 機制 violation
- **「並行 Agent 同時改同文件」/「Agent 內執行 git commit」** → agent-orchestration.md 紀律 violation

---

## 維護

- 同 `02-session-start.md` 配套使用（一個 session 開頭、一個 session 結尾）
- `CLAUDE.md` 大改（§Hard Constraints H1–H6 / §編碼核心原則 / §When in Doubt / §Self-Verification）時，§3 + §10 紅旗信號對應更新
- `.claude/rules/*.md` 大改時，§3 source 列表 + §10 對應更新
- 新 Epic 大批引入 / Tier 2 feature 啟動時，§10 紅旗信號「Tier 2 滲入」條目對應更新
- Phase 切換（Phase 2 → Phase 3）時整檔重寫
- CHANGE/FIX 編號規則改變（如改用 GitHub Issue 編號）時，§0 + §6 + §8 對應更新

---

**Last Updated**：2026-05-26（**CLAUDE.md v4.0.0 Strict Mode 啟動** — 本 compact prompt 配合 v4.0.0 framework 重寫，採用 EKP compact sample 結構 + 本項目 CHANGE/FIX 模式紀律。§0 Task 座標採 CHANGE/FIX 編號 + Epic 範圍取代 EKP phase coordinate；§3 9 項自檢映射 Strict Mode H1-H6 + Karpathy + Task classification + 規劃文件狀態 sync；§5 OQ 變更 + 技術債務 3 處記錄機制；§6 Commit ↔ CHANGE/FIX mapping 取代 EKP commit ↔ checklist mapping；§7 milestone 列表覆蓋 Azure 部署 + Auth 95% + Zod 95% + RFC 7807 + console.log 清零；§8 CHANGE/FIX 紀律自檢含全量編號搜尋 + 並行 Agent 紀律；§9 Phase 2 治理進度量化追蹤；§10 紅旗信號含 FIX-050/051 事件引用 + OQ default behavior commit note + 並行 Agent 違規）
> **Prior**：（無 — 本檔初版）

**Maintainer**：Chris Lai（laitim20014@gmail.com）+ AI 助手共同維護
**File location**：`docs/14-ai-assistant/03-compact-session.md`
**Companion**：`02-session-start.md`（每個新 session 開頭用）

---

## Update history

| Date | Phase | Updates |
|---|---|---|
| 2026-05-26 | CLAUDE.md v4.0.0 Strict Mode 啟動 | 初版（基於 EKP `02-compact-session-sample.md` 結構，本項目 specific：CHANGE/FIX 模式取代 phase planning；Strict Mode H1-H6 + Karpathy 四守則 + Task classification + 規劃文件狀態 sync 取代 EKP 9 項自檢；§5 OQ + 技術債務 3 處記錄；§7 milestone 含 Phase 2 治理重點；§8 含全量編號搜尋 + 並行 Agent 紀律；§10 紅旗含 FIX-050/051 事件 + OQ default behavior commit note）|
