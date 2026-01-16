# Story 9-2: SharePoint 連線配置

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.2 |
| 標題 | SharePoint 連線配置 |
| FR 覆蓋 | FR2 |
| 狀態 | done |
| 優先級 | High |
| 估計點數 | 5 |

---

## 用戶故事

**As a** 系統管理員,
**I want** 配置 SharePoint 連線設定,
**So that** 系統可以正確存取 SharePoint 資源。

---

## 驗收標準

### AC1: 連線配置表單

**Given** 系統管理員在系統設定頁面
**When** 導航至「SharePoint 整合」區塊
**Then** 顯示連線配置表單：
- SharePoint Site URL
- 文件庫路徑
- Azure AD 租戶 ID
- 應用程式 ID
- 客戶端密鑰（加密儲存）

### AC2: 連線測試

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統驗證連線設定
**And** 顯示連線結果（成功/失敗）

### AC3: 配置儲存

**Given** 連線測試成功
**When** 點擊「儲存」
**Then** 系統儲存配置
**And** 配置立即生效

### AC4: 城市級別配置

**Given** 配置的 SharePoint 路徑
**When** 按城市配置不同路徑
**Then** 支援城市級別的 SharePoint 配置
**And** 不同城市可以監控不同的文件庫

---

## 技術實作規格

### 1. 資料模型

#### Prisma Schema（已在 Story 9-1 定義）

```prisma
// SharePoint 配置（擴展欄位）
model SharePointConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String
  description       String?

  // 連線設定
  siteUrl           String    // SharePoint Site URL
  tenantId          String    // Azure AD Tenant ID
  clientId          String    // Application ID
  clientSecret      String    // 加密儲存的 Client Secret

  // 文件庫設定
  driveId           String?   // Document Library Drive ID（自動偵測）
  libraryPath       String    // 文件庫路徑
  rootFolderPath    String?   // 監控的根目錄路徑

  // 文件過濾設定
  fileExtensions    String[]  @default(["pdf", "jpg", "jpeg", "png", "tiff"])
  maxFileSizeMb     Int       @default(50)
  excludeFolders    String[]  @default([])  // 排除的資料夾

  // 城市關聯
  cityId            String?   @unique       // 每個城市只能有一個配置
  city              City?     @relation(fields: [cityId], references: [id])

  // 全域配置標記
  isGlobal          Boolean   @default(false) // true 表示全域預設配置

  // 狀態
  isActive          Boolean   @default(true)
  lastTestedAt      DateTime?
  lastTestResult    Boolean?
  lastTestError     String?

  // 時間戳
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       String
  createdBy         User      @relation("SharePointConfigCreator", fields: [createdById], references: [id])
  updatedById       String?
  updatedBy         User?     @relation("SharePointConfigUpdater", fields: [updatedById], references: [id])

  // 關聯
  fetchLogs         SharePointFetchLog[]

  @@index([cityId])
  @@index([isActive])
  @@index([isGlobal])
}
```

### 2. SharePoint 配置服務

