# CHANGE-026：Prompt 配置與 Stage 服務整合

> **建立日期**: 2026-02-03
> **完成日期**: 2026-02-03
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Feature Enhancement
> **前置條件**: CHANGE-025 統一文件處理流程架構優化已完成
> **影響範圍**: extraction-v3 Stage 服務、prompt-assembly 服務、前端類型定義

---

## 1. 變更概述

### 1.1 執行摘要

本變更解決 CHANGE-025 Phase 3「Prompt 可配置化」的遺留問題：

- **問題**：雖然 UI 介面和資料庫支援已完成，但 Stage 1/2/3 服務**從未調用** `loadStageXPromptConfig()` 方法，導致 PromptConfig 表的配置完全不會被使用
- **解決方案**：完成 Stage 服務與 PromptConfig 的整合，實現變數替換和 Merge Strategy 功能

**核心問題**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 現狀：PromptConfig 配置被忽略                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  用戶在 UI 創建配置                                                       │
│       │                                                                  │
│       ▼                                                                  │
│  PromptConfig 表 ──────────────────┐                                    │
│  (systemPrompt, userPromptTemplate, │   ❌ 從未被查詢                    │
│   scope, mergeStrategy, variables)  │                                    │
│                                     │                                    │
│                                     │                                    │
│  Stage 1/2/3 服務 ─────────────────┴── 直接使用硬編碼 Prompt            │
│       │                                                                  │
│       ▼                                                                  │
│  GPT API 調用                                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 背景與動機

#### 1.2.1 CHANGE-025 Phase 3 遺留問題

CHANGE-025 聲稱完成了「Prompt 可配置化」，但經調查發現：

| 項目 | 預期 | 實際 |
|------|------|------|
| Stage 服務整合 | Stage 服務調用 loadStageXPromptConfig() | ❌ 從未調用 |
| 變數替換 | ${xxx} 變數被替換為實際值 | ❌ 沒有替換邏輯 |
| Merge Strategy | OVERRIDE/APPEND/PREPEND 生效 | ❌ 沒有處理邏輯 |
| 前端類型 | PROMPT_TYPES 包含 V3.1 類型 | ❌ 缺少 3 個類型 |

#### 1.2.2 代碼證據

**Stage 1 服務（stage-1-company.service.ts）**：
```typescript
// 第 99 行 - 直接使用硬編碼方法，從不查詢 PromptConfig
async execute(input: Stage1Input): Promise<Stage1CompanyResult> {
  const prompt = this.buildCompanyIdentificationPrompt(input.knownCompanies);
  // ...
}
```

**loadStage1PromptConfig 方法存在但從未被調用**：
```typescript
// prompt-assembly.service.ts 第 461-509 行
// 方法已實現，有完整的優先級邏輯 (FORMAT > COMPANY > GLOBAL)
// 但在整個 extraction-v3/stages 目錄中從未被 import 或調用
```

### 1.3 變更目標

| # | 目標 | 當前狀態 | 目標狀態 |
|---|------|---------|---------|
| 1 | **Stage 服務整合** | 硬編碼 Prompt | 優先使用 PromptConfig，回退到硬編碼 |
| 2 | **變數替換** | 未實現 | ${xxx} 變數被實際值替換 |
| 3 | **Merge Strategy** | 未實現 | OVERRIDE/APPEND/PREPEND 正確處理 |
| 4 | **前端類型更新** | 缺少 3 個類型 | PROMPT_TYPES 包含所有 V3.1 類型 |

---

## 2. 技術設計

### 2.1 目標架構

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 目標：PromptConfig 配置被正確使用                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Stage 1/2/3 服務                                                        │
│       │                                                                  │
│       ▼                                                                  │
│  loadStageXPromptConfig(companyId, formatId)                            │
│       │                                                                  │
│       ├─── 找到配置？                                                    │
│       │    │                                                             │
│       │    ├─ Yes ──▶ 變數替換 ──▶ Merge Strategy ──▶ 使用自定義 Prompt │
│       │    │                                                             │
│       │    └─ No ───▶ 使用硬編碼 Prompt（回退）                          │
│       │                                                                  │
│       ▼                                                                  │
│  GPT API 調用                                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 變數替換設計

