# Tech Spec: Story 4-2 建議新映射規則

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 4.2
- **Title**: 建議新映射規則
- **Epic**: Epic 4 - 映射規則管理與自動學習

### 1.2 Story Description
作為 Super User，我希望建議新的映射規則，以便系統可以更準確地提取特定 Forwarder 的發票。

### 1.3 Dependencies
- **Story 4-1**: 規則列表基礎（規則模型和類型定義）
- **Story 3-8 連接**: 升級案例可創建規則建議

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 建議新規則入口 | NewRulePage + 規則創建表單 |
| AC2 | 規則表單內容 | 動態 Pattern Editor + Forwarder/Field 選擇 |
| AC3 | 提交審核流程 | POST /api/rules + 狀態 PENDING_REVIEW + 通知 |

---

## 3. Architecture Overview

### 3.1 Rule Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         建議新規則流程                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Super User                                                                  │
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    新規則表單 /rules/new                               │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 1: 基本資訊                                                 │ │   │
│  │  │ • Forwarder 選擇 (支援搜索)                                      │ │   │
│  │  │ • 目標欄位選擇 (標準欄位 + 自定義)                                 │ │   │
│  │  │ • 提取類型選擇 (REGEX/POSITION/KEYWORD/AI_PROMPT/TEMPLATE)        │ │   │
│  │  │ • 優先級設定 (0-100)                                             │ │   │
│  │  │ • 說明描述                                                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 2: Pattern 編輯器 (根據類型動態渲染)                         │ │   │
│  │  │                                                                  │ │   │
│  │  │ REGEX:     ┌──────────────────────────────────────────────────┐ │ │   │
│  │  │            │ 正則表達式輸入 + 語法驗證 + 測試結果預覽           │ │ │   │
│  │  │            └──────────────────────────────────────────────────┘ │ │   │
│  │  │                                                                  │ │   │
│  │  │ POSITION:  ┌──────────────────────────────────────────────────┐ │ │   │
│  │  │            │ PDF 座標選擇器 (x, y, width, height, page)        │ │ │   │
│  │  │            └──────────────────────────────────────────────────┘ │ │   │
│  │  │                                                                  │ │   │
│  │  │ KEYWORD:   ┌──────────────────────────────────────────────────┐ │ │   │
│  │  │            │ 關鍵字列表 + 相對位置設定                          │ │ │   │
│  │  │            └──────────────────────────────────────────────────┘ │ │   │
│  │  │                                                                  │ │   │
│  │  │ AI_PROMPT: ┌──────────────────────────────────────────────────┐ │ │   │
│  │  │            │ 提示詞編輯器 + 變數插入                           │ │ │   │
│  │  │            └──────────────────────────────────────────────────┘ │ │   │
│  │  │                                                                  │ │   │
│  │  │ TEMPLATE:  ┌──────────────────────────────────────────────────┐ │ │   │
│  │  │            │ 模板設計器 + 區域標記                             │ │ │   │
│  │  │            └──────────────────────────────────────────────────┘ │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Step 3: 規則測試                                                 │ │   │
│  │  │ • 選擇或上傳測試文件                                             │ │   │
│  │  │ • 執行規則預覽                                                   │ │   │
│  │  │ • 顯示提取結果                                                   │ │   │
│  │  │ • 標記匹配位置 (PDF overlay)                                     │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  [取消]                                      [儲存草稿] [提交審核]    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                              │ 提交審核                                     │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ POST /api/rules                                                       │   │
│  │ • 創建 RuleSuggestion 記錄                                            │   │
│  │ • 狀態設為 PENDING_REVIEW                                             │   │
│  │ • 發送通知給有審核權限的 Super User                                    │   │
│  │ • 記錄審計日誌                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── app/(dashboard)/rules/
│   └── new/
│       └── page.tsx                         # 新規則頁面
├── app/api/rules/
│   ├── route.ts                             # POST 創建規則 API (擴展)
│   └── test/
│       └── route.ts                         # POST 規則測試 API
├── components/features/rules/
│   ├── NewRuleForm.tsx                      # 新規則表單組件
│   ├── ForwarderSelector.tsx                # Forwarder 選擇器
│   ├── FieldNameSelector.tsx                # 欄位名稱選擇器
│   ├── ExtractionTypeSelector.tsx           # 提取類型選擇器
│   ├── PatternEditor/
│   │   ├── index.tsx                        # Pattern 編輯器入口
│   │   ├── RegexEditor.tsx                  # 正則編輯器
│   │   ├── PositionEditor.tsx               # 位置編輯器
│   │   ├── KeywordEditor.tsx                # 關鍵字編輯器
│   │   ├── PromptEditor.tsx                 # AI 提示詞編輯器
│   │   └── TemplateEditor.tsx               # 模板編輯器
│   ├── RuleTestPanel.tsx                    # 規則測試面板
│   └── TestResultViewer.tsx                 # 測試結果查看器
├── hooks/
│   ├── useCreateRule.ts                     # 創建規則 Hook
│   └── useTestRule.ts                       # 測試規則 Hook
└── types/
    └── rule.ts                              # 擴展規則類型
