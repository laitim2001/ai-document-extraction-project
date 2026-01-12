'use client';

/**
 * @fileoverview 格式詳情視圖組件
 * @description
 *   顯示格式的完整資訊，包含：
 *   - 基本資訊 Tab（格式名稱、類型、特徵）
 *   - 常見術語 Tab（術語列表）
 *   - 文件列表 Tab（關聯文件）
 *   - 識別規則 Tab（Story 16.3）
 *   支援編輯格式名稱。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, FileText, RefreshCw, AlertCircle, ScanSearch } from 'lucide-react';
import { useFormatDetail } from '@/hooks/use-format-detail';
import { FormatBasicInfo } from './FormatBasicInfo';
import { FormatTermsTable } from './FormatTermsTable';
import { FormatFilesTable } from './FormatFilesTable';
import { FormatForm } from './FormatForm';
import { IdentificationRulesEditor } from './IdentificationRulesEditor';
import {
  DOCUMENT_TYPE_LABELS_ZH,
  DOCUMENT_SUBTYPE_LABELS_ZH,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface FormatDetailViewProps {
  /** 公司 ID */
  companyId: string;
  /** 格式 ID */
  formatId: string;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 載入骨架屏
 */
function FormatDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 標題骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Tabs 骨架 */}
      <Skeleton className="h-10 w-80" />
      {/* 內容骨架 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

/**
 * 錯誤顯示
 */
function FormatDetailError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">無法載入格式資料</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {error.message || '載入格式詳情時發生錯誤，請稍後再試。'}
      </p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        重試
      </Button>
    </div>
  );
}

/**
 * 404 顯示
 */
function FormatNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">找不到格式</h2>
      <p className="text-sm text-muted-foreground mb-4">
        該格式可能已被刪除或您沒有權限存取。
      </p>
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 格式詳情視圖組件
 *
 * @description
 *   顯示格式的完整資訊，包含 Tabs 導航：
 *   - 基本資訊
 *   - 常見術語
 *   - 文件列表
 *
 * @param props - 組件屬性
 */
export function FormatDetailView({ companyId, formatId }: FormatDetailViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);

  const { format, isLoading, error, refetch } = useFormatDetail(formatId);

  // --- Handlers ---
  const handleBack = React.useCallback(() => {
    router.push(`/companies/${companyId}?tab=formats`);
  }, [router, companyId]);

  const handleEditSuccess = React.useCallback(() => {
    setIsEditing(false);
    refetch();
  }, [refetch]);

  // --- 載入中 ---
  if (isLoading) {
    return <FormatDetailSkeleton />;
  }

  // --- 錯誤 ---
  if (error) {
    return <FormatDetailError error={error} onRetry={refetch} />;
  }

  // --- 找不到 ---
  if (!format) {
    return <FormatNotFound onBack={handleBack} />;
  }

  // --- 計算顯示值 ---
  const displayName =
    format.name ||
    `${DOCUMENT_SUBTYPE_LABELS_ZH[format.documentSubtype]} ${DOCUMENT_TYPE_LABELS_ZH[format.documentType]}`;
  const typeLabel = DOCUMENT_TYPE_LABELS_ZH[format.documentType];
  const subtypeLabel = DOCUMENT_SUBTYPE_LABELS_ZH[format.documentSubtype];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{displayName}</h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{typeLabel}</Badge>
                <Badge variant="secondary">{subtypeLabel}</Badge>
                <span className="text-sm text-muted-foreground">
                  {format.company.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重新整理
          </Button>
          <Button size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            編輯
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">基本資訊</TabsTrigger>
          <TabsTrigger value="terms">
            常見術語
            {format.commonTerms.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {format.commonTerms.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="files">
            文件列表
            <Badge variant="secondary" className="ml-2">
              {format.fileCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ScanSearch className="h-4 w-4 mr-1" />
            識別規則
          </TabsTrigger>
          {/* Story 16-4: <TabsTrigger value="configs">專屬配置</TabsTrigger> */}
        </TabsList>

        <TabsContent value="basic">
          <FormatBasicInfo format={format} />
        </TabsContent>

        <TabsContent value="terms">
          <FormatTermsTable terms={format.commonTerms} />
        </TabsContent>

        <TabsContent value="files">
          <FormatFilesTable formatId={formatId} companyId={companyId} />
        </TabsContent>

        <TabsContent value="rules">
          <IdentificationRulesEditor
            formatId={formatId}
            initialRules={format.identificationRules}
            onSuccess={refetch}
          />
        </TabsContent>
      </Tabs>

      {/* 編輯 Dialog */}
      {isEditing && (
        <FormatForm
          format={format}
          open={isEditing}
          onClose={() => setIsEditing(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
