# 📊 MD 文件整理報告與分類建議

> **生成日期**: 2025-10-16
> **目的**: 分析項目中所有 MD 文件的目的、用途和組織結構，提供優化建議
> **總文件數**: 313 個 MD 文件

---

## 📋 執行摘要

### 🔍 發現的問題
1. **文件數量過多**: 313 個 MD 文件分散在多個目錄中
2. **臨時文件**: 存在少量臨時文件需要清理（temp_epic1_log.md, nul）
3. **第三方框架文件**: `.bmad-*` 和 `.claude/` 目錄包含大量非項目文件（已在索引中排除）
4. **文檔組織**: 部分 Epic 記錄文件可以歸檔到 claudedocs/ 目錄

### ✅ 核心建議
1. **清理臨時文件**: 刪除 2 個臨時文件（temp_epic1_log.md, nul）
2. **保留 `Sample-Docs/` 目錄**: 作為範例文檔庫保留，不影響索引系統
3. **歸檔 Epic 記錄**: 將 EPIC1-RECORD.md 和 EPIC2-RECORD.md 移到 claudedocs/ 目錄
4. **優化研究文檔**: 將研究文檔移到 docs/research/ 子目錄歸檔

---

## 📂 MD 文件分類統計

### 1️⃣ 核心項目文檔（約 80 個文件）

#### **A. 索引與導航系統文檔** ✅ 重要性：極高
| 文件名稱 | 路徑 | 用途 | 狀態 | 建議 |
|---------|------|------|------|------|
| `AI-ASSISTANT-GUIDE.md` | 根目錄 | AI 助手工作流程和快速參考 | ✅ 核心 | 保留 |
| `PROJECT-INDEX.md` | 根目錄 | 完整項目文件索引 | ✅ 核心 | 保留 |
| `INDEX-MAINTENANCE-GUIDE.md` | 根目錄 | 索引維護指南 | ✅ 核心 | 保留 |
| `DEVELOPMENT-LOG.md` | 根目錄 | 開發記錄（倒序） | ✅ 核心 | 保留 |
| `FIXLOG.md` | 根目錄 | 問題修復記錄 | ✅ 核心 | 保留 |
| `NAVIGATION-SYSTEM-GUIDE.md` | 根目錄 | 導航系統使用指南 | 🟡 輔助 | 可與 INDEX-MAINTENANCE-GUIDE 合併 |

**建議**: 保留所有索引核心文檔，考慮將 `NAVIGATION-SYSTEM-GUIDE.md` 整合到 `INDEX-MAINTENANCE-GUIDE.md`。

---

#### **B. 項目總覽與設置文檔** ✅ 重要性：極高
| 文件名稱 | 路徑 | 用途 | 狀態 | 建議 |
|---------|------|------|------|------|
| `README.md` | 根目錄 | 項目總覽和快速開始 | ✅ 核心 | 保留 |
| `CLAUDE.md` | 根目錄 | Claude Code AI 使用規則 | ✅ 核心 | 保留 |
| `SETUP-COMPLETE.md` | 根目錄 | 環境設置完成指南 | ✅ 核心 | 保留 |
| `CONTRIBUTING.md` | 根目錄 | 貢獻指南 | ✅ 核心 | 保留 |
| `mvp-development-plan.md` | 根目錄 | MVP 開發路線圖 | ✅ 核心 | 保留 |
| `mvp-implementation-checklist.md` | 根目錄 | MVP 實施檢查清單 | ✅ 核心 | 保留 |
| `INSTALL-COMMANDS.md` | 根目錄 | 安裝命令快速參考 | 🟢 輔助 | 保留 |

**建議**: 全部保留，這些是項目的入口文檔。

---

