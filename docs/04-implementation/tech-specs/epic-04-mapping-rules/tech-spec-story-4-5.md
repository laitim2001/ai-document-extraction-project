# Tech Spec: Story 4-5 規則影響範圍分析

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.5
- **Title**: 規則影響範圍分析
- **Epic**: Epic 4 - 映射規則管理與自動學習

### 1.2 Story Description
作為 Super User，我希望在規則升級前查看影響範圍分析，以便評估變更的風險。

### 1.3 Dependencies
- **Story 4-4**: 規則升級建議生成（RuleSuggestion 模型）
- **Story 4-1**: 映射規則列表與查看（MappingRule 模型）
- **Story 2-5**: 提取結果儲存（ExtractionResult 模型）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 影響分析報告 | ImpactAnalysisService + GET /api/rules/suggestions/[id]/impact |
| AC2 | 測試運行功能 | RuleSimulationService + POST /api/rules/suggestions/[id]/simulate |
| AC3 | 對比結果顯示 | ImpactComparisonTable + 改善/惡化標記 |

---

## 3. Architecture Overview

### 3.1 Impact Analysis System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         規則影響範圍分析系統                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Impact Analysis Flow                          │   │
│  │                                                                       │   │
│  │  Super User                                                           │   │
│  │  ┌─────────────────┐                                                 │   │
│  │  │ View Suggestion │                                                 │   │
│  │  │ /suggestions/id │                                                 │   │
│  │  └────────┬────────┘                                                 │   │
│  │           │                                                          │   │
│  │           │ Click "影響分析"                                          │   │
│  │           ▼                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Impact Analysis Page                         │ │   │
│  │  │  /rules/suggestions/[id]/impact                                 │ │   │
│  │  │                                                                 │ │   │
│  │  │  ┌────────────────────────────────────────────────────────────┐│ │   │
│  │  │  │ Statistics Summary Cards                                    ││ │   │
│  │  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        ││ │   │
│  │  │  │ │受影響文件 │ │預計改善   │ │可能惡化   │ │改善率     │        ││ │   │
│  │  │  │ │   156    │ │   89     │ │   12     │ │  57.1%   │        ││ │   │
│  │  │  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘        ││ │   │
│  │  │  └────────────────────────────────────────────────────────────┘│ │   │
│  │  │                                                                 │ │   │
│  │  │  ┌────────────────────────────────────────────────────────────┐│ │   │
│  │  │  │ Risk Cases Table                                            ││ │   │
│  │  │  │ ┌────────┬──────────┬──────────┬────────┬────────────────┐  ││ │   │
│  │  │  │ │ 文件   │ 當前值    │ 預測值    │ 風險    │ 原因          │  ││ │   │
│  │  │  │ ├────────┼──────────┼──────────┼────────┼────────────────┤  ││ │   │
│  │  │  │ │doc1.pdf│ INV-123  │ INV123   │ 🔴 HIGH│ 格式不一致     │  ││ │   │
│  │  │  │ │doc2.pdf│ N/A      │ ABC-456  │ 🟡 MED │ 新增提取       │  ││ │   │
│  │  │  │ └────────┴──────────┴──────────┴────────┴────────────────┘  ││ │   │
│  │  │  └────────────────────────────────────────────────────────────┘│ │   │
│  │  │                                                                 │ │   │
│  │  │  [運行模擬測試] Button                                           │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Simulation Flow                               │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │ Simulation Configuration Dialog                                 │  │   │
│  │  │                                                                 │  │   │
│  │  │ Sample Size: [100 ▼]                                           │  │   │
│  │  │ Date Range:  [Last 30 days ▼]                                  │  │   │
│  │  │                                                                 │  │   │
│  │  │ [取消]                           [開始模擬]                      │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                         │                                            │   │
│  │                         │ POST /api/rules/suggestions/[id]/simulate  │   │
│  │                         ▼                                            │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │ RuleSimulationService                                          │  │   │
│  │  │                                                                 │  │   │
│  │  │ 1. 獲取歷史文件樣本                                              │  │   │
│  │  │    SELECT * FROM documents                                      │  │   │
│  │  │    WHERE forwarder_id = :forwarderId                           │  │   │
│  │  │    ORDER BY created_at DESC LIMIT :sampleSize                  │  │   │
│  │  │                                                                 │  │   │
│  │  │ 2. 對每個文件執行模擬                                            │  │   │
│  │  │    ┌────────────────────────────────────────────────────────┐  │  │   │
│  │  │    │ For each document:                                      │  │  │   │
│  │  │    │ • 獲取原始提取結果                                        │  │  │   │
│  │  │    │ • 獲取用戶確認/修正後的實際值                               │  │  │   │
│  │  │    │ • 應用當前規則 → currentRuleResult                       │  │  │   │
│  │  │    │ • 應用新規則 → newRuleResult                             │  │  │   │
│  │  │    │ • 比對準確性                                              │  │  │   │
│  │  │    └────────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                                 │  │   │
│  │  │ 3. 分類結果                                                     │  │   │
│  │  │    improved:  !currentAccurate && newAccurate                  │  │   │
│  │  │    regressed: currentAccurate && !newAccurate                  │  │   │
│  │  │    unchanged: currentAccurate === newAccurate                  │  │   │
│  │  │                                                                 │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │ Simulation Results Page                                         │  │   │
│  │  │                                                                 │  │   │
│  │  │ ┌─────────────────────────────────────────────────────────────┐│  │   │
│  │  │ │ Summary                                                      ││  │   │
│  │  │ │ 測試數量: 100 | 改善: 45 | 惡化: 5 | 無變化: 50              ││  │   │
│  │  │ │ 準確率: 75% → 90% (+15%)                                     ││  │   │
│  │  │ └─────────────────────────────────────────────────────────────┘│  │   │
│  │  │                                                                 │  │   │
│  │  │ [改善案例 Tab] [惡化案例 Tab] [無變化 Tab]                       │  │   │
│  │  │                                                                 │  │   │
│  │  │ ┌─────────────────────────────────────────────────────────────┐│  │   │
│  │  │ │ Comparison Table                                             ││  │   │
│  │  │ │ ┌────────┬──────────┬──────────┬──────────┬────────┐        ││  │   │
│  │  │ │ │ 文件   │ 原規則    │ 新規則    │ 實際值    │ 狀態   │        ││  │   │
│  │  │ │ ├────────┼──────────┼──────────┼──────────┼────────┤        ││  │   │
│  │  │ │ │doc.pdf │ ❌ N/A   │ ✅ INV123│ INV123   │ 🟢改善 │        ││  │   │
│  │  │ │ │inv.pdf │ ✅ ABC   │ ❌ XYZ   │ ABC      │ 🔴惡化 │        ││  │   │
│  │  │ │ └────────┴──────────┴──────────┴──────────┴────────┘        ││  │   │
│  │  │ └─────────────────────────────────────────────────────────────┘│  │   │
│  │  │                                                                 │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/
│   ├── api/rules/suggestions/[id]/
│   │   ├── impact/
│   │   │   └── route.ts                    # GET 影響分析報告 API
│   │   └── simulate/
│   │       └── route.ts                    # POST 模擬測試 API
│   └── (dashboard)/rules/suggestions/[id]/
│       └── impact/
│           └── page.tsx                    # 影響分析頁面
├── components/features/impact/
│   ├── ImpactAnalysisPage.tsx              # 影響分析主頁面
│   ├── ImpactStatisticsCards.tsx           # 統計摘要卡片
│   ├── RiskCasesTable.tsx                  # 風險案例表格
│   ├── ImpactTimelineChart.tsx             # 時間軸圖表
│   ├── SimulationDialog.tsx                # 模擬配置對話框
│   ├── SimulationResults.tsx               # 模擬結果顯示
│   ├── ImpactComparisonTable.tsx           # 對比表格
│   └── CaseDetailDialog.tsx                # 案例詳情對話框
├── services/
│   ├── impact-analysis.ts                  # 影響分析服務
│   └── rule-simulation.ts                  # 規則模擬服務
├── hooks/
│   ├── useImpactAnalysis.ts                # 影響分析 Hook
│   └── useSimulation.ts                    # 模擬測試 Hook
└── types/
    └── impact.ts                           # 影響分析相關類型