#### 2.2.1 支援的變數

| 變數 | 類別 | 說明 | 範例值 |
|------|------|------|--------|
| `${companyName}` | 靜態 | 文件發行公司名稱 | "DHL Express" |
| `${documentFormatName}` | 靜態 | 文件格式名稱 | "DHL Express Invoice" |
| `${knownCompanies}` | 動態 | 已知公司列表 | "- DHL Express\n- FedEx\n..." |
| `${knownFormats}` | 動態 | 已知格式列表 | "- DHL Invoice Template\n..." |
| `${universalMappings}` | 動態 | Tier 1 通用映射 | "Freight Charge → Freight\n..." |
| `${companyMappings}` | 動態 | Tier 2 公司映射 | "Express Handling → Handling\n..." |
| `${standardFields}` | 動態 | 標準欄位定義 | "invoiceNumber, invoiceDate..." |
| `${customFields}` | 動態 | 自定義欄位定義 | "shipmentWeight, awbNumber..." |
| `${currentDate}` | 上下文 | 當前日期 | "2026-02-03" |
| `${pageCount}` | 上下文 | 文件頁數 | "3" |
| `${fileName}` | 上下文 | 檔案名稱 | "invoice_001.pdf" |

#### 2.2.2 變數替換函數

```typescript
// src/services/extraction-v3/utils/variable-replacer.ts (新增)

export interface VariableContext {
  // 靜態變數
  companyName?: string;
  documentFormatName?: string;

  // 動態變數（由各 Stage 服務提供）
  knownCompanies?: string;
  knownFormats?: string;
  universalMappings?: string;
  companyMappings?: string;
  standardFields?: string;
  customFields?: string;

  // 上下文變數
  currentDate?: string;
  pageCount?: number;
  fileName?: string;
}

/**
 * 替換 Prompt 模板中的變數
 * @param template - 包含 ${xxx} 變數的模板字符串
 * @param context - 變數上下文
 * @returns 替換後的字符串
 */
export function replaceVariables(
  template: string,
  context: VariableContext
): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    const value = context[varName as keyof VariableContext];
    if (value === undefined || value === null) {
      console.warn(`[VariableReplacer] Unknown variable: ${varName}`);
      return match; // 保留原樣
    }
    return String(value);
  });
}
```

### 2.3 Merge Strategy 設計

#### 2.3.1 合併策略說明

| 策略 | 說明 | 使用場景 |
|------|------|---------|
| `OVERRIDE` | 完全覆蓋父層 Prompt | 需要完全自定義時 |
| `APPEND` | 附加到父層 Prompt 末尾 | 添加額外指令時 |
| `PREPEND` | 插入到父層 Prompt 開頭 | 添加優先指令時 |

#### 2.3.2 合併函數

```typescript
// src/services/extraction-v3/utils/prompt-merger.ts (新增)

import type { MergeStrategy } from '@prisma/client';

/**
 * 合併父層和子層 Prompt
 * @param parentPrompt - 父層 Prompt（GLOBAL 或硬編碼預設）
 * @param childPrompt - 子層 Prompt（COMPANY 或 FORMAT 級）
 * @param strategy - 合併策略
 * @returns 合併後的 Prompt
 */
export function mergePrompts(
  parentPrompt: string,
  childPrompt: string,
  strategy: MergeStrategy
): string {
  switch (strategy) {
    case 'OVERRIDE':
      return childPrompt;

    case 'APPEND':
      return `${parentPrompt}\n\n${childPrompt}`;

    case 'PREPEND':
      return `${childPrompt}\n\n${parentPrompt}`;

    default:
      console.warn(`[PromptMerger] Unknown strategy: ${strategy}, using OVERRIDE`);
      return childPrompt;
  }
}
```

### 2.4 Stage 服務整合設計

#### 2.4.1 Stage 1 整合（stage-1-company.service.ts）

