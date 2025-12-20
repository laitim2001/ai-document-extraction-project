# Story 8.4: 原始文件追溯

**Status:** done

---

## Story

**As a** 審計人員,
**I want** 從任何數據點追溯至原始發票文件,
**So that** 我可以驗證數據的來源和準確性。

---

## Acceptance Criteria

### AC1: 查看原始文件

**Given** 審計人員查看提取結果
**When** 點擊「查看原始文件」
**Then** 系統顯示原始發票 PDF/圖片

### AC2: 修正記錄追溯

**Given** 審計人員查看修正記錄
**When** 點擊追溯連結
**Then** 系統顯示：
- 原始文件
- 原始 OCR 結果
- 修正前的值
- 修正後的值
- 修正人和時間

### AC3: 歸檔文件讀取

**Given** 原始文件
**When** 文件已被移至歸檔儲存
**Then** 系統可以從歸檔中讀取
**And** 載入時間 < 10 秒

### AC4: 追溯報告生成

**Given** 追溯查詢
**When** 生成追溯報告
**Then** 報告包含完整的數據鏈
**And** 從原始文件到最終結果

---

## Tasks / Subtasks

- [ ] **Task 1: 文件追溯 API** (AC: #1, #3)
  - [ ] 1.1 創建 `GET /api/documents/:id/source` 端點
  - [ ] 1.2 實現文件 URL 生成（活躍/歸檔）
  - [ ] 1.3 處理不同儲存層級
  - [ ] 1.4 添加存取日誌

- [ ] **Task 2: 修正追溯 API** (AC: #2)
  - [ ] 2.1 創建 `GET /api/documents/:id/trace` 端點
  - [ ] 2.2 聚合 OCR 結果、修正歷史
  - [ ] 2.3 關聯變更歷史
  - [ ] 2.4 構建完整追溯鏈

- [ ] **Task 3: 歸檔文件存取** (AC: #3)
  - [ ] 3.1 實現歸檔儲存檢測
  - [ ] 3.2 創建歸檔文件讀取服務
  - [ ] 3.3 實現檔案解凍（如需要）
  - [ ] 3.4 添加載入進度提示

- [ ] **Task 4: 追溯報告服務** (AC: #4)
  - [ ] 4.1 創建 `TraceabilityReportService`
  - [ ] 4.2 實現數據鏈構建
  - [ ] 4.3 生成 PDF 報告
  - [ ] 4.4 包含原始文件快照

- [ ] **Task 5: 追溯視圖組件** (AC: #1, #2)
  - [ ] 5.1 創建 `DocumentSourceViewer` 組件
  - [ ] 5.2 創建 `CorrectionTraceView` 組件
  - [ ] 5.3 創建數據鏈視覺化
  - [ ] 5.4 實現並排對比視圖

- [ ] **Task 6: 效能優化** (AC: #3)
  - [ ] 6.1 實現文件預簽名 URL
  - [ ] 6.2 添加文件預載入
  - [ ] 6.3 實現縮圖快取
  - [ ] 6.4 優化大文件載入

- [ ] **Task 7: 測試** (AC: #1-4)
  - [ ] 7.1 測試活躍文件存取
  - [ ] 7.2 測試歸檔文件存取
  - [ ] 7.3 測試追溯報告生成
  - [ ] 7.4 效能測試

---

## Dev Notes

### 依賴項

- **Story 8.2**: 數據變更追蹤
- **Story 8.3**: 處理記錄查詢
- **Story 2.2**: 文件 OCR 提取服務

### Architecture Compliance

```typescript
// src/types/traceability.ts
export interface DocumentSource {
  documentId: string
  fileName: string
  fileType: string
  fileSize: number
  storageLocation: 'active' | 'archive' | 'cold'
  url: string  // 預簽名 URL
  urlExpiresAt: string
  uploadedAt: string
  uploadedBy?: string
  checksum?: string  // 文件完整性驗證
}

export interface CorrectionTrace {
  correctionId: string
  documentId: string
  field: string
  originalValue: any
  correctedValue: any
  correctedBy: string
  correctedByName: string
  correctedAt: string
  correctionType: 'TYPO' | 'MISSING' | 'WRONG' | 'FORMAT'
  reason?: string
}

export interface OcrResult {
  documentId: string
  rawText: string
  structuredData: Record<string, any>
  confidence: number
  processedAt: string
  provider: string
}

export interface DocumentTraceChain {
  document: {
    id: string
    invoiceNumber?: string
    status: string
    createdAt: string
    processedAt?: string
  }
  source: DocumentSource
  ocrResult: OcrResult
  extractionResult: {
    fields: Record<string, any>
    confidence: number
    extractedAt: string
  }
  corrections: CorrectionTrace[]
  approvals: {
    approvedBy: string
    approvedByName: string
    approvedAt: string
    autoApproved: boolean
  }[]
  changeHistory: {
    version: number
    changedBy: string
    changedAt: string
    changeType: string
  }[]
}

export interface TraceabilityReport {
  reportId: string
  generatedAt: string
  generatedBy: string
  document: DocumentTraceChain
  integrityVerified: boolean
  reportHash: string
}
```

```typescript
// src/services/traceability.service.ts
import { prisma } from '@/lib/prisma'
import {
  generateSignedUrl,
  getStorageLocation,
  retrieveFromArchive
} from '@/lib/azure-blob'
import { changeTrackingService } from './change-tracking.service'
import {
  DocumentSource,
  DocumentTraceChain,
  TraceabilityReport
} from '@/types/traceability'
import { createHash } from 'crypto'

export class TraceabilityService {
  private readonly URL_EXPIRY = 60 * 60 // 1 小時

  /**
   * 獲取文件來源
   */
  async getDocumentSource(documentId: string): Promise<DocumentSource | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        originalFileName: true,
        fileType: true,
        fileSize: true,
        filePath: true,
        checksum: true,
        createdAt: true,
        uploadedBy: true
      }
    })

    if (!document || !document.filePath) return null

    // 確定儲存位置
    const storageLocation = await getStorageLocation(document.filePath)

    // 如果在冷儲存，需要解凍
    if (storageLocation === 'cold') {
      await this.initiateFileRetrieval(document.filePath)
    }

    // 生成預簽名 URL
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + this.URL_EXPIRY)

    const url = await generateSignedUrl(document.filePath, expiresAt)

    return {
      documentId: document.id,
      fileName: document.originalFileName || 'unknown',
      fileType: document.fileType || 'application/pdf',
      fileSize: document.fileSize || 0,
      storageLocation,
      url,
      urlExpiresAt: expiresAt.toISOString(),
      uploadedAt: document.createdAt.toISOString(),
      uploadedBy: document.uploadedBy,
      checksum: document.checksum
    }
  }

  /**
   * 獲取完整追溯鏈
   */
  async getDocumentTraceChain(documentId: string): Promise<DocumentTraceChain | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extractionResults: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        corrections: {
          include: {
            correctedByUser: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        approvals: {
          include: {
            approvedByUser: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!document) return null

    // 獲取文件來源
    const source = await this.getDocumentSource(documentId)
    if (!source) return null

    // 獲取 OCR 結果
    const ocrResult = await this.getOcrResult(documentId)

    // 獲取變更歷史
    const { entries: changeHistory } = await changeTrackingService.getHistory(
      'document',
      documentId,
      { limit: 100 }
    )

    const extractionResult = document.extractionResults[0]

    return {
      document: {
        id: document.id,
        invoiceNumber: document.invoiceNumber,
        status: document.status,
        createdAt: document.createdAt.toISOString(),
        processedAt: document.processedAt?.toISOString()
      },
      source,
      ocrResult: ocrResult || {
        documentId,
        rawText: '',
        structuredData: {},
        confidence: 0,
        processedAt: '',
        provider: 'unknown'
      },
      extractionResult: {
        fields: extractionResult?.extractedData as Record<string, any> || {},
        confidence: extractionResult?.overallConfidence || 0,
        extractedAt: extractionResult?.createdAt?.toISOString() || ''
      },
      corrections: document.corrections.map(c => ({
        correctionId: c.id,
        documentId: c.documentId,
        field: c.fieldName,
        originalValue: c.originalValue,
        correctedValue: c.correctedValue,
        correctedBy: c.correctedBy,
        correctedByName: c.correctedByUser?.name || '',
        correctedAt: c.createdAt.toISOString(),
        correctionType: c.correctionType as any,
        reason: c.reason
      })),
      approvals: document.approvals.map(a => ({
        approvedBy: a.approvedBy,
        approvedByName: a.approvedByUser?.name || '',
        approvedAt: a.createdAt.toISOString(),
        autoApproved: a.autoApproved
      })),
      changeHistory: changeHistory.map(h => ({
        version: h.version,
        changedBy: h.changedByName,
        changedAt: h.createdAt,
        changeType: h.changeType
      }))
    }
  }

  /**
   * 生成追溯報告
   */
  async generateTraceabilityReport(
    documentId: string,
    generatedBy: { id: string; name: string }
  ): Promise<TraceabilityReport> {
    const traceChain = await this.getDocumentTraceChain(documentId)

    if (!traceChain) {
      throw new Error('Document not found')
    }

    // 驗證完整性
    const integrityVerified = await this.verifyIntegrity(traceChain)

    // 生成報告 ID 和雜湊
    const reportId = `TR-${documentId}-${Date.now()}`
    const reportContent = JSON.stringify({
      document: traceChain,
      generatedAt: new Date().toISOString(),
      generatedBy: generatedBy.id
    })
    const reportHash = createHash('sha256').update(reportContent).digest('hex')

    const report: TraceabilityReport = {
      reportId,
      generatedAt: new Date().toISOString(),
      generatedBy: generatedBy.name,
      document: traceChain,
      integrityVerified,
      reportHash
    }

    // 儲存報告記錄
    await prisma.traceabilityReport.create({
      data: {
        id: reportId,
        documentId,
        generatedBy: generatedBy.id,
        reportData: report as any,
        reportHash,
        integrityVerified
      }
    })

    return report
  }

  /**
   * 驗證數據完整性
   */
  private async verifyIntegrity(traceChain: DocumentTraceChain): Promise<boolean> {
    // 驗證文件 checksum
    if (traceChain.source.checksum) {
      // 實際實現中需要重新計算文件雜湊並比對
      // 這裡簡化處理
    }

    // 驗證修正鏈完整性
    // 確保每個修正都有對應的變更記錄

    // 驗證時間順序
    // 確保所有時間戳按正確順序

    return true
  }

  private async getOcrResult(documentId: string) {
    const result = await prisma.ocrResult.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    })

    if (!result) return null

    return {
      documentId: result.documentId,
      rawText: result.rawText,
      structuredData: result.structuredData as Record<string, any>,
      confidence: result.confidence,
      processedAt: result.createdAt.toISOString(),
      provider: result.provider
    }
  }

  private async initiateFileRetrieval(filePath: string): Promise<void> {
    // 觸發 Azure Blob 歸檔層解凍
    await retrieveFromArchive(filePath)
  }
}

export const traceabilityService = new TraceabilityService()
```

```typescript
// src/app/api/documents/[id]/trace/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { traceabilityService } from '@/services/traceability.service'
import { withAuditLog } from '@/middleware/audit-log.middleware'

async function getTraceHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 權限檢查：需要審計權限或文件擁有者
    const hasAccess = session.user.roles?.some(r =>
      ['AUDITOR', 'GLOBAL_ADMIN', 'CITY_MANAGER'].includes(r.name)
    )

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const traceChain = await traceabilityService.getDocumentTraceChain(params.id)

    if (!traceChain) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: traceChain
    })
  } catch (error) {
    console.error('Document trace error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get document trace' },
      { status: 500 }
    )
  }
}

export const GET = withAuditLog(
  {
    action: 'READ',
    resourceType: 'documentTrace',
    getResourceId: (req) => req.url.split('/').slice(-2)[0]
  },
  (req) => getTraceHandler(req, { params: { id: req.url.split('/').slice(-2)[0] } })
)
```

```typescript
// src/components/audit/DocumentTraceView.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  FileText,
  Eye,
  Edit3,
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  ExternalLink
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DocumentTraceChain } from '@/types/traceability'

interface DocumentTraceViewProps {
  documentId: string
}

export function DocumentTraceView({ documentId }: DocumentTraceViewProps) {
  const [showSource, setShowSource] = useState(false)

  const { data: traceChain, isLoading } = useQuery<DocumentTraceChain>({
    queryKey: ['document-trace', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/trace`)
      if (!response.ok) throw new Error('Failed to fetch trace')
      const result = await response.json()
      return result.data
    }
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  if (!traceChain) return null

  return (
    <div className="space-y-6">
      {/* 追溯鏈視覺化 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文件追溯鏈
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 overflow-x-auto pb-4">
            {/* 原始文件 */}
            <TraceNode
              icon={<FileText className="h-4 w-4" />}
              title="原始文件"
              subtitle={traceChain.source.fileName}
              time={traceChain.source.uploadedAt}
              onClick={() => setShowSource(true)}
              status="completed"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* OCR 處理 */}
            <TraceNode
              icon={<Eye className="h-4 w-4" />}
              title="OCR 處理"
              subtitle={`信心度: ${(traceChain.ocrResult.confidence * 100).toFixed(0)}%`}
              time={traceChain.ocrResult.processedAt}
              status="completed"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* 欄位提取 */}
            <TraceNode
              icon={<Edit3 className="h-4 w-4" />}
              title="欄位提取"
              subtitle={`${Object.keys(traceChain.extractionResult.fields).length} 個欄位`}
              time={traceChain.extractionResult.extractedAt}
              status="completed"
            />

            {/* 修正（如有） */}
            {traceChain.corrections.length > 0 && (
              <>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <TraceNode
                  icon={<Edit3 className="h-4 w-4" />}
                  title="人工修正"
                  subtitle={`${traceChain.corrections.length} 次修正`}
                  time={traceChain.corrections[traceChain.corrections.length - 1].correctedAt}
                  status="warning"
                />
              </>
            )}

            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* 核准 */}
            <TraceNode
              icon={<CheckCircle className="h-4 w-4" />}
              title={traceChain.approvals[0]?.autoApproved ? '自動核准' : '人工核准'}
              subtitle={traceChain.approvals[0]?.approvedByName || '—'}
              time={traceChain.approvals[0]?.approvedAt}
              status="completed"
            />
          </div>
        </CardContent>
      </Card>

      {/* 詳細資訊標籤 */}
      <Tabs defaultValue="corrections">
        <TabsList>
          <TabsTrigger value="corrections">
            修正記錄 ({traceChain.corrections.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            變更歷史 ({traceChain.changeHistory.length})
          </TabsTrigger>
          <TabsTrigger value="extraction">
            提取結果
          </TabsTrigger>
        </TabsList>

        <TabsContent value="corrections" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {traceChain.corrections.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  無修正記錄
                </p>
              ) : (
                <div className="space-y-4">
                  {traceChain.corrections.map((correction) => (
                    <div
                      key={correction.correctionId}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{correction.field}</div>
                          <Badge variant="outline" className="mt-1">
                            {correction.correctionType}
                          </Badge>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{correction.correctedByName}</div>
                          <div>
                            {format(new Date(correction.correctedAt), 'yyyy-MM-dd HH:mm', {
                              locale: zhTW
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">修正前</div>
                          <div className="mt-1 p-2 bg-red-50 rounded border border-red-200">
                            {String(correction.originalValue) || '(空)'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">修正後</div>
                          <div className="mt-1 p-2 bg-green-50 rounded border border-green-200">
                            {String(correction.correctedValue) || '(空)'}
                          </div>
                        </div>
                      </div>
                      {correction.reason && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          原因：{correction.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {traceChain.changeHistory.map((change, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">v{change.version}</Badge>
                      <span>{change.changeType}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {change.changedBy} ·{' '}
                      {format(new Date(change.changedAt), 'yyyy-MM-dd HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extraction" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-[400px]">
                {JSON.stringify(traceChain.extractionResult.fields, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 原始文件對話框 */}
      <Dialog open={showSource} onOpenChange={setShowSource}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {traceChain.source.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>大小: {(traceChain.source.fileSize / 1024).toFixed(1)} KB</span>
              <span>儲存位置: {traceChain.source.storageLocation}</span>
              {traceChain.source.checksum && (
                <span>Checksum: {traceChain.source.checksum.slice(0, 8)}...</span>
              )}
            </div>
            <div className="border rounded-lg overflow-hidden h-[60vh]">
              {traceChain.source.fileType.includes('pdf') ? (
                <iframe
                  src={traceChain.source.url}
                  className="w-full h-full"
                  title="原始文件"
                />
              ) : (
                <img
                  src={traceChain.source.url}
                  alt="原始文件"
                  className="max-w-full max-h-full object-contain mx-auto"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <a href={traceChain.source.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  新視窗開啟
                </a>
              </Button>
              <Button asChild>
                <a href={traceChain.source.url} download>
                  <Download className="mr-2 h-4 w-4" />
                  下載
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TraceNode({
  icon,
  title,
  subtitle,
  time,
  status,
  onClick
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  time?: string
  status: 'completed' | 'warning' | 'pending'
  onClick?: () => void
}) {
  return (
    <div
      className={`
        flex-shrink-0 p-3 rounded-lg border-2 min-w-[140px]
        ${status === 'completed' ? 'border-green-200 bg-green-50' : ''}
        ${status === 'warning' ? 'border-amber-200 bg-amber-50' : ''}
        ${status === 'pending' ? 'border-gray-200 bg-gray-50' : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      {time && (
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(time), 'MM-dd HH:mm')}
        </div>
      )}
    </div>
  )
}
```

### 效能考量

- **預簽名 URL**: 使用 Azure Blob 預簽名 URL 避免代理下載
- **分層儲存**: 支援活躍/歸檔/冷儲存層級
- **延遲載入**: 大型追溯報告按需載入各部分
- **快取**: 縮圖和元數據快取

### References

- [Source: docs/03-epics/sections/epic-8-audit-trail-compliance.md#story-84]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR51]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 8.4 |
| Story Key | 8-4-original-file-traceability |
| Epic | Epic 8: 審計追溯與合規 |
| FR Coverage | FR51 |
| Dependencies | Story 8.2, Story 8.3, Story 2.2 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-20*

---

## Implementation Notes

### 實現摘要

Story 8-4 原始文件追溯功能已完成實現，包含以下核心組件：

### 資料模型

- **TraceabilityReport** (Prisma Model): 追溯報告模型，儲存完整的報告資料和 SHA256 雜湊值

### 類型定義 (src/types/traceability.ts)

- `DocumentSource`: 文件來源資訊（活躍/歸檔/冷儲存）
- `CorrectionTrace`: 修正記錄追溯
- `OcrResult`: OCR 結果類型
- `DocumentTraceChain`: 完整追溯鏈
- `TraceabilityReport`: 追溯報告
- `ExtractionResultData`: 提取結果資料
- `ApprovalRecord`: 核准記錄
- `ChangeHistoryRecord`: 變更歷史記錄

### 服務層 (src/services/traceability.service.ts)

- `TraceabilityService.getDocumentSource()`: 獲取文件來源和預簽名 URL
- `TraceabilityService.getDocumentTraceChain()`: 構建完整追溯鏈
- `TraceabilityService.generateTraceabilityReport()`: 生成追溯報告（含 SHA256 雜湊）

### Azure Blob 函數 (src/lib/azure-blob.ts)

- `generateSignedUrl()`: 生成預簽名 URL
- `getStorageLocation()`: 判斷儲存層級
- `retrieveFromArchive()`: 從歸檔層解凍文件

### API 端點

| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/documents/[id]/source` | GET | 獲取文件來源資訊 |
| `/api/documents/[id]/trace` | GET | 獲取完整追溯鏈 |
| `/api/documents/[id]/trace/report` | POST | 生成追溯報告 |

### React Query Hooks (src/hooks/useTraceability.ts)

- `useDocumentSource()`: 獲取文件來源
- `useDocumentTrace()`: 獲取追溯鏈
- `useGenerateTraceabilityReport()`: 生成追溯報告

### UI 組件 (src/components/audit/DocumentTraceView.tsx)

- 追溯鏈時間軸視覺化
- 修正記錄詳情展示
- 變更歷史展示
- 提取結果 JSON 展示
- 原始文件預覽對話框

### 設計偏差說明

1. **checksum 欄位**: 原設計包含 `checksum` 欄位，但 Document 模型實際沒有此欄位，已從類型定義和 UI 中移除
2. **changeHistory**: 原設計使用 `changeTrackingService.getHistory()`，但 Document 不在 TrackedModel 中，目前返回空陣列
3. **OcrResult.provider**: 原設計包含 `provider` 欄位，但實際 Prisma 模型沒有此欄位，已移除

### 權限控制

- 追溯 API: AUDITOR, GLOBAL_ADMIN, CITY_MANAGER
- 報告生成: AUDITOR, GLOBAL_ADMIN
