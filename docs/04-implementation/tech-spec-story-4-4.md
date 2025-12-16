# Tech Spec: Story 4-4 規則升級建議生成

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.4
- **Title**: 規則升級建議生成
- **Epic**: Epic 4 - 映射規則管理與自動學習

### 1.2 Story Description
作為系統，我希望在累計 3 次相同修正後建議規則升級，以便 Super User 可以審核並決定是否採納。

### 1.3 Dependencies
- **Story 4-3**: 修正模式記錄與分析（CorrectionPattern 模型、CANDIDATE 狀態）
- **Story 4-1**: 映射規則列表與查看（MappingRule 基礎模型）
- **Story 1-2**: 角色權限基礎（RULE_APPROVE 權限）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 自動生成建議 | RuleSuggestionGenerator + 規則推斷算法 + 影響計算 |
| AC2 | 通知與狀態 | NotificationService + 待審核列表 UI |

---

## 3. Architecture Overview

### 3.1 Rule Suggestion Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         規則升級建議生成系統                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Trigger Sources                               │   │
│  │                                                                       │   │
│  │  ┌───────────────────┐        ┌───────────────────┐                  │   │
│  │  │ Pattern Analysis  │        │ Manual Trigger    │                  │   │
│  │  │ (Story 4-3)       │        │ (Super User)      │                  │   │
│  │  │                   │        │                   │                  │   │
│  │  │ CANDIDATE Pattern │        │ Create Suggestion │                  │   │
│  │  │ (count >= 3)      │        │ from Pattern      │                  │   │
│  │  └─────────┬─────────┘        └─────────┬─────────┘                  │   │
│  │            │                            │                            │   │
│  │            └────────────┬───────────────┘                            │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    RuleSuggestionGenerator                            │   │
│  │                                                                       │   │
│  │  Step 1: Fetch Related Corrections                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ SELECT * FROM corrections                                        │ │   │
│  │  │ WHERE pattern_id = :patternId                                    │ │   │
│  │  │ ORDER BY corrected_at DESC LIMIT 10                              │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │  Step 2: Infer Best Rule                                             │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ RuleInferenceEngine                                              │ │   │
│  │  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │ │   │
│  │  │ │ Regex       │  │ Keyword     │  │ Position    │               │ │   │
│  │  │ │ Inference   │  │ Inference   │  │ Inference   │               │ │   │
│  │  │ └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │ │   │
│  │  │        │                │                │                       │ │   │
│  │  │        └────────────────┼────────────────┘                       │ │   │
│  │  │                         ▼                                        │ │   │
│  │  │                  Select Best Candidate                           │ │   │
│  │  │                  (Highest Confidence)                            │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │  Step 3: Calculate Expected Impact                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ ImpactCalculator                                                 │ │   │
│  │  │                                                                  │ │   │
│  │  │ • affectedDocuments: 查詢最近 30 天相關文件數量                      │ │   │
│  │  │ • estimatedImprovement: 預估準確率提升                              │ │   │
│  │  │ • potentialRisks: 識別潛在風險                                     │ │   │
│  │  │ • simulationResults: 模擬規則應用結果                               │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │  Step 4: Create RuleSuggestion Record                                │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ RuleSuggestion                                                   │ │   │
│  │  │ ┌─────────────────────────────────────────────────────────────┐ │ │   │
│  │  │ │ forwarderId     │ fieldName        │ extractionType         │ │ │   │
│  │  │ │ currentPattern  │ suggestedPattern │ source: AUTO_LEARNING  │ │ │   │
│  │  │ │ correctionCount │ expectedImpact   │ status: PENDING        │ │ │   │
│  │  │ └─────────────────────────────────────────────────────────────┘ │ │   │
│  │  │                                                                  │ │   │
│  │  │ SuggestionSample[] (最多 5 筆代表性案例)                           │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │  Step 5: Update Pattern Status                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ CorrectionPattern.status: CANDIDATE → SUGGESTED                  │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Notification Flow                             │   │
│  │                                                                       │   │
│  │  ┌───────────────────┐     ┌───────────────────┐                     │   │
│  │  │ Query Super Users │────▶│ Create In-App     │                     │   │
│  │  │ with RULE_APPROVE │     │ Notification      │                     │   │
│  │  └───────────────────┘     └─────────┬─────────┘                     │   │
│  │                                      │                               │   │
│  │                                      ▼                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Notification Content                                             │ │   │
│  │  │ • Title: "新的規則升級建議"                                         │ │   │
│  │  │ • Message: "系統發現 {fieldName} 欄位有 {count} 次相似修正..."       │ │   │
│  │  │ • ActionUrl: /rules/suggestions/{id}                             │ │   │
│  │  │ • Priority: high (AUTO_LEARNING source)                          │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Super User Interface                          │   │
│  │                                                                       │   │
│  │  /rules/suggestions                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 待審核建議列表                                                     │ │   │
│  │  │ ┌────────┬──────────┬─────────┬────────┬─────────┬───────────┐  │ │   │
│  │  │ │Forwarder│FieldName │ Source  │ Count  │ Created │  Actions  │  │ │   │
│  │  │ ├────────┼──────────┼─────────┼────────┼─────────┼───────────┤  │ │   │
│  │  │ │ DHL    │ inv_no   │🤖 Auto  │  5     │ 2 小時前 │ [查看]    │  │ │   │
│  │  │ │ FedEx  │ amount   │👤 Manual│  3     │ 1 天前  │ [查看]    │  │ │   │
│  │  │ └────────┴──────────┴─────────┴────────┴─────────┴───────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/
│   ├── api/
│   │   └── rules/
│   │       └── suggestions/
│   │           ├── route.ts                    # GET 建議列表 / POST 創建建議
│   │           ├── [id]/
│   │           │   └── route.ts                # GET/PATCH 建議詳情
│   │           └── generate/
│   │               └── route.ts                # POST 從 Pattern 生成建議
│   └── (dashboard)/
│       └── rules/
│           └── suggestions/
│               ├── page.tsx                    # 待審核建議列表頁
│               └── [id]/
│                   └── page.tsx                # 建議詳情頁
├── components/features/suggestions/
│   ├── SuggestionList.tsx                      # 建議列表組件
│   ├── SuggestionTable.tsx                     # 建議表格
│   ├── SuggestionCard.tsx                      # 建議卡片（詳情頁）
│   ├── SuggestionSourceBadge.tsx               # 來源標籤
│   ├── SuggestionStatusBadge.tsx               # 狀態標籤
│   ├── ImpactAnalysisCard.tsx                  # 影響分析卡片
│   ├── SampleCasesTable.tsx                    # 樣本案例表格
│   └── PatternPreview.tsx                      # 規則預覽
├── services/
│   ├── rule-suggestion-generator.ts            # 建議生成服務
│   └── rule-inference/
│       ├── index.ts                            # 規則推斷引擎
│       ├── regex-inferrer.ts                   # 正則推斷
│       ├── keyword-inferrer.ts                 # 關鍵字推斷
│       └── position-inferrer.ts                # 位置推斷
├── hooks/
│   ├── useSuggestionList.ts                    # 建議列表 Hook
│   └── useSuggestionDetail.ts                  # 建議詳情 Hook
└── types/
    └── suggestion.ts                           # 建議相關類型
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (Foundation)

