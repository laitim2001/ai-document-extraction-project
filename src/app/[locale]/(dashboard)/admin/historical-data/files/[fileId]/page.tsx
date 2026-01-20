/**
 * @fileoverview Historical File Detail Page - 歷史文件詳情頁面
 * @description
 *   顯示單一歷史文件的完整詳情，包含：
 *   - 文件基本資訊卡片
 *   - 處理時間軸
 *   - 分頁顯示：提取結果、發行者識別、Line Items、原始 JSON
 *
 * @module src/app/(dashboard)/admin/historical-data/files/[fileId]
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHistoricalFileDetail } from '@/hooks/use-historical-file-detail';
import {
  FileInfoCard,
  ProcessingTimeline,
  ExtractionResultPanel,
  IssuerIdentificationPanel,
  LineItemsTable,
  RawJsonViewer,
} from '@/components/features/historical-data/file-detail';

// ============================================================
// Status Badge Styling
// ============================================================

const statusConfig: Record<string, { labelKey: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { labelKey: 'pending', variant: 'outline' },
  PROCESSING: { labelKey: 'processing', variant: 'secondary' },
  COMPLETED: { labelKey: 'completed', variant: 'default' },
  FAILED: { labelKey: 'failed', variant: 'destructive' },
  SKIPPED: { labelKey: 'skipped', variant: 'outline' },
};

// ============================================================
// Component
// ============================================================

/**
 * @component FileDetailPage
 * @description 歷史文件詳情頁面，整合所有詳情組件
 */
export default function FileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('historicalData');
  const fileId = params.fileId as string;

  const { data: file, isLoading, error } = useHistoricalFileDetail(fileId);

  // --- Handlers ---

  const handleBack = () => {
    // 導航回歷史數據頁面，並帶上 batchId 以便自動選中該批次
    if (file?.batch?.id) {
      router.push(`/admin/historical-data?batchId=${file.batch.id}`);
    } else {
      router.push('/admin/historical-data');
    }
  };

  // --- Loading State ---

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t('fileDetail.loading')}</p>
        </div>
      </div>
    );
  }

  // --- Error State ---

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <FileText className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">{t('fileDetail.loadFailed')}</h3>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : t('fileDetail.loadFailedDesc')}
            </p>
          </div>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('fileDetail.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  // --- Not Found State ---

  if (!file) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-muted p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">{t('fileDetail.notFound')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('fileDetail.notFoundDesc', { id: fileId })}
            </p>
          </div>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('fileDetail.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[file.status] || { labelKey: file.status.toLowerCase(), variant: 'outline' as const };

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{file.fileName}</h1>
            {file.batch && (
              <p className="text-sm text-muted-foreground">
                {t('fileDetail.batch')}: {file.batch.name || file.batch.id.substring(0, 8)}
              </p>
            )}
          </div>
        </div>
        <Badge variant={statusInfo.variant}>{t(`fileDetail.status.${statusInfo.labelKey}`)}</Badge>
      </div>

      {/* Info Cards Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <FileInfoCard file={file} />
        <ProcessingTimeline timeline={file.timeline} status={file.status} />
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="extraction" className="space-y-4">
        <TabsList>
          <TabsTrigger value="extraction">{t('fileDetail.tabs.extraction')}</TabsTrigger>
          <TabsTrigger value="issuer">{t('fileDetail.tabs.issuer')}</TabsTrigger>
          <TabsTrigger value="lineitems">{t('fileDetail.tabs.lineitems')}</TabsTrigger>
          <TabsTrigger value="raw">{t('fileDetail.tabs.raw')}</TabsTrigger>
        </TabsList>

        <TabsContent value="extraction">
          <ExtractionResultPanel extractionResult={file.extractionResult} />
        </TabsContent>

        <TabsContent value="issuer">
          <IssuerIdentificationPanel
            issuerIdentification={file.issuerIdentification}
            documentFormat={file.documentFormat}
            formatConfidence={file.formatConfidence}
          />
        </TabsContent>

        <TabsContent value="lineitems">
          <LineItemsTable extractionResult={file.extractionResult} />
        </TabsContent>

        <TabsContent value="raw">
          <RawJsonViewer data={file} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
