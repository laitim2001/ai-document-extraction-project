# CHANGE-006: GPT Vision 動態配置提取與 Term 記錄

> **狀態**: 📋 規劃中
> **類型**: Feature Enhancement
> **影響範圍**: Epic 14/15 - PromptConfig 系統與統一處理管道
> **建立日期**: 2026-01-06
> **優先級**: High

---

## 變更摘要

完成 Step 7 (GPT Enhanced Extraction) 的實現，讓其能夠：
1. 讀取 Step 5 獲取的 PromptConfig 配置
2. 根據配置使用自定義 Prompt 調用 GPT Vision
3. 從 rawText 中提取額外欄位（如 DHL 的 Extra Charges）
4. 將額外提取的欄位記錄到 Term 系統

---

## 變更原因

### 現況問題

1. **Step 7 是空殼**
   - `performClassification()` 和 `performFullExtraction()` 都是 TODO
   - 返回空對象，沒有實際調用 GPT

2. **配置已獲取但未使用**
   - Step 5 (ConfigFetching) 已能獲取 `context.resolvedPrompt`
   - 但 Step 7 沒有讀取這個配置

3. **額外欄位無法進入 Term 系統**
   - Step 9 只讀取 `lineItems`
   - GPT 額外提取的欄位（如 extraCharges）無法記錄為 Terms

### 用戶需求

> "不同的文件格式都會有不同的數據提取策略，以 DHL 文件為例，第1頁的 Type of Service 和 Analysis of Extra Charges 等資料都是要提取的，但只有這個公司的這個文件格式才需要這樣做。"

- PromptConfig 是通用功能，用戶可在 UI 上為每間公司設定
- GPT 提取的額外欄位需要記錄為 Terms

---

## 技術設計

### 數據流

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 5: CONFIG_FETCHING                                                  │
│   → 根據 companyId + documentFormatId 查詢 PromptConfig                 │
│   → 三層解析 (GLOBAL → COMPANY → FORMAT)                                │
│   → 設置 context.resolvedPrompt                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Step 6: AZURE_DI_EXTRACTION                                              │
│   → 提取標準欄位 + rawText                                              │
│   → 設置 context.extractedData.rawText                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Step 7: GPT_ENHANCED_EXTRACTION (本次修改)                               │
│   → 讀取 context.resolvedPrompt                                         │
│   → 讀取 context.extractedData.rawText                                  │
│   → 調用 gpt-vision.service 並傳入自定義 prompt                         │
│   → 設置 context.extractedData.gptExtraction = {                        │
│       extraCharges: [...],                                              │
│       typeOfService: "...",                                             │
│     }                                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Step 9: TERM_RECORDING (本次修改)                                        │
│   → 讀取 context.extractedData.lineItems (現有)                         │
│   → 讀取 context.extractedData.gptExtraction.extraCharges (新增)        │
│   → 將 extraCharges 的 description 記錄為 Term                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 7 修改詳情

**文件**: `src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts`

**performClassification() 實現**:
```typescript
private async performClassification(context: UnifiedProcessingContext) {
  const { input, resolvedPrompt } = context;

  // 準備圖片路徑
  const imagePath = await this.prepareImageFromBuffer(input.fileBuffer, input.fileName);

  // 構建自定義 prompt（如果有配置）
  const customPrompt = resolvedPrompt?.userPromptTemplate;

  // 調用 GPT Vision 分類
  const result = await classifyDocument(imagePath, config, {
    customPrompt,
    companyId: context.companyId,
    documentFormatId: context.documentFormatId,
  });

  return {
    extractedFields: {
      documentIssuer: result.documentIssuer,
      documentFormat: result.documentFormat,
      // 如果有額外欄位
      ...(result.extraFields || {}),
    },
    confidence: result.confidence,
    mode: 'classification' as const,
  };
}
```

**performFullExtraction() 實現**:
```typescript
private async performFullExtraction(context: UnifiedProcessingContext) {
  const { input, resolvedPrompt, extractedData } = context;

  // 準備圖片路徑
  const imagePath = await this.prepareImageFromBuffer(input.fileBuffer, input.fileName);

  // 構建自定義 prompt
  const basePrompt = resolvedPrompt?.userPromptTemplate || DEFAULT_EXTRACTION_PROMPT;

  // 如果有 rawText，可以附加到 prompt 中
  const promptWithContext = extractedData?.rawText
    ? `${basePrompt}\n\n以下是文件的原始文字：\n${extractedData.rawText}`
    : basePrompt;

  // 調用 GPT Vision 完整提取
  const result = await processImageWithVision(imagePath, config, {
    customPrompt: promptWithContext,
    companyId: context.companyId,
    documentFormatId: context.documentFormatId,
  });

  return {
    extractedFields: {
      ...result.invoiceData,
      extraCharges: result.extraCharges || [],
      typeOfService: result.typeOfService,
    },
    confidence: result.confidence,
    mode: 'full_extraction' as const,
  };
}
```

### Step 9 修改詳情

**文件**: `src/services/unified-processor/steps/term-recording.step.ts`

