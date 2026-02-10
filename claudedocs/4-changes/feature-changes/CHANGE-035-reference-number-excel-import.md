# CHANGE-035: 參考編號匯入功能改為 Excel 格式

> **日期**: 2026-02-10
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: UI Enhancement / Feature
> **影響範圍**: 參考編號管理 — 匯入對話框、API 路由、Hook、i18n

---

## 變更背景

目前參考編號匯入功能使用 JSON 文件格式（上傳 `.json` 或拖放），用戶需要準備結構化的 JSON 陣列。這對非技術用戶不夠友善，實際業務場景中用戶更習慣使用 Excel 試算表管理參考編號資料。

### 現有問題

1. **JSON 格式對業務用戶不友善** — 需要了解 JSON 語法才能準備資料
2. **沒有視覺化的欄位對應** — 用戶無法直觀看到哪些欄位是必填的
3. **與匯出格式不一致** — 匯出功能已有 Excel 支援模式（`ExcelJS`），但匯入仍停留在 JSON

### 目標

將匯入格式從 JSON 改為 Excel (.xlsx)，提供標準範本下載，降低用戶使用門檻。

---

## 變更內容

### 1. 前端組件：Excel 檔案上傳與解析

- **接受格式**：`.xlsx`（取代 `.json`）
- **前端解析**：使用 `ExcelJS` 在瀏覽器端讀取 Excel 工作表
- **欄位映射**：自動映射 Excel 欄位名稱到系統欄位（支援中英文欄位名）
- **資料預覽**：以表格顯示前 10 筆解析結果，含驗證狀態
- **範本下載**：提供標準 Excel 範本（含欄位名稱、資料格式說明、範例資料）

### 2. Excel 範本欄位設計

| 欄位名稱 (EN) | 欄位名稱 (ZH) | 必填 | 格式說明 | 範例 |
|---------------|---------------|------|----------|------|
| Number | 號碼 | ✅ | 文字，1-100 字元 | `SHP-2026-001` |
| Type | 類型 | ✅ | SHIPMENT/DELIVERY/BOOKING/CONTAINER/HAWB/MAWB/BL/CUSTOMS/OTHER | `SHIPMENT` |
| Year | 年份 | ✅ | 整數，2000-2100 | `2026` |
| Region Code | 地區代碼 | ✅ | 已存在的地區代碼 | `APAC` |
| Code | 識別碼 | ❌ | 英數字+底線+連字號，自動生成 | `REF-2026-APAC-A1B2` |
| Description | 描述 | ❌ | 文字，最多 500 字元 | `Shipment from HK` |
| Valid From | 有效起始日 | ❌ | YYYY-MM-DD | `2026-01-01` |
| Valid Until | 有效結束日 | ❌ | YYYY-MM-DD | `2026-12-31` |
| Is Active | 啟用 | ❌ | TRUE/FALSE（預設 TRUE） | `TRUE` |

### 3. API 路由改造

將 `/api/v1/reference-numbers/import` 從接受 JSON body 改為接受 `multipart/form-data`，在伺服器端解析 Excel 文件。

### 4. 選項保留

維持現有的兩個匯入選項：
- **覆蓋現有記錄** (`overwriteExisting`)
- **跳過無效記錄** (`skipInvalid`)

---

## 技術設計

### 架構決策：前端解析 vs 後端解析

**選擇：前端解析 Excel → 轉換為 JSON → 呼叫現有 API**

| 比較項 | 前端解析 ✅ | 後端解析 |
|--------|------------|----------|
| API 改動 | 無需改動（復用現有 JSON API） | 需改為 multipart/form-data |
| 預覽功能 | 天然支援（解析後即可顯示） | 需額外 preview API |
| ExcelJS bundle | 增加前端 bundle 約 500KB | 僅後端依賴 |
| 驗證體驗 | 即時反饋欄位錯誤 | 需等 API 回應 |
| 大檔案 | 受瀏覽器記憶體限制 | 可處理更大檔案 |

> **結論**：前端解析方案改動最小，復用現有 API，且提供更好的即時預覽體驗。最大 1000 筆的限制下，前端解析效能不是問題。

### 修改範圍

| 文件 | 變更內容 |
|------|----------|
| `src/components/features/reference-number/ReferenceNumberImportDialog.tsx` | 🔧 重寫：JSON 上傳改為 Excel 上傳，新增 Excel 解析邏輯、範本下載按鈕、欄位映射預覽表格 |
| `src/hooks/use-reference-numbers.ts` | 🔧 微調：`useImportReferenceNumbers` 維持不變（仍送 JSON），可能新增範本下載 helper |
| `messages/en/referenceNumber.json` | 🔧 更新 `import.*` 相關翻譯 key |
| `messages/zh-TW/referenceNumber.json` | 🔧 同上 |
| `messages/zh-CN/referenceNumber.json` | 🔧 同上 |