```

---

## 4. Implementation Guide

### Phase 1: Type Definitions

**File**: `src/types/impact.ts`

```typescript
// ===== 風險等級 =====

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

// ===== 影響分析類型 =====

export interface ImpactStatistics {
  totalAffected: number        // 受影響的歷史文件數
  estimatedImprovement: number // 預計改善數量
  estimatedRegression: number  // 可能惡化數量
  unchanged: number            // 無變化數量
  improvementRate: number      // 改善率百分比
  regressionRate: number       // 惡化率百分比
}

export interface RiskCase {
  documentId: string
  fileName: string
  currentValue: string | null
  predictedValue: string | null
  riskLevel: RiskLevel
  reason: string
}

export interface TimelineItem {
  date: string
  affectedCount: number
  improvedCount: number
  regressedCount: number
}

export interface ImpactAnalysisResult {
  suggestion: {
    id: string
    fieldName: string
    forwarderName: string
    currentPattern: string | null
    suggestedPattern: string
    extractionType: string
  }
  statistics: ImpactStatistics
  riskCases: RiskCase[]
  timeline: TimelineItem[]
  analysisDate: string
}

// ===== 影響分析 API 響應 =====

export interface ImpactAnalysisResponse {
  success: true
  data: ImpactAnalysisResult
}

// ===== 模擬測試類型 =====

export interface SimulationRequest {
  sampleSize?: number        // 默認 100
  dateRange?: {
    start: string
    end: string
  }
  includeUnverified?: boolean // 是否包含未驗證的文件
}

export interface SimulationCase {
  documentId: string
  fileName: string
  originalExtracted: string | null
  currentRuleResult: string | null
  newRuleResult: string | null
  actualValue: string | null
  currentAccurate: boolean
  newAccurate: boolean
  changeType: 'improved' | 'regressed' | 'unchanged'
}

export interface SimulationSummary {
  totalTested: number
  improvedCount: number
  regressedCount: number
  unchangedCount: number
  accuracyBefore: number | null
  accuracyAfter: number | null
  accuracyChange: number | null
}

export interface SimulationResult {
  simulationId: string
  suggestionId: string
  totalTested: number
  results: {
    improved: SimulationCase[]
    regressed: SimulationCase[]
    unchanged: SimulationCase[]
  }
  summary: SimulationSummary
  executedAt: string
  duration: number
}

// ===== 模擬測試 API 響應 =====

export interface SimulationResponse {
  success: true
  data: SimulationResult
}

// ===== 風險等級配置 =====

