'use client';

/**
 * @fileoverview 映射預覽組件
 * @description
 *   顯示映射規則的轉換預覽：
 *   - 來源值 → 轉換後值 對照
 *   - 支援範例數據預覽
 *   - 顯示轉換錯誤和警告
 *   - 即時更新預覽
 *
 * @module src/components/features/mapping-config/MappingPreview
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 即時預覽轉換結果
 *   - 範例數據支援
 *   - 錯誤/警告提示
 *   - 刷新預覽功能
 *
 * @dependencies
 *   - @/components/ui/* - UI 組件
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import {
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type {
  VisualMappingRule,
  SourceFieldDefinition,
  TargetFieldDefinition,
} from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * 預覽行數據
 */
export interface PreviewRow {
  /** 行 ID */
  id: string;
  /** 來源欄位值（key: 欄位 ID, value: 值） */
  sourceValues: Record<string, string | number | null>;
  /** 轉換後的目標值（key: 欄位 ID, value: 值） */
  targetValues: Record<string, string | number | null>;
  /** 轉換狀態 */
  status: 'success' | 'warning' | 'error';
  /** 錯誤或警告訊息 */
  message?: string;
}

/**
 * MappingPreview 組件屬性
 */
export interface MappingPreviewProps {
  /** 映射規則列表 */
  rules: VisualMappingRule[];
  /** 來源欄位定義 */
  sourceFields: SourceFieldDefinition[];
  /** 目標欄位定義 */
  targetFields: TargetFieldDefinition[];
  /** 預覽數據行 */
  previewData: PreviewRow[];
  /** 是否正在載入 */
  isLoading?: boolean;
  /** 刷新預覽回調 */
  onRefresh?: () => void;
  /** 是否正在刷新 */
  isRefreshing?: boolean;
  /** 自訂類名 */
  className?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 狀態圖標映射
 */
const STATUS_ICONS = {
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
} as const;

/**
 * 狀態顏色映射
 */
const STATUS_COLORS = {
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * 取得欄位顯示名稱
 */
function getFieldDisplayName(
  fieldId: string,
  fields: Array<SourceFieldDefinition | TargetFieldDefinition>
): string {
  const field = fields.find((f) => f.id === fieldId);
  return field?.displayName ?? fieldId;
}

/**
 * 格式化值顯示
 */
function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '(空)';
  }
  if (typeof value === 'string' && value.trim() === '') {
    return '(空字串)';
  }
  return String(value);
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 預覽表格骨架
 */
function PreviewSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * 空狀態顯示
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Eye className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * 預覽統計
 */
function PreviewStats({ data }: { data: PreviewRow[] }) {
  const successCount = data.filter((r) => r.status === 'success').length;
  const warningCount = data.filter((r) => r.status === 'warning').length;
  const errorCount = data.filter((r) => r.status === 'error').length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span>{successCount} 成功</span>
      </div>
      {warningCount > 0 && (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span>{warningCount} 警告</span>
        </div>
      )}
      {errorCount > 0 && (
        <div className="flex items-center gap-1">
          <XCircle className="h-4 w-4 text-red-600" />
          <span>{errorCount} 錯誤</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * 映射預覽組件
 *
 * @description
 *   顯示映射規則的轉換預覽，包含來源值和轉換後值的對照表。
 *   支援顯示轉換狀態（成功/警告/錯誤）和刷新功能。
 *
 * @example
 * ```tsx
 * <MappingPreview
 *   rules={mappingRules}
 *   sourceFields={extractedFields}
 *   targetFields={systemFields}
 *   previewData={previewRows}
 *   onRefresh={handleRefreshPreview}
 * />
 * ```
 */
export function MappingPreview({
  rules,
  sourceFields,
  targetFields,
  previewData,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  className,
}: MappingPreviewProps) {
  // --- State ---
  const [showOnlyErrors, setShowOnlyErrors] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  // --- Derived State ---
  const activeRules = React.useMemo(
    () => rules.filter((r) => r.isActive),
    [rules]
  );

  const filteredData = React.useMemo(() => {
    if (!showOnlyErrors) return previewData;
    return previewData.filter((row) => row.status !== 'success');
  }, [previewData, showOnlyErrors]);

  // --- Handlers ---
  const toggleRowExpand = React.useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  // --- Render ---
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">預覽結果</CardTitle>
          <CardDescription>載入中...</CardDescription>
        </CardHeader>
        <CardContent>
          <PreviewSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (activeRules.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">預覽結果</CardTitle>
          <CardDescription>查看映射規則的轉換效果</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState message="請先新增映射規則以查看預覽" />
        </CardContent>
      </Card>
    );
  }

  if (previewData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">預覽結果</CardTitle>
            <CardDescription>查看映射規則的轉換效果</CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')}
              />
              載入預覽
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <EmptyState message="尚無預覽數據，請點擊「載入預覽」" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">預覽結果</CardTitle>
          <CardDescription>
            共 {previewData.length} 筆數據，套用 {activeRules.length} 條規則
          </CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <PreviewStats data={previewData} />
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')}
              />
              刷新
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 過濾選項 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-errors-only"
              checked={showOnlyErrors}
              onCheckedChange={setShowOnlyErrors}
            />
            <Label htmlFor="show-errors-only" className="text-sm">
              僅顯示警告和錯誤
            </Label>
          </div>
          {showOnlyErrors && filteredData.length === 0 && (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              所有轉換均成功
            </Badge>
          )}
        </div>

        {/* 預覽表格 */}
        {filteredData.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">狀態</TableHead>
                  <TableHead>來源欄位</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>目標欄位</TableHead>
                  <TableHead className="w-[100px]">訊息</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => {
                  const StatusIcon = STATUS_ICONS[row.status];
                  const isExpanded = expandedRows.has(row.id);

                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRowExpand(row.id)}
                      >
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <StatusIcon
                                  className={cn('h-4 w-4', STATUS_COLORS[row.status])}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                {row.status === 'success'
                                  ? '轉換成功'
                                  : row.status === 'warning'
                                    ? '轉換警告'
                                    : '轉換錯誤'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.sourceValues)
                              .slice(0, 2)
                              .map(([fieldId, value]) => (
                                <Badge key={fieldId} variant="secondary" className="font-mono text-xs">
                                  {getFieldDisplayName(fieldId, sourceFields)}:{' '}
                                  <span className="font-normal">{formatValue(value)}</span>
                                </Badge>
                              ))}
                            {Object.keys(row.sourceValues).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{Object.keys(row.sourceValues).length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.targetValues)
                              .slice(0, 2)
                              .map(([fieldId, value]) => (
                                <Badge key={fieldId} variant="default" className="font-mono text-xs">
                                  {getFieldDisplayName(fieldId, targetFields)}:{' '}
                                  <span className="font-normal">{formatValue(value)}</span>
                                </Badge>
                              ))}
                            {Object.keys(row.targetValues).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{Object.keys(row.targetValues).length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.message && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge
                                    variant={row.status === 'error' ? 'destructive' : 'outline'}
                                    className="text-xs truncate max-w-[80px]"
                                  >
                                    {row.message}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{row.message}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* 展開詳情 */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">來源欄位值</h4>
                                <div className="space-y-1">
                                  {Object.entries(row.sourceValues).map(([fieldId, value]) => (
                                    <div
                                      key={fieldId}
                                      className="flex justify-between text-sm"
                                    >
                                      <span className="text-muted-foreground">
                                        {getFieldDisplayName(fieldId, sourceFields)}
                                      </span>
                                      <span className="font-mono">{formatValue(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium mb-2">目標欄位值</h4>
                                <div className="space-y-1">
                                  {Object.entries(row.targetValues).map(([fieldId, value]) => (
                                    <div
                                      key={fieldId}
                                      className="flex justify-between text-sm"
                                    >
                                      <span className="text-muted-foreground">
                                        {getFieldDisplayName(fieldId, targetFields)}
                                      </span>
                                      <span className="font-mono">{formatValue(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
