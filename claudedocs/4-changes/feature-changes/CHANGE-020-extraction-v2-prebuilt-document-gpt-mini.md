# CHANGE-020: 新提取架構測試 - Azure DI prebuilt-document + GPT-5-mini

> **建立日期**: 2026-01-29
> **完成日期**: -
> **狀態**: 📋 待審核
> **優先級**: High
> **類型**: Architecture Enhancement (Extraction Pipeline)
> **影響範圍**: Epic 15 (統一處理管線) + Epic 14 (Prompt 配置)
> **前置條件**: 無（獨立測試環境，不影響現有功能）

---

## 1. 變更概述

### 問題背景

當前提取架構使用 Azure DI `prebuilt-invoice` 模型，存在以下限制：

| 問題 | 說明 |
|------|------|
| **欄位固定** | prebuilt-invoice 只提供 ~30 個預定義欄位，無法自定義 |
| **術語映射複雜** | 需要 Field Mapping Config 處理術語差異，維護成本高 |
| **覆蓋不全** | 部分發票資訊（如特殊費用項目）無法被預定義欄位提取 |
| **GPT 使用率高** | 經常需要調用 GPT-5.2 補強，成本較高 |

### 當前架構

```
┌─────────────────────────────────────────────────────────────────┐
│ 當前架構 (prebuilt-invoice + GPT-5.2 補強)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 6: Azure DI (prebuilt-invoice)                            │
│  ─────────────────────────────────────                          │
│  • 提取預定義欄位（invoiceNumber, vendorName 等）                │
│  • 欄位固定，無法自定義                                          │
│                                                                  │
│                           ↓                                      │
│                                                                  │
│  Step 7: GPT-5.2 Enhanced Extraction (按需)                     │
│  ─────────────────────────────────────────                      │
│  • 信心度 < 70% 時觸發                                           │
│  • 使用視覺模式處理原始圖片                                      │
│  • 成本較高（$0.03-0.05/張）                                     │
│                                                                  │
│                           ↓                                      │
│                                                                  │
│  Step 8: Field Mapping                                          │
│  ─────────────────────────────────────────                      │
│  • 術語映射（Azure DI 欄位名 → 標準欄位名）                      │
│  • 三層映射：Universal → Company → Format                        │
│  • 維護成本高                                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 期望架構

```
┌─────────────────────────────────────────────────────────────────┐
│ 新架構 (prebuilt-document + GPT-5-mini)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Azure DI (prebuilt-document)                           │
│  ─────────────────────────────────────                          │
│  • 提取結構化數據：keyValuePairs + tables + content              │
│  • 保留 label-value 關係                                         │
│  • 不做欄位映射，只做 OCR + 結構化                               │
│                                                                  │
│                           ↓                                      │
│                                                                  │
│  Step 2: 數據精選                                                │
│  ─────────────────────────────────────────                      │
│  • 只傳 keyValuePairs + tables 給 GPT                           │
│  • 過濾不必要的元數據（pages, styles 等）                        │
│  • 控制 token 數量（目標：500-1,500 tokens）                     │
│                                                                  │
│                           ↓                                      │
│                                                                  │
│  Step 3: GPT-5-mini + Prompt Config                             │
│  ─────────────────────────────────────────                      │
│  • 根據 Prompt Config 定義的欄位清單提取                         │
│  • 直接輸出標準化欄位名 + 值                                     │
│  • 成本低（~$0.001/張）                                          │
│                                                                  │
│                           ↓                                      │
│                                                                  │
│  Step 4: (可選) GPT-5.2 補強                                     │
│  ─────────────────────────────────────────                      │
│  • 觸發條件：信心度 < 70% 或關鍵欄位缺失                         │
│  • 使用視覺模式處理原始圖片                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 關鍵改變

| 改變點 | 之前 | 之後 |
|--------|------|------|
| Azure DI 模型 | `prebuilt-invoice` | `prebuilt-document` |
| Azure DI 角色 | OCR + 欄位提取 | **只做 OCR + 結構化** |
| 欄位定義 | Azure DI 預定義 | **Prompt Config 自定義** |
| 常規提取模型 | GPT-5.2（按需） | **GPT-5-mini（每次）** |
| Field Mapping | 必須 | **可選（或退役）** |

---

## 2. 預期效益

### 成本對比（每張發票）

| 項目 | 當前架構 | 新架構 | 節省 |
|------|---------|--------|------|
| Azure DI | $0.01 (prebuilt-invoice) | $0.01 (prebuilt-document) | - |
| GPT 常規 | $0 ~ $0.05 (按需 GPT-5.2) | $0.001 (GPT-5-mini) | ~97% |
| **每張總成本** | **$0.01 ~ $0.06** | **~$0.02** | **50-70%** |
| **年處理 500K 張** | **$5,000 ~ $30,000** | **~$10,000** | **$5,000-20,000** |

