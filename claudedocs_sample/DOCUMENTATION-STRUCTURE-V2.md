# 📚 claudedocs 文檔結構 V2.0 (流程導向)

> **創建日期**: 2025-11-08
> **設計理念**: 流程導向 + 時間序列化
> **核心優勢**: 符合開發流程自然順序,易於導航和維護

---

## 📊 新的文檔結構

```
claudedocs/
├── 1-planning/          # 📋 總體規劃 (開始階段)
│   ├── roadmap/         # 路線圖
│   ├── epics/           # Epic 詳細規劃
│   └── architecture/    # 架構設計決策
│
├── 2-sprints/           # 🏃 Sprint 執行文檔 (執行階段)
│   ├── epic-9/          # Epic 9 Sprint 文檔
│   ├── epic-10/         # Epic 10 Sprint 文檔
│   └── templates/       # Sprint 模板
│
├── 3-progress/          # 📈 進度追蹤 (持續監控)
│   ├── weekly/          # 每週進度
│   ├── daily/           # 每日日誌
│   └── milestones/      # 里程碑達成記錄
│
├── 4-changes/           # 🔄 變更記錄 (應對變化)
│   ├── bug-fixes/       # Bug 修復記錄
│   ├── feature-changes/ # 功能變更
│   └── refactoring/     # 重構記錄
│
├── 5-status/            # 📊 狀態報告 (階段總結)
│   ├── phase-reports/   # 階段報告
│   ├── testing/         # 測試報告 (E2E, Unit, Integration)
│   └── quality/         # 品質報告
│
├── 6-ai-assistant/      # 🤖 AI 助手指引 (輔助工具)
│   ├── session-guides/  # 會話指引
│   ├── prompts/         # Prompt 模板
│   ├── analysis/        # AI 分析報告
│   └── handoff/         # 交接文檔
│
├── 7-archive/           # 🗄️ 歷史歸檔 (完成後)
│   ├── epic-1-8/        # Epic 1-8 已完成文檔
│   ├── design-system/   # 設計系統遷移歸檔
│   └── mvp-phase/       # MVP 階段歸檔
│
└── README.md            # 文檔結構總覽
```

---

## 📂 各目錄詳細說明

### 1-planning/ (總體規劃)

**用途**: 存放**高層次規劃文檔**,為開發提供方向和藍圖

**子目錄結構**:
```
1-planning/
├── roadmap/
│   ├── MASTER-ROADMAP.md           # 總體路線圖 (Epic 1-10)
│   ├── MILESTONE-TIMELINE.md       # 里程碑時間線
│   └── RELEASE-PLAN.md             # 發布計劃
│
├── epics/
│   ├── epic-9/
│   │   ├── epic-9-overview.md      # Epic 9 概覽
│   │   ├── epic-9-requirements.md  # Epic 9 需求分析
│   │   ├── epic-9-architecture.md  # Epic 9 技術架構
│   │   └── epic-9-risks.md         # Epic 9 風險評估
│   │
│   └── epic-10/
│       ├── epic-10-overview.md
│       ├── epic-10-requirements.md
│       ├── epic-10-architecture.md
│       └── epic-10-risks.md
│
└── architecture/
    ├── TECH-DECISIONS.md           # 技術決策記錄 (ADR)
    ├── API-DESIGN-PRINCIPLES.md    # API 設計原則
    └── DATA-MODEL-EVOLUTION.md     # 資料模型演進
```

**關鍵文檔**:
- `MASTER-ROADMAP.md`: 整個專案的總體路線圖
- `epic-X-overview.md`: 每個 Epic 的詳細規劃
- `TECH-DECISIONS.md`: 記錄重要的技術決策 (Architecture Decision Records)

---

### 2-sprints/ (Sprint 執行文檔)

**用途**: 存放**Sprint 執行期間的詳細任務和計劃**

**子目錄結構**:
```
2-sprints/
├── epic-9/
│   ├── sprint-1/
│   │   ├── SPRINT-1-PLAN.md        # Sprint 1 計劃
│   │   ├── SPRINT-1-TASKS.md       # Sprint 1 任務分解
│   │   ├── SPRINT-1-RETRO.md       # Sprint 1 回顧
│   │   └── checklist.md            # Sprint 1 檢查清單
│   │
│   ├── sprint-2/
│   │   └── ... (同上)
│   │
│   └── epic-9-summary.md           # Epic 9 總結
│
├── epic-10/
│   └── ... (同上)
│
└── templates/
    ├── sprint-plan-template.md
    ├── sprint-tasks-template.md
    ├── sprint-retro-template.md
    └── checklist-template.md
```

