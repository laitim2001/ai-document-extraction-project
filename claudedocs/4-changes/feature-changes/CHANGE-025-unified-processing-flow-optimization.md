# CHANGE-025：統一文件處理流程架構優化

> **建立日期**: 2026-02-01
> **完成日期**: -
> **狀態**: 🚧 Phase 1 準備中
> **優先級**: High
> **類型**: Architecture Enhancement
> **前置條件**: CHANGE-024 V3.1 三階段提取架構已完成
> **影響範圍**: extraction-v3 服務、路由決策、UI 審核流程

---

## 1. 變更概述

### 1.1 執行摘要

本變更解決 CHANGE-024 三階段架構中的「雞與蛋」問題：

- **問題**：新公司/格式的文件無法處理，因為系統需要配置才能處理，但沒有先處理過就不知道需要什麼配置
- **解決方案**：採用「智能模式」策略，讓系統嘗試處理所有文件，對新公司/格式的結果強制路由到人工審核

**核心改進**：

| 改進項目 | 現狀 | 目標狀態 |
|----------|------|---------|
| 新公司文件 | 需預先配置才能處理 | JIT 創建 + 強制審核 |
| 新格式文件 | 需預先配置才能處理 | JIT 創建 + 強制審核 |
| Stage 1/2 Prompt | 硬編碼 | 從資料庫讀取，可配置 |
| IdentificationRules | 只用 keywords | 完整使用所有規則欄位 |
| 審核路由 | 僅基於信心度 | 智能模式（考慮 isNew 標記） |

### 1.2 背景與動機

#### 1.2.1 CHANGE-024 遺留問題

CHANGE-024 成功實現了三階段提取架構：

```
Stage 1: 公司識別 (GPT-5-nano)
    ↓
Stage 2: 格式識別 (GPT-5-nano)
    ↓
Stage 3: 欄位提取 (GPT-5.2)
```

然而，存在以下問題：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 問題 1: Stage 1/2 Prompt 硬編碼                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ❌ Stage 1 公司識別 Prompt：                                                │
│     • 直接在代碼中定義 System Prompt                                         │
│     • 用戶無法通過 UI 調整識別邏輯                                           │
│     • 無法針對特定地區/行業調整識別策略                                      │
│                                                                              │
│  ❌ Stage 2 格式識別 Prompt：                                                │
│     • 只使用 DocumentFormat.commonTerms（keywords）                          │
│     • 忽略 identificationRules 中的：                                        │
│       - logoPatterns（Logo 識別規則）                                        │
│       - layoutHints（版面提示）                                              │
│       - priority（優先級排序）                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 問題 2: 雞與蛋問題                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ❌ 新公司流程：                                                             │
│     上傳文件 → Stage 1 識別新公司 → JIT 創建公司                             │
│                                        ↓                                     │
│     ❓ 然後呢？繼續處理還是等待配置？                                        │
│                                                                              │
│  ❌ 新格式流程：                                                             │
│     Stage 2 識別新格式 → JIT 創建格式                                        │
│                              ↓                                               │
│     ❓ Stage 3 用什麼配置提取欄位？                                          │
│                                                                              │
│  ❌ 批量上傳：                                                               │
│     100 份新公司文件 → 逐一處理還是全部暫停？                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1.2.2 用戶決策

經過討論，用戶確認採用以下策略：

| 決策點 | 選擇 | 說明 |
|--------|------|------|
| 處理策略 | **智能模式** | 新公司/格式用預設配置嘗試處理，標記「需審核」 |
| 最低配置 | **僅需格式記錄** | PromptConfig 可用 GLOBAL 預設 |
| 批量處理 | **全部嘗試處理** | 不等待配置，全部標記「待審核」 |