#### 4.1.1 Prisma Schema 定義

**File**: `prisma/schema.prisma`

```prisma
// ===== 規則升級建議 =====

model RuleSuggestion {
  id               String           @id @default(uuid())
  forwarderId      String           @map("forwarder_id")
  fieldName        String           @map("field_name")
  extractionType   ExtractionType   @map("extraction_type")
  currentPattern   String?          @map("current_pattern")   // 現有規則（如果有）
  suggestedPattern String           @map("suggested_pattern") // 建議的規則
  confidence       Float            @default(0)               // 推斷信心度
  source           SuggestionSource @default(MANUAL)
  correctionCount  Int              @default(0) @map("correction_count")
  expectedImpact   Json?            @map("expected_impact")   // 預期影響分析
  status           SuggestionStatus @default(PENDING)
  priority         Int              @default(0)               // 優先級
  suggestedBy      String?          @map("suggested_by")      // null for AUTO
  reviewedBy       String?          @map("reviewed_by")
  reviewNotes      String?          @map("review_notes")
  rejectionReason  String?          @map("rejection_reason")
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")
  reviewedAt       DateTime?        @map("reviewed_at")

  forwarder     Forwarder          @relation(fields: [forwarderId], references: [id])
  suggester     User?              @relation("Suggester", fields: [suggestedBy], references: [id])
  reviewer      User?              @relation("Reviewer", fields: [reviewedBy], references: [id])
  pattern       CorrectionPattern? @relation(fields: [patternId], references: [id])
  patternId     String?            @unique @map("pattern_id")
  sampleCases   SuggestionSample[]
  createdRule   MappingRule?       @relation("CreatedFromSuggestion")

  @@index([forwarderId, fieldName])
  @@index([status])
  @@index([source])
  @@index([createdAt])
  @@map("rule_suggestions")
}

enum SuggestionSource {
  MANUAL          // 手動建議
  AUTO_LEARNING   // 自動學習
  IMPORT          // 導入
}

enum SuggestionStatus {
  PENDING         // 待審核
  APPROVED        // 已批准
  REJECTED        // 已拒絕
  IMPLEMENTED     // 已實施
}

// ===== 建議樣本案例 =====

model SuggestionSample {
  id             String   @id @default(uuid())
  suggestionId   String   @map("suggestion_id")
  documentId     String   @map("document_id")
  originalValue  String   @map("original_value")
  correctedValue String   @map("corrected_value")
  extractedValue String?  @map("extracted_value")  // 使用建議規則提取的值
  matchesExpected Boolean? @map("matches_expected") // 是否符合預期
  createdAt      DateTime @default(now()) @map("created_at")

  suggestion RuleSuggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  document   Document       @relation(fields: [documentId], references: [id])

  @@index([suggestionId])
  @@map("suggestion_samples")
}

// 擴展 MappingRule 以追蹤來源建議
model MappingRule {
  // ... existing fields ...

  // 添加建議來源追蹤
  suggestionId String?        @unique @map("suggestion_id")
  suggestion   RuleSuggestion? @relation("CreatedFromSuggestion", fields: [suggestionId], references: [id])
}
```

---

### Phase 2: Type Definitions (AC1, AC2)

**File**: `src/types/suggestion.ts`

```typescript
import { ExtractionType, SuggestionSource, SuggestionStatus } from '@prisma/client'

// ===== 預期影響類型 =====

export interface ExpectedImpact {
  affectedDocuments: number       // 受影響文件數
  estimatedImprovement: number    // 預估準確率提升（百分比）
  currentAccuracy: number | null  // 當前準確率（如果有現有規則）
  predictedAccuracy: number       // 預測準確率
  potentialRisks: RiskItem[]      // 潛在風險
  simulationSummary: {
    tested: number                // 測試文件數
    matched: number               // 匹配成功數
    improved: number              // 改善數
    degraded: number              // 退化數
  }
}

export interface RiskItem {
  type: 'false_positive' | 'false_negative' | 'format_change' | 'coverage_gap'
  severity: 'low' | 'medium' | 'high'
  description: string
  affectedCount?: number
}

// ===== 推斷規則類型 =====

export interface InferredRule {
  type: ExtractionType
  pattern: string
  confidence: number
  explanation: string
  alternatives?: InferredRule[]
}

// ===== 建議列表類型 =====

export interface SuggestionListItem {
  id: string
  forwarder: {
    id: string
    name: string
    code: string
  }
  fieldName: string
  extractionType: ExtractionType
  source: SuggestionSource
  correctionCount: number
  status: SuggestionStatus
  confidence: number
  priority: number
  suggestedBy: {
    id: string
    name: string
  } | null
  createdAt: string
  hasExistingRule: boolean
}

export interface SuggestionsQueryParams {
  forwarderId?: string
  fieldName?: string
  status?: SuggestionStatus
  source?: SuggestionSource
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'correctionCount' | 'confidence' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

export interface SuggestionsListResponse {
  success: true
  data: {
    suggestions: SuggestionListItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    summary: {
      totalSuggestions: number
      pendingSuggestions: number
      autoLearningSuggestions: number
      manualSuggestions: number
    }
  }
}

// ===== 建議詳情類型 =====

export interface SuggestionDetail {
  id: string
  forwarder: {
    id: string
    name: string
    code: string
    logoUrl?: string
  }
  fieldName: string
  extractionType: ExtractionType
  currentPattern: string | null
  suggestedPattern: string
  confidence: number
  source: SuggestionSource
  correctionCount: number
  expectedImpact: ExpectedImpact | null
  status: SuggestionStatus
  priority: number
  suggestedBy: {
    id: string
    name: string
    email: string
  } | null
  reviewedBy: {
    id: string
    name: string
    email: string
  } | null
  reviewNotes: string | null
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
  sampleCases: SuggestionSampleCase[]
  pattern: {
    id: string
    occurrenceCount: number
    firstSeenAt: string
  } | null
  existingRule: {
    id: string
    version: number
    status: string
  } | null
}

export interface SuggestionSampleCase {
  id: string
  documentId: string
  documentName: string
  originalValue: string
  correctedValue: string
  extractedValue: string | null
  matchesExpected: boolean | null
}

// ===== 創建建議請求 =====

export interface CreateSuggestionRequest {
  forwarderId: string
  fieldName: string
  extractionType: ExtractionType
  suggestedPattern: string
  explanation?: string
}

export interface GenerateSuggestionRequest {
  patternId: string
}

// ===== 來源與狀態配置 =====

export const SUGGESTION_SOURCES: {
  value: SuggestionSource
  label: string
  icon: string
  description: string
}[] = [
  {
    value: 'AUTO_LEARNING',
    label: '自動學習',
    icon: 'Bot',
    description: '系統根據修正模式自動生成'
  },
  {
    value: 'MANUAL',
    label: '手動建議',
    icon: 'User',
    description: 'Super User 手動創建'
  },
  {
    value: 'IMPORT',
    label: '導入',
    icon: 'Upload',
    description: '從外部系統導入'
  }
]

export const SUGGESTION_STATUSES: {
  value: SuggestionStatus
  label: string
  color: string
  description: string
}[] = [
  {
    value: 'PENDING',
    label: '待審核',
    color: 'warning',
    description: '等待 Super User 審核'
  },
  {
    value: 'APPROVED',
    label: '已批准',
    color: 'success',
    description: '已批准，等待實施'
  },
  {
    value: 'REJECTED',
    label: '已拒絕',
    color: 'destructive',
    description: '審核後拒絕'
  },
  {
    value: 'IMPLEMENTED',
    label: '已實施',
    color: 'info',
    description: '已創建或更新規則'
  }
]
```

