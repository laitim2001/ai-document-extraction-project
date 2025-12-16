# Story 2.5: 信心度評分計算

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 為每個提取結果計算信心度評分,
**So that** 可以識別需要人工審核的項目。

---

## Acceptance Criteria

### AC1: 欄位信心度計算

**Given** 欄位映射完成
**When** 系統計算信心度
**Then** 為每個欄位計算 0-100% 的信心度分數
**And** 計算整體文件的平均信心度

### AC2: 信心度分類顯示

**Given** 信心度計算完成
**When** 結果返回
**Then** 欄位按信心度分類：
- 高信心 (>=90%)：綠色
- 中信心 (70-89%)：黃色
- 低信心 (<70%)：紅色

### AC3: 信心度計算因素

**Given** 信心度計算因素
**When** 評估欄位
**Then** 考慮以下因素：
- OCR 識別清晰度
- 規則匹配精確度
- 數據格式驗證結果
- 歷史修正頻率

---

## Tasks / Subtasks

- [ ] **Task 1: 信心度計算模組** (AC: #1, #3)
  - [ ] 1.1 創建 `src/lib/confidence/calculator.ts`
  - [ ] 1.2 實現單欄位信心度計算
  - [ ] 1.3 實現整體信心度計算
  - [ ] 1.4 定義計算因素權重

- [ ] **Task 2: OCR 清晰度評估** (AC: #3)
  - [ ] 2.1 解析 Azure DI 的 confidence 分數
  - [ ] 2.2 實現清晰度評分邏輯
  - [ ] 2.3 處理低清晰度區域

- [ ] **Task 3: 規則匹配評估** (AC: #3)
  - [ ] 3.1 評估正則匹配的精確度
  - [ ] 3.2 評估多規則衝突情況
  - [ ] 3.3 計算規則可靠性分數

- [ ] **Task 4: 格式驗證** (AC: #3)
  - [ ] 4.1 實現數據格式驗證（日期、金額、email 等）
  - [ ] 4.2 實現業務規則驗證
  - [ ] 4.3 格式錯誤降低信心度

- [ ] **Task 5: 歷史修正分析** (AC: #3)
  - [ ] 5.1 查詢該欄位的歷史修正率
  - [ ] 5.2 查詢該 Forwarder 的修正率
  - [ ] 5.3 根據歷史調整信心度

- [ ] **Task 6: 信心度閾值配置** (AC: #2)
  - [ ] 6.1 創建 `src/lib/confidence/thresholds.ts`
  - [ ] 6.2 定義高/中/低信心度閾值
  - [ ] 6.3 支援閾值配置調整

- [ ] **Task 7: 信心度 API** (AC: #1, #2)
  - [ ] 7.1 更新 mapping API 加入信心度
  - [ ] 7.2 創建信心度查詢端點
  - [ ] 7.3 返回分類後的結果

- [ ] **Task 8: 信心度顯示組件** (AC: #2)
  - [ ] 8.1 創建 `ConfidenceBadge.tsx` 組件
  - [ ] 8.2 實現顏色編碼（綠/黃/紅）
  - [ ] 8.3 顯示數值和分類

- [ ] **Task 9: 驗證與測試** (AC: #1-3)
  - [ ] 9.1 測試信心度計算準確性
  - [ ] 9.2 測試分類顯示
  - [ ] 9.3 測試各因素影響

---

## Dev Notes

### 依賴項

- **Story 2.4**: 欄位映射結果

### Architecture Compliance

#### 信心度計算模組

```typescript
// src/lib/confidence/calculator.ts
import { CONFIDENCE_THRESHOLDS } from './thresholds'

interface ConfidenceFactors {
  ocrConfidence: number      // Azure DI 的 confidence 分數
  ruleMatchScore: number     // 規則匹配精確度
  formatValidation: number   // 格式驗證結果
  historicalAccuracy: number // 歷史準確率
}

interface ConfidenceResult {
  score: number              // 0-100
  level: 'high' | 'medium' | 'low'
  factors: ConfidenceFactors
  color: string
}

const FACTOR_WEIGHTS = {
  ocrConfidence: 0.3,
  ruleMatchScore: 0.3,
  formatValidation: 0.25,
  historicalAccuracy: 0.15,
}

export function calculateFieldConfidence(
  factors: Partial<ConfidenceFactors>
): ConfidenceResult {
  const normalizedFactors: ConfidenceFactors = {
    ocrConfidence: factors.ocrConfidence ?? 80,
    ruleMatchScore: factors.ruleMatchScore ?? 70,
    formatValidation: factors.formatValidation ?? 100,
    historicalAccuracy: factors.historicalAccuracy ?? 85,
  }

  const score = Object.entries(FACTOR_WEIGHTS).reduce((acc, [key, weight]) => {
    return acc + normalizedFactors[key as keyof ConfidenceFactors] * weight
  }, 0)

  const level = getConfidenceLevel(score)
  const color = CONFIDENCE_THRESHOLDS[level].color

  return { score, level, factors: normalizedFactors, color }
}

export function calculateDocumentConfidence(
  fieldConfidences: number[]
): ConfidenceResult {
  const score = fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length
  const level = getConfidenceLevel(score)
  const color = CONFIDENCE_THRESHOLDS[level].color

  return {
    score,
    level,
    factors: {} as ConfidenceFactors,
    color
  }
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.high.min) return 'high'
  if (score >= CONFIDENCE_THRESHOLDS.medium.min) return 'medium'
  return 'low'
}
```

#### 信心度閾值配置

```typescript
// src/lib/confidence/thresholds.ts
export const CONFIDENCE_THRESHOLDS = {
  high: {
    min: 90,
    label: '高信心',
    color: '#22c55e', // green-500
    description: '可自動通過',
  },
  medium: {
    min: 70,
    label: '中信心',
    color: '#eab308', // yellow-500
    description: '需快速確認',
  },
  low: {
    min: 0,
    label: '低信心',
    color: '#ef4444', // red-500
    description: '需完整審核',
  },
} as const

export type ConfidenceLevel = keyof typeof CONFIDENCE_THRESHOLDS

// 分流閾值
export const ROUTING_THRESHOLDS = {
  autoApprove: 95,    // >= 95% 自動通過
  quickReview: 80,    // 80-94% 快速確認
  fullReview: 0,      // < 80% 完整審核
}
```

#### ConfidenceBadge 組件

```typescript
// src/components/features/review/ConfidenceBadge.tsx
import { Badge } from '@/components/ui/badge'
import { CONFIDENCE_THRESHOLDS } from '@/lib/confidence/thresholds'

interface ConfidenceBadgeProps {
  score: number
  showValue?: boolean
}

export function ConfidenceBadge({ score, showValue = true }: ConfidenceBadgeProps) {
  const level = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low'
  const config = CONFIDENCE_THRESHOLDS[level]

  return (
    <Badge
      style={{ backgroundColor: config.color }}
      className="text-white"
    >
      {showValue ? `${Math.round(score)}%` : config.label}
    </Badge>
  )
}
```

#### 更新 ExtractionResult Schema

```prisma
model ExtractionResult {
  // ... 現有欄位
  confidenceScores Json? @map("confidence_scores")
  // confidenceScores: {
  //   overall: { score, level, color },
  //   fields: { [fieldName]: { score, level, factors } }
  // }
  overallConfidence Float? @map("overall_confidence")
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 單欄位計算 | 正確計算 0-100 分數 |
| 整體計算 | 正確計算平均信心度 |
| 分類顯示 | 正確顯示顏色編碼 |
| 因素權重 | 各因素正確影響結果 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-25]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR7]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.5 |
| Story Key | 2-5-confidence-score-calculation |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR7 |
| Dependencies | Story 2.4 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
