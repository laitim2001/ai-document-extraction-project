# Story 2-5: Confidence Score Calculation - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-5-confidence-score-calculation

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.5 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Medium |
| Dependencies | Story 2.4 (Field mapping results) |
| Blocking | Story 2.6, 2.7 |
| FR Coverage | FR7 |

---

## Objective

Implement a multi-factor confidence scoring system that evaluates extraction quality for each field and the overall document. The system considers OCR clarity, rule match precision, format validation, and historical accuracy to produce scores that guide the review routing process.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Field confidence calculation | Multi-factor weighted scoring (0-100%) |
| AC2 | Color-coded classification | Green (≥90%), Yellow (70-89%), Red (<70%) |
| AC3 | Confidence factors | OCR, rule match, validation, historical |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Confidence Scoring Pipeline                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Input Factors                                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │   │
│  │  │   OCR    │ │  Rule    │ │  Format  │ │     Historical       │ │   │
│  │  │Confidence│ │  Match   │ │Validation│ │     Accuracy         │ │   │
│  │  │  (30%)   │ │  (30%)   │ │  (25%)   │ │       (15%)          │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │               Weighted Score Calculator                           │   │
│  │              score = Σ(factor × weight)                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                 ┌──────────────────┼──────────────────┐                 │
│                 ▼                  ▼                  ▼                 │
│          ┌──────────┐       ┌──────────┐       ┌──────────┐           │
│          │   HIGH   │       │  MEDIUM  │       │   LOW    │           │
│          │  ≥ 90%   │       │  70-89%  │       │  < 70%   │           │
│          │  🟢      │       │   🟡     │       │   🔴     │           │
│          └──────────┘       └──────────┘       └──────────┘           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Phase 1: Confidence Types & Thresholds (10 min)

#### Step 1.1: Create Confidence Types

Create `src/types/confidence.ts`:

```typescript
/**
 * Confidence scoring type definitions
 */

/**
 * Confidence levels for classification
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * Individual confidence factors
 */
export interface ConfidenceFactors {
  /** OCR recognition clarity score (0-100) */
  ocrConfidence: number

  /** Rule matching precision score (0-100) */
  ruleMatchScore: number

  /** Format validation result score (0-100) */
  formatValidation: number

  /** Historical accuracy for this field/forwarder (0-100) */
  historicalAccuracy: number
}

/**
 * Complete confidence result for a field
 */
export interface FieldConfidenceResult {
  /** Final weighted score (0-100) */
  score: number

  /** Confidence level classification */
  level: ConfidenceLevel

  /** Individual factor scores */
  factors: ConfidenceFactors

  /** Display color for UI */
  color: string

  /** Factor contributions breakdown */
  breakdown: {
    factor: keyof ConfidenceFactors
    weight: number
    rawScore: number
    contribution: number
  }[]
}

/**
 * Document-level confidence summary
 */
export interface DocumentConfidenceResult {
  /** Overall document score (0-100) */
  overallScore: number

  /** Overall confidence level */
  level: ConfidenceLevel

  /** Display color */
  color: string

  /** Field-level breakdown */
  fieldScores: Record<string, FieldConfidenceResult>

  /** Statistics */
  stats: {
    totalFields: number
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
    averageScore: number
    minScore: number
    maxScore: number
  }

  /** Processing recommendation */
  recommendation: 'auto_approve' | 'quick_review' | 'full_review'
}

/**
 * Threshold configuration
 */
export interface ConfidenceThreshold {
  min: number
  label: string
  labelZh: string
  color: string
  bgColor: string
  description: string
}
```

#### Step 1.2: Create Confidence Thresholds

Create `src/lib/confidence/thresholds.ts`:

```typescript
/**
 * Confidence threshold configuration
 */

import type { ConfidenceLevel, ConfidenceThreshold } from '@/types/confidence'

/**
 * Confidence level thresholds and styling
 */
export const CONFIDENCE_THRESHOLDS: Record<ConfidenceLevel, ConfidenceThreshold> = {
  high: {
    min: 90,
    label: 'High Confidence',
    labelZh: '高信心',
    color: '#22c55e',      // green-500
    bgColor: '#dcfce7',    // green-100
    description: 'Can be auto-approved'
  },
  medium: {
    min: 70,
    label: 'Medium Confidence',
    labelZh: '中信心',
    color: '#eab308',      // yellow-500
    bgColor: '#fef9c3',    // yellow-100
    description: 'Needs quick review'
  },
  low: {
    min: 0,
    label: 'Low Confidence',
    labelZh: '低信心',
    color: '#ef4444',      // red-500
    bgColor: '#fee2e2',    // red-100
    description: 'Requires full review'
  }
} as const

/**
 * Processing path routing thresholds
 */
export const ROUTING_THRESHOLDS = {
  /** Auto-approve when overall score >= 95% */
  autoApprove: 95,

  /** Quick review when score is 80-94% */
  quickReview: 80,

  /** Full review when score < 80% */
  fullReview: 0
} as const

/**
 * Factor weights for confidence calculation
 * Must sum to 1.0
 */
export const FACTOR_WEIGHTS = {
  /** OCR recognition clarity weight */
  ocrConfidence: 0.30,

  /** Rule matching precision weight */
  ruleMatchScore: 0.30,

  /** Format validation result weight */
  formatValidation: 0.25,

  /** Historical accuracy weight */
  historicalAccuracy: 0.15
} as const

/**
 * Default factor values when not available
 */
export const DEFAULT_FACTORS = {
  ocrConfidence: 80,
  ruleMatchScore: 70,
  formatValidation: 100,  // Assume valid if not checked
  historicalAccuracy: 85  // Assume good history if no data
} as const

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high.min) return 'high'
  if (score >= CONFIDENCE_THRESHOLDS.medium.min) return 'medium'
  return 'low'
}

/**
 * Get color for confidence score
 */
export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score)
  return CONFIDENCE_THRESHOLDS[level].color
}

/**
 * Get processing recommendation from score
 */
export function getProcessingRecommendation(
  score: number
): 'auto_approve' | 'quick_review' | 'full_review' {
  if (score >= ROUTING_THRESHOLDS.autoApprove) return 'auto_approve'
  if (score >= ROUTING_THRESHOLDS.quickReview) return 'quick_review'
  return 'full_review'
}
```

---

### Phase 2: Confidence Calculator (25 min)

#### Step 2.1: Create Calculator Module

Create `src/lib/confidence/calculator.ts`:

```typescript
/**
 * Confidence score calculator
 * Implements multi-factor weighted scoring
 */

import type {
  ConfidenceFactors,
  FieldConfidenceResult,
  DocumentConfidenceResult,
  ConfidenceLevel
} from '@/types/confidence'
import type { FieldMapping, FieldMappings } from '@/types/field-mapping'
import {
  CONFIDENCE_THRESHOLDS,
  FACTOR_WEIGHTS,
  DEFAULT_FACTORS,
  getConfidenceLevel,
  getProcessingRecommendation
} from './thresholds'

/**
 * Calculate confidence score for a single field
 */
export function calculateFieldConfidence(
  fieldMapping: FieldMapping,
  historicalData?: { accuracy: number; sampleSize: number }
): FieldConfidenceResult {
  // Gather factors
  const factors = gatherFactors(fieldMapping, historicalData)

  // Calculate weighted score
  const breakdown = Object.entries(FACTOR_WEIGHTS).map(([factor, weight]) => {
    const rawScore = factors[factor as keyof ConfidenceFactors]
    return {
      factor: factor as keyof ConfidenceFactors,
      weight,
      rawScore,
      contribution: rawScore * weight
    }
  })

  const score = breakdown.reduce((sum, item) => sum + item.contribution, 0)
  const level = getConfidenceLevel(score)

  return {
    score: Math.round(score * 100) / 100,
    level,
    factors,
    color: CONFIDENCE_THRESHOLDS[level].color,
    breakdown
  }
}

/**
 * Gather confidence factors from field mapping data
 */
function gatherFactors(
  fieldMapping: FieldMapping,
  historicalData?: { accuracy: number; sampleSize: number }
): ConfidenceFactors {
  // OCR Confidence: from extraction confidence
  const ocrConfidence = fieldMapping.isEmpty
    ? 0
    : fieldMapping.confidence || DEFAULT_FACTORS.ocrConfidence

  // Rule Match Score: based on extraction method
  const ruleMatchScore = calculateRuleMatchScore(fieldMapping)

  // Format Validation: based on validation result
  const formatValidation = calculateFormatValidationScore(fieldMapping)

  // Historical Accuracy: from historical data or default
  const historicalAccuracy = historicalData
    ? adjustByHistoricalData(historicalData)
    : DEFAULT_FACTORS.historicalAccuracy

  return {
    ocrConfidence: Math.min(100, Math.max(0, ocrConfidence)),
    ruleMatchScore: Math.min(100, Math.max(0, ruleMatchScore)),
    formatValidation: Math.min(100, Math.max(0, formatValidation)),
    historicalAccuracy: Math.min(100, Math.max(0, historicalAccuracy))
  }
}

/**
 * Calculate rule match score based on extraction method
 */
function calculateRuleMatchScore(fieldMapping: FieldMapping): number {
  if (fieldMapping.isEmpty) return 0

  const methodScores: Record<string, number> = {
    azure_field: 95,    // Azure DI pre-extracted
    regex: 85,          // Regex match
    keyword: 70,        // Keyword extraction
    position: 65,       // Position-based
    default: 50         // Default value used
  }

  const baseScore = methodScores[fieldMapping.method] || 60

  // Bonus for having a rule ID (not default/fallback)
  const ruleBonus = fieldMapping.ruleId ? 5 : 0

  return baseScore + ruleBonus
}

/**
 * Calculate format validation score
 */
function calculateFormatValidationScore(fieldMapping: FieldMapping): number {
  if (fieldMapping.isEmpty) return 0

  // Start with 100 (valid)
  let score = 100

  // Reduce if validation failed
  if (!fieldMapping.isValid) {
    score -= 40
  }

  // Reduce if validation error exists
  if (fieldMapping.validationError) {
    score -= 20
  }

  // Check for empty value (extracted but null)
  if (fieldMapping.value === null && !fieldMapping.isEmpty) {
    score -= 30
  }

  return Math.max(0, score)
}

/**
 * Adjust score based on historical data
 */
function adjustByHistoricalData(
  historicalData: { accuracy: number; sampleSize: number }
): number {
  const { accuracy, sampleSize } = historicalData

  // Weight historical data by sample size (more samples = more confidence in the accuracy)
  const sampleWeight = Math.min(1, sampleSize / 100)  // Max out at 100 samples

  // Blend historical accuracy with default
  return (
    accuracy * sampleWeight +
    DEFAULT_FACTORS.historicalAccuracy * (1 - sampleWeight)
  )
}

/**
 * Calculate confidence for entire document
 */
export function calculateDocumentConfidence(
  fieldMappings: FieldMappings,
  historicalData?: Record<string, { accuracy: number; sampleSize: number }>
): DocumentConfidenceResult {
  const fieldScores: Record<string, FieldConfidenceResult> = {}
  const scores: number[] = []

  // Calculate confidence for each field
  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const fieldHistory = historicalData?.[fieldName]
    const result = calculateFieldConfidence(mapping, fieldHistory)
    fieldScores[fieldName] = result
    scores.push(result.score)
  }

  // Calculate overall score (average of non-empty fields)
  const nonEmptyScores = Object.entries(fieldMappings)
    .filter(([_, m]) => !m.isEmpty)
    .map(([name]) => fieldScores[name].score)

  const averageScore = nonEmptyScores.length > 0
    ? nonEmptyScores.reduce((a, b) => a + b, 0) / nonEmptyScores.length
    : 0

  // Classify fields by confidence level
  const stats = {
    totalFields: Object.keys(fieldMappings).length,
    highConfidence: Object.values(fieldScores).filter(s => s.level === 'high').length,
    mediumConfidence: Object.values(fieldScores).filter(s => s.level === 'medium').length,
    lowConfidence: Object.values(fieldScores).filter(s => s.level === 'low').length,
    averageScore: Math.round(averageScore * 100) / 100,
    minScore: scores.length > 0 ? Math.min(...scores) : 0,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0
  }

  // Determine overall level
  const overallLevel = getConfidenceLevel(averageScore)

  return {
    overallScore: stats.averageScore,
    level: overallLevel,
    color: CONFIDENCE_THRESHOLDS[overallLevel].color,
    fieldScores,
    stats,
    recommendation: getProcessingRecommendation(averageScore)
  }
}

/**
 * Calculate confidence with penalty for critical fields
 */
export function calculateWeightedDocumentConfidence(
  fieldMappings: FieldMappings,
  criticalFields: string[],
  historicalData?: Record<string, { accuracy: number; sampleSize: number }>
): DocumentConfidenceResult {
  const baseResult = calculateDocumentConfidence(fieldMappings, historicalData)

  // Apply penalty for low-confidence critical fields
  let penalty = 0
  for (const fieldName of criticalFields) {
    const fieldScore = baseResult.fieldScores[fieldName]
    if (fieldScore && fieldScore.level === 'low') {
      penalty += 5  // 5% penalty per low-confidence critical field
    } else if (fieldScore && fieldScore.level === 'medium') {
      penalty += 2  // 2% penalty per medium-confidence critical field
    }
  }

  const adjustedScore = Math.max(0, baseResult.overallScore - penalty)
  const adjustedLevel = getConfidenceLevel(adjustedScore)

  return {
    ...baseResult,
    overallScore: adjustedScore,
    level: adjustedLevel,
    color: CONFIDENCE_THRESHOLDS[adjustedLevel].color,
    recommendation: getProcessingRecommendation(adjustedScore)
  }
}
```