```typescript
// lib/services/sharepoint-config.service.ts
import { MicrosoftGraphService } from './microsoft-graph.service'
import { encrypt, decrypt } from '@/lib/utils/encryption'

// 配置輸入類型
export interface SharePointConfigInput {
  name: string
  description?: string
  siteUrl: string
  tenantId: string
  clientId: string
  clientSecret: string
  libraryPath: string
  rootFolderPath?: string
  cityId?: string | null
  isGlobal?: boolean
  fileExtensions?: string[]
  maxFileSizeMb?: number
  excludeFolders?: string[]
}

// 連線測試結果
export interface ConnectionTestResult {
  success: boolean
  error?: string
  details?: {
    siteInfo?: {
      id: string
      name: string
      webUrl: string
    }
    driveInfo?: {
      id: string
      name: string
      driveType: string
    }
    permissions?: string[]
  }
}

export class SharePointConfigService {
  constructor(private prisma: PrismaClient) {}

  // 建立配置
  async createConfig(
    input: SharePointConfigInput,
    userId: string
  ): Promise<SharePointConfig> {
    // 檢查城市配置唯一性
    if (input.cityId) {
      const existingCityConfig = await this.prisma.sharePointConfig.findFirst({
        where: { cityId: input.cityId, isActive: true }
      })

      if (existingCityConfig) {
        throw new Error('此城市已有 SharePoint 配置')
      }
    }

    // 檢查全域配置唯一性
    if (input.isGlobal) {
      const existingGlobalConfig = await this.prisma.sharePointConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      })

      if (existingGlobalConfig) {
        throw new Error('已存在全域 SharePoint 配置')
      }
    }

    // 加密 Client Secret
    const encryptedSecret = await encrypt(input.clientSecret)

    return this.prisma.sharePointConfig.create({
      data: {
        name: input.name,
        description: input.description,
        siteUrl: input.siteUrl,
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: encryptedSecret,
        libraryPath: input.libraryPath,
        rootFolderPath: input.rootFolderPath,
        cityId: input.cityId,
        isGlobal: input.isGlobal || false,
        fileExtensions: input.fileExtensions || ['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
        maxFileSizeMb: input.maxFileSizeMb || 50,
        excludeFolders: input.excludeFolders || [],
        createdById: userId
      }
    })
  }

  // 更新配置
  async updateConfig(
    configId: string,
    input: Partial<SharePointConfigInput>,
    userId: string
  ): Promise<SharePointConfig> {
    const existingConfig = await this.prisma.sharePointConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    // 準備更新數據
    const updateData: any = {
      ...input,
      updatedById: userId
    }

    // 如果更新 Client Secret，需要加密
    if (input.clientSecret) {
      updateData.clientSecret = await encrypt(input.clientSecret)
    }

    // 移除不應直接更新的欄位
    delete updateData.cityId
    delete updateData.isGlobal

    return this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: updateData
    })
  }

  // 測試連線
  async testConnection(configId: string): Promise<ConnectionTestResult> {
    const config = await this.prisma.sharePointConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    try {
      const decryptedSecret = await decrypt(config.clientSecret)

      const graphService = new MicrosoftGraphService({
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: decryptedSecret
      })

      // 測試基本連線
      const connectionResult = await graphService.testConnection()
      if (!connectionResult.success) {
        await this.updateTestResult(configId, false, connectionResult.error)
        return { success: false, error: connectionResult.error }
      }

      // 測試 SharePoint 站點存取
      const siteInfo = await graphService.getSiteInfo(config.siteUrl)

      // 測試文件庫存取
      const driveInfo = await graphService.getDriveInfo(siteInfo.id, config.libraryPath)

      // 更新配置的 driveId
      await this.prisma.sharePointConfig.update({
        where: { id: configId },
        data: { driveId: driveInfo.id }
      })

      // 記錄成功
      await this.updateTestResult(configId, true)

      return {
        success: true,
        details: {
          siteInfo: {
            id: siteInfo.id,
            name: siteInfo.displayName,
            webUrl: siteInfo.webUrl
          },
          driveInfo: {
            id: driveInfo.id,
            name: driveInfo.name,
            driveType: driveInfo.driveType
          },
          permissions: ['Files.Read.All', 'Sites.Read.All']
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateTestResult(configId, false, errorMessage)

      return {
        success: false,
        error: this.parseGraphError(error)
      }
    }
  }

  // 使用輸入直接測試（未儲存的配置）
  async testConnectionWithInput(input: SharePointConfigInput): Promise<ConnectionTestResult> {
    try {
      const graphService = new MicrosoftGraphService({
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: input.clientSecret
      })

      // 測試基本連線
      const connectionResult = await graphService.testConnection()
      if (!connectionResult.success) {
        return { success: false, error: connectionResult.error }
      }

      // 測試 SharePoint 站點存取
      const siteInfo = await graphService.getSiteInfo(input.siteUrl)

      // 測試文件庫存取
      const driveInfo = await graphService.getDriveInfo(siteInfo.id, input.libraryPath)

      return {
        success: true,
        details: {
          siteInfo: {
            id: siteInfo.id,
            name: siteInfo.displayName,
            webUrl: siteInfo.webUrl
          },
          driveInfo: {
            id: driveInfo.id,
            name: driveInfo.name,
            driveType: driveInfo.driveType
          }
        }
      }

    } catch (error) {
      return {
        success: false,
        error: this.parseGraphError(error)
      }
    }
  }

  // 獲取配置列表
  async getConfigs(options?: {
    cityId?: string
    includeInactive?: boolean
  }): Promise<SharePointConfig[]> {
    const where: any = {}

    if (options?.cityId) {
      where.cityId = options.cityId
    }

    if (!options?.includeInactive) {
      where.isActive = true
    }

    return this.prisma.sharePointConfig.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } }
      },
      orderBy: [
        { isGlobal: 'desc' },
        { city: { name: 'asc' } }
      ]
    })
  }

  // 獲取單一配置
  async getConfig(configId: string): Promise<SharePointConfig | null> {
    return this.prisma.sharePointConfig.findUnique({
      where: { id: configId },
      include: {
        city: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } }
      }
    })
  }

  // 獲取城市適用的配置
  async getConfigForCity(cityCode: string): Promise<SharePointConfig | null> {
    const city = await this.prisma.city.findUnique({
      where: { code: cityCode }
    })

    if (!city) return null

    // 優先查找城市專屬配置
    let config = await this.prisma.sharePointConfig.findFirst({
      where: { cityId: city.id, isActive: true }
    })

    // 如果沒有，使用全域配置
    if (!config) {
      config = await this.prisma.sharePointConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      })
    }

    return config
  }

  // 停用/啟用配置
  async toggleActive(configId: string, isActive: boolean): Promise<SharePointConfig> {
    return this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: { isActive }
    })
  }

  // 刪除配置
  async deleteConfig(configId: string): Promise<void> {
    // 軟刪除（停用）
    await this.prisma.sharePointConfig.update({
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
    await this.prisma.sharePointConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: success,
        lastTestError: error || null
      }
    })
  }

  // 解析 Graph API 錯誤
  private parseGraphError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('invalid_client')) {
        return '無效的應用程式 ID 或客戶端密鑰'
      }
      if (message.includes('tenant') && message.includes('not found')) {
        return '找不到指定的租戶 ID'
      }
      if (message.includes('access_denied')) {
        return '存取被拒絕，請檢查應用程式權限'
      }
      if (message.includes('site') && message.includes('not found')) {
        return '找不到指定的 SharePoint 站點'
      }
      if (message.includes('drive') && message.includes('not found')) {
        return '找不到指定的文件庫'
      }

      return error.message
    }

    return '未知錯誤'
  }
}
```