```

---

## 4. Implementation Guide

### Phase 1: Type Extensions (AC2)

**File**: `src/types/rule.ts` (擴展)

```typescript
import { ExtractionType } from '@prisma/client'

// ===== 規則創建相關類型 =====

// 創建規則請求
export interface CreateRuleRequest {
  forwarderId: string
  fieldName: string
  extractionType: ExtractionType
  pattern: string | PatternConfig
  priority?: number
  confidence?: number
  description?: string
  saveAsDraft?: boolean
}

// Pattern 配置（根據不同類型有不同結構）
export type PatternConfig =
  | RegexPattern
  | PositionPattern
  | KeywordPattern
  | PromptPattern
  | TemplatePattern

export interface RegexPattern {
  type: 'REGEX'
  expression: string
  flags?: string   // 'i', 'g', 'm' 等
  groups?: string[] // 命名捕獲組
}

export interface PositionPattern {
  type: 'POSITION'
  coordinates: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  tolerance?: number  // 容差百分比
}

export interface KeywordPattern {
  type: 'KEYWORD'
  keywords: string[]
  position: 'before' | 'after' | 'above' | 'below'
  offset?: number
  maxDistance?: number
}

export interface PromptPattern {
  type: 'AI_PROMPT'
  prompt: string
  outputFormat?: string
  examples?: {
    input: string
    output: string
  }[]
}

export interface TemplatePattern {
  type: 'TEMPLATE'
  templateId?: string
  regions: {
    name: string
    coordinates: PositionPattern['coordinates']
  }[]
}

// 創建規則響應
export interface CreateRuleResponse {
  success: true
  data: {
    suggestionId: string
    status: 'DRAFT' | 'PENDING_REVIEW'
    message: string
  }
}

// ===== 規則測試相關類型 =====

export interface TestRuleRequest {
  extractionType: ExtractionType
  pattern: string | PatternConfig
  documentId?: string       // 已上傳文件
  documentContent?: string  // Base64 內容
}

export interface TestRuleResponse {
  success: true
  data: {
    matched: boolean
    extractedValue: string | null
    confidence: number
    matchPositions?: {
      page: number
      x: number
      y: number
      width: number
      height: number
      text: string
    }[]
    debugInfo?: {
      processingTime: number
      matchAttempts: number
      errors?: string[]
    }
  }
}

// ===== 表單驗證 Schema =====

export const regexPatternSchema = z.object({
  expression: z.string()
    .min(1, '請輸入正則表達式')
    .refine((val) => {
      try {
        new RegExp(val)
        return true
      } catch {
        return false
      }
    }, '正則表達式語法錯誤'),
  flags: z.string().optional(),
  groups: z.array(z.string()).optional()
})

export const positionPatternSchema = z.object({
  coordinates: z.object({
    page: z.number().min(1, '頁碼必須大於 0'),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(0).max(100),
    height: z.number().min(0).max(100)
  }),
  tolerance: z.number().min(0).max(50).optional()
})

export const keywordPatternSchema = z.object({
  keywords: z.array(z.string()).min(1, '至少需要一個關鍵字'),
  position: z.enum(['before', 'after', 'above', 'below']),
  offset: z.number().optional(),
  maxDistance: z.number().optional()
})

export const promptPatternSchema = z.object({
  prompt: z.string().min(10, '提示詞至少需要 10 個字符'),
  outputFormat: z.string().optional(),
  examples: z.array(z.object({
    input: z.string(),
    output: z.string()
  })).optional()
})