export const RISK_LEVELS: {
  value: RiskLevel
  label: string
  color: string
  icon: string
}[] = [
  {
    value: 'HIGH',
    label: '高風險',
    color: 'destructive',
    icon: 'AlertTriangle'
  },
  {
    value: 'MEDIUM',
    label: '中風險',
    color: 'warning',
    icon: 'AlertCircle'
  },
  {
    value: 'LOW',
    label: '低風險',
    color: 'secondary',
    icon: 'Info'
  }
]

// ===== 模擬配置選項 =====

export const SAMPLE_SIZE_OPTIONS = [
  { value: 50, label: '50 筆' },
  { value: 100, label: '100 筆（建議）' },
  { value: 200, label: '200 筆' },
  { value: 500, label: '500 筆' }
]

export const DATE_RANGE_OPTIONS = [
  { value: 7, label: '最近 7 天' },
  { value: 30, label: '最近 30 天（建議）' },
  { value: 90, label: '最近 90 天' },
  { value: 180, label: '最近 180 天' }
]
```

---

### Phase 2: Core Services

#### 4.2.1 影響分析服務

**File**: `src/services/impact-analysis.ts`

```typescript
import { prisma } from '@/lib/prisma'
import {
  ImpactAnalysisResult,
  ImpactStatistics,
  RiskCase,
  TimelineItem,
  RiskLevel
} from '@/types/impact'

/**
 * 影響分析服務
 * 分析規則變更對歷史數據的影響
 */
