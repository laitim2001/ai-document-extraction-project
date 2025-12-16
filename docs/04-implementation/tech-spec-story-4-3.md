# Tech Spec: Story 4-3 修正模式記錄與分析

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.3
- **Title**: 修正模式記錄與分析
- **Epic**: Epic 4 - 映射規則管理與自動學習

### 1.2 Story Description
作為系統，我希望記錄用戶的修正並識別重複模式，以便自動發現潛在的規則改進機會。

### 1.3 Dependencies
- **Story 3-6**: 修正類型標記（NORMAL/EXCEPTION 類型定義）
- **Story 4-1**: 映射規則模型（MappingRule 基礎）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 修正記錄儲存 | CorrectionRecordingService + 增強 Correction 模型 |
| AC2 | 模式分析執行 | PatternAnalysisService + Levenshtein 相似度 + 每日 Cron |
| AC3 | 候選標記 | occurrenceCount >= 3 時自動更新狀態為 CANDIDATE |

---

## 3. Architecture Overview

### 3.1 Pattern Analysis System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         修正模式分析系統                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Flow                                     │   │
│  │                                                                       │   │
│  │  User Correction                                                      │   │
│  │  ┌─────────────────┐                                                 │   │
│  │  │ originalValue   │──────┐                                          │   │
│  │  │ correctedValue  │      │                                          │   │
│  │  │ fieldName       │      ▼                                          │   │
│  │  │ correctionType  │  ┌──────────────────────────────┐               │   │
│  │  │ (NORMAL only)   │  │ CorrectionRecordingService   │               │   │
│  │  └─────────────────┘  │                              │               │   │
│  │                       │ • Filter NORMAL corrections  │               │   │
│  │                       │ • Extract forwarderId        │               │   │
│  │                       │ • Store context info         │               │   │
│  │                       └──────────────┬───────────────┘               │   │
│  │                                      │                               │   │
│  │                                      ▼                               │   │
│  │                       ┌──────────────────────────────┐               │   │
│  │                       │       Correction             │               │   │
│  │                       │   (Enhanced Model)           │               │   │
│  │                       │ • forwarderId (via document) │               │   │
│  │                       │ • extractionContext          │               │   │
│  │                       │ • analyzedAt (null = 未分析)  │               │   │
│  │                       └──────────────┬───────────────┘               │   │
│  │                                      │                               │   │
│  └──────────────────────────────────────┼───────────────────────────────┘   │
│                                         │                                   │
│  ┌──────────────────────────────────────┼───────────────────────────────┐   │
│  │                         Daily Cron Job (02:00)                        │   │
│  │                                      │                               │   │
│  │                                      ▼                               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    PatternAnalysisService                      │   │   │
│  │  │                                                                │   │   │
│  │  │  Step 1: Fetch unanalyzed NORMAL corrections                   │   │   │
│  │  │          WHERE correctionType = 'NORMAL' AND analyzedAt = null │   │   │
│  │  │                                                                │   │   │
│  │  │  Step 2: Group by (forwarderId + fieldName)                    │   │   │
│  │  │          Map<string, Correction[]>                             │   │   │
│  │  │                                                                │   │   │
│  │  │  Step 3: Find similar patterns within each group               │   │   │
│  │  │          Levenshtein similarity >= 0.8                         │   │   │
│  │  │                                                                │   │   │
│  │  │  Step 4: Upsert CorrectionPattern records                      │   │   │
│  │  │          Generate patternHash for deduplication                │   │   │
│  │  │                                                                │   │   │
│  │  │  Step 5: Mark candidates (occurrenceCount >= 3)                │   │   │
│  │  │          DETECTED → CANDIDATE                                  │   │   │
│  │  │                                                                │   │   │
│  │  │  Step 6: Mark corrections as analyzed                          │   │   │
│  │  │          SET analyzedAt = NOW()                                │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                      │                               │   │
│  │                                      ▼                               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    CorrectionPattern                          │   │   │
│  │  │                                                                │   │   │
│  │  │  ┌─────────────────────────────────────────────────────────┐  │   │   │
│  │  │  │ forwarderId    │ fieldName      │ patternHash           │  │   │   │
│  │  │  │ originalPattern│ correctedPattern│ occurrenceCount      │  │   │   │
│  │  │  │ status         │ firstSeenAt    │ lastSeenAt            │  │   │   │
│  │  │  └─────────────────────────────────────────────────────────┘  │   │   │
│  │  │                                                                │   │   │
│  │  │  PatternStatus:                                                │   │   │
│  │  │  • DETECTED (count < 3)                                        │   │   │
│  │  │  • CANDIDATE (count >= 3) ──────────────────────────────┐      │   │   │
│  │  │  • SUGGESTED (已生成 RuleSuggestion)                     │      │   │   │
│  │  │  • PROCESSED (已處理)                                    │      │   │   │
│  │  │  • IGNORED (手動忽略)                                    │      │   │   │
│  │  └─────────────────────────────────────────────────┬───────┘      │   │   │
│  │                                                    │               │   │
│  └────────────────────────────────────────────────────┼───────────────┘   │
│                                                       │                   │
│  ┌────────────────────────────────────────────────────┼───────────────┐   │
│  │                         Notification                │               │   │
│  │                                                    ▼               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐ │   │
│  │  │ Super User Notification                                       │ │   │
│  │  │ • 顯示新發現的 CANDIDATE 模式                                   │ │   │
│  │  │ • 提供快速審核入口 (/rules/suggestions)                         │ │   │
│  │  │ • 顯示模式詳情（原始值 → 修正值、出現次數）                        │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/api/
│   ├── corrections/
│   │   └── patterns/
│   │       ├── route.ts                    # GET 模式列表 API
│   │       └── [id]/
│   │           └── route.ts                # GET/PATCH 模式詳情 API
│   └── jobs/
│       └── pattern-analysis/
│           └── route.ts                    # 觸發分析任務 API（內部用）
├── services/
│   ├── correction-recording.ts             # 修正記錄服務
│   ├── pattern-analysis.ts                 # 模式分析服務
│   └── similarity/
│       ├── levenshtein.ts                  # Levenshtein 距離算法
│       ├── numeric-similarity.ts           # 數值相似度
│       └── date-similarity.ts              # 日期格式相似度
├── jobs/
│   └── pattern-analysis-job.ts             # 定時任務配置
├── types/
│   └── pattern.ts                          # 模式相關類型
└── lib/
    └── hash.ts                             # Pattern Hash 生成工具
```

---

## 4. Implementation Guide

### Phase 1: Database Schema (Foundation)

#### 4.1.1 Prisma Schema 定義

**File**: `prisma/schema.prisma`

```prisma
// ===== 增強 Correction 模型 =====

