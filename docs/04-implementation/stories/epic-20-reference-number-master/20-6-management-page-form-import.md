# Story 20.6: 管理頁面 - 表單與導入

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 透過表單新增/編輯 Reference Number，並能批次導入,
**So that** 可以靈活地維護參考號碼資料。

---

## 背景說明

### 問題陳述

需要建立 Reference Number 的新增/編輯表單，以及批次導入對話框，讓管理員可以靈活維護資料。

### 設計決策

- **表單驗證**：使用 React Hook Form + Zod
- **導入對話框**：支援 JSON 文件上傳
- **導出按鈕**：在列表頁面提供

---

## Acceptance Criteria

### AC1: 新增頁面

**Given** `/admin/reference-numbers/new`
**When** 訪問頁面
**Then**:
  - 顯示空白表單
  - 必填欄位：number, type, year, regionId
  - 可選欄位：description, validFrom, validUntil
  - 提交後導向列表頁

### AC2: 編輯頁面

**Given** `/admin/reference-numbers/:id`
**When** 訪問頁面
**Then**:
  - 顯示現有資料
  - 可編輯所有欄位
  - 顯示 code（唯讀）
  - 顯示 matchCount（唯讀）
  - 提交後導向列表頁

### AC3: 表單驗證

**Given** 表單提交
**When** 資料無效
**Then**:
  - 顯示即時驗證錯誤
  - 阻止提交

### AC4: 導入對話框

**Given** 列表頁面點擊「導入」
**When** 對話框開啟
**Then**:
  - 支援拖放 JSON 文件
  - 顯示檔案名稱和大小
  - 可選 overwriteExisting 選項
  - 預覽待導入項目數量

### AC5: 導入結果

**Given** 導入執行
**When** 完成
**Then**:
  - 顯示統計（imported, updated, skipped, errors）
  - 錯誤可展開查看詳情
  - 成功後自動刷新列表

### AC6: 導出功能

**Given** 列表頁面點擊「導出」
**When** 執行
**Then**:
  - 應用當前篩選條件
  - 下載 JSON 文件
  - 文件名包含日期

---

## Tasks / Subtasks

