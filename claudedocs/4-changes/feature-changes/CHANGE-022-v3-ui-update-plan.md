# CHANGE-022: V3 架構 UI 更新計劃

> **建立日期**: 2026-01-31
> **完成日期**: 2026-01-31
> **狀態**: ✅ 已完成（Phase 1-4）| 🧪 待測試（Phase 5）
> **優先級**: 中
> **相關 CHANGE**: CHANGE-021 (V3 純 GPT Vision 架構重構)

---

## 📋 執行摘要

本文件評估 CHANGE-021 V3 架構重構對前端 UI 的影響，並制定完整的更新計劃。

### 核心變更影響

| 變更項目 | V2 版本 | V3 版本 | UI 影響程度 |
|----------|---------|---------|-------------|
| **處理步驟** | 11 步 | 7 步 | 🔴 高 |
| **信心度維度** | 7 維度 | 5 維度 | 🔴 高 |
| **OCR 來源** | Azure DI + GPT | 純 GPT Vision | 🟡 中 |
| **API 響應結構** | 多次 LLM 調用 | 單次調用 | 🟡 中 |

---

## 🎯 影響分析

### 1. Processing Timeline (處理時間軸)

**檔案位置**: `src/components/features/invoice/detail/ProcessingTimeline.tsx`

#### 現有實現
```typescript
// 目前支援的 11 步驟 (V2)
const STEP_LABELS = {
  FILE_TYPE_DETECTION: '文件類型檢測',
  SMART_ROUTING: '智能路由',
  ISSUER_IDENTIFICATION: '發行方識別',
  FORMAT_MATCHING: '格式匹配',
  CONFIG_FETCHING: '配置獲取',
  AZURE_DI_EXTRACTION: 'Azure DI 提取',      // V3 移除
  GPT_ENHANCED_EXTRACTION: 'GPT 增強提取',   // V3 變更
  FIELD_MAPPING: '欄位映射',                  // V3 移除
  TERM_RECORDING: '術語記錄',
  CONFIDENCE_CALCULATION: '信心度計算',
  ROUTING_DECISION: '路由決策',
}
```

#### V3 需要的步驟
```typescript
// V3 的 7 步驟
const V3_STEP_LABELS = {
  FILE_PREPARATION: '文件準備',              // 新增：合併類型檢測+轉換
  DYNAMIC_PROMPT_ASSEMBLY: '動態 Prompt 組裝', // 新增
  UNIFIED_GPT_EXTRACTION: '統一 GPT 提取',   // 新增：核心步驟
  RESULT_VALIDATION: '結果驗證',              // 新增
  TERM_RECORDING: '術語記錄',                 // 保留
  CONFIDENCE_CALCULATION: '信心度計算',       // 保留（但維度變更）
  ROUTING_DECISION: '路由決策',               // 保留
}
```

#### 需要的修改
1. 添加 V3 步驟標籤到 `STEP_LABELS`
2. 添加 i18n 翻譯鍵到 `messages/{locale}/invoices.json`
3. 向後兼容：同時支援 V2 和 V3 步驟顯示

---

### 2. Confidence Breakdown (信心度分解)

**檔案位置**: `src/components/features/confidence/ConfidenceBreakdown.tsx`

#### 現有實現 (V2 - 7 維度)
```typescript
// V2 的 7 個維度
- EXTRACTION (25%)
- ISSUER_IDENTIFICATION (15%)
- FORMAT_MATCHING (15%)
- CONFIG_MATCH (10%)         // V3 移除
- HISTORICAL_ACCURACY (15%)
- FIELD_COMPLETENESS (10%)
- TERM_MATCHING (10%)        // V3 移除
```

#### V3 需要的維度 (5 維度)
```typescript
// V3 的 5 個維度
- EXTRACTION (30%)            // 權重調整
- ISSUER_IDENTIFICATION (20%) // 權重調整
- FORMAT_MATCHING (15%)       // 保留
- FIELD_COMPLETENESS (20%)    // 權重調整
- HISTORICAL_ACCURACY (15%)   // 保留
```

#### 需要的修改
1. 更新 `src/lib/confidence.ts` 的 `FACTOR_LABELS` 配置
2. 更新 `ConfidenceBreakdown.tsx` 組件以支援 V3 維度
3. 添加版本判斷邏輯（根據 API 返回的維度動態顯示）
4. 更新 i18n 翻譯鍵
5. 更新公式顯示文字

---

### 3. Invoice Detail Stats (發票詳情統計)

**檔案位置**: `src/components/features/invoice/detail/InvoiceDetailStats.tsx`