### 1.3 目標流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CHANGE-025 目標流程：智能模式處理                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  文件上傳                                                                     │
│      ↓                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 1: 公司識別 (GPT-5-nano)                                         │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │ • Prompt 來源：PromptConfig (GLOBAL > DEFAULT 硬編碼)                   │ │
│  │ • 已知公司列表作為參考                                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                      ↓                                                       │
│              公司存在於資料庫？                                               │
│              ├─ Yes → 繼續 Stage 2                                          │
│              └─ No → JIT 創建公司                                           │
│                        ├─ 標記 isNewCompany = true                          │
│                        └─ 繼續 Stage 2（不等待配置）                         │
│                      ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 2: 格式識別 (GPT-5-nano)                                         │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │ • Prompt 來源：PromptConfig (COMPANY > GLOBAL > DEFAULT)               │ │
│  │ • 完整使用 identificationRules：                                        │ │
│  │   - keywords (commonTerms)                                              │ │
│  │   - logoPatterns                                                        │ │
│  │   - layoutHints                                                         │ │
│  │   - priority（排序）                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                      ↓                                                       │
│              格式存在於資料庫？                                               │
│              ├─ Yes → 繼續 Stage 3                                          │
│              └─ No → JIT 創建格式                                           │
│                        ├─ 標記 isNewFormat = true                           │
│                        └─ 繼續 Stage 3（使用 GLOBAL 預設配置）               │
│                      ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 3: 欄位提取 (GPT-5.2)                                            │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │ • 配置優先級：FORMAT > COMPANY > GLOBAL > DEFAULT                       │ │
│  │ • 新公司/格式使用 GLOBAL 預設                                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                      ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 智能路由決策                                                            │ │
│  │ ────────────────────────────────────────────────────────────────────── │ │
│  │                                                                        │ │
│  │  isNewCompany || isNewFormat?                                          │ │
│  │  ├─ Yes → 強制 FULL_REVIEW                                             │ │
│  │  │          + needsConfigReview = true                                 │ │
│  │  │          + UI 顯示「需要配置」提示                                   │ │
│  │  │                                                                     │ │
│  │  └─ No → 正常信心度路由                                                │ │
│  │           ├─ ≥90% → AUTO_APPROVE                                       │ │
│  │           ├─ 70-89% → QUICK_REVIEW                                     │ │
│  │           └─ <70% → FULL_REVIEW                                        │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 變更目標

| # | 目標 | 當前狀態 | 目標狀態 |
|---|------|---------|---------|
| 1 | **Prompt 可配置化** | Stage 1/2 Prompt 硬編碼 | 從 PromptConfig 讀取，可通過 UI 配置 |
| 2 | **完整 IdentificationRules** | 只使用 keywords | 完整使用 logoPatterns、layoutHints、priority |
| 3 | **智能路由** | 僅基於信心度 | 考慮 isNewCompany/isNewFormat 標記 |
| 4 | **審核提示** | 無特殊標記 | UI 顯示「新公司/格式」提示和配置連結 |
| 5 | **配置最低要求** | 需完整配置 | 僅需格式記錄，Prompt 可用 GLOBAL |

---

## 2. 技術設計

### 2.1 新增類型定義

#### 2.1.1 處理結果標記

```typescript
// src/types/unified-processor.ts (修改)

/**
 * 統一處理器輸出結果（擴展）
 */
export interface UnifiedProcessorOutput {
  // ... 現有欄位 ...

  // 🆕 新公司/格式標記
  newCompanyDetected: boolean;    // Stage 1 識別到新公司
  newFormatDetected: boolean;     // Stage 2 識別到新格式
  needsConfigReview: boolean;     // 需要配置審核（newCompany || newFormat）
}
```

#### 2.1.2 智能路由參數

```typescript
// src/types/extraction-v3.types.ts (修改)

/**
 * 智能路由輸入參數
 */
export interface SmartRoutingInput {
  overallConfidence: number;      // 整體信心度 (0-100)
  isNewCompany: boolean;          // 是否為新公司
  isNewFormat: boolean;           // 是否為新格式
  configSource: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'DEFAULT';
}

/**
 * 智能路由輸出
 */
export interface SmartRoutingOutput {
  reviewType: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW';
  reason: string;                 // 路由原因說明
  needsConfigReview: boolean;     // 是否需要配置審核
}
```

#### 2.1.3 擴展 FormatPatternForPrompt

