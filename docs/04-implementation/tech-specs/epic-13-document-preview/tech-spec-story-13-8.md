# Tech Spec: Story 13.8 - 發票詳情頁面

> **Version**: 1.0.0
> **Created**: 2026-01-18
> **Status**: Draft
> **Story Key**: STORY-13-8

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.8 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 13-1, 13-2（預覽組件）, Epic 8（審計日誌）, Epic 17（i18n） |
| **Blocking** | 無 |
| **FR Coverage** | FR3（發票處理追蹤）, FR9, FR10（審核相關功能） |

---

## Objective

建立發票詳情頁面 `/[locale]/(dashboard)/invoices/[id]/page.tsx`，整合 Epic 13 的 PDF 預覽組件和提取欄位面板，提供完整的發票查看體驗，支援：
- 完整的 PDF 預覽與欄位高亮
- 提取欄位面板與雙向聯動
- 處理步驟時間軸
- 審計日誌記錄
- 多語言支援

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-13.8.1 | 頁面導航與頭部 | InvoiceDetailHeader 組件 |
| AC-13.8.2 | 統計摘要卡片 | InvoiceDetailStats 組件（4 卡片） |
| AC-13.8.3 | 文件預覽 Tab | PreviewTab + DynamicPDFViewer |
| AC-13.8.4 | 提取欄位 Tab | FieldsTab + ExtractedFieldsPanel |
| AC-13.8.5 | 處理詳情 Tab | ProcessingTab + ProcessingTimeline |
| AC-13.8.6 | 審計日誌 Tab | AuditTab + InvoiceAuditLog |
| AC-13.8.7 | 狀態處理 | useInvoiceDetail Hook + 輪詢機制 |
| AC-13.8.8 | i18n 支援 | next-intl + 格式化工具 |

---

## Implementation Guide

### Phase 1: 頁面結構與路由 (2 points)

#### 1.1 頁面組件

```typescript
// src/app/[locale]/(dashboard)/invoices/[id]/page.tsx

/**
 * @fileoverview 發票詳情頁面
 * @module src/app/[locale]/(dashboard)/invoices/[id]
 * @since Epic 13 - Story 13.8
 */

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { InvoiceDetailHeader } from '@/components/features/invoice/InvoiceDetailHeader';
import { InvoiceDetailStats } from '@/components/features/invoice/InvoiceDetailStats';
import { InvoiceDetailTabs } from '@/components/features/invoice/InvoiceDetailTabs';
import { getDocument } from '@/services/document-service';

interface InvoiceDetailPageProps {
  params: {
    locale: string;
    id: string;
  };
}

export async function generateMetadata({ params }: InvoiceDetailPageProps) {
  const t = await getTranslations('invoices');
  return {
    title: t('detail.title'),
  };
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const document = await getDocument(params.id);

  if (!document) {
    notFound();
  }

  return (
    <div className="container py-6 space-y-6">
      <InvoiceDetailHeader document={document} />
      <InvoiceDetailStats document={document} />
      <InvoiceDetailTabs document={document} />
    </div>
  );
}
```

#### 1.2 Loading 狀態

```typescript
// src/app/[locale]/(dashboard)/invoices/[id]/loading.tsx

import { Skeleton } from '@/components/ui/skeleton';

export default function InvoiceDetailLoading() {
  return (
    <div className="container py-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      {/* Tabs Skeleton */}
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
```

### Phase 2: Header 與 Stats 組件 (2 points)

#### 2.1 InvoiceDetailHeader

```typescript
// src/components/features/invoice/InvoiceDetailHeader.tsx

/**
 * @fileoverview 發票詳情頁頭部組件
 * @module src/components/features/invoice
 * @since Epic 13 - Story 13.8
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProcessingStatus } from './ProcessingStatus';
import { Link } from '@/i18n/routing';
import type { DocumentWithRelations } from '@/types/document';

interface InvoiceDetailHeaderProps {
  document: DocumentWithRelations;
}

export function InvoiceDetailHeader({ document }: InvoiceDetailHeaderProps) {
  const t = useTranslations('invoices.detail');
  const router = useRouter();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await fetch(`/api/documents/${document.id}/retry`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDownload = async () => {
    const response = await fetch(`/api/documents/${document.id}/download`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = document.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canRetry = document.status === 'FAILED';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{document.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            {t('backToList')}
          </p>
        </div>
        <ProcessingStatus status={document.status} />
      </div>

      <div className="flex items-center gap-2">
        {canRetry && (
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isRetrying && 'animate-spin')} />
            {t('actions.retry')}
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

#### 2.2 InvoiceDetailStats

```typescript
// src/components/features/invoice/InvoiceDetailStats.tsx

