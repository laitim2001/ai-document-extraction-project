# Story 9-4: Outlook 連線配置

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.4 |
| 標題 | Outlook 連線配置 |
| FR 覆蓋 | FR3 |
| 狀態 | done |
| 優先級 | High |
| 估計點數 | 5 |
| 完成日期 | 2025-12-20 |

---

## 用戶故事

**As a** 系統管理員,
**I want** 配置 Outlook 連線設定,
**So that** 系統可以正確存取郵箱資源。

---

## 驗收標準

### AC1: 連線配置表單

**Given** 系統管理員在系統設定頁面
**When** 導航至「Outlook 整合」區塊
**Then** 顯示連線配置表單：
- 郵箱地址
- Azure AD 租戶 ID
- 應用程式 ID
- 客戶端密鑰（加密儲存）

### AC2: 連線測試

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統驗證連線設定
**And** 顯示連線結果（成功/失敗）

### AC3: 城市級別配置

**Given** 連線配置
**When** 按城市配置不同郵箱
**Then** 支援城市級別的 Outlook 配置
**And** 不同城市可以監控不同的郵箱

### AC4: 郵件過濾規則

**Given** 郵件過濾規則
**When** 配置過濾條件
**Then** 可以設定：
- 寄件者白名單/黑名單
- 主旨關鍵字
- 附件類型過濾

---

## 技術實作規格

### 1. 資料模型

#### Prisma Schema（已在 Story 9-3 定義，此處擴展）

```prisma
// Outlook 配置（完整欄位）
model OutlookConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String
  description       String?

  // 郵箱設定
  mailboxAddress    String    // 監控的郵箱地址
  mailFolders       String[]  @default(["inbox"]) // 監控的資料夾

  // Azure AD 設定
  tenantId          String
  clientId          String
  clientSecret      String    // 加密儲存

  // 城市關聯
  cityId            String?   @unique
  city              City?     @relation(fields: [cityId], references: [id])

  // 全域配置標記
  isGlobal          Boolean   @default(false)

  // 附件過濾
  allowedExtensions String[]  @default(["pdf", "jpg", "jpeg", "png", "tiff"])
  maxAttachmentSizeMb Int     @default(30)

  // 過濾規則
  filterRules       OutlookFilterRule[]

  // 狀態
  isActive          Boolean   @default(true)
  lastTestedAt      DateTime?
  lastTestResult    Boolean?
  lastTestError     String?

  // 統計
  totalProcessed    Int       @default(0)
  lastProcessedAt   DateTime?

  // 時間戳
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       String
  createdBy         User      @relation("OutlookConfigCreator", fields: [createdById], references: [id])
  updatedById       String?
  updatedBy         User?     @relation("OutlookConfigUpdater", fields: [updatedById], references: [id])

  // 關聯
  fetchLogs         OutlookFetchLog[]

  @@index([cityId])
  @@index([isActive])
  @@index([isGlobal])
}

// Outlook 過濾規則（擴展）
model OutlookFilterRule {
  id              String              @id @default(cuid())
  configId        String
  config          OutlookConfig       @relation(fields: [configId], references: [id], onDelete: Cascade)

  // 規則名稱
  name            String
  description     String?

  // 規則類型
  ruleType        OutlookRuleType
  ruleValue       String              // 規則值
  ruleOperator    RuleOperator        @default(EQUALS) // 比對方式

  // 白名單/黑名單
  isWhitelist     Boolean             @default(true)

  // 狀態
  isActive        Boolean             @default(true)
  priority        Int                 @default(0)     // 優先級（數字越小越優先）

  // 時間戳
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([configId])
  @@index([isActive])
}

// 規則比對方式
enum RuleOperator {
  EQUALS          // 完全匹配
  CONTAINS        // 包含
  STARTS_WITH     // 開頭
  ENDS_WITH       // 結尾
  REGEX           // 正則表達式
  NOT_EQUALS      // 不等於
  NOT_CONTAINS    // 不包含
}

// 過濾規則類型（擴展）
enum OutlookRuleType {
  SENDER_EMAIL      // 寄件者 Email
  SENDER_DOMAIN     // 寄件者網域
  SENDER_NAME       // 寄件者名稱
  SUBJECT_KEYWORD   // 主旨關鍵字
  SUBJECT_REGEX     // 主旨正則表達式
  ATTACHMENT_TYPE   // 附件類型
  ATTACHMENT_NAME   // 附件名稱模式
  HAS_ATTACHMENT    // 是否有附件
  MAIL_FOLDER       // 郵件資料夾
}
```

