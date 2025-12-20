/**
 * @fileoverview 歷史版本比較對話框組件
 * @description
 *   用於比較資源的兩個歷史版本，顯示欄位級別的差異。
 *   支援：
 *   - 欄位差異高亮顯示
 *   - 新增/刪除/修改標記
 *   - 版本資訊展示
 *
 * @module src/components/features/history/HistoryVersionCompareDialog
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 *   - @/types/change-tracking - 變更追蹤類型
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Plus,
  Minus,
  Pencil,
  ArrowRight,
  User,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type {
  VersionCompareResult,
  FieldDiff,
  TrackedModel,
} from '@/types/change-tracking';

// ============================================================
// Types
// ============================================================

interface HistoryVersionCompareDialogProps {
  /** 資源類型 */
  resourceType: TrackedModel;
  /** 資源 ID */
  resourceId: string;
  /** 是否開啟對話框 */
  open: boolean;
  /** 對話框開關狀態變更處理 */
  onOpenChange: (open: boolean) => void;
  /** 比較結果數據 */
  compareData?: VersionCompareResult | null;
  /** 是否正在載入 */
  isLoading?: boolean;
  /** 錯誤訊息 */
  error?: Error | null;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取差異類型圖標
 */
function getDiffTypeIcon(type: FieldDiff['type']) {
  switch (type) {
    case 'added':
      return <Plus className="h-4 w-4 text-green-500" />;
    case 'removed':
      return <Minus className="h-4 w-4 text-red-500" />;
    case 'modified':
      return <Pencil className="h-4 w-4 text-blue-500" />;
  }
}

/**
 * 獲取差異類型標籤
 */
function getDiffTypeLabel(type: FieldDiff['type']) {
  switch (type) {
    case 'added':
      return '新增';
    case 'removed':
      return '刪除';
    case 'modified':
      return '修改';
  }
}

/**
 * 獲取差異類型顏色
 */
function getDiffTypeBadgeVariant(type: FieldDiff['type']) {
  switch (type) {
    case 'added':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'removed':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    case 'modified':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  }
}

/**
 * 格式化值用於顯示
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '(空)';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value);
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 版本資訊卡片
 */
function VersionInfoCard({
  title,
  version,
  changedByName,
  timestamp,
  changeReason,
}: {
  title: string;
  version: number;
  changedByName: string;
  timestamp: Date;
  changeReason: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {title}
          <Badge variant="outline">版本 {version}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span>{changedByName}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {format(new Date(timestamp), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
          </span>
        </div>
        {changeReason && (
          <p className="text-muted-foreground line-clamp-2">{changeReason}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 差異表格行
 */
function DiffTableRow({ diff }: { diff: FieldDiff }) {
  const isLongValue =
    formatValue(diff.oldValue).length > 50 ||
    formatValue(diff.newValue).length > 50;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {getDiffTypeIcon(diff.type)}
          <code className="text-sm">{diff.field}</code>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={getDiffTypeBadgeVariant(diff.type)}>
          {getDiffTypeLabel(diff.type)}
        </Badge>
      </TableCell>
      <TableCell className={diff.type === 'added' ? 'text-muted-foreground' : ''}>
        {diff.type !== 'added' && (
          <div className={`${isLongValue ? 'max-h-20 overflow-auto' : ''}`}>
            <pre className="text-xs whitespace-pre-wrap break-all bg-muted p-2 rounded">
              {formatValue(diff.oldValue)}
            </pre>
          </div>
        )}
        {diff.type === 'added' && <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-center">
        <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
      </TableCell>
      <TableCell className={diff.type === 'removed' ? 'text-muted-foreground' : ''}>
        {diff.type !== 'removed' && (
          <div className={`${isLongValue ? 'max-h-20 overflow-auto' : ''}`}>
            <pre className="text-xs whitespace-pre-wrap break-all bg-muted p-2 rounded">
              {formatValue(diff.newValue)}
            </pre>
          </div>
        )}
        {diff.type === 'removed' && <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}

/**
 * 載入骨架
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * 歷史版本比較對話框
 *
 * @description
 *   顯示兩個歷史版本之間的欄位級別差異。
 *   包含版本資訊卡片和差異表格。
 *
 * @example
 * ```tsx
 * <HistoryVersionCompareDialog
 *   resourceType="mappingRule"
 *   resourceId="rule-123"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   compareData={compareResult}
 *   isLoading={isLoading}
 *   error={error}
 * />
 * ```
 */
export function HistoryVersionCompareDialog({
  resourceType,
  resourceId,
  open,
  onOpenChange,
  compareData,
  isLoading = false,
  error = null,
}: HistoryVersionCompareDialogProps) {
  /**
   * 渲染載入狀態
   */
  const renderLoading = () => <LoadingSkeleton />;

  /**
   * 渲染錯誤狀態
   */
  const renderError = () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>載入失敗</AlertTitle>
      <AlertDescription>
        {error?.message || '無法載入版本比較數據'}
      </AlertDescription>
    </Alert>
  );

  /**
   * 渲染空差異狀態
   */
  const renderNoDiffs = () => (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">兩個版本之間沒有差異</p>
    </div>
  );

  /**
   * 渲染內容
   */
  const renderContent = () => {
    if (isLoading) return renderLoading();
    if (error) return renderError();
    if (!compareData) return null;

    const { fromVersion, toVersion, diffs, fromSnapshot, toSnapshot } = compareData;

    return (
      <div className="space-y-6">
        {/* 版本資訊卡片 */}
        <div className="grid grid-cols-2 gap-4">
          <VersionInfoCard
            title="舊版本"
            version={fromVersion}
            changedByName={fromSnapshot.changedByName}
            timestamp={fromSnapshot.timestamp}
            changeReason={fromSnapshot.changeReason}
          />
          <VersionInfoCard
            title="新版本"
            version={toVersion}
            changedByName={toSnapshot.changedByName}
            timestamp={toSnapshot.timestamp}
            changeReason={toSnapshot.changeReason}
          />
        </div>

        {/* 差異摘要 */}
        <div className="flex items-center gap-4">
          <h4 className="font-medium">欄位差異</h4>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              新增: {diffs.filter((d) => d.type === 'added').length}
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              修改: {diffs.filter((d) => d.type === 'modified').length}
            </Badge>
            <Badge variant="secondary" className="bg-red-100 text-red-700">
              刪除: {diffs.filter((d) => d.type === 'removed').length}
            </Badge>
          </div>
        </div>

        {/* 差異表格 */}
        {diffs.length === 0 ? (
          renderNoDiffs()
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">欄位名稱</TableHead>
                  <TableHead className="w-[80px]">類型</TableHead>
                  <TableHead>舊值</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>新值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffs.map((diff, index) => (
                  <DiffTableRow key={`${diff.field}-${index}`} diff={diff} />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>版本比較</DialogTitle>
          <DialogDescription>
            比較 {resourceType}/{resourceId} 的兩個版本之間的差異
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
