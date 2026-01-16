# Story 16.7: 數據模版管理

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 建立和管理數據模版定義目標欄位結構,
**So that** FieldMappingConfig 可以關聯到特定模版，支援不同的輸出格式需求。

---

## 背景說明

### 問題陳述

目前 FieldMappingConfig 的目標欄位是靜態定義的 22 個固定欄位：
- 沒有「數據模版」的概念
- 無法支援不同的輸出格式需求（如 ERP 匯入、報表匯出）
- 不同系統可能需要不同的欄位結構

### 解決方案

新增 `DataTemplate` 模型：
1. 定義目標欄位結構（名稱、類型、必填、驗證規則）
2. 支援 GLOBAL 和 COMPANY 範圍
3. FieldMappingConfig 可關聯到特定模版
4. 提供預設系統模版（ERP 標準格式、費用報表格式等）

---

## Acceptance Criteria

### AC1: DataTemplate 模型

**Given** Prisma Schema
**When** 執行遷移
**Then** 正確建立 DataTemplate 表和關聯

### AC2: 模版 CRUD API

**Given** /api/v1/data-templates
**When** 執行 CRUD 操作
**Then**:
  - GET: 列表支援篩選和分頁
  - POST: 創建新模版
  - PATCH: 更新模版
  - DELETE: 軟刪除模版

### AC3: 模版管理 UI

**Given** /admin/data-templates 頁面
**When** 訪問頁面
**Then** 顯示模版列表、創建/編輯功能

### AC4: 欄位定義編輯

**Given** DataTemplateFieldEditor 組件
**When** 編輯欄位
**Then**:
  - 支援新增/刪除欄位
  - 支援編輯欄位屬性
  - 支援拖拽排序

### AC5: 關聯到 FieldMappingConfig

**Given** FieldMappingConfig 編輯頁面
**When** 選擇數據模版
**Then** 下拉選單顯示可用模版

### AC6: 預設模版

**Given** 系統初始化
**When** 執行 seed
**Then** 建立預設系統模版（ERP、報表、物流）

### AC7: 範圍支援

**Given** 創建模版
**When** 選擇範圍
**Then**:
  - GLOBAL: 所有公司可用
  - COMPANY: 僅特定公司可用

---

## Tasks / Subtasks

- [x] **Task 1: Prisma Schema** (AC: #1)
  - [x] 1.1 新增 DataTemplate 模型
  - [x] 1.2 更新 FieldMappingConfig 關聯
  - [x] 1.3 執行資料庫遷移

- [x] **Task 2: 類型定義** (AC: #1)
  - [x] 2.1 新增 `data-template.ts` 類型
  - [x] 2.2 定義 DataTemplateField 結構
  - [x] 2.3 定義 API 類型

- [x] **Task 3: Zod 驗證** (AC: #2)
  - [x] 3.1 新增 `data-template.ts` 驗證 Schema
  - [x] 3.2 實現創建/更新驗證

- [x] **Task 4: 服務層** (AC: #2)
  - [x] 4.1 新增 `data-template.service.ts`
  - [x] 4.2 實現 list/getById/create/update/delete

- [x] **Task 5: API 端點** (AC: #2)
  - [x] 5.1 新增 `/api/v1/data-templates/route.ts`
  - [x] 5.2 新增 `/api/v1/data-templates/[id]/route.ts`

- [x] **Task 6: Seed Data** (AC: #6)
  - [x] 6.1 新增 `data-templates.ts` seed
  - [x] 6.2 建立預設模版

- [x] **Task 7: UI 組件** (AC: #3, #4, #5)
  - [x] 7.1 DataTemplateList 列表頁面
  - [x] 7.2 DataTemplateForm 表單組件
  - [x] 7.3 DataTemplateFieldEditor 欄位編輯器

- [x] **Task 8: 整合與測試** (AC: #1-7)
  - [x] 8.1 TypeScript 類型檢查通過
  - [x] 8.2 API 功能測試
  - [x] 8.3 UI 功能驗證

---

## Dev Notes

### 依賴項

- **Story 13-4**: FieldMappingConfig（新增 dataTemplateId 欄位）

### 新增文件

```
prisma/
├── schema.prisma                    # 更新：新增 DataTemplate
└── seed/
    └── data-templates.ts            # 新增

src/
├── types/
│   └── data-template.ts             # 新增
├── validations/
│   └── data-template.ts             # 新增
├── services/
│   └── data-template.service.ts     # 新增
├── app/api/v1/data-templates/
│   ├── route.ts                     # 新增
│   └── [id]/route.ts                # 新增
├── app/(dashboard)/admin/data-templates/
│   ├── page.tsx                     # 新增
│   ├── new/page.tsx                 # 新增
│   └── [id]/page.tsx                # 新增
└── components/features/data-template/
    ├── DataTemplateList.tsx         # 新增
    ├── DataTemplateForm.tsx         # 新增
    └── DataTemplateFieldEditor.tsx  # 新增
```

### 預設模版

| 模版名稱 | 說明 | 欄位數量 |
|----------|------|----------|
| ERP 標準匯入格式 | 適用於大多數 ERP 系統 | 12 |
| 費用報表格式 | 管理報表匯出 | 8 |
| 物流追蹤格式 | 物流發票追蹤 | 11 |

### 欄位類型

| 類型 | 說明 |
|------|------|
| string | 文字 |
| number | 數字 |
| date | 日期 |
| currency | 金額 |
| boolean | 布林值 |
| array | 陣列 |

---

## Implementation Notes

### 完成日期
2026-01-13

### 實現摘要
- **Prisma 模型**: DataTemplate 支援 GLOBAL/COMPANY 範圍
- **API 端點**: 完整 CRUD 功能
- **預設模版**: 3 個系統內建模版
- **UI 組件**: 列表、表單、欄位編輯器

### 資料庫遷移

```bash
npx prisma migrate dev --name add_data_template_model
npx prisma db seed
```

### 向後兼容

- FieldMappingConfig 新增可選的 `dataTemplateId` 欄位
- 現有配置的 `dataTemplateId` 為 null

---

## Related Files

- `prisma/schema.prisma` - 更新
- `src/types/data-template.ts` - 新增
- `src/validations/data-template.ts` - 新增
- `src/services/data-template.service.ts` - 新增
- `src/app/api/v1/data-templates/` - 新增
- `src/components/features/data-template/` - 新增