export const createRuleSchema = z.object({
  forwarderId: z.string().uuid('請選擇 Forwarder'),
  fieldName: z.string().min(1, '請選擇目標欄位'),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  priority: z.number().min(0).max(100).default(0),
  confidence: z.number().min(0).max(1).default(0.8),
  description: z.string().optional(),
  saveAsDraft: z.boolean().optional()
})
```

---

### Phase 2: API Layer (AC1, AC3)

#### 4.2.1 創建規則 API

**File**: `src/app/api/rules/route.ts` (擴展 POST)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { notifySuperUsers } from '@/services/notificationService'
import { z } from 'zod'

// ... 保留原有的 GET 方法 ...

// 創建規則 Schema
const createRuleSchema = z.object({
  forwarderId: z.string().uuid(),
  fieldName: z.string().min(1),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  pattern: z.union([z.string(), z.record(z.any())]),
  priority: z.number().min(0).max(100).optional().default(0),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  description: z.string().optional(),
  saveAsDraft: z.boolean().optional().default(false)
})

// POST /api/rules - 創建規則建議
export async function POST(request: NextRequest) {
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

  // 權限檢查
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

  try {
    const body = await request.json()
    const validation = createRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: validation.error.flatten()
        }
      }, { status: 400 })
    }

    const {
      forwarderId,
      fieldName,
      extractionType,
      pattern,
      priority,
      confidence,
      description,
      saveAsDraft
    } = validation.data

    // 驗證 Forwarder 存在
    const forwarder = await prisma.forwarder.findUnique({
      where: { id: forwarderId }
    })

    if (!forwarder) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: 'Forwarder not found'
        }
      }, { status: 404 })
    }

    // 檢查是否存在相同的 active 規則
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        forwarderId,
        fieldName,
        status: 'ACTIVE'
      }
    })

    // 序列化 pattern
    const patternStr = typeof pattern === 'string'
      ? pattern
      : JSON.stringify(pattern)

    // 創建規則建議
    const suggestion = await prisma.ruleSuggestion.create({
      data: {
        forwarderId,
        fieldName,
        extractionType,
        currentPattern: existingRule?.pattern,
        suggestedPattern: patternStr,
        source: 'MANUAL',
        status: saveAsDraft ? 'DRAFT' : 'PENDING',
        suggestedBy: session.user.id,
        description
      }
    })

    // 如果不是草稿，發送通知
    if (!saveAsDraft) {
      await notifySuperUsers({
        type: 'RULE_SUGGESTION',
        title: '新的規則建議',
        message: `${forwarder.name} - ${fieldName} 有新的規則建議待審核`,
        data: {
          suggestionId: suggestion.id,
          forwarderName: forwarder.name,
          fieldName,
          suggestedBy: session.user.name
        }
      })
    }

    // 記錄審計日誌
    await logAudit({
      userId: session.user.id,
      action: 'RULE_SUGGESTION_CREATED',
      resourceType: 'RuleSuggestion',
      resourceId: suggestion.id,
      details: {
        forwarderId,
        fieldName,
        extractionType,
        status: saveAsDraft ? 'DRAFT' : 'PENDING'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestionId: suggestion.id,
        status: saveAsDraft ? 'DRAFT' : 'PENDING_REVIEW',
        message: saveAsDraft
          ? '規則已儲存為草稿'
          : '規則已提交審核，待 Super User 批准'
      }
    })

  } catch (error) {
    console.error('Failed to create rule suggestion:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to create rule suggestion'
      }
    }, { status: 500 })
  }
}
```

#### 4.2.2 規則測試 API

**File**: `src/app/api/rules/test/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { RuleTestService } from '@/services/rule-test'
import { z } from 'zod'

const testRuleSchema = z.object({
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  pattern: z.union([z.string(), z.record(z.any())]),
  documentId: z.string().uuid().optional(),
  documentContent: z.string().optional()  // Base64
}).refine(
  data => data.documentId || data.documentContent,
  { message: 'documentId or documentContent is required' }
)

// POST /api/rules/test - 測試規則
export async function POST(request: NextRequest) {
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

  // 權限檢查
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

  try {
    const body = await request.json()
    const validation = testRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: validation.error.flatten()
        }
      }, { status: 400 })
    }

    const { extractionType, pattern, documentId, documentContent } = validation.data

    // 獲取文件內容
    let pdfContent: Buffer
    let document: any = null

    if (documentId) {
      document = await prisma.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        return NextResponse.json({
          success: false,
          error: {
            type: 'not_found',
            title: 'Not Found',
            status: 404,
            detail: 'Document not found'
          }
        }, { status: 404 })
      }

      // 從存儲獲取文件
      pdfContent = await getFileFromStorage(document.fileUrl)
    } else {
      // 從 Base64 解碼
      pdfContent = Buffer.from(documentContent!, 'base64')
    }

    // 執行測試
    const testService = new RuleTestService()
    const startTime = Date.now()

    const result = await testService.test({
      extractionType,
      pattern: typeof pattern === 'string' ? pattern : JSON.stringify(pattern),
      pdfContent
    })

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        matched: result.matched,
        extractedValue: result.value,
        confidence: result.confidence,
        matchPositions: result.positions,
        debugInfo: {
          processingTime,
          matchAttempts: result.attempts || 1,
          errors: result.errors
        }
      }
    })

  } catch (error) {
    console.error('Failed to test rule:', error)
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to test rule'
      }
    }, { status: 500 })
  }
}
```

---

### Phase 3: Rule Test Service (AC2)

**File**: `src/services/rule-test.ts`