### 3. 加密工具

```typescript
// lib/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

export async function encrypt(text: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // 格式：iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export async function decrypt(encryptedText: string): Promise<string> {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

### 4. API 路由

```typescript
// app/api/admin/integrations/sharepoint/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { SharePointConfigService } from '@/lib/services/sharepoint-config.service'
import { z } from 'zod'

const configSchema = z.object({
  name: z.string().min(1, '名稱為必填'),
  description: z.string().optional(),
  siteUrl: z.string().url('請輸入有效的 SharePoint Site URL'),
  tenantId: z.string().uuid('租戶 ID 格式不正確'),
  clientId: z.string().uuid('應用程式 ID 格式不正確'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  libraryPath: z.string().min(1, '文件庫路徑為必填'),
  rootFolderPath: z.string().optional(),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  fileExtensions: z.array(z.string()).optional(),
  maxFileSizeMb: z.number().min(1).max(100).optional(),
  excludeFolders: z.array(z.string()).optional()
})

// GET - 獲取配置列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || undefined
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const service = new SharePointConfigService(prisma)
    const configs = await service.getConfigs({ cityId, includeInactive })

    // 移除敏感資訊
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

    const service = new SharePointConfigService(prisma)
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
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create config' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/integrations/sharepoint/[configId]/route.ts
import { NextRequest, NextResponse } from 'next/server'

// GET - 獲取單一配置
export async function GET(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = new SharePointConfigService(prisma)
    const config = await service.getConfig(params.configId)

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...config,
      clientSecret: '********'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    )
  }
}

// PUT - 更新配置
export async function PUT(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const service = new SharePointConfigService(prisma)
    const config = await service.updateConfig(
      params.configId,
      body,
      session.user.id
    )

    return NextResponse.json({
      ...config,
      clientSecret: '********'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    )
  }
}

// DELETE - 刪除配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = new SharePointConfigService(prisma)
    await service.deleteConfig(params.configId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete config' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/integrations/sharepoint/[configId]/test/route.ts
import { NextRequest, NextResponse } from 'next/server'

// POST - 測試連線
export async function POST(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = new SharePointConfigService(prisma)
    const result = await service.testConnection(params.configId)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/integrations/sharepoint/test/route.ts
import { NextRequest, NextResponse } from 'next/server'

// POST - 測試未儲存的配置
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const service = new SharePointConfigService(prisma)
    const result = await service.testConnectionWithInput(body)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    )
  }
}
```

### 5. React 元件

```typescript
// components/admin/SharePointConfigForm.tsx
'use client'

import { useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  TestTube,
  Save
} from 'lucide-react'
import { toast } from 'sonner'

const configSchema = z.object({
  name: z.string().min(1, '名稱為必填'),
  description: z.string().optional(),
  siteUrl: z.string().url('請輸入有效的 SharePoint Site URL'),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  libraryPath: z.string().min(1, '文件庫路徑為必填'),
  rootFolderPath: z.string().optional(),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  fileExtensions: z.string().optional(),
  maxFileSizeMb: z.number().min(1).max(100).optional()
})

type ConfigFormData = z.infer<typeof configSchema>

interface Props {
  configId?: string
  onSuccess?: () => void
}

export function SharePointConfigForm({ configId, onSuccess }: Props) {
  const [showSecret, setShowSecret] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    error?: string
    details?: any
  } | null>(null)

  const queryClient = useQueryClient()

  // 獲取城市列表
  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities')
      return response.json()
    }
  })

  // 獲取現有配置（編輯模式）
  const { data: existingConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['sharepoint-config', configId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/integrations/sharepoint/${configId}`)
      return response.json()
    },
    enabled: !!configId
  })

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      name: '',
      description: '',
      siteUrl: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      libraryPath: 'Shared Documents',
      rootFolderPath: '',
      cityId: null,
      isGlobal: false,
      fileExtensions: 'pdf,jpg,jpeg,png,tiff',
      maxFileSizeMb: 50
    }
  })

  // 當獲取到現有配置時，更新表單
  useEffect(() => {
    if (existingConfig) {
      form.reset({
        ...existingConfig,
        fileExtensions: existingConfig.fileExtensions?.join(',') || ''
      })
    }
  }, [existingConfig])

  // 測試連線
  const testMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      const endpoint = configId
        ? `/api/admin/integrations/sharepoint/${configId}/test`
        : '/api/admin/integrations/sharepoint/test'

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

  // 儲存配置
  const saveMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      const method = configId ? 'PUT' : 'POST'
      const endpoint = configId
        ? `/api/admin/integrations/sharepoint/${configId}`
        : '/api/admin/integrations/sharepoint'

      const payload = {
        ...data,
        fileExtensions: data.fileExtensions?.split(',').map(s => s.trim()) || []
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
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] })
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

  if (configId && isLoadingConfig) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {configId ? '編輯 SharePoint 配置' : '新增 SharePoint 配置'}
        </CardTitle>
        <CardDescription>
          配置 SharePoint 連線設定，讓系統可以自動獲取文件
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
                placeholder="例如：台北辦公室 SharePoint"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
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

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="配置用途說明..."
              rows={2}
            />
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

          {/* SharePoint 設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">SharePoint 設定</h3>

            <div className="space-y-2">
              <Label htmlFor="siteUrl">Site URL *</Label>
              <Input
                id="siteUrl"
                {...form.register('siteUrl')}
                placeholder="https://your-tenant.sharepoint.com/sites/your-site"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="libraryPath">文件庫路徑 *</Label>
                <Input
                  id="libraryPath"
                  {...form.register('libraryPath')}
                  placeholder="Shared Documents"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rootFolderPath">監控資料夾路徑</Label>
                <Input
                  id="rootFolderPath"
                  {...form.register('rootFolderPath')}
                  placeholder="Invoices/2024（留空監控整個文件庫）"
                />
              </div>
            </div>
          </div>

          {/* 文件過濾設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold">文件過濾設定</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileExtensions">允許的副檔名</Label>
                <Input
                  id="fileExtensions"
                  {...form.register('fileExtensions')}
                  placeholder="pdf,jpg,jpeg,png,tiff"
                />
                <p className="text-xs text-muted-foreground">
                  以逗號分隔多個副檔名
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxFileSizeMb">最大文件大小 (MB)</Label>
                <Input
                  id="maxFileSizeMb"
                  type="number"
                  {...form.register('maxFileSizeMb', { valueAsNumber: true })}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* 連線測試結果 */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    {testResult.success ? (
                      <div className="space-y-2">
                        <p className="font-medium text-green-800">連線測試成功！</p>
                        {testResult.details && (
                          <div className="text-sm">
                            <p>站點：{testResult.details.siteInfo?.name}</p>
                            <p>文件庫：{testResult.details.driveInfo?.name}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>{testResult.error}</p>
                    )}
                  </AlertDescription>
                </div>
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

            <Button
              type="submit"
              disabled={saveMutation.isPending}
            >
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
// components/admin/SharePointConfigList.tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  CheckCircle,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  TestTube,
  Globe,
  Building2,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useState } from 'react'
import { SharePointConfigForm } from './SharePointConfigForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export function SharePointConfigList() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: configs, isLoading } = useQuery({
    queryKey: ['sharepoint-configs'],
    queryFn: async () => {
      const response = await fetch('/api/admin/integrations/sharepoint')
      return response.json()
    }
  })

  const testMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(
        `/api/admin/integrations/sharepoint/${configId}/test`,
        { method: 'POST' }
      )
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] })
    }
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/integrations/sharepoint/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-configs'] })
    }
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名稱</TableHead>
            <TableHead>範圍</TableHead>
            <TableHead>Site URL</TableHead>
            <TableHead>連線狀態</TableHead>
            <TableHead>最後測試</TableHead>
            <TableHead>啟用</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs?.map((config: any) => (
            <TableRow key={config.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{config.name}</div>
                  {config.description && (
                    <div className="text-xs text-muted-foreground">
                      {config.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {config.isGlobal ? (
                  <Badge variant="secondary">
                    <Globe className="h-3 w-3 mr-1" />
                    全域
                  </Badge>
                ) : config.city ? (
                  <Badge variant="outline">
                    <Building2 className="h-3 w-3 mr-1" />
                    {config.city.name}
                  </Badge>
                ) : (
                  <Badge variant="outline">未指定</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm">
                {config.siteUrl}
              </TableCell>
              <TableCell>
                {config.lastTestResult === true && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    正常
                  </Badge>
                )}
                {config.lastTestResult === false && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    失敗
                  </Badge>
                )}
                {config.lastTestResult === null && (
                  <Badge variant="outline">未測試</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {config.lastTestedAt ? (
                  formatDistanceToNow(new Date(config.lastTestedAt), {
                    addSuffix: true,
                    locale: zhTW
                  })
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell>
                <Switch
                  checked={config.isActive}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ id: config.id, isActive: checked })
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => testMutation.mutate(config.id)}>
                      <TestTube className="h-4 w-4 mr-2" />
                      測試連線
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingId(config.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      編輯
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      刪除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* 編輯對話框 */}
      <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯 SharePoint 配置</DialogTitle>
          </DialogHeader>
          {editingId && (
            <SharePointConfigForm
              configId={editingId}
              onSuccess={() => setEditingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/sharepoint-config.service.test.ts
describe('SharePointConfigService', () => {
  describe('testConnection', () => {
    it('should return success for valid configuration', async () => {
      mockGraphService.testConnection.mockResolvedValue({ success: true })
      mockGraphService.getSiteInfo.mockResolvedValue({
        id: 'site-123',
        displayName: 'Test Site',
        webUrl: 'https://...'
      })

      const service = new SharePointConfigService(mockPrisma)
      const result = await service.testConnection('config-123')

      expect(result.success).toBe(true)
      expect(result.details?.siteInfo).toBeDefined()
    })

    it('should update config with driveId on success', async () => {
      mockGraphService.getDriveInfo.mockResolvedValue({
        id: 'drive-456',
        name: 'Documents',
        driveType: 'documentLibrary'
      })

      const service = new SharePointConfigService(mockPrisma)
      await service.testConnection('config-123')

      expect(mockPrisma.sharePointConfig.update).toHaveBeenCalledWith({
        where: { id: 'config-123' },
        data: expect.objectContaining({ driveId: 'drive-456' })
      })
    })
  })

  describe('createConfig', () => {
    it('should encrypt client secret before saving', async () => {
      const service = new SharePointConfigService(mockPrisma)

      await service.createConfig({
        name: 'Test Config',
        siteUrl: 'https://test.sharepoint.com/sites/test',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-value',
        libraryPath: 'Documents'
      }, 'user-123')

      expect(mockPrisma.sharePointConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientSecret: expect.not.stringContaining('secret-value')
        })
      })
    })
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 9-1**: SharePoint 文件監控 API（SharePointConfig 模型）

### 後續 Stories
- 無直接後續（配置完成後可供 Story 9-1 使用）

### 外部相依
- Microsoft Graph API SDK
- Azure AD 應用程式註冊
- 加密金鑰管理

---

## 備註

### Azure AD 應用程式設定指南
1. 在 Azure Portal 註冊新應用程式
2. 配置 API 權限：
   - Microsoft Graph > Application permissions
   - Sites.Read.All
   - Files.Read.All
3. 建立客戶端密鑰
4. 記錄 Tenant ID、Client ID、Client Secret

### 安全注意事項
1. Client Secret 使用 AES-256-GCM 加密儲存
2. 建議使用 Azure Key Vault 管理加密金鑰
3. 定期輪換 Client Secret
4. 監控 API 存取日誌

---

## 實作完成記錄

### 完成日期
2025-12-20

### 實作項目

#### 1. 類型定義 (src/types/sharepoint.ts)
- [x] SharePointConfigInput - 配置輸入類型
- [x] SharePointConfigUpdateInput - 配置更新類型
- [x] SharePointConfigResponse - 配置回應類型（含遮罩密鑰）
- [x] SharePointConfigListItem - 列表項目類型
- [x] SharePointConfigQueryOptions - 查詢選項
- [x] ConnectionTestResult - 連線測試結果類型

#### 2. 服務層 (src/services/sharepoint-config.service.ts)
- [x] SharePointConfigService 類別
- [x] createConfig() - 建立配置（含城市/全域唯一性檢查）
- [x] updateConfig() - 更新配置（含密鑰更新加密）
- [x] getConfig() - 獲取單一配置
- [x] getConfigs() - 獲取配置列表
- [x] deleteConfig() - 刪除配置（軟刪除）
- [x] toggleActive() - 啟用/停用配置
- [x] testConnection() - 測試已儲存的配置連線
- [x] testConnectionWithInput() - 測試未儲存的配置連線
- [x] SharePointConfigError 自定義錯誤類別

#### 3. MicrosoftGraphService 擴展
- [x] getSiteInfo() - 獲取 SharePoint 站點資訊
- [x] getDriveInfo() - 獲取文件庫資訊
- [x] testConnectionWithDetails() - 含詳細資訊的連線測試

#### 4. API 路由
- [x] GET /api/admin/integrations/sharepoint - 配置列表
- [x] POST /api/admin/integrations/sharepoint - 建立配置
- [x] GET /api/admin/integrations/sharepoint/[configId] - 獲取配置
- [x] PUT /api/admin/integrations/sharepoint/[configId] - 更新配置
- [x] DELETE /api/admin/integrations/sharepoint/[configId] - 刪除配置
- [x] POST /api/admin/integrations/sharepoint/[configId]/test - 測試已儲存配置
- [x] POST /api/admin/integrations/sharepoint/test - 測試未儲存配置

#### 5. React Query Hooks (src/hooks/use-sharepoint-config.ts)
- [x] useSharePointConfigs() - 配置列表
- [x] useSharePointConfig() - 單一配置
- [x] useCreateSharePointConfig() - 建立配置
- [x] useUpdateSharePointConfig() - 更新配置
- [x] useDeleteSharePointConfig() - 刪除配置
- [x] useToggleSharePointConfigActive() - 切換啟用狀態
- [x] useTestSharePointConnection() - 測試已儲存配置
- [x] useTestSharePointConnectionInput() - 測試未儲存配置

#### 6. UI 元件
- [x] SharePointConfigForm - 配置表單（新增/編輯）
  - Azure AD 設定區塊
  - SharePoint 設定區塊
  - 檔案過濾設定區塊
  - 城市關聯設定
  - 即時連線測試
  - Zod 表單驗證
- [x] SharePointConfigList - 配置列表元件
  - 表格顯示配置
  - 連線狀態指示
  - 啟用/停用開關
  - 編輯/刪除/測試操作

### 技術決策

1. **NextAuth v5 認證模式**: 使用 `auth()` 函數替代 v4 的 `getServerSession(authOptions)`
2. **react-hook-form 類型兼容**: 使用 `as Resolver<T>` 類型斷言解決版本兼容性問題
3. **Admin 權限檢查**: 使用 `session.user.isGlobalAdmin || session.user.roles?.some(r => r.name === 'GLOBAL_ADMIN')` 模式

### 驗證通過
- [x] npm run type-check
- [x] npm run lint