---

### Phase 3: Rule Inference Engine (AC1)

#### 4.3.1 規則推斷引擎主入口

**File**: `src/services/rule-inference/index.ts`

```typescript
import { ExtractionType } from '@prisma/client'
import { InferredRule } from '@/types/suggestion'
import { inferRegexPattern } from './regex-inferrer'
import { inferKeywordPattern } from './keyword-inferrer'
import { inferPositionPattern } from './position-inferrer'

interface CorrectionSample {
  originalValue: string
  correctedValue: string
  context?: {
    pageNumber?: number
    boundingBox?: { x: number; y: number; width: number; height: number }
    surroundingText?: string
  }
}

/**
 * 規則推斷引擎
 * 根據修正樣本推斷最佳的提取規則
 */
export class RuleInferenceEngine {
  /**
   * 推斷最佳規則
   */
  async inferBestRule(samples: CorrectionSample[]): Promise<InferredRule> {
    if (samples.length === 0) {
      throw new Error('No samples provided for rule inference')
    }

    // 獲取所有候選規則
    const candidates = await this.getAllCandidates(samples)

    // 按信心度排序
    candidates.sort((a, b) => b.confidence - a.confidence)

    // 返回最佳候選，並附上替代方案
    const best = candidates[0]
    if (candidates.length > 1) {
      best.alternatives = candidates.slice(1, 4) // 最多 3 個替代方案
    }

    return best
  }

  /**
   * 獲取所有候選規則
   */
  private async getAllCandidates(samples: CorrectionSample[]): Promise<InferredRule[]> {
    const candidates: InferredRule[] = []

    // 嘗試正則推斷
    const regexCandidate = await inferRegexPattern(samples)
    if (regexCandidate) {
      candidates.push(regexCandidate)
    }

    // 嘗試關鍵字推斷
    const keywordCandidate = await inferKeywordPattern(samples)
    if (keywordCandidate) {
      candidates.push(keywordCandidate)
    }

    // 嘗試位置推斷（需要上下文）
    const samplesWithContext = samples.filter(s => s.context?.boundingBox)
    if (samplesWithContext.length >= 2) {
      const positionCandidate = await inferPositionPattern(samplesWithContext)
      if (positionCandidate) {
        candidates.push(positionCandidate)
      }
    }

    // 如果沒有候選，返回默認的 AI_PROMPT 類型
    if (candidates.length === 0) {
      candidates.push({
        type: 'AI_PROMPT',
        pattern: this.generateDefaultPrompt(samples),
        confidence: 0.5,
        explanation: '無法推斷明確規則，建議使用 AI 提取'
      })
    }

    return candidates
  }

  /**
   * 生成默認 AI 提示詞
   */
  private generateDefaultPrompt(samples: CorrectionSample[]): string {
    const correctedValues = samples.map(s => s.correctedValue)
    const commonPattern = this.findCommonPattern(correctedValues)

    return JSON.stringify({
      instruction: `提取符合以下模式的值: ${commonPattern}`,
      examples: samples.slice(0, 3).map(s => ({
        input: s.originalValue,
        output: s.correctedValue
      }))
    })
  }

  /**
   * 尋找共同模式描述
   */
  private findCommonPattern(values: string[]): string {
    // 簡單的模式描述
    const hasNumbers = values.every(v => /\d/.test(v))
    const hasLetters = values.every(v => /[a-zA-Z]/.test(v))
    const avgLength = Math.round(values.reduce((sum, v) => sum + v.length, 0) / values.length)

    const parts: string[] = []
    if (hasNumbers && hasLetters) {
      parts.push('字母數字混合')
    } else if (hasNumbers) {
      parts.push('純數字')
    } else if (hasLetters) {
      parts.push('純字母')
    }
    parts.push(`約 ${avgLength} 字元`)

    return parts.join('，')
  }
}

export const ruleInferenceEngine = new RuleInferenceEngine()
```

#### 4.3.2 正則模式推斷

**File**: `src/services/rule-inference/regex-inferrer.ts`

