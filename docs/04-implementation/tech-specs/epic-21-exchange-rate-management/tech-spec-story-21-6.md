# Tech Spec: Story 21.6 - 管理頁面：列表與篩選

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-6

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.6 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | Story 21-3 |
| **Blocking** | Story 21-7 |

---

## Objective

建立匯率管理的列表頁面，包含篩選器、分頁、快速操作功能。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.6.1 | 列表頁面 | /admin/exchange-rates/page.tsx |
| AC-21.6.2 | 篩選器 | ExchangeRateFilters 組件 |
| AC-21.6.3 | 分頁和排序 | DataTable 整合 |
| AC-21.6.4 | 快速操作 | Toggle/Edit/Delete |
| AC-21.6.5 | i18n 支援 | exchangeRate.json |

---

## Implementation Guide

### Phase 1: i18n 翻譯 (0.5 points)

```json
// messages/en/exchangeRate.json
{
  "title": "Exchange Rates",
  "description": "Manage currency exchange rates",
  "list": {
    "fromCurrency": "From",
    "toCurrency": "To",
    "rate": "Rate",
    "effectiveYear": "Year",
    "source": "Source",
    "status": "Status",
    "actions": "Actions",
    "empty": "No exchange rates found",
    "hasInverse": "Has inverse"
  },
  "filters": {
    "year": "Year",
    "fromCurrency": "From Currency",
    "toCurrency": "To Currency",
    "status": "Status",
    "source": "Source",
    "all": "All",
    "active": "Active",
    "inactive": "Inactive"
  },
  "source": {
    "MANUAL": "Manual",
    "IMPORTED": "Imported",
    "AUTO_INVERSE": "Auto Inverse"
  },
  "actions": {
    "add": "Add Exchange Rate",
    "edit": "Edit",
    "delete": "Delete",
    "toggle": "Toggle Status",
    "export": "Export",
    "import": "Import"
  },
  "messages": {
    "created": "Exchange rate created successfully",
    "updated": "Exchange rate updated successfully",
    "deleted": "Exchange rate deleted successfully",
    "toggled": "Status toggled successfully",
    "confirmDelete": "Are you sure you want to delete this exchange rate?"
  }
}
```

```json
// messages/zh-TW/exchangeRate.json
{
  "title": "匯率管理",
  "description": "管理貨幣匯率記錄",
  "list": {
    "fromCurrency": "來源貨幣",
    "toCurrency": "目標貨幣",
    "rate": "匯率",
    "effectiveYear": "年份",
    "source": "來源",
    "status": "狀態",
    "actions": "操作",
    "empty": "尚無匯率記錄",
    "hasInverse": "有反向"
  },
  "filters": {
    "year": "年份",
    "fromCurrency": "來源貨幣",
    "toCurrency": "目標貨幣",
    "status": "狀態",
    "source": "來源",
    "all": "全部",
    "active": "啟用",
    "inactive": "停用"
  },
  "source": {
    "MANUAL": "手動輸入",
    "IMPORTED": "批次匯入",
    "AUTO_INVERSE": "自動反向"
  },
  "actions": {
    "add": "新增匯率",
    "edit": "編輯",
    "delete": "刪除",
    "toggle": "切換狀態",
    "export": "導出",
    "import": "導入"
  },
  "messages": {
    "created": "匯率建立成功",
    "updated": "匯率更新成功",
    "deleted": "匯率刪除成功",
    "toggled": "狀態切換成功",
    "confirmDelete": "確定要刪除此匯率記錄嗎？"
  }
}
```

### Phase 2: CurrencySelect 組件 (1 point)