model Correction {
  id              String         @id @default(uuid())
  documentId      String         @map("document_id")
  fieldId         String         @map("field_id")
  fieldName       String         @map("field_name")
  originalValue   String?        @map("original_value")
  correctedValue  String         @map("corrected_value")
  correctionType  CorrectionType @default(NORMAL) @map("correction_type")
  reason          String?        // 修正原因（EXCEPTION 時必填）
  correctedBy     String         @map("corrected_by")
  correctedAt     DateTime       @default(now()) @map("corrected_at")

  // 新增：分析相關欄位
  extractionContext Json?        @map("extraction_context")  // 提取上下文資訊
  analyzedAt      DateTime?      @map("analyzed_at")         // 分析時間（null = 未分析）
  patternId       String?        @map("pattern_id")          // 關聯的模式 ID

  document Document @relation(fields: [documentId], references: [id])
  user     User     @relation(fields: [correctedBy], references: [id])
  pattern  CorrectionPattern? @relation(fields: [patternId], references: [id])

  @@index([documentId])
  @@index([correctedBy])
  @@index([correctionType, analyzedAt])  // 分析查詢優化
  @@map("corrections")
}

enum CorrectionType {
  NORMAL     // 正常修正（可用於學習）
  EXCEPTION  // 特殊情況（不用於學習）
}

// ===== 修正模式記錄 =====

model CorrectionPattern {
  id               String        @id @default(uuid())
  forwarderId      String        @map("forwarder_id")
  fieldName        String        @map("field_name")
  patternHash      String        @map("pattern_hash")      // 用於去重
  originalPattern  String        @map("original_pattern")  // 原始值模式
  correctedPattern String        @map("corrected_pattern") // 修正值模式
  occurrenceCount  Int           @default(1) @map("occurrence_count")
  status           PatternStatus @default(DETECTED)
  confidence       Float         @default(0)               // 模式信心度
  sampleValues     Json?         @map("sample_values")     // 樣本值 [{original, corrected}]
  firstSeenAt      DateTime      @default(now()) @map("first_seen_at")
  lastSeenAt       DateTime      @default(now()) @map("last_seen_at")
  processedAt      DateTime?     @map("processed_at")      // 處理時間
  processedBy      String?       @map("processed_by")      // 處理人
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  forwarder    Forwarder         @relation(fields: [forwarderId], references: [id])
  processor    User?             @relation("PatternProcessor", fields: [processedBy], references: [id])
  corrections  Correction[]
  suggestion   RuleSuggestion?

  @@unique([forwarderId, fieldName, patternHash])
  @@index([status])
  @@index([forwarderId, fieldName])
  @@index([occurrenceCount])
  @@map("correction_patterns")
}

enum PatternStatus {
  DETECTED        // 已檢測（count < 3）
  CANDIDATE       // 升級候選（count >= 3）
  SUGGESTED       // 已生成建議
  PROCESSED       // 已處理
  IGNORED         // 已忽略
}

// ===== 模式分析任務日誌 =====

model PatternAnalysisLog {
  id                 String   @id @default(uuid())
  startedAt          DateTime @map("started_at")
  completedAt        DateTime? @map("completed_at")
  status             String   // RUNNING, COMPLETED, FAILED
  correctionsAnalyzed Int     @default(0) @map("corrections_analyzed")
  patternsFound      Int      @default(0) @map("patterns_found")
  candidatesMarked   Int      @default(0) @map("candidates_marked")
  errorMessage       String?  @map("error_message")
  createdAt          DateTime @default(now()) @map("created_at")

  @@index([status])
  @@map("pattern_analysis_logs")
}
```

---

### Phase 2: Type Definitions (AC1, AC2, AC3)

**File**: `src/types/pattern.ts`

```typescript
import { PatternStatus } from '@prisma/client'

// ===== 提取上下文類型 =====

export interface ExtractionContext {
  pageNumber?: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  surroundingText?: string
  extractionMethod?: string
  confidence?: number
}

// ===== 修正模式類型 =====

export interface CorrectionPatternItem {
  id: string
  forwarder: {
    id: string
    name: string
    code: string
  }
  fieldName: string
  originalPattern: string
  correctedPattern: string
  occurrenceCount: number
  status: PatternStatus
  confidence: number
  sampleValues: SampleValue[]
  firstSeenAt: string
  lastSeenAt: string
}

export interface SampleValue {
  original: string
  corrected: string
  documentId: string
  correctedAt: string
}

// ===== 模式列表查詢參數 =====

export interface PatternsQueryParams {
  forwarderId?: string
  fieldName?: string
  status?: PatternStatus
  minOccurrences?: number
  page?: number
  pageSize?: number
  sortBy?: 'occurrenceCount' | 'lastSeenAt' | 'confidence'
  sortOrder?: 'asc' | 'desc'
}

// ===== 模式列表響應 =====

export interface PatternsListResponse {
  success: true
  data: {
    patterns: CorrectionPatternItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    summary: {
      totalPatterns: number
      candidatePatterns: number
      detectedPatterns: number
      processedPatterns: number
    }
  }
}

// ===== 模式詳情響應 =====

export interface PatternDetailResponse {
  success: true
  data: CorrectionPatternDetail
}

export interface CorrectionPatternDetail extends CorrectionPatternItem {
  corrections: PatternCorrection[]
  suggestion?: {
    id: string
    status: string
    createdAt: string
  }
}

export interface PatternCorrection {
  id: string
  documentId: string
  documentName: string
  originalValue: string
  correctedValue: string
  correctedBy: {
    id: string
    name: string
  }
  correctedAt: string
}

// ===== 模式狀態更新 =====

export interface UpdatePatternStatusRequest {
  status: 'IGNORED' | 'PROCESSED'
  reason?: string
}

// ===== 分析任務類型 =====

export interface AnalysisResult {
  correctionsAnalyzed: number
  patternsFound: number
  patternsUpdated: number
  candidatesMarked: number
  duration: number
}

// ===== 相似度分析類型 =====

export interface SimilarityResult {
  similarity: number
  isMatch: boolean
}

export interface PatternGroup {
  key: string  // forwarderId:fieldName
  forwarderId: string
  fieldName: string
  corrections: GroupedCorrection[]
}

export interface GroupedCorrection {
  id: string
  originalValue: string
  correctedValue: string
  documentId: string
  correctedAt: Date
}

// ===== 模式狀態配置 =====

export const PATTERN_STATUSES: {
  value: PatternStatus
  label: string
  description: string
  color: string
}[] = [
  {
    value: 'DETECTED',
    label: '已檢測',
    description: '已識別的修正模式，出現次數 < 3',
    color: 'secondary'
  },
  {
    value: 'CANDIDATE',
    label: '候選',
    description: '達到閾值的候選模式，等待審核',
    color: 'warning'
  },
  {
    value: 'SUGGESTED',
    label: '已建議',
    description: '已生成規則升級建議',
    color: 'info'
  },
  {
    value: 'PROCESSED',
    label: '已處理',
    description: '已完成處理',
    color: 'success'
  },
  {
    value: 'IGNORED',
    label: '已忽略',
    description: '手動標記為忽略',
    color: 'muted'
  }
]

// ===== 閾值常量 =====

