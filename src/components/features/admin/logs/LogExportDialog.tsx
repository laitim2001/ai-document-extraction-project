'use client';

/**
 * @fileoverview 日誌匯出對話框組件
 * @description
 *   提供日誌匯出功能的對話框，支援：
 *   - 選擇匯出格式（CSV、JSON、TXT）
 *   - 設定時間範圍
 *   - 套用篩選條件
 *   - 追蹤匯出進度
 *
 * @module src/components/features/admin/logs/LogExportDialog
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  useCreateLogExport,
  useExportStatus,
  LogListFilters,
} from '@/hooks/use-logs';
import { LogExportFormat } from '@prisma/client';
import { Download, FileText, FileJson, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// Types
// ============================================================

interface LogExportDialogProps {
  open: boolean;
  onClose: () => void;
  filters?: LogListFilters;
}

// ============================================================
// Constants
// ============================================================

const FORMAT_OPTIONS: { value: LogExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'CSV',
    label: 'CSV',
    icon: <FileText className="h-5 w-5" />,
    description: '適合 Excel 或試算表應用程式',
  },
  {
    value: 'JSON',
    label: 'JSON',
    icon: <FileJson className="h-5 w-5" />,
    description: '適合程式處理和資料分析',
  },
  {
    value: 'TXT',
    label: '純文字',
    icon: <File className="h-5 w-5" />,
    description: '易於閱讀的純文字格式',
  },
];

// ============================================================
// Component
// ============================================================

/**
 * @component LogExportDialog
 * @description 日誌匯出對話框
 */
export function LogExportDialog({ open, onClose, filters }: LogExportDialogProps) {
  const { toast } = useToast();

  // --- State ---
  const [format, setFormat] = useState<LogExportFormat>('CSV');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportId, setExportId] = useState<string | null>(null);

  // --- State for polling control ---
  const [shouldPoll, setShouldPoll] = useState(false);

  // --- Mutations & Queries ---
  const createExport = useCreateLogExport();
  const { data: exportStatus } = useExportStatus(
    exportId,
    shouldPoll
  );

  // --- Update polling state based on export status ---
  useEffect(() => {
    if (exportId !== null) {
      const isTerminal = exportStatus?.status === 'COMPLETED' || exportStatus?.status === 'FAILED';
      setShouldPoll(!isTerminal);
    } else {
      setShouldPoll(false);
    }
  }, [exportId, exportStatus?.status]);

  // --- Effects ---
  useEffect(() => {
    if (!open) {
      // 重置狀態
      setExportId(null);
      setStartDate('');
      setEndDate('');
    } else {
      // 設定預設時間範圍（過去 7 天）
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setEndDate(now.toISOString().slice(0, 16));
      setStartDate(weekAgo.toISOString().slice(0, 16));
    }
  }, [open]);

  // --- Handlers ---
  const handleExport = async () => {
    try {
      const result = await createExport.mutateAsync({
        format,
        filters: {
          timeRange: startDate && endDate
            ? {
                start: new Date(startDate),
                end: new Date(endDate),
              }
            : undefined,
          levels: filters?.levels,
          sources: filters?.sources,
          keyword: filters?.keyword,
          correlationId: filters?.correlationId,
          userId: filters?.userId,
          errorCode: filters?.errorCode,
        },
      });

      setExportId(result.id);
      toast({
        title: '匯出任務已建立',
        description: '正在處理匯出請求...',
      });
    } catch (error) {
      toast({
        title: '匯出失敗',
        description: error instanceof Error ? error.message : '無法建立匯出任務',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    if (exportStatus?.downloadUrl) {
      window.open(exportStatus.downloadUrl, '_blank');
    }
    onClose();
  };

  // --- Render ---
  const isExporting = exportId !== null;
  const isCompleted = exportStatus?.status === 'COMPLETED';
  const isFailed = exportStatus?.status === 'FAILED';
  const progress = exportStatus?.progress || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>匯出日誌</DialogTitle>
          <DialogDescription>
            選擇匯出格式和時間範圍，系統將產生可下載的檔案
          </DialogDescription>
        </DialogHeader>

        {!isExporting ? (
          <div className="space-y-6 py-4">
            {/* 格式選擇 */}
            <div className="space-y-3">
              <Label>匯出格式</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as LogExportFormat)}
                className="grid gap-3"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      format === option.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={option.value} />
                    <div className="text-muted-foreground">{option.icon}</div>
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* 時間範圍 */}
            <div className="space-y-3">
              <Label>時間範圍</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                    開始時間
                  </Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                    結束時間
                  </Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 篩選條件提示 */}
            {filters && (filters.levels?.length || filters.sources?.length || filters.keyword) && (
              <Alert>
                <AlertTitle>已套用篩選條件</AlertTitle>
                <AlertDescription className="text-sm">
                  {filters.levels?.length && `級別: ${filters.levels.join(', ')} `}
                  {filters.sources?.length && `來源: ${filters.sources.join(', ')} `}
                  {filters.keyword && `關鍵字: ${filters.keyword}`}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="py-8 space-y-6">
            {/* 匯出進度 */}
            {!isCompleted && !isFailed && (
              <div className="space-y-4 text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <div>
                  <p className="font-medium">正在匯出...</p>
                  <p className="text-sm text-muted-foreground">
                    {exportStatus?.processedRecords !== undefined &&
                    exportStatus?.totalRecords !== undefined
                      ? `已處理 ${exportStatus.processedRecords} / ${exportStatus.totalRecords} 筆`
                      : '準備中...'}
                  </p>
                </div>
                <Progress value={progress} className="max-w-xs mx-auto" />
              </div>
            )}

            {/* 完成狀態 */}
            {isCompleted && (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <div>
                  <p className="font-medium">匯出完成</p>
                  <p className="text-sm text-muted-foreground">
                    {exportStatus.totalRecords?.toLocaleString()} 筆日誌
                    {exportStatus.fileSize && ` (${(exportStatus.fileSize / 1024).toFixed(1)} KB)`}
                  </p>
                </div>
              </div>
            )}

            {/* 失敗狀態 */}
            {isFailed && (
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
                <div>
                  <p className="font-medium">匯出失敗</p>
                  <p className="text-sm text-muted-foreground">
                    {exportStatus.error || '發生未知錯誤'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isExporting && isCompleted ? '關閉' : '取消'}
          </Button>
          {!isExporting ? (
            <Button onClick={handleExport} disabled={createExport.isPending}>
              {createExport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  建立中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  開始匯出
                </>
              )}
            </Button>
          ) : isCompleted && exportStatus?.downloadUrl ? (
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              下載檔案
            </Button>
          ) : isFailed ? (
            <Button onClick={() => setExportId(null)}>重試</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
