# Story 5.4: 測試規則變更效果

**Status:** ready-for-dev

---

## Story

**As a** Super User,
**I want** 在規則生效前測試變更效果,
**So that** 可以驗證規則變更不會造成負面影響。

---

## Acceptance Criteria

### AC1: 測試界面入口

**Given** 編輯規則後
**When** 點擊「測試規則」
**Then** 顯示規則測試界面
**And** 可以選擇測試範圍

### AC2: 歷史發票測試

**Given** 規則測試界面
**When** 選擇歷史發票進行測試
**Then** 可選擇多個歷史發票
**And** 支援按時間範圍篩選
**And** 顯示測試進度

### AC3: 對比結果顯示

**Given** 測試執行完成
**When** 顯示測試結果
**Then** 顯示原規則 vs 新規則對比
**And** 標記改善、惡化、無變化的案例
**And** 顯示整體影響統計

### AC4: 測試報告

**Given** 測試結果
**When** 查看詳細報告
**Then** 可下載測試報告（PDF/Excel）
**And** 包含所有測試案例詳情
**And** 包含決策建議

---

## Tasks / Subtasks

- [ ] **Task 1: 測試界面頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/forwarders/[id]/rules/[ruleId]/test/page.tsx`
  - [ ] 1.2 設計測試配置區域
  - [ ] 1.3 設計結果展示區域
  - [ ] 1.4 加入導航和操作按鈕

- [ ] **Task 2: 測試配置組件** (AC: #1, #2)
  - [ ] 2.1 創建 `RuleTestConfig.tsx` 組件
  - [ ] 2.2 測試範圍選擇（全部/指定/最近 N 筆）
  - [ ] 2.3 時間範圍篩選器
  - [ ] 2.4 樣本數量設定
  - [ ] 2.5 顯示預計測試數量

- [ ] **Task 3: 歷史發票選擇器** (AC: #2)
  - [ ] 3.1 創建 `DocumentSelector.tsx` 組件
  - [ ] 3.2 顯示可選發票列表
  - [ ] 3.3 支援多選功能
  - [ ] 3.4 篩選和搜索功能
  - [ ] 3.5 顯示已選數量

- [ ] **Task 4: 測試執行服務** (AC: #2)
  - [ ] 4.1 創建 `src/services/rule-testing.ts`
  - [ ] 4.2 執行批量規則測試
  - [ ] 4.3 應用原規則和新規則
  - [ ] 4.4 對比提取結果
  - [ ] 4.5 支援進度回報

- [ ] **Task 5: 測試執行 API** (AC: #2)
  - [ ] 5.1 創建 POST `/api/forwarders/[id]/rules/[ruleId]/test`
  - [ ] 5.2 接受測試配置
  - [ ] 5.3 執行異步測試任務
  - [ ] 5.4 返回任務 ID

- [ ] **Task 6: 測試進度追蹤** (AC: #2)
  - [ ] 6.1 創建 GET `/api/test-tasks/[taskId]`
  - [ ] 6.2 返回測試進度
  - [ ] 6.3 支援 SSE 即時更新
  - [ ] 6.4 處理測試完成

- [ ] **Task 7: 對比結果組件** (AC: #3)
  - [ ] 7.1 創建 `TestResultComparison.tsx` 組件
  - [ ] 7.2 顯示整體統計卡片
  - [ ] 7.3 分類顯示（改善/惡化/無變化）
  - [ ] 7.4 案例詳情展開
  - [ ] 7.5 視覺化對比

- [ ] **Task 8: 影響統計組件** (AC: #3)
  - [ ] 8.1 創建 `ImpactStatistics.tsx` 組件
  - [ ] 8.2 改善率計算和顯示
  - [ ] 8.3 惡化案例警告
  - [ ] 8.4 決策建議生成

- [ ] **Task 9: 測試報告生成** (AC: #4)
  - [ ] 9.1 創建報告生成服務
  - [ ] 9.2 PDF 報告模板
  - [ ] 9.3 Excel 報告生成
  - [ ] 9.4 包含決策建議

- [ ] **Task 10: 報告下載 API** (AC: #4)
  - [ ] 10.1 創建 GET `/api/test-tasks/[taskId]/report`
  - [ ] 10.2 支援格式參數（pdf/xlsx）
  - [ ] 10.3 生成下載連結
  - [ ] 10.4 設定過期時間

- [ ] **Task 11: 驗證與測試** (AC: #1-4)
  - [ ] 11.1 測試界面流程
  - [ ] 11.2 測試批量執行
  - [ ] 11.3 測試進度追蹤
  - [ ] 11.4 測試結果準確性
  - [ ] 11.5 測試報告下載

---

## Dev Notes

### 依賴項

- **Story 5.3**: 規則編輯功能
- **Story 4.5**: 規則影響分析

### Architecture Compliance

```prisma
model RuleTestTask {
  id              String   @id @default(uuid())
  ruleId          String   @map("rule_id")
  forwarderId     String   @map("forwarder_id")
  originalPattern String?  @map("original_pattern")
  testPattern     String   @map("test_pattern")
  config          Json     // 測試配置
  status          TestTaskStatus @default(PENDING)
  progress        Int      @default(0)  // 0-100
  totalDocuments  Int      @map("total_documents")
  testedDocuments Int      @default(0) @map("tested_documents")
  results         Json?    // 測試結果摘要
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")

  rule      MappingRule @relation(fields: [ruleId], references: [id])
  forwarder Forwarder   @relation(fields: [forwarderId], references: [id])
  creator   User        @relation(fields: [createdBy], references: [id])
  details   RuleTestDetail[]

  @@index([status])
  @@map("rule_test_tasks")
}

