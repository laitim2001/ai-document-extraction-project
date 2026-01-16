# Story 17.2: 核心 UI 文字國際化

**Status:** ready-for-dev

---

## Story

**As a** 多語言用戶,
**I want** 系統介面以我的偏好語言顯示,
**So that** 我可以更有效率地使用系統，無需理解外語。

---

## Acceptance Criteria

### AC1: 通用組件文字國際化

**Given** 系統包含大量通用 UI 文字（按鈕、狀態、分頁等）
**When** 用戶切換語言
**Then** 所有通用按鈕文字正確翻譯（新增、編輯、刪除、保存、取消等）
**And** 所有狀態標籤正確翻譯（待處理、處理中、已完成、失敗等）
**And** 分頁控制項正確翻譯（上一頁、下一頁、顯示 X-Y of Z）

### AC2: 發票列表頁國際化

**Given** 發票列表是最常用的功能頁面
**When** 用戶以不同語言訪問頁面
**Then** 頁面標題、描述正確翻譯
**And** 統計卡片標題（總計、處理中、已完成、失敗）正確翻譯
**And** 篩選選項和狀態標籤正確翻譯
**And** 表格列標題正確翻譯

### AC3: 審核頁面國際化

**Given** 審核是核心工作流程頁面
**When** 用戶以不同語言訪問審核頁面
**Then** 篩選器標籤正確翻譯
**And** 處理路徑標籤正確翻譯（自動通過、快速審核、完整審核、需人工處理）
**And** 操作按鈕正確翻譯（批准、拒絕、修正並批准）

### AC4: 導航和佈局國際化

**Given** 導航欄和側邊欄在所有頁面顯示
**When** 用戶切換語言
**Then** 所有導航項目正確翻譯
**And** 用戶菜單項目正確翻譯
**And** 頁面標題和麵包屑正確翻譯

### AC5: 對話框和表單國際化

**Given** 系統包含多個操作對話框和表單
**When** 用戶觸發這些 UI 元素
**Then** 對話框標題和描述正確翻譯
**And** 表單標籤和佔位符正確翻譯
**And** 確認/取消按鈕正確翻譯

---

## Tasks / Subtasks

