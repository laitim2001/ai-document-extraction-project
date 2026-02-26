# Tech Spec: Story 19.5 - Template Instance 管理介面

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-5

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 19.5 |
| **Epic** | Epic 19 - 數據模版匹配與輸出 |
| **Estimated Effort** | 6 Story Points |
| **Dependencies** | Story 19-2, 18-3 |

---

## Objective

建立 Template Instance 管理介面，讓用戶可以查看、編輯、管理填充後的模版數據。

---

## Implementation Guide

### Phase 1: 頁面路由

```
/template-instances           # 列表頁面
/template-instances/[id]      # 詳情頁面
```

### Phase 2: 核心組件

```typescript
// 組件層級結構

// 列表頁面
TemplateInstanceList
├── TemplateInstanceFilters
│   ├── StatusFilter
│   ├── TemplateFilter
│   └── DateRangeFilter
├── TemplateInstanceCard
└── CreateInstanceDialog

// 詳情頁面
TemplateInstanceDetail
├── InstanceStatsOverview
│   ├── StatCard (總行數)
│   ├── StatCard (有效行數)
│   ├── StatCard (錯誤行數)
│   └── StatusBadge
├── InstanceRowsTable
│   ├── DynamicColumns (根據 DataTemplate.fields)
│   ├── RowStatusBadge
│   └── RowActions
├── RowEditDialog
├── RowDetailDrawer
└── BulkActionsMenu
```

### Phase 3: 動態表格設計

```typescript
// 根據 DataTemplate.fields 動態生成列
function useTableColumns(templateFields: DataTemplateField[]) {
  return useMemo(() => [
    // 固定列
    { accessorKey: 'rowIndex', header: '#', size: 50 },
    { accessorKey: 'rowKey', header: '主鍵', size: 100 },

    // 動態列（根據模版欄位）
    ...templateFields.map(field => ({
      id: field.name,
      accessorFn: (row) => row.fieldValues[field.name],
      header: field.label,
      cell: ({ getValue, row }) => {
        const hasError = row.original.validationErrors?.[field.name];
        return (
          <div className={cn(hasError && 'text-red-500 bg-red-50')}>
            {formatFieldValue(getValue(), field.dataType)}
            {hasError && <ErrorIcon tooltip={hasError} />}
          </div>
        );
      },
    })),

    // 固定尾列
    { accessorKey: 'status', header: '狀態' },
    { id: 'actions', header: '操作' },
  ], [templateFields]);
}
```

### Phase 4: 狀態配置

```typescript
export const INSTANCE_STATUS_CONFIG = {
  DRAFT: { icon: '📝', label: '草稿', color: 'gray' },
  PROCESSING: { icon: '⏳', label: '處理中', color: 'blue' },
  COMPLETED: { icon: '✅', label: '完成', color: 'green' },
  ERROR: { icon: '⚠️', label: '有錯誤', color: 'orange' },
  EXPORTED: { icon: '📤', label: '已導出', color: 'purple' },
};

export const ROW_STATUS_CONFIG = {
  PENDING: { icon: '⏳', label: '待驗證', color: 'gray' },
  VALID: { icon: '✅', label: '有效', color: 'green' },
  INVALID: { icon: '❌', label: '無效', color: 'red' },
  SKIPPED: { icon: '⏭️', label: '跳過', color: 'gray' },
};
```

---

## File Structure

```
src/
├── app/[locale]/(dashboard)/template-instances/
│   ├── page.tsx
│   └── [id]/page.tsx
├── components/features/template-instance/
│   ├── index.ts
│   ├── TemplateInstanceList.tsx
│   ├── TemplateInstanceCard.tsx
│   ├── TemplateInstanceFilters.tsx
│   ├── CreateInstanceDialog.tsx
│   ├── TemplateInstanceDetail.tsx
│   ├── InstanceStatsOverview.tsx
│   ├── InstanceRowsTable.tsx
│   ├── RowEditDialog.tsx
│   ├── RowDetailDrawer.tsx
│   └── BulkActionsMenu.tsx
└── messages/*/templateInstance.json
```

---

## Testing Checklist

- [ ] 列表頁面正確顯示
- [ ] 篩選功能正常
- [ ] 創建實例正常
- [ ] 詳情頁面正確載入
- [ ] 動態表格列正確
- [ ] 錯誤高亮顯示
- [ ] 行編輯功能正常
- [ ] 批量操作正常