#### **C. 設計系統文檔** ✅ 重要性：極高
| 文件名稱 | 路徑 | 用途 | 狀態 | 建議 |
|---------|------|------|------|------|
| `DESIGN-SYSTEM-GUIDE.md` | 根目錄 | 設計系統快速指南 | ✅ 核心 | 保留 |
| `docs/README-DESIGN-SYSTEM.md` | docs/ | 設計系統文檔導航 | ✅ 核心 | 保留 |
| `docs/ui-ux-redesign.md` | docs/ | 完整設計規範 | ✅ 核心 | 保留 |
| `docs/design-system-migration-plan.md` | docs/ | 遷移策略 | ✅ 核心 | 保留 |
| `docs/IMPLEMENTATION-SUMMARY.md` | docs/ | 實作進度總結 | ✅ 核心 | 保留 |
| `docs/prototype-guide.md` | docs/ | 原型使用說明 | 🟡 輔助 | 保留 |
| `claudedocs/DESIGN-SYSTEM-MIGRATION-PROGRESS.md` | claudedocs/ | 遷移進度追蹤 | ✅ 核心 | 保留 |

**建議**: 全部保留，設計系統文檔組織良好。

---

#### **D. 業務需求文檔 (PRD)** ✅ 重要性：極高
| 文件名稱 | 路徑 | 用途 | 狀態 | 建議 |
|---------|------|------|------|------|
| `docs/brief.md` | docs/ | 項目簡報 | ✅ 核心 | 保留 |
| `docs/prd/index.md` | docs/prd/ | PRD 總覽 | ✅ 核心 | 保留 |
| `docs/prd/1-goals-and-background-context.md` | docs/prd/ | 目標與背景 | ✅ 核心 | 保留 |
| `docs/prd/2-functional-and-non-functional-requirements.md` | docs/prd/ | 功能需求 | ✅ 核心 | 保留 |
| `docs/prd/3-epic-list.md` | docs/prd/ | Epic 列表 | ✅ 核心 | 保留 |
| `docs/prd/4-epic-and-user-story-details.md` | docs/prd/ | Epic 與 Story 詳情 | ✅ 核心 | 保留 |

**建議**: 全部保留，PRD 組織結構清晰。

---

#### **E. 技術架構文檔** ✅ 重要性：極高
| 文件名稱 | 路徑 | 數量 | 建議 |
|---------|------|------|------|
| `docs/fullstack-architecture/*.md` | docs/fullstack-architecture/ | 13 個文件 | 全部保留 |
| `docs/front-end-spec.md` | docs/ | 1 個文件 | 保留 |

**文件列表**:
1. `index.md` - 架構總覽
2. `1-introduction.md` - 架構簡介
3. `2-high-level-architecture.md` - 高層架構
4. `3-tech-stack.md` - 技術棧
5. `4-unified-project-structure.md` - 專案結構
6. `5-data-model-and-prisma-schema.md` - 資料模型
7. `6-api-design-trpc.md` - API 設計
8. `7-core-components.md` - 核心元件
9. `8-core-workflows.md` - 核心工作流
10. `9-development-workflow.md` - 開發工作流
11. `10-deployment-architecture.md` - 部署架構
12. `11-security-performance-and-observability.md` - 安全與效能
13. `12-cost-optimization-and-management.md` - 成本優化
14. `13-conclusion-and-next-steps.md` - 總結與下一步

**建議**: 架構文檔組織良好，全部保留。

---

#### **F. 使用者故事 (User Stories)** ✅ 重要性：高
| Epic 分類 | 路徑 | Story 數量 | 建議 |
|---------|------|-----------|------|
| Epic 1 - 平台基礎與用戶認證 | docs/stories/epic-1-*/ | 4 個 | 保留 |
| Epic 2 - CI/CD 與部署自動化 | docs/stories/epic-2-*/ | 2 個 | 保留 |
| Epic 3 - 預算與專案設置 | docs/stories/epic-3-*/ | 2 個 | 保留 |
| Epic 4 - 提案與審批工作流 | docs/stories/epic-4-*/ | 4 個 | 保留 |
| Epic 5 - 採購與供應商管理 | docs/stories/epic-5-*/ | 4 個 | 保留 |
| Epic 6 - 費用記錄與財務整合 | docs/stories/epic-6-*/ | 4 個 | 保留 |
| Epic 7 - 儀表板與基本報表 | docs/stories/epic-7-*/ | 4 個 | 保留 |
| Epic 8 - 通知系統 | docs/stories/epic-8-*/ | 2 個 | 保留 |
| Epic 9 - AI 助理 | docs/stories/epic-9-*/ | 4 個 | 保留 |
| Epic 10 - 外部系統整合 | docs/stories/epic-10-*/ | 3 個 | 保留 |