export class ImpactAnalysisService {
  /**
   * 執行影響分析
   */
  async analyze(suggestionId: string): Promise<ImpactAnalysisResult> {
    // 獲取建議詳情
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        forwarder: {
          select: { id: true, name: true }
        }
      }
    })

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`)
    }

    // 獲取最近 90 天的相關文件
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const documents = await prisma.document.findMany({
      where: {
        forwarderId: suggestion.forwarderId,
        createdAt: { gte: ninetyDaysAgo }
      },
      include: {
        extractedFields: {
          where: { fieldName: suggestion.fieldName }
        },
        corrections: {
          where: { fieldName: suggestion.fieldName }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 計算統計數據
    const statistics = await this.calculateStatistics(documents, suggestion)

    // 識別風險案例
    const riskCases = await this.identifyRiskCases(documents, suggestion)

    // 生成時間軸數據
    const timeline = this.generateTimeline(documents, suggestion)

    return {
      suggestion: {
        id: suggestion.id,
        fieldName: suggestion.fieldName,
        forwarderName: suggestion.forwarder.name,
        currentPattern: suggestion.currentPattern,
        suggestedPattern: suggestion.suggestedPattern,
        extractionType: suggestion.extractionType
      },
      statistics,
      riskCases,
      timeline,
      analysisDate: new Date().toISOString()
    }
  }

  /**
   * 計算統計數據
   */
  private async calculateStatistics(
    documents: any[],
    suggestion: any
  ): Promise<ImpactStatistics> {
    let totalAffected = 0
    let estimatedImprovement = 0
    let estimatedRegression = 0
    let unchanged = 0

    for (const doc of documents) {
      const extraction = doc.extractedFields[0]
      const correction = doc.corrections[0]

      // 跳過沒有提取結果且沒有修正的文件
      if (!extraction && !correction) continue

      totalAffected++

      // 獲取實際值（修正值優先）
      const actualValue = correction?.correctedValue || extraction?.value

      // 模擬當前規則結果
      const currentResult = this.applyPattern(
        doc.rawText || '',
        suggestion.currentPattern,
        suggestion.extractionType
      )

      // 模擬新規則結果
      const newResult = this.applyPattern(
        doc.rawText || '',
        suggestion.suggestedPattern,
        suggestion.extractionType
      )

      const currentAccurate = currentResult === actualValue
      const newAccurate = newResult === actualValue

      if (!currentAccurate && newAccurate) {
        estimatedImprovement++
      } else if (currentAccurate && !newAccurate) {
        estimatedRegression++
      } else {
        unchanged++
      }
    }

    const improvementRate = totalAffected > 0
      ? (estimatedImprovement / totalAffected) * 100
      : 0

    const regressionRate = totalAffected > 0
      ? (estimatedRegression / totalAffected) * 100
      : 0

    return {
      totalAffected,
      estimatedImprovement,
      estimatedRegression,
      unchanged,
      improvementRate: Math.round(improvementRate * 10) / 10,
      regressionRate: Math.round(regressionRate * 10) / 10
    }
  }

  /**
   * 識別風險案例
   */
  private async identifyRiskCases(
    documents: any[],
    suggestion: any
  ): Promise<RiskCase[]> {
    const riskCases: RiskCase[] = []

    for (const doc of documents) {
      const extraction = doc.extractedFields[0]
      const correction = doc.corrections[0]

      // 獲取實際值
      const actualValue = correction?.correctedValue || extraction?.value
      if (!actualValue) continue

      // 模擬當前規則結果
      const currentResult = this.applyPattern(
        doc.rawText || '',
        suggestion.currentPattern,
        suggestion.extractionType
      )

      // 模擬新規則結果
      const newResult = this.applyPattern(
        doc.rawText || '',
        suggestion.suggestedPattern,
        suggestion.extractionType
      )

      // 判斷風險等級
      const riskLevel = this.assessRiskLevel(currentResult, newResult, actualValue)

      if (riskLevel) {
        riskCases.push({
          documentId: doc.id,
          fileName: doc.fileName,
          currentValue: currentResult,
          predictedValue: newResult,
          riskLevel: riskLevel.level,
          reason: riskLevel.reason
        })
      }
    }

    // 按風險等級排序，高風險在前
    const levelOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    riskCases.sort((a, b) => levelOrder[a.riskLevel] - levelOrder[b.riskLevel])

    return riskCases.slice(0, 20) // 最多返回 20 個風險案例
  }

  /**
   * 評估風險等級
   */
  private assessRiskLevel(
    currentResult: string | null,
    newResult: string | null,
    actualValue: string
  ): { level: RiskLevel; reason: string } | null {
    const currentAccurate = currentResult === actualValue
    const newAccurate = newResult === actualValue

    // 惡化案例：當前正確 → 新規則錯誤
    if (currentAccurate && !newAccurate) {
      if (!newResult) {
        return { level: 'HIGH', reason: '新規則無法提取（當前規則可正確提取）' }
      }
      return { level: 'HIGH', reason: '新規則產生錯誤結果' }
    }

    // 當前錯誤 → 新規則仍錯誤（可能惡化更嚴重）
    if (!currentAccurate && !newAccurate && newResult && currentResult) {
      // 比較哪個更接近實際值
      const currentSimilarity = this.calculateSimilarity(currentResult, actualValue)
      const newSimilarity = this.calculateSimilarity(newResult, actualValue)

      if (newSimilarity < currentSimilarity - 0.2) {
        return { level: 'MEDIUM', reason: '新規則結果偏離更遠' }
      }
    }

    // 格式變化（可能的兼容性問題）
    if (newAccurate && currentAccurate && newResult !== currentResult) {
      return { level: 'LOW', reason: '提取格式可能變化' }
    }

    return null // 無風險
  }

  /**
   * 生成時間軸數據
   */
  private generateTimeline(
    documents: any[],
    suggestion: any
  ): TimelineItem[] {
    const timeline: Map<string, TimelineItem> = new Map()

    for (const doc of documents) {
      const date = doc.createdAt.toISOString().split('T')[0]

      if (!timeline.has(date)) {
        timeline.set(date, {
          date,
          affectedCount: 0,
          improvedCount: 0,
          regressedCount: 0
        })
      }

      const item = timeline.get(date)!
      item.affectedCount++

      const extraction = doc.extractedFields[0]
      const correction = doc.corrections[0]
      const actualValue = correction?.correctedValue || extraction?.value

      if (actualValue) {
        const currentResult = this.applyPattern(
          doc.rawText || '',
          suggestion.currentPattern,
          suggestion.extractionType
        )
        const newResult = this.applyPattern(
          doc.rawText || '',
          suggestion.suggestedPattern,
          suggestion.extractionType
        )

        const currentAccurate = currentResult === actualValue
        const newAccurate = newResult === actualValue

        if (!currentAccurate && newAccurate) {
          item.improvedCount++
        } else if (currentAccurate && !newAccurate) {
          item.regressedCount++
        }
      }
    }

    // 轉換為數組並按日期排序
    return Array.from(timeline.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // 最近 30 天
  }

  /**
   * 應用模式提取
   */
  private applyPattern(
    text: string,
    pattern: string | null,
    extractionType: string
  ): string | null {
    if (!pattern || !text) return null

    try {
      switch (extractionType) {
        case 'REGEX':
          const regex = new RegExp(pattern)
          const match = text.match(regex)
          return match ? match[0] : null

        case 'KEYWORD':
          const config = JSON.parse(pattern)
          return this.applyKeywordRules(text, config.rules)

        default:
          return null
      }
    } catch {
      return null
    }
  }

  /**
   * 應用關鍵字規則
   */
  private applyKeywordRules(
    text: string,
    rules: { action: string; value?: string; pattern?: string }[]
  ): string {
    let result = text

    for (const rule of rules) {
      if (rule.action === 'remove_prefix' && rule.value && result.startsWith(rule.value)) {
        result = result.slice(rule.value.length)
      } else if (rule.action === 'remove_suffix' && rule.value && result.endsWith(rule.value)) {
        result = result.slice(0, -rule.value.length)
      } else if (rule.action === 'normalize' && rule.pattern) {
        result = result.replace(new RegExp(rule.pattern, 'g'), '')
      }
    }

    return result
  }

  /**
   * 計算字串相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()

    if (s1 === s2) return 1

    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1

    if (longer.length === 0) return 1

    return (longer.length - this.editDistance(longer, shorter)) / longer.length
  }

  /**
   * 編輯距離
   */
  private editDistance(s1: string, s2: string): number {
    const m = s1.length
    const n = s2.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
        }
      }
    }

    return dp[m][n]
  }
}

export const impactAnalysisService = new ImpactAnalysisService()
```

#### 4.2.2 規則模擬服務

**File**: `src/services/rule-simulation.ts`