```typescript
import * as pdfjs from 'pdfjs-dist'
import { ExtractionType } from '@prisma/client'

interface TestParams {
  extractionType: ExtractionType
  pattern: string
  pdfContent: Buffer
}

interface TestResult {
  matched: boolean
  value: string | null
  confidence: number
  positions: MatchPosition[]
  attempts?: number
  errors?: string[]
}

interface MatchPosition {
  page: number
  x: number
  y: number
  width: number
  height: number
  text: string
}

export class RuleTestService {
  async test(params: TestParams): Promise<TestResult> {
    const { extractionType, pattern, pdfContent } = params

    switch (extractionType) {
      case 'REGEX':
        return this.testRegex(pattern, pdfContent)
      case 'POSITION':
        return this.testPosition(pattern, pdfContent)
      case 'KEYWORD':
        return this.testKeyword(pattern, pdfContent)
      case 'AI_PROMPT':
        return this.testAIPrompt(pattern, pdfContent)
      case 'TEMPLATE':
        return this.testTemplate(pattern, pdfContent)
      default:
        throw new Error(`Unsupported extraction type: ${extractionType}`)
    }
  }

  private async testRegex(patternStr: string, pdfContent: Buffer): Promise<TestResult> {
    const errors: string[] = []
    const positions: MatchPosition[] = []

    try {
      // 解析 pattern
      const config = JSON.parse(patternStr) as {
        expression: string
        flags?: string
      }

      const regex = new RegExp(config.expression, config.flags || 'g')

      // 提取 PDF 文字
      const doc = await pdfjs.getDocument({ data: pdfContent }).promise
      let fullText = ''
      const pageTexts: { page: number; text: string; items: any[] }[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const items = content.items as any[]
        const text = items.map(item => item.str).join(' ')
        fullText += text + '\n'
        pageTexts.push({ page: i, text, items })
      }

      // 執行匹配
      const matches = fullText.matchAll(regex)
      const matchArray = [...matches]

      if (matchArray.length === 0) {
        return {
          matched: false,
          value: null,
          confidence: 0,
          positions: [],
          attempts: 1
        }
      }

      // 取第一個匹配
      const firstMatch = matchArray[0]
      const value = firstMatch[0]

      // 計算位置（簡化版，實際需要更精確的座標計算）
      for (const pageData of pageTexts) {
        if (pageData.text.includes(value)) {
          // 找到包含匹配文字的項目
          for (const item of pageData.items) {
            if (item.str.includes(value) || value.includes(item.str)) {
              positions.push({
                page: pageData.page,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width || 100,
                height: item.height || 20,
                text: item.str
              })
            }
          }
          break
        }
      }

      return {
        matched: true,
        value,
        confidence: 0.9,
        positions,
        attempts: 1
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error')
      return {
        matched: false,
        value: null,
        confidence: 0,
        positions: [],
        errors
      }
    }
  }

  private async testPosition(patternStr: string, pdfContent: Buffer): Promise<TestResult> {
    try {
      const config = JSON.parse(patternStr) as {
        coordinates: {
          page: number
          x: number
          y: number
          width: number
          height: number
        }
        tolerance?: number
      }

      const doc = await pdfjs.getDocument({ data: pdfContent }).promise

      if (config.coordinates.page > doc.numPages) {
        return {
          matched: false,
          value: null,
          confidence: 0,
          positions: [],
          errors: [`Page ${config.coordinates.page} does not exist`]
        }
      }

      const page = await doc.getPage(config.coordinates.page)
      const content = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1 })

      // 轉換百分比座標為實際座標
      const actualX = (config.coordinates.x / 100) * viewport.width
      const actualY = (config.coordinates.y / 100) * viewport.height
      const actualWidth = (config.coordinates.width / 100) * viewport.width
      const actualHeight = (config.coordinates.height / 100) * viewport.height
      const tolerance = config.tolerance || 5

      // 找到區域內的文字
      const items = content.items as any[]
      const matchedItems: any[] = []

      for (const item of items) {
        const itemX = item.transform[4]
        const itemY = viewport.height - item.transform[5]  // PDF Y 軸反轉

        const tolerancePx = (tolerance / 100) * Math.min(viewport.width, viewport.height)

        if (
          itemX >= actualX - tolerancePx &&
          itemX <= actualX + actualWidth + tolerancePx &&
          itemY >= actualY - tolerancePx &&
          itemY <= actualY + actualHeight + tolerancePx
        ) {
          matchedItems.push(item)
        }
      }

      if (matchedItems.length === 0) {
        return {
          matched: false,
          value: null,
          confidence: 0,
          positions: []
        }
      }

      const value = matchedItems.map(i => i.str).join(' ').trim()

      return {
        matched: true,
        value,
        confidence: 0.85,
        positions: [{
          page: config.coordinates.page,
          x: actualX,
          y: actualY,
          width: actualWidth,
          height: actualHeight,
          text: value
        }]
      }

    } catch (error) {
      return {
        matched: false,
        value: null,
        confidence: 0,
        positions: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  private async testKeyword(patternStr: string, pdfContent: Buffer): Promise<TestResult> {
    try {
      const config = JSON.parse(patternStr) as {
        keywords: string[]
        position: 'before' | 'after' | 'above' | 'below'
        offset?: number
        maxDistance?: number
      }

      const doc = await pdfjs.getDocument({ data: pdfContent }).promise
      const positions: MatchPosition[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const items = content.items as any[]
        const text = items.map(item => item.str).join(' ')

        // 找關鍵字
        for (const keyword of config.keywords) {
          const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase())
          if (keywordIndex === -1) continue

          // 根據位置提取值
          let value: string | null = null
          const offset = config.offset || 0
          const maxDistance = config.maxDistance || 100

          switch (config.position) {
            case 'after': {
              const afterText = text.substring(keywordIndex + keyword.length)
              const match = afterText.match(/^\s*[:：]?\s*(\S+)/)
              value = match?.[1] || null
              break
            }
            case 'before': {
              const beforeText = text.substring(0, keywordIndex)
              const match = beforeText.match(/(\S+)\s*[:：]?\s*$/)
              value = match?.[1] || null
              break
            }
            // above/below 需要更複雜的座標計算
            default:
              break
          }

          if (value) {
            return {
              matched: true,
              value,
              confidence: 0.8,
              positions
            }
          }
        }
      }

      return {
        matched: false,
        value: null,
        confidence: 0,
        positions: []
      }

    } catch (error) {
      return {
        matched: false,
        value: null,
        confidence: 0,
        positions: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  private async testAIPrompt(patternStr: string, pdfContent: Buffer): Promise<TestResult> {
    // AI 提示詞測試需要調用 LLM API
    // 這裡提供簡化實現
    try {
      const config = JSON.parse(patternStr) as {
        prompt: string
        outputFormat?: string
      }

      const doc = await pdfjs.getDocument({ data: pdfContent }).promise
      let fullText = ''

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        fullText += (content.items as any[]).map(item => item.str).join(' ') + '\n'
      }

      // 調用 LLM（這裡需要整合實際的 AI 服務）
      // const result = await callLLM(config.prompt, fullText)

      // 模擬結果
      return {
        matched: true,
        value: '[AI Extraction Result]',
        confidence: 0.75,
        positions: [],
        errors: ['AI extraction requires LLM integration']
      }

    } catch (error) {
      return {
        matched: false,
        value: null,
        confidence: 0,
        positions: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  private async testTemplate(patternStr: string, pdfContent: Buffer): Promise<TestResult> {
    // 模板匹配測試
    return {
      matched: false,
      value: null,
      confidence: 0,
      positions: [],
      errors: ['Template matching not yet implemented']
    }
  }
}
```

