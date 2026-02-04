# Story 20.5: 管理頁面 - 列表與篩選

**Status:** draft

---

## Story

**As a** 系統管理員,
**I want** 在管理頁面查看和篩選 Reference Number 記錄,
**So that** 可以方便地瀏覽和查找特定號碼。

---

## 背景說明

### 問題陳述

需要建立 Reference Number 的管理介面，讓管理員可以查看所有記錄，並透過多種條件篩選。

### 設計決策

- **使用 DataTable**：基於現有的 DataTable 組件
- **篩選器組件**：包含年份、地區、類型、狀態等篩選條件
- **URL 同步**：篩選條件同步到 URL，支援分享連結

---

## Acceptance Criteria

### AC1: 列表頁面

**Given** `/admin/reference-numbers`
**When** 訪問頁面
**Then**:
  - 顯示 Reference Number 列表
  - 顯示欄位：number, type, year, region, status, matchCount, updatedAt
  - 支援分頁

### AC2: 篩選功能

**Given** 列表頁面
**When** 使用篩選器
**Then**:
  - 支援年份篩選（下拉選單）
  - 支援地區篩選（RegionSelect）
  - 支援類型篩選（ReferenceNumberType）
  - 支援狀態篩選（ReferenceNumberStatus）
  - 支援文字搜尋（number 模糊搜尋）

### AC3: 排序功能

**Given** 列表頁面
**When** 點擊欄位標題
**Then**:
  - 支援 number, year, createdAt, updatedAt, matchCount 排序
  - 切換升序/降序

### AC4: URL 同步

**Given** 篩選/分頁操作
**When** 條件改變
**Then**:
  - URL 參數同步更新
  - 重新載入頁面保持篩選狀態

### AC5: 操作按鈕

**Given** 每行記錄
**When** 顯示操作
**Then**:
  - 編輯按鈕（導向編輯頁）
  - 刪除按鈕（確認對話框）
  - 複製按鈕（複製 number 到剪貼簿）

### AC6: i18n 支援

**Given** 頁面內容
**When** 切換語言
**Then** 所有文字正確顯示對應語言

---

## Tasks / Subtasks

- [ ] **Task 1: 頁面結構** (AC: #1)
  - [ ] 1.1 新增 `/admin/reference-numbers/page.tsx`
  - [ ] 1.2 建立頁面佈局（標題、統計、按鈕、表格）
  - [ ] 1.3 整合 DataTable

- [ ] **Task 2: 篩選器組件** (AC: #2)
  - [ ] 2.1 新增 `ReferenceNumberFilters.tsx`
  - [ ] 2.2 整合 RegionSelect
  - [ ] 2.3 實現類型/狀態下拉選單
  - [ ] 2.4 實現年份選擇器
  - [ ] 2.5 實現搜尋框

- [ ] **Task 3: 列表組件** (AC: #1, #3, #5)
  - [ ] 3.1 新增 `ReferenceNumberList.tsx`
  - [ ] 3.2 定義表格欄位
  - [ ] 3.3 實現排序功能
  - [ ] 3.4 實現操作按鈕

- [ ] **Task 4: URL 同步** (AC: #4)
  - [ ] 4.1 實現 useSearchParams 整合
  - [ ] 4.2 篩選條件與 URL 雙向同步

- [ ] **Task 5: 刪除確認** (AC: #5)
  - [ ] 5.1 新增 `ReferenceNumberDeleteDialog.tsx`
  - [ ] 5.2 實現刪除確認流程

- [ ] **Task 6: i18n** (AC: #6)
  - [ ] 6.1 新增 `messages/en/referenceNumber.json`
  - [ ] 6.2 新增 `messages/zh-TW/referenceNumber.json`
  - [ ] 6.3 新增 `messages/zh-CN/referenceNumber.json`

---

## Dev Notes

### 依賴項

- **Story 20-2**: RegionSelect 組件
- **Story 20-3**: Reference Number CRUD API

### 新增文件

```
src/app/[locale]/(dashboard)/admin/reference-numbers/
├── page.tsx                          # 新增

src/components/features/reference-number/
├── index.ts                          # 新增
├── ReferenceNumberList.tsx           # 新增
├── ReferenceNumberFilters.tsx        # 新增
├── ReferenceNumberDeleteDialog.tsx   # 新增
├── ReferenceNumberTypeBadge.tsx      # 新增
└── ReferenceNumberStatusBadge.tsx    # 新增

messages/
├── en/referenceNumber.json           # 新增
├── zh-TW/referenceNumber.json        # 新增
└── zh-CN/referenceNumber.json        # 新增
```

### 表格欄位設計

```typescript
const columns = [
  { key: 'number', label: '號碼', sortable: true },
  { key: 'type', label: '類型', sortable: false },
  { key: 'year', label: '年份', sortable: true },
  { key: 'region', label: '地區', sortable: false },
  { key: 'status', label: '狀態', sortable: false },
  { key: 'matchCount', label: '匹配次數', sortable: true },
  { key: 'updatedAt', label: '更新時間', sortable: true },
  { key: 'actions', label: '操作', sortable: false },
];
```

### 類型和狀態顯示

```typescript
// ReferenceNumberType 顯示
const TYPE_LABELS = {
  SHIPMENT: '運輸單號',
  DELIVERY: '交貨單號',
  BOOKING: '訂艙號',
  CONTAINER: '櫃號',
  HAWB: '分提單',
  MAWB: '主提單',
  BL: '提單',
  CUSTOMS: '報關單',
  OTHER: '其他',
};

// ReferenceNumberStatus 顏色
const STATUS_COLORS = {
  ACTIVE: 'green',
  EXPIRED: 'gray',
  CANCELLED: 'red',
};
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/app/[locale]/(dashboard)/admin/reference-numbers/page.tsx` - 新增
- `src/components/features/reference-number/` - 新增
- `messages/*/referenceNumber.json` - 新增
