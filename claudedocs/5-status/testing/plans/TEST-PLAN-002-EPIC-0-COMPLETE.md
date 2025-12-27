# TEST-PLAN-002: Epic 0 歷史數據初始化 - 完整測試計劃

> **建立日期**: 2025-12-27
> **測試範圍**: Epic 0（Stories 0-1 到 0-9）
> **目標**: 驗證歷史數據初始化完整流程，確保系統能夠處理歷史文件並建立三層映射規則的初始數據基礎

---

## 測試目標

```
┌─────────────────────────────────────────────────────────────────┐
│ Epic 0: 歷史數據初始化                                          │
├─────────────────────────────────────────────────────────────────┤
│ 輸入: 歷史發票文件 (PDF/Image)                                  │
│                                                                  │
│ 處理流程:                                                        │
│ 1. 批次上傳 → 2. 智能路由 → 3. OCR/Vision 處理                  │
│ 4. 公司識別 → 5. 格式分類 → 6. 術語聚合                         │
│                                                                  │
│ 輸出: Company → DocumentFormat → Terms 三層報告                 │
│       作為建立三層映射規則的初始數據基礎                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 測試範圍

### Story 覆蓋

| Story | 名稱 | 測試重點 |
|-------|------|----------|
| 0-1 | 批次文件上傳與元數據偵測 | 上傳流程、文件驗證、元數據提取 |
| 0-2 | 智能處理路由 | 路由決策、成本估算、處理方法選擇 |
| 0-3 | Just-in-Time 公司配置 | 公司匹配、自動創建、合併功能 |
| 0-4 | 批次處理進度追蹤 | SSE 進度、暫停/恢復、錯誤處理 |
| 0-5 | 術語聚合與初始規則 | 術語正規化、AI 分類、批量操作 |
| 0-6 | 批次公司識別整合 | 公司識別配置、統計 API |
| 0-7 | 批次術語聚合整合 | 術語聚合配置、通用術語檢測 |
| 0-8 | 文件發行者識別 | 發行者提取、三層匹配策略 |
| 0-9 | 文件格式術語重組 | 三層聚合結構、階層式報告 |

---

## 測試環境準備

### 測試數據

```
uploads/test-data/
├── native-pdf/           # Native PDF 文件（可選取文字）
│   ├── dhl-invoice-001.pdf
│   ├── fedex-invoice-001.pdf
│   └── ups-invoice-001.pdf
├── scanned-pdf/          # Scanned PDF（圖片型）
│   ├── maersk-invoice-001.pdf
│   └── evergreen-invoice-001.pdf
├── images/               # 圖片文件
│   ├── invoice-photo-001.jpg
│   └── invoice-scan-001.png
└── mixed/                # 混合批次
    └── batch-001/        # 5-10 個不同類型文件
```

### 預期公司

| 公司名稱 | 代碼 | 類型 |
|----------|------|------|
| DHL Express | DHL | FORWARDER |
| FedEx Corporation | FEDEX | FORWARDER |
| UPS Supply Chain | UPS | FORWARDER |
| Maersk Line | MAERSK | CARRIER |
| Evergreen Marine | EMC | CARRIER |

### 預期術語

```
通用術語 (Universal):
- OCEAN FREIGHT
- AIR FREIGHT
- THC (Terminal Handling Charge)
- DOCUMENTATION FEE
- CUSTOMS CLEARANCE

