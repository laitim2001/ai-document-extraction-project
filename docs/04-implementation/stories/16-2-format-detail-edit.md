# Story 16.2: 格式詳情與編輯

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 查看和編輯文件格式的詳細信息,
**So that** 我可以自定義格式名稱和查看格式特徵。

---

## 背景說明

### 問題陳述

目前系統自動識別的文件格式資訊無法：
- 查看完整的格式詳情
- 編輯格式名稱（目前是自動生成）
- 查看格式的常見術語
- 查看與此格式關聯的文件

### 解決方案

建立格式詳情頁面，提供格式信息的查看和編輯功能。

---

## Acceptance Criteria

### AC1: 格式詳情頁面

**Given** 用戶點擊某個格式卡片
**When** 進入格式詳情頁
**Then**:
  - URL 為 `/companies/[id]/formats/[formatId]`
  - 顯示格式完整信息
  - 顯示返回按鈕

### AC2: 基本資訊顯示

**Given** 格式詳情頁
**When** 查看基本資訊 Tab
**Then** 顯示：
  - 格式名稱（可編輯）
  - 文件類型和子類型
  - 文件數量
  - 創建時間和更新時間
  - 格式特徵（features JSON 的可讀格式）

### AC3: 編輯功能

**Given** 格式詳情頁
**When** 點擊編輯按鈕
**Then**:
  - 進入編輯模式
  - 可修改格式名稱
  - 保存成功後顯示成功提示
  - 保存失敗顯示錯誤信息

### AC4: 常見術語列表

**Given** 格式詳情頁
**When** 查看「術語」Tab
**Then**:
  - 顯示該格式的常見術語列表
  - 術語按頻率排序
  - 可搜尋術語

### AC5: 文件列表

**Given** 格式詳情頁
**When** 查看「文件」Tab
**Then**:
  - 顯示屬於此格式的文件列表
  - 支援分頁
  - 點擊文件可跳轉到文件詳情

---

## Tasks / Subtasks

