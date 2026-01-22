# Story 18.5: Template Instance 管理介面

**Status:** draft

---

## Story

**As a** 用戶,
**I want** 通過介面查看和管理填充後的模版實例,
**So that** 我可以檢視匹配結果、修正錯誤數據、並準備導出。

---

## 背景說明

### 問題陳述

Story 18-2 和 18-3 建立了 TemplateInstance 的數據模型和匹配引擎，但缺少前端管理介面。用戶需要：

1. 查看所有模版實例列表
2. 檢視單一實例的詳細數據（分頁行列表）
3. 修正驗證錯誤的行
4. 管理實例狀態

### UI 設計概念

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 模版實例管理                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [+ 新增實例]   篩選: [全部狀態 ▼] [全部模版 ▼] [日期範圍 📅]   [搜索...]               │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 實例名稱              │ 數據模版          │ 行數    │ 狀態      │ 更新時間 │ 操作 │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │ 2026年1月海運費用     │ 海運費用報表       │ 150     │ ✅ 完成   │ 01-20    │ 👁️ 📥 │   │
│  │ 2026年1月空運費用     │ 空運費用報表       │ 45      │ ⚠️ 有錯誤 │ 01-19    │ 👁️ ✏️ │   │
│  │ Q4 成本匯總          │ 月度成本匯總       │ 320     │ 📤 已導出 │ 01-15    │ 👁️ 📥 │   │
│  │ 新實例草稿           │ ERP 標準匯入格式   │ 0       │ 📝 草稿   │ 01-22    │ 👁️ 🗑️ │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  顯示 1-20 / 共 45 個實例                                          [< 上一頁] [下一頁 >] │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 實例詳情頁面

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ ← 返回列表   2026年1月海運費用                           [導出 Excel ▼] [添加文件] [設定] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  統計概覽                                                                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                           │
│  │ 總行數     │ │ 有效行數   │ │ 錯誤行數   │ │ 狀態       │                           │
│  │    150     │ │    145     │ │     5      │ │ ✅ 完成    │                           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘                           │
│                                                                                         │
│  數據行                                     篩選: [全部狀態 ▼] [搜索 rowKey...]          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │ # │ 出貨單號  │ 供應商    │ 運費    │ 港口費  │ 總金額   │ 狀態  │ 操作          │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │ 1 │ S001     │ DHL      │ 500     │ 100     │ 650      │ ✅    │ 👁️ ✏️          │   │
│  │ 2 │ S002     │ Maersk   │ 450     │ 120     │ 620      │ ✅    │ 👁️ ✏️          │   │
│  │ 3 │ S003     │ CMA CGM  │ 480     │ ⚠️      │ --       │ ❌    │ 👁️ ✏️ [修正]   │   │
│  │ 4 │ S004     │ Hapag    │ 520     │ 115     │ 685      │ ✅    │ 👁️ ✏️          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  顯示 1-50 / 共 150 行                                            [< 上一頁] [下一頁 >] │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### AC1: 實例列表頁面

**Given** /template-instances 頁面
**When** 訪問頁面
**Then**:
  - 顯示所有模版實例列表
  - 顯示狀態標籤（草稿/處理中/完成/有錯誤/已導出）
  - 支援按狀態、模版、日期範圍篩選
  - 支援搜索實例名稱

### AC2: 創建實例

**Given** 點擊「新增實例」
**When** 填寫表單並提交
**Then**:
  - 選擇目標數據模版
  - 輸入實例名稱和描述
  - 創建 DRAFT 狀態的空實例

### AC3: 實例詳情頁面

**Given** 點擊實例查看
**When** 進入詳情頁面
**Then**:
  - 顯示統計概覽（總行數、有效/錯誤行數）
  - 顯示分頁的數據行列表
  - 列標題從 DataTemplate.fields 動態生成
  - 錯誤欄位高亮顯示

### AC4: 行數據編輯

**Given** 點擊行的「編輯」按鈕
**When** 打開編輯對話框
**Then**:
  - 顯示所有欄位的當前值
  - 顯示驗證錯誤提示
  - 支援修改欄位值
  - 保存後自動重新驗證

### AC5: 錯誤行過濾

**Given** 實例有錯誤行
**When** 選擇「只顯示錯誤行」篩選
**Then**:
  - 只顯示 status=INVALID 的行
  - 顯示具體的驗證錯誤訊息

### AC6: 來源文件追蹤

**Given** 行數據
**When** 查看行詳情
**Then**:
  - 顯示 sourceDocumentIds 列表
  - 支援點擊跳轉到原始文件

### AC7: 批量操作

**Given** 選中多行
**When** 執行批量操作
**Then**:
  - 支援批量刪除
  - 支援批量重新驗證

### AC8: i18n 支援

**Given** 所有 UI 文字
**When** 切換語言
**Then** 正確顯示翻譯內容

---

## Tasks / Subtasks

