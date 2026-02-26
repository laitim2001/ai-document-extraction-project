# Tech Spec: Story 21.8 - 管理頁面：計算器與 Import

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-8

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.8 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | Story 21-5, 21-7 |
| **Blocking** | 無 |

---

## Objective

建立即時匯率計算器和批次導入對話框，提供便捷的匯率驗證和批次建立功能。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.8.1 | 即時計算器 | ExchangeRateCalculator 組件 |
| AC-21.8.2 | 導入對話框 | ExchangeRateImportDialog 組件 |
| AC-21.8.3 | 導入選項 | overwrite/skipInvalid |
| AC-21.8.4 | 導入結果 | 統計和錯誤詳情 |
| AC-21.8.5 | 導出功能 | JSON 檔案下載 |

---

## Implementation Guide

### Phase 1: i18n 擴展 (0.5 points)

```json
// messages/en/exchangeRate.json (擴展)
{
  "calculator": {
    "title": "Exchange Rate Calculator",
    "amount": "Amount",
    "calculate": "Calculate",
    "result": "Result",
    "rate": "Rate",
    "path": "Conversion Path",
    "noRate": "Exchange rate not found"
  },
  "import": {
    "title": "Import Exchange Rates",
    "uploadFile": "Upload JSON File",
    "pasteJson": "Or paste JSON",
    "preview": "Preview",
    "previewCount": "{count} records to import",
    "options": "Import Options",
    "overwriteExisting": "Overwrite existing records",
    "skipInvalid": "Skip invalid records",
    "submit": "Start Import",
    "result": {
      "title": "Import Result",
      "imported": "Imported",
      "updated": "Updated",
      "skipped": "Skipped",
      "errors": "Errors"
    }
  },
  "export": {
    "title": "Export Exchange Rates",
    "downloading": "Downloading...",
    "filename": "exchange-rates-{year}.json"
  }
}
```

```json
// messages/zh-TW/exchangeRate.json (擴展)
{
  "calculator": {
    "title": "匯率計算器",
    "amount": "金額",
    "calculate": "計算",
    "result": "結果",
    "rate": "匯率",
    "path": "轉換路徑",
    "noRate": "找不到匯率記錄"
  },
  "import": {
    "title": "導入匯率",
    "uploadFile": "上傳 JSON 檔案",
    "pasteJson": "或貼上 JSON",
    "preview": "預覽",
    "previewCount": "共 {count} 筆記錄待導入",
    "options": "導入選項",
    "overwriteExisting": "覆蓋現有記錄",
    "skipInvalid": "跳過無效記錄",
    "submit": "開始導入",
    "result": {
      "title": "導入結果",
      "imported": "新增",
      "updated": "更新",
      "skipped": "跳過",
      "errors": "錯誤"
    }
  },
  "export": {
    "title": "導出匯率",
    "downloading": "正在下載...",
    "filename": "匯率記錄-{year}.json"
  }
}
```

### Phase 2: ExchangeRateCalculator 組件 (1.5 points)

```typescript
// src/components/features/exchange-rate/ExchangeRateCalculator.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Calculator, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencySelect } from './CurrencySelect';
import { useConvertCurrency } from '@/hooks/use-exchange-rates';
import type { ConvertResult } from '@/types/exchange-rate';

export function ExchangeRateCalculator() {
  const t = useTranslations('exchangeRate');
  const [fromCurrency, setFromCurrency] = React.useState('');
  const [toCurrency, setToCurrency] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [result, setResult] = React.useState<ConvertResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const convertMutation = useConvertCurrency();

  const handleCalculate = () => {
    if (!fromCurrency || !toCurrency || !amount) return;

    setError(null);
    setResult(null);

    convertMutation.mutate(
      {
        fromCurrency,
        toCurrency,
        amount: Number(amount),
      },
      {
        onSuccess: (response) => {
          setResult(response.data);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          {t('calculator.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              {t('calculator.amount')}
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
            />
          </div>

          <div className="flex-1">
            <CurrencySelect
              value={fromCurrency}
              onChange={setFromCurrency}
              placeholder="From"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSwap}
            disabled={!fromCurrency || !toCurrency}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <CurrencySelect
              value={toCurrency}
              onChange={setToCurrency}
              placeholder="To"
            />
          </div>

          <Button
            onClick={handleCalculate}
            disabled={!fromCurrency || !toCurrency || !amount || convertMutation.isPending}
          >
            {convertMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('calculator.calculate')
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="text-2xl font-bold">
              {result.amount.toLocaleString()} {result.fromCurrency}
              {' = '}
              <span className="text-primary">
                {result.convertedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })} {result.toCurrency}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                {t('calculator.rate')}: {result.rate.toFixed(6)}
              </span>
              <Badge variant="outline">
                {t('calculator.path')}: {result.path}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Phase 3: ExchangeRateImportDialog 組件 (1.5 points)

```typescript
// src/components/features/exchange-rate/ExchangeRateImportDialog.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Upload, FileJson, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useImportExchangeRates } from '@/hooks/use-exchange-rates';

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}