/**
 * @fileoverview 發票詳情統計卡片組件
 * @module src/components/features/invoice
 * @since Epic 13 - Story 13.8
 */

'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Clock, Target, Upload, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ConfidenceBadge } from '@/components/features/confidence/ConfidenceBadge';
import { DocumentSourceBadge } from '@/components/features/document-source/DocumentSourceBadge';
import { formatRelativeTime } from '@/lib/i18n-date';
import type { DocumentWithRelations } from '@/types/document';

interface InvoiceDetailStatsProps {
  document: DocumentWithRelations;
}

export function InvoiceDetailStats({ document }: InvoiceDetailStatsProps) {
  const t = useTranslations('invoices.detail.stats');
  const locale = useLocale();

  const stats = [
    {
      title: t('status'),
      icon: Clock,
      value: getStatusText(document.status),
      subValue: document.processingDuration
        ? `耗時: ${formatDuration(document.processingDuration)}`
        : undefined,
    },
    {
      title: t('confidence'),
      icon: Target,
      value: document.confidence
        ? <ConfidenceBadge confidence={document.confidence} />
        : '-',
      subValue: getRouteDecisionText(document.routeDecision),
    },
    {
      title: t('uploadInfo'),
      icon: Upload,
      value: formatRelativeTime(document.createdAt, locale),
      subValue: document.uploadedBy?.name ?? document.uploadedBy?.email,
    },
    {
      title: t('source'),
      icon: FolderOpen,
      value: <DocumentSourceBadge source={document.source} />,
      subValue: undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <stat.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{stat.title}</span>
            </div>
            <div className="mt-2 text-2xl font-bold">{stat.value}</div>
            {stat.subValue && (
              <p className="mt-1 text-sm text-muted-foreground">
                {stat.subValue}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: '等待處理',
    PROCESSING: '處理中',
    COMPLETED: '已完成',
    FAILED: '失敗',
    WAITING_REVIEW: '待審核',
  };
  return statusMap[status] || status;
}

function getRouteDecisionText(decision?: string | null): string | undefined {
  if (!decision) return undefined;
  const decisionMap: Record<string, string> = {
    AUTO_APPROVE: '自動通過',
    QUICK_REVIEW: '快速審核',
    FULL_REVIEW: '完整審核',
  };
  return decisionMap[decision] || decision;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
```

### Phase 3: Tabs 組件 (3 points)

#### 3.1 InvoiceDetailTabs

```typescript
// src/components/features/invoice/InvoiceDetailTabs.tsx

/**
 * @fileoverview 發票詳情選項卡容器
 * @module src/components/features/invoice
 * @since Epic 13 - Story 13.8
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PreviewTab } from './tabs/PreviewTab';
import { FieldsTab } from './tabs/FieldsTab';
import { ProcessingTab } from './tabs/ProcessingTab';
import { AuditTab } from './tabs/AuditTab';
import type { DocumentWithRelations } from '@/types/document';

interface InvoiceDetailTabsProps {
  document: DocumentWithRelations;
}

export function InvoiceDetailTabs({ document }: InvoiceDetailTabsProps) {
  const t = useTranslations('invoices.detail.tabs');
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);

  return (
    <Tabs defaultValue="preview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="preview">{t('preview')}</TabsTrigger>
        <TabsTrigger value="fields">{t('fields')}</TabsTrigger>
        <TabsTrigger value="processing">{t('processing')}</TabsTrigger>
        <TabsTrigger value="audit">{t('audit')}</TabsTrigger>
      </TabsList>

      <TabsContent value="preview" className="mt-6">
        <PreviewTab
          document={document}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
        />
      </TabsContent>

      <TabsContent value="fields" className="mt-6">
        <FieldsTab
          document={document}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
        />
      </TabsContent>

      <TabsContent value="processing" className="mt-6">
        <ProcessingTab document={document} />
      </TabsContent>

      <TabsContent value="audit" className="mt-6">
        <AuditTab documentId={document.id} />
      </TabsContent>
    </Tabs>
  );
}
```

#### 3.2 PreviewTab

```typescript
// src/components/features/invoice/tabs/PreviewTab.tsx

/**
 * @fileoverview 文件預覽 Tab
 * @module src/components/features/invoice/tabs
 * @since Epic 13 - Story 13.8
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DynamicPDFViewer } from '@/components/features/document-preview/DynamicPDFViewer';
import { FieldHighlightOverlay } from '@/components/features/document-preview/FieldHighlightOverlay';
import { Card, CardContent } from '@/components/ui/card';
import { useExtractionFields } from '@/hooks/use-extraction-fields';
import type { DocumentWithRelations } from '@/types/document';

interface PreviewTabProps {
  document: DocumentWithRelations;
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string | null) => void;
}

export function PreviewTab({
  document,
  selectedFieldId,
  onFieldSelect,
}: PreviewTabProps) {
  const t = useTranslations('invoices.detail.empty');
  const { data: fields, isLoading } = useExtractionFields(document.id);

  const fileUrl = `/api/documents/${document.id}/download`;

  if (!document.fileUrl && !fileUrl) {
    return (
      <Card>
        <CardContent className="flex h-96 items-center justify-center">
          <p className="text-muted-foreground">{t('noPreview')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative min-h-[600px]">
          <DynamicPDFViewer
            file={fileUrl}
            boundingBoxes={fields?.map(transformToBoxes) ?? []}
            selectedFieldId={selectedFieldId}
            onFieldClick={onFieldSelect}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function transformToBoxes(field: ExtractionField) {
  return {
    fieldId: field.id,
    fieldName: field.name,
    page: field.page ?? 1,
    x: field.boundingBox?.x ?? 0,
    y: field.boundingBox?.y ?? 0,
    width: field.boundingBox?.width ?? 0,
    height: field.boundingBox?.height ?? 0,
    confidence: field.confidence ?? 0,
  };
}
```

#### 3.3 ProcessingTimeline

```typescript
// src/components/features/invoice/ProcessingTimeline.tsx

/**
 * @fileoverview 處理步驟時間軸組件
 * @module src/components/features/invoice
 * @since Epic 13 - Story 13.8
 */

'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDuration } from '@/lib/i18n-date';

interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

interface ProcessingTimelineProps {
  steps: ProcessingStep[];
  className?: string;
}

const statusIcons = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
};

const statusColors = {
  pending: 'text-muted-foreground',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

export function ProcessingTimeline({ steps, className }: ProcessingTimelineProps) {
  const t = useTranslations('invoices.detail.timeline');
  const locale = useLocale();

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <div className="relative">
        {/* 連接線 */}
        <div className="absolute left-4 top-0 h-full w-0.5 bg-muted" />

        {steps.map((step, index) => {
          const Icon = statusIcons[step.status];
          const colorClass = statusColors[step.status];
          const duration =
            step.startTime && step.endTime
              ? step.endTime.getTime() - step.startTime.getTime()
              : null;

          return (
            <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
              {/* 圖標 */}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background',
                  colorClass
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    step.status === 'in_progress' && 'animate-spin'
                  )}
                />
              </div>

              {/* 內容 */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{step.name}</p>
                  {duration !== null && (
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(duration)}
                    </span>
                  )}
                </div>
                {step.startTime && (
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(step.startTime, locale)}
                  </p>
                )}
                {step.error && (
                  <p className="text-sm text-red-500">{step.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Phase 4: Hook 與數據獲取 (1 point)

#### 4.1 useInvoiceDetail Hook

```typescript
// src/hooks/use-invoice-detail.ts

/**
 * @fileoverview 發票詳情數據獲取 Hook
 * @module src/hooks
 * @since Epic 13 - Story 13.8
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentWithRelations } from '@/types/document';

interface UseInvoiceDetailOptions {
  /** 是否啟用輪詢 */
  polling?: boolean;
  /** 輪詢間隔（毫秒） */
  pollingInterval?: number;
}

export function useInvoiceDetail(
  documentId: string,
  options: UseInvoiceDetailOptions = {}
) {
  const { polling = true, pollingInterval = 3000 } = options;
  const queryClient = useQueryClient();

  const query = useQuery<DocumentWithRelations>({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) throw new Error('Failed to fetch document');
      const data = await response.json();
      return data.data;
    },
    // 處理中狀態時啟用輪詢
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!polling) return false;
      if (data?.status === 'PROCESSING') return pollingInterval;
      return false;
    },
  });

  return {
    document: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useExtractionFields(documentId: string) {
  return useQuery({
    queryKey: ['extraction-fields', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/extraction/${documentId}/fields`);
      if (!response.ok) throw new Error('Failed to fetch fields');
      const data = await response.json();
      return data.data;
    },
  });
}

export function useProcessingTrace(documentId: string) {
  return useQuery({
    queryKey: ['processing-trace', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/trace`);
      if (!response.ok) throw new Error('Failed to fetch trace');
      const data = await response.json();
      return data.data;
    },
  });
}
```

---

## Project Structure

```
src/
├── app/
│   └── [locale]/
│       └── (dashboard)/
│           └── invoices/
│               └── [id]/
│                   ├── page.tsx           # 詳情頁面
│                   └── loading.tsx        # Loading 狀態
├── components/
│   └── features/
│       └── invoice/
│           ├── index.ts                   # 模組導出
│           ├── InvoiceDetailHeader.tsx    # 頭部組件
│           ├── InvoiceDetailStats.tsx     # 統計卡片
│           ├── InvoiceDetailTabs.tsx      # Tabs 容器
│           ├── ProcessingTimeline.tsx     # 處理時間軸
│           ├── InvoiceAuditLog.tsx        # 審計日誌
│           └── tabs/
│               ├── PreviewTab.tsx         # 預覽 Tab
│               ├── FieldsTab.tsx          # 欄位 Tab
│               ├── ProcessingTab.tsx      # 處理詳情 Tab
│               └── AuditTab.tsx           # 審計 Tab
├── hooks/
│   └── use-invoice-detail.ts              # 發票詳情 Hook
└── messages/
    ├── en/invoices.json                   # 英文翻譯
    ├── zh-TW/invoices.json                # 繁體中文翻譯
    └── zh-CN/invoices.json                # 简体中文翻译
```

---

## API Endpoints

### 依賴的現有 API

| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/documents/[id]` | GET | 文件詳情 |
| `/api/documents/[id]/download` | GET | 文件下載 |
| `/api/documents/[id]/retry` | POST | 重試處理 |
| `/api/documents/[id]/trace` | GET | 處理追蹤 |
| `/api/extraction/[id]/fields` | GET | 提取欄位 |
| `/api/confidence/[id]` | GET | 信心度詳情 |
| `/api/audit-logs` | GET | 審計日誌查詢 |

---

## i18n Keys

```json
// messages/{locale}/invoices.json
{
  "detail": {
    "title": "發票詳情",
    "backToList": "返回列表",
    "tabs": {
      "preview": "文件預覽",
      "fields": "提取欄位",
      "processing": "處理詳情",
      "audit": "審計日誌"
    },
    "stats": {
      "status": "處理狀態",
      "confidence": "信心度",
      "uploadInfo": "上傳資訊",
      "source": "來源"
    },
    "timeline": {
      "title": "處理時間軸",
      "step": "步驟",
      "duration": "耗時",
      "status": "狀態"
    },
    "actions": {
      "retry": "重試",
      "download": "下載",
      "delete": "刪除"
    },
    "empty": {
      "noPreview": "無法預覽此文件",
      "noFields": "尚無提取欄位"
    },
    "status": {
      "pending": "等待處理",
      "processing": "處理中",
      "completed": "已完成",
      "failed": "失敗",
      "waitingReview": "待審核"
    },
    "routeDecision": {
      "autoApprove": "自動通過",
      "quickReview": "快速審核",
      "fullReview": "完整審核"
    }
  }
}
```

---

## Verification Checklist

### 功能驗證

- [ ] 從列表頁點擊可進入詳情頁
- [ ] 返回按鈕可回到列表頁
- [ ] 文件名稱和狀態正確顯示
- [ ] 4 張統計卡片數據正確
- [ ] PDF 預覽正常（支援翻頁、縮放）
- [ ] 欄位高亮正確顯示
- [ ] 點擊高亮可與欄位面板聯動
- [ ] 提取欄位面板功能正常
- [ ] 處理時間軸正確顯示
- [ ] 審計日誌正確載入
- [ ] 處理中狀態有輪詢更新
- [ ] 失敗狀態可重試

### i18n 驗證

- [ ] 英文翻譯完整
- [ ] 繁體中文翻譯完整
- [ ] 简体中文翻译完整
- [ ] 日期格式化正確
- [ ] 數字格式化正確

### 效能驗證

- [ ] 頁面初始載入 < 3 秒
- [ ] PDF 預覽載入 < 2 秒
- [ ] Tab 切換 < 100ms

### 無障礙驗證

- [ ] 鍵盤可完整操作
- [ ] 顏色對比符合 WCAG 2.1 AA

---

## Risk Mitigation

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| PDF 預覽組件不相容 | 低 | 中 | 使用已驗證的 DynamicPDFViewer |
| 大型 PDF 載入慢 | 中 | 中 | 實現漸進式載入 |
| 輪詢造成性能問題 | 低 | 中 | 限制輪詢僅在處理中狀態 |
| i18n 翻譯遺漏 | 中 | 低 | 使用翻譯檢查工具 |

---

*Tech Spec 建立日期: 2026-01-18*
*狀態: Draft*
