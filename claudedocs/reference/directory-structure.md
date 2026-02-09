# 項目完整目錄結構

> **來源**: 從 `CLAUDE.md` v2.6.0 搬遷（CHANGE-033）
> **查閱時機**: 需要了解文件位置、新增文件、建立新模組時

---

## 項目目錄結構

```
ai-document-extraction-project/
│
├── .claude/                    # Claude Code 配置
│   ├── rules/                  # 開發規範（9 個規則文件）
│   │   ├── general.md          # 通用開發規範
│   │   ├── typescript.md       # TypeScript 規範
│   │   ├── services.md         # 服務層規範
│   │   ├── api-design.md       # API 設計規範
│   │   ├── components.md       # 組件開發規範
│   │   ├── database.md         # 資料庫規範
│   │   ├── testing.md          # 測試規範
│   │   ├── i18n.md             # 國際化規範
│   │   └── technical-obstacles.md  # 技術障礙處理
│   ├── agents/                 # 自定義 AI Agent（8 個）
│   ├── skills/                 # 自定義 Skill（4 個）
│   ├── commands/               # BMAD 工作流命令
│   ├── settings.local.json     # 本地設定
│   └── CLAUDE.md               # 詳細操作指引（服務啟動等）
│
├── claudedocs/                 # AI 助手文檔目錄
│   ├── 1-planning/             # 規劃文檔（Epic 架構設計 + Plan docs）
│   ├── 2-sprints/              # Sprint 文檔
│   ├── 3-progress/             # 進度追蹤（日報/週報）
│   ├── 4-changes/              # 變更記錄（32 CHANGE + 35 FIX）
│   ├── 5-status/               # 狀態報告
│   ├── 6-ai-assistant/         # AI 助手相關（6 個 SITUATION 提示詞）
│   ├── 7-archive/              # 歸檔文檔
│   ├── reference/              # 參考資料（CHANGE-033 新增）
│   └── CLAUDE.md               # 目錄索引
│
├── docs/                       # 項目正式文檔
│   ├── 00-discovery/           # 產品探索階段
│   ├── 01-planning/            # 規劃階段 (PRD, UX)
│   ├── 02-architecture/        # 架構設計
│   ├── 03-stories/             # 用戶故事
│   └── 04-implementation/      # 實施文檔
│
├── python-services/            # Python 後端服務
│   ├── extraction/             # OCR 提取服務 (Azure DI + GPT Vision)
│   └── mapping/                # 映射邏輯服務
│
├── openapi/                    # OpenAPI 規格
│
├── messages/                   # i18n 翻譯文件（30 命名空間/語言）
│   ├── en/                     # English 翻譯
│   ├── zh-TW/                  # 繁體中文翻譯
│   └── zh-CN/                  # 简体中文翻譯
│
├── prisma/                     # Prisma Schema（117 models）和遷移
├── public/                     # 靜態資源
├── scripts/                    # 工具腳本
│
├── src/                        # Next.js 源代碼
│   ├── app/                    # App Router 頁面
│   │   ├── [locale]/           # i18n 動態路由
│   │   │   ├── (auth)/         # 認證相關頁面
│   │   │   └── (dashboard)/    # 儀表板頁面（25+ admin 頁面）
│   │   └── api/                # API 路由（175 route files, ~300 端點）
│   ├── components/             # React 組件（165+ 組件）
│   │   ├── ui/                 # shadcn/ui 基礎組件
│   │   ├── features/           # 功能組件（10+ 子目錄）
│   │   └── layout/             # 佈局組件
│   ├── config/                 # 應用配置
│   ├── constants/              # 常數定義
│   ├── contexts/               # React Context 提供者
│   ├── events/                 # 事件處理系統
│   ├── hooks/                  # 自定義 Hooks（89 個）
│   ├── i18n/                   # i18n 配置
│   │   ├── config.ts           # 語言配置常數
│   │   ├── routing.ts          # next-intl 路由配置
│   │   └── request.ts          # Server-side locale + 命名空間載入
│   ├── jobs/                   # 背景任務和排程
│   ├── lib/                    # 工具庫
│   │   └── validations/        # Zod 驗證 Schema（新標準位置）
│   ├── middlewares/            # 中間件
│   ├── providers/              # 應用程式提供者
│   ├── services/               # 業務邏輯服務層（124+ 服務）
│   │   └── extraction-v3/      # V3 提取管線（3-stage architecture）
│   │       ├── stages/         # Stage 1/2/3 服務
│   │       └── utils/          # 提取工具函數
│   ├── stores/                 # Zustand 狀態管理
│   ├── types/                  # TypeScript 類型定義
│   └── validations/            # Zod 驗證 Schema（舊位置，漸遷至 lib/）
│
├── tests/                      # 測試文件
│   ├── unit/                   # 單元測試
│   ├── integration/            # 整合測試
│   └── e2e/                    # 端到端測試
│
├── .github/                    # GitHub Actions CI/CD
├── .bmad/                      # BMAD 工作流配置
└── .vscode/                    # VS Code 設定
```

