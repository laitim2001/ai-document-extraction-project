/**
 * @fileoverview 導出測試組件
 * @description
 *   測試導出功能，支援 Excel 和 CSV 格式
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileSpreadsheet, FileText, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { StepComponentProps, ExportResult } from '../types';

type ExportFormat = 'xlsx' | 'csv';

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 生成 CSV 內容
 */
function generateCsv(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const lines = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const value = row[h];
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ];

  return '\uFEFF' + lines.join('\n');
}

/**
 * 生成簡單的 Excel XML
 */
function generateExcelXml(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);

  const headerRow = headers
    .map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`)
    .join('');

  const dataRows = data
    .map((row) => {
      const cells = headers
        .map((h) => {
          const value = row[h];
          if (value === null || value === undefined) {
            return '<Cell><Data ss:Type="String"></Data></Cell>';
          }
          const type = typeof value === 'number' ? 'Number' : 'String';
          return `<Cell><Data ss:Type="${type}">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

/**
 * 導出測試組件
 */
export function ExportTester({
  testState,
  onUpdate,
  onRecordResult,
}: StepComponentProps) {
  const t = useTranslations('templateMatchingTest.testExport');
  const tToast = useTranslations('templateMatchingTest.toast');

  const [format, setFormat] = React.useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportResult, setExportResult] = React.useState<ExportResult | null>(
    testState.exportResult
  );

  const matchResult = testState.matchResult;

  // 處理導出
  const handleExport = async () => {
    if (!matchResult) return;

    setIsExporting(true);

    try {
      // 準備導出數據
      const exportData = matchResult.results
        .filter((r) => r.fieldValues)
        .map((r) => ({
          rowKey: r.rowKey,
          status: r.status,
          ...r.fieldValues,
        }));

      let content: string;
      let mimeType: string;
      let filename: string;

      if (format === 'csv') {
        content = generateCsv(exportData);
        mimeType = 'text/csv;charset=utf-8';
        filename = `test-export-${Date.now()}.csv`;
      } else {
        content = generateExcelXml(exportData);
        mimeType = 'application/vnd.ms-excel';
        filename = `test-export-${Date.now()}.xls`;
      }

      // 創建 Blob
      const blob = new Blob([content], { type: mimeType });

      const result: ExportResult = {
        format,
        filename,
        fileSize: blob.size,
        rowCount: exportData.length,
        blob,
      };

      setExportResult(result);
      onUpdate({ exportResult: result });

      toast.success(tToast('exportSuccess'));

      // 記錄步驟結果
      onRecordResult({
        status: 'passed',
        message: `Exported ${exportData.length} rows as ${format.toUpperCase()}`,
        details: {
          format,
          filename,
          fileSize: blob.size,
          rowCount: exportData.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(
        tToast('exportError', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );

      onRecordResult({
        status: 'failed',
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 下載文件
  const handleDownload = () => {
    if (!exportResult) return;

    const url = URL.createObjectURL(exportResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!matchResult) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">
            No match result available for export
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* 格式選擇 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('format.label')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="xlsx"
                id="xlsx"
                className="peer sr-only"
              />
              <Label
                htmlFor="xlsx"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <FileSpreadsheet className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">{t('format.excel')}</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="csv" id="csv" className="peer sr-only" />
              <Label
                htmlFor="csv"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <FileText className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">{t('format.csv')}</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 導出按鈕 */}
      <div className="flex gap-4">
        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="flex-1"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('actions.exporting')}
            </>
          ) : format === 'xlsx' ? (
            <>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t('actions.exportExcel')}
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              {t('actions.exportCsv')}
            </>
          )}
        </Button>
      </div>

      {/* 導出結果 */}
      {exportResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">{t('result.title')}</CardTitle>
            </div>
            <CardDescription>{t('result.success')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t('result.filename')}
                </span>
                <p className="font-mono">{exportResult.filename}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('result.fileSize')}
                </span>
                <p>{formatFileSize(exportResult.fileSize)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('result.rowCount')}
                </span>
                <p>{exportResult.rowCount}</p>
              </div>
            </div>

            <Button onClick={handleDownload} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {t('result.download')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