export const PATTERN_THRESHOLDS = {
  // 候選標記閾值（修正次數）
  CANDIDATE_THRESHOLD: 3,
  // 相似度閾值
  SIMILARITY_THRESHOLD: 0.8,
  // 字串長度相似度容差
  LENGTH_TOLERANCE: 0.3,
  // 最大樣本值數量
  MAX_SAMPLE_VALUES: 10
} as const
```

---

### Phase 3: Similarity Algorithms (AC2)

#### 4.3.1 Levenshtein 距離算法

**File**: `src/services/similarity/levenshtein.ts`

```typescript
/**
 * Levenshtein 距離計算
 * 計算兩個字串之間的編輯距離
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // 創建距離矩陣
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // 初始化第一行和第一列
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // 填充距離矩陣
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 刪除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替換
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Levenshtein 相似度計算
 * 返回 0-1 之間的相似度值，1 表示完全相同
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  // 空字串處理
  if (!str1 && !str2) return 1
  if (!str1 || !str2) return 0

  // 正規化：轉小寫、去除首尾空白
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  // 完全相同
  if (s1 === s2) return 1

  const distance = levenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)

  return 1 - distance / maxLength
}

/**
 * 批量相似度計算（優化版本）
 * 使用早期終止優化
 */
export function calculateSimilarityWithThreshold(
  str1: string,
  str2: string,
  threshold: number
): { similarity: number; isMatch: boolean } {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  // 快速檢查：完全相同
  if (s1 === s2) {
    return { similarity: 1, isMatch: true }
  }

  // 快速檢查：長度差異過大
  const lengthDiff = Math.abs(s1.length - s2.length)
  const maxLength = Math.max(s1.length, s2.length)
  const minPossibleSimilarity = 1 - lengthDiff / maxLength

  if (minPossibleSimilarity < threshold) {
    return { similarity: minPossibleSimilarity, isMatch: false }
  }

  // 完整計算
  const similarity = levenshteinSimilarity(s1, s2)
  return {
    similarity,
    isMatch: similarity >= threshold
  }
}
```

#### 4.3.2 數值相似度算法

**File**: `src/services/similarity/numeric-similarity.ts`

```typescript
/**
 * 數值相似度計算
 * 適用於金額、數量等數值欄位
 */
export function numericSimilarity(
  value1: string,
  value2: string
): { similarity: number; isNumeric: boolean } {
  // 嘗試解析數值
  const num1 = parseNumericValue(value1)
  const num2 = parseNumericValue(value2)

  // 非數值情況
  if (num1 === null || num2 === null) {
    return { similarity: 0, isNumeric: false }
  }

  // 完全相同
  if (num1 === num2) {
    return { similarity: 1, isNumeric: true }
  }

  // 計算相對差異
  const maxVal = Math.max(Math.abs(num1), Math.abs(num2))
  if (maxVal === 0) {
    return { similarity: 1, isNumeric: true }
  }

  const diff = Math.abs(num1 - num2)
  const similarity = Math.max(0, 1 - diff / maxVal)

  return { similarity, isNumeric: true }
}

/**
 * 解析數值字串
 * 支援多種格式：1,234.56、$1234、1234.56 USD 等
 */
