# Story 4.3: 修正模式記錄與分析

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 記錄用戶的修正並識別重複模式,
**So that** 可以自動發現潛在的規則改進機會。

---

## Acceptance Criteria

### AC1: 修正記錄儲存

**Given** 用戶完成「正常修正」
**When** 系統記錄修正
**Then** 儲存：原始值、修正值、Forwarder、欄位名稱、修正時間

### AC2: 模式分析執行

**Given** 系統累積修正記錄
**When** 執行模式分析
**Then** 識別重複的修正模式（相同 Forwarder + 相同欄位 + 相似修正）

### AC3: 候選標記

**Given** 發現重複模式
**When** 修正次數 >= 3
**Then** 標記為「潛在規則升級候選」

---

## Tasks / Subtasks

- [ ] **Task 1: 增強 Correction 模型** (AC: #1)
  - [ ] 1.1 確保記錄 Forwarder ID
  - [ ] 1.2 記錄修正上下文
  - [ ] 1.3 記錄文件來源資訊

- [ ] **Task 2: 修正記錄服務** (AC: #1)
  - [ ] 2.1 創建 `src/services/correction-recording.ts`
  - [ ] 2.2 實現修正記錄邏輯
  - [ ] 2.3 處理 NORMAL 類型修正
  - [ ] 2.4 忽略 EXCEPTION 類型

- [ ] **Task 3: 模式分析服務** (AC: #2)
  - [ ] 3.1 創建 `src/services/pattern-analysis.ts`
  - [ ] 3.2 分組查詢（Forwarder + FieldName）
  - [ ] 3.3 相似度計算算法
  - [ ] 3.4 識別重複模式

- [ ] **Task 4: 相似度計算** (AC: #2)
  - [ ] 4.1 字符串相似度（Levenshtein）
  - [ ] 4.2 數值範圍相似度
  - [ ] 4.3 日期格式相似度
  - [ ] 4.4 綜合相似度評分

- [ ] **Task 5: 定時分析任務** (AC: #2)
  - [ ] 5.1 設置分析調度器
  - [ ] 5.2 每日執行模式分析
  - [ ] 5.3 增量分析優化

- [ ] **Task 6: 候選標記邏輯** (AC: #3)
  - [ ] 6.1 創建 CorrectionPattern 模型
  - [ ] 6.2 計數達標檢查
  - [ ] 6.3 標記為候選
  - [ ] 6.4 避免重複標記

- [ ] **Task 7: 候選通知** (AC: #3)
  - [ ] 7.1 通知 Super User
  - [ ] 7.2 顯示模式詳情
  - [ ] 7.3 提供快速審核入口

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試修正記錄
  - [ ] 8.2 測試模式識別
  - [ ] 8.3 測試候選標記
  - [ ] 8.4 測試通知功能

---

## Dev Notes

### 依賴項

- **Story 3.6**: 修正類型標記

### Architecture Compliance

```prisma
model CorrectionPattern {
  id            String   @id @default(uuid())
  forwarderId   String   @map("forwarder_id")
  fieldName     String   @map("field_name")
  patternHash   String   @map("pattern_hash")  // 用於去重
  originalPattern String @map("original_pattern")
  correctedPattern String @map("corrected_pattern")
  occurrenceCount Int    @default(1) @map("occurrence_count")
  status        PatternStatus @default(DETECTED)
  firstSeenAt   DateTime @map("first_seen_at")
  lastSeenAt    DateTime @map("last_seen_at")
  createdAt     DateTime @default(now()) @map("created_at")

  forwarder Forwarder @relation(fields: [forwarderId], references: [id])
  corrections Correction[]

  @@unique([forwarderId, fieldName, patternHash])
  @@index([status])
  @@map("correction_patterns")
}

enum PatternStatus {
  DETECTED        // 已檢測
  CANDIDATE       // 升級候選（>=3次）
  SUGGESTED       // 已生成建議
  PROCESSED       // 已處理
  IGNORED         // 已忽略
}
```

```typescript
// src/services/pattern-analysis.ts
export class PatternAnalysisService {
  private readonly THRESHOLD = 3
  private readonly SIMILARITY_THRESHOLD = 0.8

  async analyzeCorrections(): Promise<CorrectionPattern[]> {
    // 1. 獲取未分析的 NORMAL 修正
    const corrections = await prisma.correction.findMany({
      where: {
        correctionType: 'NORMAL',
        analyzedAt: null,
      },
      include: {
        document: {
          select: { forwarderId: true }
        }
      }
    })

    // 2. 按 Forwarder + FieldName 分組
    const grouped = this.groupCorrections(corrections)

    // 3. 識別相似模式
    const patterns: CorrectionPattern[] = []
    for (const [key, group] of grouped) {
      const similarGroups = this.findSimilarPatterns(group)
      patterns.push(...similarGroups)
    }

    // 4. 更新或創建 CorrectionPattern 記錄
    await this.upsertPatterns(patterns)

    // 5. 標記達標的候選
    await this.markCandidates()

    return patterns
  }

  private calculateSimilarity(
    original1: string,
    corrected1: string,
    original2: string,
    corrected2: string
  ): number {
    // 使用 Levenshtein 距離計算相似度
    const originalSim = this.levenshteinSimilarity(original1, original2)
    const correctedSim = this.levenshteinSimilarity(corrected1, corrected2)
    return (originalSim + correctedSim) / 2
  }

  private async markCandidates(): Promise<void> {
    await prisma.correctionPattern.updateMany({
      where: {
        occurrenceCount: { gte: this.THRESHOLD },
        status: 'DETECTED',
      },
      data: {
        status: 'CANDIDATE',
      },
    })
  }
}
```

```typescript
// 定時任務配置
// src/jobs/pattern-analysis-job.ts
import { CronJob } from 'cron'

export const patternAnalysisJob = new CronJob(
  '0 2 * * *',  // 每天凌晨 2 點執行
  async () => {
    const service = new PatternAnalysisService()
    const patterns = await service.analyzeCorrections()
    console.log(`Analyzed ${patterns.length} patterns`)
  }
)
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-43]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR20]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.3 |
| Story Key | 4-3-correction-pattern-recording-analysis |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR20 |
| Dependencies | Story 3.6 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
