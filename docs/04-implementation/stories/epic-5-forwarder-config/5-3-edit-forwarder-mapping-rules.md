# Story 5.3: 編輯 Forwarder 映射規則

**Status:** done

---

## Story

**As a** Super User,
**I want** 編輯 Forwarder 特定的映射規則,
**So that** 可以優化特定 Forwarder 的提取準確性。

---

## Acceptance Criteria

### AC1: 規則編輯入口

**Given** 在 Forwarder 詳情頁面
**When** 點擊「編輯規則」
**Then** 顯示該 Forwarder 的規則編輯界面
**And** 列出所有關聯的映射規則

### AC2: 規則內容編輯

**Given** 編輯規則界面
**When** 修改規則內容
**Then** 可以編輯：提取模式、優先級、信心度閾值
**And** 提供即時預覽功能

### AC3: 審核流程

**Given** 編輯規則完成
**When** 提交修改
**Then** 規則變更需要經過審核流程
**And** 創建變更請求記錄
**And** 通知審核人員

### AC4: 新增規則

**Given** 規則編輯界面
**When** 點擊「新增規則」
**Then** 可為該 Forwarder 新增映射規則
**And** 同樣需要經過審核流程

---

## Tasks / Subtasks

- [x] **Task 1: 規則編輯頁面** (AC: #1)
  - [x] 1.1 創建 `src/app/(dashboard)/forwarders/[id]/rules/page.tsx`
  - [x] 1.2 顯示規則列表（可編輯模式）
  - [x] 1.3 加入新增規則按鈕
  - [x] 1.4 加入批量操作功能

- [x] **Task 2: 規則編輯表單** (AC: #2)
  - [x] 2.1 創建 `RuleEditForm.tsx` 組件
  - [x] 2.2 提取模式類型選擇
  - [x] 2.3 Pattern 編輯器（根據類型動態切換）
  - [x] 2.4 優先級滑桿
  - [x] 2.5 信心度閾值設定
  - [x] 2.6 表單驗證

- [x] **Task 3: Pattern 編輯器** (AC: #2)
  - [x] 3.1 REGEX 模式：正則編輯器 + 語法高亮
  - [x] 3.2 POSITION 模式：座標選擇器
  - [x] 3.3 KEYWORD 模式：關鍵字列表編輯
  - [x] 3.4 AI_PROMPT 模式：提示詞編輯器
  - [x] 3.5 TEMPLATE 模式：模板設計器

- [x] **Task 4: 即時預覽功能** (AC: #2)
  - [x] 4.1 創建 `RulePreview.tsx` 組件
  - [x] 4.2 選擇測試文件
  - [x] 4.3 執行規則預覽
  - [x] 4.4 顯示提取結果
  - [x] 4.5 標記匹配位置

- [x] **Task 5: 變更請求創建** (AC: #3)
  - [x] 5.1 創建 RuleChangeRequest 模型
  - [x] 5.2 記錄變更前後內容
  - [x] 5.3 設定變更類型（CREATE/UPDATE/DELETE）
  - [x] 5.4 關聯審核流程

- [x] **Task 6: 規則編輯 API** (AC: #2, #3)
  - [x] 6.1 創建 PUT `/api/forwarders/[id]/rules/[ruleId]`
  - [x] 6.2 驗證編輯內容
  - [x] 6.3 創建變更請求
  - [x] 6.4 不直接修改規則（待審核）

- [x] **Task 7: 新增規則 API** (AC: #4)
  - [x] 7.1 創建 POST `/api/forwarders/[id]/rules`
  - [x] 7.2 驗證規則內容
  - [x] 7.3 創建待審核的規則建議
  - [x] 7.4 關聯到 Forwarder

- [x] **Task 8: 審核通知** (AC: #3)
  - [x] 8.1 查詢有審核權限的用戶
  - [x] 8.2 創建通知記錄
  - [x] 8.3 發送即時通知
  - [x] 8.4 包含變更摘要

- [x] **Task 9: 權限控制** (AC: #1-4)
  - [x] 9.1 驗證 RULE_EDIT 權限
  - [x] 9.2 驗證 Forwarder 訪問權限
  - [x] 9.3 記錄操作日誌

- [x] **Task 10: 驗證與測試** (AC: #1-4)
  - [x] 10.1 測試規則編輯
  - [x] 10.2 測試預覽功能
  - [x] 10.3 測試審核流程
  - [x] 10.4 測試新增規則
  - [x] 10.5 測試權限控制

---

## Dev Notes

### 依賴項

- **Story 5.2**: Forwarder 詳情頁面
- **Story 4.6**: 規則審核流程

### Architecture Compliance

```prisma
model RuleChangeRequest {
  id              String   @id @default(uuid())
  ruleId          String?  @map("rule_id")  // null for new rules
  forwarderId     String   @map("forwarder_id")
  changeType      ChangeType
  beforeContent   Json?    @map("before_content")
  afterContent    Json     @map("after_content")
  reason          String?
  status          ChangeRequestStatus @default(PENDING)
  requestedBy     String   @map("requested_by")
  reviewedBy      String?  @map("reviewed_by")
  reviewNotes     String?  @map("review_notes")
  createdAt       DateTime @default(now()) @map("created_at")
  reviewedAt      DateTime? @map("reviewed_at")

  rule        MappingRule? @relation(fields: [ruleId], references: [id])
  forwarder   Forwarder    @relation(fields: [forwarderId], references: [id])
  requester   User         @relation("Requester", fields: [requestedBy], references: [id])
  reviewer    User?        @relation("Reviewer", fields: [reviewedBy], references: [id])

  @@index([forwarderId])
  @@index([status])
  @@map("rule_change_requests")
}

enum ChangeType {
  CREATE    // 新增規則
  UPDATE    // 修改規則
  DELETE    // 刪除規則
  ACTIVATE  // 啟用規則
  DEACTIVATE // 停用規則
}

enum ChangeRequestStatus {
  PENDING     // 待審核
  APPROVED    // 已批准
  REJECTED    // 已拒絕
  CANCELLED   // 已取消
}
```

```typescript
// PUT /api/forwarders/[id]/rules/[ruleId]
interface UpdateRuleRequest {
  extractionType?: ExtractionType
  pattern?: string
  priority?: number
  confidence?: number
  reason?: string  // 變更原因
}

interface UpdateRuleResponse {
  success: true
  data: {
    changeRequestId: string
    status: 'PENDING'
    message: string
  }
}

// POST /api/forwarders/[id]/rules
interface CreateRuleRequest {
  fieldName: string
  extractionType: ExtractionType
  pattern?: string
  priority?: number
  confidence?: number
  reason?: string
}
```

```typescript
// src/app/api/forwarders/[id]/rules/[ruleId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  const session = await auth()

  // 權限檢查
  if (!hasPermission(session, PERMISSIONS.RULE_EDIT)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    )
  }

  const body = await request.json()

  // 獲取現有規則
  const existingRule = await prisma.mappingRule.findUnique({
    where: { id: params.ruleId },
  })

  if (!existingRule || existingRule.forwarderId !== params.id) {
    return NextResponse.json(
      { success: false, error: 'Rule not found' },
      { status: 404 }
    )
  }

  // 創建變更請求（不直接修改規則）
  const changeRequest = await prisma.ruleChangeRequest.create({
    data: {
      ruleId: params.ruleId,
      forwarderId: params.id,
      changeType: 'UPDATE',
      beforeContent: {
        extractionType: existingRule.extractionType,
        pattern: existingRule.pattern,
        priority: existingRule.priority,
        confidence: existingRule.confidence,
      },
      afterContent: {
        extractionType: body.extractionType ?? existingRule.extractionType,
        pattern: body.pattern ?? existingRule.pattern,
        priority: body.priority ?? existingRule.priority,
        confidence: body.confidence ?? existingRule.confidence,
      },
      reason: body.reason,
      requestedBy: session.user.id,
    },
  })

  // 發送審核通知
  await notifyReviewers(changeRequest)

  return NextResponse.json({
    success: true,
    data: {
      changeRequestId: changeRequest.id,
      status: 'PENDING',
      message: 'Rule change request submitted for review',
    },
  })
}

async function notifyReviewers(changeRequest: RuleChangeRequest) {
  const reviewers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          permissions: { has: PERMISSIONS.RULE_APPROVE },
        },
      },
    },
  })

  for (const reviewer of reviewers) {
    await prisma.notification.create({
      data: {
        userId: reviewer.id,
        type: 'RULE_CHANGE_REQUEST',
        title: '規則變更申請',
        message: `有新的規則變更申請需要審核`,
        data: {
          changeRequestId: changeRequest.id,
          forwarderId: changeRequest.forwarderId,
          changeType: changeRequest.changeType,
        },
      },
    })
  }
}
```

```typescript
// src/app/(dashboard)/forwarders/[id]/rules/page.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RuleEditForm } from '@/components/rules/RuleEditForm'
import { RulePreview } from '@/components/rules/RulePreview'
import { Plus, Edit, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  params: { id: string }
}

export default function ForwarderRulesPage({ params }: Props) {
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null)
  const [previewRule, setPreviewRule] = useState<MappingRule | null>(null)
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false)

  const { data: rules, isLoading } = useQuery({
    queryKey: ['forwarder-rules', params.id],
    queryFn: () => fetchForwarderRules(params.id),
  })

  const updateMutation = useMutation({
    mutationFn: (data: { ruleId: string; updates: UpdateRuleRequest }) =>
      updateRule(params.id, data.ruleId, data.updates),
    onSuccess: () => {
      setEditingRule(null)
      toast.success('規則變更已提交審核')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">映射規則管理</h2>
        <Button onClick={() => setIsNewRuleOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增規則
        </Button>
      </div>

      {/* 規則列表 */}
      <div className="space-y-4">
        {rules?.map((rule) => (
          <Card key={rule.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{rule.fieldName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {rule.extractionType} | 優先級: {rule.priority}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewRule(rule)}
                >
                  <Eye className="mr-1 h-4 w-4" />
                  預覽
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRule(rule)}
                >
                  <Edit className="mr-1 h-4 w-4" />
                  編輯
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="rounded bg-muted p-4 text-sm overflow-x-auto">
                {rule.pattern || '(無 Pattern)'}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 編輯對話框 */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>編輯規則: {editingRule?.fieldName}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <RuleEditForm
              rule={editingRule}
              onSubmit={(updates) =>
                updateMutation.mutate({ ruleId: editingRule.id, updates })
              }
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 預覽對話框 */}
      <Dialog open={!!previewRule} onOpenChange={() => setPreviewRule(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>規則預覽: {previewRule?.fieldName}</DialogTitle>
          </DialogHeader>
          {previewRule && (
            <RulePreview rule={previewRule} forwarderId={params.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* 新增規則對話框 */}
      <Dialog open={isNewRuleOpen} onOpenChange={setIsNewRuleOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>新增映射規則</DialogTitle>
          </DialogHeader>
          <RuleEditForm
            forwarderId={params.id}
            onSubmit={handleCreateRule}
            isNew
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

```typescript
// src/components/rules/RulePreview.tsx
'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface Props {
  rule: MappingRule
  forwarderId: string
}

export function RulePreview({ rule, forwarderId }: Props) {
  const [selectedDocument, setSelectedDocument] = useState<string>('')

  const { data: documents } = useQuery({
    queryKey: ['forwarder-documents', forwarderId],
    queryFn: () => fetchRecentDocuments(forwarderId, 10),
  })

  const previewMutation = useMutation({
    mutationFn: () => previewRule(rule.id, selectedDocument),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedDocument} onValueChange={setSelectedDocument}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="選擇測試文件" />
          </SelectTrigger>
          <SelectContent>
            {documents?.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.fileName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => previewMutation.mutate()}
          disabled={!selectedDocument || previewMutation.isPending}
        >
          {previewMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          執行預覽
        </Button>
      </div>

      {previewMutation.data && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">提取結果</h4>
                <p className="text-lg">
                  {previewMutation.data.extractedValue || '(未提取到)'}
                </p>
                <Badge className="mt-2">
                  信心度: {(previewMutation.data.confidence * 100).toFixed(1)}%
                </Badge>
              </div>
              <div>
                <h4 className="font-medium mb-2">匹配位置</h4>
                {previewMutation.data.matchPosition && (
                  <DocumentHighlight
                    documentId={selectedDocument}
                    position={previewMutation.data.matchPosition}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-5-forwarder-config-management.md#story-53]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR27]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 5.3 |
| Story Key | 5-3-edit-forwarder-mapping-rules |
| Epic | Epic 5: Forwarder 配置管理 |
| FR Coverage | FR27 |
| Dependencies | Story 5.2, Story 4.6 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*
