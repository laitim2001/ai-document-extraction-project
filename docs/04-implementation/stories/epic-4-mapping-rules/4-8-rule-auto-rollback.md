# Story 4.8: 規則自動回滾

**Status:** done

---

## Story

**As a** 系統,
**I want** 在準確率下降時自動回滾規則,
**So that** 系統可以自我保護避免錯誤規則的影響。

---

## Acceptance Criteria

### AC1: 準確率監控

**Given** 新規則已生效
**When** 系統監控準確率指標
**Then** 每小時計算規則應用後的準確率

### AC2: 自動回滾觸發

**Given** 準確率監控
**When** 新規則導致準確率下降超過 10%
**Then** 系統自動觸發回滾，恢復到上一個穩定版本

### AC3: 告警通知

**Given** 自動回滾觸發
**When** 執行回滾
**Then** 發送告警通知給 Super User，記錄回滾原因和時間

---

## Tasks / Subtasks

- [x] **Task 1: RuleApplication 模型** (AC: #1)
  - [x] 1.1 創建規則應用記錄模型
  - [x] 1.2 記錄應用結果（成功/失敗）
  - [x] 1.3 記錄應用時間

- [x] **Task 2: 準確率計算服務** (AC: #1)
  - [x] 2.1 創建 `src/services/rule-accuracy.ts`
  - [x] 2.2 計算規則準確率
  - [x] 2.3 對比歷史準確率

- [x] **Task 3: 定時監控任務** (AC: #1)
  - [x] 3.1 設置每小時監控
  - [x] 3.2 獲取活躍規則
  - [x] 3.3 計算各規則準確率

- [x] **Task 4: 回滾閾值檢查** (AC: #2)
  - [x] 4.1 設定 10% 下降閾值
  - [x] 4.2 檢測準確率變化
  - [x] 4.3 觸發回滾決策

- [x] **Task 5: 自動回滾服務** (AC: #2)
  - [x] 5.1 創建 `src/services/auto-rollback.ts`
  - [x] 5.2 獲取上一穩定版本
  - [x] 5.3 執行回滾操作
  - [x] 5.4 標記回滾原因

- [x] **Task 6: 回滾記錄** (AC: #2, #3)
  - [x] 6.1 創建 RollbackLog 模型
  - [x] 6.2 記錄回滾詳情
  - [x] 6.3 記錄觸發原因

- [x] **Task 7: 告警通知** (AC: #3)
  - [x] 7.1 查詢 Super User
  - [x] 7.2 發送告警通知
  - [x] 7.3 包含回滾詳情
  - [x] 7.4 提供查看入口

- [x] **Task 8: 回滾歷史查看** (AC: #3)
  - [x] 8.1 創建回滾歷史頁面
  - [x] 8.2 顯示回滾列表
  - [x] 8.3 顯示回滾詳情

- [x] **Task 9: 驗證與測試** (AC: #1-3)
  - [x] 9.1 測試準確率計算
  - [x] 9.2 測試閾值觸發
  - [x] 9.3 測試自動回滾
  - [x] 9.4 測試告警通知

---

## Implementation Notes

### 實作完成日期
2025-12-19

### 新增/修改文件清單

#### 類型定義
- `src/types/accuracy.ts` - 準確率相關類型（AccuracyMetrics, AccuracyDropResult, RollbackResult, RollbackHistoryItem 等）

#### 服務層
- `src/services/rule-accuracy.ts` - 準確率計算服務（RuleAccuracyService）
- `src/services/auto-rollback.ts` - 自動回滾服務（AutoRollbackService）

#### API 路由
- `src/app/api/rules/[id]/accuracy/route.ts` - 規則準確率查詢 API
- `src/app/api/rollback-logs/route.ts` - 回滾歷史查詢 API

#### React Query Hooks
- `src/hooks/use-accuracy.ts` - 準確率數據 Hook（useRuleAccuracy, calculateTrend, formatAccuracy）
- `src/hooks/use-rollback.ts` - 回滾歷史 Hook（useRollbackHistory）

#### UI 組件
- `src/components/features/rules/AccuracyMetrics.tsx` - 準確率指標展示組件
- `src/app/(dashboard)/rollback-history/page.tsx` - 回滾歷史頁面

### 關鍵實作決策

1. **準確率計算**
   - 24 小時時間窗口計算準確率
   - 最少 10 個樣本才有效（MIN_SAMPLE_SIZE）
   - 比較當前版本與前一版本的準確率

2. **回滾觸發條件**
   - 10% 下降閾值（ACCURACY_DROP_THRESHOLD = 0.10）
   - 60 分鐘冷卻期（ROLLBACK_COOLDOWN_MS）
   - 僅對版本 > 1 的規則檢查

3. **回滾執行**
   - 使用 Prisma 事務確保數據一致性
   - 回滾操作創建新版本號（version + 1）
   - 記錄詳細的回滾日誌（RollbackLog）

4. **告警通知**
   - 使用現有的 notifySuperUsers 服務
   - 通知類型為 RULE_AUTO_ROLLBACK
   - 包含規則名稱、版本變化、準確率變化等詳情

### 技術細節

- **API 權限**: RULE_VIEW 查看準確率，RULE_MANAGE 執行回滾
- **React Query 配置**: 5 分鐘自動重新獲取（refetchInterval）
- **Prisma JsonValue 處理**: 使用 `as Prisma.InputJsonValue` 轉換類型

---

## Dev Notes

### 依賴項

- **Story 4.7**: 版本管理功能

### Architecture Compliance

```prisma
model RuleApplication {
  id            String   @id @default(uuid())
  ruleId        String   @map("rule_id")
  ruleVersion   Int      @map("rule_version")
  documentId    String   @map("document_id")
  fieldName     String   @map("field_name")
  extractedValue String? @map("extracted_value")
  isAccurate    Boolean? @map("is_accurate")  // null = 未驗證
  verifiedAt    DateTime? @map("verified_at")
  createdAt     DateTime @default(now()) @map("created_at")

  rule     MappingRule @relation(fields: [ruleId], references: [id])
  document Document    @relation(fields: [documentId], references: [id])

  @@index([ruleId, ruleVersion])
  @@index([createdAt])
  @@map("rule_applications")
}

model RollbackLog {
  id            String   @id @default(uuid())
  ruleId        String   @map("rule_id")
  fromVersion   Int      @map("from_version")
  toVersion     Int      @map("to_version")
  trigger       RollbackTrigger
  reason        String
  accuracyBefore Float   @map("accuracy_before")
  accuracyAfter Float    @map("accuracy_after")
  createdAt     DateTime @default(now()) @map("created_at")

  rule MappingRule @relation(fields: [ruleId], references: [id])

  @@index([ruleId])
  @@map("rollback_logs")
}

enum RollbackTrigger {
  AUTO          // 自動回滾
  MANUAL        // 手動回滾
  EMERGENCY     // 緊急回滾
}
```

```typescript
// src/services/rule-accuracy.ts
export class RuleAccuracyService {
  private readonly ACCURACY_DROP_THRESHOLD = 0.10  // 10%

  async calculateAccuracy(ruleId: string, version: number): Promise<AccuracyMetrics> {
    // 獲取最近的應用記錄（已驗證的）
    const applications = await prisma.ruleApplication.findMany({
      where: {
        ruleId,
        ruleVersion: version,
        isAccurate: { not: null },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24小時內
      },
    })

    const total = applications.length
    const accurate = applications.filter(a => a.isAccurate).length

    return {
      total,
      accurate,
      accuracy: total > 0 ? accurate / total : null,
    }
  }

  async checkAccuracyDrop(ruleId: string): Promise<AccuracyDropResult | null> {
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
    })

    if (!rule || rule.version <= 1) return null

    // 當前版本準確率
    const currentAccuracy = await this.calculateAccuracy(ruleId, rule.version)

    // 上一版本準確率
    const previousAccuracy = await this.calculateAccuracy(ruleId, rule.version - 1)

    if (currentAccuracy.accuracy === null || previousAccuracy.accuracy === null) {
      return null  // 數據不足
    }

    const drop = previousAccuracy.accuracy - currentAccuracy.accuracy

    if (drop > this.ACCURACY_DROP_THRESHOLD) {
      return {
        ruleId,
        currentVersion: rule.version,
        currentAccuracy: currentAccuracy.accuracy,
        previousAccuracy: previousAccuracy.accuracy,
        drop,
        shouldRollback: true,
      }
    }

    return null
  }
}
```

```typescript
// src/services/auto-rollback.ts
export class AutoRollbackService {
  private accuracyService = new RuleAccuracyService()
  private notificationService = new NotificationService()

  async checkAndRollback(ruleId: string): Promise<RollbackResult | null> {
    const dropResult = await this.accuracyService.checkAccuracyDrop(ruleId)

    if (!dropResult?.shouldRollback) return null

    // 執行回滾
    const result = await this.executeRollback(ruleId, dropResult)

    // 發送告警
    await this.sendAlert(result)

    return result
  }

  private async executeRollback(
    ruleId: string,
    dropResult: AccuracyDropResult
  ): Promise<RollbackResult> {
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
    })

    // 獲取上一穩定版本
    const previousVersion = await prisma.ruleVersion.findFirst({
      where: {
        ruleId,
        version: rule.version - 1,
      },
    })

    // 執行回滾事務
    const result = await prisma.$transaction(async (tx) => {
      // 更新規則
      await tx.mappingRule.update({
        where: { id: ruleId },
        data: {
          extractionType: previousVersion.extractionType,
          pattern: previousVersion.pattern,
          confidence: previousVersion.confidence,
          priority: previousVersion.priority,
          version: rule.version + 1,  // 創建新版本號
        },
      })

      // 創建版本記錄
      await tx.ruleVersion.create({
        data: {
          ruleId,
          version: rule.version + 1,
          extractionType: previousVersion.extractionType,
          pattern: previousVersion.pattern,
          confidence: previousVersion.confidence,
          priority: previousVersion.priority,
          changeReason: `Auto rollback due to accuracy drop (${(dropResult.drop * 100).toFixed(1)}%)`,
          createdBy: 'SYSTEM',
        },
      })

      // 記錄回滾日誌
      const log = await tx.rollbackLog.create({
        data: {
          ruleId,
          fromVersion: rule.version,
          toVersion: previousVersion.version,
          trigger: 'AUTO',
          reason: `Accuracy dropped from ${(dropResult.previousAccuracy * 100).toFixed(1)}% to ${(dropResult.currentAccuracy * 100).toFixed(1)}%`,
          accuracyBefore: dropResult.currentAccuracy,
          accuracyAfter: dropResult.previousAccuracy,
        },
      })

      return log
    })

    return {
      success: true,
      ruleId,
      fromVersion: rule.version,
      toVersion: previousVersion.version,
      logId: result.id,
    }
  }

  private async sendAlert(result: RollbackResult): Promise<void> {
    const superUsers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            permissions: { has: 'RULE_MANAGE' },
          },
        },
      },
    })

    for (const user of superUsers) {
      await this.notificationService.send({
        userId: user.id,
        type: 'RULE_AUTO_ROLLBACK',
        title: '規則自動回滾告警',
        message: `規則 ${result.ruleId} 因準確率下降已自動回滾`,
        data: {
          ruleId: result.ruleId,
          fromVersion: result.fromVersion,
          toVersion: result.toVersion,
          logId: result.logId,
        },
        priority: 'HIGH',
      })
    }
  }
}
```

```typescript
// src/jobs/rule-accuracy-monitor.ts
import { CronJob } from 'cron'

export const ruleAccuracyMonitorJob = new CronJob(
  '0 * * * *',  // 每小時執行
  async () => {
    const autoRollbackService = new AutoRollbackService()

    // 獲取所有活躍規則
    const activeRules = await prisma.mappingRule.findMany({
      where: { status: 'ACTIVE' },
    })

    for (const rule of activeRules) {
      try {
        const result = await autoRollbackService.checkAndRollback(rule.id)
        if (result) {
          console.log(`Auto rolled back rule ${rule.id}`)
        }
      } catch (error) {
        console.error(`Error checking rule ${rule.id}:`, error)
      }
    }
  }
)
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-48]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR24]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.8 |
| Story Key | 4-8-rule-auto-rollback |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR24 |
| Dependencies | Story 4.7 |

---

*Story created: 2025-12-16*
*Completed: 2025-12-19*
*Status: done*
