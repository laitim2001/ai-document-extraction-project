# ClaudeDocs - AI 助手文檔目錄

> **相關規則**: 請參閱 `.claude/rules/documentation.md` 獲取文檔撰寫的完整規範

## 📋 目錄用途

此目錄是 AI 助手（Claude）與開發團隊協作產出的項目文檔中心，採用結構化的 6 層分類方式組織，涵蓋從規劃、開發到維運的完整生命週期文檔。這些文檔用於：

- **項目規劃**: FEAT 功能規劃、Epic 架構設計、路線圖
- **進度追蹤**: 每日/每週進度報告、Sprint 計劃
- **變更管理**: Bug 修復記錄 (FIX-*)、功能變更 (CHANGE-*)
- **AI 協作**: 情境提示詞、工作流程指南、分析報告
- **知識傳承**: 開發經驗、故障排查、部署指南

---

## 🏗️ 目錄結構詳解

```
claudedocs/
├── 1-planning/                  # 規劃文檔 (80+ 檔案)
│   ├── architecture/            # 架構設計文檔
│   │   ├── COMPLETE-IMPLEMENTATION-PLAN.md
│   │   ├── GIT-WORKFLOW-AND-BRANCHING-STRATEGY.md
│   │   └── POC-VALIDATION-EXECUTION-PLAN.md
│   ├── epics/                   # Epic 規劃
│   │   └── epic-9/              # Epic 9 AI 助手規劃
│   │       ├── epic-9-architecture.md
│   │       ├── epic-9-overview.md
│   │       ├── epic-9-requirements.md
│   │       └── epic-9-risks.md
│   ├── features/                # Feature 規劃 (FEAT-001 ~ FEAT-012)
│   │   ├── FEAT-001-project-fields-enhancement/
│   │   ├── FEAT-002-currency-system-expansion/
│   │   ├── FEAT-003-om-summary-page/
│   │   ├── FEAT-004-operating-company-management/
│   │   ├── FEAT-005-om-expense-category-management/
│   │   ├── FEAT-006-project-summary-tab/
│   │   ├── FEAT-007-om-expense-header-detail-refactoring/
│   │   ├── FEAT-008-om-expense-data-import/
│   │   ├── FEAT-009-opco-data-permission/
│   │   ├── FEAT-010-project-data-import/
│   │   ├── FEAT-011-permission-management/
│   │   ├── FEAT-012-unified-loading-system/
│   │   ├── AZURE-DEPLOY-PREP/   # 部署準備文檔
│   │   └── CHANGE-025-*, CHANGE-026-*  # 跨功能變更
│   └── roadmap/                 # 產品路線圖
│       └── MASTER-ROADMAP.md
│
├── 2-sprints/                   # Sprint 文檔
│   └── testing-validation/      # 測試驗證記錄
│       ├── all-issues-summary.md
│       ├── P3-ISSUES-REVIEW-REPORT.md
│       ├── sprint-plan.md
│       ├── test-report-budget-pool.md
│       ├── test-report-budget-proposals.md
│       ├── test-report-charge-outs.md
│       ├── test-report-project-management.md
│       ├── test-report-quotes-pos-expenses.md
│       └── test-report-vendors.md
│
├── 3-progress/                  # 進度追蹤
│   ├── daily/                   # 每日進度
│   │   └── 2025-11/
│   │       ├── 2025-11-13.md
│   │       └── 2025-11-14-progress-summary.md
│   └── weekly/                  # 每週進度報告
│       ├── 2025-W45.md
│       ├── 2025-W46.md
│       ├── 2025-W47.md
│       ├── 2025-W48.md
│       └── 2025-W50.md          # 當前週報
│
├── 4-changes/                   # 變更記錄
│   ├── bug-fixes/               # Bug 修復記錄 (FIX-*)
│   │   ├── BUG-FIX-SUMMARY.md
│   │   ├── BUG-FIX-PROGRESS-REPORT.md
│   │   ├── BUG-FIX-ROUND-2-SUMMARY.md
│   │   ├── BUG-FIX-ROUND-3-SUMMARY.md
│   │   ├── FIX-009-*.md         # NextAuth V5 升級
│   │   ├── FIX-059-*.md ~ FIX-095-*.md  # I18N 和 API 修復
│   │   └── TOAST-MIGRATION-GUIDE.md
│   ├── feature-changes/         # 功能變更記錄 (CHANGE-001 ~ CHANGE-032)
│   │   ├── CHANGE-001-omexpense-source-tracking.md
│   │   ├── CHANGE-002-expenseitem-chargeout-target.md
│   │   ├── CHANGE-003-unified-expense-category.md
│   │   ├── ... (CHANGE-004 ~ CHANGE-031)
│   │   └── CHANGE-032-user-password-management.md
│   └── i18n/                    # 國際化變更
│       ├── I18N-IMPLEMENTATION-PLAN.md
│       ├── I18N-TRANSLATION-KEY-GUIDE.md
│       ├── I18N-QUICK-START-GUIDE.md
│       └── ... (15+ I18N 相關文檔)
│
├── 5-status/                    # 狀態報告
│   └── testing/
│       └── e2e/                 # E2E 測試文檔
│           ├── E2E-TESTING-SETUP-GUIDE.md
│           ├── E2E-TESTING-FINAL-REPORT.md
│           ├── E2E-LOGIN-FIX-SUCCESS-SUMMARY.md
│           ├── E2E-BUDGET-PROPOSAL-WORKFLOW-SUCCESS.md
│           └── E2E-PROCUREMENT-WORKFLOW-SESSION-PROGRESS.md
│
├── 6-ai-assistant/              # AI 助手相關
│   ├── analysis/                # 分析報告
│   │   ├── CLAUDE-MD-ANALYSIS-REPORT.md
│   │   ├── FILE-ORGANIZATION-PLAN.md
│   │   ├── REQUIREMENT-GAP-ANALYSIS.md
│   │   ├── UI-SCHEMA-GAP-ANALYSIS.md
│   │   └── SURGICAL-AGENT-CASCADING-FAILURES-ANALYSIS.md
│   ├── handoff/                 # 交接文檔
│   │   └── PHASE-A-HANDOFF.md
│   ├── jsdoc-migration/         # JSDoc 遷移文檔
│   │   ├── README.md
│   │   ├── JSDOC-MIGRATION-MASTER-PLAN.md
│   │   ├── JSDOC-MIGRATION-PROGRESS.md
│   │   ├── JSDOC-TEMPLATES.md
│   │   ├── JSDOC-ACCURACY-VALIDATION-REPORT.md
│   │   └── JSDOC-FINAL-VERIFICATION-REPORT.md
│   ├── prompts/                 # 情境提示詞 (SITUATION-*)
│   │   ├── SITUATION-1-PROJECT-ONBOARDING.md
│   │   ├── SITUATION-2-FEATURE-DEV-PREP.md
│   │   ├── SITUATION-3-FEATURE-ENHANCEMENT.md
│   │   ├── SITUATION-4-NEW-FEATURE-DEV.md
│   │   ├── SITUATION-5-SAVE-PROGRESS.md
│   │   ├── SITUATION-6-AZURE-DEPLOY-PERSONAL.md
│   │   ├── SITUATION-7-AZURE-DEPLOY-COMPANY.md
│   │   ├── SITUATION-8-AZURE-TROUBLESHOOT-PERSONAL.md
│   │   ├── SITUATION-9-AZURE-TROUBLESHOOT-COMPANY.md
│   │   └── SITUATION-10-SCHEMA-SYNC-COMPANY.md
│   └── session-guides/          # 會話指南
│       ├── START-NEW-EPIC.md
│       ├── CONTINUE-DEVELOPMENT.md
│       └── DEBUG-ISSUES.md
│
├── CLAUDE.md                    # 本文件 - 目錄索引
├── COMPANY-AZURE-DEPLOYMENT-LOG.md  # 公司環境部署日誌
└── SCHEMA-SYNC-MECHANISM.md     # Schema 同步機制說明
```

