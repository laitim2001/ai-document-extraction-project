/**
 * @fileoverview LineItemsTable - Line Items 表格
 * @description
 *   顯示提取結果中的 Line Items 表格，包含：
 *   - 項目描述
 *   - 數量
 *   - 單價
 *   - 金額
 *
 * @module src/components/features/historical-data/file-detail/LineItemsTable
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { List } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ExtractionResult, LineItem } from '@/hooks/use-historical-file-detail';

// ============================================================
// Types
// ============================================================

interface LineItemsTableProps {
  extractionResult: ExtractionResult | null;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 格式化金額
 */
function formatAmount(amount: number | undefined): string {
  if (amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * 格式化數量
 */
function formatQuantity(quantity: number | undefined): string {
  if (quantity === undefined) return '-';
  return quantity.toString();
}

/**
 * 獲取 Line Item 的顯示欄位
 */
function getLineItemColumns(items: LineItem[]): string[] {
  const allKeys = new Set<string>();
  items.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key));
  });

  // 優先顯示的欄位
  const priorityKeys = ['description', 'quantity', 'unitPrice', 'amount', 'unit', 'total'];
  const sortedKeys = [...allKeys].sort((a, b) => {
    const aIndex = priorityKeys.indexOf(a);
    const bIndex = priorityKeys.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return sortedKeys;
}

/**
 * 格式化欄位標題
 */
function formatColumnHeader(
  key: string,
  t: ReturnType<typeof useTranslations<'historicalData.fileDetail.lineItems'>>
): string {
  const columnKeys = ['description', 'quantity', 'unitPrice', 'amount', 'unit', 'total', 'productCode', 'taxRate'];
  if (columnKeys.includes(key)) {
    return t(`columns.${key as 'description' | 'quantity' | 'unitPrice' | 'amount' | 'unit' | 'total' | 'productCode' | 'taxRate'}`);
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * 格式化欄位值
 */
function formatCellValue(value: unknown, key: string): string {
  if (value === undefined || value === null) return '-';

  // 金額相關欄位
  if (['amount', 'unitPrice', 'total', 'price'].includes(key)) {
    if (typeof value === 'number') {
      return formatAmount(value);
    }
  }

  // 數量相關欄位
  if (['quantity', 'qty'].includes(key)) {
    if (typeof value === 'number') {
      return formatQuantity(value);
    }
  }

  // 其他類型
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

// ============================================================
// Component
// ============================================================

/**
 * @component LineItemsTable
 * @description 顯示 Line Items 表格的組件
 */
export function LineItemsTable({ extractionResult }: LineItemsTableProps) {
  const t = useTranslations('historicalData.fileDetail.lineItems');
  const lineItems = extractionResult?.invoiceData?.lineItems;

  if (!lineItems || lineItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <List className="h-8 w-8" />
              <p>{t('noData')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const columns = getLineItemColumns(lineItems);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <Badge variant="secondary">{t('itemCount', { count: lineItems.length })}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className={
                      ['amount', 'unitPrice', 'total', 'quantity'].includes(column)
                        ? 'text-right'
                        : ''
                    }
                  >
                    {formatColumnHeader(column, t)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  {columns.map((column) => (
                    <TableCell
                      key={column}
                      className={
                        ['amount', 'unitPrice', 'total', 'quantity'].includes(column)
                          ? 'text-right font-mono'
                          : ''
                      }
                    >
                      {column === 'description' ? (
                        <span className="max-w-xs truncate block" title={String(item[column] || '')}>
                          {formatCellValue(item[column], column)}
                        </span>
                      ) : (
                        formatCellValue(item[column], column)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
