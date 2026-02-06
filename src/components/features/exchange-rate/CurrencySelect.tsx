'use client'

/**
 * @fileoverview Currency 貨幣選擇組件
 * @description
 *   提供貨幣選擇的下拉組件：
 *   - 使用 Combobox (Command + Popover) 實現
 *   - 支援搜尋過濾
 *   - 顯示貨幣代碼 + 名稱
 *   - 使用 ISO 4217 常用貨幣列表
 *
 * @module src/components/features/exchange-rate/CurrencySelect
 * @since Epic 21 - Story 21.6 (Management Page - List & Filter)
 * @lastModified 2026-02-06
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/command - 命令選單
 *   - @/components/ui/popover - 彈出框
 *   - @/components/ui/button - 按鈕
 *   - @/types/exchange-rate - 貨幣常數
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { COMMON_CURRENCIES } from '@/types/exchange-rate'

// ============================================================
// Types
// ============================================================

interface CurrencySelectProps {
  /** 當前選中的貨幣代碼 */
  value?: string
  /** 值變更回調 */
  onChange: (value: string) => void
  /** 佔位符文字 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定義樣式類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 貨幣選擇組件
 *
 * @param props - 組件屬性
 * @returns React 元素
 *
 * @example
 *   <CurrencySelect
 *     value={currency}
 *     onChange={(v) => setCurrency(v)}
 *     placeholder="Select currency"
 *   />
 */
export function CurrencySelect({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CurrencySelectProps) {
  const t = useTranslations('exchangeRate')
  const [open, setOpen] = React.useState(false)

  const selectedCurrency = COMMON_CURRENCIES.find((c) => c.code === value)

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
            <span className="flex items-center gap-2">
              <span className="font-mono">{selectedCurrency.code}</span>
              <span className="text-muted-foreground">
                {selectedCurrency.name}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {placeholder || t('filters.all')}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('currencySelect.search')} />
          <CommandList>
            <CommandEmpty>{t('currencySelect.empty')}</CommandEmpty>
            <CommandGroup>
              {/* 「全部」選項 */}
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="text-muted-foreground">{t('filters.all')}</span>
              </CommandItem>
              {/* 貨幣選項 */}
              {COMMON_CURRENCIES.map((currency) => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name}`}
                  onSelect={() => {
                    onChange(currency.code)
                    setOpen(false)
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
  )
}
