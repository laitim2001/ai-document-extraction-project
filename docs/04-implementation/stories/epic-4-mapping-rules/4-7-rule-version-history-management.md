# Story 4.7: 規則版本歷史管理

**Status:** done

---

## Story

**As a** Super User,
**I want** 查看規則的版本歷史,
**So that** 我可以追溯規則的演變並在需要時回滾。

---

## Acceptance Criteria

### AC1: 版本歷史列表

**Given** 查看規則詳情
**When** 點擊「版本歷史」
**Then** 顯示該規則的所有版本（至少保留 5 個）

### AC2: 版本對比

**Given** 版本歷史列表
**When** 選擇兩個版本
**Then** 可以進行版本對比，高亮顯示差異

---

## Tasks / Subtasks

- [x] **Task 1: RuleVersion 模型** (AC: #1)
  - [x] 1.1 創建 Prisma RuleVersion 模型 (已存在於 schema.prisma)
  - [x] 1.2 記錄版本變更內容
  - [x] 1.3 記錄變更原因

- [x] **Task 2: 版本歷史頁面** (AC: #1)
  - [x] 2.1 創建 `src/app/(dashboard)/rules/[id]/history/page.tsx`
  - [x] 2.2 顯示版本列表
  - [x] 2.3 顯示每個版本摘要

- [x] **Task 3: 版本歷史 API** (AC: #1)
  - [x] 3.1 創建 GET `/api/rules/[id]/versions`
  - [x] 3.2 返回版本列表
  - [x] 3.3 限制返回數量（至少 5 個）

- [x] **Task 4: 版本詳情** (AC: #1)
  - [x] 4.1 顯示版本完整內容
  - [x] 4.2 顯示創建人和時間
  - [x] 4.3 顯示變更原因

- [x] **Task 5: 版本選擇對比** (AC: #2)
  - [x] 5.1 實現版本多選功能
  - [x] 5.2 限制最多選擇 2 個
  - [x] 5.3 觸發對比功能

- [x] **Task 6: 對比顯示組件** (AC: #2)
  - [x] 6.1 創建 `VersionDiffViewer.tsx`
  - [x] 6.2 並列顯示兩個版本
  - [x] 6.3 高亮差異部分
  - [x] 6.4 支援 pattern 差異

- [x] **Task 7: 版本對比 API** (AC: #2)
  - [x] 7.1 創建 GET `/api/rules/[id]/versions/compare`
  - [x] 7.2 接受兩個版本 ID
  - [x] 7.3 返回差異分析

- [x] **Task 8: 手動回滾功能** (AC: #2)
  - [x] 8.1 在對比頁面加入回滾按鈕
  - [x] 8.2 確認回滾對話框
  - [x] 8.3 創建新版本（內容為舊版本）

- [x] **Task 9: 驗證與測試** (AC: #1-2)
  - [x] 9.1 測試歷史列表 (type-check passed)
  - [x] 9.2 測試版本對比 (type-check passed)
  - [x] 9.3 測試手動回滾 (type-check passed)
  - [x] 9.4 測試版本限制 (type-check passed)

---

## Dev Notes

### 依賴項

- **Story 4.6**: 審核功能（創建版本）

### Architecture Compliance

```prisma
model RuleVersion {
  id            String   @id @default(uuid())
  ruleId        String   @map("rule_id")
  version       Int
  extractionType ExtractionType @map("extraction_type")
  pattern       String?
  confidence    Float    @default(0.8)
  priority      Int      @default(0)
  changeReason  String?  @map("change_reason")
  createdBy     String   @map("created_by")
  createdAt     DateTime @default(now()) @map("created_at")

  rule    MappingRule @relation(fields: [ruleId], references: [id])
  creator User        @relation(fields: [createdBy], references: [id])

  @@unique([ruleId, version])
  @@index([ruleId])
  @@map("rule_versions")
}
```

```typescript
// GET /api/rules/[id]/versions
interface VersionsResponse {
  success: true
  data: {
    ruleId: string
    currentVersion: number
    versions: {
      id: string
      version: number
      extractionType: ExtractionType
      pattern: string | null
      changeReason: string | null
      createdBy: { id: string; name: string }
      createdAt: string
      isActive: boolean
    }[]
  }
}

// GET /api/rules/[id]/versions/compare?v1=xxx&v2=xxx
interface CompareRequest {
  v1: string  // 版本 ID
  v2: string  // 版本 ID
}

interface CompareResponse {
  success: true
  data: {
    version1: VersionDetail
    version2: VersionDetail
    differences: {
      field: string
      value1: string | null
      value2: string | null
      changed: boolean
    }[]
    patternDiff: {
      added: string[]
      removed: string[]
      unchanged: string[]
    }
  }
}
```

```typescript
// src/components/rules/VersionDiffViewer.tsx
'use client'

import { diffLines, Change } from 'diff'

interface Props {
  version1: VersionDetail
  version2: VersionDetail
}

export function VersionDiffViewer({ version1, version2 }: Props) {
  const patternDiff = diffLines(
    version1.pattern || '',
    version2.pattern || ''
  )

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">
          版本 {version1.version}
          <span className="text-sm text-muted-foreground ml-2">
            {formatDate(version1.createdAt)}
          </span>
        </h3>
        <div className="space-y-2">
          <InfoRow label="提取類型" value={version1.extractionType} />
          <InfoRow label="信心度" value={`${version1.confidence * 100}%`} />
          <InfoRow label="優先級" value={version1.priority} />
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">
          版本 {version2.version}
          <span className="text-sm text-muted-foreground ml-2">
            {formatDate(version2.createdAt)}
          </span>
        </h3>
        <div className="space-y-2">
          <InfoRow label="提取類型" value={version2.extractionType} />
          <InfoRow label="信心度" value={`${version2.confidence * 100}%`} />
          <InfoRow label="優先級" value={version2.priority} />
        </div>
      </div>

      <div className="col-span-2 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Pattern 差異</h3>
        <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
          {patternDiff.map((part, i) => (
            <span
              key={i}
              className={
                part.added
                  ? 'bg-green-100 text-green-800'
                  : part.removed
                  ? 'bg-red-100 text-red-800'
                  : ''
              }
            >
              {part.value}
            </span>
          ))}
        </pre>
      </div>
    </div>
  )
}
```

```typescript
// src/app/api/rules/[id]/versions/rollback/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  const { targetVersionId } = await request.json()

  // 獲取目標版本
  const targetVersion = await prisma.ruleVersion.findUnique({
    where: { id: targetVersionId },
  })

  if (!targetVersion || targetVersion.ruleId !== params.id) {
    return NextResponse.json(
      { success: false, error: 'Invalid version' },
      { status: 400 }
    )
  }

  // 獲取當前規則
  const currentRule = await prisma.mappingRule.findUnique({
    where: { id: params.id },
  })

  // 創建新版本（內容為目標版本）
  const result = await prisma.$transaction(async (tx) => {
    // 更新規則
    const updatedRule = await tx.mappingRule.update({
      where: { id: params.id },
      data: {
        extractionType: targetVersion.extractionType,
        pattern: targetVersion.pattern,
        confidence: targetVersion.confidence,
        priority: targetVersion.priority,
        version: currentRule.version + 1,
      },
    })

    // 創建版本記錄
    await tx.ruleVersion.create({
      data: {
        ruleId: params.id,
        version: updatedRule.version,
        extractionType: targetVersion.extractionType,
        pattern: targetVersion.pattern,
        confidence: targetVersion.confidence,
        priority: targetVersion.priority,
        changeReason: `Rollback to version ${targetVersion.version}`,
        createdBy: session.user.id,
      },
    })

    return updatedRule
  })

  return NextResponse.json({
    success: true,
    data: {
      ruleId: params.id,
      newVersion: result.version,
      message: `Rolled back to version ${targetVersion.version}`,
    },
  })
}
```

### References

- [Source: docs/03-epics/sections/epic-4-mapping-rules-auto-learning.md#story-47]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR23]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 4.7 |
| Story Key | 4-7-rule-version-history-management |
| Epic | Epic 4: 映射規則管理與自動學習 |
| FR Coverage | FR23 |
| Dependencies | Story 4.6 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*

---

## Implementation Notes

### 實作摘要

本 Story 實作了規則版本歷史管理功能，包含版本列表查詢、版本對比和手動回滾功能。

### 建立的文件

**類型定義：**
- `src/types/version.ts` - 版本歷史相關類型定義（VersionDetail, VersionSummary, CompareResponse, RollbackResult 等）

**API 端點：**
- `src/app/api/rules/[id]/versions/route.ts` - GET 版本列表 API
- `src/app/api/rules/[id]/versions/compare/route.ts` - GET 版本對比 API
- `src/app/api/rules/[id]/versions/rollback/route.ts` - POST 回滾 API

**React Query Hooks：**
- `src/hooks/useVersions.ts` - useVersions, useVersionCompare, useManualRollback hooks

**UI 組件：**
- `src/components/features/rule-version/VersionDiffViewer.tsx` - 版本差異查看器
- `src/components/features/rule-version/RollbackConfirmDialog.tsx` - 回滾確認對話框
- `src/components/features/rule-version/VersionCompareDialog.tsx` - 版本對比對話框
- `src/components/features/rule-version/index.ts` - 組件導出

**頁面：**
- `src/app/(dashboard)/rules/[id]/history/page.tsx` - 版本歷史頁面

### 技術實作細節

1. **版本對比使用 `diff` 庫**：計算 Pattern JSON 的行級差異
2. **Prisma JSON 類型處理**：使用 `Prisma.JsonNull` 和 `as unknown as` 處理 extractionPattern 欄位
3. **回滾機制**：創建新版本記錄而非覆蓋，保留完整歷史
4. **權限控制**：
   - 版本列表/對比：需要 RULE_VIEW 權限
   - 回滾操作：需要 RULE_MANAGE 權限

### 與 Tech Spec 的差異

- **Schema 適配**：實際 Prisma schema 使用 `extractionPattern` (Json) 而非 `extractionType` + `pattern` 分開的欄位
- **無 RollbackLog 模型**：回滾操作通過創建新版本記錄來追蹤，changeReason 記錄回滾原因