**關鍵文檔**:
- `SPRINT-X-PLAN.md`: Sprint 計劃 (目標、範圍、時間表)
- `SPRINT-X-TASKS.md`: 任務分解 (Story → Task → Subtask)
- `SPRINT-X-RETRO.md`: Sprint 回顧 (完成、挑戰、改進)
- `checklist.md`: 可執行的檢查清單

---

### 3-progress/ (進度追蹤)

**用途**: 持續記錄**開發進度和狀態**

**子目錄結構**:
```
3-progress/
├── weekly/
│   ├── 2025-W45.md                 # 2025 年第 45 週進度
│   ├── 2025-W46.md
│   └── ... (按週記錄)
│
├── daily/
│   ├── 2025-11/
│   │   ├── 2025-11-08.md           # 每日開發日誌
│   │   ├── 2025-11-09.md
│   │   └── ...
│   └── 2025-12/
│       └── ...
│
└── milestones/
    ├── M1-epic-9.1-9.2-complete.md # 里程碑 1 達成記錄
    ├── M2-epic-9.3-9.4-complete.md
    └── ...
```

**關鍵文檔**:
- `weekly/2025-WXX.md`: 每週進度摘要 (完成、挑戰、下週計劃)
- `daily/2025-MM/2025-MM-DD.md`: 每日開發日誌 (詳細記錄)
- `milestones/MX-xxx-complete.md`: 里程碑達成報告

**每週進度模板**:
```markdown
# 2025-W45 每週進度 (11月4日 - 11月8日)

## 本週目標
- 完成 Story 9.1 後端開發
- 整合 Azure OpenAI Service

## 完成情況
- ✅ Azure OpenAI Service 設置完成
- ✅ RAG Pipeline 基礎框架
- ⏳ 相似專案檢索演算法 (進行中 80%)

## 遇到的挑戰
- Azure OpenAI API 調用限制問題
- Vector Database 選型決策延遲

## 下週計劃
- 完成 Story 9.1 開發
- 開始 Story 9.2 模型訓練

## 關鍵決策
- 決定使用 Pinecone 作為 Vector Database
- 採用 LangChain 框架簡化 RAG 實現
```

---

### 4-changes/ (變更記錄)

**用途**: 記錄**所有變更、修正和重構**

**子目錄結構**:
```
4-changes/
├── bug-fixes/
│   ├── FIX-001-to-FIX-080.md       # 歷史 Bug 修復總結
│   ├── FIX-081-budget-proposals.md # 單個 Bug 修復詳細記錄
│   └── ... (按 FIX-XXX 編號)
│
├── feature-changes/
│   ├── CHANGE-001-ai-suggestion-ui.md
│   ├── CHANGE-002-risk-alert-logic.md
│   └── ...
│
├── refactoring/
│   ├── REFACTOR-001-api-router-cleanup.md
│   ├── REFACTOR-002-component-optimization.md
│   └── ...
│
└── i18n/
    ├── I18N-ISSUES-LOG.md          # I18N 問題日誌
    ├── I18N-PROGRESS.md            # I18N 進度追蹤
    └── ... (所有 I18N 相關文檔)
```

**關鍵文檔**:
- `bug-fixes/FIX-XXX-xxx.md`: Bug 修復詳細記錄
- `feature-changes/CHANGE-XXX-xxx.md`: 功能變更記錄
- `refactoring/REFACTOR-XXX-xxx.md`: 重構記錄

**Bug 修復記錄模板**:
```markdown
# FIX-081: 預算提案搜尋/過濾功能

## 問題描述
Budget Proposals 頁面缺少搜尋和狀態過濾功能

## 根本原因
初始開發時未實現 List View 的通用功能

## 解決方案
1. 修改 API Router 添加 search 參數
2. 前端添加搜尋輸入框和狀態過濾下拉選單
3. 使用 useDebounce Hook 優化搜尋性能

## 影響範圍
- `packages/api/src/routers/budgetProposal.ts`
- `apps/web/src/app/[locale]/proposals/page.tsx`

## 測試驗證
- ✅ 搜尋功能正常 (標題、專案名稱)
- ✅ 狀態過濾正常 (所有狀態)
- ✅ Debounce 生效 (300ms)

## 相關 Commit
- commit: b3fa237
```

---

### 5-status/ (狀態報告)

**用途**: 階段性的**狀態總結和品質報告**

