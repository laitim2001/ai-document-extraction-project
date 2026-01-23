'use client';

/**
 * @fileoverview 模版實例導出對話框
 * @description
 *   提供模版實例的導出功能對話框
 *   支援格式選擇、行篩選、欄位選擇、格式化選項
 *
 * @module src/components/features/template-instance/ExportDialog
 * @since Epic 19 - Story 19.6
 * @lastModified 2026-01-23
 *
 * @features
 *   - 格式選擇（Excel / CSV）
 *   - 行篩選（全部、有效、無效）
 *   - 欄位選擇（拖拽排序）
 *   - 格式化選項（日期格式、千分位）
 *   - 導出進度顯示
 *
 * @dependencies
 *   - ExportFieldSelector - 欄位選擇器組件
 *   - ExportProgress - 導出進度組件
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ExportFieldSelector } from './ExportFieldSelector';
import type { DataTemplateField } from '@/types/data-template';
import type { TemplateInstance } from '@/types/template-instance';
import type { RowFilter } from '@/services/template-export.service';

// ============================================================================
// Types
// ============================================================================

interface ExportDialogProps {
  /** 是否開啟對話框 */
  open: boolean;
  /** 關閉對話框回調 */
  onClose: () => void;
  /** 實例資訊 */
  instance: TemplateInstance;
  /** 模版欄位定義 */
  templateFields: DataTemplateField[];
}

type ExportFormat = 'xlsx' | 'csv';

interface ExportOptions {
  format: ExportFormat;
  rowFilter: RowFilter;
  selectedFields: string[];
  dateFormat: string;
  useThousandSeparator: boolean;
  includeValidationErrors: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * 導出對話框組件
 */
export function ExportDialog({
  open,
  onClose,
  instance,
  templateFields,
}: ExportDialogProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');

  // --- State ---
  const [isExporting, setIsExporting] = React.useState(false);
  const [options, setOptions] = React.useState<ExportOptions>(() => ({
    format: 'xlsx',
    rowFilter: 'all',
    selectedFields: templateFields.map((f) => f.name),
    dateFormat: 'YYYY-MM-DD',
    useThousandSeparator: true,
    includeValidationErrors: false,
  }));

  // Reset options when dialog opens
  React.useEffect(() => {
    if (open) {
      setOptions({
        format: 'xlsx',
        rowFilter: 'all',
        selectedFields: templateFields.map((f) => f.name),
        dateFormat: 'YYYY-MM-DD',
        useThousandSeparator: true,
        includeValidationErrors: false,
      });
      setIsExporting(false);
    }
  }, [open, templateFields]);

  // --- Handlers ---
  const handleExport = React.useCallback(async () => {
    setIsExporting(true);

    try {
      // 構建查詢參數
      const params = new URLSearchParams({
        format: options.format,
        rowFilter: options.rowFilter,
        dateFormat: options.dateFormat,
        useThousandSeparator: String(options.useThousandSeparator),
        includeValidationErrors: String(options.includeValidationErrors),
      });

      if (options.selectedFields.length < templateFields.length) {
        params.set('fields', options.selectedFields.join(','));
      }

      // 發起導出請求
      const response = await fetch(
        `/api/v1/template-instances/${instance.id}/export?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.detail || 'Export failed');
      }

      // 取得文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${instance.name}.${options.format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      // 下載文件
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 關閉對話框
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      // TODO: 顯示錯誤提示
    } finally {
      setIsExporting(false);
    }
  }, [instance.id, instance.name, options, templateFields.length, onClose]);

  const handleFieldsChange = React.useCallback((fields: string[]) => {
    setOptions((prev) => ({ ...prev, selectedFields: fields }));
  }, []);

  // --- Computed ---
  const rowCounts = React.useMemo(() => ({
    all: instance.rowCount,
    valid: instance.validRowCount,
    invalid: instance.errorRowCount,
  }), [instance]);

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('export.title')}
          </DialogTitle>
          <DialogDescription>
            {t('export.description', { name: instance.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('export.format.label')}</Label>
            <RadioGroup
              value={options.format}
              onValueChange={(value: ExportFormat) =>
                setOptions((prev) => ({ ...prev, format: value }))
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="format-xlsx" />
                <Label htmlFor="format-xlsx" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  {t('export.format.excel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-600" />
                  {t('export.format.csv')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Row Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('export.rowFilter.label')}</Label>
            <RadioGroup
              value={options.rowFilter}
              onValueChange={(value: RowFilter) =>
                setOptions((prev) => ({ ...prev, rowFilter: value }))
              }
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="filter-all" />
                <Label htmlFor="filter-all" className="cursor-pointer">
                  {t('export.rowFilter.all', { count: rowCounts.all })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="valid" id="filter-valid" />
                <Label htmlFor="filter-valid" className="cursor-pointer">
                  {t('export.rowFilter.valid', { count: rowCounts.valid })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="invalid" id="filter-invalid" />
                <Label htmlFor="filter-invalid" className="cursor-pointer">
                  {t('export.rowFilter.invalid', { count: rowCounts.invalid })}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Field Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('export.fields.label')}</Label>
            <ExportFieldSelector
              fields={templateFields}
              selectedFields={options.selectedFields}
              onChange={handleFieldsChange}
            />
          </div>

          <Separator />

          {/* Advanced Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">{t('export.advanced.label')}</Label>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Date Format */}
              <div className="space-y-2">
                <Label htmlFor="date-format" className="text-sm text-muted-foreground">
                  {t('export.advanced.dateFormat')}
                </Label>
                <Select
                  value={options.dateFormat}
                  onValueChange={(value) =>
                    setOptions((prev) => ({ ...prev, dateFormat: value }))
                  }
                >
                  <SelectTrigger id="date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thousand Separator */}
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="thousand-separator"
                  checked={options.useThousandSeparator}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({
                      ...prev,
                      useThousandSeparator: checked === true,
                    }))
                  }
                />
                <Label htmlFor="thousand-separator" className="text-sm cursor-pointer">
                  {t('export.advanced.useThousandSeparator')}
                </Label>
              </div>
            </div>

            {/* Include Validation Errors */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-errors"
                checked={options.includeValidationErrors}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    includeValidationErrors: checked === true,
                  }))
                }
              />
              <Label htmlFor="include-errors" className="text-sm cursor-pointer">
                {t('export.advanced.includeValidationErrors')}
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || options.selectedFields.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('export.exporting')}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t('export.exportButton')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
