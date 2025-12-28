/**
 * @fileoverview IssuerIdentificationPanel - 發行者識別面板
 * @description
 *   顯示文件發行者識別結果，包含：
 *   - 識別方法（HEADER/LOGO）
 *   - 識別信心度
 *   - 匹配的公司資訊
 *   - 文件格式資訊
 *
 * @module src/components/features/historical-data/file-detail/IssuerIdentificationPanel
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { Building2, Fingerprint, FileType, Percent, FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { IssuerIdentification, DocumentFormatInfo } from '@/hooks/use-historical-file-detail';

// ============================================================
// Types
// ============================================================

interface IssuerIdentificationPanelProps {
  issuerIdentification: IssuerIdentification;
  documentFormat: DocumentFormatInfo | null;
  formatConfidence: number | null;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 格式化識別方法
 */
function formatIdentificationMethod(method: string | null): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (!method) return { label: '未識別', variant: 'outline' };
  const methodMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    HEADER: { label: 'Header 識別', variant: 'default' },
    LOGO: { label: 'Logo 識別', variant: 'secondary' },
    MANUAL: { label: '手動設定', variant: 'outline' },
  };
  return methodMap[method] || { label: method, variant: 'outline' };
}

/**
 * 格式化信心度為百分比字串
 */
function formatConfidenceValue(confidence: number | null): string {
  if (confidence === null) return '-';
  return `${(confidence * 100).toFixed(1)}%`;
}

/**
 * 獲取信心度樣式
 */
function getConfidenceVariant(confidence: number | null): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (confidence === null) return 'outline';
  if (confidence >= 0.9) return 'default';
  if (confidence >= 0.7) return 'secondary';
  return 'destructive';
}

// ============================================================
// Component
// ============================================================

/**
 * @component IssuerIdentificationPanel
 * @description 顯示發行者識別結果的面板組件
 */
export function IssuerIdentificationPanel({
  issuerIdentification,
  documentFormat,
  formatConfidence,
}: IssuerIdentificationPanelProps) {
  const { method, confidence, matchedCompany } = issuerIdentification;
  const methodInfo = formatIdentificationMethod(method);

  const hasCompany = !!matchedCompany;
  const hasFormat = !!documentFormat;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">發行者識別</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={methodInfo.variant}>
              <Fingerprint className="mr-1 h-3 w-3" />
              {methodInfo.label}
            </Badge>
            {confidence !== null && (
              <Badge variant={getConfidenceVariant(confidence)}>
                <Percent className="mr-1 h-3 w-3" />
                {formatConfidenceValue(confidence)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasCompany && !hasFormat ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <p>無發行者識別資訊</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Matched Company */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                匹配公司
              </h4>
              {hasCompany ? (
                <div className="rounded-lg border p-4">
                  <p className="font-medium">{matchedCompany.name}</p>
                  {matchedCompany.displayName && matchedCompany.displayName !== matchedCompany.name && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {matchedCompany.displayName}
                    </p>
                  )}
                  {matchedCompany.code && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      代碼: {matchedCompany.code}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    ID: {matchedCompany.id.substring(0, 8)}...
                  </p>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <p className="text-sm">未匹配</p>
                </div>
              )}
            </div>

            {/* Document Format */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileType className="h-4 w-4" />
                文件格式
              </h4>
              {hasFormat ? (
                <div className="rounded-lg border p-4">
                  <p className="font-medium">{documentFormat.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {documentFormat.documentType && (
                      <Badge variant="outline">
                        <FileText className="mr-1 h-3 w-3" />
                        {documentFormat.documentType}
                      </Badge>
                    )}
                    {documentFormat.documentSubtype && (
                      <Badge variant="outline">
                        {documentFormat.documentSubtype}
                      </Badge>
                    )}
                  </div>
                  {formatConfidence !== null && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      格式信心度: {formatConfidenceValue(formatConfidence)}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    ID: {documentFormat.id.substring(0, 8)}...
                  </p>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <p className="text-sm">未分類</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