**子目錄結構**:
```
5-status/
├── phase-reports/
│   ├── MVP-PHASE-COMPLETE.md       # MVP 階段完成報告
│   ├── POST-MVP-COMPLETE.md        # Post-MVP 完成報告
│   ├── EPIC-9-COMPLETE.md          # Epic 9 完成報告 (未來)
│   └── EPIC-10-COMPLETE.md         # Epic 10 完成報告 (未來)
│
├── testing/
│   ├── e2e/
│   │   ├── E2E-WORKFLOW-TESTING-PROGRESS.md
│   │   ├── E2E-LOGIN-FIX-SUCCESS.md
│   │   └── ...
│   │
│   ├── unit/
│   │   ├── UNIT-TEST-COVERAGE-REPORT.md
│   │   └── ...
│   │
│   └── integration/
│       ├── INTEGRATION-TEST-REPORT.md
│       └── ...
│
└── quality/
    ├── CODE-QUALITY-REPORT.md      # 代碼品質報告
    ├── PERFORMANCE-REPORT.md       # 效能報告
    ├── SECURITY-AUDIT.md           # 安全審計報告
    └── ACCESSIBILITY-REPORT.md     # 無障礙性報告
```

**關鍵文檔**:
- `phase-reports/XXX-COMPLETE.md`: 階段完成報告
- `testing/e2e/xxx.md`: E2E 測試報告
- `quality/xxx-REPORT.md`: 各類品質報告

---

### 6-ai-assistant/ (AI 助手指引)

**用途**: 幫助 AI 助手**快速理解專案狀態和繼續工作**

**子目錄結構**:
```
6-ai-assistant/
├── session-guides/
│   ├── START-NEW-EPIC.md           # 開始新 Epic 的指引
│   ├── CONTINUE-DEVELOPMENT.md     # 繼續開發的指引
│   ├── DEBUG-ISSUES.md             # 調試問題的指引
│   └── CODE-REVIEW.md              # Code Review 的指引
│
├── prompts/
│   ├── epic-planning-prompt.md     # Epic 規劃 Prompt
│   ├── code-generation-prompt.md   # 代碼生成 Prompt
│   ├── testing-prompt.md           # 測試生成 Prompt
│   └── documentation-prompt.md     # 文檔生成 Prompt
│
├── analysis/
│   ├── CLAUDE-MD-ANALYSIS.md       # CLAUDE.md 分析報告
│   ├── FILE-ORGANIZATION.md        # 文件組織分析
│   └── GAP-ANALYSIS.md             # 需求差距分析
│
└── handoff/
    ├── PHASE-A-HANDOFF.md          # Phase A 交接文檔
    └── ... (階段交接文檔)
```

**關鍵文檔**:
- `session-guides/xxx.md`: AI 會話指引
- `prompts/xxx-prompt.md`: 可重用的 Prompt 模板
- `handoff/xxx-HANDOFF.md`: 階段交接文檔

**START-NEW-EPIC.md 範例**:
```markdown
# AI 助手指引: 開始新 Epic 開發

## 前置檢查
1. 閱讀 `1-planning/epics/epic-X/epic-X-overview.md`
2. 檢查 `1-planning/roadmap/MASTER-ROADMAP.md` 了解依賴關係
3. 閱讀 `6-ai-assistant/analysis/` 下的最新分析報告

## 開發流程
1. **規劃階段**:
   - 創建 `2-sprints/epic-X/sprint-1/SPRINT-1-PLAN.md`
   - 創建任務分解 `SPRINT-1-TASKS.md`
   - 創建檢查清單 `checklist.md`

2. **執行階段**:
   - 每日更新 `3-progress/daily/2025-MM-DD.md`
   - 每週更新 `3-progress/weekly/2025-WXX.md`
   - Bug 修復記錄到 `4-changes/bug-fixes/`

3. **總結階段**:
   - 完成 Sprint 回顧 `2-sprints/epic-X/sprint-1/SPRINT-1-RETRO.md`
   - 更新里程碑記錄 `3-progress/milestones/`
   - 生成階段報告 `5-status/phase-reports/`

## 參考模板
- Sprint 計劃: `2-sprints/templates/sprint-plan-template.md`
- 每週進度: `3-progress/weekly/template.md`
- Bug 修復: `4-changes/bug-fixes/template.md`
```

---

### 7-archive/ (歷史歸檔)

**用途**: 存放**已完成階段的文檔**,保持活躍目錄的整潔

**子目錄結構**:
```
7-archive/
├── epic-1-8/
│   ├── mvp-development-plan.md
│   ├── EPIC-5-MISSING-FEATURES.md
│   ├── EPIC-6-TESTING-CHECKLIST.md
│   └── EPIC-7-IMPLEMENTATION-PLAN.md
│
├── design-system/
│   ├── DESIGN-SYSTEM-MIGRATION-PLAN.md
│   ├── DESIGN-SYSTEM-MIGRATION-PROGRESS.md
│   ├── PHASE-1-DETAILED-TASKS.md
│   ├── PHASE-2-DETAILED-TASKS.md
│   ├── PHASE-3-DETAILED-TASKS.md
│   └── PHASE-4-DETAILED-TASKS.md
│
└── mvp-phase/
    ├── COMPLETE-IMPLEMENTATION-PLAN.md
    └── STAGE-3-4-IMPLEMENTATION-PLAN.md
```