```typescript
import { prisma } from '@/lib/prisma'
import {
  SimulationRequest,
  SimulationResult,
  SimulationCase,
  SimulationSummary
} from '@/types/impact'
import { v4 as uuidv4 } from 'uuid'

/**
 * 規則模擬服務
 * 對歷史數據執行規則模擬測試
 */
export class RuleSimulationService {
  /**
   * 執行模擬測試
   */
  async simulate(
    suggestionId: string,
    options: SimulationRequest = {}
  ): Promise<SimulationResult> {
    const startTime = Date.now()

    const {
      sampleSize = 100,
      dateRange,
      includeUnverified = false
    } = options

    // 獲取建議詳情
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        forwarder: true
      }
    })

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`)
    }

    // 構建日期範圍
    let startDate: Date
    let endDate = new Date()

    if (dateRange) {
      startDate = new Date(dateRange.start)
      endDate = new Date(dateRange.end)
    } else {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30) // 默認最近 30 天
    }

    // 獲取樣本文件
    const documents = await this.getSampleDocuments(
      suggestion.forwarderId,
      suggestion.fieldName,
      startDate,
      endDate,
      sampleSize,
      includeUnverified
    )

    // 對每個文件執行模擬
    const cases: SimulationCase[] = []

    for (const doc of documents) {
      const simulationCase = await this.simulateDocument(doc, suggestion)
      cases.push(simulationCase)
    }

    // 分類結果
    const results = {
      improved: cases.filter(c => c.changeType === 'improved'),
      regressed: cases.filter(c => c.changeType === 'regressed'),
      unchanged: cases.filter(c => c.changeType === 'unchanged')
    }

    // 計算摘要
    const summary = this.calculateSummary(cases)

    const duration = Date.now() - startTime

    return {
      simulationId: uuidv4(),
      suggestionId,
      totalTested: cases.length,
      results,
      summary,
      executedAt: new Date().toISOString(),
      duration
    }
  }

  /**
   * 獲取樣本文件
   */
  private async getSampleDocuments(
    forwarderId: string,
    fieldName: string,
    startDate: Date,
    endDate: Date,
    sampleSize: number,
    includeUnverified: boolean
  ): Promise<any[]> {
    const where: any = {
      forwarderId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    // 如果不包含未驗證的，需要有修正記錄或確認記錄
    if (!includeUnverified) {
      where.OR = [
        { corrections: { some: { fieldName } } },
        { extractedFields: { some: { fieldName, isVerified: true } } }
      ]
    }

    return prisma.document.findMany({
      where,
      include: {
        extractedFields: {
          where: { fieldName }
        },
        corrections: {
          where: { fieldName }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: sampleSize
    })
  }

  /**
   * 對單一文件執行模擬
   */
  private async simulateDocument(
    document: any,
    suggestion: any
  ): Promise<SimulationCase> {
    const extraction = document.extractedFields[0]
    const correction = document.corrections[0]

    // 原始提取值
    const originalExtracted = extraction?.value || null

    // 實際值（用戶確認/修正後）
    const actualValue = correction?.correctedValue || extraction?.value || null

    // 應用當前規則
    const currentRuleResult = this.applyRule(
      document.rawText || '',
      suggestion.currentPattern,
      suggestion.extractionType
    )

    // 應用新規則
    const newRuleResult = this.applyRule(
      document.rawText || '',
      suggestion.suggestedPattern,
      suggestion.extractionType
    )

    // 判斷準確性
    const currentAccurate = actualValue !== null && currentRuleResult === actualValue
    const newAccurate = actualValue !== null && newRuleResult === actualValue

    // 確定變化類型
    let changeType: 'improved' | 'regressed' | 'unchanged'
    if (!currentAccurate && newAccurate) {
      changeType = 'improved'
    } else if (currentAccurate && !newAccurate) {
      changeType = 'regressed'
    } else {
      changeType = 'unchanged'
    }

    return {
      documentId: document.id,
      fileName: document.fileName,
      originalExtracted,
      currentRuleResult,
      newRuleResult,
      actualValue,
      currentAccurate,
      newAccurate,
      changeType
    }
  }

  /**
   * 應用規則
   */
  private applyRule(
    text: string,
    pattern: string | null,
    extractionType: string
  ): string | null {
    if (!pattern || !text) return null

    try {
      switch (extractionType) {
        case 'REGEX':
          const regex = new RegExp(pattern)
          const match = text.match(regex)
          return match ? match[0] : null

        case 'KEYWORD':
          const config = JSON.parse(pattern)
          return this.applyKeywordRules(text, config.rules)

        case 'POSITION':
          // 位置提取需要 PDF 座標，這裡簡化處理
          return null

        default:
          return null
      }
    } catch {
      return null
    }
  }

  /**
   * 應用關鍵字規則
   */
  private applyKeywordRules(
    text: string,
    rules: { action: string; value?: string; pattern?: string }[]
  ): string {
    let result = text

    for (const rule of rules) {
      switch (rule.action) {
        case 'remove_prefix':
          if (rule.value && result.startsWith(rule.value)) {
            result = result.slice(rule.value.length)
          }
          break
        case 'remove_suffix':
          if (rule.value && result.endsWith(rule.value)) {
            result = result.slice(0, -rule.value.length)
          }
          break
        case 'normalize':
          if (rule.pattern) {
            result = result.replace(new RegExp(rule.pattern, 'g'), '')
          }
          break
        case 'extract':
          if (rule.pattern) {
            const match = result.match(new RegExp(rule.pattern))
            result = match ? match[0] : result
          }
          break
      }
    }

    return result
  }

  /**
   * 計算摘要統計
   */
  private calculateSummary(cases: SimulationCase[]): SimulationSummary {
    const totalTested = cases.length
    const improvedCount = cases.filter(c => c.changeType === 'improved').length
    const regressedCount = cases.filter(c => c.changeType === 'regressed').length
    const unchangedCount = cases.filter(c => c.changeType === 'unchanged').length

    // 計算準確率
    const casesWithActual = cases.filter(c => c.actualValue !== null)
    const currentAccurateCount = casesWithActual.filter(c => c.currentAccurate).length
    const newAccurateCount = casesWithActual.filter(c => c.newAccurate).length

    const accuracyBefore = casesWithActual.length > 0
      ? (currentAccurateCount / casesWithActual.length) * 100
      : null

    const accuracyAfter = casesWithActual.length > 0
      ? (newAccurateCount / casesWithActual.length) * 100
      : null

    const accuracyChange = accuracyBefore !== null && accuracyAfter !== null
      ? accuracyAfter - accuracyBefore
      : null

    return {
      totalTested,
      improvedCount,
      regressedCount,
      unchangedCount,
      accuracyBefore: accuracyBefore !== null ? Math.round(accuracyBefore * 10) / 10 : null,
      accuracyAfter: accuracyAfter !== null ? Math.round(accuracyAfter * 10) / 10 : null,
      accuracyChange: accuracyChange !== null ? Math.round(accuracyChange * 10) / 10 : null
    }
  }
}

export const ruleSimulationService = new RuleSimulationService()
```

---

### Phase 3: API Layer (AC1, AC2, AC3)

#### 4.3.1 影響分析 API

**File**: `src/app/api/rules/suggestions/[id]/impact/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { impactAnalysisService } from '@/services/impact-analysis'

interface RouteParams {
  params: { id: string }
}

// GET /api/rules/suggestions/[id]/impact - 獲取影響分析報告
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

  const { id: suggestionId } = params

  try {
    const result = await impactAnalysisService.analyze(suggestionId)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Failed to analyze impact:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404 : 500

    return NextResponse.json({
      success: false,
      error: {
        type: status === 404 ? 'not_found' : 'internal_error',
        title: status === 404 ? 'Not Found' : 'Internal Server Error',
        status,
        detail: message
      }
    }, { status })
  }
}
```

#### 4.3.2 模擬測試 API

**File**: `src/app/api/rules/suggestions/[id]/simulate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { ruleSimulationService } from '@/services/rule-simulation'
import { z } from 'zod'

interface RouteParams {
  params: { id: string }
}

const simulateSchema = z.object({
  sampleSize: z.number().min(10).max(500).optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  includeUnverified: z.boolean().optional()
})

// POST /api/rules/suggestions/[id]/simulate - 執行模擬測試
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const { id: suggestionId } = params

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = simulateSchema.safeParse(body)

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

    const result = await ruleSimulationService.simulate(
      suggestionId,
      parsed.data
    )

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Failed to run simulation:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404 : 500

    return NextResponse.json({
      success: false,
      error: {
        type: status === 404 ? 'not_found' : 'internal_error',
        title: status === 404 ? 'Not Found' : 'Internal Server Error',
        status,
        detail: message
      }
    }, { status })
  }
}
```

---

### Phase 4: React Query Hooks

**File**: `src/hooks/useImpactAnalysis.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { ImpactAnalysisResponse } from '@/types/impact'

