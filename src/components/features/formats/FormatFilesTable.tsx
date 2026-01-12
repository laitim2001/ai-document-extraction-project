'use client';

/**
 * @fileoverview 格式關聯文件表格組件
 * @description
 *   顯示與格式關聯的文件列表，支援分頁。
 *   點擊文件可跳轉到文件詳情頁。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Files,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useFormatFiles } from '@/hooks/use-format-files';

// ============================================================================
// Types
// ============================================================================

export interface FormatFilesTableProps {
  /** 格式 ID */
  formatId: string;
  /** 公司 ID */
  companyId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 獲取狀態標籤樣式
 */
function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
      return 'default';
    case 'PROCESSING':
    case 'PENDING':
      return 'secondary';
    case 'FAILED':
    case 'REJECTED':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * 獲取狀態顯示文字
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    UPLOADED: '已上傳',
    PROCESSING: '處理中',
    COMPLETED: '已完成',
    APPROVED: '已批准',
    FAILED: '失敗',
    REJECTED: '已拒絕',
    PENDING: '待處理',
  };
  return labels[status] || status;
}

/**
 * 格式化信心度
 */
function formatConfidence(confidence: number | null): string {
  if (confidence === null || confidence === undefined) {
    return '-';
  }
  return `${Math.round(confidence)}%`;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 載入骨架
 */
function FilesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * 格式關聯文件表格組件
 *
 * @description
 *   顯示與格式關聯的文件，支援：
 *   - 分頁顯示
 *   - 文件狀態顯示
 *   - 點擊跳轉到文件詳情
 *
 * @param props - 組件屬性
 */
export function FormatFilesTable({ formatId, companyId: _companyId }: FormatFilesTableProps) {
  const router = useRouter();
  const [page, setPage] = React.useState(1);

  const { files, isLoading, error, pagination, refetch } = useFormatFiles({
    formatId,
    page,
    limit: 10,
  });

  // --- 載入中 ---
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">關聯文件</CardTitle>
        </CardHeader>
        <CardContent>
          <FilesTableSkeleton />
        </CardContent>
      </Card>
    );
  }

  // --- 錯誤 ---
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2">載入失敗</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || '無法載入文件列表'}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重試
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- 空狀態 ---
  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Files className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">尚無關聯文件</h3>
          <p className="text-sm text-muted-foreground">
            上傳文件後，符合此格式的文件會自動關聯到這裡。
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleRowClick = (fileId: string) => {
    // 跳轉到文件詳情頁（假設路徑為 /documents/[id]）
    router.push(`/documents/${fileId}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          關聯文件
          <Badge variant="secondary" className="ml-2">
            {pagination.total}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>文件名稱</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>識別信心度</TableHead>
              <TableHead>上傳時間</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow
                key={file.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(file.id)}
              >
                <TableCell className="font-medium">
                  <span className="line-clamp-1">{file.originalName}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(file.status)}>
                    {getStatusLabel(file.status)}
                  </Badge>
                </TableCell>
                <TableCell>{formatConfidence(file.formatConfidence)}</TableCell>
                <TableCell>{formatDate(file.uploadedAt)}</TableCell>
                <TableCell>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* 分頁控制 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              第 {page} / {pagination.totalPages} 頁，共 {pagination.total} 個文件
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                上一頁
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                下一頁
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