export function parseNumericValue(value: string): number | null {
  if (!value) return null

  // 移除貨幣符號和空白
  let cleaned = value
    .replace(/[$€£¥₩₹]/g, '')
    .replace(/[A-Za-z]/g, '')
    .replace(/\s/g, '')
    .trim()

  // 處理千分位分隔符
  // 判斷是使用 , 還是 . 作為千分位
  const commaCount = (cleaned.match(/,/g) || []).length
  const dotCount = (cleaned.match(/\./g) || []).length

  if (commaCount > 0 && dotCount === 1 && cleaned.indexOf('.') > cleaned.lastIndexOf(',')) {
    // 1,234.56 格式
    cleaned = cleaned.replace(/,/g, '')
  } else if (dotCount > 0 && commaCount === 1 && cleaned.indexOf(',') > cleaned.lastIndexOf('.')) {
    // 1.234,56 格式（歐洲）
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (commaCount > 0 && dotCount === 0) {
    // 1,234 格式（無小數）
    cleaned = cleaned.replace(/,/g, '')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * 檢查數值轉換模式
 * 判斷兩組數值之間是否存在一致的轉換規則
 */
export function detectNumericTransformPattern(
  pairs: Array<{ original: string; corrected: string }>
): {
  hasPattern: boolean
  type: 'multiply' | 'add' | 'none'
  factor?: number
} {
  const numericPairs = pairs
    .map(p => ({
      orig: parseNumericValue(p.original),
      corr: parseNumericValue(p.corrected)
    }))
    .filter(p => p.orig !== null && p.corr !== null) as Array<{
      orig: number
      corr: number
    }>

  if (numericPairs.length < 2) {
    return { hasPattern: false, type: 'none' }
  }

  // 檢查乘法模式（如：匯率轉換）
  const ratios = numericPairs.map(p => p.corr / p.orig)
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const ratioVariance = ratios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / ratios.length

  if (ratioVariance < 0.01) {
    return { hasPattern: true, type: 'multiply', factor: avgRatio }
  }

  // 檢查加法模式（如：固定調整）
  const diffs = numericPairs.map(p => p.corr - p.orig)
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const diffVariance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length

  if (diffVariance < 0.01 * Math.pow(avgDiff, 2)) {
    return { hasPattern: true, type: 'add', factor: avgDiff }
  }

  return { hasPattern: false, type: 'none' }
}
```

#### 4.3.3 日期格式相似度

**File**: `src/services/similarity/date-similarity.ts`

```typescript
/**
 * 日期格式相似度計算
 * 判斷日期格式轉換模式
 */
export function dateSimilarity(
  value1: string,
  value2: string
): { similarity: number; isDate: boolean; formatChange?: string } {
  const date1 = parseDate(value1)
  const date2 = parseDate(value2)

  // 非日期情況
  if (!date1 || !date2) {
    return { similarity: 0, isDate: false }
  }

  // 檢查是否為同一日期（不同格式）
  if (isSameDate(date1.date, date2.date)) {
    return {
      similarity: 1,
      isDate: true,
      formatChange: `${date1.format} → ${date2.format}`
    }
  }

  // 計算日期差異
  const daysDiff = Math.abs(
    (date1.date.getTime() - date2.date.getTime()) / (1000 * 60 * 60 * 24)
  )

  // 日期差異在 1 年內，根據差異計算相似度
  if (daysDiff <= 365) {
    const similarity = Math.max(0, 1 - daysDiff / 365)
    return { similarity, isDate: true }
  }

  return { similarity: 0, isDate: true }
}

// 常見日期格式
const DATE_FORMATS = [
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD', parse: (m: string[]) => new Date(+m[1], +m[2] - 1, +m[3]) },
  { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: 'DD/MM/YYYY', parse: (m: string[]) => new Date(+m[3], +m[2] - 1, +m[1]) },
  { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: 'MM/DD/YYYY', parse: (m: string[]) => new Date(+m[3], +m[1] - 1, +m[2]) },
  { regex: /^(\d{4})\/(\d{2})\/(\d{2})$/, format: 'YYYY/MM/DD', parse: (m: string[]) => new Date(+m[1], +m[2] - 1, +m[3]) },
  { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: 'DD-MM-YYYY', parse: (m: string[]) => new Date(+m[3], +m[2] - 1, +m[1]) },
  { regex: /^(\d{8})$/, format: 'YYYYMMDD', parse: (m: string[]) => new Date(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) },
]

interface ParsedDate {
  date: Date
  format: string
}

function parseDate(value: string): ParsedDate | null {
  const trimmed = value.trim()

  for (const fmt of DATE_FORMATS) {
    const match = trimmed.match(fmt.regex)
    if (match) {
      const date = fmt.parse(match)
      if (!isNaN(date.getTime())) {
        return { date, format: fmt.format }
      }
    }
  }

  // 嘗試原生解析
  const nativeDate = new Date(trimmed)
  if (!isNaN(nativeDate.getTime())) {
    return { date: nativeDate, format: 'NATIVE' }
  }

  return null
}

function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * 檢測日期格式轉換模式
 */
export function detectDateFormatPattern(
  pairs: Array<{ original: string; corrected: string }>
): {
  hasPattern: boolean
  fromFormat?: string
  toFormat?: string
} {
  const formatPairs: Array<{ from: string; to: string }> = []

  for (const pair of pairs) {
    const orig = parseDate(pair.original)
    const corr = parseDate(pair.corrected)

    if (orig && corr && isSameDate(orig.date, corr.date)) {
      formatPairs.push({ from: orig.format, to: corr.format })
    }
  }

  if (formatPairs.length < 2) {
    return { hasPattern: false }
  }

  // 檢查格式轉換是否一致
  const firstFrom = formatPairs[0].from
  const firstTo = formatPairs[0].to
  const isConsistent = formatPairs.every(
    p => p.from === firstFrom && p.to === firstTo
  )

  if (isConsistent) {
    return { hasPattern: true, fromFormat: firstFrom, toFormat: firstTo }
  }

  return { hasPattern: false }
}
```

---

### Phase 4: Core Services (AC1, AC2, AC3)

#### 4.4.1 Pattern Hash 生成工具

**File**: `src/lib/hash.ts`

```typescript
import crypto from 'crypto'

/**
 * 生成模式 Hash
 * 用於識別相同的修正模式，實現去重
 */
export function generatePatternHash(
  forwarderId: string,
  fieldName: string,
  originalPattern: string,
  correctedPattern: string
): string {
  // 正規化輸入
  const normalizedOriginal = normalizeValue(originalPattern)
  const normalizedCorrected = normalizeValue(correctedPattern)

  // 組合並生成 Hash
  const input = [
    forwarderId,
    fieldName,
    normalizedOriginal,
    normalizedCorrected
  ].join('|')

  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex')
    .substring(0, 16) // 取前 16 位
}

/**
 * 正規化值
 * 移除空白、轉小寫，用於 Hash 計算
 */
function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 生成模式代表值
 * 從一組相似值中提取代表性模式
 */
export function extractRepresentativePattern(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]

  // 找出最常見的值作為代表
  const frequency = new Map<string, number>()
  for (const v of values) {
    const normalized = normalizeValue(v)
    frequency.set(normalized, (frequency.get(normalized) || 0) + 1)
  }

  let maxCount = 0
  let representative = values[0]

  for (const [value, count] of frequency) {
    if (count > maxCount) {
      maxCount = count
      // 找回原始值（保留大小寫）
      representative = values.find(v => normalizeValue(v) === value) || value
    }
  }

  return representative
}
```

#### 4.4.2 修正記錄服務

**File**: `src/services/correction-recording.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { CorrectionType } from '@prisma/client'
import { ExtractionContext } from '@/types/pattern'

export interface RecordCorrectionInput {
  documentId: string
  fieldId: string
  fieldName: string
  originalValue: string | null
  correctedValue: string
  correctionType: CorrectionType
  reason?: string
  correctedBy: string
  extractionContext?: ExtractionContext
}

/**
 * 修正記錄服務
 * 負責記錄用戶修正並準備後續分析
 */
export class CorrectionRecordingService {
  /**
   * 記錄修正
   */
  async recordCorrection(input: RecordCorrectionInput): Promise<string> {
    const correction = await prisma.correction.create({
      data: {
        documentId: input.documentId,
        fieldId: input.fieldId,
        fieldName: input.fieldName,
        originalValue: input.originalValue,
        correctedValue: input.correctedValue,
        correctionType: input.correctionType,
        reason: input.reason,
        correctedBy: input.correctedBy,
        extractionContext: input.extractionContext as any,
        // NORMAL 類型的修正 analyzedAt 保持 null，等待分析
        // EXCEPTION 類型直接標記為已處理（不用於學習）
        analyzedAt: input.correctionType === 'EXCEPTION' ? new Date() : null
      }
    })

    return correction.id
  }

  /**
   * 批量記錄修正
   */
  async recordCorrections(inputs: RecordCorrectionInput[]): Promise<number> {
    const result = await prisma.correction.createMany({
      data: inputs.map(input => ({
        documentId: input.documentId,
        fieldId: input.fieldId,
        fieldName: input.fieldName,
        originalValue: input.originalValue,
        correctedValue: input.correctedValue,
        correctionType: input.correctionType,
        reason: input.reason,
        correctedBy: input.correctedBy,
        extractionContext: input.extractionContext as any,
        analyzedAt: input.correctionType === 'EXCEPTION' ? new Date() : null
      }))
    })

    return result.count
  }

  /**
   * 獲取待分析的修正數量
   */
  async getPendingAnalysisCount(): Promise<number> {
    return prisma.correction.count({
      where: {
        correctionType: 'NORMAL',
        analyzedAt: null
      }
    })
  }

  /**
   * 獲取修正統計
   */
  async getCorrectionStats(
    forwarderId?: string,
    days: number = 30
  ): Promise<{
    total: number
    normal: number
    exception: number
    analyzed: number
    pending: number
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const where: any = {
      correctedAt: { gte: since }
    }

    if (forwarderId) {
      where.document = { forwarderId }
    }

    const [total, byType, analyzed] = await Promise.all([
      prisma.correction.count({ where }),
      prisma.correction.groupBy({
        by: ['correctionType'],
        where,
        _count: { id: true }
      }),
      prisma.correction.count({
        where: {
          ...where,
          analyzedAt: { not: null }
        }
      })
    ])

    const typeMap = byType.reduce((acc, t) => {
      acc[t.correctionType] = t._count.id
      return acc
    }, {} as Record<string, number>)

    return {
      total,
      normal: typeMap['NORMAL'] || 0,
      exception: typeMap['EXCEPTION'] || 0,
      analyzed,
      pending: total - analyzed
    }
  }
}

export const correctionRecordingService = new CorrectionRecordingService()
```

#### 4.4.3 模式分析服務

**File**: `src/services/pattern-analysis.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { PatternStatus } from '@prisma/client'
import { generatePatternHash, extractRepresentativePattern } from '@/lib/hash'
import {
  levenshteinSimilarity,
  calculateSimilarityWithThreshold
} from './similarity/levenshtein'
import { numericSimilarity } from './similarity/numeric-similarity'
import { dateSimilarity } from './similarity/date-similarity'
import {
  PATTERN_THRESHOLDS,
  AnalysisResult,
  PatternGroup,
  GroupedCorrection,
  SampleValue
} from '@/types/pattern'

/**
 * 模式分析服務
 * 負責識別重複的修正模式並標記候選
 */
export class PatternAnalysisService {
  private readonly THRESHOLD = PATTERN_THRESHOLDS.CANDIDATE_THRESHOLD
  private readonly SIMILARITY_THRESHOLD = PATTERN_THRESHOLDS.SIMILARITY_THRESHOLD
  private readonly MAX_SAMPLES = PATTERN_THRESHOLDS.MAX_SAMPLE_VALUES

  /**
   * 執行模式分析
   * 主入口方法，由定時任務調用
   */
  async analyzeCorrections(): Promise<AnalysisResult> {
    const startTime = Date.now()

    // 創建分析日誌
    const log = await prisma.patternAnalysisLog.create({
      data: {
        startedAt: new Date(),
        status: 'RUNNING'
      }
    })

    try {
      // 1. 獲取未分析的 NORMAL 修正
      const corrections = await this.fetchUnanalyzedCorrections()

      if (corrections.length === 0) {
        await this.completeLog(log.id, 0, 0, 0)
        return {
          correctionsAnalyzed: 0,
          patternsFound: 0,
          patternsUpdated: 0,
          candidatesMarked: 0,
          duration: Date.now() - startTime
        }
      }

      // 2. 按 Forwarder + FieldName 分組
      const groups = this.groupCorrections(corrections)

      // 3. 識別相似模式
      let patternsFound = 0
      let patternsUpdated = 0

      for (const group of groups) {
        const { found, updated } = await this.processGroup(group)
        patternsFound += found
        patternsUpdated += updated
      }

      // 4. 標記達標的候選
      const candidatesMarked = await this.markCandidates()

      // 5. 標記修正為已分析
      await this.markCorrectionsAnalyzed(corrections.map(c => c.id))

      // 6. 完成日誌
      await this.completeLog(log.id, corrections.length, patternsFound, candidatesMarked)

      return {
        correctionsAnalyzed: corrections.length,
        patternsFound,
        patternsUpdated,
        candidatesMarked,
        duration: Date.now() - startTime
      }

    } catch (error) {
      // 記錄錯誤
      await prisma.patternAnalysisLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      throw error
    }
  }

  /**
   * 獲取未分析的修正記錄
   */
  private async fetchUnanalyzedCorrections() {
    return prisma.correction.findMany({
      where: {
        correctionType: 'NORMAL',
        analyzedAt: null
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            forwarderId: true
          }
        }
      },
      orderBy: { correctedAt: 'asc' },
      take: 1000 // 批次處理上限
    })
  }

  /**
   * 按 Forwarder + FieldName 分組
   */
  private groupCorrections(corrections: any[]): PatternGroup[] {
    const grouped = new Map<string, PatternGroup>()

    for (const correction of corrections) {
      const forwarderId = correction.document.forwarderId
      if (!forwarderId) continue

      const key = `${forwarderId}:${correction.fieldName}`

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          forwarderId,
          fieldName: correction.fieldName,
          corrections: []
        })
      }

      grouped.get(key)!.corrections.push({
        id: correction.id,
        originalValue: correction.originalValue || '',
        correctedValue: correction.correctedValue,
        documentId: correction.document.id,
        correctedAt: correction.correctedAt
      })
    }

    return Array.from(grouped.values())
  }

  /**
   * 處理單一分組
   */
  private async processGroup(
    group: PatternGroup
  ): Promise<{ found: number; updated: number }> {
    const { forwarderId, fieldName, corrections } = group

    // 找出相似的修正模式
    const similarGroups = this.findSimilarPatterns(corrections)

    let found = 0
    let updated = 0

    for (const similarGroup of similarGroups) {
      const result = await this.upsertPattern(
        forwarderId,
        fieldName,
        similarGroup
      )
      if (result.created) found++
      if (result.updated) updated++
    }

    return { found, updated }
  }

  /**
   * 識別相似的修正模式
   */
  private findSimilarPatterns(
    corrections: GroupedCorrection[]
  ): GroupedCorrection[][] {
    if (corrections.length === 0) return []

    const groups: GroupedCorrection[][] = []
    const assigned = new Set<string>()

    for (let i = 0; i < corrections.length; i++) {
      if (assigned.has(corrections[i].id)) continue

      const group: GroupedCorrection[] = [corrections[i]]
      assigned.add(corrections[i].id)

      for (let j = i + 1; j < corrections.length; j++) {
        if (assigned.has(corrections[j].id)) continue

        if (this.areSimilar(corrections[i], corrections[j])) {
          group.push(corrections[j])
          assigned.add(corrections[j].id)
        }
      }

      groups.push(group)
    }

    return groups
  }

  /**
   * 判斷兩個修正是否相似
   */
  private areSimilar(c1: GroupedCorrection, c2: GroupedCorrection): boolean {
    // 計算綜合相似度
    const similarity = this.calculateComprehensiveSimilarity(
      c1.originalValue,
      c1.correctedValue,
      c2.originalValue,
      c2.correctedValue
    )

    return similarity >= this.SIMILARITY_THRESHOLD
  }

  /**
   * 計算綜合相似度
   */
  private calculateComprehensiveSimilarity(
    original1: string,
    corrected1: string,
    original2: string,
    corrected2: string
  ): number {
    // 嘗試數值相似度
    const numOrig = numericSimilarity(original1, original2)
    const numCorr = numericSimilarity(corrected1, corrected2)
    if (numOrig.isNumeric && numCorr.isNumeric) {
      return (numOrig.similarity + numCorr.similarity) / 2
    }

    // 嘗試日期相似度
    const dateOrig = dateSimilarity(original1, original2)
    const dateCorr = dateSimilarity(corrected1, corrected2)
    if (dateOrig.isDate && dateCorr.isDate) {
      return (dateOrig.similarity + dateCorr.similarity) / 2
    }

    // 使用 Levenshtein 相似度
    const origSim = calculateSimilarityWithThreshold(
      original1,
      original2,
      this.SIMILARITY_THRESHOLD * 0.5 // 寬鬆一些
    )
    const corrSim = calculateSimilarityWithThreshold(
      corrected1,
      corrected2,
      this.SIMILARITY_THRESHOLD * 0.5
    )

    return (origSim.similarity + corrSim.similarity) / 2
  }

  /**
   * 更新或創建模式記錄
   */
  private async upsertPattern(
    forwarderId: string,
    fieldName: string,
    corrections: GroupedCorrection[]
  ): Promise<{ created: boolean; updated: boolean }> {
    if (corrections.length === 0) {
      return { created: false, updated: false }
    }

    // 提取代表性模式
    const originalPattern = extractRepresentativePattern(
      corrections.map(c => c.originalValue)
    )
    const correctedPattern = extractRepresentativePattern(
      corrections.map(c => c.correctedValue)
    )

    // 生成模式 Hash
    const patternHash = generatePatternHash(
      forwarderId,
      fieldName,
      originalPattern,
      correctedPattern
    )

    // 準備樣本值
    const sampleValues: SampleValue[] = corrections
      .slice(0, this.MAX_SAMPLES)
      .map(c => ({
        original: c.originalValue,
        corrected: c.correctedValue,
        documentId: c.documentId,
        correctedAt: c.correctedAt.toISOString()
      }))

    // 計算信心度（基於樣本數量和一致性）
    const confidence = Math.min(1, corrections.length / 10)

    // 嘗試查找現有模式
    const existing = await prisma.correctionPattern.findUnique({
      where: {
        forwarderId_fieldName_patternHash: {
          forwarderId,
          fieldName,
          patternHash
        }
      }
    })

    if (existing) {
      // 更新現有模式
      const existingSamples = (existing.sampleValues as SampleValue[]) || []
      const mergedSamples = [...existingSamples]

      for (const sample of sampleValues) {
        if (!mergedSamples.some(s => s.documentId === sample.documentId)) {
          mergedSamples.push(sample)
        }
      }

      await prisma.correctionPattern.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: corrections.length },
          lastSeenAt: new Date(),
          confidence: Math.max(existing.confidence, confidence),
          sampleValues: mergedSamples.slice(0, this.MAX_SAMPLES)
        }
      })

      // 關聯修正記錄
      await prisma.correction.updateMany({
        where: { id: { in: corrections.map(c => c.id) } },
        data: { patternId: existing.id }
      })

      return { created: false, updated: true }
    }

    // 創建新模式
    const pattern = await prisma.correctionPattern.create({
      data: {
        forwarderId,
        fieldName,
        patternHash,
        originalPattern,
        correctedPattern,
        occurrenceCount: corrections.length,
        confidence,
        sampleValues,
        firstSeenAt: corrections[0].correctedAt,
        lastSeenAt: new Date()
      }
    })

    // 關聯修正記錄
    await prisma.correction.updateMany({
      where: { id: { in: corrections.map(c => c.id) } },
      data: { patternId: pattern.id }
    })

    return { created: true, updated: false }
  }

  /**
   * 標記達標的候選
   */
  private async markCandidates(): Promise<number> {
    const result = await prisma.correctionPattern.updateMany({
      where: {
        occurrenceCount: { gte: this.THRESHOLD },
        status: 'DETECTED'
      },
      data: {
        status: 'CANDIDATE'
      }
    })

    return result.count
  }

  /**
   * 標記修正為已分析
   */
  private async markCorrectionsAnalyzed(correctionIds: string[]): Promise<void> {
    await prisma.correction.updateMany({
      where: { id: { in: correctionIds } },
      data: { analyzedAt: new Date() }
    })
  }

  /**
   * 完成分析日誌
   */
  private async completeLog(
    logId: string,
    correctionsAnalyzed: number,
    patternsFound: number,
    candidatesMarked: number
  ): Promise<void> {
    await prisma.patternAnalysisLog.update({
      where: { id: logId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        correctionsAnalyzed,
        patternsFound,
        candidatesMarked
      }
    })
  }

  /**
   * 獲取分析狀態
   */
  async getAnalysisStatus(): Promise<{
    lastAnalysis: {
      id: string
      status: string
      startedAt: string
      completedAt: string | null
      correctionsAnalyzed: number
      patternsFound: number
      candidatesMarked: number
    } | null
    pendingCorrections: number
    totalPatterns: number
    candidatePatterns: number
  }> {
    const [lastLog, pendingCount, patternStats] = await Promise.all([
      prisma.patternAnalysisLog.findFirst({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.correction.count({
        where: {
          correctionType: 'NORMAL',
          analyzedAt: null
        }
      }),
      prisma.correctionPattern.groupBy({
        by: ['status'],
        _count: { id: true }
      })
    ])

    const statsMap = patternStats.reduce((acc, s) => {
      acc[s.status] = s._count.id
      return acc
    }, {} as Record<string, number>)

    return {
      lastAnalysis: lastLog ? {
        id: lastLog.id,
        status: lastLog.status,
        startedAt: lastLog.startedAt.toISOString(),
        completedAt: lastLog.completedAt?.toISOString() || null,
        correctionsAnalyzed: lastLog.correctionsAnalyzed,
        patternsFound: lastLog.patternsFound,
        candidatesMarked: lastLog.candidatesMarked
      } : null,
      pendingCorrections: pendingCount,
      totalPatterns: Object.values(statsMap).reduce((a, b) => a + b, 0),
      candidatePatterns: statsMap['CANDIDATE'] || 0
    }
  }
}

export const patternAnalysisService = new PatternAnalysisService()
```

---

### Phase 5: Cron Job Configuration (AC2)

**File**: `src/jobs/pattern-analysis-job.ts`

```typescript
import { CronJob } from 'cron'
import { patternAnalysisService } from '@/services/pattern-analysis'
import { notificationService } from '@/services/notification'

/**
 * 模式分析定時任務
 * 每天凌晨 2 點執行
 */
export const patternAnalysisJob = new CronJob(
  '0 2 * * *',  // 每天 02:00
  async () => {
    console.log('[PatternAnalysis] Starting daily pattern analysis...')

    try {
      const result = await patternAnalysisService.analyzeCorrections()

      console.log('[PatternAnalysis] Analysis completed:', {
        correctionsAnalyzed: result.correctionsAnalyzed,
        patternsFound: result.patternsFound,
        patternsUpdated: result.patternsUpdated,
        candidatesMarked: result.candidatesMarked,
        duration: `${result.duration}ms`
      })

      // 如果有新的候選，通知 Super Users
      if (result.candidatesMarked > 0) {
        await notifyNewCandidates(result.candidatesMarked)
      }

    } catch (error) {
      console.error('[PatternAnalysis] Analysis failed:', error)
      // 可以在這裡添加告警通知
    }
  },
  null,  // onComplete
  false, // start (手動啟動)
  'Asia/Taipei' // 時區
)

/**
 * 通知新候選
 */
async function notifyNewCandidates(count: number): Promise<void> {
  await notificationService.notifySuperUsers({
    type: 'PATTERN_CANDIDATES',
    title: '發現新的規則升級候選',
    message: `系統發現 ${count} 個新的重複修正模式，建議審核並考慮升級為映射規則。`,
    actionUrl: '/rules/suggestions',
    actionLabel: '查看候選',
    priority: 'medium'
  })
}

/**
 * 手動觸發分析（用於 API 調用）
 */
export async function triggerPatternAnalysis() {
  return patternAnalysisService.analyzeCorrections()
}

/**
 * 啟動定時任務
 */
export function startPatternAnalysisJob() {
  patternAnalysisJob.start()
  console.log('[PatternAnalysis] Cron job scheduled for 02:00 daily')
}

/**
 * 停止定時任務
 */
export function stopPatternAnalysisJob() {
  patternAnalysisJob.stop()
  console.log('[PatternAnalysis] Cron job stopped')
}
```

**File**: `src/app/api/jobs/pattern-analysis/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { triggerPatternAnalysis } from '@/jobs/pattern-analysis-job'
import { patternAnalysisService } from '@/services/pattern-analysis'

// POST /api/jobs/pattern-analysis - 手動觸發分析
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

  // 僅限 Super User
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
    const result = await triggerPatternAnalysis()

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Failed to trigger pattern analysis:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to trigger pattern analysis'
      }
    }, { status: 500 })
  }
}

