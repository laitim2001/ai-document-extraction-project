# SITUATION EKP — Compact Summary Prompt(每個 session `/compact` 之前用)

> **用法**:直接 copy「複製貼上區」呢段入 Claude Code 對話框送出即可。下方「設計說明」係畀維護者睇嘅背景,**唔需要每次貼**。
>
> **適用範圍**:Tier 1 Foundation sprint(原 W1–W12 spec,實際 trajectory **extended to W18+** via W12-W15 UI sprint cycle pivot + W17 beta hardening + W18 app shell IA)期間任何 EKP-related session。非 EKP work(e.g. ad-hoc explore / one-off docs)可以用通用 800 字 compact。

---

## ✂️ 複製貼上區(直接送出,毋須修改)

```
/compact

## EKP Compact 格式(≤1500 字,繁體中文)

### 0. Phase 座標
Phase W{NN}-{name} / Day Z / 累計 N/12 phase / Branch / Working tree 狀態(clean / dirty)

### 1. 本次主要任務(一句話)

### 2. 已完成(按 EKP phase workflow R1-R5 順序)
- Plan / checklist / progress 變更:路徑 + 新建/更新/勾選 X 項
- Code 變更:新建 / 修改 / 刪除(每 file 標明歸屬 Cn component)
- Doc 變更:components/Cn-*.md design note bump?ADR 寫咗?decision-form.md OQ 同步?
- 測試:pytest pass/fail 數 + ruff + mypy strict + frontend lint + build
- Commits:hash + subject(每個對應 1 個 checklist 項目 — R2)

### 3. EKP 紀律 9 項自檢(每項 ✅/⚠️/❌/N/A)
1. Architecture lock(H1 — §3+§4 component 改動 ADR?)
2. Vendor lock(H2 — 新 dep 之前 ask?)
3. Dify reference(H3 — 純 read-only,無 copy-paste / import / branding clone)
4. Tier 1 boundary(H4 — 無 GraphRAG / multi-agent / multi-tenancy / multi-modal / auto-sync / fine-tune)
5. Security(H5 — 無 hard-code tenant ID / connection string;.env gitignored)
6. Test coverage(H6 — backend/{ingestion,retrieval,pipeline,eval} + api/routes/query.py 同步 test)
7. Component spine(每 file 明確歸屬 1 個 Cn — 無 cross-component scattering)
8. PROCESS.md classification(task → Phase / Change / Bug-fix / Trivial 之前 propose)
9. Karpathy baseline(think before / simplicity first / surgical / goal-driven)

### 4. 進行中 / 阻塞 / 🚧 延後項
(per CLAUDE.md sacred rule:不可刪 unchecked checklist `[ ]` 項,必須標 🚧 + 理由 + target phase)

### 5. 關鍵決策 / OQ 變更
- Spec-aligned implementation 決策(non-architectural,non-ADR)
- OQ resolved → decision-form.md + progress.md Day-N entry 同步狀態(R4)
- ADR triggered(若 H1 / H2 violation approved)→ docs/adr/NNNN-*.md
- Plan deviation → plan.md changelog entry(R3)

### 6. Commit ↔ Phase checklist mapping
| Hash | Subject | Checklist item ticked |
|---|---|---|
| ... | ... | F<n>.<x> ... |

### 7. 下一步
- Next session 第 1 件事
- 本 phase 剩 X days / Y un-checked items
- 下個 phase plan 狀態(rolling JIT:當前 phase 收尾才寫,禁止預寫多個 phase plan)
- Open items / carry-overs(從 progress.md retro / 🚧 延後項 / RISK_REGISTER 🔴 entries)
- 即將觸發嘅 hard gate(Gate 1 W2 ✅ / Gate 2 W4-W6 PARTIAL ✅ / Gate 3 W6 demo ✅ / **Tier 1 UI sprint cycle FINAL W15 ✅ PASS WITH SMOKE-USER-DEFERRED CAVEAT** / **Production launch W16+ ⏳ pending Track A IT cred populate event + R-B1 closure**)

### 8. Rolling Planning 紀律自檢
☐ 沒預寫多個未來 phase folder(只當前 active + 下一個 draft)
☐ 沒跳過 plan.md / checklist.md 直接 code(R1)
☐ 沒刪除未勾選 `[ ]` 項目(只 `→[x]` 或加 🚧 + reason)
☐ 沒喺 retrospective.md 寫具體未來 phase task
☐ Daily commit 對應 progress.md Day-N entry(R2;`docs(planning):` housekeeping commits 例外)
☐ Phase 收尾任何 architectural-adjacent 決定 → ADR(R5)

### 9. 風險 / Risk Register 變更
- 新加 risk?status update(🟢 mitigated / 🟡 partial / 🔴 active / ⚫ accepted)?
- (RISK_REGISTER.md living doc — 不停 update;architecture.md §8 frozen baseline 不動)

### 10. 紅旗(若有)
任何 H1–H6 violation hint / spec drift / vendor swap proposal / Tier 2 feature 滲入 / 未經 ADR 嘅 architectural change → 第一句寫,之後解釋
```

