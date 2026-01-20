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
import { useTranslations } from 'next-intl';

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
function formatIdentificationMethod(
  method: string | null,
  t: ReturnType<typeof useTranslations<'historicalData.fileDetail.issuer'>>
): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (!method) return { label: t('method.notIdentified'), variant: 'outline' };
  const methodMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    HEADER: { label: t('method.header'), variant: 'default' },
    LOGO: { label: t('method.logo'), variant: 'secondary' },
    MANUAL: { label: t('method.manual'), variant: 'outline' },
  };
  return methodMap[method] || { label: method, variant: 'outline' };
}

/**
 * 格式化信心度為百分比字串
 * @description
 *   FIX-005: 修復信心度顯示問題
 *   資料庫存儲格式：整數 (如 96 表示 96%)
 *   需要判斷數值範圍來決定是否需要轉換：
 *   - 如果 > 1，視為百分比整數（如 96），直接顯示
 *   - 如果 <= 1，視為小數（如 0.96），乘以 100 顯示
 */
function formatConfidenceValue(confidence: number | null): string {
  if (confidence === null) return '-';
  // FIX-005: 判斷是整數百分比還是小數
  const percentValue = confidence > 1 ? confidence : confidence * 100;
  return `${percentValue.toFixed(1)}%`;
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
  const t = useTranslations('historicalData.fileDetail.issuer');

  const { method, confidence, matchedCompany } = issuerIdentification;
  const methodInfo = formatIdentificationMethod(method, t);

  const hasCompany = !!matchedCompany;
  const hasFormat = !!documentFormat;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('title')}</CardTitle>
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
            <p>{t('noInfo')}</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Matched Company */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {t('matchedCompany')}
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
                      {t('code')}: {matchedCompany.code}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    ID: {matchedCompany.id.substring(0, 8)}...
                  </p>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <p className="text-sm">{t('notMatched')}</p>
                </div>
              )}
            </div>

            {/* Document Format */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileType className="h-4 w-4" />
                {t('documentFormat')}
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
                      {t('formatConfidence', { value: formatConfidenceValue(formatConfidence) })}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    ID: {documentFormat.id.substring(0, 8)}...
                  </p>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <p className="text-sm">{t('notClassified')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