model RuleTestDetail {
  id                String   @id @default(uuid())
  taskId            String   @map("task_id")
  documentId        String   @map("document_id")
  originalResult    String?  @map("original_result")
  testResult        String?  @map("test_result")
  actualValue       String?  @map("actual_value")  // 用戶確認的正確值
  originalAccurate  Boolean  @map("original_accurate")
  testAccurate      Boolean  @map("test_accurate")
  changeType        TestChangeType @map("change_type")
  createdAt         DateTime @default(now()) @map("created_at")

  task     RuleTestTask @relation(fields: [taskId], references: [id])
  document Document     @relation(fields: [documentId], references: [id])

  @@index([taskId])
  @@map("rule_test_details")
}

enum TestTaskStatus {
  PENDING     // 等待執行
  RUNNING     // 執行中
  COMPLETED   // 已完成
  FAILED      // 失敗
  CANCELLED   // 已取消
}

enum TestChangeType {
  IMPROVED    // 改善（原錯 → 新對）
  REGRESSED   // 惡化（原對 → 新錯）
  UNCHANGED   // 無變化
  BOTH_WRONG  // 都錯
  BOTH_RIGHT  // 都對
}
```

```typescript
// POST /api/forwarders/[id]/rules/[ruleId]/test
interface TestRuleRequest {
  testPattern: string
  config: {
    scope: 'all' | 'recent' | 'custom'
    recentCount?: number     // scope='recent' 時使用
    documentIds?: string[]   // scope='custom' 時使用
    dateRange?: {
      start: string
      end: string
    }
    maxDocuments?: number    // 最大測試數量限制
  }
}

interface TestRuleResponse {
  success: true
  data: {
    taskId: string
    status: 'PENDING'
    totalDocuments: number
    message: string
  }
}

// GET /api/test-tasks/[taskId]
interface TestTaskStatusResponse {
  success: true
  data: {
    id: string
    status: TestTaskStatus
    progress: number
    totalDocuments: number
    testedDocuments: number
    results?: {
      improved: number
      regressed: number
      unchanged: number
      bothWrong: number
      bothRight: number
      improvementRate: number
      regressionRate: number
    }
    completedAt: string | null
  }
}

// GET /api/test-tasks/[taskId]/details
interface TestTaskDetailsResponse {
  success: true
  data: {
    taskId: string
    details: {
      documentId: string
      fileName: string
      originalResult: string | null
      testResult: string | null
      actualValue: string | null
      originalAccurate: boolean
      testAccurate: boolean
      changeType: TestChangeType
    }[]
    pagination: {
      total: number
      page: number
      limit: number
    }
  }
}
```

```typescript
// src/services/rule-testing.ts
import { prisma } from '@/lib/prisma'
import { EventEmitter } from 'events'

export class RuleTestingService extends EventEmitter {
  async executeTest(taskId: string): Promise<void> {
    const task = await prisma.ruleTestTask.findUnique({
      where: { id: taskId },
      include: {
        rule: true,
        forwarder: true,
      },
    })

    if (!task) throw new Error('Task not found')

    // 更新狀態為執行中
    await prisma.ruleTestTask.update({
      where: { id: taskId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    })

    try {
      // 獲取測試文件
      const documents = await this.getTestDocuments(task)

      // 逐一測試
      let tested = 0
      const results = {
        improved: 0,
        regressed: 0,
        unchanged: 0,
        bothWrong: 0,
        bothRight: 0,
      }

      for (const document of documents) {
        const detail = await this.testDocument(task, document)
        results[this.getResultCategory(detail)]++
        tested++

        // 更新進度
        const progress = Math.round((tested / documents.length) * 100)
        await prisma.ruleTestTask.update({
          where: { id: taskId },
          data: {
            progress,
            testedDocuments: tested,
          },
        })

        // 發送進度事件
        this.emit('progress', { taskId, progress, tested, total: documents.length })
      }

      // 計算統計
      const total = documents.length
      const improvementRate = total > 0 ? results.improved / total : 0
      const regressionRate = total > 0 ? results.regressed / total : 0

      // 完成測試
      await prisma.ruleTestTask.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          results: {
            ...results,
            improvementRate,
            regressionRate,
          },
        },
      })