**總計**: 35 個 User Story 文件

**建議**: User Story 組織良好，全部保留。

---

#### **G. 基礎設施文檔** ✅ 重要性：高
| 文件名稱 | 路徑 | 用途 | 建議 |
|---------|------|------|------|
| `docs/infrastructure/local-dev-setup.md` | docs/infrastructure/ | 本地開發環境 | 保留 |
| `docs/infrastructure/azure-infrastructure-setup.md` | docs/infrastructure/ | Azure 基礎設施 | 保留 |
| `docs/infrastructure/project-setup-checklist.md` | docs/infrastructure/ | 設置檢查清單 | 保留 |

**建議**: 全部保留。

---

#### **H. 研究與發現文檔** ✅ 重要性：中
| 文件名稱 | 路徑 | 用途 | 建議 |
|---------|------|------|------|
| `docs/user-research-prompt.md` | docs/ | 用戶研究方法論 | 保留（歸檔） |
| `docs/user-research-result.md` | docs/ | 用戶研究原始數據 | 保留（歸檔） |
| `docs/user-research-insights.md` | docs/ | 用戶研究洞察 | 保留（歸檔） |
| `docs/brainstorming-session-results.md` | docs/ | 腦力激盪結果 | 保留（歸檔） |

**建議**: 這些文檔有歷史價值，建議移到 `docs/research/` 子目錄歸檔。

---

#### **I. Claude 專用文檔** ✅ 重要性：高
| 文件名稱 | 路徑 | 用途 | 建議 |
|---------|------|------|------|
| `claudedocs/DESIGN-SYSTEM-MIGRATION-PLAN.md` | claudedocs/ | 設計系統遷移計劃 | 保留 |
| `claudedocs/DESIGN-SYSTEM-MIGRATION-PROGRESS.md` | claudedocs/ | 遷移進度追蹤 | 保留 |
| `claudedocs/EPIC-5-MISSING-FEATURES.md` | claudedocs/ | Epic 5 缺失功能 | 保留 |
| `claudedocs/EPIC-6-TESTING-CHECKLIST.md` | claudedocs/ | Epic 6 測試清單 | 保留 |
| `claudedocs/EPIC-7-IMPLEMENTATION-PLAN.md` | claudedocs/ | Epic 7 實施計劃 | 保留 |
| `claudedocs/GIT-WORKFLOW-AND-BRANCHING-STRATEGY.md` | claudedocs/ | Git 工作流程 | 保留 |
| `claudedocs/MIGRATION-CHECKLIST-AND-ACCEPTANCE-CRITERIA.md` | claudedocs/ | 遷移檢查清單 | 保留 |
| `claudedocs/POC-VALIDATION-EXECUTION-PLAN.md` | claudedocs/ | POC 驗證計劃 | 保留 |
| `claudedocs/PHASE-*-DETAILED-TASKS.md` | claudedocs/ | Phase 詳細任務 | 保留（4個文件） |
| `claudedocs/MD-FILES-ORGANIZATION-REPORT.md` | claudedocs/ | MD 文件整理報告（本文件） | 保留 |

**建議**: 全部保留，這些是 AI 助手生成的分析和計劃文檔。

---

#### **J. 開發管理文檔** ✅ 重要性：高
| 文件名稱 | 路徑 | 用途 | 建議 |
|---------|------|------|------|
| `DEVELOPMENT-SERVICE-MANAGEMENT.md` | 根目錄 | 開發服務管理 | 保留 |
| `EPIC1-RECORD.md` | 根目錄 | Epic 1 記錄 | 🔴 考慮歸檔 |
| `EPIC2-RECORD.md` | 根目錄 | Epic 2 記錄 | 🔴 考慮歸檔 |
| `temp_epic1_log.md` | 根目錄 | Epic 1 臨時日誌 | 🔴 **刪除**（臨時文件） |
| `認證系統實現摘要.md` | 根目錄 | 認證系統摘要 | 保留（或移到 docs/） |

**建議**:
- `temp_epic1_log.md` 應該刪除（臨時文件）
- `EPIC1-RECORD.md` 和 `EPIC2-RECORD.md` 移到 `claudedocs/` 或刪除（內容已整合到 DEVELOPMENT-LOG）

---