---

## 📝 文檔命名約定

### Feature 規劃 (FEAT-*)
```
claudedocs/1-planning/features/
├── FEAT-{NNN}-{feature-name}/
│   ├── 01-requirements.md           # 需求規格
│   ├── 02-technical-design.md       # 技術設計
│   ├── 03-implementation-plan.md    # 實施計劃
│   ├── 04-progress.md               # 進度追蹤
│   └── 05-enhancements.md           # 後續改進 (選用)
```

**FEAT 編號**: 連續三位數 (FEAT-001 ~ FEAT-012+)

**標準 FEAT 文檔內容結構**:
```markdown
# FEAT-{NNN}: {Feature Name}

> **建立日期**: YYYY-MM-DD
> **最後更新**: YYYY-MM-DD
> **狀態**: 📋 設計中 | 🚧 進行中 | ✅ 已完成
> **優先級**: High | Medium | Low
> **前置依賴**: {相關 FEAT 編號}

## 1. 功能概述
## 2. 功能需求
## 3. UI/UX 設計
## 4. 驗收標準
## 5. 相關文檔
```

### 功能變更 (CHANGE-*)
```
claudedocs/4-changes/feature-changes/
└── CHANGE-{NNN}-{description}.md    # 單一文件格式
```

**CHANGE 編號**: 連續三位數 (CHANGE-001 ~ CHANGE-032+)

