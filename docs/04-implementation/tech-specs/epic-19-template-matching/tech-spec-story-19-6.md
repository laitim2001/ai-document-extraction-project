# Tech Spec: Story 19.6 - 模版實例導出功能

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-6

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 19.6 |
| **Epic** | Epic 19 - 數據模版匹配與輸出 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | Story 19-5 |

---

## Objective

實現 TemplateInstance 的 Excel 和 CSV 導出功能。

---

## Implementation Guide

### Phase 1: 新增依賴

```bash
npm install exceljs
```

### Phase 2: 導出服務

```typescript
// src/services/template-export.service.ts

export class TemplateExportService {
  /**
   * 導出為 Excel
   */
  async exportToExcel(params: ExportParams): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(params.instance.name);

    // 設定表頭
    sheet.columns = params.selectedFields.map(field => ({
      header: field.label,
      key: field.name,
      width: this.calculateColumnWidth(field),
    }));

    // 樣式化表頭
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // 添加數據行
    for (const row of params.rows) {
      const rowData = {};
      for (const field of params.selectedFields) {
        rowData[field.name] = this.formatValue(
          row.fieldValues[field.name],
          field.dataType,
          params.formatOptions
        );
      }
      sheet.addRow(rowData);
    }

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  /**
   * 導出為 CSV
   */
  async exportToCsv(params: ExportParams): Promise<string> {
    const lines: string[] = [];

    // 表頭
    lines.push(
      params.selectedFields.map(f => this.escapeCsvValue(f.label)).join(',')
    );

    // 數據行
    for (const row of params.rows) {
      const values = params.selectedFields.map(field => {
        const value = this.formatValue(
          row.fieldValues[field.name],
          field.dataType,
          params.formatOptions
        );
        return this.escapeCsvValue(String(value ?? ''));
      });
      lines.push(values.join(','));
    }

    // UTF-8 BOM for Excel compatibility
    return '\uFEFF' + lines.join('\n');
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
```

### Phase 3: 導出 API

```typescript
// GET /api/v1/template-instances/:id/export

export async function GET(request: NextRequest, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const format = searchParams.get('format') || 'xlsx';
  const rowFilter = searchParams.get('rowFilter') || 'all';
  const fields = searchParams.get('fields')?.split(',');

  const instance = await templateInstanceService.getById(id);
  const template = await dataTemplateService.getById(instance.dataTemplateId);

  const exportService = new TemplateExportService();

  if (format === 'xlsx') {
    const buffer = await exportService.exportToExcel({ instance, template, options: { rowFilter, fields } });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${instance.name}.xlsx"`,
      },
    });
  } else {
    const csv = await exportService.exportToCsv({ instance, template, options: { rowFilter, fields } });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${instance.name}.csv"`,
      },
    });
  }
}
```

### Phase 4: 導出對話框

```typescript
// ExportDialog 組件
interface ExportDialogProps {
  instanceId: string;
  open: boolean;
  onClose: () => void;
}

// 功能：
// - 格式選擇 (Excel / CSV)
// - 行篩選 (全部 / 有效 / 錯誤)
// - 欄位選擇（拖拽排序）
// - 格式化選項
```

---

## File Structure

```
src/
├── services/template-export.service.ts
├── app/api/v1/template-instances/[id]/export/route.ts
├── components/features/template-instance/
│   ├── ExportDialog.tsx
│   ├── ExportFieldSelector.tsx
│   └── ExportProgress.tsx
└── lib/export-formatters.ts
```

---

## Testing Checklist

- [ ] Excel 導出正確
- [ ] CSV 導出正確
- [ ] UTF-8 BOM 正確（Excel 中文兼容）
- [ ] 行篩選正常
- [ ] 欄位選擇正常
- [ ] 格式化正確（日期、數字、金額）