公司特定術語:
- DHL: EXPRESS DELIVERY CHARGE, FUEL SURCHARGE
- FedEx: FEDEX FUEL SURCHARGE, RESIDENTIAL DELIVERY
- Maersk: BAF (Bunker Adjustment Factor), CAF (Currency Adjustment Factor)
```

---

## 測試案例

### Phase 1: 批次上傳與初始設定

#### TC-0-1.1: 單一文件上傳

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證單一文件上傳流程 |
| **前置條件** | 用戶已登入，具有 ADMIN 權限 |
| **測試步驟** | 1. 進入 `/admin/historical-data` <br> 2. 點擊「新增批次」 <br> 3. 輸入批次名稱 <br> 4. 上傳單一 PDF 文件 <br> 5. 確認上傳 |
| **預期結果** | 文件成功上傳，狀態為 `PENDING` |
| **驗證點** | - 文件元數據正確提取（大小、頁數）<br> - 文件類型正確識別（NATIVE_PDF/SCANNED_PDF/IMAGE）<br> - 批次狀態為 `CREATED` |

#### TC-0-1.2: 批次文件上傳

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證多文件批次上傳 |
| **前置條件** | 準備 5 個不同類型的測試文件 |
| **測試步驟** | 1. 新增批次 <br> 2. 拖放 5 個文件到上傳區域 <br> 3. 確認上傳 |
| **預期結果** | 所有文件成功上傳 |
| **驗證點** | - 每個文件的類型正確識別 <br> - 文件列表顯示所有文件 <br> - 批次統計正確 |

#### TC-0-1.3: 文件類型偵測

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證智能文件類型偵測 |
| **測試文件** | Native PDF, Scanned PDF, JPEG, PNG |
| **預期結果** | 每種文件正確識別其類型 |
| **驗證 API** | `GET /api/v1/batches/:batchId/files` 返回正確的 `detectedType` |

---

### Phase 2: 智能處理路由

#### TC-0-2.1: 處理方法選擇

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證不同文件類型的處理路由 |
| **測試案例** | |
| Native PDF | → `DUAL_PROCESSING` (GPT Vision 分類 + Azure DI 數據) |
| Scanned PDF | → `GPT_VISION` (完整 Vision 處理) |
| Image | → `GPT_VISION` (完整 Vision 處理) |
| **驗證 API** | `GET /api/v1/batches/:batchId/files/:fileId` 的 `processingMethod` 欄位 |

#### TC-0-2.2: 成本估算

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證處理成本估算 |
| **測試步驟** | 1. 上傳混合類型批次 <br> 2. 開始處理前查看成本估算 |
| **預期結果** | 顯示估算成本，包含各處理方法的明細 |
| **驗證 API** | `POST /api/v1/batches/:batchId/estimate-cost` |

#### TC-0-2.3: 處理確認對話框

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證處理確認 UI |
| **測試步驟** | 1. 點擊「開始處理」 <br> 2. 查看確認對話框 |
| **預期結果** | 顯示處理方法分佈、成本估算、確認按鈕 |

---

### Phase 3: 公司識別與匹配

#### TC-0-3.1: 公司自動識別

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證從文件內容識別發行公司 |
| **測試文件** | DHL 發票 |
| **預期結果** | 系統識別出發行者為「DHL Express」 |
| **驗證欄位** | `documentIssuerId`, `identificationMethod`, `identificationConfidence` |

#### TC-0-3.2: 三層公司匹配

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證公司匹配的三層策略 |
| **匹配層級** | |
| 完全匹配 | 名稱完全相同 |
| 變體匹配 | 使用 `nameVariants` 匹配 |
| 模糊匹配 | Levenshtein 距離 + 閾值 |
| **驗證方法** | 使用已存在和不存在的公司名稱測試 |

#### TC-0-3.3: Just-in-Time 公司創建

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證新公司自動創建 |
| **前置條件** | 上傳包含未知公司的發票 |
| **預期結果** | - 系統自動創建新公司 <br> - 公司狀態為 `PENDING` <br> - 來源標記為 `AUTO_CREATED` |
| **驗證 API** | `GET /api/companies?status=PENDING` |

#### TC-0-3.4: 公司合併功能

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證重複公司合併 |
| **測試步驟** | 1. 識別出兩個相似公司（如 "DHL" 和 "DHL Express"）<br> 2. 進入公司管理頁面 <br> 3. 選擇合併 |
| **預期結果** | - 源公司的所有文件轉移到目標公司 <br> - 源公司的名稱變體添加到目標公司 <br> - 源公司標記為已合併 |

---

### Phase 4: 批次處理與進度追蹤

#### TC-0-4.1: SSE 進度更新

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證實時進度更新 |
| **測試步驟** | 1. 開始處理批次 <br> 2. 觀察進度面板 |
| **預期結果** | - 進度條實時更新 <br> - 顯示當前處理的文件 <br> - 顯示預估剩餘時間 |
| **驗證** | SSE 連接 `/api/v1/batches/:batchId/progress/stream` |

#### TC-0-4.2: 暫停與恢復

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證處理暫停和恢復功能 |
| **測試步驟** | 1. 開始處理 <br> 2. 點擊「暫停」 <br> 3. 確認狀態變為 `PAUSED` <br> 4. 點擊「恢復」 <br> 5. 確認處理繼續 |
| **預期結果** | 處理可以正確暫停和恢復 |

#### TC-0-4.3: 錯誤處理與重試

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證文件處理錯誤的處理 |
| **測試方法** | 上傳損壞的 PDF 文件 |
| **預期結果** | - 錯誤文件標記為 `ERROR` <br> - 錯誤詳情記錄在 `errorDetails` <br> - 可以手動重試或跳過 |

#### TC-0-4.4: 取消處理

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證批次取消功能 |
| **測試步驟** | 1. 開始處理 <br> 2. 點擊「取消」 <br> 3. 確認取消 |
| **預期結果** | - 批次狀態變為 `CANCELLED` <br> - 未處理的文件保持 `PENDING` <br> - 已處理的文件保留結果 |

---

### Phase 5: 術語聚合與分類

#### TC-0-5.1: 術語正規化

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證術語正規化邏輯 |
| **測試案例** | |
| "Ocean Freight" | → `OCEAN FREIGHT` |
| "OCEAN FREIGHT" | → `OCEAN FREIGHT` |
| "ocean-freight" | → `OCEAN FREIGHT` |
| "THC - Terminal Handling Charge" | → `THC` |
| **驗證** | 正規化後的術語用於聚合 |

#### TC-0-5.2: 通用術語識別

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證跨公司通用術語識別 |
| **測試方法** | 處理來自多個公司的發票 |
| **預期結果** | - 出現在多個公司的術語標記為 `UNIVERSAL` <br> - 統計跨公司出現率 |
| **驗證 API** | `GET /api/v1/batches/:batchId/term-stats` |

#### TC-0-5.3: AI 術語分類

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證 GPT 術語分類 |
| **測試步驟** | 1. 選擇未分類術語 <br> 2. 點擊「AI 分類」 <br> 3. 查看分類結果 |
| **預期結果** | - 術語被分類到標準費用類別 <br> - 顯示分類信心度 |
| **標準類別** | `StandardChargeCategory` 枚舉值 |

#### TC-0-5.4: 批量規則創建

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證從術語創建映射規則 |
| **測試步驟** | 1. 選擇多個術語 <br> 2. 點擊「創建規則」 <br> 3. 選擇規則層級（Universal/Company） <br> 4. 確認創建 |
| **預期結果** | - 創建對應的 MappingRule <br> - 規則類型正確（Tier 1 或 Tier 2）|

---

### Phase 6: 文件格式識別與三層聚合

#### TC-0-6.1: 文件類型分類

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證文件類型識別 |
| **測試文件** | 發票、借項通知單、貸項通知單、報價單 |
| **預期結果** | 每個文件正確分類到 `DocumentType` |
| **DocumentType 枚舉** | INVOICE, DEBIT_NOTE, CREDIT_NOTE, STATEMENT, QUOTATION, BILL_OF_LADING, CUSTOMS_DECLARATION, OTHER |

#### TC-0-6.2: 文件子類型分類

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證文件子類型識別 |
| **測試案例** | 海運發票 → `OCEAN_FREIGHT`，空運發票 → `AIR_FREIGHT` |
| **DocumentSubtype 枚舉** | OCEAN_FREIGHT, AIR_FREIGHT, LAND_TRANSPORT, CUSTOMS_CLEARANCE, WAREHOUSING, GENERAL |

#### TC-0-6.3: 三層聚合結構

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證 Company → Format → Terms 結構 |
| **驗證 API** | `GET /api/v1/batches/:batchId/hierarchical-terms` |
| **預期結構** | |
```json
{
  "companies": [
    {
      "companyId": "...",
      "companyName": "DHL Express",
      "formats": [
        {
          "formatId": "...",
          "documentType": "INVOICE",
          "documentSubtype": "AIR_FREIGHT",
          "terms": [
            { "term": "AIR FREIGHT", "frequency": 15 },
            { "term": "FUEL SURCHARGE", "frequency": 12 }
          ]
        }
      ]
    }
  ],
  "summary": {
    "totalCompanies": 5,
    "totalFormats": 12,
    "totalUniqueTerms": 156
  }
}
```

#### TC-0-6.4: 樹狀視圖 UI

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證 CompanyFormatTree 組件 |
| **測試步驟** | 1. 進入批次詳情頁 <br> 2. 查看階層式術語報告 |
| **預期結果** | - 顯示可展開的樹狀結構 <br> - 公司節點顯示文件數量 <br> - 格式節點顯示類型/子類型標籤 <br> - 術語按頻率排序 |

---

### Phase 7: 端到端流程測試

#### TC-E2E-01: 完整歷史數據初始化流程

| 項目 | 內容 |
|------|------|
| **測試目的** | 驗證完整的端到端流程 |
| **測試步驟** | |

```
Step 1: 批次創建
├── 進入 /admin/historical-data
├── 點擊「新增批次」
├── 輸入批次名稱：「2025-Q1 歷史數據」
├── 啟用「公司識別」和「術語聚合」
└── 確認創建

