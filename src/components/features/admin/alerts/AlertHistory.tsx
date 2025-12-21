'use client';

/**
 * @fileoverview 警報歷史記錄組件
 * @description
 *   顯示警報歷史記錄，支援篩選、查看詳情和操作。
 *
 * @module src/components/features/admin/alerts/AlertHistory
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Eye, CheckCircle, XCircle } from 'lucide-react';
import {
  useAlerts,
  useAcknowledgeAlert,
  useResolveAlert,
} from '@/hooks/useAlerts';
import type { AlertListParams, AlertResponse } from '@/types/alerts';

// ============================================================
// Helper Functions
// ============================================================

function getSeverityText(severity: string): string {
  const texts: Record<string, string> = {
    INFO: '資訊',
    WARNING: '警告',
    ERROR: '錯誤',
    CRITICAL: '嚴重',
    EMERGENCY: '緊急',
  };
  return texts[severity] || severity;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
    EMERGENCY: 'bg-purple-100 text-purple-800',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

function getAlertStatusText(status: string): string {
  const texts: Record<string, string> = {
    FIRING: '觸發中',
    ACTIVE: '活躍',
    ACKNOWLEDGED: '已確認',
    RESOLVED: '已解決',
    RECOVERED: '已恢復',
    SUPPRESSED: '已抑制',
  };
  return texts[status] || status;
}

function getAlertStatusColor(status: string): string {
  const colors: Record<string, string> = {
    FIRING: 'bg-red-100 text-red-800',
    ACTIVE: 'bg-red-100 text-red-800',
    ACKNOWLEDGED: 'bg-yellow-100 text-yellow-800',
    RESOLVED: 'bg-green-100 text-green-800',
    RECOVERED: 'bg-blue-100 text-blue-800',
    SUPPRESSED: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// ============================================================
// Types
// ============================================================

interface AlertHistoryProps {
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function AlertHistory({ className }: AlertHistoryProps) {
  // --- State ---
  const [params, setParams] = React.useState<AlertListParams>({
    page: 1,
    limit: 20,
  });
  const [selectedAlert, setSelectedAlert] = React.useState<AlertResponse | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [resolution, setResolution] = React.useState('');
  const [alertToResolve, setAlertToResolve] = React.useState<string | null>(null);

  // --- Queries & Mutations ---
  const { data, isLoading, refetch } = useAlerts(params);
  const acknowledgeMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();

  // --- Handlers ---
  const handleFilterChange = (key: string, value: string | undefined) => {
    setParams((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeMutation.mutateAsync(id);
    } catch (error) {
      console.error('Acknowledge error:', error);
    }
  };

  const handleResolveClick = (id: string) => {
    setAlertToResolve(id);
    setResolution('');
    setResolveDialogOpen(true);
  };

  const handleResolveConfirm = async () => {
    if (alertToResolve && resolution.trim()) {
      try {
        await resolveMutation.mutateAsync({
          id: alertToResolve,
          resolution: resolution.trim(),
        });
        setResolveDialogOpen(false);
        setAlertToResolve(null);
        setResolution('');
      } catch (error) {
        console.error('Resolve error:', error);
      }
    }
  };

  const handleViewDetails = (alert: AlertResponse) => {
    setSelectedAlert(alert);
  };

  // --- Render ---
  return (
    <div className={className}>
      {/* 工具列 */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={params.status || 'all'}
            onValueChange={(v) => handleFilterChange('status', v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="FIRING">觸發中</SelectItem>
              <SelectItem value="ACKNOWLEDGED">已確認</SelectItem>
              <SelectItem value="RESOLVED">已解決</SelectItem>
              <SelectItem value="RECOVERED">已恢復</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.severity || 'all'}
            onValueChange={(v) => handleFilterChange('severity', v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="嚴重程度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="INFO">資訊</SelectItem>
              <SelectItem value="WARNING">警告</SelectItem>
              <SelectItem value="CRITICAL">嚴重</SelectItem>
              <SelectItem value="EMERGENCY">緊急</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* 警報表格 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !data?.data || data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p>目前沒有警報記錄</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>規則</TableHead>
                <TableHead>嚴重程度</TableHead>
                <TableHead>觸發值</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>觸發時間</TableHead>
                <TableHead className="w-[150px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <p className="font-medium">{alert.rule?.name || '未知規則'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSeverityColor(alert.rule?.severity || 'INFO')}>
                      {getSeverityText(alert.rule?.severity || 'INFO')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-1 py-0.5 rounded">
                      {alert.triggeredValue}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge className={getAlertStatusColor(alert.status)}>
                      {getAlertStatusText(alert.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(alert.triggeredAt).toLocaleString('zh-TW')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(alert)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(alert.status === 'FIRING' || alert.status === 'ACTIVE') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 text-yellow-500" />
                        </Button>
                      )}
                      {alert.status !== 'RESOLVED' && alert.status !== 'RECOVERED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResolveClick(alert.id)}
                        >
                          <XCircle className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 分頁 */}
      {data?.meta?.pagination && data.meta.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            共 {data.meta.pagination.total} 條記錄
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === 1}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              上一頁
            </Button>
            <span className="text-sm">
              第 {params.page} / {data.meta.pagination.totalPages} 頁
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === data.meta.pagination.totalPages}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}

      {/* 詳情對話框 */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>警報詳情</DialogTitle>
            <DialogDescription>
              {selectedAlert?.rule?.name || '未知規則'}
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">狀態</p>
                  <Badge className={getAlertStatusColor(selectedAlert.status)}>
                    {getAlertStatusText(selectedAlert.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">嚴重程度</p>
                  <Badge className={getSeverityColor(selectedAlert.rule?.severity || 'INFO')}>
                    {getSeverityText(selectedAlert.rule?.severity || 'INFO')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">觸發值</p>
                  <p className="font-mono">{selectedAlert.triggeredValue}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">閾值</p>
                  <p className="font-mono">{selectedAlert.rule?.threshold || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">觸發時間</p>
                  <p>{new Date(selectedAlert.triggeredAt).toLocaleString('zh-TW')}</p>
                </div>
                {selectedAlert.recoveredAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">恢復時間</p>
                    <p>{new Date(selectedAlert.recoveredAt).toLocaleString('zh-TW')}</p>
                  </div>
                )}
              </div>

              {selectedAlert.details && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">詳細資訊</p>
                  <pre className="text-sm bg-muted p-2 rounded overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedAlert.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAlert.resolution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">解決說明</p>
                  <p className="text-sm">{selectedAlert.resolution}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解決對話框 */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>解決警報</DialogTitle>
            <DialogDescription>
              請輸入解決說明
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="描述如何解決此警報..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleResolveConfirm}
              disabled={!resolution.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? '處理中...' : '確認解決'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
