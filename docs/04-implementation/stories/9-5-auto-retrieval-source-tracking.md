# Story 9-5: 自動獲取來源追蹤

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.5 |
| 標題 | 自動獲取來源追蹤 |
| FR 覆蓋 | FR2, FR3 |
| 狀態 | done |
| 優先級 | Medium |
| 估計點數 | 5 |

---

## 用戶故事

**As a** 用戶,
**I want** 查看自動獲取的文件來源資訊,
**So that** 我可以追蹤文件的原始來源。

---

## 驗收標準

### AC1: SharePoint 來源顯示

**Given** 查看發票詳情
**When** 發票來自 SharePoint
**Then** 顯示：
- 來源類型：SharePoint
- SharePoint 文件路徑
- 獲取時間
- 原始文件名

### AC2: Outlook 來源顯示

**Given** 查看發票詳情
**When** 發票來自 Outlook
**Then** 顯示：
- 來源類型：Outlook
- 寄件者地址
- 郵件主旨
- 郵件接收時間
- 附件原始名稱

### AC3: 來源類型篩選

**Given** 發票列表頁面
**When** 需要篩選來源
**Then** 支援按來源類型篩選（手動上傳/SharePoint/Outlook）

---

## 技術實作規格

### 1. 資料模型

#### Document 模型已包含來源欄位

```prisma
// 來源追蹤欄位（已在 Story 9-1 定義）
model Document {
  // ... 其他欄位 ...

  // 來源追蹤
  sourceType        DocumentSourceType  @default(MANUAL_UPLOAD)
  sourceMetadata    Json?               // 來源詳細資訊

  // SharePoint 特定
  sharepointItemId  String?
  sharepointDriveId String?
  sharepointSiteId  String?
  sharepointUrl     String?

  // ... 索引 ...
  @@index([sourceType])
}

enum DocumentSourceType {
  MANUAL_UPLOAD   // 手動上傳
  SHAREPOINT      // SharePoint
  OUTLOOK         // Outlook 郵件附件
  API             // 外部 API
}
```

#### sourceMetadata JSON 結構

```typescript
// SharePoint 來源
interface SharePointSourceMetadata {
  sharepointUrl: string
  webUrl: string
  siteName?: string
  libraryName?: string
  folderPath?: string
  createdDateTime: string
  lastModifiedDateTime: string
  fetchedAt: string
  fetchLogId: string
}

// Outlook 來源
interface OutlookSourceMetadata {
  messageId?: string
  subject: string
  senderEmail: string
  senderName?: string
  receivedAt: string
  attachmentName: string
  attachmentIndex: number
  totalAttachments: number
  fetchLogId: string
}

// 手動上傳
interface ManualUploadSourceMetadata {
  uploadedAt: string
  uploadedBy: string
  uploadMethod: 'web' | 'api' | 'drag-drop'
  originalFileName: string
}
```

### 2. 來源資訊服務

