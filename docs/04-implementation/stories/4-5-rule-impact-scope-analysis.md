# Story 4.5: 規則影響範圍分析

**Status:** ready-for-dev

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

- [ ] **Task 1: 影響分析頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/rules/suggestions/[id]/impact/page.tsx`
  - [ ] 1.2 設計分析報告佈局
  - [ ] 1.3 顯示摘要統計

- [ ] **Task 2: 影響統計計算** (AC: #1)
  - [ ] 2.1 計算受影響文件數量
  - [ ] 2.2 計算預計改善率
  - [ ] 2.3 識別風險案例
  - [ ] 2.4 生成統計圖表

- [ ] **Task 3: 影響分析 API** (AC: #1)
  - [ ] 3.1 創建 GET `/api/rules/suggestions/[id]/impact`
  - [ ] 3.2 執行影響計算
  - [ ] 3.3 返回詳細報告

- [ ] **Task 4: 模擬測試服務** (AC: #2)
  - [ ] 4.1 創建 `src/services/rule-simulation.ts`
  - [ ] 4.2 對歷史數據應用新規則
  - [ ] 4.3 記錄模擬結果
  - [ ] 4.4 計算差異

- [ ] **Task 5: 測試運行 API** (AC: #2)
  - [ ] 5.1 創建 POST `/api/rules/suggestions/[id]/simulate`
  - [ ] 5.2 執行模擬測試
  - [ ] 5.3 返回測試結果
  - [ ] 5.4 支援分頁瀏覽

- [ ] **Task 6: 對比結果顯示** (AC: #3)
  - [ ] 6.1 創建對比表格組件
  - [ ] 6.2 顯示原值 vs 新值
  - [ ] 6.3 標記改善案例（綠色）
  - [ ] 6.4 標記惡化案例（紅色）
  - [ ] 6.5 標記無變化案例

- [ ] **Task 7: 案例詳情查看** (AC: #3)
  - [ ] 7.1 點擊案例查看詳情
  - [ ] 7.2 顯示原始文件
  - [ ] 7.3 顯示提取對比

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試影響分析
  - [ ] 8.2 測試模擬運行
  - [ ] 8.3 測試對比顯示
  - [ ] 8.4 測試大數據量處理

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