```typescript
import { ExtractionType } from '@prisma/client'
import { InferredRule } from '@/types/suggestion'

interface Sample {
  originalValue: string
  correctedValue: string
}

/**
 * 正則模式推斷
 * 嘗試從修正值中推斷正則表達式模式
 */
export async function inferRegexPattern(samples: Sample[]): Promise<InferredRule | null> {
  const correctedValues = samples.map(s => s.correctedValue)

  // 嘗試不同的模式推斷策略
  const strategies = [
    inferInvoiceNumberPattern,
    inferDatePattern,
    inferAmountPattern,
    inferCodePattern,
    inferGenericPattern
  ]

  for (const strategy of strategies) {
    const result = strategy(correctedValues)
    if (result && result.confidence >= 0.7) {
      return {
        type: 'REGEX',
        ...result
      }
    }
  }

  return null
}

/**
 * 發票號碼模式推斷
 */
function inferInvoiceNumberPattern(values: string[]): { pattern: string; confidence: number; explanation: string } | null {
  // 常見發票號碼格式
  const patterns = [
    { regex: /^[A-Z]{2,3}-\d{6,10}$/, desc: '前綴-數字 (如: INV-123456)' },
    { regex: /^[A-Z]{1,3}\d{6,12}$/, desc: '前綴數字 (如: INV123456)' },
    { regex: /^\d{8,14}$/, desc: '純數字 (如: 20241215001)' },
    { regex: /^[A-Z]{2}\d{2}[A-Z]\d{6,8}$/, desc: '台灣統一發票格式' }
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter(v => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `發票號碼格式: ${desc}`
      }
    }
  }

  return null
}

/**
 * 日期模式推斷
 */
function inferDatePattern(values: string[]): { pattern: string; confidence: number; explanation: string } | null {
  const patterns = [
    { regex: /^\d{4}-\d{2}-\d{2}$/, desc: 'ISO 日期 (YYYY-MM-DD)' },
    { regex: /^\d{2}\/\d{2}\/\d{4}$/, desc: '日期 (DD/MM/YYYY)' },
    { regex: /^\d{4}\/\d{2}\/\d{2}$/, desc: '日期 (YYYY/MM/DD)' },
    { regex: /^\d{8}$/, desc: '壓縮日期 (YYYYMMDD)' }
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter(v => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `日期格式: ${desc}`
      }
    }
  }

  return null
}

/**
 * 金額模式推斷
 */
function inferAmountPattern(values: string[]): { pattern: string; confidence: number; explanation: string } | null {
  const patterns = [
    { regex: /^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/, desc: '美元格式 (如: $1,234.56)' },
    { regex: /^\d{1,3}(,\d{3})*(\.\d{2})?\s*(USD|EUR|GBP|TWD|CNY)$/, desc: '金額含幣別' },
    { regex: /^\d+(\.\d{2})?$/, desc: '純數字金額' }
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter(v => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `金額格式: ${desc}`
      }
    }
  }

  return null
}

/**
 * 代碼模式推斷（貨櫃號、提單號等）
 */
function inferCodePattern(values: string[]): { pattern: string; confidence: number; explanation: string } | null {
  const patterns = [
    { regex: /^[A-Z]{4}\d{7}$/, desc: '貨櫃號 (如: ABCD1234567)' },
    { regex: /^[A-Z]{3,5}\d{9,12}$/, desc: '追蹤號' },
    { regex: /^[A-Z0-9]{10,20}$/, desc: '通用代碼' }
  ]

  for (const { regex, desc } of patterns) {
    const matchCount = values.filter(v => regex.test(v)).length
    const matchRate = matchCount / values.length

    if (matchRate >= 0.8) {
      return {
        pattern: regex.source,
        confidence: matchRate,
        explanation: `代碼格式: ${desc}`
      }
    }
  }

  return null
}

/**
 * 通用模式推斷
 * 嘗試從值中提取共同的結構模式
 */
function inferGenericPattern(values: string[]): { pattern: string; confidence: number; explanation: string } | null {
  if (values.length < 2) return null

  // 分析字符類型分佈
  const structures = values.map(v => {
    return v.replace(/[A-Z]/g, 'A')
            .replace(/[a-z]/g, 'a')
            .replace(/\d/g, '0')
            .replace(/[^Aa0]/g, 'X')
  })

  // 找出最常見的結構
  const structureCount = new Map<string, number>()
  for (const s of structures) {
    structureCount.set(s, (structureCount.get(s) || 0) + 1)
  }

  let maxCount = 0
  let commonStructure = ''
  for (const [structure, count] of structureCount) {
    if (count > maxCount) {
      maxCount = count
      commonStructure = structure
    }
  }

  const matchRate = maxCount / values.length

  if (matchRate >= 0.7 && commonStructure.length >= 3) {
    // 將結構轉換為正則
    const pattern = commonStructure
      .replace(/A+/g, (m) => `[A-Z]{${m.length}}`)
      .replace(/a+/g, (m) => `[a-z]{${m.length}}`)
      .replace(/0+/g, (m) => `\\d{${m.length}}`)
      .replace(/X/g, '.')

    return {
      pattern: `^${pattern}$`,
      confidence: matchRate * 0.8, // 降低一些信心度因為是推斷的
      explanation: `推斷的通用模式（結構: ${commonStructure}）`
    }
  }

  return null
}
```

#### 4.3.3 關鍵字模式推斷

**File**: `src/services/rule-inference/keyword-inferrer.ts`