### 功能對比

| 功能 | 當前架構 | 新架構 |
|------|---------|--------|
| 自定義欄位 | ❌ 固定 | ✅ Prompt Config 定義 |
| 特定提取指示 | ⚠️ 有限 | ✅ 完全自定義 |
| 術語統一 | Field Mapping Config | Prompt 內置 |
| label-value 關係 | ⚠️ 部分丟失 | ✅ keyValuePairs 保留 |
| 表格處理 | ✅ 支援 | ✅ 支援 |

---

## 3. 技術設計

### 3.1 新增服務

#### 3.1.1 Azure DI Document Service

**檔案**: `src/services/extraction-v2/azure-di-document.service.ts`

```typescript
/**
 * Azure DI prebuilt-document 服務
 *
 * @description
 *   使用 prebuilt-document 模型提取結構化數據：
 *   - keyValuePairs: 識別的鍵值對（保留 label-value 關係）
 *   - tables: 結構化表格
 *   - content: 全文文字（備用）
 */

export interface AzureDIDocumentResult {
  success: boolean;
  confidence: number;
  keyValuePairs: Array<{
    key: string;
    value: string;
    confidence: number;
  }>;
  tables: Array<{
    headers: string[];
    rows: string[][];
  }>;
  content: string;
  pageCount: number;
  error?: string;
}

export async function extractWithPrebuiltDocument(
  fileBuffer: Buffer,
  fileName: string
): Promise<AzureDIDocumentResult>;
```

#### 3.1.2 GPT Mini Extractor Service

**檔案**: `src/services/extraction-v2/gpt-mini-extractor.service.ts`

```typescript
/**
 * GPT-5-mini 欄位提取服務
 *
 * @description
 *   根據 Prompt Config 從結構化數據中提取指定欄位：
 *   - 輸入：精選後的 keyValuePairs + tables
 *   - 輸出：標準化欄位名 + 值 + 信心度
 */

export interface GptMiniExtractionResult {
  success: boolean;
  fields: Record<string, {
    value: string | number | null;
    confidence: number;
    source: 'keyValuePair' | 'table' | 'inferred';
  }>;
  tokensUsed: {
    input: number;
    output: number;
  };
  error?: string;
}

export async function extractFieldsWithGptMini(
  documentData: AzureDIDocumentResult,
  promptConfig: PromptConfig
): Promise<GptMiniExtractionResult>;
```

#### 3.1.3 數據精選工具

**檔案**: `src/services/extraction-v2/data-selector.service.ts`

```typescript
/**
 * 數據精選服務
 *
 * @description
 *   將 Azure DI 完整返回精選為 GPT 輸入：
 *   - 只保留 keyValuePairs + tables
 *   - 格式化為 Markdown 便於 GPT 理解
 *   - 控制 token 數量
 */

export interface SelectedData {
  markdown: string;
  tokenEstimate: number;
  keyValuePairsCount: number;
  tablesCount: number;
}

export function selectDataForGpt(
  documentResult: AzureDIDocumentResult,
  maxTokens?: number
): SelectedData;
```

### 3.2 測試 API

**檔案**: `src/app/api/test/extraction-v2/route.ts`

```typescript
/**
 * 新提取架構測試 API
 *
 * @description
 *   獨立測試端點，不影響現有 unified processor：
 *   - POST: 上傳文件並執行新架構提取
 *   - 返回詳細的中間結果供分析
 */

// POST /api/test/extraction-v2
// Request: FormData { file: File, promptConfigId?: string }
// Response: {
//   azureDIResult: AzureDIDocumentResult,
//   selectedData: SelectedData,
//   gptMiniResult: GptMiniExtractionResult,
//   comparison?: { /* 與現有架構結果對比 */ }
// }
```

### 3.3 測試頁面

**檔案**: `src/app/[locale]/(dashboard)/admin/test/extraction-v2/page.tsx`

```typescript
/**
 * 新提取架構測試頁面
 *
 * @description
 *   提供視覺化界面測試新架構：
 *   - 上傳文件
 *   - 選擇 Prompt Config
 *   - 查看 Azure DI 原始返回
 *   - 查看精選後傳給 GPT 的內容
 *   - 查看 GPT 提取結果
 *   - 與現有架構結果對比
 */
```

---

## 4. 實施計畫

### Phase 1: 基礎服務建立

| 任務 | 檔案 | 說明 |
|------|------|------|
| 1.1 | `azure-di-document.service.ts` | Azure DI prebuilt-document 服務 |
| 1.2 | `data-selector.service.ts` | 數據精選工具 |
| 1.3 | `gpt-mini-extractor.service.ts` | GPT-5-mini 提取服務 |
| 1.4 | `index.ts` | 服務導出 |

