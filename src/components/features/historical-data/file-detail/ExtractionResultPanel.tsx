/**
 * @fileoverview ExtractionResultPanel - 提取結果面板
 * @description
 *   顯示文件提取結果的摘要資訊，包含：
 *   - Invoice 基本資訊（編號、日期、金額）
 *   - 供應商/客戶資訊
 *   - 提取信心度
 *
 * @module src/components/features/historical-data/file-detail/ExtractionResultPanel
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { FileText, Calendar, DollarSign, Building2, User, Percent } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatShortDate } from '@/lib/i18n-date';
import type { ExtractionResult } from '@/hooks/use-historical-file-detail';
import type { Locale } from '@/i18n/config';

// ============================================================
// Types
// ============================================================

interface ExtractionResultPanelProps {
  extractionResult: ExtractionResult | null;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 格式化金額
 */
function formatAmount(amount: number | undefined, currency?: string): string {
  if (amount === undefined) return '-';
  const currencySymbol = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencySymbol,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string | undefined, locale: Locale): string {
  if (!dateStr) return '-';
  try {
    return formatShortDate(new Date(dateStr), locale);
  } catch {
    return dateStr;
  }
}

// ============================================================
// Component
// ============================================================

/**
 * 格式化信心度為百分比字串
 * @description
 *   修復信心度顯示問題
 *   資料庫存儲格式可能是：
 *   - 整數 (如 96 表示 96%)
 *   - 小數 (如 0.96 表示 96%)
 *   需要判斷數值範圍來決定是否需要轉換
 */
function formatConfidencePercent(confidence: number | undefined): string {
  if (confidence === undefined) return '-';
  // 判斷是整數百分比還是小數
  const percentValue = confidence > 1 ? confidence : confidence * 100;
  return `${percentValue.toFixed(1)}%`;
}

/**
 * @component ExtractionResultPanel
 * @description 顯示提取結果摘要的面板組件
 */
export function ExtractionResultPanel({ extractionResult }: ExtractionResultPanelProps) {
  const t = useTranslations('historicalData.fileDetail.extraction');
  const locale = useLocale() as Locale;

  if (!extractionResult || !extractionResult.invoiceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <p>{t('noResults')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const invoice = extractionResult.invoiceData;
  const confidence = extractionResult.confidence;

  const infoSections = [
    {
      title: t('invoiceInfo'),
      items: [
        { icon: FileText, label: t('invoiceNumber'), value: invoice.invoiceNumber || '-' },
        { icon: Calendar, label: t('invoiceDate'), value: formatDate(invoice.invoiceDate, locale) },
        { icon: Calendar, label: t('dueDate'), value: formatDate(invoice.dueDate, locale) },
      ],
    },
    {
      title: t('amountInfo'),
      items: [
        { icon: DollarSign, label: t('subtotal'), value: formatAmount(invoice.subtotal, invoice.currency) },
        { icon: DollarSign, label: t('taxAmount'), value: formatAmount(invoice.taxAmount, invoice.currency) },
        { icon: DollarSign, label: t('totalAmount'), value: formatAmount(invoice.totalAmount, invoice.currency) },
      ],
    },
    {
      title: t('parties'),
      items: [
        { icon: Building2, label: t('vendor'), value: invoice.vendorName || '-' },
        { icon: User, label: t('customer'), value: invoice.customerName || '-' },
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          {confidence !== undefined && (
            <Badge variant={
              // 判斷是整數百分比還是小數
              (confidence > 1 ? confidence / 100 : confidence) >= 0.9 ? 'default' :
              (confidence > 1 ? confidence / 100 : confidence) >= 0.7 ? 'secondary' : 'outline'
            }>
              <Percent className="mr-1 h-3 w-3" />
              {formatConfidencePercent(confidence)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          {infoSections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">{section.title}</h4>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-1.5">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="truncate font-medium">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Address Information */}
        {(invoice.vendorAddress || invoice.customerAddress) && (
          <div className="mt-6 grid gap-4 border-t pt-4 md:grid-cols-2">
            {invoice.vendorAddress && (
              <div>
                <p className="text-xs text-muted-foreground">{t('vendorAddress')}</p>
                <p className="mt-1 text-sm">{invoice.vendorAddress}</p>
              </div>
            )}
            {invoice.customerAddress && (
              <div>
                <p className="text-xs text-muted-foreground">{t('customerAddress')}</p>
                <p className="mt-1 text-sm">{invoice.customerAddress}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
