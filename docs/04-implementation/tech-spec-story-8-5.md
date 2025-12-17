# Tech Spec: Story 8-5 審計報告匯出

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 8.5 |
| Epic | Epic 8: 審計追溯與合規 |
| 優先級 | High |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| 依賴 | Story 8.1, 8.2, 8.3 |

## 1. 概述

### 1.1 目標
實現符合審計要求的報告匯出功能，支援多種格式、大量數據背景處理和報告完整性驗證。

### 1.2 用戶故事
**As a** 審計人員
**I want** 匯出符合審計要求的報告
**So that** 可以提供給內部或外部審計使用

### 1.3 範圍
- 報告配置選項（類型/欄位/格式）
- 多格式輸出（Excel/PDF/CSV/JSON）
- 大量數據背景處理
- 數位簽章與完整性驗證
- 報告下載追蹤

---

## 2. 數據庫模型

```prisma
model AuditReportJob {
  id              String             @id @default(cuid())
  reportType      AuditReportType
  outputFormat    ReportOutputFormat
  title           String
  queryParams     Json
  dateFrom        DateTime
  dateTo          DateTime
  cityIds         String[]
  forwarderIds    String[]
  includedFields  String[]
  includeChanges  Boolean            @default(true)
  includeFiles    Boolean            @default(true)
  status          ReportJobStatus    @default(PENDING)
  progress        Int                @default(0)
  totalRecords    Int?
  processedRecords Int               @default(0)
  fileUrl         String?
  fileSize        BigInt?
  checksum        String?
  digitalSignature String?
  errorMessage    String?
  errorDetails    Json?
  requestedById   String
  requestedBy     User               @relation(fields: [requestedById], references: [id])
  createdAt       DateTime           @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  expiresAt       DateTime?

  @@index([requestedById])
  @@index([status])
  @@index([createdAt])
  @@map("audit_report_jobs")
}

model AuditReportDownload {
  id             String          @id @default(cuid())
  reportJobId    String
  reportJob      AuditReportJob  @relation(fields: [reportJobId], references: [id])
  downloadedById String
  downloadedBy   User            @relation(fields: [downloadedById], references: [id])
  downloadedAt   DateTime        @default(now())
  ipAddress      String?
  userAgent      String?

  @@index([reportJobId])
  @@map("audit_report_downloads")
}

enum AuditReportType {
  PROCESSING_RECORDS
  CHANGE_HISTORY
  FULL_AUDIT
  COMPLIANCE_SUMMARY
}

enum ReportOutputFormat {
  EXCEL
  PDF
  CSV
  JSON
}

enum ReportJobStatus {
  PENDING
  QUEUED
  PROCESSING
  GENERATING
  SIGNING
  COMPLETED
  FAILED
  CANCELLED
  EXPIRED
}
```

---

## 3. 類型定義

```typescript
// src/types/audit-report.ts

export interface AuditReportConfig {
  reportType: AuditReportType;
  outputFormat: ReportOutputFormat;
  title: string;
  dateRange: { from: Date; to: Date };
  filters: {
    cityIds?: string[];
    forwarderIds?: string[];
    userIds?: string[];
    statuses?: string[];
  };
  includedFields: string[];
  includeChanges: boolean;
  includeFiles: boolean;
}

export interface AuditReportData {
  metadata: {
    title: string;
    reportType: AuditReportType;
    generatedAt: Date;
    dateRange: { from: Date; to: Date };
    filters: any;
  };
  processingRecords: any[];
  changeHistory: any[];
  fileList: any[];
}

export const LARGE_REPORT_THRESHOLD = 5000;
export const REPORT_EXPIRY_DAYS = 7;
```

---

## 4. 審計報告服務

