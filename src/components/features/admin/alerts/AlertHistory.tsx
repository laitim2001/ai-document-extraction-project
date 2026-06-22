'use client';

/**
 * @fileoverview 警報歷史記錄組件
 * @description
 *   顯示警報歷史記錄，支援篩選、查看詳情和操作。
 *
 * @module src/components/features/admin/alerts/AlertHistory
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 * @lastModified 2026-06-22 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable';
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
  const t = useTranslations('admin.alerts');
  const tCommon = useTranslations('common');

  // --- helpers ---
  const severityText = React.useCallback(
    (severity: string) =>
      t.has(`severity.${severity}`) ? t(`severity.${severity}`) : severity,
    [t]
  );
  const alertStatusText = React.useCallback(
    (status: string) =>
      t.has(`alertStatus.${status}`) ? t(`alertStatus.${status}`) : status,
    [t]
  );

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

  const handleAcknowledge = React.useCallback(
    async (id: string) => {
      try {
        await acknowledgeMutation.mutateAsync(id);
      } catch (error) {
        console.error('Acknowledge error:', error);
      }
    },
    [acknowledgeMutation]
  );

  const handleResolveClick = React.useCallback((id: string) => {
    setAlertToResolve(id);
    setResolution('');
    setResolveDialogOpen(true);
  }, []);

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

  const handleViewDetails = React.useCallback((alert: AlertResponse) => {
    setSelectedAlert(alert);
  }, []);

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<AlertResponse>[]>(
    () => [
      {
        id: 'rule',
        header: t('history.table.rule'),
        cell: (alert) => (
          <p className="font-medium">{alert.rule?.name || t('history.unknownRule')}</p>
        ),
      },
      {
        id: 'severity',
        header: t('history.table.severity'),
        cell: (alert) => (
          <Badge className={getSeverityColor(alert.rule?.severity || 'INFO')}>
            {severityText(alert.rule?.severity || 'INFO')}
          </Badge>
        ),
      },
      {
        id: 'triggeredValue',
        header: t('history.table.triggeredValue'),
        cell: (alert) => (
          <code className="text-sm bg-muted px-1 py-0.5 rounded">
            {alert.triggeredValue}
          </code>
        ),
      },
      {
        id: 'status',
        header: t('history.table.status'),
        cell: (alert) => (
          <Badge className={getAlertStatusColor(alert.status)}>
            {alertStatusText(alert.status)}
          </Badge>
        ),
      },
      {
        id: 'triggeredAt',
        header: t('history.table.triggeredAt'),
        cell: (alert) => (
          <span className="text-sm text-muted-foreground">
            {new Date(alert.triggeredAt).toLocaleString('zh-TW')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('history.table.actions'),
        headerClassName: 'w-[150px]',
        cell: (alert) => (
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
        ),
      },
    ],
    [
      acknowledgeMutation.isPending,
      handleAcknowledge,
      handleResolveClick,
      handleViewDetails,
      t,
      severityText,
      alertStatusText,
    ]
  );

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
              <SelectValue placeholder={t('history.statusPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('history.filterAll')}</SelectItem>
              <SelectItem value="FIRING">{t('alertStatus.FIRING')}</SelectItem>
              <SelectItem value="ACKNOWLEDGED">{t('alertStatus.ACKNOWLEDGED')}</SelectItem>
              <SelectItem value="RESOLVED">{t('alertStatus.RESOLVED')}</SelectItem>
              <SelectItem value="RECOVERED">{t('alertStatus.RECOVERED')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={params.severity || 'all'}
            onValueChange={(v) => handleFilterChange('severity', v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('history.severityPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('history.filterAll')}</SelectItem>
              <SelectItem value="INFO">{t('severity.INFO')}</SelectItem>
              <SelectItem value="WARNING">{t('severity.WARNING')}</SelectItem>
              <SelectItem value="CRITICAL">{t('severity.CRITICAL')}</SelectItem>
              <SelectItem value="EMERGENCY">{t('severity.EMERGENCY')}</SelectItem>
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
          <p>{t('history.empty')}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <DataTable
            data={data.data}
            columns={columns}
            getRowId={(alert) => alert.id}
            page={params.page}
            pageSize={params.limit}
          />
        </div>
      )}

      {/* 分頁 */}
      {data?.meta?.pagination && data.meta.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {t('history.paginationTotal', { total: data.meta.pagination.total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === 1}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              {tCommon('pagination.previous')}
            </Button>
            <span className="text-sm">
              {tCommon('pagination.pageOf', { page: params.page ?? 1, total: data.meta.pagination.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={params.page === data.meta.pagination.totalPages}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              {tCommon('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* 詳情對話框 */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('history.detailTitle')}</DialogTitle>
            <DialogDescription>
              {selectedAlert?.rule?.name || t('history.unknownRule')}
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('history.fields.status')}</p>
                  <Badge className={getAlertStatusColor(selectedAlert.status)}>
                    {alertStatusText(selectedAlert.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('history.fields.severity')}</p>
                  <Badge className={getSeverityColor(selectedAlert.rule?.severity || 'INFO')}>
                    {severityText(selectedAlert.rule?.severity || 'INFO')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('history.fields.triggeredValue')}</p>
                  <p className="font-mono">{selectedAlert.triggeredValue}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('history.fields.threshold')}</p>
                  <p className="font-mono">{selectedAlert.rule?.threshold || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('history.fields.triggeredAt')}</p>
                  <p>{new Date(selectedAlert.triggeredAt).toLocaleString('zh-TW')}</p>
                </div>
                {selectedAlert.recoveredAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('history.fields.recoveredAt')}</p>
                    <p>{new Date(selectedAlert.recoveredAt).toLocaleString('zh-TW')}</p>
                  </div>
                )}
              </div>

              {selectedAlert.details && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('history.fields.details')}</p>
                  <pre className="text-sm bg-muted p-2 rounded overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedAlert.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAlert.resolution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('history.fields.resolution')}</p>
                  <p className="text-sm">{selectedAlert.resolution}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>
              {tCommon('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解決對話框 */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('history.resolveTitle')}</DialogTitle>
            <DialogDescription>
              {t('history.resolveDescription')}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder={t('history.resolvePlaceholder')}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={handleResolveConfirm}
              disabled={!resolution.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? t('history.processing') : t('history.resolveConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