---

### Phase 4: React Query Hooks (AC1, AC3)

#### 4.4.1 創建規則 Hook

**File**: `src/hooks/useCreateRule.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateRuleRequest, CreateRuleResponse } from '@/types/rule'

async function createRule(data: CreateRuleRequest): Promise<CreateRuleResponse> {
  const response = await fetch('/api/rules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to create rule')
  }

  return result
}

export function useCreateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      // 使規則列表緩存失效
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['ruleSuggestions'] })
    }
  })
}
```

#### 4.4.2 測試規則 Hook

**File**: `src/hooks/useTestRule.ts`

```typescript
import { useMutation } from '@tanstack/react-query'
import { TestRuleRequest, TestRuleResponse } from '@/types/rule'

async function testRule(data: TestRuleRequest): Promise<TestRuleResponse> {
  const response = await fetch('/api/rules/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error?.detail || 'Failed to test rule')
  }

  return result
}

export function useTestRule() {
  return useMutation({
    mutationFn: testRule
  })
}
```

---

### Phase 5: UI Components (AC1, AC2)

#### 4.5.1 新規則頁面

**File**: `src/app/(dashboard)/rules/new/page.tsx`

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'
import { NewRuleForm } from '@/components/features/rules/NewRuleForm'

export const metadata = {
  title: '建議新規則 - Document Extraction',
  description: '創建新的映射規則建議'
}

export default async function NewRulePage() {
  const session = await auth()

  // 權限檢查
  const hasPermission = session?.user?.roles?.some(r =>
    r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )

  if (!hasPermission) {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">建議新規則</h1>
        <p className="text-muted-foreground">
          創建新的映射規則，提交後需等待審核批准
        </p>
      </div>

      <NewRuleForm />
    </div>
  )
}
```

#### 4.5.2 新規則表單組件

**File**: `src/components/features/rules/NewRuleForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateRule } from '@/hooks/useCreateRule'
import { ForwarderSelector } from './ForwarderSelector'
import { FieldNameSelector } from './FieldNameSelector'
import { ExtractionTypeSelector } from './ExtractionTypeSelector'
import { PatternEditor } from './PatternEditor'
import { RuleTestPanel } from './RuleTestPanel'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Save, Send, FlaskConical } from 'lucide-react'
import { ExtractionType } from '@prisma/client'

const formSchema = z.object({
  forwarderId: z.string().min(1, '請選擇 Forwarder'),
  fieldName: z.string().min(1, '請選擇或輸入欄位名稱'),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  priority: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  description: z.string().optional()
})

type FormValues = z.infer<typeof formSchema>

