'use client'

/**
 * @fileoverview 資料保留管理儀表板
 * @description
 *   整合資料保留系統的所有功能，包括：
 *   - 存儲指標總覽
 *   - 保留策略管理
 *   - 歸檔記錄瀏覽
 *   - 刪除請求審批
 *
 * @module src/components/features/retention/DataRetentionDashboard
 * @author Development Team
 * @since Epic 8 - Story 8.6 (Long-term Data Retention)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 分層存儲指標展示 (HOT/COOL/COLD/ARCHIVE)
 *   - 保留策略 CRUD 操作
 *   - 歸檔記錄查詢與還原
 *   - 刪除請求審批工作流
 *
 * @dependencies
 *   - StorageMetricsCard - 存儲指標卡片
 *   - RetentionPolicyList - 保留策略列表
 *   - ArchiveRecordList - 歸檔記錄列表
 *   - DeletionRequestList - 刪除請求列表
 */

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Database, FileArchive, Trash2, Settings } from 'lucide-react'
import { StorageMetricsCard } from './StorageMetricsCard'
import { RetentionPolicyList } from './RetentionPolicyList'
import { ArchiveRecordList } from './ArchiveRecordList'
import { DeletionRequestList } from './DeletionRequestList'
import {
  useCreateRetentionPolicy,
  useUpdateRetentionPolicy,
  useRetentionPolicy,
} from '@/hooks/useRetention'
import { DATA_TYPE_LABELS, STORAGE_TIER_CONFIG } from '@/types/retention'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { DataType } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface DataRetentionDashboardProps {
  className?: string
}

interface PolicyFormData {
  policyName: string
  description: string
  dataType: DataType | ''
  hotStorageDays: number
  warmStorageDays: number
  coldStorageDays: number
  deletionProtection: boolean
  requireApproval: boolean
  minApprovalLevel: string
  isActive: boolean
}

const defaultFormData: PolicyFormData = {
  policyName: '',
  description: '',
  dataType: '',
  hotStorageDays: 90,
  warmStorageDays: 365,
  coldStorageDays: 2555,
  deletionProtection: true,
  requireApproval: true,
  minApprovalLevel: 'ADMIN',
  isActive: true,
}

// ============================================================
// Component
// ============================================================

