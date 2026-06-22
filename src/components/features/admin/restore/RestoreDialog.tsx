'use client'

/**
 * @fileoverview 啟動恢復對話框組件
 * @description
 *   提供啟動數據恢復的完整介面，包含：
 *   - 備份選擇
 *   - 恢復類型與範圍配置
 *   - 備份內容預覽
 *   - 安全確認機制
 *
 * @module src/components/features/admin/restore/RestoreDialog
 * @since Epic 12 - Story 12-6 (數據恢復功能)
 * @lastModified 2025-12-21
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  AlertTriangle,
  Database,
  FileText,
  Settings,
  Layers,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Info,
  CheckCircle2,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useBackups } from '@/hooks/use-backup'
import { useBackupPreview, useStartRestore } from '@/hooks/use-restore'
import { getRestoreTypeInfo, getRestoreScopeInfo } from '@/types/restore'
import type { RestoreType, RestoreScope } from '@/types/restore'

// ============================================================
// Types
// ============================================================

interface RestoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedBackupId?: string
}

// ============================================================
// Validation Schema
// ============================================================

const restoreFormSchema = z.object({
  backupId: z.string().min(1, '請選擇備份'),
  type: z.enum(['FULL', 'PARTIAL', 'DRILL', 'POINT_IN_TIME']),
  scope: z.enum(['DATABASE', 'FILES', 'CONFIG', 'ALL']),
  selectedTables: z.array(z.string()).optional(),
  selectedFiles: z.array(z.string()).optional(),
  drillName: z.string().optional(),
  confirmationText: z.string().min(1, '請輸入確認文字'),
})

type RestoreFormValues = z.infer<typeof restoreFormSchema>

// ============================================================
// Constants
// ============================================================

const STEP_IDS = ['backup', 'config', 'preview', 'confirm'] as const

// ============================================================
// Component
// ============================================================

/**
 * 啟動恢復對話框組件
 */