**標準 CHANGE 文檔內容結構**:
```markdown
# CHANGE-{NNN}: {Change Title}

> **建立日期**: YYYY-MM-DD
> **完成日期**: YYYY-MM-DD
> **狀態**: ✅ 已完成 | 🚧 進行中
> **優先級**: High | Medium | Low
> **類型**: 現有功能增強 | Bug 修復 | UI 改進

## 1. 變更概述
## 2. 功能需求
## 3. 技術設計
## 4. 影響範圍
## 5. 驗收標準
## 6. 實施計劃
## 7. 相關文檔
```

### Bug 修復 (FIX-*)
```
claudedocs/4-changes/bug-fixes/
└── FIX-{NNN}-{description}.md       # 單一文件格式
```

**FIX 編號**: 連續三位數 (FIX-001 ~ FIX-095+)

**標準 FIX 文檔內容結構**:
```markdown
# FIX-{NNN}: {Bug Description}

## 問題描述
## 重現步驟
## 根本原因
## 解決方案
## 修改的檔案
## 測試驗證
```

### 進度報告
```
claudedocs/3-progress/
├── daily/{YYYY}-{MM}/{YYYY}-{MM}-{DD}.md       # 日報
└── weekly/{YYYY}-W{WW}.md                       # 週報
```

**週報標準結構**:
```markdown
# {YYYY}-W{WW} 每週進度 ({月日} - {月日})

## 本週目標
## 完成情況
### 已完成
### 進行中
### 未開始
## 遇到的挑戰
## 技術決策
## 下週計劃
## 風險提示
## 統計數據
## 文件變更清單
```

### 情境提示詞 (SITUATION-*)
```
claudedocs/6-ai-assistant/prompts/
└── SITUATION-{N}-{DESCRIPTION}.md
```

**SITUATION 編號**: 連續數字 (SITUATION-1 ~ SITUATION-10)

**SITUATION 文檔結構**:
```markdown
# SITUATION-{N}: {Title}

**用途**: {觸發條件和使用情境}
**目標環境**: {適用環境說明}
**觸發情境**:
  - {情境 1}
  - {情境 2}

## 📋 快速開始檢查清單
## 🚀 執行流程
## ⚠️ 關鍵提醒
## 📁 相關檔案參考
## ✅ 完成檢查清單
```

---

## 📊 文檔統計 (2025-12-16)