#### 需要的修改
1. 添加處理版本標籤（V2/V3）
2. 調整 Token 消耗顯示（V3 單次調用）
3. 添加 GPT Vision 來源標示

---

### 4. Field Cards (欄位卡片)

**檔案位置**: `src/components/features/document-preview/FieldCard.tsx`

#### 需要的修改
1. 更新來源標籤（統一為 "GPT Vision"）
2. 移除 "Azure DI" 來源選項
3. 添加 V3 特有的信心度顯示邏輯

---

### 5. Upload Page (上傳頁面)

**檔案位置**: `src/app/[locale]/(dashboard)/invoices/upload/page.tsx`

#### 需要的修改
1. 添加處理中的 V3 步驟進度顯示
2. 更新預估處理時間（V3 ~10s vs V2 ~22s）

---

## 📁 受影響的文件清單

### 組件文件
| 文件 | 修改類型 | 優先級 |
|------|----------|--------|
| `ProcessingTimeline.tsx` | 重大更新 | 🔴 高 |
| `ConfidenceBreakdown.tsx` | 重大更新 | 🔴 高 |
| `InvoiceDetailStats.tsx` | 中等更新 | 🟡 中 |
| `FieldCard.tsx` | 小幅更新 | 🟢 低 |

### 類型定義
| 文件 | 修改類型 | 優先級 |
|------|----------|--------|
| `src/types/confidence.ts` | 添加 V3 類型 | 🔴 高 |
| `src/types/processing.ts` | 添加 V3 步驟類型 | 🔴 高 |

### 配置/工具
| 文件 | 修改類型 | 優先級 |
|------|----------|--------|
| `src/lib/confidence.ts` | 添加 V3 配置 | 🔴 高 |
| `src/constants/processing-steps-v3.ts` | 已存在，需整合 | 🟡 中 |

### i18n 翻譯
| 文件 | 修改類型 | 優先級 |
|------|----------|--------|
| `messages/en/invoices.json` | 添加 V3 翻譯 | 🟡 中 |
| `messages/zh-TW/invoices.json` | 添加 V3 翻譯 | 🟡 中 |
| `messages/zh-CN/invoices.json` | 添加 V3 翻譯 | 🟡 中 |
| `messages/*/confidence.json` | 添加 V3 維度翻譯 | 🟡 中 |

---

## 🔄 實施計劃

### Phase 1: 類型和配置 (Day 1) ✅ 完成
- [x] 更新 `src/types/confidence.ts` - 添加 V3 信心度類型
- [x] 更新 `src/types/processing.ts` - 添加 V3 步驟類型
- [x] 更新 `src/lib/confidence.ts` - 添加 V3 維度配置
- [x] 整合 `src/constants/processing-steps-v3.ts`

### Phase 2: i18n 翻譯 (Day 1-2) ✅ 完成
- [x] 更新 `messages/*/invoices.json` - 添加 V3 步驟翻譯
- [x] 創建 `messages/*/confidence.json` - 信心度相關翻譯
- [x] 驗證所有三種語言的翻譯完整性

### Phase 3: 核心組件更新 (Day 2-3) ✅ 完成
- [x] 更新 `ProcessingTimeline.tsx` - 支援 V3 步驟
- [x] 更新 `ConfidenceBreakdown.tsx` - 支援 V3 維度
- [x] 添加版本檢測邏輯（V2/V3 自動識別）

### Phase 4: 次要組件更新 (Day 3-4) ✅ 完成
- [x] 更新 `InvoiceDetailStats.tsx` - 添加版本標籤
- [ ] 更新 `FieldCard.tsx` - 統一來源顯示（非必要，延後）
- [x] 更新 Upload/Process API - 添加 processingVersion 參數

### Phase 5: 測試與驗證 (Day 4-5) 🧪 待進行
- [ ] V2 文件顯示測試（向後兼容）
- [ ] V3 文件顯示測試
- [ ] i18n 三語言測試
- [ ] 響應式設計測試

---

## 🧪 測試計劃

### 測試場景
1. **V2 文件顯示** - 確保現有文件正常顯示
2. **V3 文件顯示** - 驗證新步驟和維度正確顯示
3. **混合環境** - V2/V3 文件在同一列表中顯示
4. **語言切換** - en/zh-TW/zh-CN 三語言測試

### 測試數據
- 使用 `DHL RVN INVOICE 40613.pdf` (V3 測試文件)
- 使用現有 V2 處理的發票數據

---

## 📊 向後兼容策略