// GET /api/jobs/pattern-analysis - 獲取分析狀態
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
    const status = await patternAnalysisService.getAnalysisStatus()

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Failed to get analysis status:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to get analysis status'
      }
    }, { status: 500 })
  }
}
```

---

### Phase 6: API Layer (AC1, AC2, AC3)

#### 4.6.1 模式列表 API

**File**: `src/app/api/corrections/patterns/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { PatternStatus } from '@prisma/client'

// GET /api/corrections/patterns - 獲取模式列表
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

    // 解析查詢參數
    const forwarderId = searchParams.get('forwarderId') || undefined
    const fieldName = searchParams.get('fieldName') || undefined
    const status = searchParams.get('status') as PatternStatus | undefined
    const minOccurrences = parseInt(searchParams.get('minOccurrences') || '1')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const sortBy = (searchParams.get('sortBy') as string) || 'lastSeenAt'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    // 構建查詢條件
    const where: any = {
      occurrenceCount: { gte: minOccurrences }
    }
    if (forwarderId) where.forwarderId = forwarderId
    if (fieldName) {
      where.fieldName = {
        contains: fieldName,
        mode: 'insensitive'
      }
    }
    if (status) where.status = status

    // 計算分頁
    const skip = (page - 1) * pageSize

    // 構建排序
    const orderBy: any = {}
    if (sortBy === 'occurrenceCount') {
      orderBy.occurrenceCount = sortOrder
    } else if (sortBy === 'confidence') {
      orderBy.confidence = sortOrder
    } else {
      orderBy.lastSeenAt = sortOrder
    }

    // 並行查詢
    const [patterns, total, summary] = await Promise.all([
      prisma.correctionPattern.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          forwarder: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      }),
      prisma.correctionPattern.count({ where }),
      prisma.correctionPattern.groupBy({
        by: ['status'],
        _count: { id: true }
      })
    ])

    // 處理摘要
    const summaryMap = summary.reduce((acc, s) => {
      acc[s.status] = s._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        patterns: patterns.map(p => ({
          id: p.id,
          forwarder: p.forwarder,
          fieldName: p.fieldName,
          originalPattern: p.originalPattern,
          correctedPattern: p.correctedPattern,
          occurrenceCount: p.occurrenceCount,
          status: p.status,
          confidence: p.confidence,
          sampleValues: p.sampleValues || [],
          firstSeenAt: p.firstSeenAt.toISOString(),
          lastSeenAt: p.lastSeenAt.toISOString()
        })),
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        },
        summary: {
          totalPatterns: Object.values(summaryMap).reduce((a, b) => a + b, 0),
          candidatePatterns: summaryMap['CANDIDATE'] || 0,
          detectedPatterns: summaryMap['DETECTED'] || 0,
          processedPatterns: (summaryMap['PROCESSED'] || 0) + (summaryMap['SUGGESTED'] || 0)
        }
      }
    })

  } catch (error) {
    console.error('Failed to fetch patterns:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch patterns'
      }
    }, { status: 500 })
  }
}
```

#### 4.6.2 模式詳情與更新 API

**File**: `src/app/api/corrections/patterns/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

