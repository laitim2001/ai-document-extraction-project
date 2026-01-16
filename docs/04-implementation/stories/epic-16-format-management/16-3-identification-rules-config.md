# Story 16.3: 識別規則配置

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 配置文件格式的識別規則,
**So that** 系統可以更準確地識別新上傳的文件屬於哪種格式。

---

## 背景說明

### 問題陳述

目前系統的格式識別完全依賴 GPT Vision 的自動識別，用戶無法：
- 定義格式的識別特徵（關鍵字、Logo 位置等）
- 設置格式的識別優先級
- 手動調整識別規則

### 解決方案

新增可配置的識別規則，包括：
- Logo 位置和特徵
- 關鍵字列表
- 版面特徵描述
- 識別優先級

---

## Acceptance Criteria

### AC1: 識別規則 Tab

**Given** 格式詳情頁
**When** 點擊「識別規則」Tab
**Then**:
  - 顯示當前配置的識別規則
  - 顯示「編輯規則」按鈕

### AC2: Logo 特徵配置

**Given** 識別規則編輯器
**When** 配置 Logo 特徵
**Then**:
  - 可添加多個 Logo 特徵
  - 每個特徵包含：位置（top-left, top-right 等）、描述
  - 可刪除已添加的特徵

### AC3: 關鍵字配置

**Given** 識別規則編輯器
**When** 配置關鍵字
**Then**:
  - 可添加多個關鍵字
  - 支援標籤式輸入（tag input）
  - 可刪除已添加的關鍵字

### AC4: 版面特徵配置

**Given** 識別規則編輯器
**When** 配置版面特徵
**Then**:
  - 可輸入版面特徵描述（文本區域）
  - 提供輸入提示

### AC5: 優先級設置

**Given** 識別規則編輯器
**When** 設置優先級
**Then**:
  - 可設置 0-100 的優先級數值
  - 優先級越高，越優先匹配
  - 顯示優先級說明

### AC6: 規則保存

**Given** 配置完成的識別規則
**When** 點擊保存
**Then**:
  - 規則保存成功
  - 顯示成功提示
  - 返回查看模式

---

## Tasks / Subtasks

- [x] **Task 1: Prisma Schema 更新** (AC: #1-5)
  - [x] 1.1 新增 `identificationRules` 欄位到 DocumentFormat
  - [x] 1.2 執行 Prisma 遷移
  - [x] 1.3 定義 TypeScript 類型

- [x] **Task 2: 更新 API** (AC: #6)
  - [x] 2.1 更新 GET `/api/v1/formats/[id]` 返回 identificationRules
  - [x] 2.2 更新 PATCH `/api/v1/formats/[id]` 支援 identificationRules
  - [x] 2.3 新增 Zod 驗證 schema

- [x] **Task 3: 建立識別規則編輯器** (AC: #1-5)
  - [x] 3.1 建立 `src/components/features/formats/IdentificationRulesEditor.tsx`
  - [x] 3.2 實現 Logo 特徵編輯器
  - [x] 3.3 實現關鍵字標籤輸入
  - [x] 3.4 實現版面特徵文本區域
  - [x] 3.5 實現優先級滑塊

- [x] **Task 4: 建立規則查看組件** (AC: #1) - 已合併到編輯器組件
  - [x] 4.1 IdentificationRulesEditor 同時支援查看和編輯
  - [x] 4.2 實現規則的只讀顯示（通過初始狀態）

- [x] **Task 5: 整合到格式詳情頁** (AC: #1, #6)
  - [x] 5.1 新增「識別規則」Tab
  - [x] 5.2 實現編輯/查看模式（編輯器內建）

- [x] **Task 6: 驗證與測試** (AC: #1-6)
  - [x] 6.1 TypeScript 類型檢查通過
  - [x] 6.2 ESLint 檢查通過
  - [x] 6.3 Prisma 遷移測試
  - [x] 6.4 API 功能測試

---

## Dev Notes

### Prisma Schema 變更

```prisma
model DocumentFormat {
  // ... 現有欄位

  // 新增：識別規則
  identificationRules   Json?   @map("identification_rules")
}
```

### 識別規則類型定義

```typescript
// src/types/document-format.ts

export interface LogoPattern {
  position: 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'center';
  description: string;
}

export interface IdentificationRules {
  logoPatterns: LogoPattern[];
  keywords: string[];
  layoutHints: string;
  priority: number;  // 0-100
}
```

### Zod 驗證 Schema

```typescript
const logoPatternSchema = z.object({
  position: z.enum(['top-left', 'top-right', 'top-center', 'bottom-left', 'bottom-right', 'center']),
  description: z.string().min(1).max(200),
});

const identificationRulesSchema = z.object({
  logoPatterns: z.array(logoPatternSchema).max(10),
  keywords: z.array(z.string().min(1).max(100)).max(50),
  layoutHints: z.string().max(1000).optional(),
  priority: z.number().int().min(0).max(100).default(50),
});
```

### 依賴項

- **Story 16-2**: 格式詳情與編輯（基礎架構）

### 組件結構

```
src/components/features/formats/
├── IdentificationRulesEditor.tsx   # 規則編輯器
├── IdentificationRulesView.tsx     # 規則查看
├── LogoPatternEditor.tsx           # Logo 特徵編輯
└── KeywordTagInput.tsx             # 關鍵字標籤輸入
```

---

## Implementation Notes

### 完成日期
2026-01-12

### 實現摘要
- **Prisma Schema**: 新增 `identificationRules Json? @map("identification_rules")` 欄位到 DocumentFormat model
- **類型定義**: 新增 `LogoPosition`, `LogoPattern`, `IdentificationRules` 類型到 `src/types/document-format.ts`
- **驗證 Schema**: 建立 `src/validations/document-format.ts` 包含 Zod 驗證 schema
- **API 更新**: 更新 `/api/v1/formats/[id]` GET/PATCH 支援 identificationRules
- **組件實現**:
  - `LogoPatternEditor.tsx` - Logo 特徵編輯器（位置選擇 + 描述輸入）
  - `KeywordTagInput.tsx` - 關鍵字標籤輸入（Enter 新增、X 刪除）
  - `IdentificationRulesEditor.tsx` - 主編輯器（四個區塊：Logo/關鍵字/版面/優先級）
- **整合**: FormatDetailView 新增「識別規則」Tab

### 技術決策
1. 使用 `prisma db push` 同步 schema（因資料庫 drift 問題無法使用 migrate）
2. 識別規則直接替換而非合併（與 features 行為不同）
3. 編輯器組件合併查看和編輯功能（簡化架構）

### 文件結構
```
src/
├── types/document-format.ts           # 新增識別規則類型
├── validations/document-format.ts     # 新增 Zod schema
├── components/features/formats/
│   ├── LogoPatternEditor.tsx          # 新增
│   ├── KeywordTagInput.tsx            # 新增
│   ├── IdentificationRulesEditor.tsx  # 新增
│   └── FormatDetailView.tsx           # 更新（新增 Tab）
└── app/api/v1/formats/[id]/route.ts   # 更新
```

---

## Related Files

- `prisma/schema.prisma` - 需修改
- `src/types/document-format.ts` - 需擴展
- `src/services/document-format.service.ts` - 需更新
