# Story 18.6: 模版實例導出功能

**Status:** draft

---

## Story

**As a** 用戶,
**I want** 將填充後的模版實例導出為 Excel 或 CSV,
**So that** 我可以在外部系統（如 ERP）使用這些結構化數據。

---

## 背景說明

### 問題陳述

TemplateInstance 存儲了結構化的數據，但用戶需要將這些數據導出為可用的文件格式，以便：

1. 匯入到 ERP 系統
2. 製作報表和分析
3. 與其他部門分享
4. 存檔備份

### 導出格式

| 格式 | 用途 | 特點 |
|------|------|------|
| Excel (.xlsx) | ERP 匯入、報表分享 | 支援格式化、多工作表 |
| CSV (.csv) | 系統整合、大數據處理 | 純文字、通用兼容 |

### 導出選項

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 導出設定                                                                     [導出] [取消] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  導出格式                                                                               │
│  ○ Excel (.xlsx)  ● CSV (.csv)                                                         │
│                                                                                         │
│  行篩選                                                                                 │
│  ● 全部行 (150)                                                                        │
│  ○ 僅有效行 (145)                                                                      │
│  ○ 僅錯誤行 (5)                                                                        │
│  ○ 選中的行 (0)                                                                        │
│                                                                                         │
│  欄位選擇                                                                               │
│  ☑ 出貨單號 (shipment_no)                                                              │
│  ☑ 供應商 (vendor_name)                                                                │
│  ☑ 運費 (shipping_cost)                                                                │
│  ☑ 港口費 (port_fees)                                                                  │
│  ☑ 總金額 (total_amount)                                                               │
│  ☐ 來源文件 (source_documents) - 可選                                                  │
│                                          [全選] [取消全選] [重置為預設]                  │
│                                                                                         │
│  進階選項                                                                               │
│  ☐ 包含表頭                                                                            │
│  ☐ 包含驗證錯誤欄位                                                                    │
│  ☐ 日期格式: [YYYY-MM-DD ▼]                                                            │
│  ☐ 數字格式: [千分位 ▼]                                                                │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### AC1: Excel 導出

**Given** 一個已完成的 TemplateInstance
**When** 選擇導出為 Excel
**Then**:
  - 生成正確的 .xlsx 文件
  - 第一行為表頭（使用 DataTemplate.fields 的 label）
  - 數據按 rowIndex 排序
  - 支援數字和日期格式化

### AC2: CSV 導出

**Given** 一個已完成的 TemplateInstance
**When** 選擇導出為 CSV
**Then**:
  - 生成正確的 .csv 文件
  - 使用 UTF-8 BOM 編碼（Excel 兼容）
  - 正確處理包含逗號、引號的欄位值

### AC3: 行篩選

**Given** 導出對話框
**When** 選擇行篩選選項
**Then**:
  - 「全部行」：導出所有行
  - 「僅有效行」：只導出 status=VALID 的行
  - 「僅錯誤行」：只導出 status=INVALID 的行
  - 「選中的行」：只導出用戶在表格中選中的行

### AC4: 欄位選擇

**Given** 導出對話框
**When** 調整欄位選擇
**Then**:
  - 顯示所有 DataTemplate.fields
  - 支援勾選/取消勾選
  - 支援拖拽調整欄位順序
  - 導出時按用戶選擇的順序和欄位

### AC5: 格式化選項

**Given** 導出對話框的進階選項
**When** 配置格式化
**Then**:
  - 日期格式：支援 YYYY-MM-DD、DD/MM/YYYY 等
  - 數字格式：支援千分位、小數位數
  - 金額格式：支援幣別符號

### AC6: 導出記錄

**Given** 成功導出
**When** 導出完成
**Then**:
  - 更新 instance.exportedAt 和 exportedBy
  - 更新 instance.status 為 EXPORTED
  - 記錄導出審計日誌

### AC7: 大數據導出

**Given** 超過 10,000 行的 TemplateInstance
**When** 執行導出
**Then**:
  - 使用串流處理（避免內存溢出）
  - 顯示導出進度
  - 支援取消導出

### AC8: 導出 API

**Given** /api/v1/template-instances/:id/export
**When** 調用 API
**Then**:
  - 支援 format=xlsx|csv 參數
  - 支援 rowFilter=all|valid|invalid 參數
  - 支援 fields=field1,field2 參數
  - 返回文件下載流

---

## Tasks / Subtasks

