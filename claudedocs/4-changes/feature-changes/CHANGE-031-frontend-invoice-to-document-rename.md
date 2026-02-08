# CHANGE-031: 前端 Invoice 統一重命名為 Document

> **日期**: 2026-02-07
> **狀態**: ✅ 已完成
> **完成日期**: 2026-02-08
> **優先級**: Medium
> **類型**: Refactor
> **影響範圍**: 前端頁面路由、組件目錄/名稱、Hooks、i18n 翻譯、Sidebar 導航

---

## 變更背景

項目初期以處理 Freight Invoice（貨運發票）為核心設計目標，因此前端路由、組件命名、翻譯文件均以 `invoice` 為主。隨著項目發展，系統已支援多種文件類型（不僅限於發票），需要將前端展示層的命名從 `Invoice` 統一改為更通用的 `Document`，以反映系統的真實定位。

**重要邊界**：本次變更**僅限前端展示層**，不涉及：
- ❌ 後端服務層（`src/services/`）
- ❌ API 路由（`src/app/api/`、`/api/v1/invoices/`）
- ❌ 資料庫 Schema（Prisma）
- ❌ 類型定義中的業務欄位（`INVOICE_FIELDS`、`InvoiceData`）
- ❌ 外部 API 端點 URL

---

## 變更內容

### 1. 前端路由重命名

| 現有路由 | 新路由 | 頁面功能 |
|---------|--------|---------|
| `/[locale]/invoices` | `/[locale]/documents` | 文件列表頁 |
| `/[locale]/invoices/upload` | `/[locale]/documents/upload` | 文件上傳頁 |
| `/[locale]/invoices/[id]` | `/[locale]/documents/[id]` | 文件詳情頁 |

**實作方式**：將 `src/app/[locale]/(dashboard)/invoices/` 整個目錄重命名為 `documents/`。

### 2. 組件目錄與名稱重命名

#### 2.1 目錄結構變更

```
src/components/features/invoice/           →  src/components/features/document/
├── index.ts                               →  index.ts
├── FileUploader.tsx                       →  FileUploader.tsx（保持不變）
├── InvoiceListTable.tsx                   →  DocumentListTable.tsx
├── ProcessingStatus.tsx                   →  ProcessingStatus.tsx（保持不變）
├── RetryButton.tsx                        →  RetryButton.tsx（保持不變）
└── detail/                                →  detail/
    ├── index.ts                           →  index.ts
    ├── InvoiceDetailHeader.tsx            →  DocumentDetailHeader.tsx
    ├── InvoiceDetailStats.tsx             →  DocumentDetailStats.tsx
    ├── InvoiceDetailTabs.tsx              →  DocumentDetailTabs.tsx
    ├── ProcessingTimeline.tsx             →  ProcessingTimeline.tsx（保持不變）
    ├── InvoiceAuditLog.tsx                →  DocumentAuditLog.tsx
    ├── AiDetailsTab.tsx                   →  AiDetailsTab.tsx（保持不變）
    └── SmartRoutingBanner.tsx             →  SmartRoutingBanner.tsx（保持不變）
```

#### 2.2 組件名稱對照表

| 現有組件名稱 | 新組件名稱 | 檔案是否重命名 |
|-------------|-----------|-------------|
| `FileUploader` | `FileUploader` | ❌ 不改（通用名稱） |
| `InvoiceListTable` | `DocumentListTable` | ✅ 改 |
| `ProcessingStatus` | `ProcessingStatus` | ❌ 不改（通用名稱） |
| `RetryButton` | `RetryButton` | ❌ 不改（通用名稱） |
| `InvoiceDetailHeader` | `DocumentDetailHeader` | ✅ 改 |
| `InvoiceDetailStats` | `DocumentDetailStats` | ✅ 改 |
| `InvoiceDetailTabs` | `DocumentDetailTabs` | ✅ 改 |
| `ProcessingTimeline` | `ProcessingTimeline` | ❌ 不改（通用名稱） |
| `InvoiceAuditLog` | `DocumentAuditLog` | ✅ 改 |
| `AiDetailsTab` | `AiDetailsTab` | ❌ 不改（通用名稱） |
| `SmartRoutingBanner` | `SmartRoutingBanner` | ❌ 不改（通用名稱） |