**新增邏輯**:
```typescript
protected async doExecute(context, flags) {
  // 現有：從 lineItems 提取
  const lineItemTerms = this.extractTermsFromLineItems(
    context.extractedData?.lineItems || []
  );

  // 新增：從 gptExtraction 提取
  const gptExtractionTerms = this.extractTermsFromGptExtraction(
    context.extractedData?.gptExtraction
  );

  // 合併所有 terms
  const allTerms = [...lineItemTerms, ...gptExtractionTerms];

  // 記錄到資料庫
  await this.recordTerms(allTerms, context);
}

/**
 * 從 GPT 額外提取的數據中提取 terms
 */
private extractTermsFromGptExtraction(
  gptExtraction?: Record<string, unknown>
): TermData[] {
  if (!gptExtraction) return [];

  const terms: TermData[] = [];

  // 處理 extraCharges
  const extraCharges = gptExtraction.extraCharges as Array<{
    description: string;
    amount?: number;
  }> | undefined;

  if (extraCharges && Array.isArray(extraCharges)) {
    for (const charge of extraCharges) {
      if (charge.description) {
        terms.push({
          rawTerm: charge.description,
          source: 'GPT_EXTRACTION',  // 標記來源
          amount: charge.amount,
        });
      }
    }
  }

  return terms;
}
```

---

## 影響的文件

### 必須修改

| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts` | 重構 | 實現 performClassification + performFullExtraction |
| `src/services/unified-processor/steps/term-recording.step.ts` | 修改 | 新增讀取 gptExtraction 邏輯 |

### 可能修改

| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `src/services/gpt-vision.service.ts` | 檢查/修改 | 確認支持 customPrompt 參數 |
| `src/types/unified-processor.ts` | 可能修改 | 確保 gptExtraction 類型定義完整 |

### 不需修改

| 文件 | 原因 |
|------|------|
| `config-fetching.step.ts` | 已完整實現 |
| `prompt-resolver.service.ts` | 已完整實現 |
| `/admin/prompt-configs/` (UI) | 已完整實現 |
| `/api/v1/prompt-configs/` (API) | 已完整實現 |

---

## 實作計劃

### Phase 1: Step 7 GPT 集成 (預估 2-3 小時)

**步驟 1.1**: 確認 GPT Vision 服務支持
- 檢查 `processImageWithVision()` 參數
- 檢查 `classifyDocument()` 參數
- 如需要，添加 customPrompt 參數支持

**步驟 1.2**: 實現 performClassification()
- 讀取 context.resolvedPrompt
- 調用 gpt-vision.service.classifyDocument()
- 返回分類結果

**步驟 1.3**: 實現 performFullExtraction()
- 讀取 context.resolvedPrompt 和 context.extractedData.rawText
- 調用 gpt-vision.service.processImageWithVision()
- 返回完整提取結果（含額外欄位）

### Phase 2: Step 9 Term 記錄 (預估 1-2 小時)

**步驟 2.1**: 新增 extractTermsFromGptExtraction()
- 處理 gptExtraction.extraCharges
- 標記 Term 來源為 GPT_EXTRACTION

**步驟 2.2**: 修改 doExecute() 合併所有 terms
- 合併 lineItemTerms + gptExtractionTerms
- 處理去重邏輯（如需要）

### Phase 3: 配置與測試 (預估 1-2 小時)

**步驟 3.1**: 啟用 enableDynamicConfig Flag
- 找到調用 UnifiedProcessor 的地方
- 設置 flags.enableDynamicConfig = true

**步驟 3.2**: 通過 UI 創建測試 PromptConfig
- 訪問 /admin/prompt-configs/new
- 創建 DHL 專屬的 FIELD_EXTRACTION 配置

**步驟 3.3**: E2E 測試
- 處理 DHL 發票
- 驗證 extraCharges 被提取
- 驗證 Terms 被記錄

---

## 驗收標準

### 功能驗收

- [ ] Step 7 能讀取 context.resolvedPrompt
- [ ] Step 7 能調用 GPT Vision 並傳入自定義 prompt
- [ ] GPT 返回的額外欄位存入 context.extractedData.gptExtraction
- [ ] Step 9 能讀取 gptExtraction 中的額外欄位
- [ ] 額外欄位的 description 被記錄為 Terms
- [ ] Terms 正確出現在 Hierarchical Terms 報告中

### 效能驗收

- [ ] GPT 調用成本在預期範圍內 (~$0.01/頁)
- [ ] 處理時間無顯著增加

### UI 驗收

- [ ] 用戶可通過 /admin/prompt-configs/ 創建配置
- [ ] 配置支持 FORMAT 級別範圍
- [ ] 配置支持 APPEND 合併策略

---

## 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| GPT 服務不支持 customPrompt 參數 | 中 | 需要檢查並可能修改服務 |
| 圖片轉換失敗（PDF to Image） | 低 | 使用現有的 pdf-poppler 服務 |
| GPT 返回格式不穩定 | 中 | 在 prompt 中明確指定 JSON 格式 |
| Term 去重問題 | 低 | 使用現有的去重邏輯 |

---

## 相關文檔

| 文檔 | 說明 |
|------|------|
| `claudedocs/4-changes/feature-changes/CHANGE-005-unified-pipeline-step-reordering.md` | 步驟重排序變更 |
| `docs/03-stories/tech-specs/epic-14/` | Epic 14 PromptConfig 技術規格 |
| `docs/03-stories/tech-specs/epic-15/` | Epic 15 統一處理管道技術規格 |

---

## 審核記錄

| 日期 | 審核者 | 決定 | 備註 |
|------|--------|------|------|
| 2026-01-06 | User | ✅ 已批准 | 用戶確認計劃可行 |