> **就係咁 — 上面代碼塊整段 copy 後送出即可。** 下面都係背景說明,唔需要每次貼。

---

## 為何比通用 compact 多 6 項

通用 800 字 compact 唔檢查 EKP-specific 紀律。Tier 1 12-week sprint 期間,以下違反屬**直接 PR revert / phase 重做級**問題,必須每次 compact 強制驗證:

1. **Phase 座標**(§0)— rolling JIT planning + Daily progress R2 binding 必要前提
2. **Hard constraints H1-H6 合規**(§3 #1-6)— 任何 violation = STOP and ADR or revert
3. **Component spine 歸屬**(§3 #7)— cross-component scattering 即係 V1 教訓 → EKP 從 day 1 防
4. **PROCESS.md classification**(§3 #8)— phase / change / bug-fix 走錯 workflow = 缺 traceability + 漏 verification
5. **Karpathy baseline 合規**(§3 #9)— over-engineering / speculative abstraction = 重寫 cost
6. **Rolling planning 自檢**(§8)— 防 AI 喺 compact 中順手「規劃未來 phase」(rolling 紀律核心)

---

## 何時用 EKP compact、何時用通用 compact

| 場景 | 用邊個 |
|---|---|
| Tier 1 phase 期間(W1–W12)working session | **EKP compact**(本檔上方代碼塊)|
| Phase 收尾 retro day | EKP compact + 額外 paste 該 phase progress.md retro section |
| Bug-fix 期間(BUG-NNN session)| EKP compact + 強調 §3 #8 PROCESS classification |
| Change request 期間(CH-NNN session)| EKP compact + 強調 §3 #8 + §3 #1(若改 §3-§4 component)|
| 非 EKP work(ad-hoc explore / one-off docs / 學習 task)| 通用 800 字 compact |
| 緊急 token 壓力(context > 90%)| 通用 800 字 compact(省 700 字 budget,但記低 EKP 紀律未驗證)|

---

## 比較:通用 compact vs EKP compact

| 項目 | 通用 compact(800 字)| EKP compact(本檔)|
|---|---|---|
| 字數 | 800 字 | 1500 字 |
| Phase 座標 | ❌ | ✅ §0 |
| Hard constraints H1–H6 抽查 | ❌ | ✅ §3 #1-6 |
| Component spine 歸屬 | ❌ | ✅ §3 #7 |
| PROCESS.md task classification | ❌ | ✅ §3 #8 |
| Karpathy baseline 合規 | ❌ | ✅ §3 #9 |
| 🚧 延後項追蹤 | ❌ 隱含 | ✅ §4 + sacred rule 提醒 |
| Commit ↔ checklist mapping | ❌ | ✅ §6(R2 binding)|
| Rolling planning 紀律 | ❌ | ✅ §8 |
| OQ + ADR + plan changelog 同步 | ❌ | ✅ §5(R3 + R4 + R5 binding)|
| Risk Register 變更 | ❌ | ✅ §9(living doc 紀律)|
| 紅旗 spec drift surface | ❌ | ✅ §10 |

---

## §3 EKP 紀律 9 項對應 source

| # | Item | 權威 source |
|---|---|---|
| 1 | Architecture lock | `CLAUDE.md §5.1 H1` + `architecture.md §3 + §4` |
| 2 | Vendor lock | `CLAUDE.md §5.2 H2` + `architecture.md §3.2 + §14` |
| 3 | Dify reference | `CLAUDE.md §5.3 H3` + `references/REFERENCE_USAGE.md` |
| 4 | Tier 1 boundary | `CLAUDE.md §5.4 H4` + `architecture.md §11` |
| 5 | Security | `CLAUDE.md §5.5 H5` |
| 6 | Test coverage | `CLAUDE.md §5.6 H6` |
| 7 | Component spine | `docs/02-architecture/COMPONENT_CATALOG.md` + `components/Cn-*.md` |
| 8 | PROCESS.md classification | `docs/01-planning/PROCESS.md §1` |
| 9 | Karpathy baseline | `CLAUDE.md §1` + `andrej-karpathy-skills` plugin |

---

## §8 Rolling Planning 紀律對應 R1–R5 binding rules

per [`CLAUDE.md §10`](../../../CLAUDE.md) + [`PROCESS.md §5`](../../01-planning/PROCESS.md):

- **R1**:任何 multi-day implementation 之前必須有對應 phase plan.md committed
- **R2**:Daily commit 必須對應 progress.md Day-N entry(`docs(planning):` housekeeping commits 例外)
- **R3**:Plan deviation(scope change / new deliverable / 取消 deliverable)必須 log 入 plan.md changelog
- **R4**:OQ resolved → 同步更新 decision-form.md AND progress.md Day-N mention
- **R5**:Phase closeout 之前任何 architectural-adjacent decision(H1)必須寫 ADR

---

## §10 紅旗信號(EKP-specific watch list)

任何 compact 偵測到以下任一信號,**第一句就寫紅旗**:

- **「順手把 GraphRAG / multi-agent / multi-tenancy / multi-modal / auto-sync 做埋」** → Tier 2 feature 滲入 Tier 1
- **「換 vendor」**(e.g. Pinecone / OpenAI direct / Voyage swap-in unauthorized)→ H2 violation,需 ADR
- **「`cp references/dify/...` 入 EKP codebase」** → H3 violation
- **「hardcode tenant_id / subscription_id / connection string」** → H5 violation
- **「100+ 行 critical pipeline code 但無 test」** → H6 violation
- **「跳過 plan.md 直接 code」** → R1 violation
- **「同一個 file 同時改 backend/ingestion + backend/retrieval + frontend/」** → cross-component scattering risk
- **「未經 user 同意,改 architecture.md §1-§14 嘅 content」** → §4.4 forbidden file
- **「`git reset --hard` / `git push --force` / `--no-verify` 未經 explicit 授權」** → CLAUDE.md §13 violation

---

## 維護

- 同 `01-session-start.md` 配套使用(一個 session 開頭、一個 session 結尾)
- `CLAUDE.md` 大改(§5 H1–H6 / §10 R1–R5 / §1 Karpathy 範圍 / §9 Sprint Awareness gate 列表)時,§3 + §7 hard gate list 對應更新
- `PROCESS.md` 大改(加 task type / 改 classification heuristics)時,§3 #8 + §1 task type 對應更新
- `COMPONENT_CATALOG.md` 大改(加 / 改 / 刪 Cn — 目前 **13 components C01–C13**,C13 = Email Verification Service per ADR-0014 / Q22)時,§3 #7 + §10 紅旗信號對應更新
- Phase 切換(W2 → W3 → ... → W18+)時不需改本檔(內容係 Tier 1 通用),**除非** §7 hard gate list 出現新 gate
- Tier 1 完成(原 spec W12;實際 trajectory W18+ via UI sprint pivot extension)後退役 → Tier 2 對應 compact

---

**Last Updated**:2026-05-16(W18+ accumulated state housekeeping catch-up — §0 scope `W1-W12` → Tier 1 trajectory `W18+` extension footnote;§7 hard gate list 加 Tier 1 UI FINAL gate(W15 PASS WITH SMOKE-USER-DEFERRED CAVEAT)+ Production launch gate(W16+ pending Track A IT cred);§維護 `12 component` → **13 component C01-C13**(C13 = Email Verification Service per ADR-0014 / Q22);Phase switching note 加 W18+ caveat)
> **Prior**:2026-05-04(W02 D5 closeout — 配合 `01-session-start.md` 同期初版)
**Maintainer**:Chris(技術 Lead)+ AI 助手共同維護
**File location**:`docs/12-ai-assistant/01-prompts/02-compact-session.md`
**Companion**:`01-session-start.md`(每個新 session 開頭用)

---

## Update history

| Date | Phase | Updates |
|---|---|---|
| 2026-05-04 | W02 D5 closeout | 初版(基於 sample-2 結構,EKP-specific:H1-H6 / R1-R5 / 12 component / 4 task type / Tier 1 boundary 紅旗信號)|
| 2026-05-16 | post-W18 housekeeping cluster — accumulated W18+ state catch-up | §0 適用範圍 `W1-W12` → Tier 1 trajectory `W18+` extension footnote 反映 W12-W15 UI sprint cycle pivot + W17 beta hardening + W18 app shell IA;§7 §下一步 hard gate list 加 Tier 1 UI sprint cycle FINAL gate(W15 PASS WITH SMOKE-USER-DEFERRED CAVEAT)+ Production launch gate(W16+ pending Track A IT cred populate event + R-B1 closure);§維護 `COMPONENT_CATALOG.md 大改` 句 `12 component` → 13 component C01-C13(C13 = Email Verification Service per ADR-0014 / Q22 NEW);Phase 切換 example `W2 → W3` → `W2 → W3 → ... → W18+`;Tier 1 完成例子由 `W12` → `原 spec W12;實際 trajectory W18+ via UI sprint pivot extension`;Last Updated bump + Prior line preserved;同步 `CLAUDE.md` v1.3→v1.4 + `01-session-start.md` Update history backlog 2-row catch-up(2026-05-14 R8 #6 commit `d57fff9` + 2026-05-16 R8 #7 commit `dffe19a`)|