### 2. Outlook 配置服務

```typescript
// lib/services/outlook-config.service.ts
import { OutlookMailService } from './outlook-mail.service'
import { encrypt, decrypt } from '@/lib/utils/encryption'

// 配置輸入
export interface OutlookConfigInput {
  name: string
  description?: string
  mailboxAddress: string
  mailFolders?: string[]
  tenantId: string
  clientId: string
  clientSecret: string
  cityId?: string | null
  isGlobal?: boolean
  allowedExtensions?: string[]
  maxAttachmentSizeMb?: number
}

// 過濾規則輸入
export interface FilterRuleInput {
  name: string
  description?: string
  ruleType: OutlookRuleType
  ruleValue: string
  ruleOperator?: RuleOperator
  isWhitelist: boolean
  priority?: number
}

// 連線測試結果
export interface OutlookConnectionTestResult {
  success: boolean
  error?: string
  details?: {
    mailboxInfo?: {
      displayName: string
      email: string
    }
    permissions?: string[]
    recentMailCount?: number
  }
}

export class OutlookConfigService {
  constructor(private prisma: PrismaClient) {}

  // 建立配置
  async createConfig(
    input: OutlookConfigInput,
    userId: string
  ): Promise<OutlookConfig> {
    // 驗證唯一性
    if (input.cityId) {
      const existing = await this.prisma.outlookConfig.findFirst({
        where: { cityId: input.cityId, isActive: true }
      })
      if (existing) {
        throw new Error('此城市已有 Outlook 配置')
      }
    }

    if (input.isGlobal) {
      const existing = await this.prisma.outlookConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      })
      if (existing) {
        throw new Error('已存在全域 Outlook 配置')
      }
    }

    // 加密密鑰
    const encryptedSecret = await encrypt(input.clientSecret)

    return this.prisma.outlookConfig.create({
      data: {
        name: input.name,
        description: input.description,
        mailboxAddress: input.mailboxAddress,
        mailFolders: input.mailFolders || ['inbox'],
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: encryptedSecret,
        cityId: input.cityId,
        isGlobal: input.isGlobal || false,
        allowedExtensions: input.allowedExtensions || ['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
        maxAttachmentSizeMb: input.maxAttachmentSizeMb || 30,
        createdById: userId
      },
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: true
      }
    })
  }

  // 更新配置
  async updateConfig(
    configId: string,
    input: Partial<OutlookConfigInput>,
    userId: string
  ): Promise<OutlookConfig> {
    const updateData: any = {
      ...input,
      updatedById: userId
    }

    // 加密新密鑰
    if (input.clientSecret) {
      updateData.clientSecret = await encrypt(input.clientSecret)
    }

    // 移除不應更新的欄位
    delete updateData.cityId
    delete updateData.isGlobal

    return this.prisma.outlookConfig.update({
      where: { id: configId },
      data: updateData,
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: true
      }
    })
  }

  // 測試連線
  async testConnection(configId: string): Promise<OutlookConnectionTestResult> {
    const config = await this.prisma.outlookConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    try {
      const decryptedSecret = await decrypt(config.clientSecret)

      const mailService = new OutlookMailService(
        {
          tenantId: config.tenantId,
          clientId: config.clientId,
          clientSecret: decryptedSecret
        },
        config.mailboxAddress
      )

      // 測試連線
      const testResult = await mailService.testMailboxAccess()

      if (!testResult.success) {
        await this.updateTestResult(configId, false, testResult.error)
        return { success: false, error: testResult.error }
      }

      // 獲取郵箱資訊
      const mailboxInfo = await mailService.getMailboxInfo()

      // 獲取最近郵件數量
      const recentCount = await mailService.getRecentMailCount()

      await this.updateTestResult(configId, true)

      return {
        success: true,
        details: {
          mailboxInfo: {
            displayName: mailboxInfo.displayName,
            email: mailboxInfo.mail
          },
          permissions: ['Mail.Read', 'Mail.ReadBasic'],
          recentMailCount: recentCount
        }
      }

    } catch (error) {
      const errorMessage = this.parseGraphError(error)
      await this.updateTestResult(configId, false, errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // 使用輸入直接測試
  async testConnectionWithInput(input: OutlookConfigInput): Promise<OutlookConnectionTestResult> {
    try {
      const mailService = new OutlookMailService(
        {
          tenantId: input.tenantId,
          clientId: input.clientId,
          clientSecret: input.clientSecret
        },
        input.mailboxAddress
      )

      const testResult = await mailService.testMailboxAccess()

      if (!testResult.success) {
        return { success: false, error: testResult.error }
      }

      const mailboxInfo = await mailService.getMailboxInfo()

      return {
        success: true,
        details: {
          mailboxInfo: {
            displayName: mailboxInfo.displayName,
            email: mailboxInfo.mail
          }
        }
      }

    } catch (error) {
      return { success: false, error: this.parseGraphError(error) }
    }
  }

  // 新增過濾規則
  async addFilterRule(
    configId: string,
    input: FilterRuleInput
  ): Promise<OutlookFilterRule> {
    // 驗證配置存在
    await this.prisma.outlookConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    return this.prisma.outlookFilterRule.create({
      data: {
        configId,
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        ruleValue: input.ruleValue,
        ruleOperator: input.ruleOperator || 'EQUALS',
        isWhitelist: input.isWhitelist,
        priority: input.priority || 0
      }
    })
  }

  // 更新過濾規則
  async updateFilterRule(
    ruleId: string,
    input: Partial<FilterRuleInput>
  ): Promise<OutlookFilterRule> {
    return this.prisma.outlookFilterRule.update({
      where: { id: ruleId },
      data: input
    })
  }

  // 刪除過濾規則
  async deleteFilterRule(ruleId: string): Promise<void> {
    await this.prisma.outlookFilterRule.delete({
      where: { id: ruleId }
    })
  }

  // 獲取配置的過濾規則
  async getFilterRules(configId: string): Promise<OutlookFilterRule[]> {
    return this.prisma.outlookFilterRule.findMany({
      where: { configId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
    })
  }

  // 重新排序規則
  async reorderFilterRules(
    configId: string,
    ruleIds: string[]
  ): Promise<void> {
    await this.prisma.$transaction(
      ruleIds.map((id, index) =>
        this.prisma.outlookFilterRule.update({
          where: { id },
          data: { priority: index }
        })
      )
    )
  }

  // 獲取配置列表
  async getConfigs(options?: {
    cityId?: string
    includeInactive?: boolean
  }): Promise<OutlookConfig[]> {
    const where: any = {}

    if (options?.cityId) {
      where.cityId = options.cityId
    }

    if (!options?.includeInactive) {
      where.isActive = true
    }

    return this.prisma.outlookConfig.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: { where: { isActive: true }, orderBy: { priority: 'asc' } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: [{ isGlobal: 'desc' }, { city: { name: 'asc' } }]
    })
  }

  // 獲取單一配置
  async getConfig(configId: string): Promise<OutlookConfig | null> {
    return this.prisma.outlookConfig.findUnique({
      where: { id: configId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: { orderBy: { priority: 'asc' } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } }
      }
    })
  }

  // 停用/啟用配置
  async toggleActive(configId: string, isActive: boolean): Promise<OutlookConfig> {
    return this.prisma.outlookConfig.update({
      where: { id: configId },
      data: { isActive }
    })
  }

  // 刪除配置
  async deleteConfig(configId: string): Promise<void> {
    await this.prisma.outlookConfig.update({
      where: { id: configId },
      data: { isActive: false }
    })
  }

  // 更新測試結果
  private async updateTestResult(
    configId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.prisma.outlookConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: success,
        lastTestError: error || null
      }
    })
  }

  // 解析錯誤
  private parseGraphError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('invalid_client')) {
        return '無效的應用程式 ID 或客戶端密鑰'
      }
      if (message.includes('tenant') && message.includes('not found')) {
        return '找不到指定的租戶 ID'
      }
      if (message.includes('mailbox') && message.includes('not found')) {
        return '找不到指定的郵箱'
      }
      if (message.includes('access_denied')) {
        return '存取被拒絕，請檢查應用程式權限'
      }

      return error.message
    }

    return '未知錯誤'
  }
}
```

