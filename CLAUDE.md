# AI Document Extraction Project - Claude Code 開發指引

> 本文件為 Claude Code AI 助手的開發指引，自動作為 system prompt 載入。

---

## 項目概覽

### 項目使命
建立一套 AI 驅動的文件內容提取與自動分類系統，專門解決 SCM 部門處理 Freight Invoice 的效率問題。

### 核心目標
- **年處理量**: 450,000-500,000 張發票（APAC 地區）
- **自動化率**: 90-95%
- **準確率**: 90-95%
- **節省人時**: 35,000-40,000 人時/年

### 核心架構 - 三層映射系統

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Universal Mapping（通用層）                              │
│ • 覆蓋 70-80% 常見術語，所有 Forwarder 通用                      │
│ • 維護成本：低（只需維護一份）                                   │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: Forwarder-Specific Override（特定覆蓋層）                │
│ • 只記錄該 Forwarder 與通用規則「不同」的映射                    │
│ • 維護成本：中（每個 Forwarder 只需記錄差異）                    │
├─────────────────────────────────────────────────────────────────┤
│ TIER 3: LLM Classification（AI 智能分類）                        │
│ • 當以上都無法匹配時，使用 GPT-4o 智能分類                       │
│ • 可處理從未見過的新術語                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 信心度路由機制

| 信心度範圍 | 處理方式 | 說明 |
|-----------|---------|------|
| ≥ 90% | AUTO_APPROVE | 自動通過，無需人工介入 |
| 70-89% | QUICK_REVIEW | 快速人工確認（一鍵確認/修正） |
| < 70% | FULL_REVIEW | 完整人工審核（詳細檢查） |

---

## 技術棧

### 核心框架
- **前端**: Next.js 15 (App Router) + TypeScript
- **樣式**: Tailwind CSS + shadcn/ui
- **資料庫**: PostgreSQL + Prisma ORM
- **狀態管理**: Zustand (UI) + React Query (Server State)
- **表單**: React Hook Form + Zod 驗證

### 外部服務
- **OCR**: Azure Document Intelligence
- **AI**: Azure OpenAI GPT-4o
- **認證**: Azure AD (Entra ID) SSO
- **工作流**: n8n
- **文件來源**: SharePoint / Outlook / Azure Blob Storage

### 開發工具
- **容器化**: Docker Compose (PostgreSQL + pgAdmin)
- **代碼品質**: ESLint + Prettier
- **套件管理**: npm

---

## 目錄結構

```
ai-document-extraction-project/
├── .github/                    # GitHub Actions CI/CD
├── docs/                       # 項目文檔
│   ├── 00-discovery/           # 產品探索階段
│   ├── 01-planning/            # 規劃階段 (PRD, UX)
│   ├── 02-architecture/        # 架構設計
│   ├── 03-stories/             # 用戶故事
│   └── 04-implementation/      # 實施文檔
├── prisma/                     # Prisma Schema 和遷移
├── public/                     # 靜態資源
├── scripts/                    # 工具腳本
├── src/                        # 源代碼
│   ├── app/                    # Next.js App Router 頁面
│   │   ├── (auth)/             # 認證相關頁面
│   │   ├── (dashboard)/        # 儀表板頁面
│   │   └── api/                # API 路由
│   ├── components/             # React 組件
│   │   ├── ui/                 # shadcn/ui 基礎組件
│   │   ├── features/           # 功能組件
│   │   └── layouts/            # 佈局組件
│   ├── hooks/                  # 自定義 Hooks
│   ├── lib/                    # 工具庫
│   │   ├── api/                # API 客戶端
│   │   ├── auth/               # 認證邏輯
│   │   └── utils/              # 通用工具函數
│   ├── services/               # 業務邏輯服務層
│   ├── stores/                 # Zustand 狀態管理
│   ├── types/                  # TypeScript 類型定義
│   └── validations/            # Zod 驗證 Schema
└── tests/                      # 測試文件
    ├── unit/                   # 單元測試
    ├── integration/            # 整合測試
    └── e2e/                    # 端到端測試
```

---

## 代碼規範

### 文件頭部註釋標準（必須遵守）

所有業務邏輯文件必須包含標準 JSDoc 頭部註釋：

```typescript
/**
 * @fileoverview [文件的主要目的和功能概述]
 * @description
 *   [更詳細的描述，包含：]
 *   - 主要功能說明
 *   - 設計決策說明
 *   - 重要注意事項
 *
 * @module [模組路徑，如 src/services/mapping]
 * @author [作者或團隊名稱]
 * @since [Epic X - Story X.X (功能名稱)]
 * @lastModified [最後修改日期 YYYY-MM-DD]
 *
 * @features
 *   - [功能點 1]
 *   - [功能點 2]
 *
 * @dependencies
 *   - [依賴 1] - [用途說明]
 *   - [依賴 2] - [用途說明]
 *
 * @related
 *   - [相關文件路徑 1] - [關係說明]
 *   - [相關文件路徑 2] - [關係說明]
 */
```