interface RouteParams {
  params: { id: string }
}

// GET /api/corrections/patterns/[id] - 獲取模式詳情
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const { id: patternId } = params

  try {
    const pattern = await prisma.correctionPattern.findUnique({
      where: { id: patternId },
      include: {
        forwarder: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        corrections: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true
              }
            },
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { correctedAt: 'desc' },
          take: 20
        },
        suggestion: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      }
    })

    if (!pattern) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Pattern ${patternId} not found`
        }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: pattern.id,
        forwarder: pattern.forwarder,
        fieldName: pattern.fieldName,
        originalPattern: pattern.originalPattern,
        correctedPattern: pattern.correctedPattern,
        occurrenceCount: pattern.occurrenceCount,
        status: pattern.status,
        confidence: pattern.confidence,
        sampleValues: pattern.sampleValues || [],
        firstSeenAt: pattern.firstSeenAt.toISOString(),
        lastSeenAt: pattern.lastSeenAt.toISOString(),
        corrections: pattern.corrections.map(c => ({
          id: c.id,
          documentId: c.document.id,
          documentName: c.document.fileName,
          originalValue: c.originalValue,
          correctedValue: c.correctedValue,
          correctedBy: c.user,
          correctedAt: c.correctedAt.toISOString()
        })),
        suggestion: pattern.suggestion ? {
          id: pattern.suggestion.id,
          status: pattern.suggestion.status,
          createdAt: pattern.suggestion.createdAt.toISOString()
        } : undefined
      }
    })

  } catch (error) {
    console.error('Failed to fetch pattern detail:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch pattern detail'
      }
    }, { status: 500 })
  }
}

// 更新狀態請求驗證
const updateStatusSchema = z.object({
  status: z.enum(['IGNORED', 'PROCESSED']),
  reason: z.string().optional()
})

// PATCH /api/corrections/patterns/[id] - 更新模式狀態
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const { id: patternId } = params

  try {
    const body = await request.json()
    const parsed = updateStatusSchema.safeParse(body)

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

    const { status, reason } = parsed.data

    // 檢查模式是否存在
    const existing = await prisma.correctionPattern.findUnique({
      where: { id: patternId },
      select: { id: true, status: true }
    })

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: `Pattern ${patternId} not found`
        }
      }, { status: 404 })
    }

    // 更新狀態
    const updated = await prisma.correctionPattern.update({
      where: { id: patternId },
      data: {
        status,
        processedAt: new Date(),
        processedBy: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        processedAt: updated.processedAt?.toISOString()
      }
    })

  } catch (error) {
    console.error('Failed to update pattern status:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update pattern status'
      }
    }, { status: 500 })
  }
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/services/pattern-analysis.test.ts`