- [ ] **Task 1: 建立 P0 翻譯檔案** (AC: #1, #4)
  - [ ] 1.1 建立 `messages/{locale}/common.json` - 通用文字 (~150 字串)
  - [ ] 1.2 建立 `messages/{locale}/navigation.json` - 導航文字 (~30 字串)
  - [ ] 1.3 建立 `messages/{locale}/dialogs.json` - 對話框文字 (~50 字串)

- [ ] **Task 2: 建立發票模組翻譯檔案** (AC: #2)
  - [ ] 2.1 建立 `messages/{locale}/invoices.json` (~100 字串)
  - [ ] 2.2 提取頁面標題、描述、統計卡片文字
  - [ ] 2.3 提取表格列標題、狀態標籤、篩選選項

- [ ] **Task 3: 建立審核模組翻譯檔案** (AC: #3)
  - [ ] 3.1 建立 `messages/{locale}/review.json` (~80 字串)
  - [ ] 3.2 提取處理路徑、操作按鈕文字
  - [ ] 3.3 提取篩選器標籤、信心度相關文字

- [ ] **Task 4: 重構發票列表頁** (AC: #2)
  - [ ] 4.1 更新 `src/app/[locale]/(dashboard)/invoices/page.tsx`
  - [ ] 4.2 替換所有硬編碼文字為 `t()` 調用
  - [ ] 4.3 更新相關子組件（InvoiceListTable, InvoiceFilters 等）

- [ ] **Task 5: 重構審核頁面** (AC: #3)
  - [ ] 5.1 更新 `src/app/[locale]/(dashboard)/review/page.tsx`
  - [ ] 5.2 更新 ReviewQueueFilters, ReviewItemCard 等組件

- [ ] **Task 6: 重構導航組件** (AC: #4)
  - [ ] 6.1 更新 Sidebar 組件
  - [ ] 6.2 更新 Header 組件
  - [ ] 6.3 更新 UserMenu 組件

- [ ] **Task 7: 重構通用組件** (AC: #1, #5)
  - [ ] 7.1 更新 Button 使用模式（組件內部 vs 外部傳入）
  - [ ] 7.2 更新 Dialog 組件
  - [ ] 7.3 更新 DataTable 組件

- [ ] **Task 8: 英文翻譯完成** (AC: #1-5)
  - [ ] 8.1 完成所有 `en/*.json` 翻譯
  - [ ] 8.2 校對翻譯準確性

---

## Dev Notes

### 依賴項

- **Story 17.1**: i18n 基礎架構設置（必須先完成）

### Project Structure Notes

```
messages/
├── zh-TW/
│   ├── common.json          # 通用文字 (~150)
│   ├── navigation.json      # 導航文字 (~30)
│   ├── dialogs.json         # 對話框文字 (~50)
│   ├── invoices.json        # 發票模組 (~100)
│   └── review.json          # 審核模組 (~80)
│
├── en/
│   └── ... (同上結構)
│
└── zh-CN/
    └── ... (同上結構)
```

### Architecture Compliance

#### 翻譯檔案結構範例

```json
// messages/zh-TW/invoices.json
{
  "page": {
    "title": "發票文件",
    "description": "管理和追蹤上傳的發票處理狀態"
  },
  "stats": {
    "total": "總計",
    "processing": "處理中",
    "completed": "已完成",
    "failed": "失敗"
  },
  "filters": {
    "searchPlaceholder": "搜尋文件名稱...",
    "allStatus": "所有狀態",
    "status": {
      "uploading": "上傳中",
      "ocrProcessing": "OCR 處理中",
      "mappingProcessing": "映射中",
      "pendingReview": "待審核",
      "completed": "已完成",
      "ocrFailed": "OCR 失敗",
      "failed": "處理失敗"
    }
  },
  "table": {
    "columns": {
      "filename": "文件名稱",
      "status": "狀態",
      "uploadedAt": "上傳時間",
      "processingPath": "處理路徑",
      "actions": "操作"
    }
  },
  "actions": {
    "view": "查看",
    "retry": "重試",
    "download": "下載"
  },
  "pagination": {
    "showing": "顯示 {start} - {end}，共 {total} 筆",
    "previous": "上一頁",
    "next": "下一頁"
  }
}
```

#### 組件使用範例

```typescript
// src/app/[locale]/(dashboard)/invoices/page.tsx
'use client';

import { useTranslations } from 'next-intl';

export default function InvoicesPage() {
  const t = useTranslations('invoices');
  const tc = useTranslations('common');

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('page.title')}</h1>
      <p className="text-gray-500">{t('page.description')}</p>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title={t('stats.total')} value={stats.total} />
        <StatCard title={t('stats.processing')} value={stats.processing} />
        <StatCard title={t('stats.completed')} value={stats.completed} />
        <StatCard title={t('stats.failed')} value={stats.failed} />
      </div>

      <Input placeholder={t('filters.searchPlaceholder')} />

      <Button onClick={refresh}>{tc('actions.refresh')}</Button>
    </div>
  );
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| `/zh-TW/invoices` 頁面 | 所有文字顯示繁體中文 |
| `/en/invoices` 頁面 | 所有文字顯示英文 |
| 發票列表統計卡片 | 標題根據語言切換 |
| 審核頁面篩選器 | 標籤根據語言切換 |
| 導航側邊欄 | 所有項目根據語言切換 |

### References

- [Source: 探索代理分析報告] - 約 400-500 個 P0 字串需翻譯
- [Source: src/app/(dashboard)/invoices/page.tsx] - 發票列表頁現有實現

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 17.2 |
| Story Key | 17-2-core-ui-text-internationalization |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | X-Large (20-28h) |
| Dependencies | Story 17.1 |
| Blocking | Story 17.5 |

---

*Story created: 2026-01-16*
*Status: ready-for-dev*