---

### Phase 3: Historical Accuracy Service (20 min)

#### Step 3.1: Add Historical Data Model

Update `prisma/schema.prisma`:

```prisma
// ===========================================
// Historical Accuracy Tracking
// ===========================================

model FieldCorrectionHistory {
  id                String   @id @default(uuid())
  forwarderId       String?  @map("forwarder_id")
  fieldName         String   @map("field_name")

  // Statistics
  totalExtractions  Int      @default(0) @map("total_extractions")
  correctExtractions Int     @default(0) @map("correct_extractions")
  accuracy          Float    @default(100) // Percentage

  // Period tracking
  periodStart       DateTime @map("period_start")
  periodEnd         DateTime @map("period_end")

  // Timestamps
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  forwarder         Forwarder? @relation(fields: [forwarderId], references: [id])

  @@unique([forwarderId, fieldName, periodStart])
  @@index([forwarderId])
  @@index([fieldName])
  @@map("field_correction_history")
}
```

#### Step 3.2: Create Historical Service

Create `src/services/historical-accuracy.service.ts`:

```typescript
/**
 * Historical accuracy service
 * Tracks and retrieves field accuracy statistics
 */

import { prisma } from '@/lib/prisma'

/**
 * Get historical accuracy for a field/forwarder combination
 */
export async function getHistoricalAccuracy(
  fieldName: string,
  forwarderId?: string | null
): Promise<{ accuracy: number; sampleSize: number } | null> {
  // Get last 30 days of data
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const history = await prisma.fieldCorrectionHistory.findFirst({
    where: {
      fieldName,
      forwarderId: forwarderId ?? null,
      periodStart: { gte: thirtyDaysAgo }
    },
    orderBy: { periodEnd: 'desc' }
  })

  if (!history) return null

  return {
    accuracy: history.accuracy,
    sampleSize: history.totalExtractions
  }
}

/**
 * Get historical accuracy for all fields of a forwarder
 */
export async function getForwarderFieldAccuracy(
  forwarderId?: string | null
): Promise<Record<string, { accuracy: number; sampleSize: number }>> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const histories = await prisma.fieldCorrectionHistory.findMany({
    where: {
      forwarderId: forwarderId ?? null,
      periodStart: { gte: thirtyDaysAgo }
    },
    orderBy: { periodEnd: 'desc' }
  })

  const result: Record<string, { accuracy: number; sampleSize: number }> = {}

  for (const history of histories) {
    if (!result[history.fieldName]) {
      result[history.fieldName] = {
        accuracy: history.accuracy,
        sampleSize: history.totalExtractions
      }
    }
  }

  return result
}

/**
 * Record a field correction
 */
export async function recordFieldCorrection(
  fieldName: string,
  forwarderId: string | null,
  wasCorrect: boolean
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Upsert daily record
  const existing = await prisma.fieldCorrectionHistory.findFirst({
    where: {
      fieldName,
      forwarderId,
      periodStart: today
    }
  })

  if (existing) {
    const newTotal = existing.totalExtractions + 1
    const newCorrect = existing.correctExtractions + (wasCorrect ? 1 : 0)
    const newAccuracy = (newCorrect / newTotal) * 100

    await prisma.fieldCorrectionHistory.update({
      where: { id: existing.id },
      data: {
        totalExtractions: newTotal,
        correctExtractions: newCorrect,
        accuracy: newAccuracy
      }
    })
  } else {
    await prisma.fieldCorrectionHistory.create({
      data: {
        fieldName,
        forwarderId,
        totalExtractions: 1,
        correctExtractions: wasCorrect ? 1 : 0,
        accuracy: wasCorrect ? 100 : 0,
        periodStart: today,
        periodEnd: tomorrow
      }
    })
  }
}
```