- [ ] **Task 1: 表單組件** (AC: #1, #2, #3)
  - [ ] 1.1 新增 `ReferenceNumberForm.tsx`
  - [ ] 1.2 整合 React Hook Form + Zod
  - [ ] 1.3 實現 RegionSelect 整合
  - [ ] 1.4 實現日期選擇器

- [ ] **Task 2: 新增頁面** (AC: #1)
  - [ ] 2.1 新增 `/admin/reference-numbers/new/page.tsx`
  - [ ] 2.2 整合表單組件
  - [ ] 2.3 實現提交邏輯

- [ ] **Task 3: 編輯頁面** (AC: #2)
  - [ ] 3.1 新增 `/admin/reference-numbers/[id]/page.tsx`
  - [ ] 3.2 載入現有資料
  - [ ] 3.3 顯示唯讀欄位

- [ ] **Task 4: 導入對話框** (AC: #4, #5)
  - [ ] 4.1 新增 `ReferenceNumberImportDialog.tsx`
  - [ ] 4.2 實現文件上傳
  - [ ] 4.3 實現預覽功能
  - [ ] 4.4 實現導入執行
  - [ ] 4.5 實現結果展示

- [ ] **Task 5: 導出功能** (AC: #6)
  - [ ] 5.1 新增 `ReferenceNumberExportButton.tsx`
  - [ ] 5.2 實現下載邏輯

- [ ] **Task 6: 整合到列表頁** (AC: #4, #6)
  - [ ] 6.1 添加「新增」按鈕
  - [ ] 6.2 添加「導入」按鈕
  - [ ] 6.3 添加「導出」按鈕

---

## Dev Notes

### 依賴項

- **Story 20-4**: Import/Export API
- **Story 20-5**: 列表頁面

### 新增文件

```
src/app/[locale]/(dashboard)/admin/reference-numbers/
├── new/
│   └── page.tsx                      # 新增
└── [id]/
    └── page.tsx                      # 新增

src/components/features/reference-number/
├── ReferenceNumberForm.tsx           # 新增
├── ReferenceNumberImportDialog.tsx   # 新增
└── ReferenceNumberExportButton.tsx   # 新增
```

### 表單欄位設計

```typescript
interface ReferenceNumberFormProps {
  defaultValues?: Partial<ReferenceNumberFormValues>;
  onSubmit: (values: ReferenceNumberFormValues) => Promise<void>;
  isEditing?: boolean;
}

interface ReferenceNumberFormValues {
  number: string;
  type: ReferenceNumberType;
  year: number;
  regionId: string;
  description?: string;
  validFrom?: Date | null;
  validUntil?: Date | null;
}
```

### 導入對話框設計

```typescript
interface ReferenceNumberImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

### 導入 JSON 範例

```json
{
  "exportVersion": "1.0",
  "items": [
    {
      "number": "SH2026001",
      "type": "SHIPMENT",
      "year": 2026,
      "regionCode": "APAC",
      "description": "測試運輸單號"
    },
    {
      "number": "DL2026001",
      "type": "DELIVERY",
      "year": 2026,
      "regionCode": "EMEA"
    }
  ]
}
```

---

## Implementation Notes

### 完成日期：2026-02-05

### 實現摘要

1. **表單組件** (`ReferenceNumberForm.tsx`)
   - React Hook Form + Zod 驗證
   - 日期選擇：Popover + Calendar（無獨立 DatePicker 組件）
   - 表單 validFrom/validUntil 為 `Date | null`，提交時由頁面轉換為 ISO string
   - 編輯模式顯示唯讀欄位（code, matchCount）
   - 取消按鈕使用 Link 導回列表頁

2. **新增頁面** (`new/page.tsx`)
   - 整合 ReferenceNumberForm
   - useCreateReferenceNumber hook
   - Toast 成功/失敗通知

3. **編輯頁面** (`[id]/page.tsx`)
   - 載入現有資料 (useReferenceNumber hook)
   - 顯示 Loading/NotFound 狀態
   - useUpdateReferenceNumber 接收 `{ id, input }` 格式

4. **導入對話框** (`ReferenceNumberImportDialog.tsx`)
   - JSON 文件上傳與解析
   - overwriteExisting / skipInvalid 選項
   - 導入結果統計（imported, updated, skipped, errors）
   - 錯誤可查看詳情

5. **導出按鈕** (`ReferenceNumberExportButton.tsx`)
   - 應用當前篩選條件
   - 下載 JSON 文件（文件名含日期）

6. **列表頁面更新** (`page.tsx`)
   - Import 按鈕開啟對話框
   - Export 按鈕替換為 ReferenceNumberExportButton 組件
   - 導入成功後自動刷新列表

7. **i18n** (`referenceNumber.json` × 3 語言)
   - 新增 form, new, edit, import, export, messages, notFound keys

### 技術決策
- 無 DatePicker UI 組件 → 使用 Popover + Calendar 內聯實現
- useRouter/Link 使用 `@/i18n/routing`（非 next/navigation）
- useToast 使用 `@/hooks/use-toast`（非 sonner）
- Tech spec 接口修正：useUpdateReferenceNumber 接收 `{ id, input }` 非 `{ id, data }`

---

## Related Files

- `src/app/[locale]/(dashboard)/admin/reference-numbers/new/page.tsx` - 新增
- `src/app/[locale]/(dashboard)/admin/reference-numbers/[id]/page.tsx` - 新增
- `src/app/[locale]/(dashboard)/admin/reference-numbers/page.tsx` - 修改（Import/Export 整合）
- `src/components/features/reference-number/ReferenceNumberForm.tsx` - 新增
- `src/components/features/reference-number/ReferenceNumberImportDialog.tsx` - 新增
- `src/components/features/reference-number/ReferenceNumberExportButton.tsx` - 新增
- `src/components/features/reference-number/index.ts` - 修改（新增匯出）
- `messages/en/referenceNumber.json` - 修改（新增 form/import/export keys）
- `messages/zh-TW/referenceNumber.json` - 修改（新增 form/import/export keys）
- `messages/zh-CN/referenceNumber.json` - 修改（新增 form/import/export keys）
