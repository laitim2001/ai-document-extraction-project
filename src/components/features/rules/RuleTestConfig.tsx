'use client'

/**
 * @fileoverview 規則測試配置組件
 * @description
 *   Story 5-4: 測試規則變更效果 - 測試配置表單
 *   提供測試範圍和參數的配置介面：
 *   - 測試範圍選擇（最近 N 筆、指定文件、日期範圍、全部）
 *   - 測試數量限制
 *   - 日期範圍選擇
 *
 * @module src/components/features/rules/RuleTestConfig
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/* - shadcn UI 組件
 *   - @/types/rule-test - 類型定義
 */

import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Loader2, Play } from 'lucide-react'
import type { TestConfig, TestScope } from '@/types/rule-test'
import { TEST_SCOPES } from '@/types/rule-test'

// ============================================================
// Types
// ============================================================

interface RuleTestConfigProps {
  /** 當前配置 */
  config: TestConfig
  /** 配置變更回調 */
  onConfigChange: (config: TestConfig) => void
  /** 啟動測試回調 */
  onStartTest: () => void
  /** 是否正在載入 */
  isLoading?: boolean
  /** 是否禁用 */
  disabled?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * 規則測試配置組件
 *
 * @example
 * ```tsx
 * <RuleTestConfig
 *   config={{ scope: 'recent', recentCount: 100 }}
 *   onConfigChange={setConfig}
 *   onStartTest={handleStartTest}
 *   isLoading={isPending}
 * />
 * ```
 */
export function RuleTestConfig({
  config,
  onConfigChange,
  onStartTest,
  isLoading = false,
  disabled = false,
}: RuleTestConfigProps) {
  // --- Handlers ---

  const handleScopeChange = (scope: TestScope) => {
    const newConfig: TestConfig = { ...config, scope }

    // 根據範圍設置預設值
    if (scope === 'recent' && !config.recentCount) {
      newConfig.recentCount = 100
    }

    onConfigChange(newConfig)
  }

  const handleRecentCountChange = (value: string) => {
    const count = parseInt(value, 10)
    if (!isNaN(count) && count > 0) {
      onConfigChange({ ...config, recentCount: count })
    }
  }

  const handleMaxDocumentsChange = (value: string) => {
    const count = parseInt(value, 10)
    if (!isNaN(count) && count > 0) {
      onConfigChange({ ...config, maxDocuments: count })
    } else {
      // 清除限制
      const { maxDocuments: _unused, ...rest } = config
      void _unused // Suppress unused variable warning
      onConfigChange(rest)
    }
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    onConfigChange({
      ...config,
      dateRange: {
        start: field === 'start' ? value : config.dateRange?.start || '',
        end: field === 'end' ? value : config.dateRange?.end || '',
      },
    })
  }

  // --- Validation ---

  const isConfigValid = () => {
    switch (config.scope) {
      case 'recent':
        return config.recentCount && config.recentCount > 0
      case 'specific':
        return config.documentIds && config.documentIds.length > 0
      case 'date_range':
        return config.dateRange?.start && config.dateRange?.end
      case 'all':
        return true
      default:
        return false
    }
  }

  // --- Render ---

  return (
    <Card>
      <CardHeader>
        <CardTitle>測試配置</CardTitle>
        <CardDescription>選擇要測試的文件範圍和相關參數</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 測試範圍選擇 */}
        <div className="space-y-3">
          <Label className="text-base">測試範圍</Label>
          <RadioGroup
            value={config.scope}
            onValueChange={(v) => handleScopeChange(v as TestScope)}
            className="grid gap-3"
          >
            {TEST_SCOPES.map((scope) => (
              <div key={scope.value} className="flex items-start space-x-3">
                <RadioGroupItem
                  value={scope.value}
                  id={scope.value}
                  disabled={disabled}
                />
                <div className="grid gap-1">
                  <Label htmlFor={scope.value} className="font-medium">
                    {scope.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {scope.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* 最近 N 筆配置 */}
        {config.scope === 'recent' && (
          <div className="space-y-2">
            <Label htmlFor="recentCount">文件數量</Label>
            <Input
              id="recentCount"
              type="number"
              min={1}
              max={1000}
              value={config.recentCount || 100}
              onChange={(e) => handleRecentCountChange(e.target.value)}
              disabled={disabled}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              測試最近處理的 N 筆文件（最多 1000）
            </p>
          </div>
        )}

        {/* 日期範圍配置 */}
        {config.scope === 'date_range' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={config.dateRange?.start || ''}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">結束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={config.dateRange?.end || ''}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* 最大文件數限制 */}
        {(config.scope === 'all' || config.scope === 'date_range') && (
          <div className="space-y-2">
            <Label htmlFor="maxDocuments">最大測試數（選填）</Label>
            <Input
              id="maxDocuments"
              type="number"
              min={1}
              max={10000}
              value={config.maxDocuments || ''}
              onChange={(e) => handleMaxDocumentsChange(e.target.value)}
              placeholder="不限制"
              disabled={disabled}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              限制測試文件的最大數量，留空表示不限制
            </p>
          </div>
        )}

        {/* 啟動按鈕 */}
        <div className="pt-4">
          <Button
            onClick={onStartTest}
            disabled={disabled || isLoading || !isConfigValid()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                啟動測試中...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                啟動測試
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
