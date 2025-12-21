'use client'

/**
 * @fileoverview 備份排程建立/編輯對話框
 * @description
 *   建立或編輯備份排程的對話框，支援：
 *   - 排程名稱和描述
 *   - 備份來源和類型
 *   - Cron 表達式設定
 *   - 保留策略設定
 *
 * @module src/components/features/admin/backup/ScheduleDialog
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCreateSchedule, useUpdateSchedule } from '@/hooks/use-backup-schedule'
import type { BackupScheduleListItem, BackupSource, BackupType } from '@/types/backup'

// ============================================================
// Types
// ============================================================

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: BackupScheduleListItem | null
}

interface FormData {
  name: string
  description: string
  backupSource: BackupSource
  backupType: BackupType
  cronExpression: string
  timezone: string
  retentionDays: number
  maxBackups: number
  isEnabled: boolean
}

// ============================================================
// Constants
// ============================================================

const CRON_PRESETS = [
  { label: '每小時', value: '0 * * * *' },
  { label: '每天午夜', value: '0 0 * * *' },
  { label: '每天凌晨 3 點', value: '0 3 * * *' },
  { label: '每週日午夜', value: '0 0 * * 0' },
  { label: '每月 1 日午夜', value: '0 0 1 * *' },
  { label: '自訂', value: 'custom' },
]

const DEFAULT_FORM: FormData = {
  name: '',
  description: '',
  backupSource: 'DATABASE',
  backupType: 'FULL',
  cronExpression: '0 3 * * *',
  timezone: 'Asia/Taipei',
  retentionDays: 30,
  maxBackups: 10,
  isEnabled: true,
}

// ============================================================
// Component
// ============================================================

/**
 * 備份排程建立/編輯對話框
 */