```typescript
// src/services/audit-report.service.ts

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createHash, createSign } from 'crypto';
import { prisma } from '@/lib/prisma';
import { blobService } from '@/lib/azure-blob';
import { AuditReportConfig, AuditReportData, LARGE_REPORT_THRESHOLD, REPORT_EXPIRY_DAYS } from '@/types/audit-report';

export class AuditReportService {
  async createReportJob(
    config: AuditReportConfig,
    requestedById: string
  ): Promise<{ jobId: string; isAsync: boolean }> {
    const estimatedCount = await this.estimateRecordCount(config);
    const isAsync = estimatedCount > LARGE_REPORT_THRESHOLD;

    const job = await prisma.auditReportJob.create({
      data: {
        reportType: config.reportType,
        outputFormat: config.outputFormat,
        title: config.title,
        queryParams: config as any,
        dateFrom: config.dateRange.from,
        dateTo: config.dateRange.to,
        cityIds: config.filters.cityIds || [],
        forwarderIds: config.filters.forwarderIds || [],
        includedFields: config.includedFields,
        includeChanges: config.includeChanges,
        includeFiles: config.includeFiles,
        totalRecords: estimatedCount,
        status: isAsync ? 'QUEUED' : 'PROCESSING',
        requestedById,
        expiresAt: new Date(Date.now() + REPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    if (isAsync) {
      await this.queueReportGeneration(job.id);
    } else {
      await this.generateReport(job.id);
    }

    return { jobId: job.id, isAsync };
  }

  async generateReport(jobId: string): Promise<void> {
    const job = await prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { requestedBy: true }
    });

    try {
      await this.updateJobStatus(jobId, 'PROCESSING');
      const reportData = await this.collectReportData(job);

      await this.updateJobStatus(jobId, 'GENERATING');

      let fileBuffer: Buffer;
      let contentType: string;
      let fileExtension: string;

      switch (job.outputFormat) {
        case 'EXCEL':
          fileBuffer = await this.generateExcelReport(job, reportData);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'PDF':
          fileBuffer = await this.generatePdfReport(job, reportData);
          contentType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        case 'CSV':
          fileBuffer = await this.generateCsvReport(job, reportData);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'JSON':
          fileBuffer = await this.generateJsonReport(job, reportData);
          contentType = 'application/json';
          fileExtension = 'json';
          break;
        default:
          throw new Error(`Unsupported format: ${job.outputFormat}`);
      }

      const checksum = this.calculateChecksum(fileBuffer);
      await this.updateJobStatus(jobId, 'SIGNING');
      const digitalSignature = await this.generateDigitalSignature(fileBuffer);

      const fileName = `audit-reports/${jobId}/report_${Date.now()}.${fileExtension}`;
      const fileUrl = await blobService.uploadBuffer(fileBuffer, fileName, contentType);

      await prisma.auditReportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          processedRecords: job.totalRecords,
          fileUrl,
          fileSize: BigInt(fileBuffer.length),
          checksum,
          digitalSignature,
          completedAt: new Date()
        }
      });

    } catch (error) {
      await prisma.auditReportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  private async generateExcelReport(job: any, data: AuditReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Document Extraction System';
    workbook.created = new Date();

    // 封面
    const coverSheet = workbook.addWorksheet('封面');
    coverSheet.getCell('A1').value = job.title;
    coverSheet.getCell('A3').value = `報告類型: ${job.reportType}`;
    coverSheet.getCell('A4').value = `生成時間: ${new Date().toISOString()}`;
    coverSheet.getCell('A5').value = `時間範圍: ${job.dateFrom.toISOString()} - ${job.dateTo.toISOString()}`;

    // 處理記錄
    if (data.processingRecords.length > 0) {
      const recordsSheet = workbook.addWorksheet('處理記錄明細');
      recordsSheet.addRow(['時間戳', '用戶', '操作類型', '資源類型', '資源ID', 'IP地址', '結果']);
      data.processingRecords.forEach(r => {
        recordsSheet.addRow([
          r.timestamp?.toISOString(), r.user?.name || r.userId,
          r.actionType, r.resourceType, r.resourceId, r.ipAddress, r.success ? '成功' : '失敗'
        ]);
      });
    }

    // 變更歷史
    if (data.changeHistory.length > 0) {
      const changeSheet = workbook.addWorksheet('數據變更歷史');
      changeSheet.addRow(['時間', '變更人', '資源類型', '資源ID', '版本', '變更原因']);
      data.changeHistory.forEach(c => {
        changeSheet.addRow([
          c.createdAt?.toISOString(), c.changedBy?.name,
          c.resourceType, c.resourceId, c.version, c.changeReason
        ]);
      });
    }

    // 文件清單
    if (data.fileList.length > 0) {
      const fileSheet = workbook.addWorksheet('原始文件清單');
      fileSheet.addRow(['ID', '檔名', '狀態', '建立時間', '處理時間']);
      data.fileList.forEach(f => {
        fileSheet.addRow([f.id, f.originalFileName, f.status, f.createdAt?.toISOString(), f.processedAt?.toISOString()]);
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async generatePdfReport(job: any, data: AuditReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(24).text(job.title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`報告類型: ${job.reportType}`);
      doc.text(`生成時間: ${new Date().toISOString()}`);
      doc.text(`記錄總數: ${data.processingRecords.length + data.changeHistory.length}`);

      doc.end();
    });
  }

  private async generateCsvReport(job: any, data: AuditReportData): Promise<Buffer> {
    const rows: string[] = ['\ufeff'];
    rows.push(`# 審計報告: ${job.title}`);
    rows.push(`# 生成時間: ${new Date().toISOString()}`);
    rows.push('');

    if (data.processingRecords.length > 0) {
      rows.push('時間戳,用戶,操作類型,資源類型,資源ID,結果');
      data.processingRecords.forEach(r => {
        rows.push(`${r.timestamp?.toISOString()},"${r.user?.name}",${r.actionType},${r.resourceType},${r.resourceId},${r.success ? '成功' : '失敗'}`);
      });
    }

    return Buffer.from(rows.join('\n'), 'utf-8');
  }

  private async generateJsonReport(job: any, data: AuditReportData): Promise<Buffer> {
    return Buffer.from(JSON.stringify({
      metadata: { title: job.title, reportType: job.reportType, generatedAt: new Date().toISOString() },
      processingRecords: data.processingRecords,
      changeHistory: data.changeHistory,
      fileList: data.fileList
    }, null, 2), 'utf-8');
  }

  async verifyReportIntegrity(jobId: string, fileBuffer: Buffer): Promise<{
    isValid: boolean;
    details: { checksumMatch: boolean; signatureValid: boolean; originalChecksum: string; calculatedChecksum: string };
  }> {
    const job = await prisma.auditReportJob.findUniqueOrThrow({ where: { id: jobId } });
    const calculatedChecksum = this.calculateChecksum(fileBuffer);
    const checksumMatch = calculatedChecksum === job.checksum;

    let signatureValid = false;
    if (job.digitalSignature?.startsWith('hash:')) {
      signatureValid = checksumMatch;
    }

    return {
      isValid: checksumMatch && signatureValid,
      details: { checksumMatch, signatureValid, originalChecksum: job.checksum || '', calculatedChecksum }
    };
  }

  async downloadReport(jobId: string, userId: string, ipAddress?: string, userAgent?: string): Promise<{ url: string; fileName: string }> {
    const job = await prisma.auditReportJob.findUniqueOrThrow({ where: { id: jobId } });

    if (job.status !== 'COMPLETED') throw new Error('Report not ready');
    if (job.expiresAt && job.expiresAt < new Date()) throw new Error('Report expired');

    await prisma.auditReportDownload.create({
      data: { reportJobId: jobId, downloadedById: userId, ipAddress, userAgent }
    });

    const ext = { EXCEL: 'xlsx', PDF: 'pdf', CSV: 'csv', JSON: 'json' }[job.outputFormat];
    return { url: job.fileUrl!, fileName: `${job.title}_${job.dateFrom.toISOString().split('T')[0]}.${ext}` };
  }

  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async generateDigitalSignature(buffer: Buffer): Promise<string> {
    return `hash:${this.calculateChecksum(buffer)}`;
  }

  private async collectReportData(job: any): Promise<AuditReportData> {
    const data: AuditReportData = {
      metadata: { title: job.title, reportType: job.reportType, generatedAt: new Date(), dateRange: { from: job.dateFrom, to: job.dateTo }, filters: {} },
      processingRecords: [],
      changeHistory: [],
      fileList: []
    };

    if (job.reportType === 'PROCESSING_RECORDS' || job.reportType === 'FULL_AUDIT') {
      data.processingRecords = await prisma.auditLog.findMany({
        where: { createdAt: { gte: job.dateFrom, lte: job.dateTo } },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10000
      });
    }

    if (job.includeChanges && (job.reportType === 'CHANGE_HISTORY' || job.reportType === 'FULL_AUDIT')) {
      data.changeHistory = await prisma.dataChangeHistory.findMany({
        where: { createdAt: { gte: job.dateFrom, lte: job.dateTo } },
        orderBy: { createdAt: 'desc' },
        take: 10000
      });
    }

    if (job.includeFiles) {
      data.fileList = await prisma.document.findMany({
        where: { createdAt: { gte: job.dateFrom, lte: job.dateTo } },
        select: { id: true, originalFileName: true, status: true, createdAt: true, processedAt: true },
        take: 10000
      });
    }

    return data;
  }

  private async estimateRecordCount(config: AuditReportConfig): Promise<number> {
    return prisma.auditLog.count({
      where: { createdAt: { gte: config.dateRange.from, lte: config.dateRange.to } }
    });
  }

  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    await prisma.auditReportJob.update({ where: { id: jobId }, data: { status: status as any } });
  }

  private async queueReportGeneration(jobId: string): Promise<void> {
    setTimeout(() => this.generateReport(jobId), 100);
  }
}