export function DataRetentionDashboard({ className }: DataRetentionDashboardProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState('overview')
  const [policyDialogOpen, setPolicyDialogOpen] = React.useState(false)
  const [editingPolicyId, setEditingPolicyId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState<PolicyFormData>(defaultFormData)

  // Hooks for policy operations
  const createPolicy = useCreateRetentionPolicy({
    onSuccess: () => {
      toast({
        title: '策略建立成功',
        description: '新的保留策略已建立',
      })
      handleCloseDialog()
    },
    onError: (error) => {
      toast({
        title: '建立失敗',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const updatePolicy = useUpdateRetentionPolicy({
    onSuccess: () => {
      toast({
        title: '策略更新成功',
        description: '保留策略已更新',
      })
      handleCloseDialog()
    },
    onError: (error) => {
      toast({
        title: '更新失敗',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Fetch policy data when editing
  const { data: policyData } = useRetentionPolicy(editingPolicyId || '', {
    enabled: !!editingPolicyId,
  })

  // Update form when policy data is loaded
  React.useEffect(() => {
    if (policyData) {
      setFormData({
        policyName: policyData.policyName,
        description: policyData.description || '',
        dataType: policyData.dataType,
        hotStorageDays: policyData.hotStorageDays,
        warmStorageDays: policyData.warmStorageDays,
        coldStorageDays: policyData.coldStorageDays,
        deletionProtection: policyData.deletionProtection,
        requireApproval: policyData.requireApproval,
        minApprovalLevel: policyData.minApprovalLevel,
        isActive: policyData.isActive,
      })
    }
  }, [policyData])

  const handleCreateClick = () => {
    setEditingPolicyId(null)
    setFormData(defaultFormData)
    setPolicyDialogOpen(true)
  }

  const handleEditClick = (policyId: string) => {
    setEditingPolicyId(policyId)
    setPolicyDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setPolicyDialogOpen(false)
    setEditingPolicyId(null)
    setFormData(defaultFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.policyName || !formData.dataType) {
      toast({
        title: '表單驗證失敗',
        description: '請填寫必填欄位',
        variant: 'destructive',
      })
      return
    }

    const payload = {
      policyName: formData.policyName,
      description: formData.description || undefined,
      dataType: formData.dataType as DataType,
      hotStorageDays: formData.hotStorageDays,
      warmStorageDays: formData.warmStorageDays,
      coldStorageDays: formData.coldStorageDays,
      deletionProtection: formData.deletionProtection,
      requireApproval: formData.requireApproval,
      minApprovalLevel: formData.minApprovalLevel,
      isActive: formData.isActive,
    }

    if (editingPolicyId) {
      updatePolicy.mutate({ id: editingPolicyId, data: payload })
    } else {
      createPolicy.mutate(payload)
    }
  }

  const isSubmitting = createPolicy.isPending || updatePolicy.isPending

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">資料保留管理</h2>
          <p className="text-muted-foreground">
            管理資料存儲策略、歸檔記錄和刪除請求
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            存儲總覽
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            保留策略
          </TabsTrigger>
          <TabsTrigger value="archives" className="flex items-center gap-2">
            <FileArchive className="h-4 w-4" />
            歸檔記錄
          </TabsTrigger>
          <TabsTrigger value="deletions" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            刪除請求
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <StorageMetricsCard />
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>保留策略管理</CardTitle>
              <CardDescription>
                配置不同資料類型的保留時間和存儲層級規則
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RetentionPolicyList
                onCreateClick={handleCreateClick}
                onEditClick={handleEditClick}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archives Tab */}
        <TabsContent value="archives" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>歸檔記錄</CardTitle>
              <CardDescription>
                查看已歸檔的資料，支援從冷存儲還原
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ArchiveRecordList />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deletions Tab */}
        <TabsContent value="deletions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>刪除請求審批</CardTitle>
              <CardDescription>
                審核待處理的資料刪除請求，確保合規性
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeletionRequestList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Policy Form Dialog */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicyId ? '編輯保留策略' : '新增保留策略'}
            </DialogTitle>
            <DialogDescription>
              設定資料類型的保留時間和存儲層級規則
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* Policy Name */}
            <div className="space-y-2">
              <Label htmlFor="policyName">策略名稱 *</Label>
              <Input
                id="policyName"
                value={formData.policyName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, policyName: e.target.value }))
                }
                placeholder="輸入策略名稱"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="輸入策略描述"
                rows={2}
              />
            </div>

            {/* Data Type */}
            <div className="space-y-2">
              <Label htmlFor="dataType">資料類型 *</Label>
              <Select
                value={formData.dataType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, dataType: value as DataType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇資料類型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DATA_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Storage Days */}
            <div className="space-y-4">
              <Label>存儲層級天數</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hotDays" className="text-xs text-red-600">
                    熱存儲 (HOT)
                  </Label>
                  <Input
                    id="hotDays"
                    type="number"
                    min={0}
                    max={365}
                    value={formData.hotStorageDays}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hotStorageDays: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {STORAGE_TIER_CONFIG.HOT.description}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warmDays" className="text-xs text-blue-600">
                    溫存儲 (COOL)
                  </Label>
                  <Input
                    id="warmDays"
                    type="number"
                    min={0}
                    max={730}
                    value={formData.warmStorageDays}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        warmStorageDays: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {STORAGE_TIER_CONFIG.COOL.description}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coldDays" className="text-xs text-cyan-600">
                    冷存儲 (COLD)
                  </Label>
                  <Input
                    id="coldDays"
                    type="number"
                    min={0}
                    max={3650}
                    value={formData.coldStorageDays}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        coldStorageDays: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {STORAGE_TIER_CONFIG.COLD.description}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                總保留時間：{formData.hotStorageDays + formData.warmStorageDays + formData.coldStorageDays} 天
                {formData.hotStorageDays + formData.warmStorageDays + formData.coldStorageDays >= 2555 && (
                  <span className="text-green-600 ml-2">✓ 符合 7 年合規要求</span>
                )}
              </p>
            </div>

            {/* Protection Settings */}
            <div className="space-y-4">
              <Label>保護設定</Label>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="deletionProtection" className="text-sm">
                    刪除保護
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    啟用後，資料無法被意外刪除
                  </p>
                </div>
                <Switch
                  id="deletionProtection"
                  checked={formData.deletionProtection}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, deletionProtection: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requireApproval" className="text-sm">
                    需要審批
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    刪除請求需要管理員審批
                  </p>
                </div>
                <Switch
                  id="requireApproval"
                  checked={formData.requireApproval}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, requireApproval: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive" className="text-sm">
                    啟用策略
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    停用策略後將不再執行自動歸檔
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? '處理中...'
                  : editingPolicyId
                    ? '更新策略'
                    : '建立策略'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