---

### Phase 4: Confidence Service Integration (15 min)

#### Step 4.1: Create Confidence Service

Create `src/services/confidence.service.ts`:

```typescript
/**
 * Confidence scoring service
 * Integrates calculator with database operations
 */

import { prisma } from '@/lib/prisma'
import type { FieldMappings } from '@/types/field-mapping'
import type { DocumentConfidenceResult } from '@/types/confidence'
import {
  calculateDocumentConfidence,
  calculateWeightedDocumentConfidence
} from '@/lib/confidence/calculator'
import { getForwarderFieldAccuracy } from './historical-accuracy.service'
import { getRequiredFields } from '@/types/invoice-fields'

/**
 * Calculate and save confidence scores for a document
 */
export async function calculateAndSaveConfidence(
  documentId: string
): Promise<DocumentConfidenceResult> {
  // Get extraction result
  const extraction = await prisma.extractionResult.findUnique({
    where: { documentId },
    include: {
      document: {
        select: { forwarderId: true }
      }
    }
  })

  if (!extraction) {
    throw new Error('Extraction result not found')
  }

  const fieldMappings = extraction.fieldMappings as FieldMappings

  // Get historical accuracy data
  const historicalData = await getForwarderFieldAccuracy(
    extraction.document.forwarderId
  )

  // Get critical fields (required fields)
  const criticalFields = getRequiredFields()

  // Calculate confidence
  const result = calculateWeightedDocumentConfidence(
    fieldMappings,
    criticalFields,
    historicalData
  )

  // Save confidence scores
  await prisma.extractionResult.update({
    where: { id: extraction.id },
    data: {
      confidenceScores: result,
      averageConfidence: result.overallScore
    }
  })

  return result
}

/**
 * Get confidence scores for a document
 */
export async function getDocumentConfidence(
  documentId: string
): Promise<DocumentConfidenceResult | null> {
  const extraction = await prisma.extractionResult.findUnique({
    where: { documentId }
  })

  if (!extraction?.confidenceScores) return null

  return extraction.confidenceScores as DocumentConfidenceResult
}

/**
 * Recalculate confidence for a document (after manual edits)
 */
export async function recalculateConfidence(
  documentId: string,
  updatedMappings: FieldMappings
): Promise<DocumentConfidenceResult> {
  const extraction = await prisma.extractionResult.findUnique({
    where: { documentId },
    include: {
      document: {
        select: { forwarderId: true }
      }
    }
  })

  if (!extraction) {
    throw new Error('Extraction result not found')
  }

  const historicalData = await getForwarderFieldAccuracy(
    extraction.document.forwarderId
  )

  const criticalFields = getRequiredFields()

  const result = calculateWeightedDocumentConfidence(
    updatedMappings,
    criticalFields,
    historicalData
  )

  await prisma.extractionResult.update({
    where: { id: extraction.id },
    data: {
      fieldMappings: updatedMappings,
      confidenceScores: result,
      averageConfidence: result.overallScore
    }
  })

  return result
}
```