- [x] **Task 1: 新增 API 端點** (AC: #1, #2, #3)
  - [x] 1.1 建立 `src/app/api/v1/formats/[id]/route.ts`
  - [x] 1.2 實現 GET 方法（詳情）
  - [x] 1.3 實現 PATCH 方法（更新）
  - [x] 1.4 新增 `useFormatDetail` Hook

- [x] **Task 2: 建立詳情頁面** (AC: #1)
  - [x] 2.1 建立 `src/app/(dashboard)/companies/[id]/formats/[formatId]/page.tsx`
  - [x] 2.2 實現頁面佈局

- [x] **Task 3: 建立詳情視圖組件** (AC: #2)
  - [x] 3.1 建立 `src/components/features/formats/FormatDetailView.tsx`
  - [x] 3.2 實現 Tab 結構（基本資訊、術語、文件）
  - [x] 3.3 建立 `FormatBasicInfo.tsx`

- [x] **Task 4: 建立編輯表單** (AC: #3)
  - [x] 4.1 建立 `src/components/features/formats/FormatForm.tsx`
  - [x] 4.2 實現表單驗證（Zod + React Hook Form）
  - [x] 4.3 實現保存功能（useMutation）

- [x] **Task 5: 建立術語表格** (AC: #4)
  - [x] 5.1 建立 `src/components/features/formats/FormatTermsTable.tsx`
  - [x] 5.2 實現搜尋和分頁功能

- [x] **Task 6: 建立文件列表** (AC: #5)
  - [x] 6.1 建立 `src/components/features/formats/FormatFilesTable.tsx`
  - [x] 6.2 新增 API: `GET /api/v1/formats/[id]/files`
  - [x] 6.3 新增 `useFormatFiles` Hook

- [x] **Task 7: 驗證與測試** (AC: #1-5)
  - [x] 7.1 TypeScript 類型檢查通過
  - [x] 7.2 ESLint 檢查通過
  - [x] 7.3 API 響應驗證

---

## Dev Notes

### 依賴項

- **Story 16-1**: 格式列表 Tab（入口）
- **現有服務**: `document-format.service.ts`

### API 設計

#### GET /api/v1/formats/[id]

```typescript
// 響應
{
  success: true,
  data: {
    id: string,
    companyId: string,
    company: { id, name, code },
    documentType: DocumentType,
    documentSubtype: DocumentSubtype,
    name: string | null,
    features: {
      hasLineItems: boolean,
      hasHeaderLogo: boolean,
      currency: string,
      language: string,
      typicalFields: string[],
      layoutPattern: string
    },
    commonTerms: string[],
    fileCount: number,
    createdAt: Date,
    updatedAt: Date
  }
}
```

#### PATCH /api/v1/formats/[id]

```typescript
// 請求
{
  name?: string,
  features?: Partial<DocumentFormatFeatures>
}

// 響應
{
  success: true,
  data: DocumentFormat
}
```

### 組件結構

```
src/components/features/formats/
├── FormatDetailView.tsx     # 詳情視圖（含 Tabs）
├── FormatBasicInfo.tsx      # 基本資訊 Tab
├── FormatForm.tsx           # 編輯表單
├── FormatTermsTable.tsx     # 術語表格
└── FormatFilesTable.tsx     # 文件列表
```

---

## Implementation Notes

### 完成日期
2026-01-12

### 實現內容

#### 1. 類型擴展 (`src/types/document-format.ts`)
- 新增 `DocumentFormatDetail` 介面（完整格式詳情）
- 新增 `FormatLinkedFile` 介面（關聯文件資訊）
- 新增 `FormatFilesResponse` 介面（文件列表響應）

#### 2. API 端點
- **GET /api/v1/formats/[id]**: 獲取格式詳情（含公司資訊和文件數）
- **PATCH /api/v1/formats/[id]**: 更新格式名稱和特徵
- **GET /api/v1/formats/[id]/files**: 獲取格式關聯的文件列表（分頁）

#### 3. Hook 實現
- **useFormatDetail** (`src/hooks/use-format-detail.ts`): 格式詳情查詢和更新
- **useFormatFiles** (`src/hooks/use-format-files.ts`): 格式關聯文件列表查詢

#### 4. 組件實現 (`src/components/features/formats/`)
- **FormatDetailView**: 詳情視圖主組件，含 Tabs（基本資訊、術語、文件）
- **FormatBasicInfo**: 基本資訊卡片（格式名稱、類型、特徵、時間）
- **FormatForm**: 編輯對話框（React Hook Form + Zod 驗證）
- **FormatTermsTable**: 術語表格（搜尋、分頁）
- **FormatFilesTable**: 文件列表表格（分頁、狀態標籤）

#### 5. 頁面路由
- `/companies/[id]/formats/[formatId]`: 格式詳情頁面

### 文件變更
| 文件 | 變更類型 |
|------|----------|
| `src/types/document-format.ts` | 修改 - 新增類型 |
| `src/app/api/v1/formats/[id]/route.ts` | 新增 |
| `src/app/api/v1/formats/[id]/files/route.ts` | 新增 |
| `src/hooks/use-format-detail.ts` | 新增 |
| `src/hooks/use-format-files.ts` | 新增 |
| `src/components/features/formats/FormatDetailView.tsx` | 新增 |
| `src/components/features/formats/FormatBasicInfo.tsx` | 新增 |
| `src/components/features/formats/FormatForm.tsx` | 新增 |
| `src/components/features/formats/FormatTermsTable.tsx` | 新增 |
| `src/components/features/formats/FormatFilesTable.tsx` | 新增 |
| `src/components/features/formats/index.ts` | 修改 - 新增導出 |
| `src/app/(dashboard)/companies/[id]/formats/[formatId]/page.tsx` | 新增 |

### 後續工作
- Story 16-3: 識別規則配置（identificationRules Tab）
- Story 16-4: 專屬配置關聯（PromptConfig、FieldMappingConfig）

---

## Related Files

- `src/services/document-format.service.ts` - 需擴展
- `src/types/document-format.ts` - 類型定義
- `src/app/api/v1/formats/route.ts` - 參考