- [ ] **Task 1: 導出服務** (AC: #1, #2, #7)
  - [ ] 1.1 新增 `template-export.service.ts`
  - [ ] 1.2 實現 Excel 導出（使用 exceljs）
  - [ ] 1.3 實現 CSV 導出
  - [ ] 1.4 實現串流處理
  - [ ] 1.5 實現進度回調

- [ ] **Task 2: 導出 API** (AC: #8)
  - [ ] 2.1 新增 `/api/v1/template-instances/[id]/export/route.ts`
  - [ ] 2.2 實現參數解析
  - [ ] 2.3 實現文件流返回
  - [ ] 2.4 實現錯誤處理

- [ ] **Task 3: 導出對話框** (AC: #3, #4, #5)
  - [ ] 3.1 新增 `ExportDialog` 組件
  - [ ] 3.2 實現格式選擇
  - [ ] 3.3 實現行篩選選項
  - [ ] 3.4 實現欄位選擇（支援拖拽排序）
  - [ ] 3.5 實現進階格式化選項

- [ ] **Task 4: 導出進度** (AC: #7)
  - [ ] 4.1 實現進度顯示
  - [ ] 4.2 實現取消功能
  - [ ] 4.3 實現完成通知

- [ ] **Task 5: 導出記錄** (AC: #6)
  - [ ] 5.1 更新 TemplateInstance 狀態
  - [ ] 5.2 記錄審計日誌

- [ ] **Task 6: 格式化工具**
  - [ ] 6.1 實現日期格式化
  - [ ] 6.2 實現數字格式化
  - [ ] 6.3 實現金額格式化

---

## Dev Notes

### 依賴項

- **Story 18-5**: Template Instance UI
- **exceljs**: Excel 生成庫

### 新增依賴

```bash
npm install exceljs
```

### 新增文件

```
src/
├── services/
│   └── template-export.service.ts        # 新增
├── app/api/v1/template-instances/[id]/
│   └── export/route.ts                   # 新增
├── components/features/template-instance/
│   ├── ExportDialog.tsx                  # 新增
│   ├── ExportFieldSelector.tsx           # 新增
│   ├── ExportFormatOptions.tsx           # 新增
│   └── ExportProgress.tsx                # 新增
└── lib/
    └── export-formatters.ts              # 新增
```

### Excel 導出設計

```typescript
// src/services/template-export.service.ts

import ExcelJS from 'exceljs';

export class TemplateExportService {
  /**
   * 導出為 Excel
   */
  async exportToExcel(params: ExportParams): Promise<Buffer> {
    const { instance, template, options } = params;

    // 1. 創建工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Document Extraction System';
    workbook.created = new Date();

    // 2. 創建工作表
    const sheet = workbook.addWorksheet(instance.name);

    // 3. 設定表頭
    const selectedFields = this.getSelectedFields(template.fields, options.fields);
    sheet.columns = selectedFields.map((field) => ({
      header: field.label,
      key: field.name,
      width: this.calculateColumnWidth(field),
      style: this.getColumnStyle(field),
    }));

    // 4. 樣式化表頭
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // 5. 串流添加數據行
    const rows = await this.getFilteredRows(instance.id, options.rowFilter);

    for await (const row of this.streamRows(rows)) {
      const rowData: Record<string, unknown> = {};
      const fieldValues = row.fieldValues as Record<string, unknown>;

      for (const field of selectedFields) {
        rowData[field.name] = this.formatValue(
          fieldValues[field.name],
          field.dataType,
          options.formatOptions,
        );
      }

      sheet.addRow(rowData);

      // 進度回調
      if (options.onProgress) {
        options.onProgress({ current: row.rowIndex, total: rows.length });
      }
    }

    // 6. 自動調整列寬
    sheet.columns.forEach((column) => {
      if (column.width === undefined) {
        column.width = 15;
      }
    });

    // 7. 生成 Buffer
    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  /**
   * 導出為 CSV
   */
  async exportToCsv(params: ExportParams): Promise<string> {
    const { instance, template, options } = params;

    const selectedFields = this.getSelectedFields(template.fields, options.fields);
    const rows = await this.getFilteredRows(instance.id, options.rowFilter);

    const lines: string[] = [];

    // 1. 表頭
    if (options.includeHeader !== false) {
      lines.push(
        selectedFields.map((f) => this.escapeCsvValue(f.label)).join(','),
      );
    }

    // 2. 數據行
    for (const row of rows) {
      const fieldValues = row.fieldValues as Record<string, unknown>;
      const values = selectedFields.map((field) => {
        const value = this.formatValue(
          fieldValues[field.name],
          field.dataType,
          options.formatOptions,
        );
        return this.escapeCsvValue(String(value ?? ''));
      });
      lines.push(values.join(','));
    }

    // 3. 添加 UTF-8 BOM（Excel 兼容）
    return '\uFEFF' + lines.join('\n');
  }

  /**
   * CSV 值轉義
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
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
    options?: FormatOptions,
  ): unknown {
    if (value === null || value === undefined) {
      return '';
    }

    switch (dataType) {
      case 'date':
        return formatDate(value as string, options?.dateFormat || 'YYYY-MM-DD');

      case 'number':
      case 'currency':
        const num = Number(value);
        if (isNaN(num)) return value;
        return formatNumber(num, {
          thousandSeparator: options?.useThousandSeparator,
          decimalPlaces: options?.decimalPlaces,
          currencySymbol: dataType === 'currency' ? options?.currencySymbol : undefined,
        });

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);

      default:
        return value;
    }
  }
}
```

### API 設計

```typescript
// GET /api/v1/template-instances/:id/export?format=xlsx&rowFilter=valid&fields=field1,field2

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const format = searchParams.get('format') || 'xlsx';
  const rowFilter = searchParams.get('rowFilter') || 'all';
  const fields = searchParams.get('fields')?.split(',');

  // 獲取實例和模版
  const instance = await templateInstanceService.getById(id);
  const template = await dataTemplateService.getById(instance.dataTemplateId);

  // 執行導出
  const exportService = new TemplateExportService();

  if (format === 'xlsx') {
    const buffer = await exportService.exportToExcel({
      instance,
      template,
      options: { rowFilter, fields },
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${instance.name}.xlsx"`,
      },
    });
  } else {
    const csv = await exportService.exportToCsv({
      instance,
      template,
      options: { rowFilter, fields },
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${instance.name}.csv"`,
      },
    });
  }
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/services/template-export.service.ts` - 新增
- `src/app/api/v1/template-instances/[id]/export/route.ts` - 新增
- `src/components/features/template-instance/ExportDialog.tsx` - 新增
