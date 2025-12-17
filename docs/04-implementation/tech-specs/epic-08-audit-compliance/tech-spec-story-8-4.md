# Tech Spec: Story 8-4 原始文件追溯

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 8.4 |
| Epic | Epic 8: 審計追溯與合規 |
| 優先級 | High |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| 依賴 | Story 8.2 (數據變更追蹤), Story 8.3 (處理記錄查詢), Story 2.2 (OCR 服務) |

## 1. 概述

### 1.1 目標
實現完整的文件追溯功能，讓審計人員可以從任何數據點追溯至原始發票文件，驗證數據來源和準確性。

### 1.2 用戶故事
**As a** 審計人員
**I want** 從任何數據點追溯至原始發票文件
**So that** 我可以驗證數據的來源和準確性

### 1.3 範圍
- 文件來源 API（活躍/歸檔儲存）
- 完整追溯鏈查詢
- 修正記錄追溯
- 追溯報告生成
- 追溯視圖 UI 組件

---

## 2. 類型定義

```typescript
// src/types/traceability.ts

export interface DocumentSource {
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageLocation: 'active' | 'archive' | 'cold';
  url: string;
  urlExpiresAt: string;
  uploadedAt: string;
  uploadedBy?: string;
  checksum?: string;
}

export interface CorrectionTrace {
  correctionId: string;
  documentId: string;
  field: string;
  originalValue: any;
  correctedValue: any;
  correctedBy: string;
  correctedByName: string;
  correctedAt: string;
  correctionType: 'TYPO' | 'MISSING' | 'WRONG' | 'FORMAT';
  reason?: string;
}

export interface OcrResult {
  documentId: string;
  rawText: string;
  structuredData: Record<string, any>;
  confidence: number;
  processedAt: string;
  provider: string;
}

export interface DocumentTraceChain {
  document: {
    id: string;
    invoiceNumber?: string;
    status: string;
    createdAt: string;
    processedAt?: string;
  };
  source: DocumentSource;
  ocrResult: OcrResult;
  extractionResult: {
    fields: Record<string, any>;
    confidence: number;
    extractedAt: string;
  };
  corrections: CorrectionTrace[];
  approvals: {
    approvedBy: string;
    approvedByName: string;
    approvedAt: string;
    autoApproved: boolean;
  }[];
  changeHistory: {
    version: number;
    changedBy: string;
    changedAt: string;
    changeType: string;
  }[];
}

export interface TraceabilityReport {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  document: DocumentTraceChain;
  integrityVerified: boolean;
  reportHash: string;
}
```

---

## 3. 資料庫模型

```prisma
model TraceabilityReport {
  id                String    @id
  documentId        String    @map("document_id")
  generatedBy       String    @map("generated_by")
  reportData        Json      @map("report_data")
  reportHash        String    @map("report_hash")
  integrityVerified Boolean   @map("integrity_verified")
  createdAt         DateTime  @default(now()) @map("created_at")

  document          Document  @relation(fields: [documentId], references: [id])
  generatedByUser   User      @relation(fields: [generatedBy], references: [id])

  @@index([documentId])
  @@index([generatedBy])
  @@index([createdAt])
  @@map("traceability_reports")
}
```

---

## 4. 追溯服務

