/**
 * @fileoverview 模版實例導出服務
 * @description
 *   提供 TemplateInstance 的 Excel 和 CSV 導出功能
 *   支援行篩選、欄位選擇、格式化選項
 *
 * @module src/services/template-export
 * @since Epic 19 - Story 19.6
 * @lastModified 2026-01-23
 *
 * @features
 *   - Excel 導出（使用 exceljs）
 *   - CSV 導出（UTF-8 BOM 支援）
 *   - 行篩選（全部、有效、無效）
 *   - 欄位選擇和排序
 *   - 日期、數字、金額格式化
 *   - 串流處理支援大數據量
 *
 * @dependencies
 *   - exceljs - Excel 生成庫
 *   - prisma - 資料庫操作
 *   - src/types/template-instance.ts - 類型定義
 *   - src/types/data-template.ts - 欄位類型定義
 */

import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import type {
  TemplateInstanceRow,
  TemplateInstanceRowStatus,
} from '@/types/template-instance';
import type { DataTemplateField, DataTemplateFieldType } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

/**
 * 行篩選類型
 */
export type RowFilter = 'all' | 'valid' | 'invalid';

/**
 * 格式化選項
 */
export interface FormatOptions {
  /** 日期格式 */
  dateFormat?: string;
  /** 是否使用千分位 */
  useThousandSeparator?: boolean;
  /** 小數位數 */
  decimalPlaces?: number;
  /** 貨幣符號 */
  currencySymbol?: string;
  /** 是否包含表頭 */
  includeHeader?: boolean;
  /** 是否包含驗證錯誤欄位 */
  includeValidationErrors?: boolean;
}

/**
 * 導出參數
 */
export interface ExportParams {
  /** 實例 ID */
  instanceId: string;
  /** 實例名稱 */
  instanceName: string;
  /** 模版欄位定義 */
  templateFields: DataTemplateField[];
  /** 行篩選 */
  rowFilter?: RowFilter;
  /** 選擇的欄位名稱列表（按順序）*/
  selectedFields?: string[];
  /** 格式化選項 */
  formatOptions?: FormatOptions;
  /** 進度回調 */
  onProgress?: (progress: { current: number; total: number }) => void;
}

/**
 * 導出結果
 */
export interface ExportResult {
  /** 文件內容（Buffer 或 string） */
  content: Buffer | string;
  /** 文件名 */
  filename: string;
  /** MIME 類型 */
  mimeType: string;
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * 模版實例導出服務類
 */
export class TemplateExportService {
  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * 導出為 Excel
   * @param params - 導出參數
   * @returns 導出結果
   */
  async exportToExcel(params: ExportParams): Promise<ExportResult> {
    const { instanceId, instanceName, templateFields, formatOptions } = params;
    const selectedFields = this.getSelectedFields(templateFields, params.selectedFields);
    const rows = await this.getFilteredRows(instanceId, params.rowFilter);

    // 1. 創建工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Document Extraction System';
    workbook.created = new Date();

    // 2. 創建工作表
    const sheet = workbook.addWorksheet(instanceName.slice(0, 31)); // Excel 工作表名稱最多 31 字

    // 3. 設定表頭
    sheet.columns = selectedFields.map((field) => ({
      header: field.label,
      key: field.name,
      width: this.calculateColumnWidth(field),
    }));

    // 4. 樣式化表頭
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // 5. 添加數據行
    const total = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData: Record<string, unknown> = {};
      const fieldValues = row.fieldValues as Record<string, unknown>;

      for (const field of selectedFields) {
        rowData[field.name] = this.formatValue(
          fieldValues[field.name],
          field.dataType,
          formatOptions
        );
      }

      const excelRow = sheet.addRow(rowData);

      // 根據驗證狀態設定行樣式
      if (row.status === 'INVALID') {
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' }, // 淡紅色背景
        };
      }

      // 進度回調
      if (params.onProgress) {
        params.onProgress({ current: i + 1, total });
      }
    }