export function NewRuleForm() {
  const router = useRouter()
  const { mutate: createRule, isPending } = useCreateRule()

  const [pattern, setPattern] = useState<any>(null)
  const [patternValid, setPatternValid] = useState(false)
  const [activeTab, setActiveTab] = useState('edit')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      forwarderId: '',
      fieldName: '',
      extractionType: 'REGEX',
      priority: 0,
      confidence: 0.8,
      description: ''
    }
  })

  const extractionType = form.watch('extractionType')

  const handleSubmit = (values: FormValues, saveAsDraft: boolean = false) => {
    if (!patternValid && !saveAsDraft) {
      toast.error('請先完成並驗證 Pattern 設定')
      return
    }

    createRule(
      {
        ...values,
        pattern,
        saveAsDraft
      },
      {
        onSuccess: (result) => {
          toast.success(result.data.message)
          router.push('/rules')
        },
        onError: (error) => {
          toast.error(error.message)
        }
      }
    )
  }

  return (
    <Form {...form}>
      <form className="space-y-6">
        {/* 基本資訊 */}
        <Card>
          <CardHeader>
            <CardTitle>基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="forwarderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forwarder *</FormLabel>
                    <FormControl>
                      <ForwarderSelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fieldName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目標欄位 *</FormLabel>
                    <FormControl>
                      <FieldNameSelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="extractionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>提取類型 *</FormLabel>
                  <FormControl>
                    <ExtractionTypeSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    選擇用於提取此欄位的方法
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優先級: {field.value}</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={(v) => field.onChange(v[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      數值越高優先級越高（0-100）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>信心度閾值: {(field.value * 100).toFixed(0)}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[field.value]}
                        onValueChange={(v) => field.onChange(v[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      低於此閾值的結果需要人工審核
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>說明描述</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="描述此規則的用途和適用場景..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Pattern 編輯和測試 */}
        <Card>
          <CardHeader>
            <CardTitle>提取模式設定</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="edit">編輯模式</TabsTrigger>
                <TabsTrigger value="test">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  測試
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit">
                <PatternEditor
                  type={extractionType as ExtractionType}
                  value={pattern}
                  onChange={setPattern}
                  onValidChange={setPatternValid}
                />
              </TabsContent>

              <TabsContent value="test">
                <RuleTestPanel
                  extractionType={extractionType as ExtractionType}
                  pattern={pattern}
                  disabled={!patternValid}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/rules')}
            disabled={isPending}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => form.handleSubmit((v) => handleSubmit(v, true))()}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            儲存草稿
          </Button>
          <Button
            type="button"
            onClick={() => form.handleSubmit((v) => handleSubmit(v, false))()}
            disabled={isPending || !patternValid}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            提交審核
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

#### 4.5.3 Pattern 編輯器

**File**: `src/components/features/rules/PatternEditor/index.tsx`

```typescript
'use client'

import { ExtractionType } from '@prisma/client'
import { RegexEditor } from './RegexEditor'
import { PositionEditor } from './PositionEditor'
import { KeywordEditor } from './KeywordEditor'
import { PromptEditor } from './PromptEditor'
import { TemplateEditor } from './TemplateEditor'

interface PatternEditorProps {
  type: ExtractionType
  value: any
  onChange: (value: any) => void
  onValidChange: (valid: boolean) => void
}

export function PatternEditor({
  type,
  value,
  onChange,
  onValidChange
}: PatternEditorProps) {
  switch (type) {
    case 'REGEX':
      return (
        <RegexEditor
          value={value}
          onChange={onChange}
          onValidChange={onValidChange}
        />
      )
    case 'POSITION':
      return (
        <PositionEditor
          value={value}
          onChange={onChange}
          onValidChange={onValidChange}
        />
      )
    case 'KEYWORD':
      return (
        <KeywordEditor
          value={value}
          onChange={onChange}
          onValidChange={onValidChange}
        />
      )
    case 'AI_PROMPT':
      return (
        <PromptEditor
          value={value}
          onChange={onChange}
          onValidChange={onValidChange}
        />
      )
    case 'TEMPLATE':
      return (
        <TemplateEditor
          value={value}
          onChange={onChange}
          onValidChange={onValidChange}
        />
      )
    default:
      return <div>不支援的提取類型</div>
  }
}
```

#### 4.5.4 正則表達式編輯器

**File**: `src/components/features/rules/PatternEditor/RegexEditor.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

interface RegexEditorProps {
  value: any
  onChange: (value: any) => void
  onValidChange: (valid: boolean) => void
}

export function RegexEditor({ value, onChange, onValidChange }: RegexEditorProps) {
  const [expression, setExpression] = useState(value?.expression || '')
  const [flags, setFlags] = useState<string[]>(value?.flags?.split('') || [])
  const [error, setError] = useState<string | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<string[] | null>(null)

  // 驗證正則表達式
  useEffect(() => {
    if (!expression) {
      setError(null)
      onValidChange(false)
      return
    }

    try {
      new RegExp(expression, flags.join(''))
      setError(null)
      onValidChange(true)
      onChange({
        expression,
        flags: flags.join('')
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '無效的正則表達式')
      onValidChange(false)
    }
  }, [expression, flags])

  // 測試正則
  useEffect(() => {
    if (!testInput || !expression || error) {
      setTestResult(null)
      return
    }

    try {
      const regex = new RegExp(expression, flags.join(''))
      const matches = testInput.match(regex)
      setTestResult(matches ? Array.from(matches) : [])
    } catch {
      setTestResult(null)
    }
  }, [testInput, expression, flags, error])

  const toggleFlag = (flag: string) => {
    setFlags(prev =>
      prev.includes(flag)
        ? prev.filter(f => f !== flag)
        : [...prev, flag]
    )
  }

  return (
    <div className="space-y-4">
      {/* 正則表達式輸入 */}
      <div className="space-y-2">
        <Label>正則表達式 *</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">/</span>
          <Input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="輸入正則表達式..."
            className="font-mono"
          />
          <span className="text-muted-foreground">/</span>
          <span className="font-mono text-sm">{flags.join('')}</span>
        </div>
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            {error}
          </p>
        )}
        {!error && expression && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            正則表達式有效
          </p>
        )}
      </div>

      {/* 標誌選項 */}
      <div className="space-y-2">
        <Label>標誌選項</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={flags.includes('i')}
              onCheckedChange={() => toggleFlag('i')}
            />
            <span className="text-sm">忽略大小寫 (i)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={flags.includes('g')}
              onCheckedChange={() => toggleFlag('g')}
            />
            <span className="text-sm">全局匹配 (g)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={flags.includes('m')}
              onCheckedChange={() => toggleFlag('m')}
            />
            <span className="text-sm">多行模式 (m)</span>
          </label>
        </div>
      </div>

      {/* 測試區域 */}
      <div className="space-y-2">
        <Label>測試文字</Label>
        <Input
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="輸入測試文字..."
        />
        {testResult !== null && (
          <div className="p-3 bg-muted rounded-lg">
            {testResult.length > 0 ? (
              <div>
                <p className="text-sm text-green-600 mb-2">
                  找到 {testResult.length} 個匹配
                </p>
                <div className="flex flex-wrap gap-2">
                  {testResult.map((match, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-mono"
                    >
                      {match}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">沒有匹配</p>
            )}
          </div>
        )}
      </div>

      {/* 常用模式提示 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">常用模式範例：</p>
          <ul className="text-sm space-y-1">
            <li><code className="bg-muted px-1">INV-\d+</code> - 發票號碼（INV-123）</li>
            <li><code className="bg-muted px-1">\d{4}-\d{2}-\d{2}</code> - 日期（2024-01-15）</li>
            <li><code className="bg-muted px-1">\$[\d,]+\.\d{2}</code> - 金額（$1,234.56）</li>
            <li><code className="bg-muted px-1">[A-Z]{4}\d{7}</code> - 貨櫃號（MSCU1234567）</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Integration Tests

**File**: `tests/integration/api/rules-create.test.ts`

```typescript
import { POST } from '@/app/api/rules/route'
import { POST as TEST_RULE } from '@/app/api/rules/test/route'
import { NextRequest } from 'next/server'

describe('Create Rule API', () => {
  describe('POST /api/rules', () => {
    it('should create rule suggestion', async () => {
      const request = new NextRequest('http://localhost/api/rules', {
        method: 'POST',
        body: JSON.stringify({
          forwarderId: 'test-forwarder-id',
          fieldName: 'invoice_number',
          extractionType: 'REGEX',
          pattern: JSON.stringify({
            expression: 'INV-\\d+',
            flags: 'i'
          }),
          priority: 10,
          description: 'Test rule'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.suggestionId).toBeDefined()
      expect(data.data.status).toBe('PENDING_REVIEW')
    })

    it('should save as draft when requested', async () => {
      const request = new NextRequest('http://localhost/api/rules', {
        method: 'POST',
        body: JSON.stringify({
          forwarderId: 'test-forwarder-id',
          fieldName: 'invoice_number',
          extractionType: 'REGEX',
          pattern: '{}',
          saveAsDraft: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.status).toBe('DRAFT')
    })

    it('should return 400 for invalid pattern', async () => {
      const request = new NextRequest('http://localhost/api/rules', {
        method: 'POST',
        body: JSON.stringify({
          forwarderId: 'test-forwarder-id',
          fieldName: 'invoice_number',
          extractionType: 'REGEX',
          pattern: '[invalid regex'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/rules/test', () => {
    it('should test regex pattern', async () => {
      const request = new NextRequest('http://localhost/api/rules/test', {
        method: 'POST',
        body: JSON.stringify({
          extractionType: 'REGEX',
          pattern: JSON.stringify({
            expression: 'INV-\\d+',
            flags: 'i'
          }),
          documentId: 'test-doc-id'
        })
      })

      const response = await TEST_RULE(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.matched).toBeDefined()
    })
  })
})
```

### 5.2 E2E Tests

**File**: `tests/e2e/create-rule.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Create New Rule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'superuser@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display new rule form', async ({ page }) => {
    await page.goto('/rules/new')

    await expect(page.getByRole('heading', { name: '建議新規則' })).toBeVisible()
    await expect(page.getByLabel('Forwarder')).toBeVisible()
    await expect(page.getByLabel('目標欄位')).toBeVisible()
    await expect(page.getByLabel('提取類型')).toBeVisible()
  })

  test('should validate regex pattern', async ({ page }) => {
    await page.goto('/rules/new')

    // 選擇 REGEX 類型
    await page.getByLabel('提取類型').click()
    await page.getByText('正則表達式').click()

    // 輸入有效正則
    await page.fill('input[placeholder="輸入正則表達式..."]', 'INV-\\d+')
    await expect(page.getByText('正則表達式有效')).toBeVisible()

    // 輸入無效正則
    await page.fill('input[placeholder="輸入正則表達式..."]', '[invalid')
    await expect(page.getByText('無效的正則表達式')).toBeVisible()
  })

  test('should test rule against document', async ({ page }) => {
    await page.goto('/rules/new')

    // 填寫基本資訊
    await page.getByLabel('Forwarder').click()
    await page.getByText('DHL').click()
    await page.getByLabel('目標欄位').fill('invoice_number')

    // 設定正則模式
    await page.fill('input[placeholder="輸入正則表達式..."]', 'INV-\\d+')

    // 切換到測試標籤
    await page.getByRole('tab', { name: '測試' }).click()

    // 選擇測試文件
    await page.getByLabel('選擇文件').click()
    await page.getByText('test-invoice.pdf').click()

    // 執行測試
    await page.getByRole('button', { name: '執行測試' }).click()

    // 檢查結果
    await expect(page.getByTestId('test-result')).toBeVisible()
  })

  test('should submit rule for review', async ({ page }) => {
    await page.goto('/rules/new')

    // 填寫完整表單
    await page.getByLabel('Forwarder').click()
    await page.getByText('DHL').click()
    await page.getByLabel('目標欄位').fill('invoice_number')
    await page.fill('input[placeholder="輸入正則表達式..."]', 'INV-\\d+')
    await page.fill('textarea[placeholder*="描述"]', 'Test rule description')

    // 提交審核
    await page.getByRole('button', { name: '提交審核' }).click()

    // 檢查成功
    await expect(page.getByText('規則已提交審核')).toBeVisible()
    await expect(page).toHaveURL('/rules')
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 建議新規則入口
  - [ ] 規則列表頁面有「建議新規則」按鈕
  - [ ] 點擊進入創建表單頁面

- [ ] **AC2**: 規則表單內容
  - [ ] 目標欄位選擇（下拉 + 自定義）
  - [ ] Forwarder 選擇（支援搜索）
  - [ ] 提取模式類型選擇
  - [ ] 根據類型動態顯示 Pattern 編輯器
  - [ ] 優先級設定

- [ ] **AC3**: 提交審核流程
  - [ ] 規則狀態設為 PENDING_REVIEW
  - [ ] 審核人員收到通知
  - [ ] 支援儲存草稿

### 6.2 Technical Verification

- [ ] API 響應符合 RFC 7807 格式
- [ ] 權限檢查正確（RULE_MANAGE）
- [ ] 正則表達式驗證正確
- [ ] Pattern 編輯器正常工作

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/types/rule.ts` | Modify | 添加創建和測試相關類型 |
| `src/app/api/rules/route.ts` | Modify | 添加 POST 創建規則 |
| `src/app/api/rules/test/route.ts` | Create | 規則測試 API |
| `src/services/rule-test.ts` | Create | 規則測試服務 |
| `src/hooks/useCreateRule.ts` | Create | 創建規則 Hook |
| `src/hooks/useTestRule.ts` | Create | 測試規則 Hook |
| `src/app/(dashboard)/rules/new/page.tsx` | Create | 新規則頁面 |
| `src/components/features/rules/NewRuleForm.tsx` | Create | 新規則表單 |
| `src/components/features/rules/ForwarderSelector.tsx` | Create | Forwarder 選擇器 |
| `src/components/features/rules/FieldNameSelector.tsx` | Create | 欄位選擇器 |
| `src/components/features/rules/ExtractionTypeSelector.tsx` | Create | 類型選擇器 |
| `src/components/features/rules/PatternEditor/index.tsx` | Create | Pattern 編輯器入口 |
| `src/components/features/rules/PatternEditor/RegexEditor.tsx` | Create | 正則編輯器 |
| `src/components/features/rules/PatternEditor/PositionEditor.tsx` | Create | 位置編輯器 |
| `src/components/features/rules/PatternEditor/KeywordEditor.tsx` | Create | 關鍵字編輯器 |
| `src/components/features/rules/PatternEditor/PromptEditor.tsx` | Create | 提示詞編輯器 |
| `src/components/features/rules/RuleTestPanel.tsx` | Create | 測試面板 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 4-2-suggest-new-mapping-rule*
