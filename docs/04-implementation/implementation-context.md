# Implementation Context Document

> **用途**: 這份文檔是 AI 助手在實現每個 Story 前必須閱讀的上下文指引。
> **目標**: 確保從初期概念到具體實現的一致性。
> **原則**: 簡而精，需要深入時提供文件索引。

---

## 目錄

1. [核心使命與商業目標](#1-核心使命與商業目標)
2. [關鍵設計決策](#2-關鍵設計決策)
3. [統一編碼慣例](#3-統一編碼慣例)
4. [核心數據模型與業務規則](#4-核心數據模型與業務規則)
5. [UX 實現原則](#5-ux-實現原則)
6. [約束、依賴與驗證](#6-約束依賴與驗證)
7. [快速參考](#7-快速參考)

---

## 1. 核心使命與商業目標

### 1.1 我們要解決什麼問題？

**核心痛點**: SCM 部門每年處理 450,000-500,000 張來自 45+ 個 Forwarder 的發票，格式各異，人工處理效率低且容易出錯。

**量化影響**:
- 每張發票人工處理需 5 分鐘 → 年耗費 ~41,667 人時
- 100+ 種格式需映射到 90 個統一 Header
- 人工錯誤率 ~5%

### 1.2 目標用戶與成功定義

| 用戶 | 角色 | 痛點 | 成功標準 |
|------|------|------|----------|
| **Amy** | 數據處理專員 | 每天處理 150-200 張發票，重複性工作消耗精力 | 處理時間從 5 分鐘降至 <1 分鐘，錯誤率從 5% 降至 <1% |
| **David** | SCM 經理 | 只能看到「大數」，缺乏費用明細做分析 | 100% 費用明細覆蓋，可做供應商比較分析 |

### 1.3 這意味著什麼？

實現任何 Story 時，請自問：
- ✅ 這會減少 Amy 的工作負擔嗎？
- ✅ 這會產出 David 需要的完整費用明細嗎？
- ✅ 這會讓用戶覺得「AI 在幫助我」而非「AI 在取代我」嗎？

> 📄 **深入閱讀**: `docs/00-discovery/product-brief-*.md`

---

## 2. 關鍵設計決策

### 2.1 三層映射架構

**為什麼？** 傳統方案需維護 9,000 條規則 (100 格式 × 90 欄位)，本架構只需 ~800 條。

```
┌─────────────────────────────────────────────────────────┐
│ TIER 1: Universal Mapping (通用層)                       │
│ • 覆蓋 70-80% 常見術語，所有 Forwarder 通用              │
│ • 例: "OCEAN FREIGHT" / "SEA FREIGHT" → Freight         │
├─────────────────────────────────────────────────────────┤
│ TIER 2: Forwarder-Specific Override (特定覆蓋層)         │
│ • 只記錄該 Forwarder 與通用規則「不同」的映射            │
│ • 例: CEVA 的 "ADMIN FEE" → Docs Fee                    │
├─────────────────────────────────────────────────────────┤
│ TIER 3: LLM Classification (AI 兜底)                    │
│ • 當以上都無法匹配時，使用 GPT-5.2 智能分類              │
│ • 輸出信心度評分                                        │
└─────────────────────────────────────────────────────────┘
```

**查詢優先順序**: Tier 1 → Tier 2 → Tier 3 (LLM)

**⛔ 不要這樣做**:
- 不要為每個 Forwarder 建立完整的獨立映射表
- 不要跳過 Universal Mapping 直接調用 LLM（成本考量）
- 不要在沒有快取機制的情況下每次都調用 LLM

> 📄 **深入閱讀**: `docs/00-discovery/past-discussions/Data_Mapping_Strategy.md`

---

### 2.2 信心度分流機制

**為什麼？** 平衡自動化效率與人工品控。

| 信心度 | 路徑 | 行為 | 用戶體驗 |
|--------|------|------|----------|
| ≥90% | `AUTO_APPROVE` | 自動通過，無需人工 | 用戶不需介入 |
| 70-89% | `QUICK_REVIEW` | 快速確認 | 一鍵確認或修正 |
| <70% | `FULL_REVIEW` | 完整審核 | 詳細檢查所有欄位 |

**閾值來源**: 基於業務需求，90% 以上視為「可信賴」，70% 以下需要人工確認。

**⛔ 不要這樣做**:
- 不要硬編碼閾值，應從配置讀取（未來可調整）
- 不要讓 AUTO_APPROVE 的發票完全跳過審計記錄

---

### 2.3 技術棧選擇

| 層級 | 選擇 | 原因 |
|------|------|------|
| **前端框架** | Next.js 15 (App Router) | Server Components + 企業支援 |
| **UI 組件** | shadcn/ui + Tailwind | 可定制、無依賴鎖定、WCAG 支援 |
| **狀態管理** | Zustand (UI) + React Query (Server) | 職責分離，避免混用 |
| **ORM** | Prisma | 類型安全、遷移管理、成熟穩定 |
| **認證** | NextAuth v5 + Azure AD | 企業 SSO 整合 |
| **AI 服務** | Azure Document Intelligence + OpenAI | OCR + 智能分類 |
| **Python 服務** | FastAPI | AI 處理、映射邏輯 |

**⛔ 不要這樣做**:
- 不要在前端直接調用 Python 服務（必須經過 Next.js BFF）
- 不要混用 Zustand 和 React Query 管理同一份數據
- 不要繞過 Prisma 直接寫 SQL（除非有特殊性能需求）

> 📄 **深入閱讀**: `docs/02-architecture/sections/core-architecture-decisions.md`

---

## 3. 統一編碼慣例

### 3.1 命名規範

| 類別 | 規範 | 範例 |
|------|------|------|
| **Prisma Model** | PascalCase 單數 | `Invoice`, `ForwarderProfile` |
| **Prisma Field** | camelCase + @map snake_case | `invoiceNumber @map("invoice_number")` |
| **Enum Value** | SCREAMING_SNAKE_CASE | `REVIEW_REQUIRED`, `AUTO_APPROVE` |
| **React Component** | PascalCase | `InvoiceReviewPanel.tsx` |
| **Hook** | camelCase + use 前綴 | `useInvoiceExtraction.ts` |
| **API Route** | kebab-case | `/api/invoices/[id]/approve` |
| **Constant** | SCREAMING_SNAKE_CASE | `MAX_BATCH_SIZE` |

### 3.2 API 響應格式 (強制)

所有 API 必須遵循此格式：

```typescript
// 成功響應
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

// 錯誤響應 (RFC 7807)
interface ErrorResponse {
  success: false;
  error: {
    type: string;      // 錯誤類型 URI
    title: string;     // 人類可讀標題
    status: number;    // HTTP 狀態碼
    detail: string;    // 詳細說明
    instance?: string; // 問題發生的 URI
  };
}
```

### 3.3 狀態管理分層

```
┌─────────────────────────────────────────────────────────┐
│ UI 狀態 (Zustand)                                       │
│ • selectedInvoiceId, filterStatus, viewMode            │
│ • 用戶偏好、界面狀態                                    │
├─────────────────────────────────────────────────────────┤
│ 伺服器狀態 (React Query)                                │
│ • 發票列表、Forwarder 數據、提取結果                    │
│ • 緩存、重試、樂觀更新                                  │
└─────────────────────────────────────────────────────────┘
```

**⛔ 不要這樣做**:
- 不要用 Zustand 存放從 API 獲取的數據
- 不要用 React Query 管理純前端的 UI 狀態

> 📄 **深入閱讀**: `docs/02-architecture/sections/implementation-patterns-consistency-rules.md`

---

## 4. 核心數據模型與業務規則

### 4.1 核心實體關係

```
User ──────────────────┐
  │                    │
  │ uploads            │ reviews
  ▼                    ▼
Document ──────────► ExtractionResult ◄────── MappingRule
  │                    │                         │
  │ identified_as      │ confidence              │ belongs_to
  ▼                    ▼                         ▼
Forwarder ◄────────── ProcessingQueue         Forwarder
```

### 4.2 關鍵 Enum 定義

```typescript
// 發票處理狀態
enum DocumentStatus {
  UPLOADED = 'UPLOADED',           // 已上傳
  EXTRACTING = 'EXTRACTING',       // OCR 處理中
  EXTRACTED = 'EXTRACTED',         // OCR 完成
  MAPPING = 'MAPPING',             // 映射處理中
  PENDING_REVIEW = 'PENDING_REVIEW', // 待審核
  APPROVED = 'APPROVED',           // 已批准
  REJECTED = 'REJECTED',           // 已拒絕
  FAILED = 'FAILED'                // 處理失敗
}

// 信心度等級
enum ConfidenceLevel {
  HIGH = 'HIGH',     // ≥90%
  MEDIUM = 'MEDIUM', // 70-89%
  LOW = 'LOW'        // <70%
}

// 處理路徑
enum ProcessingPath {
  AUTO_APPROVE = 'AUTO_APPROVE',   // ≥90%
  QUICK_REVIEW = 'QUICK_REVIEW',   // 70-89%
  FULL_REVIEW = 'FULL_REVIEW'      // <70%
}

// 用戶角色
enum UserRole {
  DATA_PROCESSOR = 'DATA_PROCESSOR',
  CITY_MANAGER = 'CITY_MANAGER',
  SUPER_USER = 'SUPER_USER',
  ADMIN = 'ADMIN'
}
```

### 4.3 業務規則清單

#### 信心度計算公式

```typescript
overallConfidence =
  ocrConfidence * 0.30 +          // OCR 信心度 30%
  ruleMatchScore * 0.30 +          // 規則匹配分數 30%
  formatValidationScore * 0.25 +   // 格式驗證分數 25%
  historicalAccuracy * 0.15        // 歷史準確率 15%
```

#### 學習規則升級條件

```
同一 Forwarder + 同一術語 + 同一修正結果
      ↓
  被確認 3 次以上
      ↓
  自動加入 Tier 2 (Forwarder-Specific Mapping)
      ↓
  is_verified = false (待管理員確認)
```

#### 權限控制矩陣

| 角色 | 處理發票 | 查看報表 | 管理規則 | 系統配置 |
|------|:--------:|:--------:|:--------:|:--------:|
| DataProcessor | ✅ | ❌ | ❌ | ❌ |
| CityManager | ✅ | ✅ | ❌ | ❌ |
| SuperUser | ✅ | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |

---

## 5. UX 實現原則

### 5.1 信心度視覺系統 (三重編碼)

| 信心度 | 顏色 | 形狀 | CSS 變數 |
|--------|------|------|----------|
| ≥90% | 綠色 | ✓ 勾號 | `--confidence-high: 142 76% 36%` |
| 70-89% | 黃色 | ○ 圓圈 | `--confidence-medium: 45 93% 47%` |
| <70% | 紅色 | △ 三角 | `--confidence-low: 0 84% 60%` |

**為什麼三重編碼？** 確保色盲用戶也能辨識，符合 WCAG 2.1 AA 標準。

### 5.2 正向措辭原則

| ❌ 不要這樣說 | ✅ 應該這樣說 |
|-------------|-------------|
| AI 出錯了 | 感謝你幫忙教 AI |
| 處理失敗 | 需要你的協助完成 |
| 錯誤率 5% | 準確率 95% |
| 被拒絕 | 需要進一步確認 |

### 5.3 組件使用優先級

| 優先級 | 組件 | 用途 |
|--------|------|------|
| P0 | Table, DataTable | 發票列表、審核隊列 |
| P0 | Badge | 信心度標識、狀態標籤 |
| P0 | Button | 確認/修正/批准操作 |
| P0 | ResizablePanel | PDF 對照審核視圖 |
| P1 | Dialog, Sheet | 詳情面板、確認對話框 |
| P1 | Toast (Sonner) | 操作反饋 |

> 📄 **深入閱讀**: `docs/01-planning/ux/sections/design-system-foundation.md`

---

## 6. 約束、依賴與驗證

### 6.1 絕對禁止事項

| 禁止事項 | 原因 | 替代方案 |
|---------|------|---------|
| 跳過審計日誌 | 合規要求，7 年保留 | 所有變更必須記錄 |
| 前端存放敏感數據 | 安全風險 | 使用 Server Component 或 httpOnly cookie |
| 繞過權限檢查 | 數據安全 | 每個 API Route 驗證角色 |
| 直接調用 Python 服務 | 架構邊界 | 經過 Next.js BFF 層 |
| 手動修改資料庫 | 遷移追溯 | 使用 Prisma Migrate |
| 硬編碼閾值/配置 | 維護困難 | 使用環境變數或配置表 |

### 6.2 Epic 依賴關係

```
Epic 1 (認證) ──────────────────────────────────────┐
     │                                              │
     ▼                                              │
Epic 2 (AI 處理) ──► Epic 3 (審核工作流)            │
     │                    │                         │
     │                    ▼                         │
     └──────────────► Epic 4 (自動學習) ◄───────────┘
                          │
                          ▼
                     Epic 5-12 (擴展功能)
```

**必須先完成**:
1. Epic 1 Story 1-0: 專案初始化與基礎架構
2. Epic 1 Story 1-1: Azure AD SSO 登入
3. Epic 2 Story 2-1: 文件上傳介面

### 6.3 Story 完成驗證清單

每個 Story 完成後，確認以下項目：

- [ ] **功能驗證**: 所有 Acceptance Criteria 都已滿足
- [ ] **API 格式**: 響應符合 RFC 7807 標準
- [ ] **錯誤處理**: 邊界情況有適當處理
- [ ] **權限檢查**: API 有角色驗證
- [ ] **審計日誌**: 關鍵操作有記錄
- [ ] **類型安全**: 無 `any` 類型濫用
- [ ] **命名一致**: 遵循命名規範
- [ ] **UX 一致**: 信心度顏色、措辭符合規範

---

## 7. 快速參考

### 7.1 目錄結構速查

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 認證頁面群組
│   ├── (dashboard)/        # 主功能頁面群組
│   └── api/                # API Routes (BFF)
├── components/
│   ├── ui/                 # shadcn/ui 組件
│   └── features/           # 業務功能組件
├── lib/                    # 核心工具庫
├── hooks/                  # 自定義 Hooks
├── stores/                 # Zustand Stores
├── types/                  # TypeScript 類型
└── services/               # 服務層

python-services/
├── extraction/             # AI 提取服務 (port 8000)
├── mapping/                # Forwarder 識別服務 (port 8001)
└── learning/               # 學習服務 (port 8002)
```

### 7.2 常用 API 端點

| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/invoices` | GET, POST | 發票列表、上傳 |
| `/api/invoices/[id]` | GET, PATCH | 發票詳情、更新 |
| `/api/extraction` | POST | 觸發 OCR 提取 |
| `/api/review` | GET | 待審核列表 |
| `/api/review/[id]/approve` | POST | 批准發票 |
| `/api/forwarders` | GET, POST | Forwarder 管理 |
| `/api/mapping/universal` | GET | Universal Mapping 規則 |

### 7.3 環境變數清單

```bash
# Azure AD
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# Database
DATABASE_URL=

# Azure AI Services
AZURE_DI_ENDPOINT=
AZURE_DI_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=

# Python Services
OCR_SERVICE_URL=http://localhost:8000
MAPPING_SERVICE_URL=http://localhost:8001

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

### 7.4 文件索引

| 主題 | 文件路徑 |
|------|---------|
| 產品願景 | `docs/00-discovery/product-brief-*.md` |
| 功能需求 | `docs/01-planning/prd/prd.md` |
| UX 設計 | `docs/01-planning/ux/ux-design-specification.md` |
| 架構決策 | `docs/02-architecture/architecture.md` |
| Epic 總覽 | `docs/03-epics/epics.md` |
| 實現模式 | `docs/02-architecture/sections/implementation-patterns-consistency-rules.md` |
| 映射策略 | `docs/00-discovery/past-discussions/Data_Mapping_Strategy.md` |

---

## 使用指南

### AI 助手實現 Story 時的工作流程

```
1. 讀取本文檔 (implementation-context.md)
   ↓
2. 理解核心使命和設計決策
   ↓
3. 讀取對應的 Tech Spec (tech-spec-story-X-X.md)
   ↓
4. 如有需要，查閱索引中的深入文檔
   ↓
5. 開始實現，遵循編碼慣例
   ↓
6. 完成後，使用驗證清單確認
```

### 遇到不確定的情況時

1. **設計決策衝突**: 優先參考本文檔第 2 節
2. **命名不確定**: 參考第 3.1 節命名規範
3. **業務規則疑問**: 參考第 4.3 節或對應 Story 文檔
4. **UX 不確定**: 參考第 5 節或 UX 設計文檔

---

*最後更新: 2025-12-16*
*版本: 1.0*