```typescript
import { PatternAnalysisService } from '@/services/pattern-analysis'
import { levenshteinSimilarity, levenshteinDistance } from '@/services/similarity/levenshtein'
import { numericSimilarity, parseNumericValue } from '@/services/similarity/numeric-similarity'
import { dateSimilarity } from '@/services/similarity/date-similarity'
import { generatePatternHash } from '@/lib/hash'

describe('Levenshtein Similarity', () => {
  it('should return 1 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1)
  })

  it('should return 0 for completely different strings', () => {
    expect(levenshteinSimilarity('abc', 'xyz')).toBeLessThan(0.5)
  })

  it('should handle empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1)
    expect(levenshteinSimilarity('hello', '')).toBe(0)
  })

  it('should be case insensitive', () => {
    expect(levenshteinSimilarity('Hello', 'hello')).toBe(1)
  })

  it('should calculate correct similarity for similar strings', () => {
    const sim = levenshteinSimilarity('kitten', 'sitting')
    expect(sim).toBeGreaterThan(0.5)
    expect(sim).toBeLessThan(0.8)
  })
})

describe('Numeric Similarity', () => {
  it('should parse various number formats', () => {
    expect(parseNumericValue('1,234.56')).toBe(1234.56)
    expect(parseNumericValue('$1234')).toBe(1234)
    expect(parseNumericValue('1234.56 USD')).toBe(1234.56)
    expect(parseNumericValue('1.234,56')).toBe(1234.56) // European format
  })

  it('should calculate similarity for numbers', () => {
    const result = numericSimilarity('100', '100')
    expect(result.similarity).toBe(1)
    expect(result.isNumeric).toBe(true)
  })

  it('should return low similarity for different numbers', () => {
    const result = numericSimilarity('100', '200')
    expect(result.similarity).toBe(0.5)
  })
})

describe('Date Similarity', () => {
  it('should recognize same date in different formats', () => {
    const result = dateSimilarity('2024-01-15', '15/01/2024')
    expect(result.similarity).toBe(1)
    expect(result.isDate).toBe(true)
    expect(result.formatChange).toBeDefined()
  })

  it('should return 0 for non-dates', () => {
    const result = dateSimilarity('hello', 'world')
    expect(result.isDate).toBe(false)
  })
})

describe('Pattern Hash', () => {
  it('should generate consistent hash for same input', () => {
    const hash1 = generatePatternHash('fw1', 'field1', 'orig', 'corr')
    const hash2 = generatePatternHash('fw1', 'field1', 'orig', 'corr')
    expect(hash1).toBe(hash2)
  })

  it('should generate different hash for different input', () => {
    const hash1 = generatePatternHash('fw1', 'field1', 'orig', 'corr')
    const hash2 = generatePatternHash('fw1', 'field1', 'orig2', 'corr')
    expect(hash1).not.toBe(hash2)
  })

  it('should be case insensitive', () => {
    const hash1 = generatePatternHash('fw1', 'field1', 'ORIG', 'CORR')
    const hash2 = generatePatternHash('fw1', 'field1', 'orig', 'corr')
    expect(hash1).toBe(hash2)
  })
})
```