### 2️⃣ Sample-Docs 目錄（約 14 個文件）

#### **說明**: Sample-Docs 目錄包含參考範例文檔，用於項目演示和參考用途

| 文件名稱 | Sample-Docs 路徑 | 根目錄路徑 | 用途 | 建議 |
|---------|-----------------|-----------|------|------|
| `AI-ASSISTANT-GUIDE.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `PROJECT-INDEX.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `INDEX-MAINTENANCE-GUIDE.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `DEVELOPMENT-LOG.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `FIXLOG.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `DEVELOPMENT-SERVICE-MANAGEMENT.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `front-end-spec.md` | ✅ 存在 | docs/front-end-spec.md | 範例參考 | ✅ **保留**（參考範例） |
| `mvp-development-plan.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `mvp-implementation-checklist.md` | ✅ 存在 | ✅ 存在 | 範例參考 | ✅ **保留**（參考範例） |
| `mvp2-development-plan.md` | ✅ 存在 | ❌ 不存在 | 未來規劃參考 | ✅ **保留**（參考文檔） |
| `mvp2-implementation-checklist.md` | ✅ 存在 | ❌ 不存在 | 未來規劃參考 | ✅ **保留**（參考文檔） |
| `START-SERVICES.md` | ✅ 存在 | ❌ 不存在 | 服務啟動指南 | ✅ **保留**（參考文檔） |
| `STARTUP-GUIDE.md` | ✅ 存在 | ❌ 不存在 | 啟動指南 | ✅ **保留**（參考文檔） |
| `architecture.md` | ✅ 存在 | ❌ 不存在 | 架構參考 | ✅ **保留**（參考文檔） |

**說明**:
- `Sample-Docs/` 目錄作為**範例文檔庫**保留，用於項目演示和參考
- 這些文件不會影響項目索引系統（已在索引配置中排除）
- 保留所有文件以維持完整的範例參考資料庫

---

### 3️⃣ 第三方框架文件（約 200+ 個文件）

#### **A. BMad 框架文檔** - 建議：忽略索引

**目錄統計**:
- `.bmad-core/` - 約 50 個 MD 文件
- `.bmad-creative-writing/` - 約 80 個 MD 文件
- `.bmad-infrastructure-devops/` - 約 10 個 MD 文件
- `.claude/commands/BMad/` - 約 30 個 MD 文件
- `.claude/commands/bmad-cw/` - 約 30 個 MD 文件
- `.claude/commands/bmadInfraDevOps/` - 約 5 個 MD 文件

**總計**: 約 205 個第三方框架 MD 文件

**建議**:
1. ✅ 在 `PROJECT-INDEX.md` 中已明確標註為「排除目錄」
2. ✅ 在索引檢查腳本中忽略這些目錄
3. ✅ 不需要任何操作，這些文件應該保持原樣但不納入項目索引

---

### 4️⃣ UI 組件文檔（1 個文件）

| 文件名稱 | 路徑 | 用途 | 建議 |
|---------|------|------|------|
| `apps/web/src/components/ui/README.md` | apps/web/src/components/ui/ | UI 元件庫使用說明 | ✅ 保留 |

**建議**: 保留，這是開發者文檔。

---

### 5️⃣ GitHub 模板文件（4 個文件）

| 文件名稱 | 路徑 | 用途 | 建議 |
|---------|------|------|------|
| `.github/ISSUE_TEMPLATE/bug_report.yml` | .github/ | Bug 報告範本 | ✅ 保留 |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | .github/ | 功能請求範本 | ✅ 保留 |
| `.github/ISSUE_TEMPLATE/config.yml` | .github/ | Issue 配置 | ✅ 保留 |
| `.github/pull_request_template.md` | .github/ | PR 範本 | ✅ 保留 |

**建議**: 全部保留。

---

## 🎯 優先級行動計劃

### 🔴 **優先級 1: 立即執行**（清理重複文件）

#### **刪除 Sample-Docs 目錄中的重複文件**
```bash
# 建議刪除以下 9 個重複文件：
rm Sample-Docs/AI-ASSISTANT-GUIDE.md
rm Sample-Docs/PROJECT-INDEX.md
rm Sample-Docs/INDEX-MAINTENANCE-GUIDE.md
rm Sample-Docs/DEVELOPMENT-LOG.md
rm Sample-Docs/FIXLOG.md
rm Sample-Docs/DEVELOPMENT-SERVICE-MANAGEMENT.md
rm Sample-Docs/front-end-spec.md
rm Sample-Docs/mvp-development-plan.md
rm Sample-Docs/mvp-implementation-checklist.md
```

#### **刪除臨時文件**
```bash
rm temp_epic1_log.md
rm nul  # Windows 系統可能創建的空文件
```

**預期效果**: 減少 10 個重複/臨時文件

---

### 🟡 **優先級 2: 建議執行**（歸檔和整理）

#### **1. 移動 Epic 記錄文件到 claudedocs/**
```bash
mv EPIC1-RECORD.md claudedocs/
mv EPIC2-RECORD.md claudedocs/
```

#### **2. 創建 docs/research/ 目錄並歸檔研究文檔**
```bash
mkdir docs/research
mv docs/user-research-prompt.md docs/research/
mv docs/user-research-result.md docs/research/
mv docs/user-research-insights.md docs/research/
mv docs/brainstorming-session-results.md docs/research/
```

#### **3. 檢查 Sample-Docs 中的獨有文件**
手動檢查以下文件是否有用：
- `Sample-Docs/mvp2-development-plan.md`
- `Sample-Docs/mvp2-implementation-checklist.md`
- `Sample-Docs/START-SERVICES.md`
- `Sample-Docs/STARTUP-GUIDE.md`
- `Sample-Docs/architecture.md`

如果沒用，全部刪除 `Sample-Docs/` 目錄。

---

### 🟢 **優先級 3: 可選執行**（優化組織）

#### **1. 移動中文文檔到適當位置**
```bash
# 選項 A: 移到 docs/ 目錄
mv 認證系統實現摘要.md docs/

