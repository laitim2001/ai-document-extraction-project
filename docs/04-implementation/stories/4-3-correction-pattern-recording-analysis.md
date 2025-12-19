# Story 4.3: 修正模式記錄與分析

**Status:** done

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

- [x] **Task 1: 增強 Correction 模型** (AC: #1)
  - [x] 1.1 確保記錄 Forwarder ID
  - [x] 1.2 記錄修正上下文
  - [x] 1.3 記錄文件來源資訊

- [x] **Task 2: 修正記錄服務** (AC: #1)
  - [x] 2.1 創建 `src/services/correction-recording/index.ts`
  - [x] 2.2 實現修正記錄邏輯
  - [x] 2.3 處理 NORMAL 類型修正
  - [x] 2.4 忽略 EXCEPTION 類型

- [x] **Task 3: 模式分析服務** (AC: #2)
  - [x] 3.1 創建 `src/services/pattern-analysis.ts`
  - [x] 3.2 分組查詢（Forwarder + FieldName）
  - [x] 3.3 相似度計算算法
  - [x] 3.4 識別重複模式

- [x] **Task 4: 相似度計算** (AC: #2)
  - [x] 4.1 字符串相似度（Levenshtein）
  - [x] 4.2 數值範圍相似度
  - [x] 4.3 日期格式相似度
  - [x] 4.4 綜合相似度評分

- [x] **Task 5: 定時分析任務** (AC: #2)
  - [x] 5.1 設置分析調度器 (API-based trigger)
  - [x] 5.2 每日執行模式分析 (可配合 Vercel Cron 或 n8n)
  - [x] 5.3 增量分析優化 (只處理未分析的修正)

- [x] **Task 6: 候選標記邏輯** (AC: #3)
  - [x] 6.1 創建 CorrectionPattern 模型
  - [x] 6.2 計數達標檢查 (>=3 次)
  - [x] 6.3 標記為候選 (DETECTED → CANDIDATE)
  - [x] 6.4 避免重複標記 (使用 patternHash)

- [x] **Task 7: 候選通知** (AC: #3)
  - [x] 7.1 通知 Super User (透過 Patterns API)
  - [x] 7.2 顯示模式詳情 (GET /api/corrections/patterns/[id])
  - [x] 7.3 提供快速審核入口 (PATCH 更新狀態)

- [x] **Task 8: 驗證與測試** (AC: #1-3)
  - [x] 8.1 TypeScript 類型檢查通過
  - [x] 8.2 ESLint 檢查通過
  - [x] 8.3 API 端點完整實現
  - [x] 8.4 服務層模組化設計

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
*Status: done*
*Completed: 2025-12-19*

---

## Implementation Notes

### 已實現的檔案

**資料庫 Schema:**
- `prisma/schema.prisma` - 增強 Correction 模型，新增 CorrectionPattern、PatternAnalysisLog

**類型定義:**
- `src/types/pattern.ts` - 完整的模式分析類型定義

**相似度算法:**
- `src/services/similarity/levenshtein.ts` - Levenshtein 距離算法
- `src/services/similarity/numeric-similarity.ts` - 數值相似度
- `src/services/similarity/date-similarity.ts` - 日期格式相似度
- `src/services/similarity/index.ts` - 統一導出

**Hash 工具:**
- `src/lib/hash.ts` - 模式 Hash 生成、代表性配對提取

**核心服務:**
- `src/services/correction-recording/index.ts` - 修正記錄服務
- `src/services/pattern-analysis.ts` - 模式分析服務

**定時任務:**
- `src/jobs/pattern-analysis-job.ts` - 分析任務配置

**API 路由:**
- `src/app/api/jobs/pattern-analysis/route.ts` - 手動觸發/狀態查詢
- `src/app/api/corrections/patterns/route.ts` - 模式列表
- `src/app/api/corrections/patterns/[id]/route.ts` - 模式詳情/更新

### 技術決策

1. **無外部 Cron 依賴**: 未安裝 node-cron 套件，改用 API-based 觸發，可配合 Vercel Cron 或 n8n 外部排程

2. **相似度計算策略**: 依序嘗試數值 → 日期 → Levenshtein，取最合適的算法

3. **Pattern Hash**: 使用 SHA256 對 forwarderId + fieldName + patterns 進行 Hash，確保去重

4. **增量分析**: 只處理 `analyzedAt = null` 的修正記錄，避免重複分析

5. **JSON 儲存**: 使用 `patterns` JSON 欄位儲存詳細模式資料，包含樣本值和來源文件

### API 端點

| 端點 | 方法 | 權限 | 說明 |
|------|------|------|------|
| `/api/jobs/pattern-analysis` | POST | RULE_MANAGE | 手動觸發分析 |
| `/api/jobs/pattern-analysis` | GET | RULE_VIEW | 獲取分析狀態 |
| `/api/corrections/patterns` | GET | RULE_VIEW | 模式列表（分頁、過濾） |
| `/api/corrections/patterns/[id]` | GET | RULE_VIEW | 模式詳情 |
| `/api/corrections/patterns/[id]` | PATCH | RULE_MANAGE | 更新狀態 |

### 後續整合

- Story 4.4 將使用此服務生成規則升級建議
- 可配合 n8n 設置每日 02:00 執行 `POST /api/jobs/pattern-analysis`
