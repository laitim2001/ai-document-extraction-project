# AI 助手開發指引

> 本文件為 AI 助手（Claude、GPT 等）在本項目中工作的快速入門指南。
> 請在每次 Session 開始時閱讀本文件，確保了解項目結構和開發規範。

---

## 項目快速概覽

### 項目使命
建立一套 AI 驅動的文件內容提取與自動分類系統，專門解決 SCM 部門處理 Freight Invoice 的效率問題。

### 核心目標
| 指標 | 目標 |
|------|------|
| 年處理量 | 450,000-500,000 張發票（APAC 地區）|
| 自動化率 | 90-95% |
| 準確率 | 90-95% |
| 節省人時 | 35,000-40,000 人時/年 |

### 技術棧
- **前端**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **後端**: Next.js API Routes + Prisma ORM
- **資料庫**: PostgreSQL (Docker)
- **AI 服務**: Azure OpenAI GPT-4o + Azure Document Intelligence
- **認證**: Azure AD (Entra ID) SSO

---

## 必讀文件索引

### 開發規範
| 文件 | 路徑 | 說明 |
|------|------|------|
| **主要開發指引** | `CLAUDE.md` | 完整的開發規範和項目設置 |
| **項目導航索引** | `PROJECT-INDEX.md` | 所有項目文件的快速導航 |
| **技術障礙處理** | `.claude/rules/technical-obstacles.md` | 遇到技術問題的處理流程 |

### 項目文檔
| 類別 | 路徑 | 說明 |
|------|------|------|
| PRD | `docs/01-planning/prd/prd.md` | 產品需求文件 |
| 架構設計 | `docs/02-architecture/` | 系統架構和設計決策 |
| Epic 概覽 | `docs/03-epics/` | Epic 結構和故事概覽 |
| 實施文檔 | `docs/04-implementation/` | **核心開發內容所在** |

### 🔥 核心開發資源（必讀）
| 類別 | 路徑 | 說明 |
|------|------|------|
| **Story 檔案** | `docs/04-implementation/stories/` | 所有 Story 的詳細規格（91 個檔案）|
| **技術規格** | `docs/04-implementation/tech-specs/` | 各 Epic 的技術設計規格 |
| **開發 Prompt** | `docs/04-implementation/prompt-templates/all-story-prompts.md` | 各階段開發 Prompt 範本 |
| **Sprint 狀態** | `docs/04-implementation/sprint-status.yaml` | **項目進度的唯一真實來源** |

### 執行記錄
| 類別 | 路徑 | 說明 |
|------|------|------|
| 日常記錄 | `claudedocs/` | 開發過程中的記錄和模板 |
| 進度追蹤 | `claudedocs/3-progress/` | 日報、週報 |
| 變更記錄 | `claudedocs/4-changes/` | Bug 修復、功能變更 |

---

## Session 工作流程

### Session 開始
```
1. 閱讀本文件（AI-ASSISTANT-GUIDE.md）
2. 查看 PROJECT-INDEX.md 了解項目結構
3. 查看 docs/04-implementation/sprint-status.yaml 了解項目進度
4. 查看 claudedocs/3-progress/daily/ 最新日報
5. 確認開發環境狀態：
   - Docker 容器運行中
   - 開發伺服器運行中（localhost:3005）
6. 查看 claudedocs/6-ai-assistant/handoff/ 是否有交接文件
```

### Session 進行中
```
1. 使用 TodoWrite 追蹤任務進度
2. 遇到問題時記錄到變更記錄
3. 重要決策記錄到日報
4. 每 30 分鐘檢查一次進度狀態
```

### Session 結束
```
1. 更新日報（claudedocs/3-progress/daily/YYYY-MM-DD.md）
2. 如有未完成任務，建立交接文件
3. 確保代碼品質檢查通過：
   - npm run type-check
   - npm run lint
4. 提交代碼變更（如適用）
```

---

## 核心開發規範

### 三層映射系統
```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Universal Mapping（通用層）70-80% 常見術語              │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: Forwarder-Specific Override（特定覆蓋層）差異映射       │
├─────────────────────────────────────────────────────────────────┤
│ TIER 3: LLM Classification（AI 智能分類）GPT-4o 處理未知術語    │
└─────────────────────────────────────────────────────────────────┘
```

### 信心度路由
| 信心度 | 處理方式 | 說明 |
|--------|----------|------|
| ≥ 90% | AUTO_APPROVE | 自動通過 |
| 70-89% | QUICK_REVIEW | 快速確認 |
| < 70% | FULL_REVIEW | 完整審核 |

### 文件頭部註釋標準
所有業務邏輯文件必須包含標準 JSDoc 註釋（詳見 CLAUDE.md）。

### 禁止事項
- ❌ 不要使用 `any` 類型
- ❌ 不要跳過錯誤處理
- ❌ 不要硬編碼敏感資訊
- ❌ 不要擅自偏離設計規格
- ❌ 不要在客戶端組件中直接訪問資料庫

---

## Epic 進度總覽

> **狀態來源**: `docs/04-implementation/sprint-status.yaml`
> **最後更新**: 2025-12-26

