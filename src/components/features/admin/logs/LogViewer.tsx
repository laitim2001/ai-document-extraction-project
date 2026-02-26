'use client';

/**
 * @fileoverview 系統日誌檢視器組件
 * @description
 *   提供日誌列表查詢、篩選、分頁和匯出功能。
 *   支援多條件篩選和即時搜尋。
 *
 * @module src/components/features/admin/logs/LogViewer
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useLogs,
  useLogStats,
  LogListFilters,
  getLogLevelColor,
  getLogLevelLabel,
  getLogSourceLabel,
  formatLogTimestamp,
} from '@/hooks/use-logs';
import { LogLevel, LogSource } from '@prisma/client';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  Info,
  Bug,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { LogDetailDialog } from './LogDetailDialog';
import { LogExportDialog } from './LogExportDialog';
import { LogStreamPanel } from './LogStreamPanel';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface LogViewerProps {
  className?: string;
}

// ============================================================
// Constants
// ============================================================

const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
const LOG_SOURCES: LogSource[] = ['WEB', 'API', 'AI', 'DATABASE', 'N8N', 'SCHEDULER', 'BACKGROUND', 'SYSTEM'];

// ============================================================
// Sub-Components
// ============================================================

function LogLevelBadge({ level }: { level: LogLevel }) {
  const colorVariant = getLogLevelColor(level);
  const icons: Record<LogLevel, React.ReactNode> = {
    DEBUG: <Bug className="h-3 w-3" />,
    INFO: <Info className="h-3 w-3" />,
    WARN: <AlertTriangle className="h-3 w-3" />,
    ERROR: <AlertCircle className="h-3 w-3" />,
    CRITICAL: <AlertCircle className="h-3 w-3" />,
  };

  return (
    <Badge variant={colorVariant} className="gap-1">
      {icons[level]}
      {getLogLevelLabel(level)}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  icon,
  variant = 'default',
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const variants = {
    default: 'text-muted-foreground',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    success: 'text-green-500',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={variants[variant]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 p-4 border rounded">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * @component LogViewer
 * @description 系統日誌檢視器主組件
 */
