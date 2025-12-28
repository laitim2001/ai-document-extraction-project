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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExtractionResult } from '@/hooks/use-historical-file-detail';

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
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================
// Component
// ============================================================

/**
 * @component ExtractionResultPanel
 * @description 顯示提取結果摘要的面板組件
 */
export function ExtractionResultPanel({ extractionResult }: ExtractionResultPanelProps) {
  if (!extractionResult || !extractionResult.invoiceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">提取結果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <p>無提取結果</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const invoice = extractionResult.invoiceData;
  const confidence = extractionResult.confidence;

  const infoSections = [
    {
      title: 'Invoice 資訊',
      items: [
        { icon: FileText, label: 'Invoice 編號', value: invoice.invoiceNumber || '-' },
        { icon: Calendar, label: 'Invoice 日期', value: formatDate(invoice.invoiceDate) },
        { icon: Calendar, label: '到期日', value: formatDate(invoice.dueDate) },
      ],
    },
    {
      title: '金額資訊',
      items: [
        { icon: DollarSign, label: '小計', value: formatAmount(invoice.subtotal, invoice.currency) },
        { icon: DollarSign, label: '稅額', value: formatAmount(invoice.taxAmount, invoice.currency) },
        { icon: DollarSign, label: '總金額', value: formatAmount(invoice.totalAmount, invoice.currency) },
      ],
    },
    {
      title: '交易對象',
      items: [
        { icon: Building2, label: '供應商', value: invoice.vendorName || '-' },
        { icon: User, label: '客戶', value: invoice.customerName || '-' },
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">提取結果</CardTitle>
          {confidence !== undefined && (
            <Badge variant={confidence >= 0.9 ? 'default' : confidence >= 0.7 ? 'secondary' : 'outline'}>
              <Percent className="mr-1 h-3 w-3" />
              {(confidence * 100).toFixed(1)}%
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
                <p className="text-xs text-muted-foreground">供應商地址</p>
                <p className="mt-1 text-sm">{invoice.vendorAddress}</p>
              </div>
            )}
            {invoice.customerAddress && (
              <div>
                <p className="text-xs text-muted-foreground">客戶地址</p>
                <p className="mt-1 text-sm">{invoice.customerAddress}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
