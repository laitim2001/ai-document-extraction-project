# CHANGE-013: 端到端管線整合 Phase 1 — 基礎設施準備

> **建立日期**: 2026-01-27
> **狀態**: 📋 規劃中
> **優先級**: High
> **類型**: Infrastructure / Integration
> **影響範圍**: Epic 15 (統一處理) + Epic 19 (模版匹配)
> **總體計劃**: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`

---

## 1. 變更概述

為打通「文件上傳 → 統一 11 步處理 → 模版匹配」的端到端資料流，
Phase 1 負責基礎設施層面的準備工作，確保後續 Phase 2（核心整合）能順利進行。

### Phase 1 包含 4 項工作

| # | 工作項 | 類型 | 風險 |
|---|--------|------|------|
| 1 | Feature Flag 環境變數化 | Config | 極低 |
| 2 | Template Matching 驗證 Bug 修復 | Bug Fix | 低 |
| 3 | TemplateFieldMapping Seed 數據 | Data | 低 |
| 4 | Company.defaultTemplateId Seed 設置 | Data | 低 |

---

## 2. 詳細變更

### 2.1 Feature Flag 環境變數化

**目的**: 允許在不改代碼的情況下啟用/停用統一處理器

**修改文件**: `src/constants/processing-steps.ts`

```typescript
// 修改前 (line 153)
enableUnifiedProcessor: false,

// 修改後
enableUnifiedProcessor: process.env.ENABLE_UNIFIED_PROCESSOR === 'true',
```

**修改文件**: `.env` / `.env.example`

```bash
# 新增
ENABLE_UNIFIED_PROCESSOR=true
```

**影響**:
- 僅改變預設值的讀取來源
- 環境變數未設置時仍為 `false`（向後相容）

---

### 2.2 Template Matching 驗證 Bug 修復

**目的**: 修復 `templateInstanceId`、`dataTemplateId`、`formatId` 的 Zod 驗證格式不匹配

**詳細記錄**: `claudedocs/4-changes/bug-fixes/FIX-033-template-matching-cuid-validation.md`

**修改文件**: `src/validations/template-matching.ts`

| Schema | 欄位 | 修改 |
|--------|------|------|
| `executeMatchRequestSchema` | `templateInstanceId` | `.uuid()` → `.cuid()` |
| `previewMatchRequestSchema` | `dataTemplateId` | `.uuid()` → `.cuid()` |
| `previewMatchRequestSchema` | `formatId` | `.uuid()` → `.cuid()` |
| `validateMappingRequestSchema` | `dataTemplateId` | `.uuid()` → `.cuid()` |
| `validateMappingRequestSchema` | `formatId` | `.uuid()` → `.cuid()` |

**保持不變的欄位**（已正確）:
- `documentIds: z.string().uuid()` — Document 用 UUID
- `companyId: z.string().uuid()` — Company 用 UUID
- Story 19.7 的 `batchMatch` / `singleMatch` — 已正確用 `.cuid()`

---

### 2.3 TemplateFieldMapping Seed 數據

**目的**: 為 `erp-standard-import` 模版建立 GLOBAL 級別的欄位映射規則，使 template matching engine 能實際轉換數據

**修改文件**: `prisma/seed.ts`

**新增數據**:

```
TemplateFieldMapping（GLOBAL scope，關聯 erp-standard-import 模版）:

mappings: [
  invoice_number   → invoice_number    (DIRECT)
  invoice_date     → invoice_date      (DIRECT)
  vendor_name      → vendor_name       (DIRECT)
  total_amount     → total_amount      (DIRECT)
  currency         → currency          (DIRECT)
  shipment_no      → shipment_number   (DIRECT)
  sea_freight      → shipping_cost     (DIRECT)
  origin_port      → origin            (DIRECT)
  destination_port → destination       (DIRECT)
  etd              → etd               (DIRECT)
  eta              → eta               (DIRECT)
  weight           → weight_kg         (DIRECT)
]
```

**說明**:
- 使用 DIRECT 轉換（1:1 映射）作為基礎配置
- sourceField 名稱對應 ExtractionResult.fieldMappings 中的標準欄位名
- targetField 名稱對應 DataTemplate.fields 中定義的欄位名

---

### 2.4 Company.defaultTemplateId Seed 設置

**目的**: 為至少一間公司設置預設模版，使 `autoMatch()` 能找到目標模版

**修改文件**: `prisma/seed.ts`

**新增/修改數據**:

```
更新 Company (例如 DHL Express):
  defaultTemplateId → erp-standard-import 模版的 ID
```

**說明**:
- `autoMatch()` 的 `resolveDefaultTemplate()` 方法按 FORMAT > COMPANY > GLOBAL 順序查找
- 設置 Company.defaultTemplateId 讓 COMPANY 級別解析能成功
- 可選：同時設置全域預設 `SystemConfig['global_default_template_id']`

---

## 3. 影響範圍

### 直接影響

| 區域 | 影響 | 風險 |
|------|------|------|
| Feature Flag | 統一處理器可通過環境變數啟用 | 極低（預設仍為 false） |
| Validation | Template Matching API 接受正確的 CUID ID | 低（修復 bug） |
| Seed Data | 資料庫有測試用的映射規則和預設模版 | 低（只影響 seed） |

### 不影響

- 統一處理器代碼本身（不修改）
- Template Matching Engine（不修改）
- 前端 UI 組件（不修改）
- 現有的上傳/OCR 流程（不修改）

---

## 4. 驗收標準

- [ ] `ENABLE_UNIFIED_PROCESSOR=true` 環境變數生效
- [ ] `POST /api/v1/template-matching/execute` 接受 CUID 格式的 `templateInstanceId`
- [ ] `POST /api/v1/template-matching/preview` 接受 CUID 格式的 `dataTemplateId`
- [ ] `npx prisma db seed` 成功建立 TemplateFieldMapping 記錄
- [ ] seed 後至少一間 Company 有 `defaultTemplateId`
- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過

---

## 5. 後續 Phase

Phase 1 完成後，後續工作：

| Phase | 內容 | 依賴 |
|-------|------|------|
| Phase 2 | 新建 `/api/documents/[id]/process` 端點 + 結果持久化服務 | Phase 1 |
| Phase 3 | 處理完成後觸發 autoMatch + 上傳自動處理 | Phase 2 |
| Phase 4 | 端到端測試驗證 | Phase 3 |

詳見: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`