Step 2: 文件上傳
├── 上傳 10 個混合類型測試文件
├── 確認文件類型正確識別
└── 確認批次統計正確

Step 3: 處理確認
├── 點擊「開始處理」
├── 查看成本估算
└── 確認開始處理

Step 4: 處理監控
├── 觀察進度更新
├── 確認每個文件處理完成
└── 處理完成後狀態為 COMPLETED

Step 5: 結果驗證
├── 查看公司識別結果
│   └── 確認識別的公司列表
├── 查看格式分類結果
│   └── 確認文件類型/子類型
├── 查看術語聚合結果
│   └── 確認三層結構正確
└── 查看階層式報告
    └── 確認 Company → Format → Terms 結構

Step 6: 報告匯出（待實現 CHANGE-002）
├── 點擊「匯出術語報告」
├── 下載 Excel 報告
└── 驗證報告內容
```

| **預期結果** | 完整流程無錯誤完成，產出正確的三層報告 |
| **驗收標準** | - 所有文件處理成功 <br> - 公司正確識別 <br> - 格式正確分類 <br> - 術語正確聚合 |

---

## API 測試清單

### 批次管理 API

| 端點 | 方法 | 測試項目 |
|------|------|----------|
| `/api/admin/historical-data/batches` | POST | 創建批次 |
| `/api/admin/historical-data/batches` | GET | 列出批次 |
| `/api/admin/historical-data/batches/:id` | GET | 批次詳情 |
| `/api/admin/historical-data/batches/:id` | DELETE | 刪除批次 |
| `/api/admin/historical-data/upload/files/bulk` | POST | 批量上傳文件 |
| `/api/v1/batches/:id/process` | POST | 開始處理 |
| `/api/v1/batches/:id/pause` | POST | 暫停處理 |
| `/api/v1/batches/:id/resume` | POST | 恢復處理 |
| `/api/v1/batches/:id/cancel` | POST | 取消處理 |

### 進度追蹤 API

| 端點 | 方法 | 測試項目 |
|------|------|----------|
| `/api/v1/batches/:id/progress/stream` | GET (SSE) | 實時進度 |
| `/api/v1/batches/:id/files/:fileId/retry` | POST | 重試文件 |
| `/api/v1/batches/:id/files/:fileId/skip` | POST | 跳過文件 |

### 公司識別 API

| 端點 | 方法 | 測試項目 |
|------|------|----------|
| `/api/companies/detect` | POST | 公司識別 |
| `/api/companies/match` | POST | 公司匹配 |
| `/api/companies` | POST | 創建公司 |
| `/api/companies/:id/merge` | POST | 合併公司 |

### 術語聚合 API

| 端點 | 方法 | 測試項目 |
|------|------|----------|
| `/api/v1/batches/:id/term-stats` | GET | 術語統計 |
| `/api/v1/batches/:id/term-stats` | POST | 術語分類 |
| `/api/v1/batches/:id/hierarchical-terms` | GET | 三層聚合 |

---

## 非功能性測試

### 性能測試

| 測試項目 | 目標 | 驗證方法 |
|----------|------|----------|
| 批次上傳 | 100 個文件 < 30 秒 | 計時測試 |
| 文件處理 | 平均 < 10 秒/文件 | 監控處理時間 |
| 術語聚合 | 1000 個術語 < 5 秒 | API 響應時間 |
| 報告生成 | < 30 秒 | Excel 生成時間 |

### 錯誤恢復測試

| 測試項目 | 測試方法 | 預期結果 |
|----------|----------|----------|
| 網絡中斷 | 處理中斷開連接 | 重連後繼續處理 |
| 服務重啟 | 處理中重啟服務 | 恢復到正確狀態 |
| API 錯誤 | 模擬 Azure API 錯誤 | 正確記錄錯誤，可重試 |

### 數據完整性測試

| 測試項目 | 驗證方法 |
|----------|----------|
| 文件數量一致性 | 上傳數 = 處理數 + 錯誤數 + 跳過數 |
| 公司關聯完整性 | 所有文件都有 documentIssuerId |
| 格式關聯完整性 | 所有文件都有 documentFormatId |
| 術語聚合完整性 | 術語出現次數 = 來源文件術語總和 |

---

## 測試執行記錄

### 測試環境

| 項目 | 值 |
|------|-----|
| 測試日期 | |
| 測試人員 | |
| 環境 | Development / Staging / Production |
| 版本 | |

### 測試結果摘要

| Phase | 通過 | 失敗 | 跳過 | 備註 |
|-------|------|------|------|------|
| Phase 1: 批次上傳 | /4 | | | |
| Phase 2: 智能路由 | /3 | | | |
| Phase 3: 公司識別 | /4 | | | |
| Phase 4: 進度追蹤 | /4 | | | |
| Phase 5: 術語聚合 | /4 | | | |
| Phase 6: 格式識別 | /4 | | | |
| Phase 7: E2E | /1 | | | |
| **總計** | /24 | | | |

### 問題記錄

| 編號 | 描述 | 嚴重度 | 狀態 |
|------|------|--------|------|
| | | | |

---

## 附錄

### A. 測試數據準備腳本

```bash
# 創建測試目錄結構
mkdir -p uploads/test-data/{native-pdf,scanned-pdf,images,mixed/batch-001}

# 複製測試文件（需要準備實際文件）
# cp /path/to/test-files/* uploads/test-data/
```

### B. 相關文檔

| 文檔 | 路徑 |
|------|------|
| Epic 0 Stories | `docs/03-stories/epic-0/` |
| Sprint Status | `docs/04-implementation/sprint-status.yaml` |
| API CLAUDE.md | `src/app/api/CLAUDE.md` |
| Services CLAUDE.md | `src/services/CLAUDE.md` |
| CHANGE-001 | `claudedocs/4-changes/feature-changes/CHANGE-001-native-pdf-dual-processing.md` |
| CHANGE-002 | `claudedocs/4-changes/feature-changes/CHANGE-002-hierarchical-terms-report-export.md` |

### C. 驗收清單

- [ ] 所有 Phase 測試通過
- [ ] E2E 測試成功
- [ ] 性能指標達標
- [ ] 錯誤恢復正常
- [ ] 數據完整性驗證通過
- [ ] 報告匯出功能可用（CHANGE-002 實現後）

---

**建立者**: Claude AI Assistant
**建立日期**: 2025-12-27
**文檔版本**: 1.0.0