```typescript
// lib/services/document-source.service.ts

// 來源資訊類型
export interface DocumentSourceInfo {
  type: DocumentSourceType
  displayName: string
  icon: string
  details: SourceDetails
}

export interface SourceDetails {
  // 共用
  originalFileName: string
  acquiredAt: string

  // SharePoint 特定
  sharepoint?: {
    siteUrl: string
    siteName?: string
    libraryPath: string
    webUrl: string
    lastModifiedDateTime?: string
  }

  // Outlook 特定
  outlook?: {
    senderEmail: string
    senderName?: string
    subject: string
    receivedAt: string
    attachmentIndex: number
    totalAttachments: number
  }

  // 手動上傳特定
  manual?: {
    uploadedBy: string
    uploadedByName?: string
    uploadMethod: string
  }
}

export class DocumentSourceService {
  constructor(private prisma: PrismaClient) {}

  // 獲取文件來源資訊
  async getSourceInfo(documentId: string): Promise<DocumentSourceInfo | null> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } }
      }
    })

    if (!document) return null

    const metadata = document.sourceMetadata as Record<string, any> || {}

    switch (document.sourceType) {
      case 'SHAREPOINT':
        return this.buildSharePointSourceInfo(document, metadata)
      case 'OUTLOOK':
        return this.buildOutlookSourceInfo(document, metadata)
      case 'MANUAL_UPLOAD':
        return this.buildManualSourceInfo(document, metadata)
      case 'API':
        return this.buildApiSourceInfo(document, metadata)
      default:
        return this.buildUnknownSourceInfo(document)
    }
  }

  // 建構 SharePoint 來源資訊
  private buildSharePointSourceInfo(
    document: Document,
    metadata: Record<string, any>
  ): DocumentSourceInfo {
    return {
      type: 'SHAREPOINT',
      displayName: 'SharePoint',
      icon: 'sharepoint',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.fetchedAt || document.createdAt.toISOString(),
        sharepoint: {
          siteUrl: document.sharepointUrl || metadata.sharepointUrl || '',
          siteName: metadata.siteName,
          libraryPath: metadata.libraryName || metadata.folderPath || '',
          webUrl: metadata.webUrl || '',
          lastModifiedDateTime: metadata.lastModifiedDateTime
        }
      }
    }
  }

  // 建構 Outlook 來源資訊
  private buildOutlookSourceInfo(
    document: Document,
    metadata: Record<string, any>
  ): DocumentSourceInfo {
    return {
      type: 'OUTLOOK',
      displayName: 'Outlook 郵件',
      icon: 'mail',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.receivedAt || document.createdAt.toISOString(),
        outlook: {
          senderEmail: metadata.senderEmail || '',
          senderName: metadata.senderName,
          subject: metadata.subject || '',
          receivedAt: metadata.receivedAt || '',
          attachmentIndex: metadata.attachmentIndex || 0,
          totalAttachments: metadata.totalAttachments || 1
        }
      }
    }
  }

  // 建構手動上傳來源資訊
  private buildManualSourceInfo(
    document: Document & { uploadedBy?: { id: string; name: string; email: string } | null },
    metadata: Record<string, any>
  ): DocumentSourceInfo {
    return {
      type: 'MANUAL_UPLOAD',
      displayName: '手動上傳',
      icon: 'upload',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.uploadedAt || document.createdAt.toISOString(),
        manual: {
          uploadedBy: document.uploadedById || '',
          uploadedByName: document.uploadedBy?.name || metadata.uploadedByName,
          uploadMethod: metadata.uploadMethod || 'web'
        }
      }
    }
  }

  // 建構 API 來源資訊
  private buildApiSourceInfo(
    document: Document,
    metadata: Record<string, any>
  ): DocumentSourceInfo {
    return {
      type: 'API',
      displayName: '外部 API',
      icon: 'api',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.submittedAt || document.createdAt.toISOString()
      }
    }
  }

  // 建構未知來源資訊
  private buildUnknownSourceInfo(document: Document): DocumentSourceInfo {
    return {
      type: 'MANUAL_UPLOAD',
      displayName: '未知',
      icon: 'file',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: document.createdAt.toISOString()
      }
    }
  }

  // 獲取來源類型統計
  async getSourceTypeStats(options?: {
    cityId?: string
    dateFrom?: Date
    dateTo?: Date
  }): Promise<Array<{ sourceType: string; count: number; percentage: number }>> {
    const where: any = {}

    if (options?.cityId) {
      where.cityId = options.cityId
    }

    if (options?.dateFrom || options?.dateTo) {
      where.createdAt = {}
      if (options.dateFrom) where.createdAt.gte = options.dateFrom
      if (options.dateTo) where.createdAt.lte = options.dateTo
    }

    const stats = await this.prisma.document.groupBy({
      by: ['sourceType'],
      where,
      _count: { _all: true }
    })

    const total = stats.reduce((sum, s) => sum + s._count._all, 0)

    return stats.map(s => ({
      sourceType: s.sourceType,
      count: s._count._all,
      percentage: total > 0 ? Math.round((s._count._all / total) * 100) : 0
    }))
  }

  // 按來源類型搜尋文件
  async searchBySource(options: {
    sourceType?: DocumentSourceType
    senderEmail?: string
    subject?: string
    sharepointUrl?: string
    cityId?: string
    page?: number
    limit?: number
  }): Promise<{ items: Document[]; total: number }> {
    const where: any = {}
    const { page = 1, limit = 20 } = options

    if (options.sourceType) {
      where.sourceType = options.sourceType
    }

    if (options.cityId) {
      where.cityId = options.cityId
    }

    // Outlook 特定搜尋
    if (options.senderEmail) {
      where.sourceMetadata = {
        path: ['senderEmail'],
        string_contains: options.senderEmail
      }
    }

    if (options.subject) {
      where.sourceMetadata = {
        path: ['subject'],
        string_contains: options.subject
      }
    }

    // SharePoint 特定搜尋
    if (options.sharepointUrl) {
      where.sharepointUrl = { contains: options.sharepointUrl }
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          city: { select: { id: true, name: true, code: true } },
          uploadedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.document.count({ where })
    ])

    return { items, total }
  }
}
```

