# FIX-093: Stage 3 GPT 回 invoiceData 包裹格式致提取整份丟失

> **建立日期**: 2026-06-27
> **發現方式**: 用戶測試（Template Instance `cmqw3zf4k` 的 HEX250526 列只有 shipment_number、費用全缺）+ DB/代碼追蹤
> **影響頁面/功能**: V3.1 Stage 3 欄位提取（`parseExtractionResult`）→ Template Instance 費用映射
> **優先級**: 高
> **狀態**: ✅ 已修復（2026-06-27）— `parseExtractionResult` 新增 `invoiceData` 包裹格式攤平（`unwrapInvoiceDataFormat`）；`type-check` 通過、改動檔 lint 0 error；HEX250526 重處理後 lineItems 由 **0 救回到 4**。**註**：費用要進 `fields` 供 template 匹配，尚需補對應 field def 的 `aliases`（資料維護，見 §配套）

---

## 問題描述

Template Instance（`cmqw3zf4k00000gxgico9a5a1`）中，`CEVA_HEX250526,0527_51717.pdf` 這一列**只有 `shipment_number`、所有費用欄位（thc/seal_fee/document_fee/vgm）皆空**，而同 instance 其他 5 份文件費用都完整。

直接觀察：該文件今日重處理後的 extraction（`dfcdeada`）`stage_3_result` 的 **`fields` 是空物件（0 keys）、`lineItems` 是空陣列（0）**，但 `success: true`。對比昨日同文件 4 次提取皆為 15 fields / 4 lineItems。

---

## 重現步驟

1. 對 `CEVA_HEX250526,0527_51717.pdf`（雙發票合併 PDF）觸發重新處理（`POST /api/documents/[id]/process`）
2. 查 `extraction_results.stage_3_result`：`fields` 與 `lineItems` 皆空
3. 該文件加入 Template Instance 執行匹配 → 費用欄位全空（只有 ref match 來的 shipment_number）

---

## 根本原因

`parseExtractionResult`（`stage-3-extraction.service.ts`）只解析三種格式：
- **Case 1**：頂層有 `fields` key
- **Case 2**：頂層有 `standardFields` key
- **Case 3**：原始 key-value → `convertRawResponseDynamic`（用 fieldDefinitions + aliases 在**頂層**找值，巢狀只看 `invoice_metadata/seller/totals/header`）

GPT 對這份雙發票 PDF **穩定回傳另一種結構**（連續兩次重處理皆同）：

```json
{ "success": true, "confidence": 94,
  "invoiceData": {
    "invoiceNumber": "253250051717", "currency": "HKD", "totalAmount": 6847,
    "lineItems": [
      { "description": "Terminal Handling Charge at Origin", "amount": 5990 },
      { "description": "Seal Fee at Origin", "amount": 156 },
      { "description": "VGM Certificate Fee", "amount": 78 },
      { "description": "Documentation at Origin", "amount": 623 } ] } }
```

此 `invoiceData` 包裹格式**不符合任何一個 case**：
- 沒有頂層 `fields`（Case 1 落空）、沒有 `standardFields`（Case 2 落空）
- Case 3 `findValueInRaw` 的巢狀搜尋不含 `invoiceData`，且 `convertRawLineItems` 只讀**頂層** `lineItems`（資料在 `invoiceData.lineItems`）

→ `fields` 與 `lineItems` **雙雙解析成空、整份提取丟失**。這是 **GPT 輸出格式的非確定性**（HEX250540 等回標準格式正常；HEX250526 雙發票 PDF 傾向回 `invoiceData` 格式）。

> **與 CHANGE-094 的關係**：CHANGE-094 處理「有 lineItems 時費用沒進 fields」；本案**連 lineItems 都解析失敗**，是 CHANGE-094 觸及不到的上游環節。

---

## 解決方案

`parseExtractionResult` 在 `JSON.parse` 後、三個 case 前，偵測並攤平 `invoiceData` 包裹格式（新增 `unwrapInvoiceDataFormat`）：

1. 偵測條件：`parsed.invoiceData` 為物件，且**無** `fields`/`standardFields`（不影響標準格式）
2. 把 `invoiceData` 內欄位提升到頂層，並補 snake_case 別名（`invoiceNumber`→`invoice_number`、`totalAmount`→`total_amount`、`vendor.name`→`vendor_name` 等），讓 `convertRawResponseDynamic` 的 aliases 搜尋撈得到標準欄位
3. 保留 `lineItems`；當 lineItem 缺 `category` 時以 `description` 補上，使後續 `classifiedAs` 正規化與 CHANGE-094 費用回填有對照依據
4. 攤平後交由 Case 3 動態映射處理

### 配套（讓費用進 fields → template 可匹配）

FIX-093 讓 lineItems 不再丟失（救回 4 筆），但 `invoiceData.lineItems` **無 category**，補出的 `classifiedAs`（= `normalize(description)`，如 `Documentation At Origin`）與 CEVA field def 的 `label`（`Origin Document Processing Fee`）措辭差異大，CHANGE-094 回填對照不到 → `fields` 費用仍空。**需在 CEVA「自訂費用欄位集」（`f13aaf3b`）補對應 `aliases`**（資料維護，非本 code FIX）：

| field key | 建議補的 aliases |
|---|---|
| `origin_thc_terminal_handling_charge` | `Terminal Handling Charge at Origin`、`Terminal Handling Charge` |
| `sealing_charge` | `Seal Fee at Origin`、`Seal Fee` |
| `solas_vgm_management_fee` | `VGM Certificate Fee`、`Vgm Certificate Fee` |
| `origin_document_processing_fee` | `Documentation at Origin`、`Documentation Fee` |

> ⚠️ 只補 origin 系列、勿對 destination 補重疊裸 alias（避免 origin/destination 歧義跳過）。補後重新處理，CHANGE-094 回填即以 exact 命中、費用進 `fields`。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | `parseExtractionResult` 加 `invoiceData` 偵測；新增 `unwrapInvoiceDataFormat`（攤平 + lineItem category fallback） |

---

## 測試驗證

- [x] `npm run type-check` 通過（無錯誤）
- [x] `npm run lint` 改動檔 0 error（既有 console/unused 警告非本次引入）
- [x] HEX250526（`a11cbbfa`）重處理後 `lineItems` 由 **0 → 4**（Terminal Handling / Seal Fee / VGM / Documentation 皆救回），`success` 不再對應空結果
- [ ] 補 CEVA aliases 後重新處理，`fields` 出現對應費用 key、Template Instance 該列費用有值（待補 aliases 後驗證）
- [x] 不影響標準格式文件（偵測條件要求無 `fields`/`standardFields`，HEX250540 等照走原路徑）

---

## 關聯背景

本 FIX 是 CEVA Template Instance 測試串的延伸：前序已處理公司重複合併、Field Definition 生效、FIX-092（referenceNumberMatch 持久化）、CHANGE-094（費用確定性回填）。本案處理 **GPT 輸出格式漂移導致整份提取丟失** 的解析容錯。

---

*文件建立日期: 2026-06-27*
*最後更新: 2026-06-27*
