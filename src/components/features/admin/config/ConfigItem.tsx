'use client'

/**
 * @fileoverview 配置項目組件
 * @description
 *   顯示單一配置項目的詳細資訊，包含值、類型、狀態標籤和操作按鈕。
 *
 * @module src/components/features/admin/config/ConfigItem
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/components/features/admin/config/ConfigEditDialog.tsx - 編輯對話框
 *   - src/components/features/admin/config/ConfigHistoryDialog.tsx - 歷史對話框
 */

import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { History, RotateCcw, Edit2, Lock, Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ConfigValue, ConfigEffectType } from '@/types/config'
import { EFFECT_TYPE_INFO } from '@/types/config'

// ============================================================
// Types
// ============================================================

interface ConfigItemProps {
  /** 配置項目 */
  config: ConfigValue
  /** 編輯回調 */
  onEdit: () => void
  /** 查看歷史回調 */
  onViewHistory: () => void
  /** 重置為預設值回調 */
  onResetToDefault: () => void
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化顯示值
 * @param value - 配置值
 * @returns 格式化後的字串
 */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '(未設定)'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * 獲取效果類型的徽章樣式
 * @param effectType - 效果類型
 * @returns Badge variant
 */
function getEffectBadgeVariant(
  effectType: ConfigEffectType
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (effectType) {
    case 'IMMEDIATE':
      return 'default'
    case 'RESTART_REQUIRED':
      return 'destructive'
    case 'SCHEDULED':
      return 'secondary'
    default:
      return 'outline'
  }
}

// ============================================================
// Component
// ============================================================

/**
 * 配置項目組件
 *
 * @description
 *   顯示單一配置項目，包含：
 *   - 名稱和描述
 *   - 當前值和預設值
 *   - 類型標籤（唯讀、加密、已修改、效果類型）
 *   - 驗證規則提示
 *   - 影響說明
 *   - 操作按鈕（查看歷史、重置、編輯）
 */
export function ConfigItem({
  config,
  onEdit,
  onViewHistory,
  onResetToDefault,
}: ConfigItemProps) {
  const effectInfo = EFFECT_TYPE_INFO[config.effectType]

  return (
    <div className="px-6 py-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* 左側：配置資訊 */}
        <div className="flex-1 min-w-0">
          {/* 名稱與標籤 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{config.name}</span>

            {config.isReadOnly && (
              <Badge variant="secondary" className="text-xs">
                <Lock className="w-3 h-3 mr-1" />
                唯讀
              </Badge>
            )}

            {config.isEncrypted && (
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                <Shield className="w-3 h-3 mr-1" />
                加密
              </Badge>
            )}

            {config.isModified && (
              <Badge variant="default" className="text-xs">
                已修改
              </Badge>
            )}

            {config.effectType !== 'IMMEDIATE' && (
              <Badge variant={getEffectBadgeVariant(config.effectType)} className="text-xs">
                {effectInfo.label}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>

          {/* 當前值 */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">目前值:</span>
            <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
              {formatDisplayValue(config.value)}
            </code>
            {config.isModified && (
              <span className="text-xs text-muted-foreground">
                (預設: {formatDisplayValue(config.defaultValue)})
              </span>
            )}
          </div>

          {/* 驗證規則提示 */}
          {config.validation && (
            <div className="mt-1 text-xs text-muted-foreground">
              {config.validation.min !== undefined && config.validation.max !== undefined && (
                <span>範圍: {config.validation.min} - {config.validation.max}</span>
              )}
              {config.validation.options && (
                <span>選項: {config.validation.options.join(', ')}</span>
              )}
            </div>
          )}

          {/* 影響說明 */}
          {config.impactNote && (
            <div className="mt-2 flex items-start gap-1 text-xs text-orange-600">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{config.impactNote}</span>
            </div>
          )}

          {/* 更新資訊 */}
          {config.updatedBy && (
            <p className="mt-2 text-xs text-muted-foreground">
              最後更新: {config.updatedBy} (
              {formatDistanceToNow(new Date(config.updatedAt), {
                addSuffix: true,
                locale: zhTW,
              })}
              )
            </p>
          )}
        </div>

        {/* 右側：操作按鈕 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewHistory}
            title="查看變更歷史"
          >
            <History className="w-4 h-4" />
          </Button>

          {!config.isReadOnly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetToDefault}
                disabled={!config.isModified}
                title="重置為預設值"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={onEdit}
                title="編輯配置"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                編輯
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
