# Story 4.5: 規則影響範圍分析

**Status:** done

---

## Story

**As a** Super User,
**I want** 在規則升級前查看影響範圍分析,
**So that** 我可以評估變更的風險。

---

## Acceptance Criteria

### AC1: 影響分析報告

**Given** 查看規則升級建議
**When** 點擊「影響分析」
**Then** 顯示：受影響的歷史發票數量、預計改善率、可能受負面影響的案例

### AC2: 測試運行功能

**Given** 影響分析完成
**When** 顯示結果
**Then** 提供測試運行功能，可對歷史數據進行模擬測試

### AC3: 對比結果

**Given** 模擬測試完成
**When** 顯示測試結果
**Then** 對比原規則 vs 新規則結果，標記改善和惡化的案例

---

## Tasks / Subtasks

- [x] **Task 1: 影響分析頁面** (AC: #1)
  - [x] 1.1 創建 `src/app/(dashboard)/rules/suggestions/[id]/impact/page.tsx`
  - [x] 1.2 設計分析報告佈局
  - [x] 1.3 顯示摘要統計

- [x] **Task 2: 影響統計計算** (AC: #1)
  - [x] 2.1 計算受影響文件數量
  - [x] 2.2 計算預計改善率
  - [x] 2.3 識別風險案例
  - [x] 2.4 生成統計圖表

- [x] **Task 3: 影響分析 API** (AC: #1)
  - [x] 3.1 創建 GET `/api/rules/suggestions/[id]/impact`
  - [x] 3.2 執行影響計算
  - [x] 3.3 返回詳細報告

- [x] **Task 4: 模擬測試服務** (AC: #2)
  - [x] 4.1 創建 `src/services/rule-simulation.ts`
  - [x] 4.2 對歷史數據應用新規則
  - [x] 4.3 記錄模擬結果
  - [x] 4.4 計算差異

- [x] **Task 5: 測試運行 API** (AC: #2)
  - [x] 5.1 創建 POST `/api/rules/suggestions/[id]/simulate`
  - [x] 5.2 執行模擬測試
  - [x] 5.3 返回測試結果
  - [x] 5.4 支援分頁瀏覽

- [x] **Task 6: 對比結果顯示** (AC: #3)
  - [x] 6.1 創建對比表格組件
  - [x] 6.2 顯示原值 vs 新值
  - [x] 6.3 標記改善案例（綠色）
  - [x] 6.4 標記惡化案例（紅色）
  - [x] 6.5 標記無變化案例

- [x] **Task 7: 案例詳情查看** (AC: #3)
  - [x] 7.1 點擊案例查看詳情
  - [x] 7.2 顯示原始文件
  - [x] 7.3 顯示提取對比

- [x] **Task 8: 驗證與測試** (AC: #1-3)
  - [x] 8.1 測試影響分析
  - [x] 8.2 測試模擬運行
  - [x] 8.3 測試對比顯示
  - [x] 8.4 測試大數據量處理

---

## Implementation Notes (2025-12-19)

### 已完成項目

#### Phase 1: Type Definitions
- 建立 `src/types/impact.ts` - 完整的影響分析類型定義
  - `ImpactAnalysisResult`, `ImpactStatistics`, `RiskCase`, `RiskLevel`
  - `SimulationRequest`, `SimulationResult`, `SimulationCase`, `SimulationSummary`
  - `TimelineItem`, `FieldMappingValue`, `KeywordRuleConfig`

#### Phase 2: Core Services
- 建立 `src/services/impact-analysis.ts` - 影響分析服務
  - `ImpactAnalysisService.analyze()` - 分析規則變更影響
  - 計算統計數據、識別風險案例、生成時間軸數據
- 建立 `src/services/rule-simulation.ts` - 規則模擬服務
  - `RuleSimulationService.simulate()` - 對歷史數據執行模擬
  - 支援 REGEX、KEYWORD、POSITION 提取類型
  - 分類結果為 improved/regressed/unchanged

#### Phase 3: API Layer
- 建立 `src/app/api/rules/suggestions/[id]/impact/route.ts`
  - GET 端點：獲取影響分析報告
  - 權限檢查：RULE_VIEW
- 建立 `src/app/api/rules/suggestions/[id]/simulate/route.ts`
  - POST 端點：執行模擬測試
  - Zod 驗證：sampleSize (10-1000), dateRange, includeUnverified
  - 權限檢查：RULE_MANAGE

#### Phase 4: React Query Hooks
- 建立 `src/hooks/useImpactAnalysis.ts`
  - 獲取影響分析數據，5分鐘 staleTime
- 建立 `src/hooks/useSimulation.ts`
  - 執行模擬測試 mutation
  - `toSimulationRequest()` 表單數據轉換

#### Phase 5: UI Components
- 建立 `src/components/features/suggestions/ImpactStatisticsCards.tsx`
  - 6 個統計卡片：總受影響數、改善數、惡化數、無變化、改善率、惡化率
- 建立 `src/components/features/suggestions/RiskCasesTable.tsx`
  - 風險案例表格，HIGH/MEDIUM/LOW 徽章
  - 值對比顯示（現有 vs 預測）
- 建立 `src/components/features/suggestions/ImpactTimeline.tsx`
  - 時間軸圖表，綠色（改善）/紅色（惡化）視覺化
- 建立 `src/components/features/suggestions/SimulationConfigForm.tsx`
  - 樣本大小、時間範圍、是否包含未驗證文件
- 建立 `src/components/features/suggestions/SimulationResultsPanel.tsx`
  - 模擬結果摘要、準確率對比、分頁案例表格
- 建立 `src/components/features/suggestions/ImpactAnalysisPanel.tsx`
  - 主面板，整合所有子組件
  - Tabs：影響分析 / 模擬測試
- 建立 `src/components/features/suggestions/index.ts` - 模組導出

### 技術決策

1. **UUID 生成**: 使用 Node.js 內建 `crypto.randomUUID` 而非外部 `uuid` 套件
2. **Badge variant**: shadcn/ui Badge 無 "warning" variant，MEDIUM 風險使用 "outline" + 自訂 amber 樣式
3. **時間軸視覺化**: 使用純 CSS 堆疊條形圖，無需額外圖表庫
4. **模擬測試**: 支援 REGEX、KEYWORD 規則類型的即時執行

### 文件清單
```
src/types/impact.ts
src/services/impact-analysis.ts
src/services/rule-simulation.ts
src/app/api/rules/suggestions/[id]/impact/route.ts
src/app/api/rules/suggestions/[id]/simulate/route.ts
src/hooks/useImpactAnalysis.ts
src/hooks/useSimulation.ts
src/components/features/suggestions/ImpactStatisticsCards.tsx
src/components/features/suggestions/RiskCasesTable.tsx
src/components/features/suggestions/ImpactTimeline.tsx
src/components/features/suggestions/SimulationConfigForm.tsx
src/components/features/suggestions/SimulationResultsPanel.tsx
src/components/features/suggestions/ImpactAnalysisPanel.tsx
src/components/features/suggestions/index.ts
```

---

## Dev Notes

### 依賴項

- **Story 4.4**: 規則升級建議

### Architecture Compliance

```typescript
// GET /api/rules/suggestions/[id]/impact
interface ImpactAnalysisResponse {
  success: true
  data: {
    suggestion: {
      id: string
      fieldName: string
      currentPattern: string | null
      suggestedPattern: string
    }
    statistics: {
      totalAffected: number        // 受影響的歷史文件數
      estimatedImprovement: number // 預計改善數量
      estimatedRegression: number  // 可能惡化數量
      unchanged: number            // 無變化數量
      improvementRate: number      // 改善率百分比
    }
    riskCases: {
      documentId: string
      fileName: string
      currentValue: string
      predictedValue: string
      riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
      reason: string
    }[]
    timeline: {
      date: string
      affectedCount: number
    }[]
  }
}

// POST /api/rules/suggestions/[id]/simulate
interface SimulationRequest {
  sampleSize?: number  // 默認 100
  dateRange?: {
    start: string
    end: string
  }
}

interface SimulationResponse {
  success: true
  data: {
    simulationId: string
    totalTested: number
    results: {
      improved: SimulationCase[]
      regressed: SimulationCase[]
      unchanged: SimulationCase[]
    }
    summary: {
      improvedCount: number
      regressedCount: number
      unchangedCount: number
      accuracyBefore: number
      accuracyAfter: number
    }
  }
}

interface SimulationCase {
  documentId: string
  fileName: string
  originalExtracted: string | null
  currentRuleResult: string | null
  newRuleResult: string | null
  actualValue: string          // 用戶確認/修正後的值
  currentAccurate: boolean
  newAccurate: boolean
}
```

```typescript
// src/services/rule-simulation.ts
export class RuleSimulationService {
  async simulate(
    suggestionId: string,
    options: SimulationOptions
  ): Promise<SimulationResult> {
    const suggestion = await prisma.ruleSuggestion.findUnique({
      where: { id: suggestionId },
      include: { forwarder: true },
    })

    // 1. 獲取歷史文件樣本
    const documents = await this.getSampleDocuments(
      suggestion.forwarderId,
      suggestion.fieldName,
      options
    )

    // 2. 對每個文件執行模擬
    const results: SimulationCase[] = []
    for (const doc of documents) {
      const result = await this.simulateDocument(doc, suggestion)
      results.push(result)
    }

    // 3. 分類結果
    return this.categorizeResults(results)
  }

  private async simulateDocument(
    document: Document,
    suggestion: RuleSuggestion
  ): Promise<SimulationCase> {
    // 獲取原始提取結果
    const originalExtraction = await prisma.extractionResult.findFirst({
      where: {
        documentId: document.id,
        fieldName: suggestion.fieldName,
      },
    })

    // 獲取用戶確認/修正後的實際值
    const actualValue = await this.getActualValue(document.id, suggestion.fieldName)

    // 應用當前規則
    const currentResult = await this.applyRule(
      document,
      suggestion.currentPattern,
      suggestion.fieldName
    )

    // 應用新規則
    const newResult = await this.applyRule(
      document,
      suggestion.suggestedPattern,
      suggestion.fieldName
    )

    return {
      documentId: document.id,
      fileName: document.fileName,
      originalExtracted: originalExtraction?.value,
      currentRuleResult: currentResult,
      newRuleResult: newResult,
      actualValue,
      currentAccurate: currentResult === actualValue,
      newAccurate: newResult === actualValue,
    }
  }

  private categorizeResults(results: SimulationCase[]): CategorizedResults {
    return {
      improved: results.filter(r => !r.currentAccurate && r.newAccurate),
      regressed: results.filter(r => r.currentAccurate && !r.newAccurate),
      unchanged: results.filter(r => r.currentAccurate === r.newAccurate),
    }
  }
}
```

### UI 組件

```typescript
// src/components/rules/ImpactComparisonTable.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Props {
  results: SimulationCase[]
  type: 'improved' | 'regressed' | 'unchanged'
}

export function ImpactComparisonTable({ results, type }: Props) {
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>文件</TableHead>
          <TableHead>原規則結果</TableHead>
          <TableHead>新規則結果</TableHead>
          <TableHead>實際值</TableHead>
          <TableHead>狀態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result) => (
          <TableRow key={result.documentId}>
            <TableCell>{result.fileName}</TableCell>
            <TableCell className={result.currentAccurate ? 'text-green-600' : 'text-red-600'}>
              {result.currentRuleResult || '-'}
            </TableCell>
            <TableCell className={result.newAccurate ? 'text-green-600' : 'text-red-600'}>
              {result.newRuleResult || '-'}
            </TableCell>
            <TableCell>{result.actualValue}</TableCell>
            <TableCell>{getStatusBadge()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-45]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR22]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.5 |
| Story Key | 4-5-rule-impact-scope-analysis |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR22 |
| Dependencies | Story 4.4 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