### 適用範圍

| 文件類型 | 是否需要完整頭部 | 說明 |
|---------|----------------|------|
| Services (`src/services/`) | ✅ 必須 | 核心業務邏輯 |
| API Routes (`src/app/api/`) | ✅ 必須 | API 端點 |
| Hooks (`src/hooks/`) | ✅ 必須 | 自定義 Hooks |
| Utils (`src/lib/`) | ✅ 必須 | 工具函數 |
| Feature Components | ✅ 必須 | 功能性組件 |
| UI Components (`ui/`) | ❌ 不需要 | shadcn/ui 組件 |
| Type Definitions | ⚠️ 簡化版 | 類型文件 |

### 函數/方法註釋標準

```typescript
/**
 * [函數功能簡述]
 *
 * @description [詳細描述，包含業務邏輯說明]
 * @param {Type} paramName - [參數說明]
 * @returns {ReturnType} [返回值說明]
 * @throws {ErrorType} [可能拋出的錯誤]
 * @example
 * ```typescript
 * const result = functionName(param);
 * ```
 */
```

### 命名規範

| 類型 | 規範 | 範例 |
|------|------|------|
| 文件名 | kebab-case | `use-document-upload.ts` |
| 組件 | PascalCase | `DocumentUploadForm.tsx` |
| 函數 | camelCase | `calculateConfidenceScore` |
| 常數 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| 類型/介面 | PascalCase | `DocumentMetadata` |
| Enum 值 | UPPER_SNAKE_CASE | `Status.PENDING_REVIEW` |

### TypeScript 規範

```typescript
// ✅ 優先使用 interface 定義物件類型
interface DocumentMetadata {
  id: string;
  fileName: string;
  forwarderId: string;
}

// ✅ 使用 type 定義聯合類型
type ConfidenceLevel = 'high' | 'medium' | 'low';

// ✅ 使用 Zod 進行運行時驗證
const DocumentSchema = z.object({
  id: z.string().cuid(),
  fileName: z.string().min(1),
  forwarderId: z.string().cuid(),
});

// ❌ 避免使用 any
function process(data: any) { ... }  // 不好

// ✅ 使用具體類型或 unknown
function process(data: DocumentMetadata) { ... }  // 好
```

---

## API 設計規範

### 路由結構
```
src/app/api/
├── v1/
│   ├── documents/
│   │   ├── route.ts              # GET (list), POST (create)
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET, PATCH, DELETE
│   │   │   └── review/
│   │   │       └── route.ts      # POST (submit review)
│   ├── forwarders/
│   │   └── route.ts
│   └── mappings/
│       └── route.ts
```

### 響應格式

**成功響應：**
```typescript
{
  success: true,
  data: T,
  meta?: {
    pagination?: { page, limit, total, totalPages }
  }
}
```

**錯誤響應 (RFC 7807)：**
```typescript
{
  type: "https://api.example.com/errors/validation",
  title: "Validation Error",
  status: 400,
  detail: "One or more fields failed validation",
  instance: "/api/v1/documents/123",
  errors?: {
    field: ["error message"]
  }
}
```

---

## 資料庫規範

### Prisma Schema 命名

```prisma
// 模型名稱: PascalCase 單數
model Document {
  // 欄位名稱: camelCase
  id            String   @id @default(cuid())
  fileName      String   @map("file_name")
  createdAt     DateTime @default(now()) @map("created_at")

  // 關聯欄位
  forwarderId   String   @map("forwarder_id")
  forwarder     Forwarder @relation(fields: [forwarderId], references: [id])

  // 表名: snake_case 複數
  @@map("documents")
}
```

### 遷移命名
```bash
# 格式: YYYYMMDDHHMMSS_描述
npx prisma migrate dev --name add_confidence_score_to_mappings
```

---

## 組件開發規範

### 組件結構

```typescript
'use client';  // 如果需要客戶端互動

import * as React from 'react';
// 1. React/Next.js imports
// 2. 第三方庫
// 3. 本地組件
// 4. Hooks
// 5. Utils
// 6. Types

interface ComponentProps {
  // Props 定義
}

/**
 * @component ComponentName
 * @description 組件功能描述
 */
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // 1. Hooks
  // 2. State
  // 3. Effects
  // 4. Handlers
  // 5. Render

  return (
    // JSX
  );
}
```

### 狀態管理模式