### 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `src/app/api/v1/reference-numbers/import/route.ts` | API 接收 JSON body 不變 |
| `src/lib/validations/reference-number.schema.ts` | Zod schema 不變 |
| `src/services/reference-number.service.ts` | service 層不變 |
| `prisma/schema.prisma` | 無資料庫變更 |

### Excel 解析流程

```
用戶上傳 .xlsx 文件
    ↓
前端 ExcelJS 讀取工作表
    ↓
解析表頭（支援中英文欄位名映射）
    ↓
逐行讀取資料，轉換為 importItemSchema 格式
    ↓
顯示預覽表格（前 10 筆 + 驗證狀態）
    ↓
用戶確認選項（覆蓋/跳過）
    ↓
將解析結果以 JSON 格式呼叫現有 API
    ↓
顯示匯入結果統計
```

### 範本下載實作

在前端動態生成 Excel 範本（使用 ExcelJS），包含：
- Sheet 1: **Data**（空白資料表，含欄位名稱表頭）
- Sheet 2: **Instructions**（欄位說明、格式要求、範例值）

### i18n 影響

| 語言 | 文件 | 需要更新的 Key |
|------|------|---------------|
| en | `messages/en/referenceNumber.json` | `import.description`, `import.dropzone`, `import.parseError`, 新增 `import.downloadTemplate`, `import.sheetName`, `import.columnMapping.*` |
| zh-TW | `messages/zh-TW/referenceNumber.json` | 同上 |
| zh-CN | `messages/zh-CN/referenceNumber.json` | 同上 |

---

## 設計決策

1. **前端解析 Excel** — 復用現有 JSON API，改動最小，即時預覽體驗佳
2. **ExcelJS 前後端統一** — 項目已使用 ExcelJS 進行匯出，匯入也用同一套庫，減少依賴
3. **支援中英文欄位名** — 允許用戶使用中文或英文表頭，映射到相同的系統欄位
4. **內建範本下載** — 降低用戶準備資料的門檻，確保格式正確

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/components/features/reference-number/ReferenceNumberImportDialog.tsx` | 🔧 修改 | 核心變更：Excel 解析 + 範本下載 + 預覽表格 |
| `messages/en/referenceNumber.json` | 🔧 修改 | 更新 import 相關翻譯 |
| `messages/zh-TW/referenceNumber.json` | 🔧 修改 | 同上 |
| `messages/zh-CN/referenceNumber.json` | 🔧 修改 | 同上 |

### 向後兼容性

- **API 層**：完全向後兼容，JSON API 不變
- **Service 層**：完全向後兼容，業務邏輯不變
- **前端**：匯入對話框 UI 變更，但導出的 JSON 格式仍可用（進階用戶可手動呼叫 API）

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | Excel 檔案上傳 | 支援拖放和點擊選擇 `.xlsx` 文件 | High |
| 2 | Excel 解析 | 正確解析表頭和資料行，支援中英文欄位名 | High |
| 3 | 資料預覽 | 上傳後顯示前 10 筆解析結果，含驗證狀態標記 | High |
| 4 | 範本下載 | 點擊下載標準 Excel 範本，含欄位說明和範例資料 | High |
| 5 | 匯入執行 | 點擊匯入後正確送出資料，顯示結果統計 | High |
| 6 | 選項功能 | 覆蓋現有/跳過無效選項正常運作 | Medium |
| 7 | 錯誤處理 | 非 Excel 文件給予提示；空文件/無效格式有明確錯誤 | Medium |
| 8 | i18n 支援 | 三種語言（en/zh-TW/zh-CN）翻譯完整 | Medium |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 正常匯入 | 上傳含 5 筆有效資料的 Excel → 預覽 → 匯入 | 5 筆 imported，預覽正確 |
| 2 | 中文表頭 | 上傳使用中文欄位名的 Excel | 正確映射為系統欄位 |
| 3 | 範本下載 | 點擊「下載範本」 | 下載 .xlsx 檔案，含 Data + Instructions sheets |
| 4 | 無效文件 | 上傳 .pdf 文件 | 顯示格式錯誤提示 |
| 5 | 空工作表 | 上傳只有表頭沒有資料的 Excel | 提示「沒有可匯入的資料」 |
| 6 | 部分無效 | 上傳含無效 regionCode 的資料 + skipInvalid=true | 有效筆數 imported，無效筆數 skipped |
| 7 | 覆蓋模式 | 上傳含重複號碼的資料 + overwriteExisting=true | 重複記錄被更新（updated 計數） |
| 8 | 大量資料 | 上傳含 500 筆資料的 Excel | 預覽前 10 筆，匯入成功 |