### Phase 2: 測試介面建立

| 任務 | 檔案 | 說明 |
|------|------|------|
| 2.1 | `api/test/extraction-v2/route.ts` | 測試 API 端點 |
| 2.2 | `admin/test/extraction-v2/page.tsx` | 測試頁面 UI |

### Phase 3: 測試與驗證

| 任務 | 說明 |
|------|------|
| 3.1 | 使用多種發票格式測試（CEVA, BSI, 其他） |
| 3.2 | 比較提取準確率與現有架構 |
| 3.3 | 評估成本效益 |
| 3.4 | 收集問題和優化建議 |

### Phase 4: (可選) 正式整合

| 任務 | 說明 | 前提條件 |
|------|------|----------|
| 4.1 | 將新架構整合到 unified-processor | Phase 3 測試通過 |
| 4.2 | 遷移現有 Prompt Config | 用戶確認 |
| 4.3 | 評估 Field Mapping Config 去留 | 用戶確認 |

---

## 5. 影響範圍

### 新增的檔案

| 檔案 | 類型 | 說明 |
|------|------|------|
| `src/services/extraction-v2/azure-di-document.service.ts` | 新增 | prebuilt-document 服務 |
| `src/services/extraction-v2/data-selector.service.ts` | 新增 | 數據精選工具 |
| `src/services/extraction-v2/gpt-mini-extractor.service.ts` | 新增 | GPT-5-mini 提取服務 |
| `src/services/extraction-v2/index.ts` | 新增 | 服務導出 |
| `src/app/api/test/extraction-v2/route.ts` | 新增 | 測試 API |
| `src/app/[locale]/(dashboard)/admin/test/extraction-v2/page.tsx` | 新增 | 測試頁面 |

### 不影響的檔案

| 檔案 | 原因 |
|------|------|
| `src/services/unified-processor/*` | 獨立測試，不修改現有流程 |
| `src/services/azure-di.service.ts` | 保留現有 prebuilt-invoice 服務 |
| `src/services/mapping/*` | 保留現有 Field Mapping 功能 |
| 所有現有 API 路由 | 不影響生產功能 |

---

## 6. 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| prebuilt-document 識別 keyValuePairs 不準確 | 中 | 中 | 保留 content 作為備用；可回退到 GPT-5.2 補強 |
| GPT-5-mini 提取能力不足 | 低 | 中 | 可升級到 GPT-4o-mini 或 GPT-5.2 |
| token 數量超出預期 | 中 | 低 | 數據精選工具可調整過濾策略 |
| 新架構準確率低於現有架構 | 低 | 高 | Phase 3 充分測試後再決定是否整合 |

---

## 7. 驗收標準

### Phase 1-2 驗收

- [ ] `prebuilt-document` 服務可成功提取 keyValuePairs 和 tables
- [ ] 數據精選工具可將輸入控制在 1,500 tokens 以內
- [ ] GPT-5-mini 可根據 Prompt Config 輸出標準化欄位
- [ ] 測試 API 可完整執行新架構流程
- [ ] 測試頁面可視覺化展示各階段結果

### Phase 3 驗收

- [ ] 測試至少 10 張不同格式的發票
- [ ] 提取準確率 ≥ 85%（與現有架構相當或更高）
- [ ] 單張發票處理成本 ≤ $0.03
- [ ] 單張發票處理時間 ≤ 20 秒

### Phase 4 驗收（如執行）

- [ ] 新架構成功整合到 unified-processor
- [ ] 所有現有功能正常運作
- [ ] 無 TypeScript 錯誤
- [ ] 文檔更新完成

---

## 8. 開放問題

以下問題待實作過程中確認：

| 問題 | 可能答案 | 決策時機 |
|------|----------|----------|
| Field Mapping Config 是否退役？ | 退役 / 保留作為備用 / 轉型為驗證層 | Phase 3 測試後 |
| GPT-5-mini 是否足夠？ | 足夠 / 升級到 GPT-4o-mini | Phase 3 測試後 |
| 如何處理 lineItems（表格費用明細）？ | tables 結構化提取 / 特殊處理 | Phase 1 實作時 |
| Prompt Config 是否需要擴展？ | 需要 / 現有結構足夠 | Phase 1 實作時 |

---

## 9. 相關文件

| 文件 | 說明 |
|------|------|
| `src/services/azure-di.service.ts` | 現有 Azure DI 服務（prebuilt-invoice） |
| `src/services/unified-processor/` | 現有統一處理管線 |
| `src/services/mapping/` | 現有 Field Mapping 服務 |
| `docs/02-architecture/` | 系統架構文檔 |

---

*文件建立日期: 2026-01-29*
*最後更新: 2026-01-29*
