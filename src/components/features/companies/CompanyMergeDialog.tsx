'use client'

/**
 * @fileoverview 公司合併對話框組件
 * @description
 *   提供公司合併功能的對話框介面。
 *
 * @module src/components/features/companies/CompanyMergeDialog
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 主/副公司選擇
 *   - 合併預覽
 *   - 確認執行
 *
 * @dependencies
 *   - @/components/ui/dialog - 對話框組件
 *   - @/hooks/use-pending-companies - 合併 API
 *
 * @related
 *   - src/app/api/admin/companies/merge/route.ts - 合併 API
 */

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useMergeCompanies, type PendingCompany } from '@/hooks/use-pending-companies'
import { Loader2, GitMerge, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

interface CompanyMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companies: PendingCompany[]
  onSuccess?: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 公司合併對話框
 *
 * @description
 *   提供介面讓用戶選擇主公司和副公司進行合併。
 *   合併後，副公司的名稱變體會轉移到主公司，
 *   副公司狀態會變更為 MERGED。
 *
 * @param props - 組件屬性
 * @returns 公司合併對話框
 */
export function CompanyMergeDialog({
  open,
  onOpenChange,
  companies,
  onSuccess,
}: CompanyMergeDialogProps) {
  const [primaryId, setPrimaryId] = React.useState<string>('')
  const mergeMutation = useMergeCompanies()

  // 重置選擇當對話框打開
  React.useEffect(() => {
    if (open && companies.length > 0) {
      setPrimaryId(companies[0].id)
    }
  }, [open, companies])

  // 計算副公司列表
  const secondaryCompanies = React.useMemo(
    () => companies.filter((c) => c.id !== primaryId),
    [companies, primaryId]
  )

  // 處理合併
  const handleMerge = async () => {
    if (!primaryId || secondaryCompanies.length === 0) {
      toast.error('請選擇要合併的公司')
      return
    }

    try {
      await mergeMutation.mutateAsync({
        primaryId,
        secondaryIds: secondaryCompanies.map((c) => c.id),
      })
      toast.success(`成功合併 ${secondaryCompanies.length} 個公司`)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '合併公司失敗'
      )
    }
  }

  if (companies.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>合併公司</DialogTitle>
            <DialogDescription>
              需要選擇至少 2 個公司才能進行合併
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            合併公司
          </DialogTitle>
          <DialogDescription>
            選擇要保留的主公司，其他公司將被合併到主公司中
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 主公司選擇 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">選擇主公司（保留）</Label>
            <RadioGroup value={primaryId} onValueChange={setPrimaryId}>
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent"
                >
                  <RadioGroupItem value={company.id} id={company.id} />
                  <Label
                    htmlFor={company.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{company.name}</div>
                    <div className="text-xs text-muted-foreground">
                      出現 {company.documentCount} 次
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 合併預覽 */}
          {primaryId && secondaryCompanies.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>合併後，以下公司將被標記為已合併：</p>
                  <ul className="list-inside list-disc text-sm">
                    {secondaryCompanies.map((company) => (
                      <li key={company.id}>{company.name}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2">
                    這些公司的名稱將成為主公司的名稱變體，用於未來的自動匹配。
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleMerge}
            disabled={
              mergeMutation.isPending ||
              !primaryId ||
              secondaryCompanies.length === 0
            }
          >
            {mergeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                合併中...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                確認合併
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