### 3. Hook 重命名

| 現有 Hook | 新 Hook | 函數名稱變更 |
|----------|---------|------------|
| `src/hooks/use-invoice-detail.ts` | `src/hooks/use-document-detail.ts` | `useInvoiceDetail` → `useDocumentDetail`、`useInvalidateInvoiceDetail` → `useInvalidateDocumentDetail` |

### 4. i18n 翻譯文件變更

#### 4.1 翻譯文件重命名

| 現有文件 | 新文件 |
|---------|--------|
| `messages/en/invoices.json` | `messages/en/documents.json` |
| `messages/zh-TW/invoices.json` | `messages/zh-TW/documents.json` |
| `messages/zh-CN/invoices.json` | `messages/zh-CN/documents.json` |

#### 4.2 翻譯命名空間變更

所有組件中的 `useTranslations('invoices')` → `useTranslations('documents')`

涉及 **15 個文件**：
- 3 個頁面組件
- 12 個功能組件

#### 4.3 翻譯內容文字替換

需要將用戶可見的「Invoice/發票/发票」文字替換為「Document/文件/文件」：

**頁面標題與描述**：

| Key | EN 現有 → 新 | zh-TW 現有 → 新 | zh-CN 現有 → 新 |
|-----|-------------|---------------|---------------|
| `page.title` | "Invoice Documents" → "Documents" | "發票文件" → "文件列表" | "发票文件" → "文件列表" |
| `page.description` | "Manage and track uploaded invoice processing status" → "Manage and track uploaded document processing status" | "管理和追蹤上傳的發票處理狀態" → "管理和追蹤上傳的文件處理狀態" | 同理 |
| `upload.title` | "Upload Invoice Files" → "Upload Documents" | "上傳發票文件" → "上傳文件" | 同理 |
| `upload.description` | 含 "invoice files" → "document files" | 含 "發票文件" → "文件" | 同理 |
| `detail.title` | "Invoice Details" → "Document Details" | "發票詳情" → "文件詳情" | 同理 |
| `table.empty` | "No invoices found" → "No documents found" | "沒有發票" → "沒有文件" | 同理 |
| `table.emptyDescription` | "Upload a new invoice to get started" → "Upload a new document to get started" | 含 "發票" → "文件" | 同理 |
| `uploadErrors.forbidden` | 含 "upload invoices" → "upload documents" | 含 "上傳發票" → "上傳文件" | 同理 |
| `detail.deleteConfirmTitle` | "Delete Document" | （已是 Document，不需改） | |

**注意**：invoices.json 中約有 **257 個 Key**，大部分內容（如狀態文字、選項卡名稱、時間軸步驟等）**不含 invoice 字樣**，不需要修改。只有約 **15-20 個 Key 的值**包含 "invoice/發票/发票" 需要替換。

#### 4.4 Navigation 翻譯更新

| Key | EN 現有 → 新 | zh-TW 現有 → 新 | zh-CN 現有 → 新 |
|-----|-------------|---------------|---------------|
| `sidebar.invoices` | "Invoices" → "Documents" | "發票列表" → "文件列表" | "发票列表" → "文件列表" |
| `sidebar.uploadInvoice` | "Upload Invoice" → "Upload Document" | "上傳發票" → "上傳文件" | "上传发票" → "上传文件" |
| `topbar.searchPlaceholder` | "Search invoices, forwarders..." → "Search documents, forwarders..." | "搜尋發票、Forwarder..." → "搜尋文件、Forwarder..." | 同理 |
| `topbar.mockNotifications.invoiceApproved.title` | "Invoice Review Completed" → "Document Review Completed" | "發票審核完成" → "文件審核完成" | 同理 |
| `topbar.mockNotifications.invoiceApproved.message` | 含 "Invoice INV-2024-001" → "Document INV-2024-001" | 含 "發票 INV-2024-001" → "文件 INV-2024-001" | 同理 |
| `topbar.mockNotifications.lowConfidence.message` | "3 invoices require..." → "3 documents require..." | "3 張發票需要..." → "3 個文件需要..." | 同理 |

