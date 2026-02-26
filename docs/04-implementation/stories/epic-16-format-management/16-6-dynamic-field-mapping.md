# Story 16.6: 動態欄位映射配置

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 來源欄位列表動態生成並完成三層映射實現,
**So that** 可以使用 90+ 標準欄位和 GPT 提取的動態欄位進行映射配置。

---

## 背景說明

### 問題陳述

目前系統的欄位映射存在以下限制：
- `field-mapping.step.ts` 的 `applyThreeTierMapping` 是 stub 實現
- 來源欄位是靜態定義的 22 個欄位
- 沒有使用 `invoice-fields.ts` 的 90+ 標準欄位
- UI 不支援動態來源欄位選擇

### 解決方案

1. 新增 `source-field.service.ts` 合併標準欄位和提取欄位
2. 新增提取欄位 API 獲取歷史提取的欄位名稱
3. 完成 `field-mapping.step.ts` 調用 DynamicMappingService
4. 新增 SourceFieldCombobox UI 組件

---

## Acceptance Criteria

### AC1: 動態來源欄位

**Given** FieldMappingConfig 編輯頁面
**When** 選擇來源欄位
**Then** 顯示標準欄位 (90+) 和提取欄位的合併列表

### AC2: 來源欄位 UI

**Given** SourceFieldCombobox 組件
**When** 開啟下拉選單
**Then**:
  - 按分類分組顯示欄位
  - 支援搜尋過濾
  - 支援自訂欄位輸入

### AC3: 三層映射完成

**Given** 文件處理流程
**When** FieldMappingStep 執行
**Then** 正確調用 DynamicMappingService.mapFields()

### AC4: 映射結果存儲

**Given** 映射執行完成
**When** 檢查 context
**Then** context.mappedFields 正確填充映射結果

### AC5: 未映射欄位追蹤

**Given** 部分欄位無法映射
**When** 映射執行完成
**Then** context.unmappedFields 正確記錄

### AC6: 自訂欄位支援

**Given** SourceFieldCombobox
**When** 搜尋結果為空
**Then** 允許手動輸入自訂欄位名稱

### AC7: 提取欄位 API

**Given** GET /api/v1/formats/:id/extracted-fields
**When** 請求該格式的提取欄位
**Then** 返回歷史提取的欄位名稱和樣本值

---

## Tasks / Subtasks

- [x] **Task 1: 來源欄位服務** (AC: #1)
  - [x] 1.1 新增 `source-field.service.ts`
  - [x] 1.2 實現 `getStandardSourceFields()`
  - [x] 1.3 實現 `getAvailableSourceFields()`
  - [x] 1.4 實現 `getGroupedSourceFields()`

- [x] **Task 2: 提取欄位 API** (AC: #7)
  - [x] 2.1 新增 `/api/v1/formats/[id]/extracted-fields/route.ts`
  - [x] 2.2 查詢最近 20 個已處理文件的提取結果
  - [x] 2.3 返回欄位名稱、出現次數、樣本值

- [x] **Task 3: 完成 field-mapping.step.ts** (AC: #3, #4, #5)
  - [x] 3.1 修改 `applyThreeTierMapping()` 方法
  - [x] 3.2 按 FORMAT → COMPANY → GLOBAL 順序查找配置
  - [x] 3.3 調用 `DynamicMappingService.mapFields()`
  - [x] 3.4 實現 `directMapping()` fallback

- [x] **Task 4: SourceFieldCombobox 組件** (AC: #2, #6)
  - [x] 4.1 新增 `SourceFieldCombobox.tsx`
  - [x] 4.2 實現分組顯示
  - [x] 4.3 實現搜尋功能
  - [x] 4.4 實現自訂欄位輸入

- [x] **Task 5: 整合與測試** (AC: #1-7)
  - [x] 5.1 TypeScript 類型檢查通過
  - [x] 5.2 API 功能測試
  - [x] 5.3 UI 功能驗證

---

## Dev Notes

### 依賴項

- **Story 16-7**: DataTemplate 模型
- **Story 13-4**: FieldMappingConfig
- **Epic 15**: 統一處理流程

### 新增文件

```
src/
├── services/
│   ├── field-mapping/
│   │   └── source-field.service.ts       # 新增
│   └── unified-processor/steps/
│       └── field-mapping.step.ts         # 更新
├── components/features/
│   └── formats/
│       └── SourceFieldCombobox.tsx       # 新增
└── app/api/v1/formats/[id]/
    └── extracted-fields/
        └── route.ts                      # 新增
```

### 欄位分類

| 分類 | 說明 | 欄位數量 |
|------|------|----------|
| basic | 基本資訊 | ~10 |
| shipper | 發貨人資訊 | ~8 |
| consignee | 收貨人資訊 | ~8 |
| shipping | 運輸資訊 | ~15 |
| package | 包裝資訊 | ~10 |
| charges | 費用明細 | ~20 |
| reference | 參考編號 | ~10 |
| payment | 付款資訊 | ~8 |
| extracted | 提取欄位 | 動態 |

---

## Implementation Notes

### 完成日期
2026-01-13

### 實現摘要
- **來源欄位服務**: 合併 90+ 標準欄位和動態提取欄位
- **提取欄位 API**: 查詢歷史提取結果獲取動態欄位
- **三層映射**: FORMAT → COMPANY → GLOBAL 順序查找配置
- **SourceFieldCombobox**: 支援分組、搜尋、自訂輸入

### 映射優先級

```
1. 優先使用 context.mappingConfig.fieldMappingConfigId（如果存在）
2. 查找 FORMAT 級別配置（documentFormatId）
3. 查找 COMPANY 級別配置（companyId）
4. 查找 GLOBAL 級別配置
5. 如果都沒有，使用直接映射（directMapping）
```

---

## Related Files

- `src/services/field-mapping/source-field.service.ts` - 新增
- `src/services/unified-processor/steps/field-mapping.step.ts` - 更新
- `src/components/features/formats/SourceFieldCombobox.tsx` - 新增
- `src/app/api/v1/formats/[id]/extracted-fields/route.ts` - 新增
- `src/types/invoice-fields.ts` - 參考（90+ 標準欄位）