```typescript
import { ExtractionType } from '@prisma/client'
import { InferredRule } from '@/types/suggestion'

interface Sample {
  originalValue: string
  correctedValue: string
}

/**
 * 關鍵字模式推斷
 * 分析原始值和修正值之間的關係，推斷關鍵字提取規則
 */
export async function inferKeywordPattern(samples: Sample[]): Promise<InferredRule | null> {
  // 分析修正模式
  const transformations = samples.map(s => analyzeTransformation(s.originalValue, s.correctedValue))

  // 檢查是否有一致的轉換模式
  const consistentTransform = findConsistentTransformation(transformations)

  if (!consistentTransform) {
    return null
  }

  // 生成關鍵字規則
  const keywordConfig = generateKeywordConfig(consistentTransform, samples)

  return {
    type: 'KEYWORD',
    pattern: JSON.stringify(keywordConfig),
    confidence: consistentTransform.confidence,
    explanation: consistentTransform.description
  }
}

interface Transformation {
  type: 'prefix_removal' | 'suffix_removal' | 'format_change' | 'extraction' | 'unknown'
  removedPrefix?: string
  removedSuffix?: string
  extractedPattern?: string
  confidence: number
  description: string
}

/**
 * 分析單一修正的轉換類型
 */
function analyzeTransformation(original: string, corrected: string): Transformation {
  // 檢查前綴移除
  if (original.endsWith(corrected)) {
    const prefix = original.slice(0, -corrected.length)
    return {
      type: 'prefix_removal',
      removedPrefix: prefix,
      confidence: 0.9,
      description: `移除前綴: "${prefix}"`
    }
  }

  // 檢查後綴移除
  if (original.startsWith(corrected)) {
    const suffix = original.slice(corrected.length)
    return {
      type: 'suffix_removal',
      removedSuffix: suffix,
      confidence: 0.9,
      description: `移除後綴: "${suffix}"`
    }
  }

  // 檢查修正值是否為原始值的子串
  if (original.includes(corrected)) {
    return {
      type: 'extraction',
      extractedPattern: corrected,
      confidence: 0.8,
      description: `從原始值中提取: "${corrected}"`
    }
  }

  // 檢查格式變更（如移除分隔符）
  const normalizedOriginal = original.replace(/[-\s_.]/g, '')
  const normalizedCorrected = corrected.replace(/[-\s_.]/g, '')
  if (normalizedOriginal === normalizedCorrected ||
      normalizedOriginal.includes(normalizedCorrected)) {
    return {
      type: 'format_change',
      confidence: 0.85,
      description: '格式標準化（移除分隔符）'
    }
  }

  return {
    type: 'unknown',
    confidence: 0,
    description: '無法識別轉換模式'
  }
}

/**
 * 找出一致的轉換模式
 */
function findConsistentTransformation(transforms: Transformation[]): Transformation | null {
  if (transforms.length === 0) return null

  // 按類型分組
  const byType = new Map<string, Transformation[]>()
  for (const t of transforms) {
    const existing = byType.get(t.type) || []
    existing.push(t)
    byType.set(t.type, existing)
  }

  // 找出最常見且有意義的類型
  let bestType: string | null = null
  let bestCount = 0

  for (const [type, items] of byType) {
    if (type !== 'unknown' && items.length > bestCount) {
      bestCount = items.length
      bestType = type
    }
  }

  if (!bestType || bestCount / transforms.length < 0.7) {
    return null
  }

  const items = byType.get(bestType)!
  const representative = items[0]

  return {
    ...representative,
    confidence: (bestCount / transforms.length) * representative.confidence
  }
}

interface KeywordConfig {
  type: 'keyword'
  rules: {
    action: string
    value?: string
    pattern?: string
  }[]
}

/**
 * 生成關鍵字配置
 */
function generateKeywordConfig(transform: Transformation, samples: Sample[]): KeywordConfig {
  const rules: KeywordConfig['rules'] = []

  switch (transform.type) {
    case 'prefix_removal':
      rules.push({
        action: 'remove_prefix',
        value: transform.removedPrefix
      })
      break

    case 'suffix_removal':
      rules.push({
        action: 'remove_suffix',
        value: transform.removedSuffix
      })
      break

    case 'format_change':
      rules.push({
        action: 'normalize',
        pattern: '[-\\s_.]'
      })
      break

    case 'extraction':
      // 嘗試找出提取模式
      const extractionPattern = findExtractionPattern(samples)
      if (extractionPattern) {
        rules.push({
          action: 'extract',
          pattern: extractionPattern
        })
      }
      break
  }

  return { type: 'keyword', rules }
}

/**
 * 找出提取模式
 */
function findExtractionPattern(samples: Sample[]): string | null {
  // 簡化實現：找出修正值在原始值中的位置模式
  const positions = samples.map(s => {
    const idx = s.originalValue.indexOf(s.correctedValue)
    const beforeChar = idx > 0 ? s.originalValue[idx - 1] : '^'
    const afterChar = idx + s.correctedValue.length < s.originalValue.length
      ? s.originalValue[idx + s.correctedValue.length]
      : '$'
    return { beforeChar, afterChar }
  })

  // 檢查是否有一致的邊界字符
  const beforeChars = new Set(positions.map(p => p.beforeChar))
  const afterChars = new Set(positions.map(p => p.afterChar))

  if (beforeChars.size === 1 && afterChars.size === 1) {
    const before = positions[0].beforeChar
    const after = positions[0].afterChar
    return `(?<=${before === '^' ? '' : escapeRegex(before)}).*?(?=${after === '$' ? '' : escapeRegex(after)})`
  }

  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

---

### Phase 4: Core Services (AC1, AC2)

#### 4.4.1 建議生成服務

**File**: `src/services/rule-suggestion-generator.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { ExtractionType, SuggestionStatus, PatternStatus } from '@prisma/client'
import { ruleInferenceEngine } from './rule-inference'
import { notificationService } from './notification'
import { InferredRule, ExpectedImpact, RiskItem } from '@/types/suggestion'
import { PERMISSIONS } from '@/lib/permissions'

interface GenerationResult {
  suggestionId: string
  inferredRule: InferredRule
  impact: ExpectedImpact
}

/**
 * 規則建議生成服務
 * 從 CANDIDATE 狀態的修正模式生成規則升級建議
 */