#### 4.5 Common 翻譯更新

| Key | EN 現有 → 新 | zh-TW 現有 → 新 | zh-CN 現有 → 新 |
|-----|-------------|---------------|---------------|
| `navigation.invoices` | "Invoices" → "Documents" | "發票文件" → "文件列表" | "发票文件" → "文件列表" |

### 5. Sidebar 導航路由更新

修改 `src/components/layout/Sidebar.tsx` 中的路由配置：

```typescript
// 現有：
{ nameKey: 'sidebar.invoices', href: '/invoices', icon: FileText },
{ nameKey: 'sidebar.uploadInvoice', href: '/invoices/upload', icon: Upload },

// 改為：
{ nameKey: 'sidebar.documents', href: '/documents', icon: FileText },
{ nameKey: 'sidebar.uploadDocument', href: '/documents/upload', icon: Upload },
```

---

## 技術設計

### 修改範圍

| 文件 | 變更類型 | 變更內容 |
|------|---------|---------|
| `src/app/[locale]/(dashboard)/invoices/` (整個目錄) | 🔧 重命名 | 目錄名 → `documents/` |
| `src/app/[locale]/(dashboard)/invoices/page.tsx` | 🔧 修改 | JSDoc、useTranslations namespace、import 路徑 |
| `src/app/[locale]/(dashboard)/invoices/upload/page.tsx` | 🔧 修改 | JSDoc、useTranslations namespace、import 路徑 |
| `src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` | 🔧 修改 | JSDoc、useTranslations namespace、import 路徑、組件名稱引用 |
| `src/app/[locale]/(dashboard)/invoices/[id]/loading.tsx` | 🔧 修改 | 隨目錄移動 |
| `src/components/features/invoice/` (整個目錄) | 🔧 重命名 | 目錄名 → `document/` |
| `src/components/features/invoice/index.ts` | 🔧 修改 | 更新導出組件名稱和路徑 |
| `src/components/features/invoice/InvoiceListTable.tsx` | 🔧 重命名+修改 | 檔名 → `DocumentListTable.tsx`、組件名、JSDoc |
| `src/components/features/invoice/FileUploader.tsx` | 🔧 修改 | useTranslations namespace、JSDoc |
| `src/components/features/invoice/ProcessingStatus.tsx` | 🔧 修改 | useTranslations namespace |
| `src/components/features/invoice/RetryButton.tsx` | 🔧 修改 | useTranslations namespace |
| `src/components/features/invoice/detail/index.ts` | 🔧 修改 | 更新導出組件名稱和路徑 |
| `src/components/features/invoice/detail/InvoiceDetailHeader.tsx` | 🔧 重命名+修改 | 檔名 → `DocumentDetailHeader.tsx`、組件名、JSDoc |
| `src/components/features/invoice/detail/InvoiceDetailStats.tsx` | 🔧 重命名+修改 | 檔名 → `DocumentDetailStats.tsx`、組件名、JSDoc |
| `src/components/features/invoice/detail/InvoiceDetailTabs.tsx` | 🔧 重命名+修改 | 檔名 → `DocumentDetailTabs.tsx`、組件名、JSDoc |
| `src/components/features/invoice/detail/InvoiceAuditLog.tsx` | 🔧 重命名+修改 | 檔名 → `DocumentAuditLog.tsx`、組件名、JSDoc |
| `src/components/features/invoice/detail/ProcessingTimeline.tsx` | 🔧 修改 | useTranslations namespace |
| `src/components/features/invoice/detail/AiDetailsTab.tsx` | 🔧 修改 | useTranslations namespace |
| `src/components/features/invoice/detail/SmartRoutingBanner.tsx` | 🔧 修改 | useTranslations namespace |
| `src/hooks/use-invoice-detail.ts` | 🔧 重命名+修改 | 檔名 → `use-document-detail.ts`、函數名、JSDoc |
| `src/components/layout/Sidebar.tsx` | 🔧 修改 | 路由路徑、翻譯 Key 名稱 |
| `messages/en/invoices.json` | 🔧 重命名+修改 | 檔名 → `documents.json`、含 invoice 文字替換 |
| `messages/zh-TW/invoices.json` | 🔧 重命名+修改 | 同上 |
| `messages/zh-CN/invoices.json` | 🔧 重命名+修改 | 同上 |
| `messages/en/navigation.json` | 🔧 修改 | sidebar Key 名稱、topbar 文字內容 |
| `messages/zh-TW/navigation.json` | 🔧 修改 | 同上 |
| `messages/zh-CN/navigation.json` | 🔧 修改 | 同上 |
| `messages/en/common.json` | 🔧 修改 | `navigation.invoices` Key |
| `messages/zh-TW/common.json` | 🔧 修改 | 同上 |
| `messages/zh-CN/common.json` | 🔧 修改 | 同上 |