```typescript
// 修改 execute 方法

import { loadStage1PromptConfig } from '../prompt-assembly.service';
import { replaceVariables } from '../utils/variable-replacer';

async execute(input: Stage1Input): Promise<Stage1CompanyResult> {
  const startTime = Date.now();

  try {
    // 1. 嘗試載入自定義配置
    const customConfig = await loadStage1PromptConfig({
      companyId: input.companyId,
      formatId: input.formatId,
    });

    // 2. 組裝 Prompt
    let prompt: { system: string; user: string };

    if (customConfig) {
      // 使用自定義配置 + 變數替換
      const variableContext = this.buildVariableContext(input);
      prompt = {
        system: replaceVariables(customConfig.systemPrompt, variableContext),
        user: replaceVariables(customConfig.userPromptTemplate, variableContext),
      };
    } else {
      // 回退到硬編碼（現有邏輯）
      prompt = this.buildCompanyIdentificationPrompt(input.knownCompanies);
    }

    // 3. 調用 GPT
    const gptResult = await this.callGptNano(prompt, input.images);

    // ... 其餘邏輯不變
  } catch (error) {
    // ... 錯誤處理
  }
}

/**
 * 構建變數上下文
 */
private buildVariableContext(input: Stage1Input): VariableContext {
  return {
    knownCompanies: input.knownCompanies
      .map(c => `- ${c.name}${c.aliases?.length ? ` (Aliases: ${c.aliases.join(', ')})` : ''}`)
      .join('\n'),
    currentDate: new Date().toISOString().split('T')[0],
    pageCount: input.images.length,
    fileName: input.fileName,
  };
}
```

#### 2.4.2 Stage 2 整合（類似模式）

```typescript
// stage-2-format.service.ts
// 與 Stage 1 類似，但變數上下文包含 knownFormats
```

#### 2.4.3 Stage 3 整合（類似模式）

```typescript
// stage-3-extraction.service.ts
// 變數上下文包含 universalMappings, companyMappings, standardFields, customFields
```

### 2.5 前端類型更新

#### 2.5.1 更新 PROMPT_TYPES（src/types/prompt-config.ts）

```typescript
export const PROMPT_TYPES = {
  // 現有類型
  ISSUER_IDENTIFICATION: {
    value: 'ISSUER_IDENTIFICATION',
    label: '發行方識別',
    description: '用於識別文件發行方（如物流公司、供應商）',
  },
  TERM_CLASSIFICATION: {
    value: 'TERM_CLASSIFICATION',
    label: '術語分類',
    description: '用於分類提取的術語到標準類別',
  },
  FIELD_EXTRACTION: {
    value: 'FIELD_EXTRACTION',
    label: '欄位提取',
    description: '用於從文件中提取特定欄位',
  },
  VALIDATION: {
    value: 'VALIDATION',
    label: '驗證',
    description: '用於驗證提取結果的準確性',
  },

  // 🆕 CHANGE-026: V3.1 三階段 Prompt 類型
  STAGE_1_COMPANY_IDENTIFICATION: {
    value: 'STAGE_1_COMPANY_IDENTIFICATION',
    label: 'Stage 1 - 公司識別',
    description: 'V3.1 三階段架構：識別文件發行公司（GPT-5-nano）',
  },
  STAGE_2_FORMAT_IDENTIFICATION: {
    value: 'STAGE_2_FORMAT_IDENTIFICATION',
    label: 'Stage 2 - 格式識別',
    description: 'V3.1 三階段架構：識別文件格式/模板（GPT-5-nano）',
  },
  STAGE_3_FIELD_EXTRACTION: {
    value: 'STAGE_3_FIELD_EXTRACTION',
    label: 'Stage 3 - 欄位提取',
    description: 'V3.1 三階段架構：提取發票欄位數據（GPT-5.2）',
  },
} as const;
```

---

## 3. 影響範圍評估

### 3.1 文件影響清單