---

### Phase 5: UI Components (20 min)

#### Step 5.1: Create ConfidenceBadge Component

Create `src/components/features/confidence/ConfidenceBadge.tsx`:

```typescript
'use client'

/**
 * Confidence score badge component
 * Displays color-coded confidence level
 */

import { cn } from '@/lib/utils'
import { CONFIDENCE_THRESHOLDS, getConfidenceLevel } from '@/lib/confidence/thresholds'

interface ConfidenceBadgeProps {
  /** Confidence score (0-100) */
  score: number
  /** Show numeric value */
  showValue?: boolean
  /** Show label text */
  showLabel?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional classes */
  className?: string
}

export function ConfidenceBadge({
  score,
  showValue = true,
  showLabel = false,
  size = 'md',
  className
}: ConfidenceBadgeProps) {
  const level = getConfidenceLevel(score)
  const config = CONFIDENCE_THRESHOLDS[level]

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: config.bgColor,
        color: config.color
      }}
    >
      {showValue && (
        <span className="font-semibold">
          {Math.round(score)}%
        </span>
      )}
      {showLabel && (
        <span>{config.labelZh}</span>
      )}
    </span>
  )
}
```

#### Step 5.2: Create ConfidenceIndicator Component

Create `src/components/features/confidence/ConfidenceIndicator.tsx`:

```typescript
'use client'

/**
 * Visual confidence indicator with bar
 */

import { cn } from '@/lib/utils'
import { getConfidenceColor, getConfidenceLevel } from '@/lib/confidence/thresholds'

interface ConfidenceIndicatorProps {
  /** Confidence score (0-100) */
  score: number
  /** Show numeric value */
  showValue?: boolean
  /** Width of the indicator */
  width?: string
  /** Additional classes */
  className?: string
}

export function ConfidenceIndicator({
  score,
  showValue = true,
  width = '100px',
  className
}: ConfidenceIndicatorProps) {
  const color = getConfidenceColor(score)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="relative h-2 rounded-full bg-gray-200 overflow-hidden"
        style={{ width }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${score}%`,
            backgroundColor: color
          }}
        />
      </div>
      {showValue && (
        <span
          className="text-sm font-medium"
          style={{ color }}
        >
          {Math.round(score)}%
        </span>
      )}
    </div>
  )
}
```

#### Step 5.3: Create ConfidenceBreakdown Component

Create `src/components/features/confidence/ConfidenceBreakdown.tsx`:

```typescript
'use client'

/**
 * Detailed confidence score breakdown
 */

import type { FieldConfidenceResult } from '@/types/confidence'
import { FACTOR_WEIGHTS } from '@/lib/confidence/thresholds'
import { ConfidenceIndicator } from './ConfidenceIndicator'

interface ConfidenceBreakdownProps {
  result: FieldConfidenceResult
}

const FACTOR_LABELS: Record<keyof typeof FACTOR_WEIGHTS, string> = {
  ocrConfidence: 'OCR 清晰度',
  ruleMatchScore: '規則匹配',
  formatValidation: '格式驗證',
  historicalAccuracy: '歷史準確率'
}

