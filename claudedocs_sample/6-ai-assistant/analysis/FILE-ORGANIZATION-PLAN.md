# 文件整理計劃

**日期**: 2025-11-01
**目的**: 重新整理專案文檔結構，確保所有文件分類合理

---

## 📋 當前狀況分析

### 根目錄文件 (14 個 MD)
```
./AI-ASSISTANT-GUIDE.md          ✅ 保留 - AI 助手核心導航
./CLAUDE.md                      ✅ 保留 - Claude Code 配置
./COMPLETE-IMPLEMENTATION-PROGRESS.md  ❌ 應移動 - 實施進度追蹤
./CONTRIBUTING.md                ✅ 保留 - 貢獻指南
./DEVELOPMENT-LOG.md             ✅ 保留 - 開發日誌（重要索引）
./DEVELOPMENT-SETUP.md           ✅ 保留 - 環境設置指南
./FIXLOG.md                      ✅ 保留 - Bug 修復日誌（重要索引）
./INDEX-MAINTENANCE-GUIDE.md     ✅ 保留 - 索引維護指南
./mvp-development-plan.md        ❌ 應移動 - MVP 計劃
./mvp-implementation-checklist.md ❌ 應移動 - MVP 檢查清單
./PHASE-A-HANDOFF.md             ❌ 應移動 - 階段交接文檔
./PROJECT-INDEX.md               ✅ 保留 - 項目索引（核心）
./QUICK-START.md                 ✅ 保留 - 快速開始指南
./README.md                      ✅ 保留 - 項目介紹
```

**根目錄應保留**（9 個核心文件）:
- AI-ASSISTANT-GUIDE.md - AI 導航核心
- CLAUDE.md - Claude Code 配置
- CONTRIBUTING.md - 開源貢獻指南
- DEVELOPMENT-LOG.md - 開發日誌索引
- DEVELOPMENT-SETUP.md - 環境設置
- FIXLOG.md - Bug 修復索引
- INDEX-MAINTENANCE-GUIDE.md - 索引維護
- PROJECT-INDEX.md - 項目文件索引
- QUICK-START.md - 快速開始
- README.md - 項目介紹

**應移動到 /claudedocs**（4 個）:
- COMPLETE-IMPLEMENTATION-PROGRESS.md → claudedocs/progress/
- mvp-development-plan.md → claudedocs/planning/
- mvp-implementation-checklist.md → claudedocs/planning/
- PHASE-A-HANDOFF.md → claudedocs/planning/

---

## 📁 /claudedocs 目錄重組方案

### 建議子目錄結構

```
claudedocs/
├── README.md                           ✅ 保留 - 目錄說明
│
├── bug-fixes/                          📁 新建 - Bug 修復文檔
│   ├── BUG-FIX-SUMMARY.md
│   ├── BUG-FIX-ROUND-2-SUMMARY.md
│   ├── BUG-FIX-ROUND-3-SUMMARY.md
│   ├── BUG-FIX-PROGRESS-REPORT.md
│   ├── TOAST-MIGRATION-GUIDE.md
│   ├── FIX-009-ROOT-CAUSE-ANALYSIS.md
│   ├── FIX-009-V5-UPGRADE-PROGRESS.md
│   ├── FIX-009-NEXTAUTH-V5-UPGRADE-COMPLETE.md
│   ├── FIX-009-CURRENT-STATUS.md
│   ├── FIX-PURCHASE-ORDER-FORM-2025-10-27.md
│   └── ISSUE-ExpensesPage-HotReload.md
│
├── e2e-testing/                        📁 新建 - E2E 測試文檔
│   ├── E2E-TESTING-SETUP-GUIDE.md
│   ├── E2E-TESTING-ENHANCEMENT-PLAN.md
│   ├── E2E-TESTING-FINAL-REPORT.md
│   ├── E2E-TEST-FAILURE-ANALYSIS.md
│   ├── E2E-WORKFLOW-TESTING-PROGRESS.md
│   ├── E2E-WORKFLOW-TESTING-PROGRESS-UPDATE.md
│   ├── E2E-WORKFLOW-SESSION-SUMMARY.md
│   ├── E2E-WORKFLOW-SESSION-SUMMARY-2025-11-01.md
│   ├── E2E-BUDGET-PROPOSAL-WORKFLOW-SUCCESS.md
│   ├── E2E-PROCUREMENT-WORKFLOW-SESSION-PROGRESS.md
│   ├── E2E-LOGIN-ISSUE-ANALYSIS.md
│   └── E2E-LOGIN-FIX-SUCCESS-SUMMARY.md
│
├── planning/                           📁 新建 - 規劃文檔
│   ├── COMPLETE-IMPLEMENTATION-PLAN.md
│   ├── STAGE-3-4-IMPLEMENTATION-PLAN.md
│   ├── mvp-development-plan.md         (從根目錄移入)
│   └── mvp-implementation-checklist.md (從根目錄移入)
│
├── progress/                           📁 新建 - 進度追蹤
│   ├── COMPLETE-IMPLEMENTATION-PROGRESS.md (從根目錄移入)
│   └── TASK-COMPLETION-REPORT-2025-10-27.md
│
├── analysis/                           📁 新建 - 分析文檔
│   ├── REQUIREMENT-GAP-ANALYSIS.md
│   └── UI-SCHEMA-GAP-ANALYSIS.md
│
└── handoff/                            📁 新建 - 交接文檔
    └── PHASE-A-HANDOFF.md              (從根目錄移入)
```

