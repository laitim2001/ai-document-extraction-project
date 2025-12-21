'use client'

/**
 * @fileoverview 恢復詳情對話框組件
 * @description
 *   顯示恢復操作的完整詳情，包含：
 *   - 恢復狀態與進度
 *   - 恢復配置資訊
 *   - 即時日誌串流
 *   - 操作按鈕（取消/回滾）
 *
 * @module src/components/features/admin/restore/RestoreDetailDialog
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Database,
  FileText,
  Settings,
  Layers,
  RotateCcw,
  Terminal,
  RefreshCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useRestoreRecordPolling,
  useRestoreLogsPolling,
  useCancelRestore,
  useRollbackRestore,
} from '@/hooks/use-restore'
import {
  getRestoreStatusInfo,
  getRestoreTypeInfo,
  getRestoreScopeInfo,
  isActiveRestoreStatus,
  RESTORE_STATUS_CONFIG,
} from '@/types/restore'
import type { RestoreStatus, RestoreLogEntry, RestoreScope } from '@/types/restore'

// ============================================================
// Types
// ============================================================

interface RestoreDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restoreId: string | null
}

// ============================================================
// Component
// ============================================================

/**
 * 恢復詳情對話框組件
 */
export function RestoreDetailDialog({
  open,
  onOpenChange,
  restoreId,
}: RestoreDetailDialogProps) {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'details' | 'logs'>('details')
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [rollbackConfirmText, setRollbackConfirmText] = useState('')

  const logsEndRef = useRef<HTMLDivElement>(null)

  // --- Hooks ---
  const { data: restoreData, isLoading, refetch } = useRestoreRecordPolling(
    restoreId ?? '',
    {
      enabled: open && !!restoreId,
      polling: true,
      pollingInterval: 2000,
    }
  )

  const { data: logsData, isLoading: logsLoading } = useRestoreLogsPolling(
    restoreId ?? '',
    {
      enabled: open && !!restoreId && activeTab === 'logs',
      polling: true,
      pollingInterval: 2000,
    }
  )

  const cancelMutation = useCancelRestore()
  const rollbackMutation = useRollbackRestore()

  // --- Computed ---
  // Extract the record from the response
  const record = restoreData?.data?.record
  const logs = logsData?.data?.logs ?? []

  const isActive = useMemo(() => {
    if (!record) return false
    return isActiveRestoreStatus(record.status)
  }, [record])

  const canCancel = useMemo(() => {
    if (!record) return false
    return ['PENDING', 'VALIDATING', 'PRE_BACKUP'].includes(record.status)
  }, [record])

  const canRollback = useMemo(() => {
    if (!record) return false
    return record.status === 'COMPLETED' && !!record.preRestoreBackupId
  }, [record])

  const isRollbackConfirmValid = rollbackConfirmText === 'ROLLBACK-CONFIRM'

  // --- Effects ---
  useEffect(() => {
    if (open) {
      setActiveTab('details')
      setRollbackConfirmText('')
    }
  }, [open])

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, activeTab])

  // --- Handlers ---
  const handleCancel = useCallback(async () => {
    if (!restoreId) return

    try {
      await cancelMutation.mutateAsync(restoreId)
      setCancelDialogOpen(false)
      refetch()
    } catch {
      // Error handled by mutation
    }
  }, [restoreId, cancelMutation, refetch])

  const handleRollback = useCallback(async () => {
    if (!restoreId || !isRollbackConfirmValid) return

    try {
      await rollbackMutation.mutateAsync({
        id: restoreId,
        request: { confirmationText: rollbackConfirmText },
      })
      setRollbackDialogOpen(false)
      setRollbackConfirmText('')
      refetch()
    } catch {
      // Error handled by mutation
    }
  }, [restoreId, isRollbackConfirmValid, rollbackConfirmText, rollbackMutation, refetch])

  // --- Render Helpers ---
  const renderStatusBadge = (status: RestoreStatus) => {
    const info = getRestoreStatusInfo(status)
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      primary: 'default',
      warning: 'secondary',
      destructive: 'destructive',
      success: 'outline',
    }

    return (
      <Badge variant={variantMap[info.variant] || 'outline'} className="ml-2">
        {info.label}
      </Badge>
    )
  }

  const renderStatusIcon = (status: RestoreStatus) => {
    const iconMap: Record<RestoreStatus, React.ReactNode> = {
      PENDING: <Clock className="h-5 w-5 text-muted-foreground" />,
      VALIDATING: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
      PRE_BACKUP: <Database className="h-5 w-5 text-primary animate-pulse" />,
      IN_PROGRESS: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
      VERIFYING: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
      COMPLETED: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      FAILED: <XCircle className="h-5 w-5 text-destructive" />,
      CANCELLED: <XCircle className="h-5 w-5 text-muted-foreground" />,
      ROLLED_BACK: <RotateCcw className="h-5 w-5 text-yellow-500" />,
    }

    return iconMap[status] || null
  }

  const renderScopeIcon = (scope: RestoreScope) => {
    const iconMap: Record<RestoreScope, React.ReactNode> = {
      DATABASE: <Database className="h-4 w-4" />,
      FILES: <FileText className="h-4 w-4" />,
      CONFIG: <Settings className="h-4 w-4" />,
      ALL: <Layers className="h-4 w-4" />,
    }

    return iconMap[scope] || null
  }

  const getLogLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-red-500'
      case 'WARN':
        return 'text-yellow-500'
      case 'INFO':
        return 'text-blue-500'
      case 'DEBUG':
        return 'text-gray-500'
      default:
        return 'text-foreground'
    }
  }

  const renderLogEntry = (log: RestoreLogEntry, index: number) => {
    const timestamp = log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss.SSS') : ''

    return (
      <div
        key={log.id || index}
        className="flex gap-2 py-1 font-mono text-xs border-b border-muted last:border-0"
      >
        <span className="text-muted-foreground w-24 flex-shrink-0">{timestamp}</span>
        <span className={`w-12 flex-shrink-0 font-medium ${getLogLevelColor(log.level)}`}>
          [{log.level.toUpperCase()}]
        </span>
        <span className="flex-1 whitespace-pre-wrap break-all">{log.message}</span>
      </div>
    )
  }

  const renderDetails = () => {
    if (!record) return null

    const statusConfig = RESTORE_STATUS_CONFIG[record.status]
    const scopeArray = Array.isArray(record.scope) ? record.scope : [record.scope]

    return (
      <div className="space-y-4">
        {/* 狀態與進度 */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {renderStatusIcon(record.status)}
            <div>
              <div className="flex items-center">
                <span className="font-medium">恢復狀態</span>
                {renderStatusBadge(record.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {statusConfig.description}
              </p>
            </div>
          </div>
          {isActive && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新整理
            </Button>
          )}
        </div>

        {/* 進度條 */}
        {record.progress !== null && record.progress !== undefined && isActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>恢復進度</span>
              <span>{record.progress}%</span>
            </div>
            <Progress value={record.progress} className="h-2" />
          </div>
        )}

        {/* 錯誤訊息 */}
        {record.status === 'FAILED' && record.errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>恢復失敗</AlertTitle>
            <AlertDescription>{record.errorMessage}</AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* 恢復配置 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">恢復類型</div>
            <div className="flex items-center gap-2">
              <span>{getRestoreTypeInfo(record.type).icon}</span>
              <span className="font-medium">{getRestoreTypeInfo(record.type).label}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">恢復範圍</div>
            <div className="flex items-center gap-2 flex-wrap">
              {scopeArray.map((scope) => (
                <div key={scope} className="flex items-center gap-1">
                  {renderScopeIcon(scope)}
                  <span className="font-medium text-sm">{getRestoreScopeInfo(scope).label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">備份來源</div>
            <div className="font-medium truncate">
              {record.backup?.name || record.backupId}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">操作者</div>
            <div className="font-medium">{record.createdByUser?.name || '-'}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">開始時間</div>
            <div className="font-medium">
              {record.startedAt
                ? format(new Date(record.startedAt), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })
                : '-'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">完成時間</div>
            <div className="font-medium">
              {record.completedAt
                ? format(new Date(record.completedAt), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })
                : '-'}
            </div>
          </div>
        </div>

        {/* 預恢復備份資訊 */}
        {record.preRestoreBackupId && (
          <>
            <Separator />
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4" />
                <span className="font-medium">預恢復備份已建立</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ID: {record.preRestoreBackupId}
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderLogs = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="h-4 w-4" />
          恢復日誌
          {isActive && <Badge variant="outline" className="ml-2">即時更新中</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{logs.length} 條記錄</span>
      </div>

      <div className="border rounded-md bg-muted/30">
        {logsLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">載入日誌...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暫無日誌記錄
          </div>
        ) : (
          <ScrollArea className="h-[300px] p-3">
            {logs.map((log, index) => renderLogEntry(log, index))}
            <div ref={logsEndRef} />
          </ScrollArea>
        )}
      </div>
    </div>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>恢復操作詳情</DialogTitle>
            <DialogDescription>
              查看恢復操作的詳細資訊與進度
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-3">載入中...</span>
            </div>
          ) : record ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'logs')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">詳情</TabsTrigger>
                <TabsTrigger value="logs">日誌</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4">
                {renderDetails()}
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                {renderLogs()}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              找不到恢復記錄
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {canCancel && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  取消恢復
                </Button>
              )}
              {canRollback && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRollbackDialogOpen(true)}
                  disabled={rollbackMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  回滾恢復
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取消確認對話框 */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認取消恢復操作？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將取消正在等待執行的恢復任務。如果恢復已經開始執行，可能無法完全取消。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  取消中...
                </>
              ) : (
                '確認取消'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 回滾確認對話框 */}
      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認回滾恢復操作？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將使用預恢復備份將系統回滾到恢復操作之前的狀態。這是一個破壞性操作，請謹慎確認。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="rollbackConfirm">
              請輸入 <code className="px-1 py-0.5 bg-muted rounded font-mono">ROLLBACK-CONFIRM</code> 以確認
            </Label>
            <Input
              id="rollbackConfirm"
              value={rollbackConfirmText}
              onChange={(e) => setRollbackConfirmText(e.target.value)}
              placeholder="ROLLBACK-CONFIRM"
              className={`mt-2 ${
                rollbackConfirmText && !isRollbackConfirmValid
                  ? 'border-destructive'
                  : isRollbackConfirmValid
                    ? 'border-green-500'
                    : ''
              }`}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRollbackConfirmText('')}>
              返回
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={!isRollbackConfirmValid || rollbackMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rollbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  回滾中...
                </>
              ) : (
                '確認回滾'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default RestoreDetailDialog
