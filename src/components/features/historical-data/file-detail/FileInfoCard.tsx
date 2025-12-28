/**
 * @fileoverview FileInfoCard - 文件基本資訊卡片
 * @description
 *   顯示歷史文件的基本資訊，包含：
 *   - 文件名稱、大小、類型
 *   - 處理方法、處理成本
 *
 * @module src/components/features/historical-data/file-detail/FileInfoCard
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { FileText, HardDrive, Cpu, DollarSign, FolderOpen } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HistoricalFileDetail } from '@/hooks/use-historical-file-detail';

// ============================================================
// Types
// ============================================================

interface FileInfoCardProps {
  file: HistoricalFileDetail;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 格式化處理方法
 */
function formatProcessingMethod(method: string | null): string {
  if (!method) return '-';
  const methodMap: Record<string, string> = {
    GPT_VISION: 'GPT Vision',
    AZURE_DI: 'Azure DI',
    DUAL_PROCESSING: 'Dual Processing',
  };
  return methodMap[method] || method;
}

/**
 * 格式化處理成本
 */
function formatCost(cost: number | null): string {
  if (cost === null) return '-';
  return `$${cost.toFixed(4)}`;
}

/**
 * 格式化檔案類型
 */
function formatFileType(detectedType: string | null): string {
  if (!detectedType) return '-';
  return detectedType.toUpperCase();
}

// ============================================================
// Component
// ============================================================

/**
 * @component FileInfoCard
 * @description 顯示文件基本資訊的卡片組件
 */
export function FileInfoCard({ file }: FileInfoCardProps) {
  const infoItems = [
    {
      icon: FileText,
      label: '文件類型',
      value: formatFileType(file.detectedType),
    },
    {
      icon: HardDrive,
      label: '文件大小',
      value: formatFileSize(file.fileSize),
    },
    {
      icon: Cpu,
      label: '處理方法',
      value: formatProcessingMethod(file.processingMethod),
    },
    {
      icon: DollarSign,
      label: '處理成本',
      value: formatCost(file.actualCost),
    },
    {
      icon: FolderOpen,
      label: '原始名稱',
      value: file.originalName || file.fileName,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">文件資訊</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* MIME Type */}
        {file.mimeType && (
          <div className="mt-4 rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">MIME Type</p>
            <p className="mt-1 text-sm font-mono">{file.mimeType}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