---

## 📁 /docs 目錄檢查

當前結構：
```
docs/
├── brief.md                            ✅ 保留 - 項目簡介
├── front-end-spec.md                   ✅ 保留 - 前端規範
├── design-system/                      ✅ 保留 - 設計系統
├── development/                        ✅ 保留 - 開發指南
├── fullstack-architecture/             ✅ 保留 - 架構文檔
├── implementation/                     ✅ 保留 - 實施指南
├── infrastructure/                     ✅ 保留 - 基礎設施
├── prd/                                ✅ 保留 - 產品需求
└── stories/                            ✅ 保留 - 用戶故事
```

**評估**: /docs 目錄結構良好，無需調整

---

## 🔄 執行計劃

### Phase 1: 創建 claudedocs 子目錄
1. `mkdir claudedocs/bug-fixes`
2. `mkdir claudedocs/e2e-testing`
3. `mkdir claudedocs/planning`
4. `mkdir claudedocs/progress`
5. `mkdir claudedocs/analysis`
6. `mkdir claudedocs/handoff`

### Phase 2: 移動文件

**從 claudedocs 根目錄移動到子目錄**:
```bash
# Bug 修復文檔 (11 個)
mv claudedocs/BUG-FIX-*.md claudedocs/bug-fixes/
mv claudedocs/TOAST-MIGRATION-GUIDE.md claudedocs/bug-fixes/
mv claudedocs/FIX-*.md claudedocs/bug-fixes/
mv claudedocs/ISSUE-*.md claudedocs/bug-fixes/

# E2E 測試文檔 (12 個)
mv claudedocs/E2E-*.md claudedocs/e2e-testing/

# 規劃文檔 (2 個)
mv claudedocs/COMPLETE-IMPLEMENTATION-PLAN.md claudedocs/planning/
mv claudedocs/STAGE-3-4-IMPLEMENTATION-PLAN.md claudedocs/planning/

# 進度追蹤 (1 個)
mv claudedocs/TASK-COMPLETION-REPORT-2025-10-27.md claudedocs/progress/

# 分析文檔 (2 個)
mv claudedocs/REQUIREMENT-GAP-ANALYSIS.md claudedocs/analysis/
mv claudedocs/UI-SCHEMA-GAP-ANALYSIS.md claudedocs/analysis/
```

**從根目錄移動到 claudedocs**:
```bash
# 進度追蹤
mv COMPLETE-IMPLEMENTATION-PROGRESS.md claudedocs/progress/

# 規劃文檔
mv mvp-development-plan.md claudedocs/planning/
mv mvp-implementation-checklist.md claudedocs/planning/

# 交接文檔
mv PHASE-A-HANDOFF.md claudedocs/handoff/
```

### Phase 3: 更新引用

需要更新以下文件中的路徑引用：
1. PROJECT-INDEX.md
2. AI-ASSISTANT-GUIDE.md
3. claudedocs/README.md
4. 任何引用這些文件的其他文檔

### Phase 4: 提交到 Git
```bash
git add .
git commit -m "docs: 重組文檔結構 - 創建分類子目錄"
git push origin main
```

---

## 📊 整理後統計

### 根目錄 (10 個核心文件)
- AI-ASSISTANT-GUIDE.md
- CLAUDE.md
- CONTRIBUTING.md
- DEVELOPMENT-LOG.md
- DEVELOPMENT-SETUP.md
- FIXLOG.md
- INDEX-MAINTENANCE-GUIDE.md
- PROJECT-INDEX.md
- QUICK-START.md
- README.md

### claudedocs (6 個子目錄)
- bug-fixes/ - 11 個文件
- e2e-testing/ - 12 個文件
- planning/ - 4 個文件
- progress/ - 2 個文件
- analysis/ - 2 個文件
- handoff/ - 1 個文件
- README.md

### docs (維持現狀)
- 9 個子目錄，結構良好

---

**最後更新**: 2025-11-01
**維護者**: AI Assistant (Claude Code)