### 3. 擴展 OutlookMailService

```typescript
// lib/services/outlook-mail.service.ts（擴展）
export class OutlookMailService extends MicrosoftGraphService {
  // ... 現有方法 ...

  // 獲取郵箱資訊
  async getMailboxInfo(): Promise<{ displayName: string; mail: string }> {
    const user = await this.client
      .api(`/users/${this.mailboxAddress}`)
      .select('displayName,mail')
      .get()

    return {
      displayName: user.displayName,
      mail: user.mail
    }
  }

  // 獲取最近郵件數量
  async getRecentMailCount(hours: number = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const result = await this.client
      .api(`/users/${this.mailboxAddress}/messages`)
      .filter(`receivedDateTime ge ${since}`)
      .count()
      .top(1)
      .get()

    return result['@odata.count'] || 0
  }

  // 獲取郵件資料夾列表
  async getMailFolders(): Promise<Array<{ id: string; displayName: string; totalItemCount: number }>> {
    const result = await this.client
      .api(`/users/${this.mailboxAddress}/mailFolders`)
      .select('id,displayName,totalItemCount')
      .get()

    return result.value
  }
}
```

### 4. API 路由

```typescript
// app/api/admin/integrations/outlook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import { z } from 'zod'

const configSchema = z.object({
  name: z.string().min(1, '名稱為必填'),
  description: z.string().optional(),
  mailboxAddress: z.string().email('請輸入有效的郵箱地址'),
  mailFolders: z.array(z.string()).optional(),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  allowedExtensions: z.array(z.string()).optional(),
  maxAttachmentSizeMb: z.number().min(1).max(50).optional()
})

// GET - 獲取配置列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = new OutlookConfigService(prisma)
    const configs = await service.getConfigs()

    const sanitizedConfigs = configs.map(config => ({
      ...config,
      clientSecret: '********'
    }))

    return NextResponse.json(sanitizedConfigs)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch configs' },
      { status: 500 }
    )
  }
}

// POST - 建立新配置
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = configSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const config = await service.createConfig(validated, session.user.id)

    return NextResponse.json({
      ...config,
      clientSecret: '********'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create config' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/integrations/outlook/[configId]/rules/route.ts
import { NextRequest, NextResponse } from 'next/server'

const ruleSchema = z.object({
  name: z.string().min(1, '規則名稱為必填'),
  description: z.string().optional(),
  ruleType: z.enum([
    'SENDER_EMAIL', 'SENDER_DOMAIN', 'SENDER_NAME',
    'SUBJECT_KEYWORD', 'SUBJECT_REGEX',
    'ATTACHMENT_TYPE', 'ATTACHMENT_NAME', 'HAS_ATTACHMENT', 'MAIL_FOLDER'
  ]),
  ruleValue: z.string().min(1, '規則值為必填'),
  ruleOperator: z.enum([
    'EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
    'REGEX', 'NOT_EQUALS', 'NOT_CONTAINS'
  ]).optional(),
  isWhitelist: z.boolean(),
  priority: z.number().optional()
})

// GET - 獲取規則列表
export async function GET(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = new OutlookConfigService(prisma)
    const rules = await service.getFilterRules(params.configId)

    return NextResponse.json(rules)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
  }
}

// POST - 新增規則
export async function POST(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = ruleSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const rule = await service.addFilterRule(params.configId, validated)

    return NextResponse.json(rule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
}

// PUT - 重新排序規則
export async function PUT(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { ruleIds } = await request.json()

    const service = new OutlookConfigService(prisma)
    await service.reorderFilterRules(params.configId, ruleIds)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reorder rules' },
      { status: 500 }
    )
  }
}
```

