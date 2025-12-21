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

const BACKUP_SOURCES = [
  {
    value: 'DATABASE' as BackupSource,
    label: '資料庫',
    description: '備份所有資料庫表格和資料',
    icon: Database,
  },
  {
    value: 'FILES' as BackupSource,
    label: '檔案',
    description: '備份上傳的文件和附件',
    icon: File,
  },
  {
    value: 'CONFIG' as BackupSource,
    label: '系統設定',
    description: '備份系統配置和設定檔',
    icon: Settings,
  },
  {
    value: 'FULL_SYSTEM' as BackupSource,
    label: '完整系統',
    description: '備份資料庫、檔案和設定',
    icon: HardDrive,
  },
]

const BACKUP_TYPES = [
  {
    value: 'FULL' as BackupType,
    label: '完整備份',
    description: '備份所有資料（推薦首次備份）',
  },
  {
    value: 'INCREMENTAL' as BackupType,
    label: '增量備份',
    description: '只備份自上次備份後變更的資料',
  },
  {
    value: 'DIFFERENTIAL' as BackupType,
    label: '差異備份',
    description: '備份自上次完整備份後變更的資料',
  },
]

// ============================================================
// Component
// ============================================================

/**
 * 建立備份對話框
 */
export function CreateBackupDialog({ open, onOpenChange }: CreateBackupDialogProps) {
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
      toast.error('請輸入備份名稱')
      return
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        source,
        type,
        description: description.trim() || undefined,
      })
      toast.success('備份已開始執行')
      onOpenChange(false)
      // Reset form
      setName('')
      setSource('DATABASE')
      setType('FULL')
      setDescription('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '建立備份失敗')
    }
  }, [name, source, type, description, createMutation, onOpenChange])

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      onOpenChange(false)
    }
  }, [createMutation.isPending, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>建立手動備份</DialogTitle>
          <DialogDescription>選擇備份來源和類型，立即執行備份操作</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 備份名稱 */}
          <div className="space-y-2">
            <Label htmlFor="name">備份名稱 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入備份名稱..."
              maxLength={100}
            />
          </div>

          {/* 備份來源 */}
          <div className="space-y-3">
            <Label className="text-base">備份來源</Label>
            <RadioGroup
              value={source}
              onValueChange={(v) => setSource(v as BackupSource)}
              className="grid grid-cols-2 gap-3"
            >
              {BACKUP_SOURCES.map((item) => {
                const Icon = item.icon
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
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </Label>
                )
              })}
            </RadioGroup>
          </div>

          {/* 備份類型 */}
          <div className="space-y-3">
            <Label className="text-base">備份類型</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as BackupType)}
              className="space-y-2"
            >
              {BACKUP_TYPES.map((item) => (
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
                    <span className="font-medium">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* 備份描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">備份描述（選填）</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="輸入備份描述..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                建立中...
              </>
            ) : (
              '開始備份'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