### i18n 影響

| 語言 | 文件 | 需要更新的 Key |
|------|------|---------------|
| en | `messages/en/documents.json`（重命名） | `page.title`, `page.description`, `upload.title`, `upload.description`, `upload.selectCityHint`, `detail.title`, `table.empty`, `table.emptyDescription`, `uploadErrors.forbidden`（約 15 個 Key） |
| en | `messages/en/navigation.json` | `sidebar.invoices` → `sidebar.documents`, `sidebar.uploadInvoice` → `sidebar.uploadDocument`, `topbar.searchPlaceholder`, `topbar.mockNotifications.*`（約 6 個 Key） |
| en | `messages/en/common.json` | `navigation.invoices`（1 個 Key） |
| zh-TW | 同上三個文件 | 同上 Key，值改為繁體中文 |
| zh-CN | 同上三個文件 | 同上 Key，值改為簡體中文 |

### 需要額外檢查的文件

| 文件 | 檢查原因 |
|------|---------|
| `src/components/features/forwarders/RecentDocumentsTable.tsx` | 使用 `useTranslations('invoice')`（單數），需確認是否需改為 `useTranslations('documents')` |
| `src/i18n/request.ts` | 確認 i18n 配置是否自動載入 JSON 檔名，重命名後是否需調整 |
| `src/app/[locale]/(dashboard)/layout.tsx` | 確認是否有硬編碼的 `/invoices` 路由引用 |

---

## 設計決策

1. **僅改前端展示層** — 後端 API、服務、資料庫保持 `invoice` 命名。前端作為展示層可以獨立於後端命名，這是常見的解耦模式。

2. **通用名稱組件不改名** — `FileUploader`、`ProcessingStatus`、`RetryButton`、`ProcessingTimeline`、`AiDetailsTab`、`SmartRoutingBanner` 這些名稱本身不含 `Invoice`，屬通用命名，不需改名，減少不必要的變更量。

3. **i18n 文件重命名（而非僅改內容）** — 將 `invoices.json` 重命名為 `documents.json`，使命名空間與語義一致。雖然需要同步更新所有 `useTranslations()` 調用，但可確保長期維護清晰度。

4. **Navigation Key 同步更新** — `sidebar.invoices` → `sidebar.documents` 等，保持 Key 名稱與路由語義一致。

5. **保留業務術語** — 翻譯內容中提及具體發票編號（如 `INV-2024-001`）的地方保留原樣，因為這是業務識別碼格式。