### 5. React 元件

```typescript
// components/admin/OutlookConfigForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  TestTube,
  Save,
  Mail
} from 'lucide-react'
import { toast } from 'sonner'

const configSchema = z.object({
  name: z.string().min(1, '名稱為必填'),
  description: z.string().optional(),
  mailboxAddress: z.string().email('請輸入有效的郵箱地址'),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  allowedExtensions: z.string().optional(),
  maxAttachmentSizeMb: z.number().min(1).max(50).optional()
})

type ConfigFormData = z.infer<typeof configSchema>

interface Props {
  configId?: string
  onSuccess?: () => void
}

export function OutlookConfigForm({ configId, onSuccess }: Props) {
  const [showSecret, setShowSecret] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities')
      return response.json()
    }
  })

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['outlook-config', configId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/integrations/outlook/${configId}`)
      return response.json()
    },
    enabled: !!configId
  })

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      name: '',
      description: '',
      mailboxAddress: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      cityId: null,
      isGlobal: false,
      allowedExtensions: 'pdf,jpg,jpeg,png,tiff',
      maxAttachmentSizeMb: 30
    }
  })

  useEffect(() => {
    if (existingConfig) {
      form.reset({
        ...existingConfig,
        allowedExtensions: existingConfig.allowedExtensions?.join(',') || ''
      })
    }
  }, [existingConfig])

  const testMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      const endpoint = configId
        ? `/api/admin/integrations/outlook/${configId}/test`
        : '/api/admin/integrations/outlook/test'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      return response.json()
    },
    onSuccess: (result) => {
      setTestResult(result)
      if (result.success) {
        toast.success('連線測試成功')
      } else {
        toast.error(`連線測試失敗: ${result.error}`)
      }
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      const method = configId ? 'PUT' : 'POST'
      const endpoint = configId
        ? `/api/admin/integrations/outlook/${configId}`
        : '/api/admin/integrations/outlook'

      const payload = {
        ...data,
        allowedExtensions: data.allowedExtensions?.split(',').map(s => s.trim()) || []
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('配置已儲存')
      queryClient.invalidateQueries({ queryKey: ['outlook-configs'] })
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '儲存失敗')
    }
  })

  const handleTest = () => {
    const values = form.getValues()
    testMutation.mutate(values)
  }

  const onSubmit = (data: ConfigFormData) => {
    saveMutation.mutate(data)
  }

  if (configId && isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {configId ? '編輯 Outlook 配置' : '新增 Outlook 配置'}
        </CardTitle>
        <CardDescription>
          配置 Outlook 郵箱連線，讓系統可以自動獲取郵件附件
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">配置名稱 *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="例如：台北辦公室發票郵箱"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cityId">關聯城市</Label>
              <Select
                value={form.watch('cityId') || ''}
                onValueChange={(value) => form.setValue('cityId', value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇城市（留空為全域）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全域配置</SelectItem>
                  {cities?.map((city: any) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name} ({city.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 郵箱設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">郵箱設定</h3>

            <div className="space-y-2">
              <Label htmlFor="mailboxAddress">郵箱地址 *</Label>
              <Input
                id="mailboxAddress"
                type="email"
                {...form.register('mailboxAddress')}
                placeholder="invoice@yourcompany.com"
              />
            </div>
          </div>

          {/* Azure AD 設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">Azure AD 設定</h3>

            <div className="space-y-2">
              <Label htmlFor="tenantId">租戶 ID (Tenant ID) *</Label>
              <Input
                id="tenantId"
                {...form.register('tenantId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">應用程式 ID (Client ID) *</Label>
              <Input
                id="clientId"
                {...form.register('clientId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">客戶端密鑰 (Client Secret) *</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? 'text' : 'password'}
                  {...form.register('clientSecret')}
                  placeholder="輸入客戶端密鑰"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* 附件過濾設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">附件過濾設定</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="allowedExtensions">允許的副檔名</Label>
                <Input
                  id="allowedExtensions"
                  {...form.register('allowedExtensions')}
                  placeholder="pdf,jpg,jpeg,png,tiff"
                />
                <p className="text-xs text-muted-foreground">
                  以逗號分隔多個副檔名
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAttachmentSizeMb">最大附件大小 (MB)</Label>
                <Input
                  id="maxAttachmentSizeMb"
                  type="number"
                  {...form.register('maxAttachmentSizeMb', { valueAsNumber: true })}
                  min={1}
                  max={50}
                />
              </div>
            </div>
          </div>

          {/* 測試結果 */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <AlertDescription>
                  {testResult.success ? (
                    <div className="space-y-2">
                      <p className="font-medium text-green-800">連線測試成功！</p>
                      {testResult.details && (
                        <div className="text-sm">
                          <p>郵箱：{testResult.details.mailboxInfo?.email}</p>
                          <p>顯示名稱：{testResult.details.mailboxInfo?.displayName}</p>
                          {testResult.details.recentMailCount !== undefined && (
                            <p>最近 24 小時郵件：{testResult.details.recentMailCount} 封</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>{testResult.error}</p>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              測試連線
            </Button>

            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              儲存配置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
```

```typescript
// components/admin/OutlookFilterRulesEditor.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  GripVertical,
  Plus,
  Trash2,
  Edit,
  Filter,
  ShieldCheck,
  ShieldX
} from 'lucide-react'
import { toast } from 'sonner'

const RULE_TYPES = [
  { value: 'SENDER_EMAIL', label: '寄件者 Email' },
  { value: 'SENDER_DOMAIN', label: '寄件者網域' },
  { value: 'SENDER_NAME', label: '寄件者名稱' },
  { value: 'SUBJECT_KEYWORD', label: '主旨關鍵字' },
  { value: 'SUBJECT_REGEX', label: '主旨正則表達式' },
  { value: 'ATTACHMENT_TYPE', label: '附件類型' },
  { value: 'ATTACHMENT_NAME', label: '附件名稱' }
]

const OPERATORS = [
  { value: 'EQUALS', label: '等於' },
  { value: 'CONTAINS', label: '包含' },
  { value: 'STARTS_WITH', label: '開頭是' },
  { value: 'ENDS_WITH', label: '結尾是' },
  { value: 'REGEX', label: '正則匹配' },
  { value: 'NOT_EQUALS', label: '不等於' },
  { value: 'NOT_CONTAINS', label: '不包含' }
]

interface Props {
  configId: string
}

function SortableRuleItem({ rule, onEdit, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-background border rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{rule.name}</span>
          <Badge variant={rule.isWhitelist ? 'default' : 'destructive'}>
            {rule.isWhitelist ? (
              <><ShieldCheck className="h-3 w-3 mr-1" />白名單</>
            ) : (
              <><ShieldX className="h-3 w-3 mr-1" />黑名單</>
            )}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {RULE_TYPES.find(t => t.value === rule.ruleType)?.label}:
          {' '}{rule.ruleValue}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Switch checked={rule.isActive} />
        <Button variant="ghost" size="icon" onClick={() => onEdit(rule)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

export function OutlookFilterRulesEditor({ configId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    ruleType: 'SENDER_EMAIL',
    ruleValue: '',
    ruleOperator: 'EQUALS',
    isWhitelist: true
  })

  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const { data: rules, isLoading } = useQuery({
    queryKey: ['outlook-filter-rules', configId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/integrations/outlook/${configId}/rules`)
      return response.json()
    }
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/admin/integrations/outlook/${configId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return response.json()
    },
    onSuccess: () => {
      toast.success('規則已新增')
      queryClient.invalidateQueries({ queryKey: ['outlook-filter-rules', configId] })
      setDialogOpen(false)
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await fetch(`/api/admin/integrations/outlook/${configId}/rules/${ruleId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      toast.success('規則已刪除')
      queryClient.invalidateQueries({ queryKey: ['outlook-filter-rules', configId] })
    }
  })

  const reorderMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      await fetch(`/api/admin/integrations/outlook/${configId}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds })
      })
    }
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = rules.findIndex((r: any) => r.id === active.id)
      const newIndex = rules.findIndex((r: any) => r.id === over.id)
      const newOrder = arrayMove(rules, oldIndex, newIndex)

      queryClient.setQueryData(['outlook-filter-rules', configId], newOrder)
      reorderMutation.mutate(newOrder.map((r: any) => r.id))
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      ruleType: 'SENDER_EMAIL',
      ruleValue: '',
      ruleOperator: 'EQUALS',
      isWhitelist: true
    })
    setEditingRule(null)
  }

  const handleSubmit = () => {
    createMutation.mutate(formData)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          過濾規則
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增規則
        </Button>
      </CardHeader>
      <CardContent>
        {rules?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            尚未設定任何過濾規則
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rules?.map((r: any) => r.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {rules?.map((rule: any) => (
                  <SortableRuleItem
                    key={rule.id}
                    rule={rule}
                    onEdit={(r: any) => {
                      setFormData(r)
                      setEditingRule(r)
                      setDialogOpen(true)
                    }}
                    onDelete={(id: string) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      {/* 新增/編輯規則對話框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? '編輯過濾規則' : '新增過濾規則'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>規則名稱</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：只接收供應商郵件"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>規則類型</Label>
                <Select
                  value={formData.ruleType}
                  onValueChange={(v) => setFormData({ ...formData, ruleType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>比對方式</Label>
                <Select
                  value={formData.ruleOperator}
                  onValueChange={(v) => setFormData({ ...formData, ruleOperator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>規則值</Label>
              <Input
                value={formData.ruleValue}
                onChange={(e) => setFormData({ ...formData, ruleValue: e.target.value })}
                placeholder={
                  formData.ruleType === 'SENDER_DOMAIN' ? '@example.com' :
                  formData.ruleType === 'SUBJECT_KEYWORD' ? 'Invoice' :
                  '輸入規則值...'
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>規則類型</Label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant={formData.isWhitelist ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, isWhitelist: true })}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  白名單
                </Button>
                <Button
                  type="button"
                  variant={!formData.isWhitelist ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, isWhitelist: false })}
                >
                  <ShieldX className="h-4 w-4 mr-1" />
                  黑名單
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {editingRule ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/outlook-config.service.test.ts
describe('OutlookConfigService', () => {
  describe('testConnection', () => {
    it('should return success for valid config', async () => {
      mockMailService.testMailboxAccess.mockResolvedValue({ success: true })
      mockMailService.getMailboxInfo.mockResolvedValue({
        displayName: 'Invoice Box',
        mail: 'invoice@company.com'
      })

      const service = new OutlookConfigService(mockPrisma)
      const result = await service.testConnection('config-123')

      expect(result.success).toBe(true)
      expect(result.details?.mailboxInfo).toBeDefined()
    })
  })

  describe('addFilterRule', () => {
    it('should create rule with correct priority', async () => {
      const service = new OutlookConfigService(mockPrisma)

      await service.addFilterRule('config-123', {
        name: 'Vendor whitelist',
        ruleType: 'SENDER_DOMAIN',
        ruleValue: 'vendor.com',
        isWhitelist: true,
        priority: 0
      })

      expect(mockPrisma.outlookFilterRule.create).toHaveBeenCalled()
    })
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 9-3**: Outlook 郵件附件提取 API（OutlookConfig 模型）

### 後續 Stories
- 無直接後續

### 外部相依
- Microsoft Graph API SDK
- @dnd-kit（拖曳排序）

---

## 備註

### Azure AD 應用程式權限設定
1. 在 Azure Portal 註冊應用程式
2. 配置 API 權限：
   - Microsoft Graph > Application permissions
   - Mail.Read（讀取所有用戶郵件）
   - Mail.ReadBasic.All（讀取基本郵件資訊）
3. 管理員同意權限

### 過濾規則使用說明
- **白名單規則**：只處理符合規則的郵件
- **黑名單規則**：排除符合規則的郵件
- 規則按優先級順序執行
- 可拖曳調整規則順序