export function ScheduleDialog({ open, onOpenChange, schedule }: ScheduleDialogProps) {
  const isEditing = !!schedule

  // --- State ---
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [cronPreset, setCronPreset] = useState('0 3 * * *')
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  // --- Hooks ---
  const createMutation = useCreateSchedule()
  const updateMutation = useUpdateSchedule()

  // --- Effects ---
  useEffect(() => {
    if (schedule) {
      setForm({
        name: schedule.name,
        description: schedule.description || '',
        backupSource: schedule.backupSource as BackupSource,
        backupType: schedule.backupType as BackupType,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone || 'Asia/Taipei',
        retentionDays: schedule.retentionDays,
        maxBackups: schedule.maxBackups,
        isEnabled: schedule.isEnabled,
      })
      // Check if cron matches a preset
      const preset = CRON_PRESETS.find((p) => p.value === schedule.cronExpression)
      setCronPreset(preset ? preset.value : 'custom')
    } else {
      setForm(DEFAULT_FORM)
      setCronPreset('0 3 * * *')
    }
    setErrors({})
  }, [schedule, open])

  // --- Handlers ---
  const handleChange = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    },
    []
  )

  const handleCronPresetChange = useCallback((value: string) => {
    setCronPreset(value)
    if (value !== 'custom') {
      setForm((prev) => ({ ...prev, cronExpression: value }))
      setErrors((prev) => ({ ...prev, cronExpression: undefined }))
    }
  }, [])

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!form.name.trim()) {
      newErrors.name = '請輸入排程名稱'
    } else if (form.name.length > 100) {
      newErrors.name = '名稱不得超過 100 字元'
    }

    if (!form.cronExpression.trim()) {
      newErrors.cronExpression = '請輸入 Cron 表達式'
    }

    if (form.retentionDays < 1 || form.retentionDays > 365) {
      newErrors.retentionDays = '保留天數需介於 1-365 天'
    }

    if (form.maxBackups < 1 || form.maxBackups > 100) {
      newErrors.maxBackups = '最大備份數需介於 1-100'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return

    try {
      if (isEditing && schedule) {
        await updateMutation.mutateAsync({
          id: schedule.id,
          data: {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            backupSource: form.backupSource,
            backupType: form.backupType,
            cronExpression: form.cronExpression,
            timezone: form.timezone,
            retentionDays: form.retentionDays,
            maxBackups: form.maxBackups,
            isEnabled: form.isEnabled,
          },
        })
        toast.success('排程已更新')
      } else {
        await createMutation.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          backupSource: form.backupSource,
          backupType: form.backupType,
          cronExpression: form.cronExpression,
          timezone: form.timezone,
          retentionDays: form.retentionDays,
          maxBackups: form.maxBackups,
          isEnabled: form.isEnabled,
        })
        toast.success('排程已建立')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失敗')
    }
  }, [form, isEditing, schedule, validate, createMutation, updateMutation, onOpenChange])

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleClose = useCallback(() => {
    if (!isPending) {
      onOpenChange(false)
    }
  }, [isPending, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? '編輯備份排程' : '新增備份排程'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改備份排程的設定' : '建立自動備份排程'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 排程名稱 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              排程名稱 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如：每日資料庫備份"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述（選填）</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="輸入排程描述..."
              rows={2}
            />
          </div>

          {/* 備份來源與類型 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>備份來源</Label>
              <Select
                value={form.backupSource}
                onValueChange={(v) => handleChange('backupSource', v as BackupSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DATABASE">資料庫</SelectItem>
                  <SelectItem value="FILES">檔案</SelectItem>
                  <SelectItem value="CONFIG">系統設定</SelectItem>
                  <SelectItem value="FULL_SYSTEM">完整系統</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>備份類型</Label>
              <Select
                value={form.backupType}
                onValueChange={(v) => handleChange('backupType', v as BackupType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">完整備份</SelectItem>
                  <SelectItem value="INCREMENTAL">增量備份</SelectItem>
                  <SelectItem value="DIFFERENTIAL">差異備份</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cron 表達式 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>執行頻率</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Cron 表達式格式：分 時 日 月 週</p>
                    <p className="text-xs mt-1">例如：0 3 * * * 表示每天凌晨 3 點</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={cronPreset} onValueChange={handleCronPresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                    {preset.value !== 'custom' && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({preset.value})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cronPreset === 'custom' && (
              <div className="mt-2">
                <Input
                  value={form.cronExpression}
                  onChange={(e) => handleChange('cronExpression', e.target.value)}
                  placeholder="0 3 * * *"
                  className={errors.cronExpression ? 'border-destructive' : ''}
                />
                {errors.cronExpression && (
                  <p className="text-xs text-destructive mt-1">{errors.cronExpression}</p>
                )}
              </div>
            )}
          </div>

          {/* 保留策略 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retentionDays">保留天數</Label>
              <Input
                id="retentionDays"
                type="number"
                min={1}
                max={365}
                value={form.retentionDays}
                onChange={(e) => handleChange('retentionDays', parseInt(e.target.value) || 1)}
                className={errors.retentionDays ? 'border-destructive' : ''}
              />
              {errors.retentionDays && (
                <p className="text-xs text-destructive">{errors.retentionDays}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxBackups">最大備份數</Label>
              <Input
                id="maxBackups"
                type="number"
                min={1}
                max={100}
                value={form.maxBackups}
                onChange={(e) => handleChange('maxBackups', parseInt(e.target.value) || 1)}
                className={errors.maxBackups ? 'border-destructive' : ''}
              />
              {errors.maxBackups && (
                <p className="text-xs text-destructive">{errors.maxBackups}</p>
              )}
            </div>
          </div>

          {/* 啟用狀態 */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>啟用排程</Label>
              <p className="text-xs text-muted-foreground">啟用後將自動執行備份</p>
            </div>
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(checked) => handleChange('isEnabled', checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? '更新中...' : '建立中...'}
              </>
            ) : isEditing ? (
              '更新排程'
            ) : (
              '建立排程'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
