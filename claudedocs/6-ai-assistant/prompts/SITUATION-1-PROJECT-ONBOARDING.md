# 🚀 情況1: 專案入門 - 開發人員重新開始開發活動

> **使用時機**: 新對話開始前，開發人員需要快速了解專案
> **目標**: 讓 AI 助手在 5 分鐘內理解專案全貌
> **適用場景**: 新開發者、長時間未接觸專案、會話重啟

---

## 📋 Prompt 模板 (給開發人員)

```markdown
你好！我需要你幫我快速了解這個專案。

這是一個 AI 文件內容提取與自動分類系統，我需要你:

1. 閱讀專案概覽
   - 請先閱讀 `CLAUDE.md` 了解開發指南
   - 閱讀 `PROJECT-INDEX.md` 了解文件組織
   - 閱讀 `claudedocs/3-progress/daily/` 最新的日報

2. 理解專案結構
   - 查看 `src/app/(dashboard)/` 了解頁面結構
   - 查看 `src/app/api/` 了解 API 結構
   - 查看 `src/services/` 了解業務邏輯

3. 確認當前狀態
   - 檢查 Git 狀態: `git status` 和 `git log --oneline -10`
   - 閱讀 `claudedocs/3-progress/weekly/` 最新的每週進度
   - 檢查是否有進行中的功能開發 `claudedocs/1-planning/features/`

4. 總結並回答
   - 這個專案是做什麼的?
   - 當前開發到哪個階段?
   - 最近完成了什麼功能?
   - 有沒有進行中的任務?
   - 技術棧是什麼?

請用中文回答，並保持簡潔。
```

---

## 🤖 AI 助手執行步驟

### Step 1: 快速理解專案 (2 分鐘)

```bash
# 1. 讀取核心文檔
Read: CLAUDE.md (專案開發指南)
Read: PROJECT-INDEX.md (文件索引)
Read: AI-ASSISTANT-GUIDE.md (AI 助手指引)

# 2. 檢查 Git 狀態
Bash: git status
Bash: git log --oneline -10
Bash: git branch

# 3. 讀取最新進度
Read: claudedocs/3-progress/daily/[最新日期].md
Read: claudedocs/3-progress/weekly/[最新週].md
```

### Step 2: 理解項目結構 (2 分鐘)

```bash
# 1. 快速掃描目錄結構
Bash: ls src/app/
Bash: ls src/services/
Bash: ls src/components/features/

# 2. 檢查進行中的功能開發
Bash: ls claudedocs/1-planning/features/

# 3. 檢查 package.json
Read: package.json (了解依賴和腳本)
```

### Step 3: 生成總結報告 (1 分鐘)

```markdown
# 📊 專案入門總結

## 專案概覽
- **名稱**: AI Document Extraction System
- **目標**: AI 驅動的文件內容提取與自動分類系統
- **業務**: 處理 SCM 部門 Freight Invoice (450,000-500,000 張/年)
- **技術棧**: Next.js 15 + TypeScript + Prisma + Azure OpenAI
- **開發模式**: Next.js App Router + shadcn/ui

## 核心架構
### 三層映射系統
┌─────────────────────────────────────────┐
│ TIER 1: Universal Mapping（70-80%）     │
├─────────────────────────────────────────┤
│ TIER 2: Forwarder Override（差異映射）  │
├─────────────────────────────────────────┤
│ TIER 3: LLM Classification（AI 分類）   │
└─────────────────────────────────────────┘

### 信心度路由
| 信心度 | 處理方式 |
|--------|----------|
| ≥90% | AUTO_APPROVE |
| 70-89% | QUICK_REVIEW |
| <70% | FULL_REVIEW |

## 當前狀態
- **階段**: [根據實際情況填寫]
- **最新分支**: [當前分支]
- **最後提交**: [commit message]

## 最近完成
- ✅ [根據日報填寫]

## 進行中任務
- ⏳ [檢查 1-planning/features/ 或 3-progress/]

## 快速導航
- **文檔**: docs/, claudedocs/
- **前端**: src/app/, src/components/
- **API**: src/app/api/
- **服務**: src/services/
- **數據庫**: prisma/schema.prisma
- **功能規劃**: claudedocs/1-planning/features/

## 下一步建議
1. 運行 `npm run dev` 啟動開發服務器
2. 運行 `npm run index:check` 檢查索引同步
3. 檢查 claudedocs/1-planning/features/ 了解進行中功能
4. 閱讀最新日報了解工作狀態
```

---

## ✅ 驗收標準

AI 助手應該能回答以下問題:

1. **專案是什麼?**
   - AI 文件內容提取與自動分類系統，處理 Freight Invoice

2. **核心架構?**
   - 三層映射系統 + 信心度路由機制

3. **當前階段?**
   - 檢查 claudedocs/3-progress/ 確認

4. **最近完成?**
   - 檢查最新日報

5. **進行中任務?**
   - 檢查 claudedocs/1-planning/features/

6. **技術棧?**
   - Next.js 15, TypeScript, Prisma, PostgreSQL, Azure OpenAI

7. **如何啟動?**
   - `docker-compose up -d` → `npm run dev`

---

## 📚 推薦閱讀順序 (深入了解)

### 新開發者 (Day 1)
1. CLAUDE.md - 開發指南
2. PROJECT-INDEX.md - 文件索引
3. AI-ASSISTANT-GUIDE.md - AI 助手指引
4. claudedocs/3-progress/daily/[最新].md - 最新日報

### 新開發者 (Day 2-3)
1. docs/01-planning/prd/prd.md - 產品需求
2. docs/02-architecture/architecture.md - 系統架構
3. prisma/schema.prisma - 數據模型
4. src/services/ - 業務服務

### 持續開發
1. claudedocs/1-planning/features/ - 進行中功能
2. claudedocs/4-changes/ - 變更記錄
3. claudedocs/3-progress/weekly/ - 週報

---

## 🔗 相關文檔

### 開發流程指引
- [情況2: 開發前準備](./SITUATION-2-FEATURE-DEV-PREP.md)
- [情況3: 舊功能進階/修正](./SITUATION-3-FEATURE-ENHANCEMENT.md)
- [情況4: 新功能開發](./SITUATION-4-NEW-FEATURE-DEV.md)
- [情況5: 保存進度](./SITUATION-5-SAVE-PROGRESS.md)

---

**維護者**: AI 助手 + 開發團隊
**最後更新**: 2025-12-21
**版本**: 1.0