      this.emit('completed', { taskId, results })
    } catch (error) {
      await prisma.ruleTestTask.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          results: { error: error.message },
        },
      })

      this.emit('failed', { taskId, error })
      throw error
    }
  }

  private async testDocument(
    task: RuleTestTask,
    document: Document
  ): Promise<RuleTestDetail> {
    // 獲取實際值（用戶確認的正確值）
    const actualValue = await this.getActualValue(document.id, task.rule.fieldName)

    // 應用原規則
    const originalResult = await this.applyRule(
      document,
      task.originalPattern,
      task.rule.extractionType
    )

    // 應用測試規則
    const testResult = await this.applyRule(
      document,
      task.testPattern,
      task.rule.extractionType
    )

    // 判斷準確性
    const originalAccurate = originalResult === actualValue
    const testAccurate = testResult === actualValue

    // 判斷變更類型
    const changeType = this.determineChangeType(originalAccurate, testAccurate)

    // 創建詳情記錄
    return await prisma.ruleTestDetail.create({
      data: {
        taskId: task.id,
        documentId: document.id,
        originalResult,
        testResult,
        actualValue,
        originalAccurate,
        testAccurate,
        changeType,
      },
    })
  }

  private determineChangeType(originalAccurate: boolean, testAccurate: boolean): TestChangeType {
    if (!originalAccurate && testAccurate) return 'IMPROVED'
    if (originalAccurate && !testAccurate) return 'REGRESSED'
    if (originalAccurate && testAccurate) return 'BOTH_RIGHT'
    if (!originalAccurate && !testAccurate) return 'BOTH_WRONG'
    return 'UNCHANGED'
  }
}
```

```typescript
// src/app/(dashboard)/forwarders/[id]/rules/[ruleId]/test/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { RuleTestConfig } from '@/components/rules/RuleTestConfig'
import { TestResultComparison } from '@/components/rules/TestResultComparison'
import { ImpactStatistics } from '@/components/rules/ImpactStatistics'
import { Download, Play, Loader2 } from 'lucide-react'

interface Props {
  params: { id: string; ruleId: string }
  searchParams: { pattern?: string }
}

export default function RuleTestPage({ params, searchParams }: Props) {
  const [taskId, setTaskId] = useState<string | null>(null)
  const [config, setConfig] = useState<TestConfig>({
    scope: 'recent',
    recentCount: 100,
  })

  // 獲取規則資訊
  const { data: rule } = useQuery({
    queryKey: ['rule', params.ruleId],
    queryFn: () => fetchRule(params.ruleId),
  })

  // 啟動測試
  const startTestMutation = useMutation({
    mutationFn: (testConfig: TestConfig) =>
      startRuleTest(params.id, params.ruleId, {
        testPattern: searchParams.pattern || rule?.pattern,
        config: testConfig,
      }),
    onSuccess: (data) => {
      setTaskId(data.taskId)
    },
  })

  // 追蹤測試進度
  const { data: taskStatus } = useQuery({
    queryKey: ['test-task', taskId],
    queryFn: () => fetchTestTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (data) =>
      data?.status === 'RUNNING' ? 1000 : false,
  })

  // 下載報告
  const downloadReportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'xlsx') =>
      downloadTestReport(taskId!, format),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">規則測試</h1>
          <p className="text-muted-foreground">
            測試規則變更對歷史發票的影響
          </p>
        </div>
      </div>

      {/* 測試配置 */}
      {!taskId && (
        <Card>
          <CardHeader>
            <CardTitle>測試配置</CardTitle>
          </CardHeader>
          <CardContent>
            <RuleTestConfig
              forwarderId={params.id}
              value={config}
              onChange={setConfig}
            />
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => startTestMutation.mutate(config)}
                disabled={startTestMutation.isPending}
              >
                {startTestMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Play className="mr-2 h-4 w-4" />
                開始測試
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 測試進度 */}
      {taskStatus?.status === 'RUNNING' && (
        <Card>
          <CardHeader>
            <CardTitle>測試進行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={taskStatus.progress} />
              <p className="text-sm text-muted-foreground">
                已測試 {taskStatus.testedDocuments} / {taskStatus.totalDocuments} 份文件
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 測試結果 */}
      {taskStatus?.status === 'COMPLETED' && taskStatus.results && (
        <>
          <ImpactStatistics results={taskStatus.results} />

          <TestResultComparison taskId={taskId!} />

          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => downloadReportMutation.mutate('xlsx')}
              disabled={downloadReportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              下載 Excel 報告
            </Button>
            <Button
              onClick={() => downloadReportMutation.mutate('pdf')}
              disabled={downloadReportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              下載 PDF 報告
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-5-forwarder-config-management.md#story-54]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR28]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 5.4 |
| Story Key | 5-4-test-rule-change-effect |
| Epic | Epic 5: Forwarder 配置管理 |
| FR Coverage | FR28 |
| Dependencies | Story 5.3, Story 4.5 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