interface PreviewItem {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveYear: number;
}

export function ExchangeRateImportDialog() {
  const t = useTranslations('exchangeRate');
  const [open, setOpen] = React.useState(false);
  const [jsonText, setJsonText] = React.useState('');
  const [previewData, setPreviewData] = React.useState<PreviewItem[]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState({
    overwriteExisting: false,
    skipInvalid: true,
  });
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const importMutation = useImportExchangeRates();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      parseJson(text);
    };
    reader.readAsText(file);
  };

  const parseJson = (text: string) => {
    try {
      const data = JSON.parse(text);
      const items = data.items || data;
      if (!Array.isArray(items)) {
        throw new Error('Invalid format: expected array');
      }
      setPreviewData(items.slice(0, 10)); // 只預覽前 10 筆
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
      setPreviewData([]);
    }
  };

  const handleTextChange = (text: string) => {
    setJsonText(text);
    if (text.trim()) {
      parseJson(text);
    } else {
      setPreviewData([]);
      setParseError(null);
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(jsonText);
      const items = data.items || data;

      const response = await importMutation.mutateAsync({
        items,
        options,
      });

      setResult(response.data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleClose = () => {
    setOpen(false);
    // 重置狀態
    setTimeout(() => {
      setJsonText('');
      setPreviewData([]);
      setParseError(null);
      setResult(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          {t('actions.import')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
          <DialogDescription>
            {t('import.uploadFile')} {t('import.pasteJson')}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* 檔案上傳 */}
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted"
              >
                <FileJson className="h-4 w-4" />
                {t('import.uploadFile')}
              </label>
            </div>

            {/* JSON 文字輸入 */}
            <Textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder='{"items": [{"fromCurrency": "HKD", "toCurrency": "USD", "rate": 0.128, "effectiveYear": 2026}]}'
              rows={6}
            />

            {/* 解析錯誤 */}
            {parseError && (
              <Alert variant="destructive">
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* 預覽 */}
            {previewData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t('import.preview')} ({t('import.previewCount', { count: previewData.length })})
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{item.fromCurrency}</TableCell>
                        <TableCell className="font-mono">{item.toCurrency}</TableCell>
                        <TableCell className="font-mono">{item.rate}</TableCell>
                        <TableCell>{item.effectiveYear}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 選項 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('import.options')}</h4>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwrite"
                  checked={options.overwriteExisting}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, overwriteExisting: checked as boolean })
                  }
                />
                <label htmlFor="overwrite" className="text-sm">
                  {t('import.overwriteExisting')}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skipInvalid"
                  checked={options.skipInvalid}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, skipInvalid: checked as boolean })
                  }
                />
                <label htmlFor="skipInvalid" className="text-sm">
                  {t('import.skipInvalid')}
                </label>
              </div>
            </div>

            {/* 按鈕 */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                {t('form.cancel')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!previewData.length || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('import.submit')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-lg font-medium">{t('import.result.title')}</h4>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-100 dark:bg-green-900">
                <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                <div className="text-sm text-green-600">{t('import.result.imported')}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-100 dark:bg-blue-900">
                <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
                <div className="text-sm text-blue-600">{t('import.result.updated')}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                <div className="text-sm text-yellow-600">{t('import.result.skipped')}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-100 dark:bg-red-900">
                <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                <div className="text-sm text-red-600">{t('import.result.errors')}</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">{t('import.result.errors')}:</h5>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((error, index) => (
                    <div key={index} className="text-sm text-destructive flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Row {error.index + 1}: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 4: Hooks 擴展 (0.5 points)

```typescript
// src/hooks/use-exchange-rates.ts (擴展)

export function useImportExchangeRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      items: unknown[];
      options: { overwriteExisting: boolean; skipInvalid: boolean };
    }) => {
      const res = await fetch('/api/v1/exchange-rates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to import');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useExportExchangeRates() {
  return useMutation({
    mutationFn: async (params: { year?: number; isActive?: boolean } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.year) searchParams.set('year', params.year.toString());
      if (params.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());

      const res = await fetch(`/api/v1/exchange-rates/export?${searchParams}`);
      if (!res.ok) throw new Error('Failed to export');
      return res.json();
    },
  });
}
```

---

## File Structure

```
src/components/features/exchange-rate/
├── ExchangeRateCalculator.tsx       # 新增
├── ExchangeRateImportDialog.tsx     # 新增
└── index.ts                         # 更新
```

---

## Testing Checklist

- [ ] 計算器正確計算直接匯率
- [ ] 計算器正確計算反向匯率
- [ ] 計算器正確計算交叉匯率
- [ ] 計算器找不到匯率時顯示錯誤
- [ ] 導入對話框正確解析 JSON 檔案
- [ ] 導入對話框正確解析貼上的 JSON
- [ ] 導入預覽正確顯示
- [ ] 導入選項正常運作
- [ ] 導入結果正確顯示統計
- [ ] 導入錯誤詳情正確顯示
- [ ] 導出功能正確下載 JSON
- [ ] i18n 翻譯正確
