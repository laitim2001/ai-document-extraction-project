'use client'

/**
 * @fileoverview Exchange Rate Calculator 匯率計算器組件
 * @description
 *   提供即時匯率計算功能：
 *   - 選擇來源和目標貨幣
 *   - 輸入金額
 *   - 即時顯示轉換結果
 *   - 顯示使用的匯率和轉換路徑
 *   - 支援貨幣交換
 *
 * @module src/components/features/exchange-rate/ExchangeRateCalculator
 * @since Epic 21 - Story 21.8 (Management Page - Calculator & Import)
 * @lastModified 2026-02-06
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui - UI 組件
 *   - @/hooks/use-exchange-rates - 匯率 API Hooks
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Calculator, Loader2, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { CurrencySelect } from './CurrencySelect'
import { useConvertCurrency } from '@/hooks/use-exchange-rates'
import type { ConvertResult } from '@/types/exchange-rate'

// ============================================================
// Types
// ============================================================

interface ExchangeRateCalculatorProps {
  /** 自定義樣式類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 匯率計算器組件
 *
 * @description
 *   提供即時匯率計算功能，整合 Convert API。
 *   支援直接匹配、反向計算和交叉匯率轉換。
 *
 * @param props - 組件屬性
 * @returns React 元素
 *
 * @example
 *   <ExchangeRateCalculator />
 */
export function ExchangeRateCalculator({ className }: ExchangeRateCalculatorProps) {
  const t = useTranslations('exchangeRate')

  // --- State ---
  const [fromCurrency, setFromCurrency] = React.useState('')
  const [toCurrency, setToCurrency] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [result, setResult] = React.useState<ConvertResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // --- Hooks ---
  const convertMutation = useConvertCurrency()

  // --- Handlers ---
  const handleCalculate = React.useCallback(() => {
    if (!fromCurrency || !toCurrency || !amount) return

    setError(null)
    setResult(null)

    convertMutation.mutate(
      {
        fromCurrency,
        toCurrency,
        amount: Number(amount),
      },
      {
        onSuccess: (data) => {
          setResult(data)
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : t('calculator.noRate'))
        },
      }
    )
  }, [fromCurrency, toCurrency, amount, convertMutation, t])

  const handleSwap = React.useCallback(() => {
    const temp = fromCurrency
    setFromCurrency(toCurrency)
    setToCurrency(temp)
    setResult(null)
    setError(null)
  }, [fromCurrency, toCurrency])

  const handleAmountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAmount(e.target.value)
      setResult(null)
    },
    []
  )

  const handleFromCurrencyChange = React.useCallback((value: string) => {
    setFromCurrency(value)
    setResult(null)
  }, [])

  const handleToCurrencyChange = React.useCallback((value: string) => {
    setToCurrency(value)
    setResult(null)
  }, [])

  const canCalculate = fromCurrency && toCurrency && amount && Number(amount) > 0

  // --- Render ---
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          {t('calculator.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr_auto] gap-3 items-end">
          {/* From Currency */}
          <div className="space-y-2">
            <Label>{t('list.fromCurrency')}</Label>
            <CurrencySelect
              value={fromCurrency}
              onChange={handleFromCurrencyChange}
              placeholder={t('filters.all')}
            />
          </div>

          {/* Swap Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSwap}
            disabled={!fromCurrency && !toCurrency}
            className="mb-0.5"
            title={t('calculator.swap')}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>

          {/* To Currency */}
          <div className="space-y-2">
            <Label>{t('list.toCurrency')}</Label>
            <CurrencySelect
              value={toCurrency}
              onChange={handleToCurrencyChange}
              placeholder={t('filters.all')}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>{t('calculator.amount')}</Label>
            <Input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              placeholder="1000"
              min="0"
              step="0.01"
            />
          </div>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            disabled={!canCalculate || convertMutation.isPending}
            className="mb-0.5"
          >
            {convertMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t('calculator.calculate')}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Result Display */}
        {result && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="text-2xl font-bold">
              {result.amount.toLocaleString()} {result.fromCurrency}
              <ArrowRight className="inline h-5 w-5 mx-2 text-muted-foreground" />
              <span className="text-primary">
                {result.convertedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}{' '}
                {result.toCurrency}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                {t('calculator.rate')}: <span className="font-mono">{result.rate.toFixed(6)}</span>
              </span>
              <Badge variant="outline">
                {t('calculator.path')}: {result.path}
              </Badge>
              {result.effectiveYear && (
                <Badge variant="secondary">{result.effectiveYear}</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