export class RuleSuggestionGenerator {
  /**
   * 從修正模式生成建議
   */
  async generateFromPattern(patternId: string): Promise<GenerationResult> {
    // 1. 獲取模式及相關修正
    const pattern = await prisma.correctionPattern.findUnique({
      where: { id: patternId },
      include: {
        forwarder: true,
        corrections: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true
              }
            }
          },
          orderBy: { correctedAt: 'desc' },
          take: 10
        }
      }
    })

    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`)
    }

    if (pattern.status !== 'CANDIDATE') {
      throw new Error(`Pattern ${patternId} is not in CANDIDATE status`)
    }

    // 檢查是否已有建議
    const existingSuggestion = await prisma.ruleSuggestion.findUnique({
      where: { patternId }
    })

    if (existingSuggestion) {
      throw new Error(`Suggestion already exists for pattern ${patternId}`)
    }

    // 2. 推斷最佳規則
    const samples = pattern.corrections.map(c => ({
      originalValue: c.originalValue || '',
      correctedValue: c.correctedValue,
      context: c.extractionContext as any
    }))

    const inferredRule = await ruleInferenceEngine.inferBestRule(samples)

    // 3. 獲取現有規則（如果有）
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        forwarderId: pattern.forwarderId,
        fieldName: pattern.fieldName,
        status: 'ACTIVE'
      }
    })

    // 4. 計算預期影響
    const impact = await this.calculateImpact(
      pattern.forwarderId,
      pattern.fieldName,
      inferredRule,
      existingRule?.pattern || null
    )

    // 5. 創建建議記錄
    const suggestion = await prisma.ruleSuggestion.create({
      data: {
        forwarderId: pattern.forwarderId,
        fieldName: pattern.fieldName,
        extractionType: inferredRule.type,
        currentPattern: existingRule?.pattern || null,
        suggestedPattern: inferredRule.pattern,
        confidence: inferredRule.confidence,
        source: 'AUTO_LEARNING',
        correctionCount: pattern.occurrenceCount,
        expectedImpact: impact as any,
        status: 'PENDING',
        priority: this.calculatePriority(pattern.occurrenceCount, inferredRule.confidence),
        patternId: pattern.id,
        sampleCases: {
          create: pattern.corrections.slice(0, 5).map(c => ({
            documentId: c.document.id,
            originalValue: c.originalValue || '',
            correctedValue: c.correctedValue
          }))
        }
      }
    })

    // 6. 更新模式狀態
    await prisma.correctionPattern.update({
      where: { id: pattern.id },
      data: { status: 'SUGGESTED' }
    })

    // 7. 發送通知
    await this.notifySuperUsers(suggestion.id, pattern.fieldName, pattern.occurrenceCount)

    return {
      suggestionId: suggestion.id,
      inferredRule,
      impact
    }
  }

  /**
   * 批量處理 CANDIDATE 模式
   */
  async processAllCandidates(): Promise<{
    processed: number
    succeeded: number
    failed: number
    errors: string[]
  }> {
    const candidates = await prisma.correctionPattern.findMany({
      where: {
        status: 'CANDIDATE',
        suggestion: null // 尚未生成建議
      },
      orderBy: { occurrenceCount: 'desc' },
      take: 50 // 批次處理上限
    })

    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const candidate of candidates) {
      try {
        await this.generateFromPattern(candidate.id)
        succeeded++
      } catch (error) {
        failed++
        errors.push(`Pattern ${candidate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      processed: candidates.length,
      succeeded,
      failed,
      errors
    }
  }

  /**
   * 計算預期影響
   */
  private async calculateImpact(
    forwarderId: string,
    fieldName: string,
    rule: InferredRule,
    currentPattern: string | null
  ): Promise<ExpectedImpact> {
    // 查詢最近 30 天的相關文件
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const documents = await prisma.document.findMany({
      where: {
        forwarderId,
        createdAt: { gte: thirtyDaysAgo }
      },
      include: {
        extractedFields: {
          where: { fieldName }
        },
        corrections: {
          where: { fieldName }
        }
      },
      take: 100
    })

    // 計算當前準確率
    let currentAccuracy: number | null = null
    if (currentPattern) {
      const totalWithCorrections = documents.filter(d => d.corrections.length > 0).length
      const totalDocuments = documents.length
      if (totalDocuments > 0) {
        currentAccuracy = ((totalDocuments - totalWithCorrections) / totalDocuments) * 100
      }
    }

    // 模擬新規則應用
    const simulationResults = await this.simulateRule(documents, rule, fieldName)

    // 識別潛在風險
    const potentialRisks = this.identifyRisks(documents, rule, simulationResults)

    // 預測準確率
    const predictedAccuracy = simulationResults.tested > 0
      ? (simulationResults.matched / simulationResults.tested) * 100
      : rule.confidence * 100

    // 計算預估改善
    const estimatedImprovement = currentAccuracy !== null
      ? predictedAccuracy - currentAccuracy
      : predictedAccuracy - 80 // 假設基準為 80%

    return {
      affectedDocuments: documents.length,
      estimatedImprovement: Math.max(0, estimatedImprovement),
      currentAccuracy,
      predictedAccuracy,
      potentialRisks,
      simulationSummary: simulationResults
    }
  }

  /**
   * 模擬規則應用
   */
  private async simulateRule(
    documents: any[],
    rule: InferredRule,
    fieldName: string
  ): Promise<{
    tested: number
    matched: number
    improved: number
    degraded: number
  }> {
    let tested = 0
    let matched = 0
    let improved = 0
    let degraded = 0

    for (const doc of documents) {
      const correction = doc.corrections[0]
      if (!correction) continue

      tested++

      // 嘗試使用新規則提取
      const extracted = this.tryExtract(rule, correction.originalValue || '')

      if (extracted === correction.correctedValue) {
        matched++
        improved++
      } else if (extracted === doc.extractedFields[0]?.value) {
        // 與現有結果相同
      } else if (extracted) {
        // 提取到了不同的值
        degraded++
      }
    }

    return { tested, matched, improved, degraded }
  }

  /**
   * 嘗試使用規則提取
   */
  private tryExtract(rule: InferredRule, value: string): string | null {
    try {
      switch (rule.type) {
        case 'REGEX':
          const regex = new RegExp(rule.pattern)
          const match = value.match(regex)
          return match ? match[0] : null

        case 'KEYWORD':
          const config = JSON.parse(rule.pattern)
          let result = value
          for (const r of config.rules) {
            if (r.action === 'remove_prefix' && result.startsWith(r.value)) {
              result = result.slice(r.value.length)
            } else if (r.action === 'remove_suffix' && result.endsWith(r.value)) {
              result = result.slice(0, -r.value.length)
            }
          }
          return result

        default:
          return null
      }
    } catch {
      return null
    }
  }

  /**
   * 識別潛在風險
   */
  private identifyRisks(
    documents: any[],
    rule: InferredRule,
    simulation: { degraded: number; tested: number }
  ): RiskItem[] {
    const risks: RiskItem[] = []

    // 檢查退化率
    if (simulation.tested > 0 && simulation.degraded / simulation.tested > 0.1) {
      risks.push({
        type: 'false_positive',
        severity: 'high',
        description: `${Math.round(simulation.degraded / simulation.tested * 100)}% 的測試案例可能產生錯誤結果`,
        affectedCount: simulation.degraded
      })
    }

    // 檢查低信心度
    if (rule.confidence < 0.7) {
      risks.push({
        type: 'coverage_gap',
        severity: 'medium',
        description: `規則信心度較低 (${Math.round(rule.confidence * 100)}%)，可能無法覆蓋所有情況`
      })
    }

    // 檢查規則類型風險
    if (rule.type === 'AI_PROMPT') {
      risks.push({
        type: 'format_change',
        severity: 'low',
        description: 'AI 提取規則可能產生不一致的結果格式'
      })
    }

    return risks
  }

  /**
   * 計算優先級
   */
  private calculatePriority(occurrenceCount: number, confidence: number): number {
    // 基於出現次數和信心度計算優先級
    // 高出現次數 + 高信心度 = 高優先級
    const countScore = Math.min(occurrenceCount / 10, 1) * 50
    const confidenceScore = confidence * 50
    return Math.round(countScore + confidenceScore)
  }

  /**
   * 通知 Super Users
   */
  private async notifySuperUsers(
    suggestionId: string,
    fieldName: string,
    correctionCount: number
  ): Promise<void> {
    await notificationService.notifySuperUsers({
      type: 'RULE_SUGGESTION',
      title: '新的規則升級建議',
      message: `系統發現「${fieldName}」欄位有 ${correctionCount} 次相似修正，已自動生成規則升級建議。`,
      actionUrl: `/rules/suggestions/${suggestionId}`,
      actionLabel: '查看建議',
      priority: 'high'
    })
  }
}