async function fetchImpactAnalysis(
  suggestionId: string
): Promise<ImpactAnalysisResponse> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/impact`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to fetch impact analysis')
  }

  return result
}

export function useImpactAnalysis(suggestionId: string | undefined) {
  return useQuery({
    queryKey: ['impact-analysis', suggestionId],
    queryFn: () => fetchImpactAnalysis(suggestionId!),
    enabled: !!suggestionId,
    staleTime: 5 * 60 * 1000 // 5 分鐘
  })
}
```

**File**: `src/hooks/useSimulation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SimulationRequest, SimulationResponse } from '@/types/impact'

async function runSimulation(
  suggestionId: string,
  options: SimulationRequest
): Promise<SimulationResponse> {
  const response = await fetch(`/api/rules/suggestions/${suggestionId}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to run simulation')
  }

  return result
}

export function useSimulation(suggestionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (options: SimulationRequest) => runSimulation(suggestionId, options),
    onSuccess: () => {
      // 刷新影響分析數據
      queryClient.invalidateQueries({
        queryKey: ['impact-analysis', suggestionId]
      })
    }
  })
}
```

---

### Phase 5: UI Components (AC1, AC2, AC3)

#### 4.5.1 影響分析頁面

**File**: `src/app/(dashboard)/rules/suggestions/[id]/impact/page.tsx`

```typescript
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { ImpactAnalysisPage } from '@/components/features/impact/ImpactAnalysisPage'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: { id: string }
}

export const metadata = {
  title: '影響分析 - 規則升級建議',
  description: '查看規則變更的影響範圍分析'
}

export default async function ImpactPage({ params }: PageProps) {
  const session = await auth()

  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )

  if (!hasPermission) {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<ImpactPageSkeleton />}>
        <ImpactAnalysisPage suggestionId={params.id} />
      </Suspense>
    </div>
  )
}

function ImpactPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
```

#### 4.5.2 影響分析主組件

**File**: `src/components/features/impact/ImpactAnalysisPage.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useImpactAnalysis } from '@/hooks/useImpactAnalysis'
import { useSimulation } from '@/hooks/useSimulation'
import { ImpactStatisticsCards } from './ImpactStatisticsCards'
import { RiskCasesTable } from './RiskCasesTable'
import { ImpactTimelineChart } from './ImpactTimelineChart'
import { SimulationDialog } from './SimulationDialog'
import { SimulationResults } from './SimulationResults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Play,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { SimulationRequest, SimulationResult } from '@/types/impact'

interface ImpactAnalysisPageProps {
  suggestionId: string
}