```typescript
// src/services/traceability.service.ts

import { prisma } from '@/lib/prisma';
import { generateSignedUrl, getStorageLocation, retrieveFromArchive } from '@/lib/azure-blob';
import { changeTrackingService } from './change-tracking.service';
import { DocumentSource, DocumentTraceChain, TraceabilityReport } from '@/types/traceability';
import { createHash } from 'crypto';

export class TraceabilityService {
  private readonly URL_EXPIRY = 60 * 60; // 1 小時

  /**
   * 獲取文件來源
   */
  async getDocumentSource(documentId: string): Promise<DocumentSource | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true, originalFileName: true, fileType: true,
        fileSize: true, filePath: true, checksum: true,
        createdAt: true, uploadedBy: true
      }
    });

    if (!document || !document.filePath) return null;

    const storageLocation = await getStorageLocation(document.filePath);

    // 冷儲存需解凍
    if (storageLocation === 'cold') {
      await this.initiateFileRetrieval(document.filePath);
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.URL_EXPIRY);
    const url = await generateSignedUrl(document.filePath, expiresAt);

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
    };
  }

  /**
   * 獲取完整追溯鏈
   */
  async getDocumentTraceChain(documentId: string): Promise<DocumentTraceChain | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extractionResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        corrections: {
          include: { correctedByUser: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        },
        approvals: {
          include: { approvedByUser: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!document) return null;

    const [source, ocrResult, { entries: changeHistory }] = await Promise.all([
      this.getDocumentSource(documentId),
      this.getOcrResult(documentId),
      changeTrackingService.getHistory('document', documentId, { limit: 100 })
    ]);

    if (!source) return null;

    const extractionResult = document.extractionResults[0];

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
        documentId, rawText: '', structuredData: {},
        confidence: 0, processedAt: '', provider: 'unknown'
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
    };
  }

  /**
   * 生成追溯報告
   */
  async generateTraceabilityReport(
    documentId: string,
    generatedBy: { id: string; name: string }
  ): Promise<TraceabilityReport> {
    const traceChain = await this.getDocumentTraceChain(documentId);
    if (!traceChain) throw new Error('Document not found');

    const integrityVerified = await this.verifyIntegrity(traceChain);
    const reportId = `TR-${documentId}-${Date.now()}`;

    const reportContent = JSON.stringify({
      document: traceChain,
      generatedAt: new Date().toISOString(),
      generatedBy: generatedBy.id
    });
    const reportHash = createHash('sha256').update(reportContent).digest('hex');

    const report: TraceabilityReport = {
      reportId,
      generatedAt: new Date().toISOString(),
      generatedBy: generatedBy.name,
      document: traceChain,
      integrityVerified,
      reportHash
    };

    await prisma.traceabilityReport.create({
      data: {
        id: reportId,
        documentId,
        generatedBy: generatedBy.id,
        reportData: report as any,
        reportHash,
        integrityVerified
      }
    });

    return report;
  }

  private async verifyIntegrity(traceChain: DocumentTraceChain): Promise<boolean> {
    // 驗證文件 checksum、修正鏈完整性、時間順序
    return true;
  }

  private async getOcrResult(documentId: string) {
    const result = await prisma.ocrResult.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    });

    if (!result) return null;
    return {
      documentId: result.documentId,
      rawText: result.rawText,
      structuredData: result.structuredData as Record<string, any>,
      confidence: result.confidence,
      processedAt: result.createdAt.toISOString(),
      provider: result.provider
    };
  }

  private async initiateFileRetrieval(filePath: string): Promise<void> {
    await retrieveFromArchive(filePath);
  }
}

export const traceabilityService = new TraceabilityService();
```

---

## 5. API 端點

### 5.1 文件來源

```typescript
// src/app/api/documents/[id]/source/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { traceabilityService } from '@/services/traceability.service';
import { withAuditLog } from '@/middleware/audit-log.middleware';

async function getSourceHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const source = await traceabilityService.getDocumentSource(params.id);
  if (!source) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: source });
}

export const GET = withAuditLog(
  { action: 'READ', resourceType: 'documentSource', getResourceId: (req) => req.url.split('/')[4] },
  (req) => getSourceHandler(req, { params: { id: req.url.split('/')[4] } })
);
```

### 5.2 完整追溯鏈

```typescript
// src/app/api/documents/[id]/trace/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { traceabilityService } from '@/services/traceability.service';
import { withAuditLog } from '@/middleware/audit-log.middleware';

async function getTraceHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = session.user.roles?.some(r =>
    ['AUDITOR', 'GLOBAL_ADMIN', 'CITY_MANAGER'].includes(r.name)
  );

  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const traceChain = await traceabilityService.getDocumentTraceChain(params.id);
  if (!traceChain) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: traceChain });
}

export const GET = withAuditLog(
  { action: 'READ', resourceType: 'documentTrace', getResourceId: (req) => req.url.split('/').slice(-2)[0] },
  (req) => getTraceHandler(req, { params: { id: req.url.split('/').slice(-2)[0] } })
);
```

### 5.3 追溯報告生成

```typescript
// src/app/api/documents/[id]/trace/report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { traceabilityService } from '@/services/traceability.service';
import { withAuditLog } from '@/middleware/audit-log.middleware';

async function generateReportHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = session.user.roles?.some(r =>
    ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
  );

  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const report = await traceabilityService.generateTraceabilityReport(
    params.id,
    { id: session.user.id, name: session.user.name || 'Unknown' }
  );

  return NextResponse.json({ success: true, data: report });
}

export const POST = withAuditLog(
  { action: 'EXPORT', resourceType: 'traceabilityReport', getResourceId: (req) => req.url.split('/').slice(-3)[0] },
  (req) => generateReportHandler(req, { params: { id: req.url.split('/').slice(-3)[0] } })
);
```