```typescript
// src/types/extraction-v3.types.ts (修改)

/**
 * Logo 識別模式
 */
export interface LogoPattern {
  description: string;            // Logo 描述
  position?: 'TOP_LEFT' | 'TOP_RIGHT' | 'TOP_CENTER' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  keywords?: string[];            // Logo 中可能包含的文字
}

/**
 * 格式識別資訊（用於 Prompt 組裝）- 擴展版
 */
export interface FormatPatternForPrompt {
  formatId: string;
  formatName: string;
  documentType?: string;
  documentSubtype?: string;

  // 現有欄位
  patterns: string[];             // 來自 features
  keywords: string[];             // 來自 commonTerms

  // 🆕 新增欄位（來自 identificationRules）
  logoPatterns?: LogoPattern[];   // Logo 識別規則
  layoutHints?: string;           // 版面特徵提示
  priority?: number;              // 識別優先級（數字越小優先級越高）
}
```

### 2.2 資料庫變更

#### 2.2.1 擴展 PromptType 枚舉

```prisma
// prisma/schema.prisma (修改)

enum PromptType {
  // 現有類型
  ISSUER_IDENTIFICATION      // 發行者識別
  TERM_CLASSIFICATION        // 術語分類
  FIELD_EXTRACTION           // 欄位提取（Stage 3）
  VALIDATION                 // 驗證

  // 🆕 新增類型
  STAGE_1_COMPANY_ID         // Stage 1 公司識別
  STAGE_2_FORMAT_ID          // Stage 2 格式識別
}
```

### 2.3 服務層變更

#### 2.3.1 Stage 1 Prompt 可配置化

```typescript
// src/services/extraction-v3/stages/stage-1-company.service.ts (修改)

export class Stage1CompanyService {
  private prisma: PrismaClient;

  /**
   * 🆕 載入 Stage 1 Prompt 配置
   * 優先級：GLOBAL > DEFAULT（硬編碼）
   */
  private async loadPromptConfig(): Promise<{
    systemPrompt: string;
    userPrompt: string;
    source: 'GLOBAL' | 'DEFAULT';
  }> {
    // 嘗試從 PromptConfig 載入 GLOBAL 級的 STAGE_1_COMPANY_ID 配置
    const config = await this.prisma.promptConfig.findFirst({
      where: {
        promptType: 'STAGE_1_COMPANY_ID',
        scope: 'GLOBAL',
        isActive: true,
      },
    });

    if (config) {
      return {
        systemPrompt: config.systemPrompt,
        userPrompt: config.userPromptTemplate || 'Identify the issuing company from this invoice image.',
        source: 'GLOBAL',
      };
    }

    // 無配置時使用預設值
    return {
      systemPrompt: this.getDefaultSystemPrompt(),
      userPrompt: 'Identify the issuing company from this invoice image.',
      source: 'DEFAULT',
    };
  }

  /**
   * 預設 System Prompt（現有邏輯）
   */
  private getDefaultSystemPrompt(): string {
    return `You are an invoice issuer identification specialist...`;
    // 現有的硬編碼 Prompt
  }
}
```

#### 2.3.2 Stage 2 Prompt 可配置化 + 完整 IdentificationRules