| 文件路徑 | 影響程度 | 修改說明 | Phase |
|----------|----------|----------|-------|
| `src/types/prompt-config.ts` | 🟢 低 | 新增 3 個 PROMPT_TYPES | 1 |
| `src/services/extraction-v3/utils/variable-replacer.ts` | 🟢 新增 | 變數替換工具 | 2 |
| `src/services/extraction-v3/utils/prompt-merger.ts` | 🟢 新增 | Prompt 合併工具 | 2 |
| `src/services/extraction-v3/stages/stage-1-company.service.ts` | 🟡 中 | 整合 PromptConfig | 3 |
| `src/services/extraction-v3/stages/stage-2-format.service.ts` | 🟡 中 | 整合 PromptConfig | 3 |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 🟡 中 | 整合 PromptConfig | 3 |
| `src/services/extraction-v3/index.ts` | 🟢 低 | 導出新工具 | 2 |

### 3.2 向後兼容性

- **完全向後兼容**：無 PromptConfig 記錄時回退到現有硬編碼邏輯
- **漸進式採用**：用戶可選擇性地為特定公司/格式創建自定義 Prompt
- **無 Breaking Changes**：現有文件處理流程不受影響

---

## 4. 實施計劃

### 4.1 階段概覽

```
Phase 1: 前端類型更新         Phase 2: 工具函數實現
(預計: 0.5 小時)              (預計: 1-2 小時)
────────────────             ─────────────────
• PROMPT_TYPES 新增 3 類型   • variable-replacer.ts
                             • prompt-merger.ts
                             • 導出更新
         │                            │
         └──────────┬─────────────────┘
                    ▼
         Phase 3: Stage 服務整合
         (預計: 3-4 小時)
         ───────────────────
         • Stage 1 整合
         • Stage 2 整合
         • Stage 3 整合
                    │
                    ▼
         Phase 4: 測試驗證
         (預計: 1-2 小時)
         ─────────────────
         • 單元測試
         • 整合測試
         • E2E 驗證
```

### 4.2 Phase 1: 前端類型更新（0.5 小時）

| # | 任務 | 文件 |
|---|------|------|
| 1.1 | 更新 PROMPT_TYPES 常量 | `src/types/prompt-config.ts` |

### 4.3 Phase 2: 工具函數實現（1-2 小時）

| # | 任務 | 文件 |
|---|------|------|
| 2.1 | 實現變數替換函數 | `src/services/extraction-v3/utils/variable-replacer.ts` |
| 2.2 | 實現 Prompt 合併函數 | `src/services/extraction-v3/utils/prompt-merger.ts` |
| 2.3 | 更新導出 | `src/services/extraction-v3/index.ts` |

### 4.4 Phase 3: Stage 服務整合（3-4 小時）

| # | 任務 | 文件 | 依賴 |
|---|------|------|------|
| 3.1 | Stage 1 整合 PromptConfig | `stage-1-company.service.ts` | Phase 2 |
| 3.2 | Stage 2 整合 PromptConfig | `stage-2-format.service.ts` | Phase 2 |
| 3.3 | Stage 3 整合 PromptConfig | `stage-3-extraction.service.ts` | Phase 2 |

### 4.5 Phase 4: 測試驗證（1-2 小時）

| # | 任務 | 說明 |
|---|------|------|
| 4.1 | 無配置回退測試 | 確認無 PromptConfig 時使用硬編碼 |
| 4.2 | GLOBAL 配置測試 | 確認 GLOBAL scope 配置生效 |
| 4.3 | COMPANY 配置測試 | 確認 COMPANY scope 覆蓋 GLOBAL |
| 4.4 | FORMAT 配置測試 | 確認 FORMAT scope 覆蓋 COMPANY |
| 4.5 | 變數替換測試 | 確認 ${xxx} 變數被正確替換 |
| 4.6 | Merge Strategy 測試 | 確認 OVERRIDE/APPEND/PREPEND 正確處理 |

---

## 5. 驗收標準