export function ImpactAnalysisPage({ suggestionId }: ImpactAnalysisPageProps) {
  const router = useRouter()
  const [showSimulationDialog, setShowSimulationDialog] = useState(false)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)

  const {
    data: impactData,
    isLoading,
    error,
    refetch
  } = useImpactAnalysis(suggestionId)

  const simulation = useSimulation(suggestionId)

  const handleRunSimulation = async (options: SimulationRequest) => {
    try {
      const result = await simulation.mutateAsync(options)
      setSimulationResult(result.data)
      setShowSimulationDialog(false)
    } catch (error) {
      console.error('Simulation failed:', error)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">載入中...</div>
  }

  if (error || !impactData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">載入失敗</h3>
        <p className="text-sm text-muted-foreground mb-4">{error?.message}</p>
        <Button onClick={() => refetch()}>重試</Button>
      </div>
    )
  }

  const { suggestion, statistics, riskCases, timeline } = impactData.data

  return (
    <div className="space-y-6">
      {/* 標頭 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/rules/suggestions/${suggestionId}`)}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回建議詳情
          </Button>
          <h1 className="text-2xl font-bold">影響範圍分析</h1>
          <p className="text-muted-foreground">
            {suggestion.forwarderName} - {suggestion.fieldName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新分析
          </Button>
          <Button
            onClick={() => setShowSimulationDialog(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            運行模擬測試
          </Button>
        </div>
      </div>

      {/* 統計摘要 */}
      <ImpactStatisticsCards statistics={statistics} />

      {/* 規則對比 */}
      <Card>
        <CardHeader>
          <CardTitle>規則對比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                當前規則
              </h4>
              <pre className="p-3 bg-muted rounded-md text-sm overflow-x-auto">
                {suggestion.currentPattern || '（無現有規則）'}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                建議規則
              </h4>
              <pre className="p-3 bg-muted rounded-md text-sm overflow-x-auto">
                {suggestion.suggestedPattern}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 分頁內容 */}
      <Tabs defaultValue="risks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="risks">
            <AlertTriangle className="h-4 w-4 mr-2" />
            風險案例 ({riskCases.length})
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <TrendingUp className="h-4 w-4 mr-2" />
            時間趨勢
          </TabsTrigger>
          {simulationResult && (
            <TabsTrigger value="simulation">
              <Play className="h-4 w-4 mr-2" />
              模擬結果
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle>潛在風險案例</CardTitle>
            </CardHeader>
            <CardContent>
              <RiskCasesTable cases={riskCases} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>影響趨勢</CardTitle>
            </CardHeader>
            <CardContent>
              <ImpactTimelineChart data={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        {simulationResult && (
          <TabsContent value="simulation">
            <SimulationResults result={simulationResult} />
          </TabsContent>
        )}
      </Tabs>

      {/* 模擬配置對話框 */}
      <SimulationDialog
        open={showSimulationDialog}
        onOpenChange={setShowSimulationDialog}
        onSubmit={handleRunSimulation}
        isLoading={simulation.isPending}
      />
    </div>
  )
}
```

#### 4.5.3 統計摘要卡片

**File**: `src/components/features/impact/ImpactStatisticsCards.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImpactStatistics } from '@/types/impact'
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Percent
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImpactStatisticsCardsProps {
  statistics: ImpactStatistics
}