export const ruleSuggestionGenerator = new RuleSuggestionGenerator()
```

---

### Phase 5: API Layer (AC1, AC2)

#### 4.5.1 建議列表與創建 API

**File**: `src/app/api/rules/suggestions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { SuggestionStatus, SuggestionSource } from '@prisma/client'
import { z } from 'zod'

// GET /api/rules/suggestions - 獲取建議列表
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      }
    }, { status: 401 })
  }

  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_VIEW permission required'
      }
    }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const forwarderId = searchParams.get('forwarderId') || undefined
    const fieldName = searchParams.get('fieldName') || undefined
    const status = searchParams.get('status') as SuggestionStatus | undefined
    const source = searchParams.get('source') as SuggestionSource | undefined
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const sortBy = (searchParams.get('sortBy') as string) || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    const where: any = {}
    if (forwarderId) where.forwarderId = forwarderId
    if (fieldName) {
      where.fieldName = { contains: fieldName, mode: 'insensitive' }
    }
    if (status) where.status = status
    if (source) where.source = source

    const skip = (page - 1) * pageSize

    const orderBy: any = {}
    if (sortBy === 'correctionCount') {
      orderBy.correctionCount = sortOrder
    } else if (sortBy === 'confidence') {
      orderBy.confidence = sortOrder
    } else if (sortBy === 'priority') {
      orderBy.priority = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [suggestions, total, summary] = await Promise.all([
      prisma.ruleSuggestion.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          forwarder: {
            select: { id: true, name: true, code: true }
          },
          suggester: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.ruleSuggestion.count({ where }),
      prisma.ruleSuggestion.groupBy({
        by: ['status', 'source'],
        _count: { id: true }
      })
    ])

    // 檢查每個建議是否有現有規則
    const suggestionWithRules = await Promise.all(
      suggestions.map(async (s) => {
        const existingRule = await prisma.mappingRule.findFirst({
          where: {
            forwarderId: s.forwarderId,
            fieldName: s.fieldName,
            status: 'ACTIVE'
          },
          select: { id: true }
        })

        return {
          id: s.id,
          forwarder: s.forwarder,
          fieldName: s.fieldName,
          extractionType: s.extractionType,
          source: s.source,
          correctionCount: s.correctionCount,
          status: s.status,
          confidence: s.confidence,
          priority: s.priority,
          suggestedBy: s.suggester,
          createdAt: s.createdAt.toISOString(),
          hasExistingRule: !!existingRule
        }
      })
    )

    const statusCounts = summary.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + s._count.id
      return acc
    }, {} as Record<string, number>)

    const sourceCounts = summary.reduce((acc, s) => {
      acc[s.source] = (acc[s.source] || 0) + s._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        suggestions: suggestionWithRules,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        },
        summary: {
          totalSuggestions: total,
          pendingSuggestions: statusCounts['PENDING'] || 0,
          autoLearningSuggestions: sourceCounts['AUTO_LEARNING'] || 0,
          manualSuggestions: sourceCounts['MANUAL'] || 0
        }
      }
    })

  } catch (error) {
    console.error('Failed to fetch suggestions:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch suggestions'
      }
    }, { status: 500 })
  }
}

// 創建建議請求驗證
const createSuggestionSchema = z.object({
  forwarderId: z.string().uuid(),
  fieldName: z.string().min(1),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  suggestedPattern: z.string().min(1),
  explanation: z.string().optional()
})

// POST /api/rules/suggestions - 手動創建建議
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      }
    }, { status: 401 })
  }

  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_MANAGE permission required'
      }
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = createSuggestionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors
        }
      }, { status: 400 })
    }

    const { forwarderId, fieldName, extractionType, suggestedPattern, explanation } = parsed.data

    // 檢查 Forwarder 是否存在
    const forwarder = await prisma.forwarder.findUnique({
      where: { id: forwarderId }
    })

    if (!forwarder) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Forwarder ${forwarderId} not found`
        }
      }, { status: 404 })
    }

    // 獲取現有規則
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        forwarderId,
        fieldName,
        status: 'ACTIVE'
      }
    })

    // 創建建議
    const suggestion = await prisma.ruleSuggestion.create({
      data: {
        forwarderId,
        fieldName,
        extractionType,
        currentPattern: existingRule?.pattern || null,
        suggestedPattern,
        confidence: 1, // 手動建議默認信心度為 1
        source: 'MANUAL',
        status: 'PENDING',
        priority: 50, // 手動建議默認優先級
        suggestedBy: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: suggestion.id,
        status: suggestion.status,
        createdAt: suggestion.createdAt.toISOString()
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to create suggestion:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to create suggestion'
      }
    }, { status: 500 })
  }
}
```

#### 4.5.2 從模式生成建議 API

**File**: `src/app/api/rules/suggestions/generate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { ruleSuggestionGenerator } from '@/services/rule-suggestion-generator'
import { z } from 'zod'

const generateSchema = z.object({
  patternId: z.string().uuid()
})

// POST /api/rules/suggestions/generate - 從模式生成建議
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      }
    }, { status: 401 })
  }

  const hasPermission = session.user.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!hasPermission) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'RULE_MANAGE permission required'
      }
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = generateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors
        }
      }, { status: 400 })
    }

    const { patternId } = parsed.data

    const result = await ruleSuggestionGenerator.generateFromPattern(patternId)

    return NextResponse.json({
      success: true,
      data: {
        suggestionId: result.suggestionId,
        inferredRule: result.inferredRule,
        impact: result.impact
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to generate suggestion:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404
      : message.includes('not in CANDIDATE') ? 400
      : message.includes('already exists') ? 409
      : 500

    return NextResponse.json({
      success: false,
      error: {
        type: status === 404 ? 'not_found'
          : status === 400 ? 'bad_request'
          : status === 409 ? 'conflict'
          : 'internal_error',
        title: status === 404 ? 'Not Found'
          : status === 400 ? 'Bad Request'
          : status === 409 ? 'Conflict'
          : 'Internal Server Error',
        status,
        detail: message
      }
    }, { status })
  }
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/services/rule-inference.test.ts`