---

## API 路由結構

```
src/app/api/
├── admin/              # 管理端點（50+ routes）
│   ├── alerts/         # 警報管理
│   ├── backups/        # 備份與恢復
│   ├── config/         # 系統配置
│   ├── health/         # 健康檢查
│   ├── integrations/   # 外部整合
│   ├── logs/           # 日誌管理
│   ├── performance/    # 效能監控
│   ├── retention/      # 資料保留
│   └── users/          # 用戶管理
├── analytics/          # 統計分析
├── auth/               # 認證 (NextAuth)
├── cities/             # 城市管理
├── dashboard/          # 儀表板數據
├── documents/          # 文件處理（20+ routes）
├── exchange-rates/     # 匯率管理
├── field-mappings/     # 欄位映射
├── formats/            # 文件格式
├── reference-numbers/  # 參考編號
├── rules/              # 映射規則（15+ routes）
└── v1/                 # 版本化端點
    └── pipeline-configs/ # 管線配置（新增）
```

---

## Claude Code 自定義基礎設施

### `.claude/agents/` - 8 個自定義 AI Agent

| Agent | 模型 | 用途 | 修改代碼？ |
|-------|------|------|------------|
| `project-analyst` | sonnet | 文檔審計與差距分析 | 否（文檔） |
| `requirement-analyst` | sonnet | 需求探索與影響分析 | 否（唯讀） |
| `architecture-reviewer` | sonnet | 架構設計驗證（對照 9 規則文件） | 否（唯讀） |
| `i18n-guardian` | haiku | 翻譯同步檢查（en/zh-TW/zh-CN） | 否（建議修復） |
| `code-quality-checker` | sonnet | 項目品質審查 | 否（唯讀） |
| `fullstack-scaffolder` | sonnet | 全端代碼骨架生成 | 是（新文件） |
| `test-strategist` | sonnet | 測試計劃文檔 | 否（文檔） |
| `session-manager` | haiku | SITUATION-5 自動化 | 否（文檔） |

### `.claude/skills/` - 4 個自定義 Skill

| Skill | 觸發命令 | 用途 |
|-------|----------|------|
| `quickcompact` | `/quickcompact` | 快速 compact 並保留執行狀態 |
| `plan-story` | `/plan-story` | 新功能規劃（Story + Tech Spec + Prompt） |
| `plan-change` | `/plan-change` | 功能變更規劃（CHANGE-XXX） |
| `plan-fix` | `/plan-fix` | Bug 修復規劃（FIX-XXX） |

### `.claude/rules/` - 9 個規則文件

| 規則文件 | 觸發路徑 | 用途 |
|----------|----------|------|
| `general.md` | 全局 | 通用開發規範、JSDoc 模板、命名規範 |
| `typescript.md` | `src/**/*.{ts,tsx}` | TypeScript 類型規範、嚴格模式規則 |
| `services.md` | `src/services/**/*` | 服務層設計模式、依賴注入 |
| `api-design.md` | `src/app/api/**/*.ts` | API 響應格式、路由結構、錯誤處理 |
| `components.md` | `src/components/**/*.tsx` | 組件結構、狀態管理模式 |
| `database.md` | `prisma/**/*` | Prisma Schema 命名、遷移規範 |
| `testing.md` | `tests/**/*` | 測試覆蓋率目標、測試結構 |
| `i18n.md` | `src/**/*.{ts,tsx}, messages/**/*.json` | i18n 開發規範、同步規則 |
| `technical-obstacles.md` | 全局 | 技術障礙處理流程、詢問模板 |

---

**來源**: CLAUDE.md v2.6.0 (2026-02-08)
**搬遷日期**: 2026-02-09 (CHANGE-033)
