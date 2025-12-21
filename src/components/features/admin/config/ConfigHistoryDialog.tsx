'use client'

/**
 * @fileoverview 配置歷史對話框組件
 * @description
 *   顯示配置變更歷史記錄，支援分頁和回滾操作。
 *
 * @module src/components/features/admin/config/ConfigHistoryDialog
 * @author Development Team
 * @since Epic 12 - Story 12-4 (系統設定管理)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/components/features/admin/config/ConfigItem.tsx - 配置項目
 *   - src/hooks/use-system-config.ts - 配置 Hooks
 */

import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { RotateCcw, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ConfigHistoryItem } from '@/types/config'

// ============================================================
// Types
// ============================================================

interface ConfigHistoryDialogProps {
  /** 是否開啟 */
  open: boolean
  /** 關閉回調 */
  onOpenChange: (open: boolean) => void
  /** 配置鍵 */
  configKey: string
  /** 配置名稱 */
  configName: string
  /** 歷史記錄 */
  history: ConfigHistoryItem[]
  /** 是否正在載入 */
  isLoading?: boolean
  /** 回滾回調 */
  onRollback: (historyId: string) => void
  /** 是否正在回滾 */
  isRollingBack?: boolean
  /** 分頁資訊 */
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  /** 頁碼變更回調 */
  onPageChange?: (page: number) => void
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化顯示值
 */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '(空)'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

// ============================================================
// Component
// ============================================================

/**
 * 配置歷史對話框組件
 *
 * @description
 *   顯示配置的變更歷史，包含：
 *   - 變更時間和變更者
 *   - 變更前後的值對比
 *   - 變更原因
 *   - 回滾操作
 *   - 分頁支援
 */
export function ConfigHistoryDialog({
  open,
  onOpenChange,
  configKey,
  configName,
  history,
  isLoading = false,
  onRollback,
  isRollingBack = false,
  pagination,
  onPageChange,
}: ConfigHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>配置變更歷史</DialogTitle>
          <DialogDescription>
            {configName} ({configKey})
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">載入歷史記錄...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暫無變更記錄
            </div>
          ) : (
            <ScrollArea className="h-[50vh]">
              <div className="space-y-4 pr-4">
                {history.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-lg ${
                      index === 0 && pagination?.page === 1
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        {/* 時間與標籤 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {format(new Date(item.changedAt), 'yyyy-MM-dd HH:mm:ss', {
                              locale: zhTW,
                            })}
                          </span>
                          {index === 0 && pagination?.page === 1 && (
                            <Badge variant="default" className="text-xs">
                              目前版本
                            </Badge>
                          )}
                          {item.isRollback && (
                            <Badge variant="secondary" className="text-xs">
                              回滾
                            </Badge>
                          )}
                        </div>

                        {/* 變更者 */}
                        <p className="text-sm text-muted-foreground">
                          變更者: {item.changedBy}
                        </p>

                        {/* 變更原因 */}
                        {item.changeReason && (
                          <p className="text-sm text-foreground/80">
                            原因: {item.changeReason}
                          </p>
                        )}
                      </div>

                      {/* 回滾按鈕（不顯示在目前版本上） */}
                      {!(index === 0 && pagination?.page === 1) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRollback(item.id)}
                          disabled={isRollingBack}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50 flex-shrink-0"
                        >
                          {isRollingBack ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4 mr-1" />
                          )}
                          回滾到此版本
                        </Button>
                      )}
                    </div>

                    {/* 值變更對比 */}
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          變更前
                        </span>
                        <code className="block p-2 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 rounded text-sm font-mono break-all whitespace-pre-wrap max-h-24 overflow-auto">
                          {formatDisplayValue(item.previousValue)}
                        </code>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          變更後
                        </span>
                        <code className="block p-2 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 rounded text-sm font-mono break-all whitespace-pre-wrap max-h-24 overflow-auto">
                          {formatDisplayValue(item.newValue)}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* 分頁控制 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              第 {pagination.page} / {pagination.totalPages} 頁，共 {pagination.total} 筆
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                上一頁
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
              >
                下一頁
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 關閉按鈕 */}
        {!pagination || pagination.totalPages <= 1 ? (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              關閉
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
