'use client'

/**
 * @fileoverview 模擬測試配置表單組件
 * @description
 *   提供模擬測試參數配置：
 *   - 樣本數量選擇
 *   - 日期範圍選擇
 *   - 是否包含未驗證文件
 *
 * @module src/components/features/suggestions/SimulationConfigForm
 * @since Epic 4 - Story 4.5 (規則影響範圍分析)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/button - shadcn Button 組件
 *   - @/components/ui/select - shadcn Select 組件
 *   - @/components/ui/switch - shadcn Switch 組件
 *   - @/components/ui/card - shadcn Card 組件
 *   - @/types/impact - 類型定義
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlayCircle, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SAMPLE_SIZE_OPTIONS, DATE_RANGE_OPTIONS } from '@/types/impact'
import type { SimulationConfigFormData } from '@/hooks/useSimulation'

// ============================================================
// Types
// ============================================================

interface SimulationConfigFormProps {
  /** 執行模擬回調 */
  onRun: (config: SimulationConfigFormData) => void
  /** 是否正在執行 */
  isRunning?: boolean
  /** 額外的 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 模擬測試配置表單
 *
 * @example
 * ```tsx
 * <SimulationConfigForm
 *   onRun={(config) => runSimulation(config)}
 *   isRunning={isPending}
 * />
 * ```
 */
export function SimulationConfigForm({
  onRun,
  isRunning = false,
  className,
}: SimulationConfigFormProps) {
  const t = useTranslations('ruleSimulation')
  const [sampleSize, setSampleSize] = useState<number>(100)
  const [dateRangeDays, setDateRangeDays] = useState<number>(30)
  const [includeUnverified, setIncludeUnverified] = useState<boolean>(false)

  const handleSubmit = () => {
    onRun({
      sampleSize,
      dateRangeDays,
      includeUnverified,
    })
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-muted-foreground" />
          {t('simulation.config.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          {/* 樣本數量 */}
          <div className="space-y-2">
            <Label htmlFor="sampleSize">{t('simulation.config.sampleSize')}</Label>
            <Select
              value={sampleSize.toString()}
              onValueChange={(value) => setSampleSize(Number(value))}
              disabled={isRunning}
            >
              <SelectTrigger id="sampleSize">
                <SelectValue placeholder={t('simulation.config.sampleSizePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {t(`simulation.config.sampleSizeOptions.${option.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 日期範圍 */}
          <div className="space-y-2">
            <Label htmlFor="dateRange">{t('simulation.config.dateRange')}</Label>
            <Select
              value={dateRangeDays.toString()}
              onValueChange={(value) => setDateRangeDays(Number(value))}
              disabled={isRunning}
            >
              <SelectTrigger id="dateRange">
                <SelectValue placeholder={t('simulation.config.dateRangePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {t(`simulation.config.dateRangeOptions.${option.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 包含未驗證文件 */}
          <div className="space-y-2">
            <Label htmlFor="includeUnverified">{t('simulation.config.includeUnverified')}</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="includeUnverified"
                checked={includeUnverified}
                onCheckedChange={setIncludeUnverified}
                disabled={isRunning}
              />
              <Label
                htmlFor="includeUnverified"
                className={cn(
                  'text-sm font-normal cursor-pointer',
                  isRunning && 'cursor-not-allowed opacity-50'
                )}
              >
                {includeUnverified ? t('simulation.config.yes') : t('simulation.config.no')}
              </Label>
            </div>
          </div>
        </div>

        {/* 執行按鈕 */}
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} disabled={isRunning}>
            <PlayCircle className="h-4 w-4 mr-2" />
            {isRunning ? t('simulation.config.running') : t('simulation.config.run')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
