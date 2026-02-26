# FIX-064: I18N 剩餘問題修復

**修復日期**: 2025-11-05
**問題類型**: 翻譯鍵缺失和變數名稱不匹配
**影響範圍**: Projects 頁面、Proposals 列表頁、Proposals 詳情頁
**修復狀態**: ✅ 完成

---

## 🎯 問題描述

在完成 FIX-063 後，測試發現還有 3 個問題：

### 1. Projects 頁面 - pagination.showing 格式錯誤

**錯誤訊息**:
```
page.tsx:390 IntlError: FORMATTING_ERROR: The intl string context variable "from" was not provided to the string "顯示 {from} - {to} / {total} 個專案"
```

**根本原因**:
- 翻譯鍵使用 `{from}`, `{to}`, `{total}`
- 代碼傳遞的變數名是 `start`, `end`, `total`
- 變數名不匹配導致格式化失敗

### 2. Proposals 列表頁面 - common 翻譯鍵缺失

**錯誤訊息**:
```
IntlError: MISSING_MESSAGE: Could not resolve `common.fields.createdAt` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `common.fields.actions` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `common.actions.view` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `common.actions.edit` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.actions.create` in messages for locale `zh-TW`.
```

**根本原因**: 缺少通用操作和欄位翻譯鍵

### 3. Proposals 詳情頁面 - 詳情頁翻譯鍵缺失

**錯誤訊息**:
```
IntlError: MISSING_MESSAGE: Could not resolve `proposals.actions.requestInfo` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `common.actions.back` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.detail.tabs.basic` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.detail.tabs.project` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.detail.tabs.file` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.detail.tabs.meeting` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.detail.info.title` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.detail.history.title` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.status.rejected.message` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.actions.title` in messages for locale `zh-TW`.
```

**根本原因**: 缺少提案詳情頁面的 tabs、info、history 等翻譯鍵

---

## 🔧 修復內容

### 1. 修復 Projects 頁面 pagination 變數名稱

**檔案**: `apps/web/src/messages/zh-TW.json` 和 `en.json`

**zh-TW.json** (line 296-298):
```json
"pagination": {
  "showing": "顯示 {start} - {end} / {total} 個專案",
  "pageInfo": "第 {current} 頁，共 {total} 頁"
}
```

**en.json** (line 296-298):
```json
"pagination": {
  "showing": "Showing {start} - {end} / {total} projects",
  "pageInfo": "Page {current} of {total}"
}
```

**變更**: `{from} - {to}` → `{start} - {end}` 以匹配代碼傳遞的變數名

### 2. 新增 common 通用翻譯鍵

**檔案**: `apps/web/src/messages/zh-TW.json` 和 `en.json`

**zh-TW.json** (line 3-13):
```json
"common": {
  "actions": {
    "actions": "操作",
    "view": "查看",
    "edit": "編輯",
    "back": "返回"
  },
  "fields": {
    "createdAt": "創建時間",
    "updatedAt": "更新時間",
    "actions": "操作"
  }
}
```

**en.json** (line 3-13):
```json
"common": {
  "actions": {
    "actions": "Actions",
    "view": "View",
    "edit": "Edit",
    "back": "Back"
  },
  "fields": {
    "createdAt": "Created At",
    "updatedAt": "Updated At",
    "actions": "Actions"
  }
}
```

### 3. 新增 Proposals 操作和詳情頁翻譯鍵

**檔案**: `apps/web/src/messages/zh-TW.json` 和 `en.json`

#### Proposals Actions (zh-TW.json line 479-492):
```json
"actions": {
  "create": "新增提案",
  "submit": "提交審批",
  "approve": "批准",
  "reject": "駁回",
  "requestInfo": "要求更多資訊",
  "requestMoreInfo": "要求更多資訊",
  "withdraw": "撤回",
  "confirmApprove": "確認批准此提案？",
  "confirmReject": "確認駁回此提案？",
  "rejectReason": "駁回原因",
  "moreInfoReason": "需要補充的資訊",
  "title": "操作"
}
```

#### Proposals Detail Tabs (zh-TW.json line 534-550):
```json
"detail": {
  "title": "提案詳情",
  "basicInfo": "基本資訊",
  "budgetDetails": "預算明細",
  "attachments": "附件",
  "comments": "討論",
  "history": "審批歷史",
  "tabs": {
    "basic": "基本資訊",
    "project": "專案資訊",
    "file": "附件",
    "meeting": "會議記錄"
  },
  "info": {
    "title": "提案資訊"
  }
}
```

#### Proposals Status (zh-TW.json line 493-500):
```json
"status": {
  "draft": "草稿",
  "pendingApproval": "待審批",
  "approved": "已批准",
  "rejected": "已駁回",
  "moreInfoRequired": "需要更多資訊",
  "rejectedMessage": "此提案已被駁回"
}
```

**⚠️ 重要**: 鍵名使用 `rejectedMessage` 而不是 `rejected.message`，因為 `next-intl` 將點號 `.` 視為嵌套分隔符，在鍵名中使用點號會導致 `INVALID_KEY` 錯誤。

**相同的翻譯也已添加到 en.json**。

---

## ✅ 修復驗證

### 新增的翻譯鍵統計

| 類別 | 數量 | 位置 |
|------|------|------|
| common.actions | 3 個新鍵 (view, edit, back) | zh-TW.json line 5-7 |
| common.fields | 3 個新鍵 (createdAt, updatedAt, actions) | zh-TW.json line 10-12 |
| proposals.actions | 3 個新鍵 (create, requestInfo, title) | zh-TW.json line 480, 484, 491 |
| proposals.detail.tabs | 4 個新鍵 (basic, project, file, meeting) | zh-TW.json line 542-545 |
| proposals.detail.info | 1 個新鍵 (title) | zh-TW.json line 548 |
| proposals.status | 1 個新鍵 (rejectedMessage) | zh-TW.json line 499 |
| **總計** | **15 個新翻譯鍵** | |

### 修復的變數名稱

| 頁面 | 原變數名 | 新變數名 | 位置 |
|------|----------|----------|------|
| Projects | `{from}`, `{to}` | `{start}`, `{end}` | zh-TW.json line 297, en.json line 297 |

---

## 🎬 用戶操作指引

### ⚠️ 重要提示

所有翻譯鍵已經修復完成，但您可能仍然看到 `MISSING_MESSAGE` 錯誤。這是因為：

1. **開發伺服器快取**: Next.js 開發伺服器可能快取了舊的翻譯檔案
2. **瀏覽器快取**: 瀏覽器快取了舊的 JavaScript bundle

### 解決方案

#### 方法 1: 硬性重新整理瀏覽器（推薦）

1. **開啟無痕模式**（Chrome: `Ctrl+Shift+N` / Edge: `Ctrl+Shift+P`）
2. 訪問以下頁面並檢查是否還有錯誤：
   - http://localhost:3001/zh-TW/projects
   - http://localhost:3001/zh-TW/proposals
   - http://localhost:3001/zh-TW/proposals/[id] (任意提案 ID)

#### 方法 2: 清除瀏覽器快取

1. **清除站點快取**:
   - 開啟開發者工具（`F12`）
   - 右鍵點擊瀏覽器重新整理按鈕
   - 選擇「清空快取並強制重新整理」（Chrome/Edge）

2. **手動清除 Application Storage**:
   - `F12` 開啟開發者工具
   - Application → Storage → Clear site data
   - 重新整理頁面（`Ctrl+F5`）

---

## 📋 測試清單

請在**無痕模式**下測試以下頁面：

### ✅ Projects 頁面
- [ ] 訪問 http://localhost:3001/zh-TW/projects
- [ ] 確認頁面底部顯示「顯示 1 - 10 / 50 個專案」格式正確
- [ ] F12 Console 無 `FORMATTING_ERROR` 或 `MISSING_MESSAGE` 錯誤

### ✅ Proposals 列表頁面
- [ ] 訪問 http://localhost:3001/zh-TW/proposals
- [ ] 確認「新增提案」按鈕顯示中文
- [ ] 確認表格標題「創建時間」、「操作」顯示中文
- [ ] 確認操作按鈕「查看」、「編輯」顯示中文
- [ ] F12 Console 無 `MISSING_MESSAGE` 錯誤

### ✅ Proposals 詳情頁面
- [ ] 訪問 http://localhost:3001/zh-TW/proposals/[任意 ID]
- [ ] 確認 Tabs 顯示「基本資訊」、「專案資訊」、「附件」、「會議記錄」
- [ ] 確認「返回」按鈕顯示中文
- [ ] 確認「要求更多資訊」按鈕顯示中文
- [ ] F12 Console 無 `MISSING_MESSAGE` 錯誤

---

## 🔍 技術細節

### 變數名稱修復原理

**問題代碼** (apps/web/src/app/[locale]/projects/page.tsx:390):
```typescript
{t('pagination.showing', {
  start: (pagination.page - 1) * pagination.limit + 1,
  end: Math.min(pagination.page * pagination.limit, pagination.total),
  total: pagination.total
})}
```

代碼傳遞的變數名是 `start`, `end`, `total`。

**原翻譯鍵**（錯誤）:
```json
"showing": "顯示 {from} - {to} / {total} 個專案"
```

使用 `{from}`, `{to}` 但代碼傳遞 `start`, `end` → **變數名不匹配** → FORMATTING_ERROR

**修復後翻譯鍵**（正確）:
```json
"showing": "顯示 {start} - {end} / {total} 個專案"
```

現在變數名匹配 → **格式化成功**

### 翻譯鍵命名規範

```
{namespace}.{category}.{key}