    // 6. 添加驗證錯誤欄位（如果需要）
    if (formatOptions?.includeValidationErrors) {
      sheet.getColumn(selectedFields.length + 1).header = 'Validation Errors';
      sheet.getColumn(selectedFields.length + 1).key = '_validationErrors';
      sheet.getColumn(selectedFields.length + 1).width = 40;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const dataRow = sheet.getRow(i + 2); // +2 因為第一行是表頭
        if (row.validationErrors) {
          const errorText = Object.entries(row.validationErrors)
            .map(([field, error]) => `${field}: ${error}`)
            .join('; ');
          dataRow.getCell(selectedFields.length + 1).value = errorText;
        }
      }
    }

    // 7. 自動調整列寬
    sheet.columns.forEach((column) => {
      if (column.width === undefined) {
        column.width = 15;
      }
    });

    // 8. 生成 Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return {
      content: Buffer.from(buffer),
      filename: `${instanceName}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * 導出為 CSV
   * @param params - 導出參數
   * @returns 導出結果
   */
  async exportToCsv(params: ExportParams): Promise<ExportResult> {
    const { instanceId, instanceName, templateFields, formatOptions } = params;
    const selectedFields = this.getSelectedFields(templateFields, params.selectedFields);
    const rows = await this.getFilteredRows(instanceId, params.rowFilter);

    const lines: string[] = [];

    // 1. 表頭
    if (formatOptions?.includeHeader !== false) {
      const headers = selectedFields.map((f) => this.escapeCsvValue(f.label));
      if (formatOptions?.includeValidationErrors) {
        headers.push('Validation Errors');
      }
      lines.push(headers.join(','));
    }

    // 2. 數據行
    const total = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fieldValues = row.fieldValues as Record<string, unknown>;
      const values = selectedFields.map((field) => {
        const value = this.formatValue(
          fieldValues[field.name],
          field.dataType,
          formatOptions
        );
        return this.escapeCsvValue(String(value ?? ''));
      });

      // 添加驗證錯誤欄位
      if (formatOptions?.includeValidationErrors) {
        if (row.validationErrors) {
          const errorText = Object.entries(row.validationErrors)
            .map(([field, error]) => `${field}: ${error}`)
            .join('; ');
          values.push(this.escapeCsvValue(errorText));
        } else {
          values.push('');
        }
      }

      lines.push(values.join(','));

      // 進度回調
      if (params.onProgress) {
        params.onProgress({ current: i + 1, total });
      }
    }

    // 3. 添加 UTF-8 BOM（Excel 兼容）
    const csvContent = '\uFEFF' + lines.join('\n');

    return {
      content: csvContent,
      filename: `${instanceName}.csv`,
      mimeType: 'text/csv; charset=utf-8',
    };
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * 取得篩選後的欄位列表
   */
  private getSelectedFields(
    templateFields: DataTemplateField[],
    selectedFieldNames?: string[]
  ): DataTemplateField[] {
    // 如果沒有指定，返回所有欄位（按 order 排序）
    if (!selectedFieldNames || selectedFieldNames.length === 0) {
      return [...templateFields].sort((a, b) => a.order - b.order);
    }

    // 按照 selectedFieldNames 的順序返回欄位
    return selectedFieldNames
      .map((name) => templateFields.find((f) => f.name === name))
      .filter((f): f is DataTemplateField => f !== undefined);
  }

  /**
   * 取得篩選後的行數據
   */
  private async getFilteredRows(
    instanceId: string,
    rowFilter?: RowFilter
  ): Promise<TemplateInstanceRow[]> {
    // 建構查詢條件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      templateInstanceId: instanceId,
    };

    if (rowFilter === 'valid') {
      where.status = 'VALID';
    } else if (rowFilter === 'invalid') {
      where.status = 'INVALID';
    }
    // 'all' 不需要額外篩選條件

    const rows = await prisma.templateInstanceRow.findMany({
      where,
      orderBy: { rowIndex: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      templateInstanceId: row.templateInstanceId,
      rowKey: row.rowKey,
      rowIndex: row.rowIndex,
      sourceDocumentIds: row.sourceDocumentIds || [],
      fieldValues: (row.fieldValues as Record<string, unknown>) || {},
      validationErrors: row.validationErrors as Record<string, string> | null,
      status: row.status as TemplateInstanceRowStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /**
   * 計算欄位寬度
   */
  private calculateColumnWidth(field: DataTemplateField): number {
    // 根據類型和標籤長度計算適當寬度
    const labelLength = field.label.length;
    const baseWidth = Math.max(labelLength * 1.2, 10);

    switch (field.dataType) {
      case 'date':
        return Math.max(baseWidth, 12);
      case 'currency':
      case 'number':
        return Math.max(baseWidth, 15);
      case 'boolean':
        return Math.max(baseWidth, 8);
      case 'array':
        return Math.max(baseWidth, 30);
      default:
        return Math.max(baseWidth, 20);
    }
  }

  /**
   * CSV 值轉義
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * 格式化值
   */
  private formatValue(
    value: unknown,
    dataType: DataTemplateFieldType,
    options?: FormatOptions
  ): unknown {
    if (value === null || value === undefined) {
      return '';
    }

    switch (dataType) {
      case 'date':
        return this.formatDate(value as string | Date, options?.dateFormat);

      case 'number':
        return this.formatNumber(value, {
          useThousandSeparator: options?.useThousandSeparator,
          decimalPlaces: options?.decimalPlaces,
        });

      case 'currency':
        return this.formatNumber(value, {
          useThousandSeparator: options?.useThousandSeparator ?? true,
          decimalPlaces: options?.decimalPlaces ?? 2,
          currencySymbol: options?.currencySymbol,
        });

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);

      default:
        return value;
    }
  }

  /**
   * 格式化日期
   */
  private formatDate(value: string | Date, format?: string): string {
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) {
        return String(value);
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      switch (format) {
        case 'DD/MM/YYYY':
          return `${day}/${month}/${year}`;
        case 'MM/DD/YYYY':
          return `${month}/${day}/${year}`;
        case 'YYYY/MM/DD':
          return `${year}/${month}/${day}`;
        case 'YYYY-MM-DD':
        default:
          return `${year}-${month}-${day}`;
      }
    } catch {
      return String(value);
    }
  }

  /**
   * 格式化數字
   */
  private formatNumber(
    value: unknown,
    options?: {
      useThousandSeparator?: boolean;
      decimalPlaces?: number;
      currencySymbol?: string;
    }
  ): string | number {
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) {
      return String(value);
    }

    let formatted: string;

    if (options?.decimalPlaces !== undefined) {
      formatted = num.toFixed(options.decimalPlaces);
    } else {
      formatted = String(num);
    }

    if (options?.useThousandSeparator) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }

    if (options?.currencySymbol) {
      formatted = `${options.currencySymbol}${formatted}`;
    }

    return formatted;
  }
}

// ============================================================================
// Service Instance Export
// ============================================================================

/** 模版導出服務單例 */
export const templateExportService = new TemplateExportService();