| Epic | 名稱 | Stories | 狀態 | 完成日期 |
|------|------|---------|------|----------|
| 0 | 歷史數據初始化（前置 Epic） | 7 | ✅ 已完成 | 2025-12-26 |
| 1 | 用戶認證與存取控制 | 9 | ✅ 已完成 | 2025-12-18 |
| 2 | 手動發票上傳與 AI 處理 | 7 | ✅ 已完成 | 2025-12-18 |
| 3 | 發票審核與修正工作流 | 8 | ✅ 已完成 | 2025-12-19 |
| 4 | 映射規則管理與自動學習 | 8 | ✅ 已完成 | 2025-12-19 |
| 5 | Forwarder 配置管理 | 5 | ✅ 已完成 | 2025-12-19 |
| 6 | 多城市數據隔離 | 5 | ✅ 已完成 | 2025-12-19 |
| 7 | 報表儀表板與成本追蹤 | 10 | ✅ 已完成 | 2025-12-20 |
| 8 | 審計追溯與合規 | 6 | ✅ 已完成 | 2025-12-20 |
| 9 | 自動化文件獲取 | 5 | ✅ 已完成 | 2025-12-20 |
| 10 | n8n 工作流整合 | 7 | ✅ 已完成 | 2025-12-21 |
| 11 | 對外 API 服務 | 6 | ✅ 已完成 | 2025-12-21 |
| 12 | 系統管理與監控 | 7 | ✅ 已完成 | 2025-12-21 |

**總計**: 13 個 Epic，90 個 Stories

### 重要重構記錄
| 重構 | 說明 | 狀態 | 完成 Story |
|------|------|------|------------|
| REFACTOR-001 | Forwarder → Company 模型重構 | ✅ 已完成 | Story 0-3 |

---

## 常用命令

### 開發環境
```bash
# 啟動資料庫
docker-compose up -d

# 啟動開發伺服器
npm run dev

# 資料庫操作
npx prisma studio      # 開啟 Prisma Studio
npx prisma migrate dev # 執行遷移
npx prisma generate    # 生成 Prisma Client
```

### 代碼品質
```bash
npm run type-check     # TypeScript 檢查
npm run lint           # ESLint 檢查
npm run format         # Prettier 格式化
npm run test           # 執行測試
```

### 索引維護
```bash
npm run index:check    # 檢查 PROJECT-INDEX.md 同步狀態
```

---

## 技術障礙處理

遇到技術障礙時，**絕不擅自改變設計決策**。

### 處理流程
1. 深入調查根本原因（嘗試至少 3 種方法）
2. 記錄調查過程和失敗原因
3. 如果無法解決 → **必須詢問用戶**
4. 如果用戶接受替代方案 → 記錄為技術債務

詳細規範請參考：`.claude/rules/technical-obstacles.md`

---

## 快速連結

### 項目導航
- 📋 [PROJECT-INDEX.md](./PROJECT-INDEX.md) - 完整項目索引
- 📖 [CLAUDE.md](./CLAUDE.md) - 開發規範
- 📁 [claudedocs/](./claudedocs/) - 執行記錄

### 文檔導航
- 📝 [PRD](./docs/01-planning/prd/prd.md) - 產品需求
- 🏗️ [架構設計](./docs/02-architecture/) - 系統架構
- 📚 [Epic 概覽](./docs/03-epics/) - Epic 和 Story 結構

### 核心開發資源
- 📄 [Story 檔案](./docs/04-implementation/stories/) - 所有 Story 規格
- 🔧 [技術規格](./docs/04-implementation/tech-specs/) - 技術設計文檔
- 📋 [開發 Prompt](./docs/04-implementation/prompt-templates/all-story-prompts.md) - 開發階段 Prompt

### 維護工具
- 🔧 [索引維護指引](./INDEX-MAINTENANCE-GUIDE.md) - 索引更新流程
- 🔍 [索引檢查腳本](./scripts/check-index-sync.js) - 同步驗證

---

## AI 助手提示系統

根據不同開發場景，使用對應的提示文件來系統性地執行任務：

| 場景 | 提示文件 | 使用時機 |
|------|----------|----------|
| **項目入門** | [SITUATION-1-PROJECT-ONBOARDING.md](./claudedocs/6-ai-assistant/prompts/SITUATION-1-PROJECT-ONBOARDING.md) | 新 AI 助手首次接觸項目 |
| **開發前準備** | [SITUATION-2-FEATURE-DEV-PREP.md](./claudedocs/6-ai-assistant/prompts/SITUATION-2-FEATURE-DEV-PREP.md) | 開始任何 Story 開發之前 |
| **功能修改** | [SITUATION-3-FEATURE-ENHANCEMENT.md](./claudedocs/6-ai-assistant/prompts/SITUATION-3-FEATURE-ENHANCEMENT.md) | Bug 修復或功能增強 |
| **新功能開發** | [SITUATION-4-NEW-FEATURE-DEV.md](./claudedocs/6-ai-assistant/prompts/SITUATION-4-NEW-FEATURE-DEV.md) | 完整 Story 功能開發 |
| **保存進度** | [SITUATION-5-SAVE-PROGRESS.md](./claudedocs/6-ai-assistant/prompts/SITUATION-5-SAVE-PROGRESS.md) | 結束 Session 或保存工作 |

### 使用方式
1. 識別當前開發場景
2. 閱讀對應的提示文件
3. 按照文件中的 AI 執行步驟操作
4. 使用提供的輸出模板記錄結果

---

## 語言設定

- **用戶溝通**: 繁體中文
- **代碼註釋**: 中文或英文
- **Commit Message**: 英文
- **文檔**: 繁體中文為主

---

*文件版本：2.0.0*
*建立日期：2025-12-21*
*最後更新：2025-12-26*