```typescript
// UI 狀態 - Zustand
// src/stores/ui-store.ts
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

// 伺服器狀態 - React Query
// src/hooks/use-documents.ts
export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => documentApi.list(filters),
  });
}
```

---

## 測試規範

### 測試文件命名
```
tests/
├── unit/
│   └── services/
│       └── mapping-service.test.ts
├── integration/
│   └── api/
│       └── documents.test.ts
└── e2e/
    └── document-workflow.spec.ts
```

### 測試覆蓋率目標
- **單元測試**: 核心業務邏輯 80%+
- **整合測試**: API 端點 70%+
- **E2E 測試**: 關鍵用戶流程

---

## Git 規範

### 分支命名
```
main                    # 生產分支
develop                 # 開發分支
feature/epic-X-story-Y  # 功能分支
fix/issue-description   # 修復分支
hotfix/critical-issue   # 緊急修復
```

### Commit Message 格式
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**類型：**
- `feat`: 新功能
- `fix`: Bug 修復
- `docs`: 文檔更新
- `style`: 代碼格式
- `refactor`: 重構
- `test`: 測試相關
- `chore`: 構建/工具

**範例：**
```
feat(document): add confidence score calculation

- Implement three-tier mapping logic
- Add confidence threshold constants
- Create unit tests for edge cases

Relates to: Epic-3, Story-3.2
```

---

## 開發工作流

### 本地開發啟動

```bash
# 1. 啟動資料庫
docker-compose up -d

# 2. 安裝依賴
npm install

# 3. 生成 Prisma Client
npx prisma generate

# 4. 執行資料庫遷移
npx prisma migrate dev

# 5. 啟動開發伺服器
npm run dev
```

### 代碼提交前檢查

```bash
# 類型檢查
npm run type-check

# Lint 檢查
npm run lint

# 格式化
npm run format

# 測試
npm run test
```

---

## AI 開發輔助指引

### 優先參考文檔

1. **Tech Specs**: `docs/03-stories/tech-specs/` - 各 Story 的技術規格
2. **Implementation Context**: `docs/04-implementation/implementation-context.md`
3. **PRD**: `docs/01-planning/prd/prd.md`

### 代碼生成規則

1. **必須添加標準註釋** - 按上述規範添加文件頭部和函數註釋
2. **遵循現有模式** - 參考 `src/` 下現有代碼風格
3. **類型安全優先** - 使用嚴格的 TypeScript 類型
4. **Zod 驗證** - API 輸入必須使用 Zod schema 驗證
5. **錯誤處理** - 使用 RFC 7807 格式返回錯誤

### 禁止事項

- ❌ 不要使用 `any` 類型
- ❌ 不要跳過錯誤處理
- ❌ 不要硬編碼敏感資訊
- ❌ 不要在客戶端組件中直接訪問資料庫
- ❌ 不要忽略 TypeScript 錯誤
- ❌ **不要擅自偏離設計規格**（見下方技術障礙處理規範）

---

## 🚨 技術障礙處理規範（必須遵守）

> **核心原則**: 遇到技術障礙時，**絕不擅自改變設計決策**。任何偏離原設計的方案必須獲得用戶確認。

### 禁止行為

| 禁止 | 說明 |
|------|------|
| ❌ 擅自替換組件 | 安裝失敗不能直接換其他組件 |
| ❌ 簡化功能 | 遇到困難不能減少功能 |
| ❌ 隱藏問題 | 不能不告知用戶就使用 workaround |

### 正確處理流程

```
遇到技術障礙
    ↓
1. 深入調查根本原因（嘗試至少 3 種方法）
    ↓
2. 如果無法解決 → 必須詢問用戶
   - 說明問題是什麼
   - 說明已嘗試的方案
   - 提供替代方案選項（含影響分析）
    ↓
3. 如果用戶接受替代方案
   - 記錄為技術債務
   - 在 Implementation Notes 詳細說明
```

### 詢問模板

```markdown
## ⚠️ 技術障礙報告

### 問題：[問題描述]

### 已嘗試：
1. [方案 1] → [失敗原因]
2. [方案 2] → [失敗原因]

### 替代方案：
| 選項 | 方案 | 影響 |
|------|------|------|
| A | 繼續調查 | 需要更多時間 |
| B | [替代方案] | [影響說明] |

請問您希望如何處理？
```

> 📋 完整規範請參考: `.claude/rules/technical-obstacles.md`

---

## 🔄 開發後文檔更新檢查（必須執行）

> **重要**: 每次完成開發任務後，AI 助手必須執行以下檢查流程，確保項目文檔保持最新狀態。

### 文檔更新決策流程