### 5.1 功能驗收

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|---------|--------|
| F1 | 前端類型 | PROMPT_TYPES 包含 7 個類型（4 舊 + 3 新） | P0 |
| F2 | 無配置回退 | 無 PromptConfig 時使用硬編碼 Prompt | P0 |
| F3 | GLOBAL 配置 | GLOBAL scope 配置被 Stage 服務使用 | P0 |
| F4 | Scope 優先級 | FORMAT > COMPANY > GLOBAL 正確生效 | P1 |
| F5 | 變數替換 | ${xxx} 變數被替換為實際值 | P1 |
| F6 | Merge Strategy | OVERRIDE/APPEND/PREPEND 正確處理 | P2 |

### 5.2 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|---------|---------|
| T1 | 無配置處理 | 刪除所有 PromptConfig，處理文件 | 使用硬編碼 Prompt，處理成功 |
| T2 | GLOBAL 配置 | 創建 GLOBAL 級 Stage 1 配置，處理文件 | 使用自定義 Prompt |
| T3 | COMPANY 覆蓋 | 同時有 GLOBAL 和 COMPANY 配置，處理該公司文件 | 使用 COMPANY 配置 |
| T4 | 變數替換 | 在 Prompt 中使用 ${companyName}，處理文件 | 變數被替換為實際公司名 |
| T5 | APPEND 策略 | 設置 mergeStrategy = APPEND | 子層 Prompt 附加到父層末尾 |

---

## 6. 風險評估

### 6.1 風險矩陣

| # | 風險 | 可能性 | 影響 | 風險等級 | 緩解措施 |
|---|------|--------|------|---------|----------|
| R1 | 回退邏輯失效導致處理失敗 | 低 | 高 | 🟡 中 | 完整測試無配置場景 |
| R2 | 變數替換性能影響 | 低 | 低 | 🟢 低 | 簡單正則替換，影響可忽略 |
| R3 | Merge Strategy 邏輯錯誤 | 中 | 中 | 🟡 中 | 單元測試覆蓋所有策略 |
| R4 | 配置優先級計算錯誤 | 低 | 中 | 🟢 低 | loadStageXPromptConfig 已有測試 |

### 6.2 回滾計劃

```bash
# 回滾方式：
# 1. Stage 服務中設置 SKIP_PROMPT_CONFIG = true 環境變數
# 2. 或直接 revert 相關 commit

# 回滾後影響：
# - Stage 服務回到完全使用硬編碼 Prompt
# - PromptConfig 表數據保留但不被使用
```

---

## 7. 相關文件

### 7.1 前置文件

| 文件 | 說明 |
|------|------|
| `CHANGE-025-unified-processing-flow-optimization.md` | 統一處理流程優化（Phase 3 遺留問題來源） |
| `CHANGE-024-three-stage-extraction-architecture.md` | V3.1 三階段提取架構 |

### 7.2 相關代碼文件

| 文件 | 說明 |
|------|------|
| `src/services/extraction-v3/prompt-assembly.service.ts` | loadStageXPromptConfig 方法定義 |
| `src/services/extraction-v3/stages/stage-1-company.service.ts` | Stage 1 服務 |
| `src/services/extraction-v3/stages/stage-2-format.service.ts` | Stage 2 服務 |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | Stage 3 服務 |
| `src/types/prompt-config.ts` | 前端 Prompt 配置類型定義 |

---

## 8. 待決事項

| # | 事項 | 狀態 | 優先級 | 說明 |
|---|------|------|--------|------|
| 1 | 確認變數命名規範 | ⏳ 待確認 | P1 | 是否需要更多變數？ |
| 2 | 確認 Merge Strategy 細節 | ⏳ 待確認 | P2 | APPEND 時是否需要分隔符？ |
| 3 | 確認是否需要配置驗證 | ⏳ 待確認 | P2 | 保存時驗證變數是否存在？ |

---

**文檔建立日期**: 2026-02-03
**作者**: AI Assistant (Claude)
**版本**: 1.1.0
**狀態**: ✅ 已完成

### 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0.0 | 2026-02-03 | 初始版本 - 完整規劃文檔 |
| 1.1.0 | 2026-02-03 | 實施完成 - Phase 1~3 全部完成 |