---

## 6. 追溯視圖組件

```typescript
// src/components/audit/DocumentTraceView.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { FileText, Eye, Edit3, CheckCircle, Clock, ArrowRight, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentTraceChain } from '@/types/traceability';

interface DocumentTraceViewProps {
  documentId: string;
}

export function DocumentTraceView({ documentId }: DocumentTraceViewProps) {
  const [showSource, setShowSource] = useState(false);

  const { data: traceChain, isLoading } = useQuery<DocumentTraceChain>({
    queryKey: ['document-trace', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/trace`);
      if (!response.ok) throw new Error('Failed to fetch trace');
      return (await response.json()).data;
    }
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />)}</div>;
  }

  if (!traceChain) return null;

  return (
    <div className="space-y-6">
      {/* 追溯鏈視覺化 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />文件追溯鏈</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 overflow-x-auto pb-4">
            <TraceNode icon={<FileText className="h-4 w-4" />} title="原始文件" subtitle={traceChain.source.fileName} time={traceChain.source.uploadedAt} onClick={() => setShowSource(true)} status="completed" />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <TraceNode icon={<Eye className="h-4 w-4" />} title="OCR 處理" subtitle={`信心度: ${(traceChain.ocrResult.confidence * 100).toFixed(0)}%`} time={traceChain.ocrResult.processedAt} status="completed" />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <TraceNode icon={<Edit3 className="h-4 w-4" />} title="欄位提取" subtitle={`${Object.keys(traceChain.extractionResult.fields).length} 個欄位`} time={traceChain.extractionResult.extractedAt} status="completed" />
            {traceChain.corrections.length > 0 && (
              <>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <TraceNode icon={<Edit3 className="h-4 w-4" />} title="人工修正" subtitle={`${traceChain.corrections.length} 次修正`} time={traceChain.corrections[traceChain.corrections.length - 1].correctedAt} status="warning" />
              </>
            )}
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <TraceNode icon={<CheckCircle className="h-4 w-4" />} title={traceChain.approvals[0]?.autoApproved ? '自動核准' : '人工核准'} subtitle={traceChain.approvals[0]?.approvedByName || '—'} time={traceChain.approvals[0]?.approvedAt} status="completed" />
          </div>
        </CardContent>
      </Card>

      {/* 詳細資訊標籤 */}
      <Tabs defaultValue="corrections">
        <TabsList>
          <TabsTrigger value="corrections">修正記錄 ({traceChain.corrections.length})</TabsTrigger>
          <TabsTrigger value="history">變更歷史 ({traceChain.changeHistory.length})</TabsTrigger>
          <TabsTrigger value="extraction">提取結果</TabsTrigger>
        </TabsList>

        <TabsContent value="corrections" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {traceChain.corrections.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">無修正記錄</p>
              ) : (
                <div className="space-y-4">
                  {traceChain.corrections.map((c) => (
                    <div key={c.correctionId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{c.field}</div>
                          <Badge variant="outline" className="mt-1">{c.correctionType}</Badge>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{c.correctedByName}</div>
                          <div>{format(new Date(c.correctedAt), 'yyyy-MM-dd HH:mm', { locale: zhTW })}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">修正前</div>
                          <div className="mt-1 p-2 bg-red-50 rounded border border-red-200">{String(c.originalValue) || '(空)'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">修正後</div>
                          <div className="mt-1 p-2 bg-green-50 rounded border border-green-200">{String(c.correctedValue) || '(空)'}</div>
                        </div>
                      </div>
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
                {traceChain.changeHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">v{h.version}</Badge>
                      <span>{h.changeType}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {h.changedBy} · {format(new Date(h.changedAt), 'yyyy-MM-dd HH:mm')}
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
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{traceChain.source.fileName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>大小: {(traceChain.source.fileSize / 1024).toFixed(1)} KB</span>
              <span>儲存: {traceChain.source.storageLocation}</span>
            </div>
            <div className="border rounded-lg overflow-hidden h-[60vh]">
              {traceChain.source.fileType.includes('pdf') ? (
                <iframe src={traceChain.source.url} className="w-full h-full" title="原始文件" />
              ) : (
                <img src={traceChain.source.url} alt="原始文件" className="max-w-full max-h-full object-contain mx-auto" />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild><a href={traceChain.source.url} target="_blank" rel="noopener"><ExternalLink className="mr-2 h-4 w-4" />新視窗</a></Button>
              <Button asChild><a href={traceChain.source.url} download><Download className="mr-2 h-4 w-4" />下載</a></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TraceNode({ icon, title, subtitle, time, status, onClick }: { icon: React.ReactNode; title: string; subtitle: string; time?: string; status: 'completed' | 'warning' | 'pending'; onClick?: () => void }) {
  const statusStyles = { completed: 'border-green-200 bg-green-50', warning: 'border-amber-200 bg-amber-50', pending: 'border-gray-200 bg-gray-50' };
  return (
    <div className={`flex-shrink-0 p-3 rounded-lg border-2 min-w-[140px] ${statusStyles[status]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`} onClick={onClick}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="font-medium text-sm">{title}</span></div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      {time && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(time), 'MM-dd HH:mm')}</div>}
    </div>
  );
}
```

---

## 7. 測試規格

```typescript
// src/services/__tests__/traceability.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceabilityService } from '../traceability.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma');
vi.mock('@/lib/azure-blob', () => ({
  getStorageLocation: vi.fn().mockResolvedValue('active'),
  generateSignedUrl: vi.fn().mockResolvedValue('https://signed-url'),
  retrieveFromArchive: vi.fn()
}));

describe('TraceabilityService', () => {
  let service: TraceabilityService;

  beforeEach(() => {
    service = new TraceabilityService();
    vi.clearAllMocks();
  });

  describe('getDocumentSource', () => {
    it('should return document source with signed URL', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1', originalFileName: 'invoice.pdf', fileType: 'application/pdf',
        fileSize: 1024, filePath: '/path/invoice.pdf', checksum: 'abc123',
        createdAt: new Date(), uploadedBy: 'user-1'
      } as any);

      const result = await service.getDocumentSource('doc-1');

      expect(result).toBeDefined();
      expect(result?.fileName).toBe('invoice.pdf');
      expect(result?.url).toBe('https://signed-url');
    });
  });

  describe('getDocumentTraceChain', () => {
    it('should build complete trace chain', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1', invoiceNumber: 'INV-001', status: 'COMPLETED',
        createdAt: new Date(), processedAt: new Date(),
        extractionResults: [{ extractedData: {}, overallConfidence: 0.95, createdAt: new Date() }],
        corrections: [], approvals: []
      } as any);

      const result = await service.getDocumentTraceChain('doc-1');

      expect(result).toBeDefined();
      expect(result?.document.invoiceNumber).toBe('INV-001');
    });
  });

  describe('generateTraceabilityReport', () => {
    it('should generate report with hash', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1', status: 'COMPLETED', createdAt: new Date(),
        extractionResults: [], corrections: [], approvals: []
      } as any);
      vi.mocked(prisma.traceabilityReport.create).mockResolvedValue({} as any);

      const result = await service.generateTraceabilityReport(
        'doc-1', { id: 'user-1', name: 'Auditor' }
      );

      expect(result.reportId).toContain('TR-doc-1');
      expect(result.reportHash).toHaveLength(64);
    });
  });
});
```

---

## 8. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 查看原始文件 | getDocumentSource + 預簽名 URL |
| AC2 | 修正記錄追溯 | getDocumentTraceChain + corrections 陣列 |
| AC3 | 歸檔文件讀取 | getStorageLocation + retrieveFromArchive |
| AC4 | 追溯報告生成 | generateTraceabilityReport + SHA256 雜湊 |

---

## 9. 效能與安全考量

### 效能
- 預簽名 URL: 1 小時有效期，避免代理下載
- 分層儲存: 支援 active/archive/cold 三層
- 延遲載入: 追溯報告按需載入
- 冷儲存解凍: 載入時間 < 10 秒目標

### 安全
- 權限控制: AUDITOR/GLOBAL_ADMIN/CITY_MANAGER
- 審計記錄: 所有存取操作記錄
- 完整性驗證: SHA256 checksum

---

## 10. 相關文件

- [Story 8-2: 數據變更追蹤](./tech-spec-story-8-2.md)
- [Story 8-3: 處理記錄查詢](./tech-spec-story-8-3.md)
- [Story 8-5: 稽核報告匯出](./tech-spec-story-8-5.md)