```
開發任務完成後，依序檢查：

1. 是否涉及技術棧/架構變更？
   └─ 是 → 更新 CLAUDE.md（技術棧、目錄結構等章節）

2. 是否新增/修改模組的公開 API？
   └─ 是 → 更新對應模組的 index.ts（導出、文檔註釋）

3. 是否發現新的開發規範/最佳實踐/踩坑經驗？
   └─ 是 → 更新對應的 .claude/rules/*.md

4. 是否完成 Epic/Story？
   └─ 是 → 更新 CLAUDE.md 項目進度追蹤表
```

### 各文檔更新時機

| 文檔類型 | 更新觸發條件 | 更新頻率 |
|---------|-------------|---------|
| **CLAUDE.md** | 技術棧變更、架構調整、目錄重組、Epic 完成 | 低 |
| **index.ts** | 新增服務、導出變更、常數調整 | 中 |
| **.claude/rules/*.md** | 新開發模式、踩坑經驗、團隊約定變更 | 中低 |

### 開發完成檢查清單

完成每個 Story 或重要功能後，AI 助手應自動執行以下檢查：

```markdown
## 📋 開發完成檢查

### 代碼品質
- [ ] 通過 TypeScript 類型檢查 (`npm run type-check`)
- [ ] 通過 ESLint 檢查 (`npm run lint`)
- [ ] 新增代碼包含標準 JSDoc 註釋

### 文檔同步
- [ ] 如涉及新模組 → 已更新/建立 index.ts
- [ ] 如涉及架構變更 → 已更新 CLAUDE.md
- [ ] 如發現新規範/踩坑 → 已更新 .claude/rules/
- [ ] 如完成 Story → 已更新項目進度

### 測試驗證
- [ ] 相關測試通過
- [ ] 新功能已有對應測試（如適用）
```

### 自動提醒規則

AI 助手在以下情況應**主動提醒**用戶考慮更新文檔：

1. **建立新的 service 文件** → 提醒更新 `src/services/index.ts`
2. **新增外部依賴** → 提醒檢查是否需更新 CLAUDE.md 技術棧
3. **修改 Prisma Schema** → 提醒檢查 `.claude/rules/database.md`
4. **建立新的 API 端點** → 提醒檢查 API 路由結構文檔
5. **遇到並解決複雜問題** → 提醒記錄到 `.claude/rules/` 作為經驗

### 範例：開發完成後的文檔更新

```bash
# 情境：完成 Story 3.2 - 新增映射服務

## 需要更新的文檔：

1. src/services/index.ts
   - 新增 export * from './mapping-service'
   - 更新 @features 列表

2. CLAUDE.md
   - 更新項目進度：Epic 3 狀態改為 🟡 進行中

3. .claude/rules/services.md（如發現新模式）
   - 記錄映射服務的設計模式
   - 記錄三層映射的實現要點
```

---

## 項目進度追蹤

### Epic 結構（12 個 Epic，83 個 Stories）

| Epic | 名稱 | 狀態 |
|------|------|------|
| 1 | 用戶認證與存取控制 | ✅ 已完成 |
| 2 | 手動發票上傳與 AI 處理 | 🟡 進行中 |
| 3 | 發票審核與修正工作流 | ⚪ 待開始 |
| 4 | 映射規則管理與自動學習 | ⚪ 待開始 |
| 5 | Forwarder 配置管理 | ⚪ 待開始 |
| 6 | 多城市數據隔離 | ⚪ 待開始 |
| 7 | 報表儀表板與成本追蹤 | ⚪ 待開始 |
| 8 | 審計追溯與合規 | ⚪ 待開始 |
| 9 | 自動化文件獲取 | ⚪ 待開始 |
| 10 | n8n 工作流整合 | ⚪ 待開始 |
| 11 | 對外 API 服務 | ⚪ 待開始 |
| 12 | 系統管理與監控 | ⚪ 待開始 |

---

## 語言設定

- **用戶溝通語言**: 繁體中文
- **代碼註釋**: 中文或英文（依據上下文）
- **Commit Message**: 英文
- **文檔**: 繁體中文為主

---

## 版本資訊

- **CLAUDE.md 版本**: 1.4.0
- **建立日期**: 2025-12-17
- **最後更新**: 2025-12-18
- **維護者**: Development Team

### 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.4.0 | 2025-12-18 | Story 2-2 完成：OCR 提取服務（Python FastAPI + Next.js API） |
| 1.3.0 | 2025-12-18 | Story 2-1 完成，Epic 2 開始進行 |
| 1.2.0 | 2025-12-18 | Epic 1 完成，更新項目進度和 Epic 名稱（中文化） |
| 1.1.0 | 2025-12-18 | 新增「開發後文檔更新檢查」章節 |
| 1.0.0 | 2025-12-17 | 初始版本 |