```typescript
// src/services/extraction-v3/stages/stage-2-format.service.ts (修改)

export class Stage2FormatService {
  private prisma: PrismaClient;

  /**
   * 🆕 載入 Stage 2 Prompt 配置
   * 優先級：COMPANY > GLOBAL > DEFAULT
   */
  private async loadPromptConfig(companyId?: string): Promise<{
    systemPrompt: string;
    userPrompt: string;
    source: 'COMPANY' | 'GLOBAL' | 'DEFAULT';
  }> {
    // 1. 嘗試 COMPANY 級配置
    if (companyId) {
      const companyConfig = await this.prisma.promptConfig.findFirst({
        where: {
          promptType: 'STAGE_2_FORMAT_ID',
          scope: 'COMPANY',
          companyId,
          isActive: true,
        },
      });
      if (companyConfig) {
        return {
          systemPrompt: companyConfig.systemPrompt,
          userPrompt: companyConfig.userPromptTemplate || 'Identify the format/template of this invoice image.',
          source: 'COMPANY',
        };
      }
    }

    // 2. 嘗試 GLOBAL 級配置
    const globalConfig = await this.prisma.promptConfig.findFirst({
      where: {
        promptType: 'STAGE_2_FORMAT_ID',
        scope: 'GLOBAL',
        isActive: true,
      },
    });
    if (globalConfig) {
      return {
        systemPrompt: globalConfig.systemPrompt,
        userPrompt: globalConfig.userPromptTemplate || 'Identify the format/template of this invoice image.',
        source: 'GLOBAL',
      };
    }

    // 3. 使用預設值
    return {
      systemPrompt: this.getDefaultSystemPrompt(),
      userPrompt: 'Identify the format/template of this invoice image.',
      source: 'DEFAULT',
    };
  }

  /**
   * 🆕 轉換格式配置為 Prompt 資訊（完整版）
   */
  private toFormatPattern(format: DocumentFormat): FormatPatternForPrompt {
    const identificationRules = format.identificationRules as any || {};

    return {
      formatId: format.id,
      formatName: format.name,
      documentType: format.documentType,
      documentSubtype: format.documentSubtype,
      patterns: format.features || [],
      keywords: format.commonTerms || [],

      // 🆕 完整使用 identificationRules
      logoPatterns: identificationRules.logoPatterns || [],
      layoutHints: identificationRules.layoutHints || undefined,
      priority: identificationRules.priority ?? 100,  // 預設 100
    };
  }

  /**
   * 🆕 組裝格式識別 Prompt（增強版）
   */
  private buildFormatIdentificationPrompt(config: {
    source: string;
    formats: FormatPatternForPrompt[];
    customSystemPrompt?: string;
  }): { system: string; user: string } {
    const hasKnownFormats = config.formats.length > 0;

    // 按 priority 排序（數字越小越優先）
    const sortedFormats = [...config.formats].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );

    // 組裝格式列表（包含完整識別規則）
    const formatList = sortedFormats.map((f, index) => {
      const lines = [
        `${index + 1}. ${f.formatName}`,
        `   - Keywords: ${f.keywords?.join(', ') || 'N/A'}`,
      ];

      if (f.logoPatterns && f.logoPatterns.length > 0) {
        const logoDesc = f.logoPatterns.map(l => l.description).join('; ');
        lines.push(`   - Logo: ${logoDesc}`);
      }

      if (f.layoutHints) {
        lines.push(`   - Layout: ${f.layoutHints}`);
      }

      return lines.join('\n');
    }).join('\n\n');

    const systemPrompt = config.customSystemPrompt || `You are an invoice format identification specialist.
Your task is to identify the format/template of this invoice.

${hasKnownFormats ? `Known formats (${config.source}, priority ordered):\n${formatList}` : 'No known formats - identify format characteristics from document.'}

Response format (JSON):
{
  "formatName": "string - identified format name",
  "confidence": number (0-100),
  "matchedKnownFormat": "string | null - if matched to known format",
  "formatCharacteristics": ["array of observed format characteristics"]
}`;

    return {
      system: systemPrompt,
      user: 'Identify the format/template of this invoice image.',
    };
  }
}
```

#### 2.3.3 智能路由服務

```typescript
// src/services/extraction-v3/confidence-v3-1.service.ts (修改)

export class ConfidenceV3_1Service {
  /**
   * 🆕 智能路由決策
   * 考慮 isNewCompany/isNewFormat 標記
   */
  getSmartReviewType(input: SmartRoutingInput): SmartRoutingOutput {
    // 新公司或新格式：強制完整審核
    if (input.isNewCompany || input.isNewFormat) {
      const reasons: string[] = [];
      if (input.isNewCompany) reasons.push('新公司');
      if (input.isNewFormat) reasons.push('新格式');

      return {
        reviewType: 'FULL_REVIEW',
        reason: `${reasons.join('、')}需要配置審核`,
        needsConfigReview: true,
      };
    }

    // 使用 DEFAULT 配置：建議完整審核
    if (input.configSource === 'DEFAULT') {
      return {
        reviewType: 'FULL_REVIEW',
        reason: '使用預設配置，建議審核',
        needsConfigReview: true,
      };
    }

    // 正常信心度路由
    if (input.overallConfidence >= 90) {
      return {
        reviewType: 'AUTO_APPROVE',
        reason: `信心度 ${input.overallConfidence}% ≥ 90%`,
        needsConfigReview: false,
      };
    }

    if (input.overallConfidence >= 70) {
      return {
        reviewType: 'QUICK_REVIEW',
        reason: `信心度 ${input.overallConfidence}% 在 70-89% 範圍`,
        needsConfigReview: false,
      };
    }

    return {
      reviewType: 'FULL_REVIEW',
      reason: `信心度 ${input.overallConfidence}% < 70%`,
      needsConfigReview: false,
    };
  }
}
```

