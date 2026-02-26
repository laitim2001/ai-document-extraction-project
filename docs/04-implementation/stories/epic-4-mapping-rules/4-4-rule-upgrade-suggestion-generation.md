# Story 4.4: 規則升級建議生成

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 在累計 3 次相同修正後建議規則升級,
**So that** Super User 可以審核並決定是否採納。

---

## Acceptance Criteria

### AC1: 自動生成建議

**Given** 相同模式修正達到 3 次
**When** 系統檢測到閾值
**Then** 自動生成規則升級建議
**And** 包含：建議的新規則、基於的修正案例、預期影響

### AC2: 通知與狀態

**Given** 規則升級建議生成
**When** 系統創建建議
**Then** 通知相關 Super User，建議狀態設為「待審核」

---

## Tasks / Subtasks

- [ ] **Task 1: 建議生成服務** (AC: #1)
  - [ ] 1.1 創建 `src/services/rule-suggestion-generator.ts`
  - [ ] 1.2 監控 CANDIDATE 狀態的 Pattern
  - [ ] 1.3 觸發建議生成

- [ ] **Task 2: 規則推斷邏輯** (AC: #1)
  - [ ] 2.1 分析修正模式
  - [ ] 2.2 推斷最佳提取規則
  - [ ] 2.3 生成建議的 pattern
  - [ ] 2.4 計算預期信心度

- [ ] **Task 3: 修正案例關聯** (AC: #1)
  - [ ] 3.1 關聯觸發的修正記錄
  - [ ] 3.2 提取代表性案例
  - [ ] 3.3 儲存案例快照

- [ ] **Task 4: 預期影響計算** (AC: #1)
  - [ ] 4.1 查詢歷史相關文件
  - [ ] 4.2 模擬規則應用
  - [ ] 4.3 計算改善預期
  - [ ] 4.4 儲存影響分析

- [ ] **Task 5: 建議記錄創建** (AC: #2)
  - [ ] 5.1 創建 RuleSuggestion 記錄
  - [ ] 5.2 設定 source 為 AUTO_LEARNING
  - [ ] 5.3 關聯 CorrectionPattern
  - [ ] 5.4 設定狀態為 PENDING

- [ ] **Task 6: Super User 通知** (AC: #2)
  - [ ] 6.1 查詢有審核權限的用戶
  - [ ] 6.2 創建待審核通知
  - [ ] 6.3 發送即時通知
  - [ ] 6.4 包含建議摘要

- [ ] **Task 7: 待審核列表** (AC: #2)
  - [ ] 7.1 創建待審核建議列表頁面
  - [ ] 7.2 顯示建議詳情入口
  - [ ] 7.3 顯示建議來源標記

- [ ] **Task 8: 驗證與測試** (AC: #1-2)
  - [ ] 8.1 測試建議生成觸發
  - [ ] 8.2 測試規則推斷
  - [ ] 8.3 測試通知發送
  - [ ] 8.4 測試列表顯示

---

## Dev Notes

### 依賴項

- **Story 4.3**: 修正模式分析

### Architecture Compliance

```prisma
// 擴展 RuleSuggestion 模型
model RuleSuggestion {
  id              String   @id @default(uuid())
  forwarderId     String   @map("forwarder_id")
  fieldName       String   @map("field_name")
  extractionType  ExtractionType @map("extraction_type")
  currentPattern  String?  @map("current_pattern")
  suggestedPattern String  @map("suggested_pattern")
  source          SuggestionSource @default(MANUAL)
  correctionCount Int      @default(0) @map("correction_count")
  expectedImpact  Json?    @map("expected_impact")
  status          SuggestionStatus @default(PENDING)
  suggestedBy     String?  @map("suggested_by")  // null for AUTO
  reviewedBy      String?  @map("reviewed_by")
  reviewNotes     String?  @map("review_notes")
  createdAt       DateTime @default(now()) @map("created_at")
  reviewedAt      DateTime? @map("reviewed_at")

  forwarder     Forwarder @relation(fields: [forwarderId], references: [id])
  suggester     User?     @relation("Suggester", fields: [suggestedBy], references: [id])
  reviewer      User?     @relation("Reviewer", fields: [reviewedBy], references: [id])
  pattern       CorrectionPattern? @relation(fields: [patternId], references: [id])
  patternId     String?   @map("pattern_id")
  sampleCases   SuggestionSample[]

  @@index([forwarderId, fieldName])
  @@index([status])
  @@map("rule_suggestions")
}

enum SuggestionSource {
  MANUAL          // 手動建議
  AUTO_LEARNING   // 自動學習
  IMPORT          // 導入
}

model SuggestionSample {
  id            String   @id @default(uuid())
  suggestionId  String   @map("suggestion_id")
  documentId    String   @map("document_id")
  originalValue String   @map("original_value")
  correctedValue String  @map("corrected_value")
  createdAt     DateTime @default(now()) @map("created_at")

  suggestion RuleSuggestion @relation(fields: [suggestionId], references: [id])
  document   Document       @relation(fields: [documentId], references: [id])

  @@map("suggestion_samples")
}
```

```typescript
// src/services/rule-suggestion-generator.ts
export class RuleSuggestionGenerator {
  async generateFromPattern(pattern: CorrectionPattern): Promise<RuleSuggestion> {
    // 1. 獲取相關修正記錄
    const corrections = await prisma.correction.findMany({
      where: { patternId: pattern.id },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
      take: 10,  // 取最近 10 筆作為樣本
    })

    // 2. 推斷最佳規則
    const inferredRule = await this.inferRule(corrections)

    // 3. 計算預期影響
    const impact = await this.calculateImpact(
      pattern.forwarderId,
      pattern.fieldName,
      inferredRule
    )

    // 4. 創建建議記錄
    const suggestion = await prisma.ruleSuggestion.create({
      data: {
        forwarderId: pattern.forwarderId,
        fieldName: pattern.fieldName,
        extractionType: inferredRule.type,
        currentPattern: await this.getCurrentPattern(pattern),
        suggestedPattern: inferredRule.pattern,
        source: 'AUTO_LEARNING',
        correctionCount: pattern.occurrenceCount,
        expectedImpact: impact,
        status: 'PENDING',
        patternId: pattern.id,
        sampleCases: {
          create: corrections.slice(0, 5).map(c => ({
            documentId: c.documentId,
            originalValue: c.originalValue || '',
            correctedValue: c.correctedValue,
          })),
        },
      },
    })

    // 5. 更新 Pattern 狀態
    await prisma.correctionPattern.update({
      where: { id: pattern.id },
      data: { status: 'SUGGESTED' },
    })

    // 6. 發送通知
    await this.notifySuperUsers(suggestion)

    return suggestion
  }

  private async inferRule(corrections: Correction[]): Promise<InferredRule> {
    // 分析修正值的共同模式
    const correctedValues = corrections.map(c => c.correctedValue)

    // 嘗試不同的規則類型
    const candidates = [
      this.tryRegexPattern(correctedValues),
      this.tryKeywordPattern(correctedValues),
      this.tryPositionPattern(corrections),
    ]

    // 選擇最佳候選
    return candidates.sort((a, b) => b.confidence - a.confidence)[0]
  }

  private async calculateImpact(
    forwarderId: string,
    fieldName: string,
    rule: InferredRule
  ): Promise<ExpectedImpact> {
    // 查詢最近 30 天的相關文件
    const documents = await prisma.document.findMany({
      where: {
        forwarderId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      include: {
        extractionResults: {
          where: { fieldName },
        },
      },
    })

    return {
      affectedDocuments: documents.length,
      estimatedImprovement: this.estimateImprovement(documents, rule),
      potentialRisks: this.identifyRisks(documents, rule),
    }
  }
}
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-44]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR21]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.4 |
| Story Key | 4-4-rule-upgrade-suggestion-generation |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR21 |
| Dependencies | Story 4.3 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
