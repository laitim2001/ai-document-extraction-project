# CHANGE-016: 端到端管線整合 Phase 4 — 測試驗證

> **建立日期**: 2026-01-27
> **狀態**: ⚠️ 部分完成（測試腳本已建立 commit: `cbb48b6`，驗收項待完成）
> **優先級**: High
> **類型**: Testing
> **影響範圍**: 驗證 Phase 1-3 建立的完整管線
> **前置條件**: CHANGE-015 Phase 3 已完成
> **總體計劃**: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`

---

## 1. 測試概述

Phase 4 驗證 Phase 1-3 建立的完整端到端管線是否正確運作：

```
上傳文件 → Azure Blob → 統一處理器 → ExtractionResult → autoMatch → TemplateInstance
```

### 測試方式

| # | 測試方式 | 工具 | 驗證重點 |
|---|----------|------|----------|
| 1 | API 整合測試腳本 | `npx tsx` + Prisma | 後端管線完整性、DB 數據正確性 |
| 2 | Playwright E2E 測試 | Playwright MCP | UI 操作流程、使用者體驗 |

---

## 2. 測試案例

### 2.1 API 整合測試（腳本驗證）

**腳本**: `scripts/test-e2e-pipeline.ts`

| # | 測試案例 | 驗證項目 |
|---|----------|----------|
| T1 | 前置條件檢查 | Seed 數據存在（DataTemplate、TemplateFieldMapping、Company.defaultTemplateId） |
| T2 | 文件建立 + Blob 上傳 | Document 建立、blobName 正確、status = UPLOADED |
| T3 | 統一處理管線觸發 | processFile 完成、result.success = true |
| T4 | 結果持久化驗證 | ExtractionResult 存在、fieldMappings 非空、Document.status = MAPPING_COMPLETED |
| T5 | autoMatch 驗證 | Document.templateInstanceId 已設置、TemplateInstance 存在 |
| T6 | 清理測試數據 | 刪除測試 Document、ExtractionResult、TemplateInstance |

### 2.2 Playwright E2E 測試

| # | 測試步驟 | 預期結果 |
|---|----------|----------|
| E1 | 導航到文件上傳頁面 | 頁面正確顯示 |
| E2 | 上傳 DHL 測試發票 | 檔案上傳成功、文件出現在列表 |
| E3 | 檢查文件狀態變化 | UPLOADED → OCR_PROCESSING → MAPPING_COMPLETED |
| E4 | 導航到模版匹配頁面 | TemplateInstance 存在、行數據正確 |

---

## 3. 測試數據

### 測試文件

- **DHL 發票**: `docs/Doc Sample/DHL_HEX240522_41293.pdf`
- **公司**: DHL（已有 seed 數據，含 defaultTemplateId）
- **城市**: HEX（Hong Kong）

### 前置條件

- [x] Docker 服務運行（PostgreSQL, Azurite）
- [x] `ENABLE_UNIFIED_PROCESSOR=true` 已設置
- [x] Seed 數據已執行（Phase 1）
- [ ] Azure DI / OpenAI API 配置正確

---

## 4. 驗收標準

- [ ] API 整合測試腳本：所有 T1-T5 測試通過
- [ ] Playwright E2E：上傳 → 處理 → 匹配 完整流程可在 UI 驗證
- [ ] 無 TypeScript / ESLint 錯誤

---

## 5. 文件清單

| 操作 | 文件路徑 | 說明 |
|------|----------|------|
| **新增** | `scripts/test-e2e-pipeline.ts` | API 整合測試腳本 |
| **新增** | 本文件 | Phase 4 測試規劃 |
