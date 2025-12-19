'use client'

/**
 * @fileoverview 系統配置管理頁面
 * @description
 *   全局管理者配置管理介面：
 *   - 配置列表瀏覽
 *   - 配置編輯
 *   - 版本歷史查看
 *   - 配置回滾
 *   - 僅限全局管理者訪問
 *
 * @module src/app/(dashboard)/admin/config/page
 * @author Development Team
 * @since Epic 6 - Story 6.4 (Global Admin Full Access)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 配置分類篩選
 *   - 配置值編輯
 *   - 歷史版本查看
 *   - 版本回滾功能
 *   - 權限保護
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取與變更
 *   - lucide-react - 圖標
 *   - react-hook-form - 表單處理
 *   - zod - 驗證
 *
 * @related
 *   - src/app/api/admin/config/ - 配置 API
 *   - src/services/system-config.service.ts - 配置服務
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings,
  Edit,
  History,
  RotateCcw,
  Search,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

interface SystemConfig {
  id: string
  key: string
  value: Record<string, unknown>
  category: string
  scope: string
  description: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

interface ConfigHistoryItem {
  id: string
  version: number
  value: Record<string, unknown>
  changedBy: string
  changeReason: string | null
  changedAt: string
}

// ============================================================
// Constants
// ============================================================

const CATEGORIES = [
  { value: 'all', label: '全部分類' },
  { value: 'PROCESSING', label: '處理設定' },
  { value: 'NOTIFICATION', label: '通知設定' },
  { value: 'SECURITY', label: '安全設定' },
  { value: 'DISPLAY', label: '顯示設定' },
  { value: 'INTEGRATION', label: '整合設定' },
  { value: 'AI_MODEL', label: 'AI 模型設定' },
  { value: 'THRESHOLD', label: '閾值設定' },
]

const SCOPES = [
  { value: 'GLOBAL', label: '全局' },
  { value: 'REGION', label: '區域' },
  { value: 'CITY', label: '城市' },
]

// ============================================================
// Page Component
// ============================================================

/**
 * @page SystemConfigPage
 * @description 系統配置管理頁面
 */
