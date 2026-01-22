# Tech Spec: Story 18.4 - Template Field Mapping 配置 UI

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-4

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 18.4 |
| **Epic** | Epic 18 - 數據模版匹配與輸出 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 18-1 |

---

## Objective

建立視覺化的第二層映射規則配置介面，讓管理員可以輕鬆配置標準欄位到模版欄位的映射。

---

## Implementation Guide

### Phase 1: 頁面路由

```
/admin/template-field-mappings           # 列表頁面
/admin/template-field-mappings/new       # 創建頁面
/admin/template-field-mappings/[id]      # 編輯頁面
```

### Phase 2: 核心組件

```typescript
// 組件層級結構
TemplateFieldMappingList
├── TemplateFieldMappingFilters
└── TemplateFieldMappingCard

TemplateFieldMappingForm
├── BasicInfoSection
│   ├── NameInput
│   ├── TemplateSelector
│   ├── ScopeSelector
│   └── CompanySelector / FormatSelector
├── MappingRuleEditor
│   ├── MappingRuleItem
│   │   ├── SourceFieldSelector
│   │   ├── TransformTypeSelector
│   │   ├── TargetFieldSelector
│   │   └── TransformConfigEditor
│   │       ├── FormulaEditor
│   │       └── LookupTableEditor
│   └── AddRuleButton
└── MappingTestPanel
    ├── InputDataEditor
    └── ResultPreview
```

### Phase 3: 標準欄位列表

```typescript
// src/constants/standard-fields.ts

export const STANDARD_FIELDS = [
  // 基本資訊
  { name: 'invoice_number', label: '發票號碼', category: 'basic' },
  { name: 'invoice_date', label: '發票日期', category: 'basic' },
  { name: 'due_date', label: '付款到期日', category: 'basic' },
  { name: 'po_number', label: '採購單號', category: 'basic' },

  // 供應商
  { name: 'vendor_name', label: '供應商名稱', category: 'vendor' },
  { name: 'vendor_code', label: '供應商代碼', category: 'vendor' },

  // 物流
  { name: 'shipment_no', label: '出貨單號', category: 'logistics' },
  { name: 'tracking_number', label: '追蹤號碼', category: 'logistics' },
  { name: 'origin', label: '起運地', category: 'logistics' },
  { name: 'destination', label: '目的地', category: 'logistics' },

  // 費用
  { name: 'sea_freight', label: '海運費', category: 'charges' },
  { name: 'air_freight', label: '空運費', category: 'charges' },
  { name: 'terminal_handling', label: '碼頭處理費', category: 'charges' },
  { name: 'documentation_fee', label: '文件費', category: 'charges' },

  // 金額
  { name: 'subtotal', label: '小計', category: 'amount' },
  { name: 'tax_amount', label: '稅額', category: 'amount' },
  { name: 'total_amount', label: '總金額', category: 'amount' },
  { name: 'currency', label: '幣別', category: 'amount' },
];
```

### Phase 4: 公式編輯器

```typescript
// FormulaEditor 組件
interface FormulaEditorProps {
  value: string;
  onChange: (formula: string) => void;
  availableFields: string[];  // 可用的變數
}

// 支援的語法：
// 變數: {field_name}
// 運算符: + - * / ( )
// 範例: "{sea_freight} + {terminal_handling}"
```

### Phase 5: React Hooks

```typescript
// src/hooks/use-template-field-mappings.ts

export function useTemplateFieldMappings(filters?: TemplateFieldMappingFilters);
export function useTemplateFieldMapping(id: string);
export function useCreateTemplateFieldMapping();
export function useUpdateTemplateFieldMapping();
export function useDeleteTemplateFieldMapping();
export function useResolveMappings(params: ResolveMappingParams);
```

---

## File Structure

```
src/
├── app/[locale]/(dashboard)/admin/template-field-mappings/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── components/features/template-field-mapping/
│   ├── index.ts
│   ├── TemplateFieldMappingList.tsx
│   ├── TemplateFieldMappingForm.tsx
│   ├── MappingRuleEditor.tsx
│   ├── MappingRuleItem.tsx
│   ├── SourceFieldSelector.tsx
│   ├── TargetFieldSelector.tsx
│   ├── TransformConfigEditor.tsx
│   ├── FormulaEditor.tsx
│   ├── LookupTableEditor.tsx
│   └── MappingTestPanel.tsx
├── hooks/use-template-field-mappings.ts
├── constants/standard-fields.ts
└── messages/*/admin.json  # i18n 更新
```

---

## Testing Checklist

- [ ] 列表頁面正確顯示
- [ ] 篩選功能正常
- [ ] 創建表單驗證正確
- [ ] 映射規則編輯器正常
- [ ] 公式編輯器正常
- [ ] 查表編輯器正常
- [ ] 測試預覽功能正常
- [ ] i18n 翻譯完整