export function RestoreDialog({
  open,
  onOpenChange,
  preselectedBackupId,
}: RestoreDialogProps) {
  const t = useTranslations('admin.restore')

  // --- State ---
  const [step, setStep] = useState(0)

  // --- Form ---
  const form = useForm<RestoreFormValues>({
    resolver: zodResolver(restoreFormSchema),
    defaultValues: {
      backupId: preselectedBackupId ?? '',
      type: 'FULL',
      scope: 'ALL',
      selectedTables: [],
      selectedFiles: [],
      drillName: '',
      confirmationText: '',
    },
  })

  const watchBackupId = form.watch('backupId')
  const watchType = form.watch('type')
  const watchScope = form.watch('scope')

  // --- Hooks ---
  const { data: backupsData, isLoading: backupsLoading } = useBackups({
    status: 'COMPLETED',
    limit: 50,
  })

  const { data: previewData, isLoading: previewLoading } = useBackupPreview(watchBackupId, {
    enabled: !!watchBackupId && step >= 2,
  })

  const startRestoreMutation = useStartRestore()

  // --- Computed ---
  const backups = backupsData?.data?.backups ?? []
  const preview = previewData?.data

  const selectedBackup = useMemo(() => {
    return backups.find((b) => b.id === watchBackupId)
  }, [backups, watchBackupId])

  const requiredConfirmText = watchType === 'DRILL' ? 'RESTORE-DRILL' : 'RESTORE-CONFIRM'

  const isConfirmationValid = form.watch('confirmationText') === requiredConfirmText

  // --- Effects ---
  useEffect(() => {
    if (open) {
      setStep(0)
      form.reset({
        backupId: preselectedBackupId ?? '',
        type: 'FULL',
        scope: 'ALL',
        selectedTables: [],
        selectedFiles: [],
        drillName: '',
        confirmationText: '',
      })
    }
  }, [open, preselectedBackupId, form])

  // --- Handlers ---
  const handleNext = useCallback(() => {
    if (step < STEP_IDS.length - 1) {
      setStep((s) => s + 1)
    }
  }, [step])

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1)
    }
  }, [step])

  const handleSubmit = useCallback(async () => {
    const values = form.getValues()

    if (!isConfirmationValid) {
      form.setError('confirmationText', { message: t('dialog.step3.confirmError', { text: requiredConfirmText }) })
      return
    }

    try {
      await startRestoreMutation.mutateAsync({
        backupId: values.backupId,
        type: values.type as RestoreType,
        scope: values.scope as RestoreScope,
        selectedTables: values.selectedTables,
        selectedFiles: values.selectedFiles,
        confirmationText: values.confirmationText,
        drillName: values.type === 'DRILL' ? values.drillName : undefined,
      })
      onOpenChange(false)
    } catch {
      // Error handled by mutation
    }
  }, [form, isConfirmationValid, requiredConfirmText, startRestoreMutation, onOpenChange, t])

  const canProceed = useCallback(() => {
    switch (step) {
      case 0:
        return !!watchBackupId
      case 1:
        return true
      case 2:
        return !previewLoading
      case 3:
        return isConfirmationValid
      default:
        return false
    }
  }, [step, watchBackupId, previewLoading, isConfirmationValid])

  // --- Render Helpers ---
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEP_IDS.map((id, index) => (
        <div key={id} className="flex items-center">
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
            `}
          >
            {index + 1}
          </div>
          {index < STEP_IDS.length - 1 && (
            <div
              className={`w-12 h-0.5 mx-1 ${index < step ? 'bg-primary' : 'bg-muted'}`}
            />
          )}
        </div>
      ))}
    </div>
  )

  const renderStep0 = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        {t('dialog.step0.intro')}
      </div>

      {backupsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">{t('dialog.step0.loading')}</span>
        </div>
      ) : backups.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('dialog.step0.emptyTitle')}</AlertTitle>
          <AlertDescription>
            {t('dialog.step0.emptyDescription')}
          </AlertDescription>
        </Alert>
      ) : (
        <ScrollArea className="h-[300px] border rounded-md p-2">
          <RadioGroup
            value={watchBackupId}
            onValueChange={(value) => form.setValue('backupId', value)}
          >
            {backups.map((backup) => (
              <div
                key={backup.id}
                className={`
                  flex items-start space-x-3 p-3 rounded-md cursor-pointer hover:bg-muted/50
                  ${watchBackupId === backup.id ? 'bg-muted' : ''}
                `}
                onClick={() => form.setValue('backupId', backup.id)}
              >
                <RadioGroupItem value={backup.id} id={backup.id} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={backup.id} className="font-medium cursor-pointer">
                      {backup.name || t('dialog.step0.backupFallback', { id: backup.id.slice(0, 8) })}
                    </Label>
                    <Badge variant="outline">{backup.type}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(new Date(backup.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    {' · '}
                    {formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true, locale: zhTW })}
                  </div>
{/* BackupListItem doesn't include description - only shown in detail view */}
                </div>
              </div>
            ))}
          </RadioGroup>
        </ScrollArea>
      )}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* 恢復類型 */}
      <div className="space-y-3">
        <Label className="text-base font-medium">{t('dialog.step1.typeLabel')}</Label>
        <RadioGroup
          value={watchType}
          onValueChange={(value) => form.setValue('type', value as RestoreType)}
          className="grid grid-cols-2 gap-3"
        >
          {(['FULL', 'PARTIAL', 'DRILL', 'POINT_IN_TIME'] as RestoreType[]).map((type) => {
            const info = getRestoreTypeInfo(type)
            return (
              <div
                key={type}
                className={`
                  flex items-start space-x-3 p-3 rounded-md border cursor-pointer
                  ${watchType === type ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
                `}
                onClick={() => form.setValue('type', type)}
              >
                <RadioGroupItem value={type} id={`type-${type}`} className="mt-1" />
                <div>
                  <Label htmlFor={`type-${type}`} className="font-medium cursor-pointer flex items-center gap-2">
                    <span>{info.icon}</span>
                    {t.has(`types.${type}`) ? t(`types.${type}`) : info.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.has(`typeDescriptions.${type}`) ? t(`typeDescriptions.${type}`) : info.description}
                  </p>
                </div>
              </div>
            )
          })}
        </RadioGroup>
      </div>

      <Separator />

      {/* 恢復範圍 */}
      <div className="space-y-3">
        <Label className="text-base font-medium">{t('dialog.step1.scopeLabel')}</Label>
        <Select
          value={watchScope}
          onValueChange={(value) => form.setValue('scope', value as RestoreScope)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['ALL', 'DATABASE', 'FILES', 'CONFIG'] as RestoreScope[]).map((scope) => {
              const info = getRestoreScopeInfo(scope)
              return (
                <SelectItem key={scope} value={scope}>
                  <div className="flex items-center gap-2">
                    {scope === 'DATABASE' && <Database className="h-4 w-4" />}
                    {scope === 'FILES' && <FileText className="h-4 w-4" />}
                    {scope === 'CONFIG' && <Settings className="h-4 w-4" />}
                    {scope === 'ALL' && <Layers className="h-4 w-4" />}
                    <span>{t.has(`scopes.${scope}`) ? t(`scopes.${scope}`) : info.label}</span>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t.has(`scopeDescriptions.${watchScope}`)
            ? t(`scopeDescriptions.${watchScope}`)
            : getRestoreScopeInfo(watchScope).description}
        </p>
      </div>

      {/* 演練名稱（僅演練模式） */}
      {watchType === 'DRILL' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="drillName">{t('dialog.step1.drillName')}</Label>
            <Input
              id="drillName"
              placeholder={t('dialog.step1.drillNamePlaceholder')}
              {...form.register('drillName')}
            />
            <p className="text-xs text-muted-foreground">
              {t('dialog.step1.drillNameHint')}
            </p>
          </div>
        </>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      {previewLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">{t('dialog.step2.loading')}</span>
        </div>
      ) : preview ? (
        <>
          {/* 備份摘要 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-md">
              <div className="text-sm text-muted-foreground">{t('dialog.step2.backupType')}</div>
              <div className="font-medium">{selectedBackup?.type}</div>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <div className="text-sm text-muted-foreground">{t('dialog.step2.backupTime')}</div>
              <div className="font-medium">
                {selectedBackup?.createdAt
                  ? format(new Date(selectedBackup.createdAt), 'yyyy/MM/dd HH:mm')
                  : '-'}
              </div>
            </div>
          </div>

          {/* 內容預覽 */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('dialog.step2.contentLabel')}</Label>

            {/* 資料庫表格 */}
            {preview.tables && preview.tables.length > 0 && (
              <div className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4" />
                  <span className="font-medium">{t('dialog.step2.databaseTables')}</span>
                  <Badge variant="secondary">{t('dialog.step2.countUnit', { count: preview.tables.length })}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {preview.tables.slice(0, 10).map((table) => (
                    <Badge key={table.name} variant="outline">
                      {table.name}
                      <span className="ml-1 text-muted-foreground">({table.rowCount})</span>
                    </Badge>
                  ))}
                  {preview.tables.length > 10 && (
                    <Badge variant="outline">{t('dialog.step2.moreTables', { count: preview.tables.length - 10 })}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* 文件 */}
            {preview.files && preview.files.length > 0 && (
              <div className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">{t('dialog.step2.files')}</span>
                  <Badge variant="secondary">{t('dialog.step2.countUnit', { count: preview.files.length })}</Badge>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {preview.files.slice(0, 5).map((file) => (
                    <div key={file.path} className="text-sm text-muted-foreground truncate">
                      {file.path}
                    </div>
                  ))}
                  {preview.files.length > 5 && (
                    <div className="text-sm text-muted-foreground">
                      {t('dialog.step2.moreFiles', { count: preview.files.length - 5 })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 恢復配置摘要 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('dialog.step2.configLabel')}</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• {t('dialog.step2.configType', { value: t.has(`types.${watchType}`) ? t(`types.${watchType}`) : getRestoreTypeInfo(watchType).label })}</li>
                <li>• {t('dialog.step2.configScope', { value: t.has(`scopes.${watchScope}`) ? t(`scopes.${watchScope}`) : getRestoreScopeInfo(watchScope).label })}</li>
                {watchType === 'DRILL' && form.getValues('drillName') && (
                  <li>• {t('dialog.step2.configDrillName', { value: form.getValues('drillName') ?? '' })}</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('dialog.step2.errorTitle')}</AlertTitle>
          <AlertDescription>
            {t('dialog.step2.errorDescription')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('dialog.step3.warningTitle')}</AlertTitle>
        <AlertDescription>
          {watchType === 'DRILL' ? (
            <p>{t('dialog.step3.drillWarning')}</p>
          ) : (
            <p>
              {t('dialog.step3.fullWarning')}
            </p>
          )}
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <div className="p-4 bg-muted rounded-md space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm">{t('dialog.step3.summaryBackup', { value: selectedBackup?.name || watchBackupId })}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm">{t('dialog.step3.summaryType', { value: t.has(`types.${watchType}`) ? t(`types.${watchType}`) : getRestoreTypeInfo(watchType).label })}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm">{t('dialog.step3.summaryScope', { value: t.has(`scopes.${watchScope}`) ? t(`scopes.${watchScope}`) : getRestoreScopeInfo(watchScope).label })}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="confirmationText">
            {t.rich('dialog.step3.confirmPrompt', {
              text: requiredConfirmText,
              code: (chunks) => <code className="px-1 py-0.5 bg-muted rounded font-mono">{chunks}</code>,
            })}
          </Label>
          <Input
            id="confirmationText"
            placeholder={requiredConfirmText}
            {...form.register('confirmationText')}
            className={
              form.watch('confirmationText') && !isConfirmationValid
                ? 'border-destructive'
                : isConfirmationValid
                  ? 'border-green-500'
                  : ''
            }
          />
          {form.formState.errors.confirmationText && (
            <p className="text-sm text-destructive">
              {form.formState.errors.confirmationText.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return renderStep0()
      case 1:
        return renderStep1()
      case 2:
        return renderStep2()
      case 3:
        return renderStep3()
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription>
            {t(`dialog.steps.${STEP_IDS[step]}Description`)}
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="min-h-[350px]">
          {renderStepContent()}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {t('dialog.back')}
          </Button>

          {step < STEP_IDS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t('dialog.next')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isConfirmationValid || startRestoreMutation.isPending}
              variant="destructive"
            >
              {startRestoreMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('dialog.starting')}
                </>
              ) : (
                t('dialog.confirmStart')
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RestoreDialog
