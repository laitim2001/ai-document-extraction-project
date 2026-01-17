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
import { useTranslations } from 'next-intl'
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

const CRON_PRESET_KEYS = [
  { key: 'hourly', value: '0 * * * *' },
  { key: 'dailyMidnight', value: '0 0 * * *' },
  { key: 'daily3am', value: '0 3 * * *' },
  { key: 'weeklyMidnight', value: '0 0 * * 0' },
  { key: 'monthlyMidnight', value: '0 0 1 * *' },
  { key: 'custom', value: 'custom' },
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
  // --- i18n ---
  const t = useTranslations('admin')

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
      const preset = CRON_PRESET_KEYS.find((p) => p.value === schedule.cronExpression)
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
      newErrors.name = t('backup.schedule.dialog.form.nameError')
    } else if (form.name.length > 100) {
      newErrors.name = t('backup.schedule.dialog.form.nameLengthError')
    }

    if (!form.cronExpression.trim()) {
      newErrors.cronExpression = t('backup.schedule.dialog.form.cronError')
    }

    if (form.retentionDays < 1 || form.retentionDays > 365) {
      newErrors.retentionDays = t('backup.schedule.dialog.form.retentionDaysError')
    }

    if (form.maxBackups < 1 || form.maxBackups > 100) {
      newErrors.maxBackups = t('backup.schedule.dialog.form.maxBackupsError')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form, t])

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
        toast.success(t('backup.schedule.dialog.toast.updated'))
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
        toast.success(t('backup.schedule.dialog.toast.created'))
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backup.schedule.dialog.toast.error'))
    }
  }, [form, isEditing, schedule, validate, createMutation, updateMutation, onOpenChange, t])

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
          <DialogTitle>{isEditing ? t('backup.schedule.dialog.editTitle') : t('backup.schedule.dialog.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('backup.schedule.dialog.editDescription') : t('backup.schedule.dialog.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 排程名稱 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('backup.schedule.dialog.form.name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('backup.schedule.dialog.form.namePlaceholder')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('backup.schedule.dialog.form.descriptionOptional')}</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('backup.schedule.dialog.form.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          {/* 備份來源與類型 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('backup.schedule.dialog.form.backupSource')}</Label>
              <Select
                value={form.backupSource}
                onValueChange={(v) => handleChange('backupSource', v as BackupSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DATABASE">{t('backup.schedule.dialog.form.sources.database')}</SelectItem>
                  <SelectItem value="FILES">{t('backup.schedule.dialog.form.sources.files')}</SelectItem>
                  <SelectItem value="CONFIG">{t('backup.schedule.dialog.form.sources.config')}</SelectItem>
                  <SelectItem value="FULL_SYSTEM">{t('backup.schedule.dialog.form.sources.fullSystem')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('backup.schedule.dialog.form.backupType')}</Label>
              <Select
                value={form.backupType}
                onValueChange={(v) => handleChange('backupType', v as BackupType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">{t('backup.schedule.dialog.form.types.full')}</SelectItem>
                  <SelectItem value="INCREMENTAL">{t('backup.schedule.dialog.form.types.incremental')}</SelectItem>
                  <SelectItem value="DIFFERENTIAL">{t('backup.schedule.dialog.form.types.differential')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cron 表達式 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t('backup.schedule.dialog.form.frequency')}</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t('backup.schedule.dialog.form.cronTooltip')}</p>
                    <p className="text-xs mt-1">{t('backup.schedule.dialog.form.cronExample')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={cronPreset} onValueChange={handleCronPresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESET_KEYS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {t(`backup.schedule.dialog.form.cronPresets.${preset.key}`)}
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
              <Label htmlFor="retentionDays">{t('backup.schedule.dialog.form.retentionDays')}</Label>
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
              <Label htmlFor="maxBackups">{t('backup.schedule.dialog.form.maxBackups')}</Label>
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
              <Label>{t('backup.schedule.dialog.form.enableSchedule')}</Label>
              <p className="text-xs text-muted-foreground">{t('backup.schedule.dialog.form.enableDescription')}</p>
            </div>
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(checked) => handleChange('isEnabled', checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            {t('backup.schedule.dialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? t('backup.schedule.dialog.updating') : t('backup.schedule.dialog.creating')}
              </>
            ) : isEditing ? (
              t('backup.schedule.dialog.editSubmit')
            ) : (
              t('backup.schedule.dialog.createSubmit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