### 2.4 UI 組件變更

#### 2.4.1 審核提示橫幅

```typescript
// src/components/features/invoice/detail/InvoiceDetailTabs.tsx (修改)

// 🆕 新公司/格式配置提示橫幅
{document.needsConfigReview && (
  <Alert className="mb-4" variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>{t('review.configNeeded.title')}</AlertTitle>
    <AlertDescription>
      {document.newCompanyDetected && (
        <p>{t('review.configNeeded.newCompany', { name: document.companyName })}</p>
      )}
      {document.newFormatDetected && (
        <p>{t('review.configNeeded.newFormat', { name: document.formatName })}</p>
      )}
      <Link href={`/companies/${document.companyId}/formats`} className="underline">
        {t('review.configNeeded.configureLink')}
      </Link>
    </AlertDescription>
  </Alert>
)}
```

---

## 3. 影響範圍評估

### 3.1 文件影響清單

#### 3.1.1 修改文件

| 文件路徑 | 影響程度 | 修改說明 | Phase |
|----------|----------|----------|-------|
| `prisma/schema.prisma` | 🟡 中 | 擴展 PromptType 枚舉 | 3 |
| `src/types/unified-processor.ts` | 🟡 中 | 新增標記欄位 | 1 |
| `src/types/extraction-v3.types.ts` | 🟡 中 | 擴展 FormatPatternForPrompt、新增智能路由類型 | 1, 4 |
| `src/services/extraction-v3/extraction-v3.service.ts` | 🟡 中 | 傳遞 isNew 標記到輸出 | 1 |
| `src/services/extraction-v3/stages/stage-1-company.service.ts` | 🟡 中 | Prompt 可配置化 | 3 |
| `src/services/extraction-v3/stages/stage-2-format.service.ts` | 🔴 高 | Prompt 可配置化 + 完整 identificationRules | 3, 4 |
| `src/services/extraction-v3/confidence-v3-1.service.ts` | 🟡 中 | 新增智能路由方法 | 2 |
| `src/services/processing-result-persistence.service.ts` | 🟡 中 | 使用智能路由 | 2 |
| `src/services/unified-processor/unified-document-processor.service.ts` | 🟡 中 | 標記傳遞 | 1 |
| `src/app/api/documents/[id]/route.ts` | 🟢 低 | 返回新標記欄位 | 1 |

#### 3.1.2 UI 組件影響

| 組件/頁面 | 影響程度 | 說明 | Phase |
|-----------|----------|------|-------|
| `InvoiceDetailTabs.tsx` | 🟡 中 | 新增配置提示橫幅 | 5 |
| `ReviewQueue.tsx` | 🟡 中 | 新增「需要配置」篩選器 | 5 |

#### 3.1.3 翻譯文件影響

| 文件路徑 | 說明 | Phase |
|----------|------|-------|
| `messages/en/invoices.json` | 新增 review.configNeeded 翻譯 | 5 |
| `messages/zh-TW/invoices.json` | 新增 review.configNeeded 翻譯 | 5 |
| `messages/zh-CN/invoices.json` | 新增 review.configNeeded 翻譯 | 5 |

### 3.2 向後兼容性

- **API 兼容**：新增欄位為可選，現有 API 調用不受影響
- **資料庫兼容**：PromptType 枚舉擴展不影響現有記錄
- **UI 兼容**：新增提示為條件渲染，不影響現有流程

---