# 或選項 B: 移到 claudedocs/
mv 認證系統實現摘要.md claudedocs/
```

#### **2. 考慮合併相似文檔**
- 評估是否可以將 `NAVIGATION-SYSTEM-GUIDE.md` 合併到 `INDEX-MAINTENANCE-GUIDE.md`
- 評估是否可以將 `INSTALL-COMMANDS.md` 合併到 `README.md` 或 `SETUP-COMPLETE.md`

---

## 📊 整理後的文件結構預覽

### ✅ 優化後的項目文檔組織

```
ai-it-project-process-management-webapp/
│
├── 📋 核心索引與導航（7個核心文件）
│   ├── AI-ASSISTANT-GUIDE.md
│   ├── PROJECT-INDEX.md
│   ├── INDEX-MAINTENANCE-GUIDE.md
│   ├── DEVELOPMENT-LOG.md
│   ├── FIXLOG.md
│   └── NAVIGATION-SYSTEM-GUIDE.md（可選：合併）
│
├── 📘 項目總覽（8個文件）
│   ├── README.md
│   ├── CLAUDE.md
│   ├── CONTRIBUTING.md
│   ├── SETUP-COMPLETE.md
│   ├── mvp-development-plan.md
│   ├── mvp-implementation-checklist.md
│   ├── INSTALL-COMMANDS.md
│   └── DEVELOPMENT-SERVICE-MANAGEMENT.md
│
├── 🎨 設計系統（7個文件）
│   ├── DESIGN-SYSTEM-GUIDE.md（根目錄）
│   └── docs/
│       ├── README-DESIGN-SYSTEM.md
│       ├── ui-ux-redesign.md
│       ├── design-system-migration-plan.md
│       ├── IMPLEMENTATION-SUMMARY.md
│       └── prototype-guide.md
│
├── 📚 業務與架構文檔（約 35 個文件）
│   └── docs/
│       ├── brief.md
│       ├── front-end-spec.md
│       ├── prd/ （6個文件）
│       ├── fullstack-architecture/ （14個文件）
│       ├── infrastructure/ （3個文件）
│       ├── stories/ （35個 User Story）
│       └── research/ （4個研究文檔 - 新建目錄）
│
├── 🤖 Claude 專用文檔（約 15 個文件）
│   └── claudedocs/
│       ├── DESIGN-SYSTEM-MIGRATION-*.md
│       ├── EPIC-*-*.md
│       ├── GIT-WORKFLOW-*.md
│       ├── PHASE-*-*.md
│       ├── POC-*.md
│       ├── EPIC1-RECORD.md（移動自根目錄）
│       ├── EPIC2-RECORD.md（移動自根目錄）
│       └── MD-FILES-ORGANIZATION-REPORT.md（本文件）
│
├── 🛠️ 組件文檔（1個文件）
│   └── apps/web/src/components/ui/README.md
│
├── 🔧 GitHub 模板（4個文件）
│   └── .github/
│       ├── ISSUE_TEMPLATE/
│       └── pull_request_template.md
│
└── 🚫 排除目錄（不納入索引，約 205 個文件）
    ├── .bmad-core/
    ├── .bmad-creative-writing/
    ├── .bmad-infrastructure-devops/
    └── .claude/commands/