### 3. API 路由

```typescript
// app/api/documents/[documentId]/source/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { DocumentSourceService } from '@/lib/services/document-source.service'

// GET - 獲取文件來源資訊
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = new DocumentSourceService(prisma)
    const sourceInfo = await service.getSourceInfo(params.documentId)

    if (!sourceInfo) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(sourceInfo)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch source info' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/documents/sources/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'

// GET - 獲取來源類型統計
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cityId = searchParams.get('cityId') || undefined
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  try {
    const service = new DocumentSourceService(prisma)
    const stats = await service.getSourceTypeStats({
      cityId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined
    })

    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/documents/search/route.ts（擴展）
import { NextRequest, NextResponse } from 'next/server'

// GET - 搜尋文件（包含來源篩選）
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  try {
    const service = new DocumentSourceService(prisma)
    const result = await service.searchBySource({
      sourceType: searchParams.get('sourceType') as DocumentSourceType || undefined,
      senderEmail: searchParams.get('senderEmail') || undefined,
      subject: searchParams.get('subject') || undefined,
      sharepointUrl: searchParams.get('sharepointUrl') || undefined,
      cityId: searchParams.get('cityId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to search documents' },
      { status: 500 }
    )
  }
}
```

### 4. React 元件

```typescript
// components/documents/DocumentSourceBadge.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  Upload,
  Mail,
  FileSpreadsheet,
  Globe,
  HelpCircle
} from 'lucide-react'

const SOURCE_CONFIG: Record<string, {
  label: string
  icon: any
  variant: 'default' | 'secondary' | 'outline'
  color: string
}> = {
  MANUAL_UPLOAD: {
    label: '手動上傳',
    icon: Upload,
    variant: 'secondary',
    color: 'text-gray-600'
  },
  SHAREPOINT: {
    label: 'SharePoint',
    icon: FileSpreadsheet,
    variant: 'default',
    color: 'text-blue-600'
  },
  OUTLOOK: {
    label: 'Outlook',
    icon: Mail,
    variant: 'default',
    color: 'text-cyan-600'
  },
  API: {
    label: '外部 API',
    icon: Globe,
    variant: 'outline',
    color: 'text-purple-600'
  }
}

interface Props {
  sourceType: string
  tooltip?: string
}

export function DocumentSourceBadge({ sourceType, tooltip }: Props) {
  const config = SOURCE_CONFIG[sourceType] || {
    label: '未知',
    icon: HelpCircle,
    variant: 'outline' as const,
    color: 'text-gray-400'
  }

  const Icon = config.icon

  const badge = (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${config.color}`} />
      {config.label}
    </Badge>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
```

```typescript
// components/documents/DocumentSourceDetails.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentSourceBadge } from './DocumentSourceBadge'
import {
  FileText,
  Calendar,
  User,
  Mail,
  Link,
  Folder,
  Clock,
  Paperclip
} from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Props {
  documentId: string
}

