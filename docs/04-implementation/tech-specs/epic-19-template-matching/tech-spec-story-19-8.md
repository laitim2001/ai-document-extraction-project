# Tech Spec: Story 19.8 - 模版匹配整合測試與驗證

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-8

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 19.8 |
| **Epic** | Epic 19 - 數據模版匹配與輸出 |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | Story 19-1 ~ 18-7 |

---

## Objective

建立整合測試頁面，驗證完整的模版匹配流程。

---

## Implementation Guide

### Phase 1: 頁面路由

```
/admin/test/template-matching    # 整合測試頁面
```

### Phase 2: 測試向導步驟

```typescript
type TestStep =
  | 'select-data'      // Step 1: 選擇測試數據
  | 'select-template'  // Step 2: 選擇數據模版
  | 'review-mapping'   // Step 3: 查看映射規則
  | 'execute-match'    // Step 4: 執行匹配
  | 'view-results'     // Step 5: 檢視結果
  | 'test-export';     // Step 6: 導出測試

interface TestState {
  selectedDocuments: string[];
  selectedTemplate: string | null;
  resolvedMappings: TemplateFieldMappingRule[];
  instanceId: string | null;
  matchResult: MatchResult | null;
  exportResult: ExportResult | null;
}
```

### Phase 3: 組件結構

```typescript
// 測試頁面組件結構
TestWizard
├── StepIndicator
├── StepContent
│   ├── TestDataSelector      // Step 1
│   │   ├── DocumentPicker
│   │   └── MockDataGenerator
│   ├── TemplatePreview       // Step 2
│   │   └── FieldsList
│   ├── MappingPreview        // Step 3
│   │   └── MappingTable
│   ├── MatchExecutor         // Step 4
│   │   └── ProgressBar
│   ├── ResultViewer          // Step 5
│   │   ├── StatsCards
│   │   └── DataTable
│   └── ExportTester          // Step 6
│       └── FileDownloader
└── TestReportGenerator
```

### Phase 4: 模擬數據

```typescript
const MOCK_DOCUMENTS = [
  {
    id: 'mock-1',
    mappedFields: {
      invoice_number: 'INV-2026-001',
      invoice_date: '2026-01-15',
      vendor_name: 'DHL Express',
      sea_freight: 500,
      terminal_handling: 100,
      documentation_fee: 50,
      total_amount: 650,
      shipment_no: 'S001',
    },
  },
  {
    id: 'mock-2',
    mappedFields: {
      invoice_number: 'INV-2026-002',
      vendor_name: 'Maersk',
      sea_freight: 450,
      terminal_handling: 120,
      total_amount: 615,
      shipment_no: 'S002',
    },
  },
  {
    id: 'mock-3',
    mappedFields: {
      invoice_number: 'INV-2026-003',
      vendor_name: 'CMA CGM',
      sea_freight: 480,
      // 缺少必填欄位 - 測試錯誤場景
      shipment_no: 'S003',
    },
  },
];
```

### Phase 5: 測試報告格式

```markdown
# 模版匹配整合測試報告

**測試時間**: 2026-01-22 15:30:45
**測試者**: admin@example.com

## 測試配置
- 測試數據: 3 個 Documents
- 目標模版: 海運費用報表
- 映射配置: GLOBAL 預設映射

## 測試結果

### Step 1: 數據選擇 ✅
### Step 2: 模版選擇 ✅
### Step 3: 映射解析 ✅
### Step 4: 執行匹配 ⚠️ (1 行錯誤)
### Step 5: 結果驗證 ✅
### Step 6: 導出測試 ✅

## 總結
測試通過率: 5/6 (83%)
```

---

## File Structure

```
src/app/[locale]/(dashboard)/admin/test/template-matching/
├── page.tsx
└── components/
    ├── TestWizard.tsx
    ├── TestDataSelector.tsx
    ├── TemplatePreview.tsx
    ├── MappingPreview.tsx
    ├── MatchExecutor.tsx
    ├── ResultViewer.tsx
    ├── ExportTester.tsx
    └── TestReportGenerator.tsx
```

---

## Testing Checklist

- [ ] 測試向導流程完整
- [ ] 模擬數據可用
- [ ] 真實文件可選擇
- [ ] 映射規則顯示正確
- [ ] 匹配執行正常
- [ ] 結果顯示正確
- [ ] 錯誤場景處理正確
- [ ] 導出測試正常
- [ ] 報告生成正確
