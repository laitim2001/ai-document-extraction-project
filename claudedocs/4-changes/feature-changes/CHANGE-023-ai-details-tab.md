# CHANGE-023: AI 詳情 Tab 實作

> **狀態**: ✅ 已完成
> **建立日期**: 2026-02-01
> **最後更新**: 2026-02-01

---

## 變更摘要

新增 "AI 詳情" Tab 顯示 Prompt、GPT 回應、Token 使用情況。

### 目標
1. ✅ 新增資料庫欄位存儲 AI 詳情（Prompt、Response、Token 使用）
2. ✅ 修改服務層收集和傳遞 AI 詳情
3. ✅ 修改 API 端點支援返回 AI 詳情
4. ✅ 新增 "AI 詳情" Tab 組件
5. ✅ 支援 `imageDetailMode` 配置參數（為未來效能優化做準備）

---

## 實作範圍

### Phase 1: 資料庫變更
- **文件**: `prisma/schema.prisma`
- **變更**: 在 `ExtractionResult` 模型新增 7 個欄位
  - `gptPrompt` - 完整的 Prompt（Text 類型）
  - `gptResponse` - GPT 原始 JSON 響應（Text 類型）
  - `promptTokens` - 輸入 Token 數
  - `completionTokens` - 輸出 Token 數
  - `totalTokens` - 總 Token 數
  - `gptModelUsed` - 使用的模型名稱
  - `imageDetailMode` - 圖片處理模式（auto/low/high）

### Phase 2: 服務層變更
1. **UnifiedGptExtractionService** (`src/services/extraction-v3/unified-gpt-extraction.service.ts`)
   - 擴展 `GptExtractionConfig` 介面支援 `imageDetailMode`
   - 擴展 `GptExtractionServiceResult` 回傳 `fullPrompt`
   - 修改圖片 URL 建構使用配置的 `imageDetailMode`

2. **ExtractionV3Service** (`src/services/extraction-v3/extraction-v3.service.ts`)
   - 在 `ProcessingContextV3` 中新增 `aiDetails` 欄位
   - 在 `executeUnifiedGptExtraction` 方法中收集 AI 詳情
   - 在返回的 `ExtractionV3Output` 中包含 `aiDetails`

3. **類型定義** (`src/types/extraction-v3.types.ts`)
   - 新增 `AiDetailsV3` 介面
   - 修改 `ProcessingContextV3` 和 `ExtractionV3Output` 包含 `aiDetails`

4. **UnifiedDocumentProcessorService** (`src/services/unified-processor/unified-document-processor.service.ts`)
   - 在 `convertV3Result` 中傳遞 `aiDetails`

5. **UnifiedProcessingResult** (`src/types/unified-processor.ts`)
   - 新增 `aiDetails` 欄位

6. **ProcessingResultPersistenceService** (`src/services/processing-result-persistence.service.ts`)
   - 在 upsert 操作中存儲 AI 詳情欄位

### Phase 3: API 變更
- **文件**: `src/app/api/documents/[id]/route.ts`
- **變更**:
  - 支援 `include=aiDetails` 參數
  - 在響應中加入 AI 詳情（prompt, response, tokenUsage, model, imageDetailMode）

### Phase 4: 前端變更
1. **Hook** (`src/hooks/use-invoice-detail.ts`)
   - 擴展 `DocumentDetail` 介面新增 `AiDetails` 類型
   - 修改 API 調用加入 `aiDetails`

2. **新組件** (`src/components/features/invoice/detail/AiDetailsTab.tsx`)
   - Token 使用統計卡片（輸入/輸出/總計/模型）
   - Prompt 展示區（可複製）
   - Response 展示區（JSON 格式化、可複製）
   - 空狀態顯示

3. **InvoiceDetailTabs** (`src/components/features/invoice/detail/InvoiceDetailTabs.tsx`)
   - 將 TabsList 從 4 列改為 5 列
   - 新增 AI 詳情 Tab

### Phase 5: 翻譯文件
- `messages/zh-TW/invoices.json`
- `messages/en/invoices.json`
- `messages/zh-CN/invoices.json`

---

## 關鍵文件清單

| 文件 | 變更類型 |
|------|---------|
| `prisma/schema.prisma` | 修改 |
| `src/services/extraction-v3/unified-gpt-extraction.service.ts` | 修改 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 修改 |
| `src/types/extraction-v3.types.ts` | 修改 |
| `src/types/unified-processor.ts` | 修改 |
| `src/services/unified-processor/unified-document-processor.service.ts` | 修改 |
| `src/services/processing-result-persistence.service.ts` | 修改 |
| `src/app/api/documents/[id]/route.ts` | 修改 |
| `src/hooks/use-invoice-detail.ts` | 修改 |
| `src/components/features/invoice/detail/AiDetailsTab.tsx` | **新增** |
| `src/components/features/invoice/detail/InvoiceDetailTabs.tsx` | 修改 |
| `messages/zh-TW/invoices.json` | 修改 |
| `messages/en/invoices.json` | 修改 |
| `messages/zh-CN/invoices.json` | 修改 |

---

## `imageDetailMode` 參數說明

| 模式 | Token 消耗 | 處理時間 | 適用場景 |
|------|-----------|---------|---------|
| `high` | 最高 (~765 tokens/tile) | 最長 | 需要高精度 OCR |
| `auto` | 中等（自動判斷） | 中等 | **目前預設** |
| `low` | 最低 (~85 tokens) | 最短 | 快速處理、文字為主 |

> **效能優化建議**: 將 `auto` 改為 `low` 可減少 20-30% 處理時間（從 45 秒降至 30-35 秒）。
> 此次實作先新增配置支援，保持預設為 `auto`，待測試後可調整。

---

## 驗證方法

### 1. 資料庫驗證
```sql
-- 確認新欄位已建立
SELECT column_name FROM information_schema.columns
WHERE table_name = 'extraction_results'
AND column_name IN ('gpt_prompt', 'gpt_response', 'prompt_tokens');
```

### 2. API 驗證
```bash
curl "http://localhost:3000/api/documents/{id}?include=aiDetails" \
  -H "Cookie: ..."
```

### 3. E2E 驗證
1. 上傳發票文件
2. 等待處理完成
3. 打開發票詳情頁
4. 點擊 "AI 詳情" Tab
5. 確認顯示：
   - Token 使用統計（輸入/輸出/總計）
   - 完整 Prompt（可複製）
   - GPT 響應（JSON 格式、可複製）

---

## 相關文檔

- [CHANGE-021 - V3 架構重構](./CHANGE-021-unified-processor-v3-pure-gpt-vision.md)
- [Epic 13 - 文件預覽與欄位映射](../../1-planning/epics/epic-13/)

---

**維護者**: Development Team
**最後更新**: 2026-02-01