export default function SystemConfigPage() {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()

  // --- State ---
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editConfig, setEditConfig] = useState<SystemConfig | null>(null)
  const [historyConfig, setHistoryConfig] = useState<SystemConfig | null>(null)
  const [rollbackInfo, setRollbackInfo] = useState<{
    config: SystemConfig
    targetVersion: number
  } | null>(null)

  // --- Queries ---
  const { data, isLoading } = useQuery({
    queryKey: ['admin-configs', selectedCategory],
    queryFn: async () => {
      const url =
        selectedCategory === 'all'
          ? '/api/admin/config'
          : `/api/admin/config?category=${selectedCategory}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
  })

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['config-history', historyConfig?.key],
    queryFn: async () => {
      if (!historyConfig) return null
      const response = await fetch(
        `/api/admin/config/${encodeURIComponent(historyConfig.key)}/history`
      )
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
    enabled: !!historyConfig,
  })

  // --- Mutations ---
  const updateMutation = useMutation({
    mutationFn: async (data: {
      key: string
      value: Record<string, unknown>
      changeReason?: string
    }) => {
      const response = await fetch(
        `/api/admin/config/${encodeURIComponent(data.key)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value: data.value,
            changeReason: data.changeReason,
          }),
        }
      )
      if (!response.ok) throw new Error('Failed to update')
      return response.json()
    },
    onSuccess: () => {
      toast.success('配置已更新')
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
      setEditConfig(null)
    },
    onError: () => {
      toast.error('更新失敗')
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: async (data: {
      key: string
      targetVersion: number
      reason: string
    }) => {
      const response = await fetch(
        `/api/admin/config/${encodeURIComponent(data.key)}/rollback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetVersion: data.targetVersion,
            reason: data.reason,
          }),
        }
      )
      if (!response.ok) throw new Error('Failed to rollback')
      return response.json()
    },
    onSuccess: () => {
      toast.success('已回滾至指定版本')
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
      setRollbackInfo(null)
      setHistoryConfig(null)
    },
    onError: () => {
      toast.error('回滾失敗')
    },
  })

  // --- Auth Check ---
  if (status === 'loading') {
    return <ConfigPageSkeleton />
  }

  if (!session?.user) {
    redirect('/login')
  }

  if (!session.user.isGlobalAdmin) {
    redirect('/dashboard')
  }

  // --- Filter Configs ---
  const configs: SystemConfig[] = data?.data?.configs || []
  const filteredConfigs = configs.filter(
    (config) =>
      config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      config.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-gray-600" />
            系統配置管理
          </h1>
          <p className="text-muted-foreground mt-1">
            管理全系統配置參數，支持版本控制與回滾
          </p>
        </div>
      </div>

      {/* 篩選與搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索配置鍵或描述..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 配置列表 */}
      <Card>
        <CardHeader>
          <CardTitle>配置列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              沒有找到配置項目
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>配置鍵</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead>範圍</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{config.key}</p>
                        {config.description && (
                          <p className="text-xs text-muted-foreground">
                            {config.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {
                          CATEGORIES.find((c) => c.value === config.category)
                            ?.label
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {SCOPES.find((s) => s.value === config.scope)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>v{config.version}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditConfig(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryConfig(config)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 編輯對話框 */}
      <EditConfigDialog
        config={editConfig}
        onClose={() => setEditConfig(null)}
        onSave={(value, reason) => {
          if (editConfig) {
            updateMutation.mutate({
              key: editConfig.key,
              value,
              changeReason: reason,
            })
          }
        }}
        isLoading={updateMutation.isPending}
      />

      {/* 歷史對話框 */}
      <HistoryDialog
        config={historyConfig}
        history={historyData?.data?.history || []}
        isLoading={isLoadingHistory}
        onClose={() => setHistoryConfig(null)}
        onRollback={(version) => {
          if (historyConfig) {
            setRollbackInfo({ config: historyConfig, targetVersion: version })
          }
        }}
      />

      {/* 回滾確認 */}
      <RollbackConfirmDialog
        info={rollbackInfo}
        onClose={() => setRollbackInfo(null)}
        onConfirm={(reason) => {
          if (rollbackInfo) {
            rollbackMutation.mutate({
              key: rollbackInfo.config.key,
              targetVersion: rollbackInfo.targetVersion,
              reason,
            })
          }
        }}
        isLoading={rollbackMutation.isPending}
      />
    </div>
  )
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 編輯配置對話框
 */
function EditConfigDialog({
  config,
  onClose,
  onSave,
  isLoading,
}: {
  config: SystemConfig | null
  onClose: () => void
  onSave: (value: Record<string, unknown>, reason?: string) => void
  isLoading: boolean
}) {
  const [valueJson, setValueJson] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  // Reset form when config changes
  if (config && valueJson === '') {
    setValueJson(JSON.stringify(config.value, null, 2))
  }

  const handleSave = () => {
    try {
      const parsed = JSON.parse(valueJson)
      setError('')
      onSave(parsed, reason || undefined)
    } catch {
      setError('JSON 格式不正確')
    }
  }

  const handleClose = () => {
    setValueJson('')
    setReason('')
    setError('')
    onClose()
  }

  return (
    <Dialog open={!!config} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>編輯配置</DialogTitle>
          <DialogDescription>
            {config?.key} (v{config?.version})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>配置值 (JSON)</Label>
            <Textarea
              value={valueJson}
              onChange={(e) => setValueJson(e.target.value)}
              className="font-mono h-48"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label>變更原因（可選）</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="說明此次變更的原因..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? '保存中...' : '保存變更'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 歷史記錄對話框
 */
function HistoryDialog({
  config,
  history,
  isLoading,
  onClose,
  onRollback,
}: {
  config: SystemConfig | null
  history: ConfigHistoryItem[]
  isLoading: boolean
  onClose: () => void
  onRollback: (version: number) => void
}) {
  return (
    <Dialog open={!!config} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>版本歷史</DialogTitle>
          <DialogDescription>
            {config?.key} - 目前版本: v{config?.version}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            沒有歷史記錄
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {history.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            item.version === config?.version
                              ? 'default'
                              : 'outline'
                          }
                        >
                          v{item.version}
                        </Badge>
                        {item.version === config?.version && (
                          <span className="text-xs text-muted-foreground">
                            (目前版本)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(item.changedAt).toLocaleString('zh-TW')}
                      </p>
                      {item.changeReason && (
                        <p className="text-sm mt-2">{item.changeReason}</p>
                      )}
                    </div>
                    {item.version !== config?.version && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRollback(item.version)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        回滾
                      </Button>
                    )}
                  </div>
                  <pre className="mt-3 p-3 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(item.value, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * 回滾確認對話框
 */
function RollbackConfirmDialog({
  info,
  onClose,
  onConfirm,
  isLoading,
}: {
  info: { config: SystemConfig; targetVersion: number } | null
  onClose: () => void
  onConfirm: (reason: string) => void
  isLoading: boolean
}) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    if (!reason.trim()) {
      toast.error('請輸入回滾原因')
      return
    }
    onConfirm(reason)
  }

  return (
    <AlertDialog open={!!info} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確認回滾</AlertDialogTitle>
          <AlertDialogDescription>
            確定要將 <strong>{info?.config.key}</strong> 從 v
            {info?.config.version} 回滾到 v{info?.targetVersion} 嗎？
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label>回滾原因（必填）</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="請說明回滾原因..."
            className="mt-2"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason('')}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '回滾中...' : '確認回滾'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// Skeleton Component
// ============================================================

/**
 * 載入骨架組件
 */
function ConfigPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