## 4. 實施計劃

### 4.1 階段概覽

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              實施階段時間線                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1                 Phase 2                 Phase 3                     │
│  增強結果標記            智能路由邏輯            Prompt 可配置化             │
│  ──────────             ──────────              ──────────────               │
│  預計: 2-3 小時          預計: 1-2 小時          預計: 3-4 小時              │
│                                                                              │
│  • 類型定義擴展          • 智能路由方法          • 擴展 PromptType           │
│  • 傳遞 isNew 標記       • 結果持久化更新        • Stage 1 Prompt 載入       │
│  • API 返回新欄位                                • Stage 2 Prompt 載入       │
│                                                                              │
│                                    │                                         │
│                                    ▼                                         │
│                              Phase 4                 Phase 5                 │
│                              IdentificationRules     UI 提示                 │
│                              ─────────────────       ─────────               │
│                              預計: 2-3 小時          預計: 2-3 小時          │
│                                                                              │
│                              • 擴展 FormatPattern    • 配置提示橫幅          │
│                              • 完整 Rules 使用       • 篩選器更新            │
│                              • Prompt 組裝增強       • i18n 翻譯             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Phase 1: 增強結果標記（2-3 小時）

| # | 任務 | 文件 | 估計時間 |
|---|------|------|---------|
| 1.1 | 擴展 UnifiedProcessorOutput 類型 | `src/types/unified-processor.ts` | 0.5h |
| 1.2 | 新增智能路由類型定義 | `src/types/extraction-v3.types.ts` | 0.5h |
| 1.3 | 修改 extraction-v3 服務傳遞 isNew 標記 | `src/services/extraction-v3/extraction-v3.service.ts` | 1h |
| 1.4 | 修改 unified-processor 設置 needsConfigReview | `src/services/unified-processor/unified-document-processor.service.ts` | 0.5h |
| 1.5 | API 返回新欄位 | `src/app/api/documents/[id]/route.ts` | 0.5h |

### 4.3 Phase 2: 智能路由邏輯（1-2 小時）

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 2.1 | 實現 getSmartReviewType 方法 | `src/services/extraction-v3/confidence-v3-1.service.ts` | 1h | Phase 1 |
| 2.2 | 更新結果持久化使用智能路由 | `src/services/processing-result-persistence.service.ts` | 1h | 2.1 |

### 4.4 Phase 3: Stage 1 & 2 Prompt 可配置化（3-4 小時）

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 3.1 | 擴展 PromptType 枚舉 | `prisma/schema.prisma` | 0.5h | - |
| 3.2 | 執行資料庫遷移 | `prisma/` | 0.5h | 3.1 |
| 3.3 | Stage 1 loadPromptConfig 方法 | `src/services/extraction-v3/stages/stage-1-company.service.ts` | 1h | 3.2 |
| 3.4 | Stage 2 loadPromptConfig 方法 | `src/services/extraction-v3/stages/stage-2-format.service.ts` | 1.5h | 3.2 |

### 4.5 Phase 4: 完整使用 IdentificationRules（2-3 小時）

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 4.1 | 擴展 FormatPatternForPrompt 介面 | `src/types/extraction-v3.types.ts` | 0.5h | - |
| 4.2 | 修改 toFormatPattern 方法 | `src/services/extraction-v3/stages/stage-2-format.service.ts` | 1h | 4.1 |
| 4.3 | 增強 buildFormatIdentificationPrompt | `src/services/extraction-v3/stages/stage-2-format.service.ts` | 1.5h | 4.2 |

### 4.6 Phase 5: UI 提示與審核流程（2-3 小時）

| # | 任務 | 文件 | 估計時間 | 依賴 |
|---|------|------|---------|------|
| 5.1 | 新增配置提示橫幅 | `src/components/features/invoice/detail/InvoiceDetailTabs.tsx` | 1h | Phase 1-4 |
| 5.2 | 更新篩選器 | `src/components/features/review/ReviewQueue.tsx` | 1h | Phase 1-4 |
| 5.3 | 新增 i18n 翻譯 | `messages/*/invoices.json` | 1h | 5.1, 5.2 |