```typescript
import { ruleInferenceEngine } from '@/services/rule-inference'
import { inferRegexPattern } from '@/services/rule-inference/regex-inferrer'
import { inferKeywordPattern } from '@/services/rule-inference/keyword-inferrer'

describe('Rule Inference Engine', () => {
  describe('inferBestRule', () => {
    it('should infer regex pattern for invoice numbers', async () => {
      const samples = [
        { originalValue: 'INV-123456', correctedValue: 'INV123456' },
        { originalValue: 'INV-234567', correctedValue: 'INV234567' },
        { originalValue: 'INV-345678', correctedValue: 'INV345678' }
      ]

      const result = await ruleInferenceEngine.inferBestRule(samples)

      expect(result.type).toBe('KEYWORD')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('should infer regex pattern for dates', async () => {
      const samples = [
        { originalValue: '2024-01-15', correctedValue: '2024-01-15' },
        { originalValue: '2024-02-20', correctedValue: '2024-02-20' },
        { originalValue: '2024-03-25', correctedValue: '2024-03-25' }
      ]

      const result = await ruleInferenceEngine.inferBestRule(samples)

      expect(result.type).toBe('REGEX')
      expect(result.pattern).toContain('\\d')
    })
  })
})

describe('Regex Inferrer', () => {
  it('should detect invoice number pattern', async () => {
    const samples = [
      { originalValue: '', correctedValue: 'INV123456' },
      { originalValue: '', correctedValue: 'INV234567' },
      { originalValue: '', correctedValue: 'INV345678' }
    ]

    const result = await inferRegexPattern(samples)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('REGEX')
    expect(result?.confidence).toBeGreaterThan(0.7)
  })

  it('should detect date pattern', async () => {
    const samples = [
      { originalValue: '', correctedValue: '2024-01-15' },
      { originalValue: '', correctedValue: '2024-02-20' },
      { originalValue: '', correctedValue: '2024-03-25' }
    ]

    const result = await inferRegexPattern(samples)

    expect(result).not.toBeNull()
    expect(result?.explanation).toContain('日期')
  })
})

describe('Keyword Inferrer', () => {
  it('should detect prefix removal', async () => {
    const samples = [
      { originalValue: 'PREFIX-123', correctedValue: '123' },
      { originalValue: 'PREFIX-456', correctedValue: '456' },
      { originalValue: 'PREFIX-789', correctedValue: '789' }
    ]

    const result = await inferKeywordPattern(samples)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('KEYWORD')
    expect(result?.explanation).toContain('前綴')
  })
})
```

### 5.2 Integration Tests

**File**: `tests/integration/rule-suggestion.test.ts`

```typescript
import { ruleSuggestionGenerator } from '@/services/rule-suggestion-generator'
import { prisma } from '@/lib/prisma'

describe('Rule Suggestion Generator', () => {
  let testPatternId: string

  beforeAll(async () => {
    // 創建測試數據
    const pattern = await prisma.correctionPattern.create({
      data: {
        forwarderId: 'test-forwarder-id',
        fieldName: 'invoice_number',
        patternHash: 'test-hash',
        originalPattern: 'INV-123456',
        correctedPattern: 'INV123456',
        occurrenceCount: 5,
        status: 'CANDIDATE'
      }
    })
    testPatternId = pattern.id

    // 創建關聯的修正記錄
    await prisma.correction.createMany({
      data: [
        {
          documentId: 'test-doc-1',
          fieldId: 'test-field',
          fieldName: 'invoice_number',
          originalValue: 'INV-123456',
          correctedValue: 'INV123456',
          correctionType: 'NORMAL',
          correctedBy: 'test-user',
          patternId: pattern.id
        },
        // ... more test corrections
      ]
    })
  })

  afterAll(async () => {
    await prisma.ruleSuggestion.deleteMany({
      where: { patternId: testPatternId }
    })
    await prisma.correction.deleteMany({
      where: { patternId: testPatternId }
    })
    await prisma.correctionPattern.delete({
      where: { id: testPatternId }
    })
  })

  it('should generate suggestion from CANDIDATE pattern', async () => {
    const result = await ruleSuggestionGenerator.generateFromPattern(testPatternId)

    expect(result.suggestionId).toBeDefined()
    expect(result.inferredRule.confidence).toBeGreaterThan(0)
    expect(result.impact.affectedDocuments).toBeGreaterThanOrEqual(0)
  })

  it('should update pattern status to SUGGESTED', async () => {
    const pattern = await prisma.correctionPattern.findUnique({
      where: { id: testPatternId }
    })

    expect(pattern?.status).toBe('SUGGESTED')
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 自動生成建議
  - [ ] 相同模式修正達到 3 次時觸發
  - [ ] 自動生成規則升級建議
  - [ ] 包含建議的新規則
  - [ ] 包含基於的修正案例（最多 5 筆）
  - [ ] 包含預期影響分析

- [ ] **AC2**: 通知與狀態
  - [ ] 通知有 RULE_APPROVE 權限的 Super User
  - [ ] 建議狀態設為 PENDING
  - [ ] 待審核列表正確顯示
  - [ ] 來源標記正確（AUTO_LEARNING / MANUAL）

### 6.2 Technical Verification

- [ ] RuleSuggestion 模型正確創建
- [ ] 規則推斷引擎覆蓋多種類型
- [ ] 影響計算邏輯正確
- [ ] API 響應符合 RFC 7807 格式
- [ ] 通知服務正確調用

### 6.3 UI/UX Verification

- [ ] 待審核列表正確顯示
- [ ] 來源圖標區分清晰
- [ ] 優先級排序正確
- [ ] 載入狀態顯示

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 添加 RuleSuggestion、SuggestionSample |
| `src/types/suggestion.ts` | Create | 建議相關類型定義 |
| `src/services/rule-inference/index.ts` | Create | 規則推斷引擎主入口 |
| `src/services/rule-inference/regex-inferrer.ts` | Create | 正則模式推斷 |
| `src/services/rule-inference/keyword-inferrer.ts` | Create | 關鍵字模式推斷 |
| `src/services/rule-inference/position-inferrer.ts` | Create | 位置模式推斷 |
| `src/services/rule-suggestion-generator.ts` | Create | 建議生成服務 |
| `src/app/api/rules/suggestions/route.ts` | Create | 建議列表 API |
| `src/app/api/rules/suggestions/[id]/route.ts` | Create | 建議詳情 API |
| `src/app/api/rules/suggestions/generate/route.ts` | Create | 生成建議 API |
| `src/hooks/useSuggestionList.ts` | Create | 建議列表 Hook |
| `src/hooks/useSuggestionDetail.ts` | Create | 建議詳情 Hook |
| `src/app/(dashboard)/rules/suggestions/page.tsx` | Create | 待審核列表頁 |
| `src/components/features/suggestions/*.tsx` | Create | 建議相關組件 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 4-4-rule-upgrade-suggestion-generation*
