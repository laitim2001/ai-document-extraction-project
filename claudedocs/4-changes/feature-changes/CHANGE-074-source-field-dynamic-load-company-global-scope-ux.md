# CHANGE-074: 來源欄位動態載入延伸至 COMPANY/GLOBAL scope + 靜默失敗 UX 防護

> **日期**: 2026-06-02
> **狀態**: ⏳ 待實作
> **優先級**: Low-Medium
> **類型**: UX Enhancement
> **影響範圍**: Template Field Mapping 來源欄位選擇器（GLOBAL / COMPANY scope）
> **關聯**: CHANGE-038（FORMAT scope 動態來源欄位，✅ 已完成）、VERIFICATION-FX-DATA-FLOW-2026-06-02 §6 / §9-2(i)

---

## ⚠️ 範圍說明（建立前調查結論）

本變更原以為是「來源欄位字典與實際提取欄位脫節」的大缺口，但**調查後發現核心早已由 CHANGE-038 解決**，故範圍大幅縮小：

- **CHANGE-038（已完成）** 已讓 **FORMAT scope** 透過 `GET /api/v1/formats/{formatId}/extracted-fields` 載入該格式文件實際提取的動態欄位。
- **實測驗證（2026-06-02）**：對 Fairate 格式（`cmptx2z0100006gxgseuqxwy1`）呼叫該 API，**正確回傳** `handling_charge`、`terminal_charge`、`x_ray_screening_charge`、`airline_document_charge`、`container_field_station_charge`、`customs_electronic_data_charge` 共 6 個動態欄位（含 sampleValues）。
- 即：**若使用 FORMAT scope 建映射，下拉會直接列出這些動態欄位，無需任何自訂輸入**。

本變更只處理 CHANGE-038 **明確排除的 COMPANY / GLOBAL scope**（CHANGE-038 §Scope 策略：COMPANY/GLOBAL 僅「標準 + 自訂」，無動態）。

---

## 變更背景

Data Template 端到端實測（2026-06-02，採 **GLOBAL scope** 建映射）暴露 COMPANY/GLOBAL scope 的兩個 UX 問題：

1. **無動態欄位**：GLOBAL/COMPANY scope 的來源欄位下拉只有 ~90 個標準字典欄位（`@/constants/standard-fields`）+ `_ref_*` / `li_*` pseudo 欄位 + 自訂。文件實際提取的動態欄位（如 `handling_charge`）**不在其中**，使用者必須**自行知道**要用「自訂欄位」輸入精確欄位名。

2. **靜默失敗風險**：標準字典裡常有「語意相近但名稱不同」的欄位（如字典的 `handling_fee` vs 文件實際的 `handling_charge`）。使用者若誤選字典欄位，匹配時 `extractMappedFields` 在文件 `fieldMappings` 找不到該 key → 該目標欄位**靜默留空、無任何報錯或警示**（呼應 VERIFICATION §9-2(i)「投影全空警示」缺口）。

> 註：本次實測正因採 GLOBAL scope 才需自訂輸入 6 個欄位名；改用 FORMAT scope 則無此問題。

---

## 變更內容

### 變更項目 1：COMPANY scope 載入動態欄位（延伸 CHANGE-038）

讓 COMPANY scope 也能載入動態欄位——取該公司**所有格式**的 extracted-fields 聯集（去重）。需後端提供 company 維度的彙整（可新增 `GET /api/v1/companies/{companyId}/extracted-fields` 或於現有 extracted-fields API 加 companyId 模式）。

> GLOBAL scope 是否載入動態欄位待議：GLOBAL 跨所有公司/格式，欄位聯集可能過大且失去意義，傾向**不載入**，改以項目 2 的提示處理。

### 變更項目 2：GLOBAL/COMPANY scope UX 提示

在 GLOBAL（及未實作項目 1 前的 COMPANY）scope 的來源欄位選擇器加明確說明：

> 「動態提取欄位僅在 FORMAT scope 顯示。此 scope 請改用 FORMAT scope，或以『自訂欄位』輸入文件實際的提取欄位名。」

### 變更項目 3：靜默失敗防護（呼應 VERIFICATION §9-2(i)）

當使用者選取**非自訂**的標準欄位，而該欄位名不在「當前情境已知提取欄位集」中時，於該規則列顯示黃色警示「此來源欄位可能與文件實際欄位不符，匹配後該欄位可能為空」。降低投影靜默留空的機率。

---

## 技術設計

### 修改範圍

| 檔案 | 變更內容 |
|------|----------|
| `src/components/features/formats/SourceFieldCombobox.tsx` | 支援 COMPANY scope 動態欄位來源（companyId 模式）；GLOBAL/COMPANY 加提示文案 |
| `src/components/features/template-field-mapping/MappingRuleItem.tsx` | 透傳 companyId / scope；接收「已知提取欄位集」以做項目 3 警示 |
| `src/components/features/template-field-mapping/MappingRuleEditor.tsx` | 透傳 companyId + scope |
| `src/components/features/template-field-mapping/TemplateFieldMappingForm.tsx` | 傳遞 companyId 到 Editor |
| `src/app/api/v1/companies/[id]/extracted-fields/route.ts`（如採項目 1） | 🆕 company 維度 extracted-fields 彙整端點 |
| `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | 提示與警示文案三語同步 |

### i18n 影響

| 語言 | 檔案 | Key |
|------|------|-----|
| en / zh-TW / zh-CN | `messages/{locale}/templateFieldMapping.json` | 來源欄位 scope 提示、欄位不符警示 |

---

## 設計決策

1. **不改 FORMAT scope** — CHANGE-038 已完整解決，不動。
2. **GLOBAL scope 不載入動態欄位聯集** — 跨全租戶聯集無意義，改以提示處理。
3. **保留標準字典為 GLOBAL/COMPANY 預設** — 標準字典對通用映射仍合理，只補提示與警示，不移除。

---

## 影響範圍評估

### 向後兼容性
- 純加提示 + 可選 COMPANY 動態載入，不改既有映射資料與 FORMAT scope 行為。

### H1 註記
- 不改三層映射核心、信心度路由、Prisma 結構（除非項目 1 新增唯讀 API；無 schema 變更）。屬 UI/UX 增強，不觸發 H1。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | COMPANY scope 動態欄位 | COMPANY scope 來源欄位下拉可見該公司各格式的提取欄位聯集 | Medium |
| 2 | scope 提示 | GLOBAL/COMPANY scope 顯示「動態欄位僅 FORMAT scope」提示 | High |
| 3 | 靜默失敗警示 | 選了不在已知提取欄位集的標準欄位時，顯示黃色警示 | Medium |
| 4 | 品質閘 | type-check / lint / i18n:check 通過 | High |

---

## 測試場景

| # | 場景 | 步驟 | 預期 |
|---|------|------|------|
| 1 | FORMAT scope（對照組，CHANGE-038） | 以 Fairate 格式建 FORMAT scope 映射 | 下拉直接列出 6 個費用動態欄位（無需自訂） |
| 2 | COMPANY scope 動態 | 以 Fairate 公司建 COMPANY scope 映射 | 下拉可見該公司各格式提取欄位聯集 |
| 3 | GLOBAL scope 提示 | 建 GLOBAL scope 映射 | 顯示 scope 提示；選對不上的標準欄位有警示 |

---

*文件建立日期: 2026-06-02*
*最後更新: 2026-06-02*