---

## 實施計劃（分 4 階段）

### 階段 1：i18n 翻譯文件（低風險，先處理）

1. 將 `messages/*/invoices.json` 重命名為 `messages/*/documents.json`
2. 替換 documents.json 中含 "invoice/發票/发票" 的用戶可見文字
3. 更新 `messages/*/navigation.json` 的 Key 名稱和文字
4. 更新 `messages/*/common.json` 的相關 Key

### 階段 2：組件目錄和文件重命名

1. 將 `src/components/features/invoice/` 重命名為 `document/`
2. 重命名含 `Invoice` 的組件檔案（6 個檔案）
3. 更新組件內的 `export function` 名稱
4. 更新 `index.ts` 的導出清單

### 階段 3：頁面路由和 Hook 重命名

1. 將 `src/app/[locale]/(dashboard)/invoices/` 重命名為 `documents/`
2. 將 `src/hooks/use-invoice-detail.ts` 重命名為 `use-document-detail.ts`
3. 更新所有頁面中的 import 路徑和組件引用
4. 更新所有 `useTranslations('invoices')` → `useTranslations('documents')`

### 階段 4：導航和交叉引用

1. 更新 `Sidebar.tsx` 的路由路徑和翻譯 Key
2. 檢查並更新 `RecentDocumentsTable.tsx` 等外部引用
3. 全局搜索殘留的 `invoice` 前端引用
4. 執行 `npm run i18n:check` 和 `npm run type-check` 驗證

---

## 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| 遺漏某個 import 路徑 | 中 | 🔴 編譯錯誤 | TypeScript 編譯器會立即捕獲 |
| i18n Key 不同步 | 中 | 🟡 MISSING_MESSAGE 錯誤 | 執行 `npm run i18n:check` 驗證 |
| 外部文件引用 `@/components/features/invoice/` | 低 | 🔴 編譯錯誤 | 全局搜索 `features/invoice` 確認 |
| 書籤/收藏的 `/invoices` URL 失效 | 低 | 🟡 404 頁面 | 可選：添加重定向規則 |

### 回滾計劃