```

---

## 📈 統計對比

### 整理前
- **總 MD 文件數**: 313 個
- **項目核心文件**: ~80 個
- **重複文件**: 9 個
- **臨時文件**: 2 個
- **第三方框架**: ~205 個
- **有效組織度**: 70%

### 整理後（預期）
- **總 MD 文件數**: 302 個（刪除 11 個）
- **項目核心文件**: ~80 個（優化組織）
- **重複文件**: 0 個 ✅
- **臨時文件**: 0 個 ✅
- **第三方框架**: ~205 個（明確排除）
- **有效組織度**: 95% ✅

---

## ✅ 具體執行清單

### 階段 1: 清理重複文件（必須執行）
- [ ] 刪除 `Sample-Docs/` 中的 9 個重複文件
- [ ] 刪除 `temp_epic1_log.md` 臨時文件
- [ ] 刪除 `nul` 空文件（如果存在）

### 階段 2: 歸檔整理（建議執行）
- [ ] 創建 `docs/research/` 目錄
- [ ] 移動 4 個研究文檔到 `docs/research/`
- [ ] 移動 `EPIC1-RECORD.md` 和 `EPIC2-RECORD.md` 到 `claudedocs/`

### 階段 3: 檢查 Sample-Docs 獨有文件（建議執行）
- [ ] 檢查 `mvp2-development-plan.md` 是否有用
- [ ] 檢查 `mvp2-implementation-checklist.md` 是否有用
- [ ] 檢查 `START-SERVICES.md` 是否有用
- [ ] 檢查 `STARTUP-GUIDE.md` 是否有用
- [ ] 檢查 `architecture.md` 是否有用
- [ ] 如果全部無用，刪除整個 `Sample-Docs/` 目錄

### 階段 4: 優化索引（可選執行）
- [ ] 考慮合併 `NAVIGATION-SYSTEM-GUIDE.md` 到 `INDEX-MAINTENANCE-GUIDE.md`
- [ ] 移動 `認證系統實現摘要.md` 到 `docs/` 或 `claudedocs/`
- [ ] 更新 `PROJECT-INDEX.md` 反映新的組織結構

### 階段 5: 更新文檔（必須執行）
- [ ] 更新 `DEVELOPMENT-LOG.md` 記錄本次整理
- [ ] 更新 `PROJECT-INDEX.md` 文件統計數字
- [ ] 執行 `npm run index:check` 驗證索引健康

---

## 🎯 預期效益

### 短期效益
1. ✅ **減少混亂**: 刪除 11 個重複/臨時文件
2. ✅ **提升清晰度**: 文檔組織更清晰，更易導航
3. ✅ **降低維護成本**: 不再維護重複文件

### 長期效益
1. ✅ **提升開發效率**: AI 助手和開發者更快找到正確文件
2. ✅ **降低錯誤率**: 避免修改錯誤版本的文件
3. ✅ **改善可維護性**: 清晰的文檔結構更易維護

---

## 🔗 相關資源

- **索引維護指南**: [INDEX-MAINTENANCE-GUIDE.md](../INDEX-MAINTENANCE-GUIDE.md)
- **項目索引**: [PROJECT-INDEX.md](../PROJECT-INDEX.md)
- **開發記錄**: [DEVELOPMENT-LOG.md](../DEVELOPMENT-LOG.md)

---

**最後更新**: 2025-10-16
**生成者**: AI 助手
**版本**: v1.0
