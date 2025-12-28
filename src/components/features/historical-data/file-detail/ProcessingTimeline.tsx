/**
 * @fileoverview ProcessingTimeline - 處理流程時間軸
 * @description
 *   顯示文件處理過程的時間軸，包含：
 *   - 建立時間（createdAt）
 *   - 類型偵測時間（detectedAt）
 *   - 處理開始時間（processingStartAt）
 *   - 處理完成時間（processingEndAt）
 *
 * @module src/components/features/historical-data/file-detail/ProcessingTimeline
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { Upload, Search, Cpu, CheckCircle, XCircle, Clock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FileTimeline } from '@/hooks/use-historical-file-detail';

// ============================================================
// Types
// ============================================================

interface ProcessingTimelineProps {
  timeline: FileTimeline;
  status: string;
}

interface TimelineStep {
  icon: React.ElementType;
  label: string;
  time: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
  isFailed: boolean;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 格式化時間戳
 */
function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 計算處理時間差
 */
function calculateDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();

  if (diffMs < 1000) return `${diffMs}ms`;
  if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
  return `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
}

// ============================================================
// Component
// ============================================================

/**
 * @component ProcessingTimeline
 * @description 顯示處理流程時間軸的卡片組件
 */
export function ProcessingTimeline({ timeline, status }: ProcessingTimelineProps) {
  const isFailed = status === 'FAILED';
  const isProcessing = status === 'PROCESSING';
  const isCompleted = status === 'COMPLETED';

  // 使用正確的欄位名稱（對應 Prisma Schema）
  const steps: TimelineStep[] = [
    {
      icon: Upload,
      label: '建立',
      time: timeline.createdAt,
      isCompleted: !!timeline.createdAt,
      isCurrent: !timeline.detectedAt && !isFailed,
      isFailed: false,
    },
    {
      icon: Search,
      label: '類型偵測',
      time: timeline.detectedAt,
      isCompleted: !!timeline.detectedAt,
      isCurrent: !!timeline.detectedAt && !timeline.processingStartAt && !isFailed,
      isFailed: false,
    },
    {
      icon: Cpu,
      label: '處理中',
      time: timeline.processingStartAt,
      isCompleted: !!timeline.processingEndAt,
      isCurrent: isProcessing,
      isFailed: isFailed && !!timeline.processingStartAt,
    },
    {
      icon: isCompleted ? CheckCircle : isFailed ? XCircle : Clock,
      label: isCompleted ? '完成' : isFailed ? '失敗' : '等待中',
      time: timeline.processingEndAt,
      isCompleted: isCompleted,
      isCurrent: false,
      isFailed: isFailed,
    },
  ];

  // 計算總處理時間
  const totalDuration = calculateDuration(
    timeline.processingStartAt,
    timeline.processingEndAt
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">處理時間軸</CardTitle>
          {totalDuration && (
            <span className="text-sm text-muted-foreground">總耗時: {totalDuration}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-4 top-0 h-full w-0.5 bg-muted" />

          {/* Timeline Steps */}
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.label} className="relative flex items-start gap-4">
                {/* Step Icon */}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2',
                    step.isFailed
                      ? 'border-destructive bg-destructive text-destructive-foreground'
                      : step.isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : step.isCurrent
                          ? 'border-primary bg-background'
                          : 'border-muted bg-background'
                  )}
                >
                  <step.icon
                    className={cn(
                      'h-4 w-4',
                      step.isCurrent && !step.isCompleted && 'animate-pulse text-primary'
                    )}
                  />
                </div>

                {/* Step Content */}
                <div className="flex-1 pt-0.5">
                  <p
                    className={cn(
                      'font-medium',
                      step.isFailed && 'text-destructive',
                      !step.isCompleted && !step.isCurrent && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTimestamp(step.time)}
                  </p>

                  {/* Duration between steps */}
                  {index > 0 && step.time && steps[index - 1].time && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      (+{calculateDuration(steps[index - 1].time, step.time)})
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