### 5.2 Integration Tests

**File**: `tests/integration/pattern-analysis.test.ts`

```typescript
import { PatternAnalysisService } from '@/services/pattern-analysis'
import { correctionRecordingService } from '@/services/correction-recording'
import { prisma } from '@/lib/prisma'

describe('Pattern Analysis Integration', () => {
  let service: PatternAnalysisService

  beforeAll(() => {
    service = new PatternAnalysisService()
  })

  beforeEach(async () => {
    // 清理測試數據
    await prisma.correction.deleteMany({
      where: { document: { fileName: { startsWith: 'test-' } } }
    })
    await prisma.correctionPattern.deleteMany({
      where: { forwarderId: 'test-forwarder' }
    })
  })

  it('should identify similar corrections', async () => {
    // 創建測試修正記錄
    const testCorrections = [
      { original: 'INV-001', corrected: 'INV001' },
      { original: 'INV-002', corrected: 'INV002' },
      { original: 'INV-003', corrected: 'INV003' }
    ]

    for (const corr of testCorrections) {
      await correctionRecordingService.recordCorrection({
        documentId: 'test-doc-id',
        fieldId: 'test-field-id',
        fieldName: 'invoice_number',
        originalValue: corr.original,
        correctedValue: corr.corrected,
        correctionType: 'NORMAL',
        correctedBy: 'test-user-id'
      })
    }

    // 執行分析
    const result = await service.analyzeCorrections()

    expect(result.correctionsAnalyzed).toBe(3)
    expect(result.patternsFound).toBeGreaterThanOrEqual(1)
  })

  it('should mark pattern as CANDIDATE after threshold', async () => {
    // 創建 3 個相似的修正（達到閾值）
    for (let i = 1; i <= 3; i++) {
      await correctionRecordingService.recordCorrection({
        documentId: `test-doc-${i}`,
        fieldId: 'test-field-id',
        fieldName: 'amount',
        originalValue: `$${i * 100}`,
        correctedValue: `${i * 100} USD`,
        correctionType: 'NORMAL',
        correctedBy: 'test-user-id'
      })
    }

    // 執行分析
    const result = await service.analyzeCorrections()

    expect(result.candidatesMarked).toBeGreaterThanOrEqual(1)

    // 驗證狀態
    const pattern = await prisma.correctionPattern.findFirst({
      where: {
        forwarderId: 'test-forwarder',
        fieldName: 'amount'
      }
    })

    expect(pattern?.status).toBe('CANDIDATE')
  })

  it('should not analyze EXCEPTION corrections', async () => {
    await correctionRecordingService.recordCorrection({
      documentId: 'test-doc-id',
      fieldId: 'test-field-id',
      fieldName: 'invoice_number',
      originalValue: 'TEST-001',
      correctedValue: 'SPECIAL-001',
      correctionType: 'EXCEPTION',
      reason: 'Special case',
      correctedBy: 'test-user-id'
    })

    const result = await service.analyzeCorrections()

    expect(result.correctionsAnalyzed).toBe(0)
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 修正記錄儲存
  - [ ] 儲存原始值、修正值
  - [ ] 記錄 Forwarder ID（通過 Document 關聯）
  - [ ] 記錄欄位名稱
  - [ ] 記錄修正時間
  - [ ] 僅處理 NORMAL 類型修正
  - [ ] 忽略 EXCEPTION 類型

- [ ] **AC2**: 模式分析執行
  - [ ] 按 Forwarder + FieldName 分組
  - [ ] 使用 Levenshtein 計算字串相似度
  - [ ] 支援數值相似度計算
  - [ ] 支援日期格式相似度
  - [ ] 每日凌晨 2 點自動執行
  - [ ] 支援手動觸發分析

- [ ] **AC3**: 候選標記
  - [ ] 修正次數 >= 3 時自動標記為 CANDIDATE
  - [ ] 避免重複標記（使用 patternHash）
  - [ ] 通知 Super User 新候選

### 6.2 Technical Verification

- [ ] CorrectionPattern 模型正確創建
- [ ] PatternStatus 枚舉定義完整
- [ ] API 響應符合 RFC 7807 格式
- [ ] Cron Job 正確配置並執行
- [ ] 相似度算法測試覆蓋

### 6.3 Performance Verification

- [ ] 分析批次處理（1000 筆/次）
- [ ] 分組查詢使用索引
- [ ] 分析日誌記錄完整

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `prisma/schema.prisma` | Modify | 增強 Correction、添加 CorrectionPattern |
| `src/types/pattern.ts` | Create | 模式相關類型定義 |
| `src/lib/hash.ts` | Create | Pattern Hash 生成工具 |
| `src/services/similarity/levenshtein.ts` | Create | Levenshtein 算法 |
| `src/services/similarity/numeric-similarity.ts` | Create | 數值相似度 |
| `src/services/similarity/date-similarity.ts` | Create | 日期相似度 |
| `src/services/correction-recording.ts` | Create | 修正記錄服務 |
| `src/services/pattern-analysis.ts` | Create | 模式分析服務 |
| `src/jobs/pattern-analysis-job.ts` | Create | 定時任務配置 |
| `src/app/api/jobs/pattern-analysis/route.ts` | Create | 觸發分析 API |
| `src/app/api/corrections/patterns/route.ts` | Create | 模式列表 API |
| `src/app/api/corrections/patterns/[id]/route.ts` | Create | 模式詳情 API |
| `tests/unit/services/pattern-analysis.test.ts` | Create | 單元測試 |
| `tests/integration/pattern-analysis.test.ts` | Create | 整合測試 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 4-3-correction-pattern-recording-analysis*