export const auditReportService = new AuditReportService();
```

---

## 5. API 端點

### 5.1 建立報告任務

```typescript
// src/app/api/audit/reports/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { auditReportService } from '@/services/audit-report.service';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasAccess = session.user.roles?.some(r => ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name));
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const result = await auditReportService.createReportJob({
    ...body,
    dateRange: { from: new Date(body.dateRange.from), to: new Date(body.dateRange.to) }
  }, session.user.id);

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const [jobs, total] = await Promise.all([
    prisma.auditReportJob.findMany({
      where: { requestedById: session.user.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.auditReportJob.count({ where: { requestedById: session.user.id } })
  ]);

  return NextResponse.json({ items: jobs, pagination: { page, limit, total } });
}
```

### 5.2 下載報告

```typescript
// src/app/api/audit/reports/[jobId]/download/route.ts

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url, fileName } = await auditReportService.downloadReport(
    params.jobId, session.user.id,
    request.headers.get('x-forwarded-for') || undefined,
    request.headers.get('user-agent') || undefined
  );

  return NextResponse.json({ downloadUrl: url, fileName });
}
```

### 5.3 驗證完整性

```typescript
// src/app/api/audit/reports/[jobId]/verify/route.ts

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await auditReportService.verifyReportIntegrity(params.jobId, buffer);

  return NextResponse.json(result);
}
```

---

## 6. 測試規格

```typescript
// src/services/__tests__/audit-report.service.test.ts