export function DocumentSourceDetails({ documentId }: Props) {
  const { data: sourceInfo, isLoading } = useQuery({
    queryKey: ['document-source', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/source`)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (!sourceInfo) {
    return null
  }

  const { details } = sourceInfo

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">來源資訊</CardTitle>
          <DocumentSourceBadge sourceType={sourceInfo.type} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 共用資訊 */}
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">原始檔名：</span>
          <span className="font-medium">{details.originalFileName}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">獲取時間：</span>
          <span>
            {format(new Date(details.acquiredAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
          </span>
        </div>

        {/* SharePoint 特定資訊 */}
        {details.sharepoint && (
          <>
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                SharePoint 詳情
              </h4>

              {details.sharepoint.siteName && (
                <div className="flex items-center gap-2 text-sm">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">站點：</span>
                  <span>{details.sharepoint.siteName}</span>
                </div>
              )}

              {details.sharepoint.libraryPath && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">路徑：</span>
                  <span className="truncate">{details.sharepoint.libraryPath}</span>
                </div>
              )}

              {details.sharepoint.webUrl && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={details.sharepoint.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    在 SharePoint 中查看
                  </a>
                </div>
              )}
            </div>
          </>
        )}

        {/* Outlook 特定資訊 */}
        {details.outlook && (
          <>
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <Mail className="h-4 w-4" />
                郵件詳情
              </h4>

              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">寄件者：</span>
                <span>
                  {details.outlook.senderName && `${details.outlook.senderName} `}
                  <span className="text-muted-foreground">
                    &lt;{details.outlook.senderEmail}&gt;
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">主旨：</span>
                <span className="truncate">{details.outlook.subject}</span>
              </div>

              <div className="flex items-center gap-2 text-sm mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">收件時間：</span>
                <span>
                  {format(new Date(details.outlook.receivedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                </span>
              </div>

              {details.outlook.totalAttachments > 1 && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">附件：</span>
                  <span>
                    第 {details.outlook.attachmentIndex + 1} 個，共 {details.outlook.totalAttachments} 個
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* 手動上傳資訊 */}
        {details.manual && (
          <>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">上傳者：</span>
                <span>{details.manual.uploadedByName || '未知'}</span>
              </div>

              <div className="flex items-center gap-2 text-sm mt-1">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">上傳方式：</span>
                <span>
                  {details.manual.uploadMethod === 'web' ? '網頁上傳' :
                   details.manual.uploadMethod === 'drag-drop' ? '拖曳上傳' :
                   details.manual.uploadMethod === 'api' ? 'API 上傳' : '未知'}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

```typescript
// components/documents/SourceTypeFilter.tsx
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Upload, Mail, FileSpreadsheet, Globe, Filter } from 'lucide-react'

const SOURCE_OPTIONS = [
  { value: 'all', label: '所有來源', icon: Filter },
  { value: 'MANUAL_UPLOAD', label: '手動上傳', icon: Upload },
  { value: 'SHAREPOINT', label: 'SharePoint', icon: FileSpreadsheet },
  { value: 'OUTLOOK', label: 'Outlook 郵件', icon: Mail },
  { value: 'API', label: '外部 API', icon: Globe }
]

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SourceTypeFilter({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="篩選來源" />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {option.label}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
```

```typescript
// components/documents/SourceTypeStats.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Upload, Mail, FileSpreadsheet, Globe } from 'lucide-react'

const COLORS = {
  MANUAL_UPLOAD: '#6b7280',
  SHAREPOINT: '#3b82f6',
  OUTLOOK: '#06b6d4',
  API: '#8b5cf6'
}

const LABELS = {
  MANUAL_UPLOAD: '手動上傳',
  SHAREPOINT: 'SharePoint',
  OUTLOOK: 'Outlook',
  API: '外部 API'
}

interface Props {
  cityId?: string
  dateFrom?: Date
  dateTo?: Date
}

export function SourceTypeStats({ cityId, dateFrom, dateTo }: Props) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['source-type-stats', cityId, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cityId) params.set('cityId', cityId)
      if (dateFrom) params.set('dateFrom', dateFrom.toISOString())
      if (dateTo) params.set('dateTo', dateTo.toISOString())

      const response = await fetch(`/api/documents/sources/stats?${params}`)
      return response.json()
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const chartData = stats?.map((s: any) => ({
    name: LABELS[s.sourceType as keyof typeof LABELS] || s.sourceType,
    value: s.count,
    percentage: s.percentage,
    fill: COLORS[s.sourceType as keyof typeof COLORS] || '#94a3b8'
  })) || []

  const total = chartData.reduce((sum: number, item: any) => sum + item.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">文件來源分佈</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            暫無數據
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-[200px] h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} 個文件`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-2">
              {chartData.map((item: any) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.value} ({item.percentage}%)
                  </div>
                </div>
              ))}

              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between font-medium">
                  <span>總計</span>
                  <span>{total} 個文件</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/document-source.service.test.ts
describe('DocumentSourceService', () => {
  let service: DocumentSourceService

  beforeEach(() => {
    service = new DocumentSourceService(mockPrisma)
  })

  describe('getSourceInfo', () => {
    it('should return SharePoint source info correctly', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        sourceType: 'SHAREPOINT',
        originalFileName: 'invoice.pdf',
        sourceMetadata: {
          sharepointUrl: 'https://...',
          webUrl: 'https://...',
          fetchedAt: '2024-01-15T10:00:00Z'
        },
        sharepointUrl: 'https://...',
        createdAt: new Date()
      })

      const result = await service.getSourceInfo('doc-1')

      expect(result?.type).toBe('SHAREPOINT')
      expect(result?.displayName).toBe('SharePoint')
      expect(result?.details.sharepoint).toBeDefined()
    })

    it('should return Outlook source info correctly', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-2',
        sourceType: 'OUTLOOK',
        originalFileName: 'receipt.pdf',
        sourceMetadata: {
          senderEmail: 'vendor@example.com',
          senderName: 'Vendor',
          subject: 'Invoice October',
          receivedAt: '2024-01-15T09:00:00Z',
          attachmentIndex: 0,
          totalAttachments: 2
        },
        createdAt: new Date()
      })

      const result = await service.getSourceInfo('doc-2')

      expect(result?.type).toBe('OUTLOOK')
      expect(result?.details.outlook?.senderEmail).toBe('vendor@example.com')
      expect(result?.details.outlook?.totalAttachments).toBe(2)
    })
  })

  describe('getSourceTypeStats', () => {
    it('should return correct statistics', async () => {
      mockPrisma.document.groupBy.mockResolvedValue([
        { sourceType: 'MANUAL_UPLOAD', _count: { _all: 50 } },
        { sourceType: 'SHAREPOINT', _count: { _all: 30 } },
        { sourceType: 'OUTLOOK', _count: { _all: 20 } }
      ])

      const result = await service.getSourceTypeStats()

      expect(result).toHaveLength(3)
      expect(result.find(s => s.sourceType === 'MANUAL_UPLOAD')?.percentage).toBe(50)
      expect(result.find(s => s.sourceType === 'SHAREPOINT')?.percentage).toBe(30)
    })
  })
})
```

### 整合測試

```typescript
// __tests__/api/document-source.test.ts
describe('GET /api/documents/[documentId]/source', () => {
  it('should return source info for authorized user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'USER' }
    })

    const { req, res } = createMocks({
      method: 'GET'
    })

    await handler(req, res, { params: { documentId: 'doc-1' } })

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data).toHaveProperty('type')
    expect(data).toHaveProperty('details')
  })

  it('should return 404 for non-existent document', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)

    const { req, res } = createMocks({ method: 'GET' })

    await handler(req, res, { params: { documentId: 'non-existent' } })

    expect(res._getStatusCode()).toBe(404)
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 9-1**: SharePoint 文件監控 API（Document sourceType 欄位）
- **Story 9-3**: Outlook 郵件附件提取 API（Outlook 來源追蹤）

### 後續 Stories
- 無直接後續（Epic 9 最後一個 Story）

### 外部相依
- Recharts（圖表顯示）
- date-fns（日期格式化）

---

## 備註

### 來源追蹤用途
1. **審計需求**：追蹤文件原始來源
2. **問題排查**：快速定位文件獲取問題
3. **統計分析**：了解各來源文件比例
4. **用戶體驗**：清楚顯示文件來自何處

### 效能考量
1. sourceMetadata 使用 JSON 欄位靈活儲存
2. 關鍵欄位建立索引支援快速查詢
3. 統計查詢使用 groupBy 提高效率
4. 元件使用 React Query 快取結果