- [ ] **Task 1: 列表頁面** (AC: #1, #2)
  - [ ] 1.1 新增 `/template-instances/page.tsx`
  - [ ] 1.2 實現 `TemplateInstanceList` 組件
  - [ ] 1.3 實現篩選器組件
  - [ ] 1.4 實現創建實例對話框

- [ ] **Task 2: 詳情頁面** (AC: #3, #6)
  - [ ] 2.1 新增 `/template-instances/[id]/page.tsx`
  - [ ] 2.2 實現 `TemplateInstanceDetail` 組件
  - [ ] 2.3 實現統計概覽卡片
  - [ ] 2.4 實現動態列表格

- [ ] **Task 3: 行數據表格** (AC: #3, #5)
  - [ ] 3.1 實現 `InstanceRowsTable` 組件
  - [ ] 3.2 實現動態欄位渲染
  - [ ] 3.3 實現錯誤高亮
  - [ ] 3.4 實現分頁載入
  - [ ] 3.5 實現行篩選

- [ ] **Task 4: 行編輯** (AC: #4)
  - [ ] 4.1 實現 `RowEditDialog` 組件
  - [ ] 4.2 根據 DataTemplate 動態生成表單
  - [ ] 4.3 實現即時驗證
  - [ ] 4.4 實現保存和重新驗證

- [ ] **Task 5: 批量操作** (AC: #7)
  - [ ] 5.1 實現行選擇功能
  - [ ] 5.2 實現批量操作菜單
  - [ ] 5.3 實現批量刪除
  - [ ] 5.4 實現批量重新驗證

- [ ] **Task 6: i18n** (AC: #8)
  - [ ] 6.1 新增翻譯鍵到各語言文件
  - [ ] 6.2 更新所有組件使用 useTranslations

---

## Dev Notes

### 依賴項

- **Story 18-2**: TemplateInstance API
- **Story 18-3**: 匹配引擎服務
- **Story 16-7**: DataTemplate（欄位定義）

### 新增文件

```
src/
├── app/[locale]/(dashboard)/template-instances/
│   ├── page.tsx                          # 新增：列表頁面
│   └── [id]/page.tsx                     # 新增：詳情頁面
├── components/features/template-instance/
│   ├── index.ts                          # 新增：導出
│   ├── TemplateInstanceList.tsx          # 新增
│   ├── TemplateInstanceCard.tsx          # 新增
│   ├── TemplateInstanceFilters.tsx       # 新增
│   ├── CreateInstanceDialog.tsx          # 新增
│   ├── TemplateInstanceDetail.tsx        # 新增
│   ├── InstanceStatsOverview.tsx         # 新增
│   ├── InstanceRowsTable.tsx             # 新增
│   ├── RowEditDialog.tsx                 # 新增
│   ├── RowDetailDrawer.tsx               # 新增
│   └── BulkActionsMenu.tsx               # 新增
└── messages/
    ├── en/templateInstance.json          # 新增
    ├── zh-TW/templateInstance.json       # 新增
    └── zh-CN/templateInstance.json       # 新增
```

### 狀態圖標和顏色

```typescript
export const INSTANCE_STATUS_CONFIG = {
  DRAFT: {
    icon: '📝',
    label: '草稿',
    color: 'gray',
    badgeVariant: 'secondary',
  },
  PROCESSING: {
    icon: '⏳',
    label: '處理中',
    color: 'blue',
    badgeVariant: 'info',
  },
  COMPLETED: {
    icon: '✅',
    label: '完成',
    color: 'green',
    badgeVariant: 'success',
  },
  ERROR: {
    icon: '⚠️',
    label: '有錯誤',
    color: 'orange',
    badgeVariant: 'warning',
  },
  EXPORTED: {
    icon: '📤',
    label: '已導出',
    color: 'purple',
    badgeVariant: 'default',
  },
};

export const ROW_STATUS_CONFIG = {
  PENDING: { icon: '⏳', label: '待驗證', color: 'gray' },
  VALID: { icon: '✅', label: '有效', color: 'green' },
  INVALID: { icon: '❌', label: '無效', color: 'red' },
  SKIPPED: { icon: '⏭️', label: '跳過', color: 'gray' },
};
```

### 動態表格設計

```typescript
// 根據 DataTemplate.fields 動態生成表格列
function useTableColumns(templateFields: DataTemplateField[]) {
  return useMemo(() => {
    const columns: ColumnDef<TemplateInstanceRow>[] = [
      // 固定列：序號
      {
        accessorKey: 'rowIndex',
        header: '#',
        size: 50,
      },
      // 固定列：rowKey
      {
        accessorKey: 'rowKey',
        header: '主鍵',
        size: 100,
      },
      // 動態列：根據模版欄位生成
      ...templateFields.map((field) => ({
        id: field.name,
        accessorFn: (row: TemplateInstanceRow) =>
          (row.fieldValues as Record<string, unknown>)[field.name],
        header: field.label,
        cell: ({ row, getValue }) => {
          const value = getValue();
          const errors = row.original.validationErrors as Record<string, string> | null;
          const hasError = errors?.[field.name];

          return (
            <div className={cn(hasError && 'text-red-500 bg-red-50')}>
              {formatFieldValue(value, field.dataType)}
              {hasError && (
                <Tooltip content={hasError}>
                  <AlertCircle className="h-4 w-4 ml-1 inline" />
                </Tooltip>
              )}
            </div>
          );
        },
      })),
      // 固定列：狀態
      {
        accessorKey: 'status',
        header: '狀態',
        cell: ({ getValue }) => <RowStatusBadge status={getValue()} />,
      },
      // 固定列：操作
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => <RowActions row={row.original} />,
      },
    ];

    return columns;
  }, [templateFields]);
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/app/[locale]/(dashboard)/template-instances/` - 新增
- `src/components/features/template-instance/` - 新增
- `messages/*/templateInstance.json` - 新增