**歸檔原則**:
- ✅ 對應的 Epic/Phase 已 100% 完成
- ✅ 文檔不再需要頻繁查閱
- ✅ 保留索引引用以便未來查閱

---

## 📋 文檔命名規範

### 通用規則
- 使用 **UPPERCASE** 命名重要的總覽文檔 (如 MASTER-ROADMAP.md)
- 使用 **kebab-case** 命名詳細文檔 (如 epic-9-overview.md)
- 使用 **有意義的前綴** (如 FIX-XXX, CHANGE-XXX, REFACTOR-XXX)
- 包含 **日期** 的文檔使用 ISO 格式 (2025-11-08.md, 2025-W45.md)

### 各類文檔命名
```bash
# 規劃文檔
MASTER-ROADMAP.md
epic-9-overview.md
epic-9-requirements.md

# Sprint 文檔
SPRINT-1-PLAN.md
SPRINT-1-TASKS.md
SPRINT-1-RETRO.md

# 進度追蹤
2025-W45.md  (週報)
2025-11-08.md  (日報)

# 變更記錄
FIX-081-budget-proposals.md
CHANGE-001-ai-suggestion-ui.md
REFACTOR-001-api-router-cleanup.md

# 狀態報告
MVP-PHASE-COMPLETE.md
E2E-WORKFLOW-TESTING-PROGRESS.md
```

---

## 🔄 文檔生命週期

### 創建 → 維護 → 歸檔

```
1. 創建階段:
   - 規劃文檔: 1-planning/
   - Sprint 文檔: 2-sprints/

2. 活躍維護:
   - 進度追蹤: 3-progress/ (每日/每週更新)
   - 變更記錄: 4-changes/ (持續新增)

3. 階段總結:
   - 狀態報告: 5-status/ (Sprint/Phase 結束時)

4. 歸檔:
   - 已完成文檔: 7-archive/ (Epic/Phase 完成後)
```

---

## 🎯 快速導航指南

### 我想了解...

| 需求 | 查看目錄 |
|------|---------|
| **專案總體規劃** | `1-planning/roadmap/MASTER-ROADMAP.md` |
| **Epic 9 詳細規劃** | `1-planning/epics/epic-9/` |
| **當前 Sprint 任務** | `2-sprints/epic-X/sprint-X/` |
| **本週開發進度** | `3-progress/weekly/2025-WXX.md` |
| **最近的 Bug 修復** | `4-changes/bug-fixes/` |
| **測試報告** | `5-status/testing/` |
| **如何開始新 Epic** | `6-ai-assistant/session-guides/START-NEW-EPIC.md` |
| **已完成的文檔** | `7-archive/` |

---

## 📊 與舊結構的對應關係

### 文件遷移映射

| 舊位置 | 新位置 | 說明 |
|-------|-------|------|
| `planning/` | `1-planning/` + `7-archive/epic-1-8/` | 分離活躍規劃和已完成規劃 |
| `progress/` | `3-progress/` | 重組為 weekly/ 和 daily/ |
| `bug-fixes/` | `4-changes/bug-fixes/` | 保持不變,納入變更記錄 |
| `e2e-testing/` | `5-status/testing/e2e/` | 歸類為狀態報告 |
| `design-system/` | `7-archive/design-system/` | 已完成,歸檔 |
| `implementation/` | `7-archive/design-system/` | 已完成,歸檔 |
| `analysis/` | `6-ai-assistant/analysis/` | AI 分析報告 |
| `handoff/` | `6-ai-assistant/handoff/` | 交接文檔 |
| 根目錄 I18N 文檔 | `4-changes/i18n/` | 納入變更記錄 |

---

## ✅ 優勢總結

### 1. 流程清晰
- 數字編號體現開發流程: 規劃 → 執行 → 追蹤 → 變更 → 總結 → 輔助 → 歸檔
- 新開發者和 AI 助手可以快速理解當前階段

### 2. 易於維護
- 每個階段的文檔職責明確
- 歸檔策略清晰,避免文檔膨脹

### 3. AI 友善
- `6-ai-assistant/` 集中了所有 AI 輔助文檔
- Session guides 幫助 AI 快速上手
- Prompts 模板提高一致性

### 4. 擴展性強
- 新增階段可以插入數字編號
- 子目錄結構靈活可調整

### 5. 時間序列化
- `3-progress/` 按時間組織,便於追蹤歷史
- 里程碑記錄清晰標記重要節點

---

**維護者**: AI 助手 + 開發團隊
**版本**: V2.0 (流程導向)
**狀態**: 📝 待確認和實施