| 類別 | 數量 | 說明 |
|------|------|------|
| **1-planning** | 80+ | FEAT-001~012 (每個 4 文件) + 架構 + 部署準備 |
| **2-sprints** | 10+ | 測試報告和 Sprint 計劃 |
| **3-progress** | 10+ | 週報和日報 |
| **4-changes/bug-fixes** | 40+ | FIX-009~095+ |
| **4-changes/feature-changes** | 28 | CHANGE-001~032 |
| **4-changes/i18n** | 15+ | I18N 實施和遷移文檔 |
| **5-status/testing** | 10+ | E2E 測試文檔 |
| **6-ai-assistant** | 25+ | 分析、提示詞、指南 |
| **根目錄文檔** | 3 | CLAUDE.md, Schema 同步, 部署日誌 |
| **總計** | **220+** | |

---

## 🔍 重要文檔索引

### 當前活躍功能

| 文檔路徑 | 狀態 | 說明 |
|----------|------|------|
| `1-planning/features/FEAT-006-*` | ⏸️ 待開發 | Project Summary Tab |
| `4-changes/feature-changes/CHANGE-028-*` | ✅ | OM Summary 預設 FY 改進 |
| `4-changes/feature-changes/CHANGE-029-*` | ✅ | Budget Category Stats Admin Only |
| `4-changes/feature-changes/CHANGE-030-*` | ✅ | OM Summary 搜尋功能 |
| `4-changes/feature-changes/CHANGE-031-*` | ✅ | OM Summary 詳細列表重構 |
| `4-changes/feature-changes/CHANGE-032-*` | ✅ | 用戶密碼管理功能 |
| `1-planning/features/FEAT-012-*` | ✅ | 統一載入特效系統 |

### 已完成里程碑

| 文檔路徑 | 完成日期 | 說明 |
|----------|----------|------|
| `1-planning/features/FEAT-007-*` | 2025-12-05 | OM Expense 表頭-明細架構重構 |
| `1-planning/features/FEAT-008-*` | 2025-12-10 | OM Expense 數據導入 (Data Import) |
| `1-planning/features/FEAT-009-*` | 2025-12-12 | Operating Company 數據權限管理 |
| `1-planning/features/FEAT-010-*` | 2025-12-13 | Project 數據導入 |
| `1-planning/features/FEAT-011-*` | 2025-12-14 | Permission Management (Sidebar 權限) |

### Azure 部署相關

| 文檔路徑 | 用途 |
|----------|------|
| `6-ai-assistant/prompts/SITUATION-6-*` | 個人環境部署指引 |
| `6-ai-assistant/prompts/SITUATION-7-*` | 公司環境部署指引 (推薦) |
| `6-ai-assistant/prompts/SITUATION-8-*` | 個人環境故障排查 |
| `6-ai-assistant/prompts/SITUATION-9-*` | 公司環境故障排查 |
| `6-ai-assistant/prompts/SITUATION-10-*` | Schema 同步問題處理 |
| `COMPANY-AZURE-DEPLOYMENT-LOG.md` | 公司環境部署歷史日誌 |
| `SCHEMA-SYNC-MECHANISM.md` | Schema 同步機制說明 |

### 國際化 (I18N)

| 文檔路徑 | 用途 |
|----------|------|
| `4-changes/i18n/I18N-TRANSLATION-KEY-GUIDE.md` | 翻譯鍵命名指南 |
| `4-changes/i18n/I18N-QUICK-START-GUIDE.md` | I18N 快速入門 |
| `4-changes/i18n/I18N-IMPLEMENTATION-PLAN.md` | 實施計劃 |
| `4-changes/i18n/I18N-ISSUES-LOG.md` | 問題追蹤記錄 |

### AI 助手工作流程

| 文檔路徑 | 用途 |
|----------|------|
| `6-ai-assistant/prompts/SITUATION-1-*` | 項目入門 |
| `6-ai-assistant/prompts/SITUATION-2-*` | Feature 開發準備 |
| `6-ai-assistant/prompts/SITUATION-3-*` | Feature 增強 |
| `6-ai-assistant/prompts/SITUATION-4-*` | 新功能開發 |
| `6-ai-assistant/prompts/SITUATION-5-*` | 保存進度 |
| `6-ai-assistant/session-guides/START-NEW-EPIC.md` | 開始新 Epic |
| `6-ai-assistant/session-guides/CONTINUE-DEVELOPMENT.md` | 繼續開發 |
| `6-ai-assistant/session-guides/DEBUG-ISSUES.md` | 除錯指南 |