export function LogViewer({ className }: LogViewerProps) {
  const t = useTranslations('admin');

  // --- State ---
  const [filters, setFilters] = useState<LogListFilters>({
    page: 1,
    limit: 50,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
  const [keyword, setKeyword] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [selectedSources, setSelectedSources] = useState<LogSource[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showStreamPanel, setShowStreamPanel] = useState(false);

  // --- Queries ---
  const { data: logsData, isLoading, refetch } = useLogs(filters);
  const { data: stats, isLoading: statsLoading } = useLogStats();

  // --- Handlers ---
  const handleSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      keyword: keyword || undefined,
      levels: selectedLevels.length > 0 ? selectedLevels : undefined,
      sources: selectedSources.length > 0 ? selectedSources : undefined,
      page: 1,
    }));
  }, [keyword, selectedLevels, selectedSources]);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleLevelToggle = useCallback((level: LogLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }, []);

  const handleSourceToggle = useCallback((source: LogSource) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setKeyword('');
    setSelectedLevels([]);
    setSelectedSources([]);
    setFilters({
      page: 1,
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  }, []);

  // --- Render ---
  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination;

  return (
    <div className={cn('space-y-6', className)}>
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('logsViewer.title')}</h1>
          <p className="text-muted-foreground">{t('logsViewer.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowStreamPanel(!showStreamPanel)}>
            <Activity className="mr-2 h-4 w-4" />
            {showStreamPanel ? t('logsViewer.closeStream') : t('logsViewer.openStream')}
          </Button>
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            <Download className="mr-2 h-4 w-4" />
            {t('logsViewer.export')}
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('logsViewer.refresh')}
          </Button>
        </div>
      </div>

      {/* 即時日誌面板 */}
      {showStreamPanel && (
        <LogStreamPanel
          onClose={() => setShowStreamPanel(false)}
          onSelectLog={setSelectedLogId}
        />
      )}

      {/* 統計概覽 */}
      {!statsLoading && stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title={t('logsViewer.stats.total')}
            value={stats.totalCount}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            title={t('logsViewer.stats.errors')}
            value={(stats.byLevel?.ERROR || 0) + (stats.byLevel?.CRITICAL || 0)}
            icon={<AlertCircle className="h-4 w-4" />}
            variant={(stats.byLevel?.ERROR || 0) + (stats.byLevel?.CRITICAL || 0) > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title={t('logsViewer.stats.warnings')}
            value={stats.byLevel?.WARN || 0}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant={(stats.byLevel?.WARN || 0) > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title={t('logsViewer.stats.info')}
            value={stats.byLevel?.INFO || 0}
            icon={<Info className="h-4 w-4" />}
          />
          <StatCard
            title={t('logsViewer.stats.debug')}
            value={stats.byLevel?.DEBUG || 0}
            icon={<Bug className="h-4 w-4" />}
          />
        </div>
      )}

      {/* 篩選區域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('logsViewer.filters.title')}</CardTitle>
          <CardDescription>{t('logsViewer.filters.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* 關鍵字搜尋 */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('logsViewer.filters.searchPlaceholder')}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 級別篩選 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {t('logsViewer.filters.level')}
                  {selectedLevels.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedLevels.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{t('logsViewer.filters.selectLevel')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LOG_LEVELS.map((level) => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={selectedLevels.includes(level)}
                    onCheckedChange={() => handleLevelToggle(level)}
                  >
                    {getLogLevelLabel(level)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 來源篩選 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {t('logsViewer.filters.source')}
                  {selectedSources.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedSources.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{t('logsViewer.filters.selectSource')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LOG_SOURCES.map((source) => (
                  <DropdownMenuCheckboxItem
                    key={source}
                    checked={selectedSources.includes(source)}
                    onCheckedChange={() => handleSourceToggle(source)}
                  >
                    {getLogSourceLabel(source)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 每頁數量 */}
            <Select
              value={String(filters.limit)}
              onValueChange={(v) => setFilters((prev) => ({ ...prev, limit: parseInt(v), page: 1 }))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t('logsViewer.filters.perPage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">{t('logsViewer.filters.perPageOption', { count: 20 })}</SelectItem>
                <SelectItem value="50">{t('logsViewer.filters.perPageOption', { count: 50 })}</SelectItem>
                <SelectItem value="100">{t('logsViewer.filters.perPageOption', { count: 100 })}</SelectItem>
              </SelectContent>
            </Select>

            {/* 搜尋和清除按鈕 */}
            <Button onClick={handleSearch}>{t('logsViewer.filters.search')}</Button>
            <Button variant="ghost" onClick={handleClearFilters}>
              {t('logsViewer.filters.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 日誌列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('logsViewer.list.title')}</CardTitle>
          <CardDescription>
            {pagination
              ? t('logsViewer.list.showing', {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total
                })
              : t('logsViewer.list.loading')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('logsViewer.list.empty')}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">{t('logsViewer.list.columns.time')}</TableHead>
                    <TableHead className="w-[100px]">{t('logsViewer.list.columns.level')}</TableHead>
                    <TableHead className="w-[100px]">{t('logsViewer.list.columns.source')}</TableHead>
                    <TableHead>{t('logsViewer.list.columns.message')}</TableHead>
                    <TableHead className="w-[80px]">{t('logsViewer.list.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {formatLogTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <LogLevelBadge level={log.level} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getLogSourceLabel(log.source)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[400px] truncate" title={log.message}>
                        {log.message}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLogId(log.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分頁 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('logsViewer.pagination.pageInfo', { page: pagination.page, totalPages: pagination.totalPages })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('logsViewer.pagination.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      {t('logsViewer.pagination.next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 日誌詳情對話框 */}
      <LogDetailDialog
        logId={selectedLogId}
        open={!!selectedLogId}
        onClose={() => setSelectedLogId(null)}
      />

      {/* 匯出對話框 */}
      <LogExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        filters={filters}
      />
    </div>
  );
}