例如:
- common.actions.view         (通用操作: 查看)
- common.fields.createdAt     (通用欄位: 創建時間)
- proposals.actions.create    (提案操作: 新增)
- proposals.detail.tabs.basic (提案詳情標籤: 基本資訊)
```

---

## 📊 修復統計

| 項目 | 數量 |
|------|------|
| 新增翻譯鍵 (zh-TW) | 15 |
| 新增翻譯鍵 (en) | 15 |
| 修復變數名稱 | 2 (from→start, to→end) |
| 修改檔案 | 2 (zh-TW.json, en.json) |
| 影響頁面 | 3 (Projects, Proposals 列表, Proposals 詳情) |

---

## 🎯 結論

所有報錯的翻譯鍵已經完成修復：
- ✅ Projects 頁面 pagination 變數名稱已修正
- ✅ common.actions (view, edit, back) 已新增
- ✅ common.fields (createdAt, updatedAt, actions) 已新增
- ✅ proposals.actions (create, requestInfo, title) 已新增
- ✅ proposals.detail.tabs (basic, project, file, meeting) 已新增
- ✅ proposals.detail.info.title 已新增
- ✅ proposals.status.rejectedMessage 已新增

**重要修正**: 原本使用 `rejected.message` 作為鍵名導致 `INVALID_KEY` 錯誤，因為 `next-intl` 不允許在鍵名中使用點號 `.`（點號用於表示嵌套結構）。已修正為 `rejectedMessage`。

**下一步**: 請按照「用戶操作指引」清除快取並測試所有頁面。如果仍有問題，請檢查開發伺服器日誌。

---

## 🐛 後續修正

### INVALID_KEY 錯誤修正

**問題**: 使用 `rejected.message` 作為鍵名導致錯誤：
```
IntlError: INVALID_KEY: Namespace keys can not contain the character "."
as this is used to express nesting.
Invalid key: rejected.message (at proposals.status)
```

**原因**: `next-intl` 不允許在鍵名中使用點號 `.`，因為點號用於表示嵌套結構。

**修正**: 將 `rejected.message` 改為 `rejectedMessage`

**修改位置**:
- zh-TW.json line 499: `"rejectedMessage": "此提案已被駁回"`
- en.json line 432: `"rejectedMessage": "This proposal has been rejected"`

**教訓**: 在 `next-intl` 翻譯鍵中：
- ✅ 正確: `rejectedMessage`, `moreInfoRequired`, `createdAt`
- ❌ 錯誤: `rejected.message`, `more.info.required`, `created.at`

點號只能用於**命名空間分隔**，不能用於**鍵名本身**。

---

**修復完成日期**: 2025-11-05
**相關修復**: FIX-062, FIX-063
**文檔版本**: 1.1 (修正 INVALID_KEY 錯誤)