---

## 5. 風險評估

### 5.1 風險矩陣

| # | 風險 | 可能性 | 影響 | 風險等級 | 緩解措施 |
|---|------|--------|------|---------|----------|
| R1 | 新公司/格式處理結果品質低 | 中 | 中 | 🟡 中 | 強制 FULL_REVIEW，人工審核 |
| R2 | GLOBAL 預設 Prompt 不適用所有情況 | 中 | 中 | 🟡 中 | 提供 Prompt 調整指南 |
| R3 | 大量新公司文件導致審核積壓 | 低 | 中 | 🟢 低 | 批量審核工具、優先級排序 |
| R4 | IdentificationRules 資料不完整 | 中 | 低 | 🟢 低 | 向後兼容，缺失時使用預設 |
| R5 | 資料庫遷移失敗 | 低 | 高 | 🟡 中 | 測試環境先驗證 |

### 5.2 回滾計劃

```bash
# 階段 1-2 回滾（標記和路由邏輯）
# 移除新增欄位，恢復原信心度路由邏輯

# 階段 3 回滾（PromptType 枚舉）
# 保留枚舉擴展（不影響現有功能），恢復硬編碼 Prompt

# 階段 4-5 回滾（UI 更新）
# 移除條件渲染，恢復原 UI
```

---

## 6. 驗收標準

### 6.1 功能驗收

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|---------|--------|
| F1 | 新公司標記 | `isNewCompany` 正確設置 | P0 |
| F2 | 新格式標記 | `isNewFormat` 正確設置 | P0 |
| F3 | 智能路由 | 新公司/格式強制 FULL_REVIEW | P0 |
| F4 | Prompt 可配置 | Stage 1/2 從 PromptConfig 讀取 | P1 |
| F5 | IdentificationRules | 完整使用 logoPatterns、layoutHints、priority | P1 |
| F6 | UI 提示 | 顯示「需要配置」提示和連結 | P1 |
| F7 | 篩選器 | 支援按「需要配置」篩選 | P2 |

### 6.2 整合測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|---------|---------|
| T1 | 新公司文件 | 上傳未知公司的發票 | JIT 創建公司 → FULL_REVIEW → 顯示配置提示 |
| T2 | 新格式文件 | 上傳已知公司的新格式發票 | JIT 創建格式 → FULL_REVIEW → 顯示配置提示 |
| T3 | 完整配置公司 | 上傳有完整配置的發票 | 正常信心度路由 |
| T4 | 批量上傳 | 同時上傳 10 份新公司文件 | 全部處理 → 全部 FULL_REVIEW |
| T5 | Prompt 配置 | 在 PromptConfig 新增 STAGE_1_COMPANY_ID 記錄 | Stage 1 使用新 Prompt |

---

## 7. 相關文件

### 7.1 前置文件

| 文件 | 說明 |
|------|------|
| `CHANGE-024-three-stage-extraction-architecture.md` | V3.1 三階段提取架構 |
| `CHANGE-021-unified-processor-v3-pure-gpt-vision.md` | V3 純 GPT Vision 架構 |

### 7.2 參考文件

| 文件 | 說明 |
|------|------|
| `CLAUDE.md` | 三層映射系統設計理念 |
| `docs/02-architecture/` | 系統架構設計 |
| `src/types/extraction-v3.types.ts` | V3.1 類型定義 |

---

## 8. 待決事項

| # | 事項 | 狀態 | 優先級 | 預計決策時間 |
|---|------|------|--------|-------------|
| 1 | 確認 GLOBAL 預設 Prompt 內容 | ⏳ 待確認 | P1 | Phase 3 開始前 |
| 2 | 確認是否需要「配置嚮導」功能 | ⏳ 待確認 | P2 | Phase 5 後 |
| 3 | 確認批量審核工具需求 | ⏳ 待確認 | P2 | Phase 5 後 |

---

**文檔建立日期**: 2026-02-01
**作者**: AI Assistant (Claude)
**版本**: 1.0.0
**狀態**: 🚧 計劃準備中

### 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0.0 | 2026-02-01 | 初始版本 - 完整規劃文檔 |
