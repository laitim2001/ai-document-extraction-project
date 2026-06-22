'use client';

/**
 * @fileoverview 日誌詳情對話框組件
 * @description
 *   顯示單一日誌的完整詳情，包含：
 *   - 基本資訊（時間、級別、來源）
 *   - 完整訊息內容
 *   - 錯誤堆疊追蹤
 *   - 使用者和請求資訊
 *   - 關聯日誌列表
 *
 * @module src/components/features/admin/logs/LogDetailDialog
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useLogDetail,
  useRelatedLogs,
  getLogLevelColor,
  getLogLevelLabel,
  getLogSourceLabel,
  formatLogTimestamp,
} from '@/hooks/use-logs';
import { Copy, ExternalLink, Link2, User, Globe, Clock, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// Types
// ============================================================

interface LogDetailDialogProps {
  logId: string | null;
  open: boolean;
  onClose: () => void;
}

// ============================================================
// Sub-Components
// ============================================================

function DetailRow({
  label,
  value,
  icon,
  copyable = false,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  copyable?: boolean;
}) {
  const { toast } = useToast();
  const t = useTranslations('admin.logsViewer.detail');

  if (!value) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast({
      title: t('copied'),
      description: t('copiedDescription', { label }),
    });
  };

  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-sm break-all">{value}</p>
      </div>
      {copyable && (
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-full bg-muted animate-pulse rounded" />
      <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
      <div className="h-32 w-full bg-muted animate-pulse rounded" />
    </div>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * @component LogDetailDialog
 * @description 日誌詳情對話框
 */
export function LogDetailDialog({ logId, open, onClose }: LogDetailDialogProps) {
  const t = useTranslations('admin.logsViewer.detail');
  const { data: log, isLoading } = useLogDetail(logId);
  const { data: relatedLogsData, isLoading: relatedLoading } = useRelatedLogs(logId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {t('title')}
            {log && (
              <Badge variant={getLogLevelColor(log.level)}>
                {getLogLevelLabel(log.level)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {log ? formatLogTimestamp(log.timestamp) : t('loading')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingSkeleton />
        ) : log ? (
          <Tabs defaultValue="details" className="flex-1 min-h-0">
            <TabsList>
              <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
              <TabsTrigger value="message">{t('tabs.message')}</TabsTrigger>
              {log.errorStack && <TabsTrigger value="stack">{t('tabs.stack')}</TabsTrigger>}
              {log.details && <TabsTrigger value="data">{t('tabs.data')}</TabsTrigger>}
              <TabsTrigger value="related">
                {t('tabs.related')}
                {relatedLogsData && relatedLogsData.total > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {relatedLogsData.total}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              {/* 基本資訊 */}
              <TabsContent value="details" className="m-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <DetailRow
                      label={t('fields.logId')}
                      value={log.id}
                      icon={<Code className="h-4 w-4" />}
                      copyable
                    />
                    <DetailRow
                      label={t('fields.timestamp')}
                      value={formatLogTimestamp(log.timestamp)}
                      icon={<Clock className="h-4 w-4" />}
                    />
                    <DetailRow
                      label={t('fields.source')}
                      value={getLogSourceLabel(log.source)}
                      icon={<Globe className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-1">
                    {log.correlationId && (
                      <DetailRow
                        label={t('fields.correlationId')}
                        value={log.correlationId}
                        icon={<Link2 className="h-4 w-4" />}
                        copyable
                      />
                    )}
                    {log.requestId && (
                      <DetailRow
                        label={t('fields.requestId')}
                        value={log.requestId}
                        icon={<ExternalLink className="h-4 w-4" />}
                        copyable
                      />
                    )}
                    {log.userId && (
                      <DetailRow
                        label={t('fields.user')}
                        value={log.userName || log.userId}
                        icon={<User className="h-4 w-4" />}
                      />
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  {log.className && (
                    <DetailRow label={t('fields.className')} value={log.className} />
                  )}
                  {log.methodName && (
                    <DetailRow label={t('fields.methodName')} value={log.methodName} />
                  )}
                  {log.endpoint && (
                    <DetailRow label={t('fields.endpoint')} value={log.endpoint} />
                  )}
                  {log.duration !== undefined && (
                    <DetailRow label={t('fields.duration')} value={`${log.duration} ms`} />
                  )}
                  {log.memoryUsage !== undefined && (
                    <DetailRow label={t('fields.memoryUsage')} value={`${log.memoryUsage.toFixed(2)} MB`} />
                  )}
                </div>

                {(log.ipAddress || log.userAgent) && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      {log.ipAddress && (
                        <DetailRow label={t('fields.ipAddress')} value={log.ipAddress} />
                      )}
                      {log.userAgent && (
                        <DetailRow label={t('fields.userAgent')} value={log.userAgent} />
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* 完整訊息 */}
              <TabsContent value="message" className="m-0">
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap break-all font-mono">
                    {log.message}
                  </pre>
                </div>
              </TabsContent>

              {/* 錯誤堆疊 */}
              {log.errorStack && (
                <TabsContent value="stack" className="m-0">
                  {log.errorCode && (
                    <div className="mb-4">
                      <Badge variant="destructive">{log.errorCode}</Badge>
                    </div>
                  )}
                  <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <pre className="text-sm whitespace-pre-wrap break-all font-mono text-red-800 dark:text-red-200">
                      {log.errorStack}
                    </pre>
                  </div>
                </TabsContent>
              )}

              {/* 附加資料 */}
              {log.details && (
                <TabsContent value="data" className="m-0">
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap break-all font-mono">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              )}

              {/* 關聯日誌 */}
              <TabsContent value="related" className="m-0">
                {relatedLoading ? (
                  <LoadingSkeleton />
                ) : !relatedLogsData || relatedLogsData.total === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('noRelated')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {relatedLogsData.correlationId && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('relatedCorrelationId')}: <code className="bg-muted px-1 rounded">{relatedLogsData.correlationId}</code>
                      </p>
                    )}
                    {relatedLogsData.relatedLogs.map((relatedLog) => (
                      <div
                        key={relatedLog.id}
                        className={`p-3 rounded-lg border ${
                          relatedLog.id === logId
                            ? 'bg-primary/10 border-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getLogLevelColor(relatedLog.level)} className="text-xs">
                            {getLogLevelLabel(relatedLog.level)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getLogSourceLabel(relatedLog.source)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatLogTimestamp(relatedLog.timestamp)}
                          </span>
                          {relatedLog.id === logId && (
                            <Badge variant="secondary" className="text-xs">
                              {t('current')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm truncate">{relatedLog.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t('notFound')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