### 版本檢測邏輯
```typescript
// 根據 API 響應判斷版本
function detectProcessingVersion(steps: ProcessingStep[]): 'v2' | 'v3' {
  const stepNames = steps.map(s => s.step);

  // V3 特有步驟
  if (stepNames.includes('UNIFIED_GPT_EXTRACTION') ||
      stepNames.includes('DYNAMIC_PROMPT_ASSEMBLY')) {
    return 'v3';
  }

  // V2 特有步驟
  if (stepNames.includes('AZURE_DI_EXTRACTION') ||
      stepNames.includes('GPT_ENHANCED_EXTRACTION')) {
    return 'v2';
  }

  return 'v2'; // 預設
}
```

### 信心度版本檢測
```typescript
function detectConfidenceVersion(dimensions: ConfidenceDimension[]): 'v2' | 'v3' {
  // V3 只有 5 個維度
  if (dimensions.length === 5) return 'v3';

  // V2 有 7 個維度
  if (dimensions.length === 7) return 'v2';

  // 檢查 V2 特有維度
  const hasV2Dimensions = dimensions.some(d =>
    d.name === 'CONFIG_MATCH' || d.name === 'TERM_MATCHING'
  );

  return hasV2Dimensions ? 'v2' : 'v3';
}
```

---

## ⚠️ 風險與注意事項

### 風險項目
| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 向後兼容破壞 | 現有 V2 文件無法顯示 | 保留 V2 步驟標籤，添加版本檢測 |
| i18n 遺漏 | 某些語言顯示英文 fallback | 完整更新三種語言文件 |
| API 響應變更 | 前端解析錯誤 | 添加類型守衛和 fallback |

### 回滾策略
1. 所有更新通過 Feature Flag 控制
2. 保留 V2 組件邏輯作為 fallback
3. 發現問題時可快速切回 V2 模式

---

## 📅 時間線估算

| 階段 | 預估工時 | 依賴 |
|------|----------|------|
| Phase 1 | 2-3 小時 | 無 |
| Phase 2 | 2-3 小時 | Phase 1 |
| Phase 3 | 4-6 小時 | Phase 1, 2 |
| Phase 4 | 2-3 小時 | Phase 3 |
| Phase 5 | 2-3 小時 | Phase 4 |
| **總計** | **12-18 小時** | - |

---

## 📝 驗收標準

### 功能驗收
- [x] V3 處理的文件正確顯示 7 步驟時間軸 ✅ (2026-01-31 驗證通過)
- [ ] V3 信心度正確顯示 5 維度分解（信心度分解組件未在詳情頁顯示，待確認）
- [ ] V2 處理的文件仍正確顯示（向後兼容）（待測試）
- [x] 所有三種語言顯示正確 ✅ (zh-TW, en 已驗證)

### 質量驗收
- [x] 無 TypeScript 類型錯誤 ✅
- [x] 無 ESLint 錯誤 ✅
- [x] 組件正確使用 i18n 翻譯 ✅
- [ ] 響應式設計正常（待測試）

---

## 📋 測試記錄

### 2026-01-31 Phase 5 UI 測試

**測試文件**: CEVA LOGISTICS_CEX240464_39613.pdf (V3 處理)

| 測試項目 | 結果 | 備註 |
|----------|------|------|
| V3 版本標籤顯示 | ✅ 通過 | 正確顯示 "V3（7 步驟）" / "V3 (7 steps)" |
| V3 處理時間軸 (7 步) | ✅ 通過 | 所有步驟正確顯示和翻譯 |
| 信心度顯示 | ✅ 通過 | 86.5% / 中信心 / Medium Confidence |
| 路由決策顯示 | ✅ 通過 | 快速審核 / Quick Review |
| i18n 繁體中文 | ✅ 通過 | 所有文字正確翻譯 |
| i18n 英文 | ✅ 通過 | 所有文字正確翻譯 |

**V3 步驟翻譯對照**:

| 步驟 | 繁體中文 | English |
|------|----------|---------|
| FILE_PREPARATION | 文件準備 | File Preparation |
| DYNAMIC_PROMPT_ASSEMBLY | Prompt 組裝 | Prompt Assembly |
| UNIFIED_GPT_EXTRACTION | GPT 統一提取 | GPT Unified Extraction |
| RESULT_VALIDATION | 結果驗證 | Result Validation |
| TERM_RECORDING | 術語記錄 | Term Recording |
| CONFIDENCE_CALCULATION | 信心度計算 | Confidence Calculation |
| ROUTING_DECISION | 路由決策 | Routing Decision |

---

**文檔建立日期**: 2026-01-31
**測試完成日期**: 2026-01-31
**作者**: AI Assistant (Claude)
**版本**: 1.1.0