export function ConfidenceBreakdown({ result }: ConfidenceBreakdownProps) {
  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          總信心度
        </span>
        <span
          className="text-lg font-bold"
          style={{ color: result.color }}
        >
          {Math.round(result.score)}%
        </span>
      </div>

      <div className="border-t pt-3 space-y-2">
        {result.breakdown.map(item => (
          <div key={item.factor} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20">
              {FACTOR_LABELS[item.factor]}
            </span>
            <ConfidenceIndicator
              score={item.rawScore}
              width="60px"
              showValue={false}
            />
            <span className="text-xs text-gray-600 w-10 text-right">
              {Math.round(item.rawScore)}
            </span>
            <span className="text-xs text-gray-400">
              ×{(item.weight * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Phase 6: API Endpoints (10 min)

#### Step 6.1: Confidence API

Create `src/app/api/confidence/[documentId]/route.ts`:

```typescript
/**
 * GET /api/confidence/[documentId]
 * Get confidence scores for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDocumentConfidence } from '@/services/confidence.service'

interface RouteParams {
  params: Promise<{ documentId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    const result = await getDocumentConfidence(documentId)

    if (!result) {
      return NextResponse.json(
        { error: 'Confidence scores not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Get confidence error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## Testing Guide

### Unit Tests

Create `src/lib/confidence/__tests__/calculator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  calculateFieldConfidence,
  calculateDocumentConfidence
} from '../calculator'

describe('calculateFieldConfidence', () => {
  it('should return high confidence for high-quality extraction', () => {
    const result = calculateFieldConfidence({
      value: 'INV-001',
      confidence: 95,
      method: 'azure_field',
      ruleId: 'rule-1',
      isValid: true,
      isEmpty: false,
      source: null,
      normalizedValue: 'INV-001'
    })

    expect(result.score).toBeGreaterThanOrEqual(90)
    expect(result.level).toBe('high')
  })

  it('should return low confidence for empty fields', () => {
    const result = calculateFieldConfidence({
      value: null,
      confidence: 0,
      method: 'regex',
      ruleId: null,
      isValid: true,
      isEmpty: true,
      source: null,
      normalizedValue: null
    })

    expect(result.score).toBeLessThan(70)
    expect(result.level).toBe('low')
  })

  it('should reduce score for validation errors', () => {
    const validResult = calculateFieldConfidence({
      value: '2024-01-01',
      confidence: 90,
      method: 'regex',
      ruleId: 'rule-1',
      isValid: true,
      isEmpty: false,
      source: null,
      normalizedValue: '2024-01-01'
    })

    const invalidResult = calculateFieldConfidence({
      value: 'invalid-date',
      confidence: 90,
      method: 'regex',
      ruleId: 'rule-1',
      isValid: false,
      validationError: 'Invalid date format',
      isEmpty: false,
      source: null,
      normalizedValue: 'invalid-date'
    })

    expect(invalidResult.score).toBeLessThan(validResult.score)
  })
})
```

---

## Verification Checklist

| Item | Expected Result | Status |
|------|-----------------|--------|
| Field confidence calculation | Correct 0-100 score | [ ] |
| Document confidence average | Correct average calculation | [ ] |
| Color classification | Green ≥90, Yellow 70-89, Red <70 | [ ] |
| Factor weights | Sum to 100% | [ ] |
| Historical data impact | Adjusts score correctly | [ ] |
| ConfidenceBadge display | Correct colors and values | [ ] |
| API returns scores | JSON with all fields | [ ] |

---

## Factor Weight Reference

| Factor | Weight | Description |
|--------|--------|-------------|
| OCR Confidence | 30% | Azure DI recognition quality |
| Rule Match Score | 30% | Extraction method reliability |
| Format Validation | 25% | Data format correctness |
| Historical Accuracy | 15% | Past accuracy for field/forwarder |

---

## Related Documentation

- [Story 2.5 User Story](./stories/2-5-confidence-score-calculation.md)
- [Story 2.4 Tech Spec](./tech-spec-story-2-4.md) (Prerequisite)
- [Confidence Thresholds](../src/lib/confidence/thresholds.ts)

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