describe('AuditReportService', () => {
  describe('createReportJob', () => {
    it('should create sync job for small reports (<5000)', async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(100);
      const result = await service.createReportJob(mockConfig, 'user-1');
      expect(result.isAsync).toBe(false);
    });

    it('should create async job for large reports (>5000)', async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(10000);
      const result = await service.createReportJob(mockConfig, 'user-1');
      expect(result.isAsync).toBe(true);
    });
  });

  describe('verifyReportIntegrity', () => {
    it('should return valid for matching checksum', async () => {
      const buffer = Buffer.from('test');
      const checksum = createHash('sha256').update(buffer).digest('hex');
      vi.mocked(prisma.auditReportJob.findUniqueOrThrow).mockResolvedValue({
        checksum, digitalSignature: `hash:${checksum}`
      } as any);

      const result = await service.verifyReportIntegrity('job-1', buffer);
      expect(result.isValid).toBe(true);
    });
  });
});
```

---

## 7. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 報告配置選項 | AuditReportExportDialog + 類型/格式/欄位選擇 |
| AC2 | 完整審計報告內容 | generateExcelReport 包含封面/目錄/明細 |
| AC3 | 大量數據背景處理 | LARGE_REPORT_THRESHOLD + 佇列處理 |
| AC4 | 報告完整性驗證 | SHA-256 checksum + verifyReportIntegrity |

---

## 8. 效能與安全考量

### 效能
- 大量數據背景處理（>5000 筆）
- 分批讀取減少記憶體壓力
- Blob Storage 存儲報告檔案

### 安全
- 報告下載完整追蹤
- SHA-256 數位簽章確保完整性
- 7 天過期機制
- 權限控制（AUDITOR/GLOBAL_ADMIN）

---

## 9. 相關文件

- [Story 8-3: 處理記錄查詢](./tech-spec-story-8-3.md)
- [Story 8-4: 原始文件追溯](./tech-spec-story-8-4.md)
- [Story 8-6: 長期數據保留](./tech-spec-story-8-6.md)