由於所有變更均為文件重命名和內容替換，可通過 `git checkout` 完全回滾。建議在實作前建立 commit 作為恢復點。

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/app/[locale]/(dashboard)/invoices/` | 🔧 重命名為 `documents/` | 整個路由目錄 |
| `src/app/[locale]/(dashboard)/invoices/page.tsx` | 🔧 修改 | 導入路徑、namespace |
| `src/app/[locale]/(dashboard)/invoices/upload/page.tsx` | 🔧 修改 | 導入路徑、namespace |
| `src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` | 🔧 修改 | 導入路徑、namespace、組件名 |
| `src/app/[locale]/(dashboard)/invoices/[id]/loading.tsx` | 🔧 移動 | 隨目錄 |
| `src/components/features/invoice/` | 🔧 重命名為 `document/` | 整個組件目錄 |
| `src/components/features/invoice/InvoiceListTable.tsx` | 🔧 重命名+修改 | → `DocumentListTable.tsx` |
| `src/components/features/invoice/detail/InvoiceDetailHeader.tsx` | 🔧 重命名+修改 | → `DocumentDetailHeader.tsx` |
| `src/components/features/invoice/detail/InvoiceDetailStats.tsx` | 🔧 重命名+修改 | → `DocumentDetailStats.tsx` |
| `src/components/features/invoice/detail/InvoiceDetailTabs.tsx` | 🔧 重命名+修改 | → `DocumentDetailTabs.tsx` |
| `src/components/features/invoice/detail/InvoiceAuditLog.tsx` | 🔧 重命名+修改 | → `DocumentAuditLog.tsx` |
| `src/hooks/use-invoice-detail.ts` | 🔧 重命名+修改 | → `use-document-detail.ts` |
| `src/components/layout/Sidebar.tsx` | 🔧 修改 | 路由路徑、Key 名稱 |
| `messages/en/invoices.json` | 🔧 重命名+修改 | → `documents.json` |
| `messages/zh-TW/invoices.json` | 🔧 重命名+修改 | → `documents.json` |
| `messages/zh-CN/invoices.json` | 🔧 重命名+修改 | → `documents.json` |
| `messages/en/navigation.json` | 🔧 修改 | Key 和值 |
| `messages/zh-TW/navigation.json` | 🔧 修改 | Key 和值 |
| `messages/zh-CN/navigation.json` | 🔧 修改 | Key 和值 |
| `messages/en/common.json` | 🔧 修改 | 1 個 Key |
| `messages/zh-TW/common.json` | 🔧 修改 | 1 個 Key |
| `messages/zh-CN/common.json` | 🔧 修改 | 1 個 Key |

**總計：~30 個文件**（含 6 個重命名 + 24 個修改）

### 向後兼容性

- **前端路由**: `/invoices` 路由將不再存在。如需向後兼容，可在 `next.config.js` 中添加重定向規則（可選）。
- **後端 API**: 不受影響，`/api/v1/invoices/` 保持不變。
- **資料庫**: 不受影響。
- **外部系統**: 不受影響。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 路由可訪問 | `/documents`、`/documents/upload`、`/documents/[id]` 均可正常訪問 | High |
| 2 | Sidebar 導航正確 | 側邊欄顯示 "Documents"/"文件列表" 和 "Upload Document"/"上傳文件" | High |
| 3 | 頁面標題正確 | 三種語言的頁面標題均顯示為 "Document" 相關文字而非 "Invoice" | High |
| 4 | i18n 無報錯 | `npm run i18n:check` 通過，無 `IntlError: MISSING_MESSAGE` | High |
| 5 | TypeScript 編譯通過 | `npm run type-check` 無錯誤 | High |
| 6 | 文件上傳功能正常 | 在 `/documents/upload` 頁面可正常上傳文件 | High |
| 7 | 文件詳情正常 | 在 `/documents/[id]` 可查看詳情、選項卡切換正常 | High |
| 8 | 三語切換正常 | 切換 EN/zh-TW/zh-CN 均顯示正確翻譯 | Medium |
| 9 | 搜尋提示更新 | 頂部搜尋框提示文字已從 "invoices" 改為 "documents" | Medium |
| 10 | 通知文字更新 | Mock 通知中的 "Invoice" 文字已改為 "Document" | Low |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 文件列表頁載入 | 導航至 `/documents` | 頁面正常載入，標題顯示 "Documents"（EN）或 "文件列表"（zh-TW） |
| 2 | 文件上傳頁載入 | 點擊側邊欄 "Upload Document" | 導航至 `/documents/upload`，上傳表單正常顯示 |
| 3 | 文件詳情頁載入 | 在列表點擊某個文件 | 導航至 `/documents/[id]`，詳情頁正常顯示 |
| 4 | Sidebar 導航高亮 | 在 `/documents` 頁面觀察側邊欄 | "Documents" 項目處於高亮狀態 |
| 5 | 語言切換 | 在 `/documents` 切換語言 | EN → "Documents"、zh-TW → "文件列表"、zh-CN → "文件列表" |
| 6 | 舊路由處理 | 直接訪問 `/invoices` | 顯示 404 或重定向至 `/documents`（取決於是否添加重定向） |
| 7 | 文件上傳流程 | 在上傳頁選擇城市、拖放文件、提交 | 上傳成功，跳轉至列表頁 |
| 8 | 詳情頁選項卡 | 在詳情頁切換各選項卡 | Preview/Fields/Processing/Audit/AI Details 均正常顯示 |
| 9 | 搜尋功能 | 觀察頂部搜尋框 placeholder | 顯示 "Search documents..." 而非 "Search invoices..." |
| 10 | 構建驗證 | 執行 `npm run build` | 構建成功，無錯誤 |