export function ImpactStatisticsCards({ statistics }: ImpactStatisticsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            受影響文件
          </CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.totalAffected}</div>
          <p className="text-xs text-muted-foreground">
            最近 90 天內的相關文件
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            預計改善
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {statistics.estimatedImprovement}
          </div>
          <p className="text-xs text-muted-foreground">
            {statistics.improvementRate}% 的文件將受益
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            可能惡化
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className={cn(
            'text-2xl font-bold',
            statistics.estimatedRegression > 0 ? 'text-red-600' : 'text-muted-foreground'
          )}>
            {statistics.estimatedRegression}
          </div>
          <p className="text-xs text-muted-foreground">
            {statistics.regressionRate}% 的文件可能受負面影響
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            改善率
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={cn(
            'text-2xl font-bold',
            statistics.improvementRate > statistics.regressionRate
              ? 'text-green-600'
              : statistics.regressionRate > statistics.improvementRate
                ? 'text-red-600'
                : 'text-muted-foreground'
          )}>
            {statistics.improvementRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            淨改善 {statistics.estimatedImprovement - statistics.estimatedRegression} 件
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 4.5.4 對比表格組件

**File**: `src/components/features/impact/ImpactComparisonTable.tsx`

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SimulationCase } from '@/types/impact'
import { Check, X, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImpactComparisonTableProps {
  results: SimulationCase[]
  type: 'improved' | 'regressed' | 'unchanged'
  onViewDetail?: (documentId: string) => void
}

export function ImpactComparisonTable({
  results,
  type,
  onViewDetail
}: ImpactComparisonTableProps) {
  const getStatusBadge = () => {
    switch (type) {
      case 'improved':
        return <Badge className="bg-green-500">改善</Badge>
      case 'regressed':
        return <Badge className="bg-red-500">惡化</Badge>
      default:
        return <Badge variant="secondary">無變化</Badge>
    }
  }

  const getAccuracyIcon = (accurate: boolean) => {
    if (accurate) {
      return <Check className="h-4 w-4 text-green-600" />
    }
    return <X className="h-4 w-4 text-red-600" />
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        沒有{type === 'improved' ? '改善' : type === 'regressed' ? '惡化' : '無變化'}的案例
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">文件</TableHead>
            <TableHead>原規則結果</TableHead>
            <TableHead>新規則結果</TableHead>
            <TableHead>實際值</TableHead>
            <TableHead className="w-[100px] text-center">狀態</TableHead>
            {onViewDetail && (
              <TableHead className="w-[80px]"></TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.documentId}>
              <TableCell className="font-medium">
                <div className="truncate max-w-[180px]" title={result.fileName}>
                  {result.fileName}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getAccuracyIcon(result.currentAccurate)}
                  <span className={cn(
                    result.currentAccurate ? 'text-green-600' : 'text-red-600'
                  )}>
                    {result.currentRuleResult || '（無法提取）'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getAccuracyIcon(result.newAccurate)}
                  <span className={cn(
                    result.newAccurate ? 'text-green-600' : 'text-red-600'
                  )}>
                    {result.newRuleResult || '（無法提取）'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">
                  {result.actualValue || '（未確認）'}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {getStatusBadge()}
              </TableCell>
              {onViewDetail && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetail(result.documentId)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/services/impact-analysis.test.ts`

```typescript
import { ImpactAnalysisService } from '@/services/impact-analysis'

describe('ImpactAnalysisService', () => {
  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const service = new ImpactAnalysisService()
      const result = service['calculateSimilarity']('hello', 'hello')
      expect(result).toBe(1)
    })

    it('should return value between 0 and 1 for similar strings', () => {
      const service = new ImpactAnalysisService()
      const result = service['calculateSimilarity']('hello', 'hallo')
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })
  })

  describe('assessRiskLevel', () => {
    it('should return HIGH for regression cases', () => {
      const service = new ImpactAnalysisService()
      const result = service['assessRiskLevel']('correct', 'wrong', 'correct')
      expect(result?.level).toBe('HIGH')
    })

    it('should return null for improvement cases', () => {
      const service = new ImpactAnalysisService()
      const result = service['assessRiskLevel']('wrong', 'correct', 'correct')
      expect(result).toBeNull()
    })
  })
})
```

### 5.2 Integration Tests

**File**: `tests/integration/impact-analysis.test.ts`

```typescript
import { impactAnalysisService } from '@/services/impact-analysis'
import { ruleSimulationService } from '@/services/rule-simulation'
import { prisma } from '@/lib/prisma'

describe('Impact Analysis Integration', () => {
  it('should analyze impact for valid suggestion', async () => {
    const result = await impactAnalysisService.analyze('test-suggestion-id')

    expect(result.suggestion).toBeDefined()
    expect(result.statistics).toBeDefined()
    expect(result.statistics.totalAffected).toBeGreaterThanOrEqual(0)
    expect(result.riskCases).toBeDefined()
    expect(result.timeline).toBeDefined()
  })

  it('should throw error for non-existent suggestion', async () => {
    await expect(
      impactAnalysisService.analyze('non-existent-id')
    ).rejects.toThrow('not found')
  })
})

describe('Rule Simulation Integration', () => {
  it('should simulate with default options', async () => {
    const result = await ruleSimulationService.simulate('test-suggestion-id')

    expect(result.simulationId).toBeDefined()
    expect(result.totalTested).toBeGreaterThanOrEqual(0)
    expect(result.results.improved).toBeDefined()
    expect(result.results.regressed).toBeDefined()
    expect(result.results.unchanged).toBeDefined()
    expect(result.summary).toBeDefined()
  })

  it('should respect sample size option', async () => {
    const result = await ruleSimulationService.simulate('test-suggestion-id', {
      sampleSize: 50
    })

    expect(result.totalTested).toBeLessThanOrEqual(50)
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 影響分析報告
  - [ ] 顯示受影響的歷史發票數量
  - [ ] 顯示預計改善率
  - [ ] 顯示可能受負面影響的案例
  - [ ] 顯示風險等級標記

- [ ] **AC2**: 測試運行功能
  - [ ] 提供模擬測試按鈕
  - [ ] 支援自定義樣本大小
  - [ ] 支援日期範圍篩選
  - [ ] 對歷史數據進行模擬測試

- [ ] **AC3**: 對比結果顯示
  - [ ] 顯示原規則 vs 新規則結果
  - [ ] 標記改善案例（綠色）
  - [ ] 標記惡化案例（紅色）
  - [ ] 標記無變化案例
  - [ ] 支援查看案例詳情

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 權限檢查正確（RULE_VIEW / RULE_MANAGE）
- [ ] 模擬測試支援多種提取類型
- [ ] 大數據量處理優化

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/types/impact.ts` | Create | 影響分析相關類型定義 |
| `src/services/impact-analysis.ts` | Create | 影響分析服務 |
| `src/services/rule-simulation.ts` | Create | 規則模擬服務 |
| `src/app/api/rules/suggestions/[id]/impact/route.ts` | Create | 影響分析 API |
| `src/app/api/rules/suggestions/[id]/simulate/route.ts` | Create | 模擬測試 API |
| `src/hooks/useImpactAnalysis.ts` | Create | 影響分析 Hook |
| `src/hooks/useSimulation.ts` | Create | 模擬測試 Hook |
| `src/app/(dashboard)/rules/suggestions/[id]/impact/page.tsx` | Create | 影響分析頁面 |
| `src/components/features/impact/*.tsx` | Create | 影響分析 UI 組件 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 4-5-rule-impact-scope-analysis*
