'use client'

/**
 * @fileoverview 建立備份對話框
 * @description
 *   手動建立備份的對話框，支援：
 *   - 選擇備份來源（資料庫、檔案、設定、完整系統）
 *   - 選擇備份類型（完整、增量、差異）
 *   - 輸入備份描述
 *
 * @module src/components/features/admin/backup/CreateBackupDialog
 * @since Epic 12 - Story 12-5 (數據備份管理)
 * @lastModified 2025-12-21
 */

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Database, File, Settings, HardDrive } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCreateBackup } from '@/hooks/use-backup'
import type { BackupSource, BackupType } from '@/types/backup'

// ============================================================
// Types
// ============================================================

interface CreateBackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ============================================================
// Constants
// ============================================================

const BACKUP_SOURCE_KEYS = {
  DATABASE: 'database',
  FILES: 'files',
  CONFIG: 'config',
  FULL_SYSTEM: 'fullSystem',
} as const

const BACKUP_TYPE_KEYS = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  DIFFERENTIAL: 'differential',
} as const

const BACKUP_SOURCES = [
  { value: 'DATABASE' as BackupSource, icon: Database },
  { value: 'FILES' as BackupSource, icon: File },
  { value: 'CONFIG' as BackupSource, icon: Settings },
  { value: 'FULL_SYSTEM' as BackupSource, icon: HardDrive },
]

const BACKUP_TYPES = [
  { value: 'FULL' as BackupType },
  { value: 'INCREMENTAL' as BackupType },
  { value: 'DIFFERENTIAL' as BackupType },
]

// ============================================================
// Component
// ============================================================

/**
 * 建立備份對話框
 */
export function CreateBackupDialog({ open, onOpenChange }: CreateBackupDialogProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- State ---
  const [name, setName] = useState('')
  const [source, setSource] = useState<BackupSource>('DATABASE')
  const [type, setType] = useState<BackupType>('FULL')
  const [description, setDescription] = useState('')

  // --- Hooks ---
  const createMutation = useCreateBackup()

  // --- Handlers ---
  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      toast.error(t('backup.create.nameRequired'))
      return
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        source,
        type,
        description: description.trim() || undefined,
      })
      toast.success(t('backup.create.toast.started'))
      onOpenChange(false)
      // Reset form
      setName('')
      setSource('DATABASE')
      setType('FULL')
      setDescription('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backup.create.toast.error'))
    }
  }, [name, source, type, description, createMutation, onOpenChange, t])

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      onOpenChange(false)
    }
  }, [createMutation.isPending, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('backup.create.title')}</DialogTitle>
          <DialogDescription>{t('backup.create.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 備份名稱 */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('backup.create.name')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('backup.create.namePlaceholder')}
              maxLength={100}
            />
          </div>

          {/* 備份來源 */}
          <div className="space-y-3">
            <Label className="text-base">{t('backup.create.source')}</Label>
            <RadioGroup
              value={source}
              onValueChange={(v) => setSource(v as BackupSource)}
              className="grid grid-cols-2 gap-3"
            >
              {BACKUP_SOURCES.map((item) => {
                const Icon = item.icon
                const sourceKey = BACKUP_SOURCE_KEYS[item.value]
                return (
                  <Label
                    key={item.value}
                    htmlFor={`source-${item.value}`}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                      source === item.value ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <RadioGroupItem
                      id={`source-${item.value}`}
                      value={item.value}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{t(`backup.create.sources.${sourceKey}.label`)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t(`backup.create.sources.${sourceKey}.description`)}</p>
                    </div>
                  </Label>
                )
              })}
            </RadioGroup>
          </div>

          {/* 備份類型 */}
          <div className="space-y-3">
            <Label className="text-base">{t('backup.create.type')}</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as BackupType)}
              className="space-y-2"
            >
              {BACKUP_TYPES.map((item) => {
                const typeKey = BACKUP_TYPE_KEYS[item.value]
                return (
                  <Label
                    key={item.value}
                    htmlFor={`type-${item.value}`}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                      type === item.value ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <RadioGroupItem
                      id={`type-${item.value}`}
                      value={item.value}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="font-medium">{t(`backup.create.types.${typeKey}.label`)}</span>
                      <p className="text-xs text-muted-foreground">{t(`backup.create.types.${typeKey}.description`)}</p>
                    </div>
                  </Label>
                )
              })}
            </RadioGroup>
          </div>

          {/* 備份描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('backup.create.descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('backup.create.descriptionPlaceholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
            {t('backup.create.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('backup.create.submitting')}
              </>
            ) : (
              t('backup.create.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
