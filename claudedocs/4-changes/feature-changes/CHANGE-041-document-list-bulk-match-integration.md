# CHANGE-041: 文件列表頁整合批量匹配對話框

> **日期**: 2026-02-14
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: UI Enhancement
> **影響範圍**: `DocumentListTable.tsx`、`documents/page.tsx`、i18n

---

## 變更背景

### 現有問題

`BulkMatchDialog`、`MatchToTemplateDialog`、`MatchStatusBadge` 三個組件在 Epic 19 時已開發完成（位於 `src/components/features/template-match/`），但一直沒有串接到任何用戶可見的頁面。用戶目前無法從文件列表頁觸發匹配操作。

Template Instance 詳情頁的「Add File」按鈕已在 FIX-040 中修復，從 Instance 側串接文件是可行的。但從文件列表側批量匹配到模板的入口仍然缺失。

### 已完成但未串接的組件

| 組件 | 路徑 | 狀態 |
|------|------|------|
| `BulkMatchDialog` | `src/components/features/template-match/BulkMatchDialog.tsx` | ✅ 已建好，未串接 |
| `MatchToTemplateDialog` | `src/components/features/template-match/MatchToTemplateDialog.tsx` | ✅ 已建好，未串接 |
| `MatchStatusBadge` | `src/components/features/template-match/MatchStatusBadge.tsx` | ✅ 已建好，未串接 |
| `POST /api/v1/documents/match` | `src/app/api/v1/documents/match/route.ts` | ✅ API 已可用 |

### 資料庫支援

Document Schema 已有相關欄位：
- `templateInstanceId` (`template_instance_id`) — 關聯到 TemplateInstance
- `templateMatchedAt` (`template_matched_at`) — 匹配時間戳

## 變更內容

### 1. DocumentListTable 新增 checkbox 批量選擇

在表格中加入 checkbox 列（表頭全選 + 每行單選），新增 props 接收選擇狀態：

```typescript
interface DocumentListTableProps {
  documents: DocumentListItem[];
  isLoading?: boolean;
  // ★ 新增
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}
```

### 2. Documents 頁面串接 BulkMatchDialog

在 `documents/page.tsx` 中：
- 管理 `selectedIds` state（`useState<Set<string>>`）
- 在已選文件 > 0 時顯示批量操作列
- 渲染 `BulkMatchDialog`，傳入選中的 document IDs
- 匹配成功後 `refetch()` 刷新列表並清空選擇

### 3. 文件列表顯示匹配狀態（可選，取決於 API）

- 使用 `MatchStatusBadge` 在表格中顯示文件是否已匹配
- 需確認 `useDocuments` hook 返回的 `DocumentListItem` 是否包含 `templateInstanceId`
- 如未包含，需調整 Documents API 返回此欄位

## 技術設計

### 修改範圍

| 文件 | 變更內容 |
|------|----------|
| `src/components/features/document/DocumentListTable.tsx` | 新增 checkbox 列、選擇 props、匹配狀態列 |
| `src/app/[locale]/(dashboard)/documents/page.tsx` | 管理選擇 state，渲染批量操作列和 BulkMatchDialog |
| `messages/en/documents.json` | 新增 bulk match 相關翻譯 key |
| `messages/zh-TW/documents.json` | 同上 |
| `messages/zh-CN/documents.json` | 同上 |

### 不需修改的文件

- `BulkMatchDialog.tsx` — 已完整實作（進度追蹤、模板/實例選擇、結果統計）
- `MatchStatusBadge.tsx` — 已完整實作（matched/unmatched/pending 三態）
- `POST /api/v1/documents/match` — API 已可用
- `templateInstance.json` — 已有 match 相關翻譯

### i18n 新增 Key

**`messages/{locale}/documents.json`**:

```json
{
  "bulkActions": {
    "selected": "{count} selected",
    "matchToTemplate": "Match to Template",
    "clearSelection": "Clear"
  },
  "table": {
    "columns": {
      "select": "",
      "matchStatus": "Match"
    }
  }
}
```

對應繁中/簡中翻譯：

```json
// zh-TW
{
  "bulkActions": {
    "selected": "已選擇 {count} 個",
    "matchToTemplate": "匹配到模板",
    "clearSelection": "清除"
  },
  "table": {
    "columns": {
      "select": "",
      "matchStatus": "匹配"
    }
  }
}
```

```json
// zh-CN
{
  "bulkActions": {
    "selected": "已选择 {count} 个",
    "matchToTemplate": "匹配到模板",
    "clearSelection": "清除"
  },
  "table": {
    "columns": {
      "select": "",
      "matchStatus": "匹配"
    }
  }
}
```

## 設計決策

1. **使用 BulkMatchDialog 而非 MatchToTemplateDialog** — BulkMatchDialog 有進度追蹤和結果統計，更適合文件列表的批量操作場景
2. **選擇狀態由 page 管理而非 table 內部** — page 需要將 `selectedIds` 傳給 BulkMatchDialog，且翻頁時可能需要保留/清空選擇
3. **匹配狀態列為可選** — 取決於 `useDocuments` 是否已返回 `templateInstanceId`；如未返回則先跳過，後續再補
4. **批量操作列使用 sticky bottom bar** — 選中文件後在頁面底部顯示浮動操作列，參考常見的批量操作 UX 模式

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/components/features/document/DocumentListTable.tsx` | 🔧 修改 | 新增 checkbox 列和選擇 props |
| `src/app/[locale]/(dashboard)/documents/page.tsx` | 🔧 修改 | 新增選擇 state + BulkMatchDialog |
| `messages/en/documents.json` | 🔧 修改 | 新增 bulkActions 翻譯 key |
| `messages/zh-TW/documents.json` | 🔧 修改 | 同上 |
| `messages/zh-CN/documents.json` | 🔧 修改 | 同上 |

### 向後兼容性

- `DocumentListTable` 新增的 props 均為 optional，不影響現有使用
- 不修改任何 API 或資料庫結構
- 不修改已有的 BulkMatchDialog 組件

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 批量選擇 | 文件列表表格可勾選多個文件，支援全選/取消全選 | High |
| 2 | 匹配觸發 | 勾選後出現「匹配到模板」按鈕，點擊打開 BulkMatchDialog | High |
| 3 | 匹配成功刷新 | 匹配完成後自動刷新文件列表並清空選擇 | High |
| 4 | i18n 完整 | 所有新增 UI 文字使用翻譯 key，en/zh-TW/zh-CN 同步 | High |
| 5 | 匹配狀態顯示 | 文件列表顯示是否已匹配（如 API 支持） | Medium |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 批量選擇文件 | 勾選 3 個文件 → 查看批量操作列 | 顯示「已選擇 3 個」和「匹配到模板」按鈕 |
| 2 | 全選/取消 | 點擊表頭 checkbox → 再次點擊 | 先全選 → 再取消全選 |
| 3 | 打開匹配對話框 | 勾選文件 → 點擊「匹配到模板」 | BulkMatchDialog 開啟，顯示已選文件數 |
| 4 | 執行匹配 | 在對話框中選擇模板和實例 → 確認 | 匹配完成，列表刷新，選擇清空 |
| 5 | 無映射配置 | 選擇沒有 GLOBAL 映射的模板執行匹配 | 顯示 MAPPING_NOT_FOUND 錯誤（CHANGE-040） |
| 6 | 翻頁後選擇 | 在第 1 頁勾選文件 → 翻到第 2 頁 | 選擇狀態清空（或保留，視實作決策） |