---

## 🛠️ 使用指南

### 查找文檔

| 需求 | 路徑 |
|------|------|
| 功能規劃 | `1-planning/features/FEAT-{NNN}-*` |
| 功能變更 | `4-changes/feature-changes/CHANGE-{NNN}-*` |
| Bug 修復 | `4-changes/bug-fixes/FIX-{NNN}-*` |
| 週報 | `3-progress/weekly/` |
| 測試報告 | `2-sprints/testing-validation/` |
| E2E 測試 | `5-status/testing/e2e/` |
| AI 工作流程 | `6-ai-assistant/prompts/` |
| 部署指南 | `6-ai-assistant/prompts/SITUATION-6/7-*` |
| I18N 文檔 | `4-changes/i18n/` |

### 創建新文檔

1. **確定文檔類型和目錄**
   - 新功能 → `1-planning/features/FEAT-{NNN}-*/`
   - 功能變更 → `4-changes/feature-changes/`
   - Bug 修復 → `4-changes/bug-fixes/`
   - 進度報告 → `3-progress/`

2. **使用正確的命名約定**
   - FEAT: 下一個可用編號 (目前到 FEAT-012)
   - CHANGE: 下一個可用編號 (目前到 CHANGE-032)
   - FIX: 下一個可用編號 (目前到 FIX-095+)

3. **遵循格式範本**
   - 參考現有同類文檔的結構
   - 包含必要的 frontmatter (建立日期、狀態、優先級)
   - 使用一致的章節標題

4. **更新相關索引**
   - 更新 `PROJECT-INDEX.md`
   - 更新當週週報 (`3-progress/weekly/`)
   - 更新本文件 (`claudedocs/CLAUDE.md`) 如有新類別

### 維護文檔

1. **狀態更新**
   - 📋 設計中 → 🚧 進行中 → ✅ 已完成
   - 更新「最後更新」日期

2. **版本控制**
   - 重大更新添加版本號和更新記錄
   - 例如: `**版本**: 2.2.0 **最後更新**: 2025-12-15`

3. **文檔歸檔**
   - 已過時文檔保留但標記為 `[已過時]`
   - 或移至 `archive/` 子目錄 (如需要)

---

## ⚠️ 重要約定

1. **命名一致性**
   - 使用 UPPERCASE-WITH-DASHES 格式
   - 編號使用三位數 (001, 002, ...)
   - 描述使用簡短英文 kebab-case

2. **語言規範**
   - 文檔標題和結構: 中文或英文皆可
   - 內容: 繁體中文為主
   - 代碼片段: 英文
   - 日期格式: YYYY-MM-DD

3. **狀態標記**
   - ✅ 已完成
   - 🚧 進行中
   - ⏸️ 暫停/待開發
   - ❌ 已取消
   - ⚠️ 有風險/需注意

4. **禁止事項**
   - ❌ 在錯誤目錄創建文檔
   - ❌ 使用不一致的命名格式
   - ❌ 遺漏必要的 frontmatter
   - ❌ 跳過編號或使用重複編號
   - ❌ 留下未更新的過時內容

---

## 📚 相關文件

### 項目級文檔
- `CLAUDE.md` - 根目錄專案總指南
- `AI-ASSISTANT-GUIDE.md` - AI 助手快速參考
- `PROJECT-INDEX.md` - 完整文件索引 (250+ 檔案)
- `DEVELOPMENT-LOG.md` - 開發歷史日誌
- `FIXLOG.md` - Bug 修復記錄

### 規則文件
- `.claude/rules/documentation.md` - 文檔撰寫規範
- `.claude/rules/i18n.md` - 國際化規範

### 代碼文檔
- `packages/api/src/routers/health.ts` - Health API 診斷端點
- `packages/api/src/lib/schemaDefinition.ts` - Schema 定義 (唯一真相來源)

---

**維護者**: AI 助手 + 開發團隊
**最後更新**: 2025-12-18
**文檔版本**: 2.0.0