```typescript
// src/components/features/exchange-rate/CurrencySelect.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { COMMON_CURRENCIES } from '@/types/exchange-rate';

interface CurrencySelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelect({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CurrencySelectProps) {
  const t = useTranslations('exchangeRate');
  const [open, setOpen] = React.useState(false);

  const selectedCurrency = COMMON_CURRENCIES.find(c => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          {selectedCurrency ? (
            <span>{selectedCurrency.code} - {selectedCurrency.name}</span>
          ) : (
            <span className="text-muted-foreground">
              {placeholder || t('filters.all')}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search currency..." />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {COMMON_CURRENCIES.map((currency) => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name}`}
                  onSelect={() => {
                    onChange(currency.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === currency.code ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono mr-2">{currency.code}</span>
                  <span className="text-muted-foreground">{currency.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Phase 3: ExchangeRateFilters 組件 (0.5 points)

```typescript
// src/components/features/exchange-rate/ExchangeRateFilters.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencySelect } from './CurrencySelect';

interface ExchangeRateFiltersProps {
  filters: {
    year?: number;
    fromCurrency?: string;
    toCurrency?: string;
    isActive?: boolean;
    source?: string;
  };
  onFiltersChange: (filters: ExchangeRateFiltersProps['filters']) => void;
}

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

export function ExchangeRateFilters({
  filters,
  onFiltersChange,
}: ExchangeRateFiltersProps) {
  const t = useTranslations('exchangeRate');

  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {/* 年份 */}
      <Select
        value={filters.year?.toString() || 'all'}
        onValueChange={(v) => onFiltersChange({
          ...filters,
          year: v === 'all' ? undefined : Number(v),
        })}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t('filters.year')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all')}</SelectItem>
          {YEARS.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 來源貨幣 */}
      <CurrencySelect
        value={filters.fromCurrency}
        onChange={(v) => onFiltersChange({ ...filters, fromCurrency: v || undefined })}
        placeholder={t('filters.fromCurrency')}
        className="w-[200px]"
      />

      {/* 目標貨幣 */}
      <CurrencySelect
        value={filters.toCurrency}
        onChange={(v) => onFiltersChange({ ...filters, toCurrency: v || undefined })}
        placeholder={t('filters.toCurrency')}
        className="w-[200px]"
      />

      {/* 狀態 */}
      <Select
        value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
        onValueChange={(v) => onFiltersChange({
          ...filters,
          isActive: v === 'all' ? undefined : v === 'true',
        })}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t('filters.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all')}</SelectItem>
          <SelectItem value="true">{t('filters.active')}</SelectItem>
          <SelectItem value="false">{t('filters.inactive')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 來源類型 */}
      <Select
        value={filters.source || 'all'}
        onValueChange={(v) => onFiltersChange({
          ...filters,
          source: v === 'all' ? undefined : v,
        })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t('filters.source')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all')}</SelectItem>
          <SelectItem value="MANUAL">{t('source.MANUAL')}</SelectItem>
          <SelectItem value="IMPORTED">{t('source.IMPORTED')}</SelectItem>
          <SelectItem value="AUTO_INVERSE">{t('source.AUTO_INVERSE')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

### Phase 4: ExchangeRateList 組件 (1 point)

```typescript
// src/components/features/exchange-rate/ExchangeRateList.tsx

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pencil, Trash2, ToggleLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useExchangeRates,
  useDeleteExchangeRate,
  useToggleExchangeRate,
} from '@/hooks/use-exchange-rates';
import { ExchangeRateFilters } from './ExchangeRateFilters';
import type { ExchangeRateWithRelations } from '@/types/exchange-rate';

export function ExchangeRateList() {
  const t = useTranslations('exchangeRate');
  const [filters, setFilters] = React.useState({});

  const { data, isLoading } = useExchangeRates(filters);
  const deleteMutation = useDeleteExchangeRate();
  const toggleMutation = useToggleExchangeRate();

  const items: ExchangeRateWithRelations[] = data?.data || [];

  const handleDelete = async (id: string) => {
    if (confirm(t('messages.confirmDelete'))) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  return (
    <div>
      <ExchangeRateFilters filters={filters} onFiltersChange={setFilters} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.fromCurrency')}</TableHead>
            <TableHead>{t('list.toCurrency')}</TableHead>
            <TableHead className="text-right">{t('list.rate')}</TableHead>
            <TableHead>{t('list.effectiveYear')}</TableHead>
            <TableHead>{t('list.source')}</TableHead>
            <TableHead>{t('list.status')}</TableHead>
            <TableHead className="w-[100px]">{t('list.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t('list.empty')}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.fromCurrency}</TableCell>
                <TableCell className="font-mono">{item.toCurrency}</TableCell>
                <TableCell className="text-right font-mono">
                  {Number(item.rate).toFixed(6)}
                </TableCell>
                <TableCell>{item.effectiveYear}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {t(`source.${item.source}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? 'default' : 'secondary'}>
                    {item.isActive ? t('filters.active') : t('filters.inactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/exchange-rates/${item.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t('actions.edit')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(item.id)}>
                        <ToggleLeft className="h-4 w-4 mr-2" />
                        {t('actions.toggle')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Phase 5: 列表頁面 (1 point)

```typescript
// src/app/[locale]/(dashboard)/admin/exchange-rates/page.tsx

import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Plus, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExchangeRateList } from '@/components/features/exchange-rate';

export default async function ExchangeRatesPage() {
  const t = await getTranslations('exchangeRate');

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            {t('actions.import')}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('actions.export')}
          </Button>
          <Button asChild>
            <Link href="/admin/exchange-rates/new">
              <Plus className="h-4 w-4 mr-2" />
              {t('actions.add')}
            </Link>
          </Button>
        </div>
      </div>

      <ExchangeRateList />
    </div>
  );
}
```

---

## File Structure

```
src/
├── app/[locale]/(dashboard)/admin/exchange-rates/
│   └── page.tsx                             # 新增
└── components/features/exchange-rate/
    ├── index.ts                             # 新增
    ├── ExchangeRateList.tsx                 # 新增
    ├── ExchangeRateFilters.tsx              # 新增
    └── CurrencySelect.tsx                   # 新增

messages/
├── en/exchangeRate.json                     # 新增
├── zh-TW/exchangeRate.json                  # 新增
└── zh-CN/exchangeRate.json                  # 新增
```

---

## Testing Checklist

- [ ] 列表頁面正確顯示匯率記錄
- [ ] 篩選器正確過濾資料
- [ ] 分頁功能正常
- [ ] 快速操作（編輯/刪除/切換）正常
- [ ] CurrencySelect 搜尋和選擇正常
- [ ] i18n 翻譯正確（en, zh-TW, zh-CN）
- [ ] 空狀態顯示正確
- [ ] 載入狀態顯示正確
