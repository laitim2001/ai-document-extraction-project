/**
 * @fileoverview 系統日誌查詢 Hooks
 * @description
 *   提供系統日誌查詢的 React Query hooks，包含：
 *   - 日誌列表查詢（支援篩選、分頁）
 *   - 日誌詳情查詢
 *   - 關聯日誌查詢
 *   - 日誌統計
 *   - 日誌匯出
 *   - 即時日誌串流
 *
 * @module src/hooks/use-logs
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 多條件日誌查詢
 *   - 日誌詳情與關聯追蹤
 *   - 日誌統計分析
 *   - CSV/JSON/TXT 匯出
 *   - SSE 即時串流
 *   - 自動快取管理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LogEntry,
  LogDetail,
  LogStats,
  LogQueryFilters,
  ExportStatusResponse,
} from '@/types/logging';
import { LogLevel, LogSource, LogExportFormat } from '@prisma/client';

// ============================================================
// Query Keys
// ============================================================

export const logKeys = {
  all: ['logs'] as const,
  lists: () => [...logKeys.all, 'list'] as const,
  list: (filters?: LogListFilters) => [...logKeys.lists(), filters] as const,
  details: () => [...logKeys.all, 'detail'] as const,
  detail: (id: string) => [...logKeys.details(), id] as const,
  related: (id: string) => [...logKeys.all, 'related', id] as const,
  stats: (timeRange?: { start: string; end: string }) => [...logKeys.all, 'stats', timeRange] as const,
  exports: () => [...logKeys.all, 'exports'] as const,
  export: (id: string) => [...logKeys.exports(), id] as const,
};

// ============================================================
// Types
// ============================================================

export interface LogListFilters {
  startTime?: string;
  endTime?: string;
  levels?: LogLevel[];
  sources?: LogSource[];
  keyword?: string;
  correlationId?: string;
  userId?: string;
  errorCode?: string;
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'level' | 'source';
  sortOrder?: 'asc' | 'desc';
}

interface LogListResponse {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RelatedLogsResponse {
  relatedLogs: LogEntry[];
  correlationId: string | null;
  total: number;
}

interface CreateExportParams {
  format: LogExportFormat;
  filters?: LogQueryFilters;
}

interface StreamMessage {
  type: 'connected' | 'log' | 'error';
  data?: LogEntry;
  timestamp?: string;
  error?: string;
}

// ============================================================
// API Functions
// ============================================================

const API_BASE = '/api/admin/logs';

async function fetchLogs(filters?: LogListFilters): Promise<LogListResponse> {
  const params = new URLSearchParams();

  if (filters?.startTime) params.set('startTime', filters.startTime);
  if (filters?.endTime) params.set('endTime', filters.endTime);
  if (filters?.levels?.length) params.set('levels', filters.levels.join(','));
  if (filters?.sources?.length) params.set('sources', filters.sources.join(','));
  if (filters?.keyword) params.set('keyword', filters.keyword);
  if (filters?.correlationId) params.set('correlationId', filters.correlationId);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.errorCode) params.set('errorCode', filters.errorCode);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取日誌列表');
  }

  const data = await response.json();
  return {
    logs: data.data,
    pagination: data.meta.pagination,
  };
}

async function fetchLogDetail(logId: string): Promise<LogDetail> {
  const response = await fetch(`${API_BASE}/${logId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取日誌詳情');
  }

  const data = await response.json();
  return data.data;
}

async function fetchRelatedLogs(logId: string, limit?: number): Promise<RelatedLogsResponse> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));

  const response = await fetch(`${API_BASE}/${logId}/related?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取關聯日誌');
  }

  const data = await response.json();
  return {
    relatedLogs: data.data,
    correlationId: data.meta.correlationId,
    total: data.meta.total,
  };
}

async function fetchLogStats(startTime?: string, endTime?: string): Promise<LogStats> {
  const params = new URLSearchParams();
  if (startTime) params.set('startTime', startTime);
  if (endTime) params.set('endTime', endTime);

  const response = await fetch(`${API_BASE}/stats?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取日誌統計');
  }

  const data = await response.json();
  return data.data;
}

async function createExport(params: CreateExportParams): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法建立匯出任務');
  }

  const data = await response.json();
  return data.data;
}

async function fetchExportStatus(exportId: string): Promise<ExportStatusResponse> {
  const response = await fetch(`${API_BASE}/export/${exportId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '無法獲取匯出狀態');
  }

  const data = await response.json();
  return data.data;
}

// ============================================================
// Hooks
// ============================================================

/**
 * 獲取日誌列表
 * @param filters - 篩選條件
 */
export function useLogs(filters?: LogListFilters) {
  return useQuery({
    queryKey: logKeys.list(filters),
    queryFn: () => fetchLogs(filters),
  });
}

/**
 * 獲取日誌詳情
 * @param logId - 日誌 ID
 */
export function useLogDetail(logId: string | null) {
  return useQuery({
    queryKey: logKeys.detail(logId || ''),
    queryFn: () => fetchLogDetail(logId!),
    enabled: !!logId,
  });
}

/**
 * 獲取關聯日誌
 * @param logId - 日誌 ID
 * @param limit - 最大返回數量
 */
export function useRelatedLogs(logId: string | null, limit?: number) {
  return useQuery({
    queryKey: logKeys.related(logId || ''),
    queryFn: () => fetchRelatedLogs(logId!, limit),
    enabled: !!logId,
  });
}

/**
 * 獲取日誌統計
 * @param timeRange - 時間範圍
 */
export function useLogStats(timeRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: logKeys.stats(timeRange),
    queryFn: () => fetchLogStats(timeRange?.start, timeRange?.end),
    refetchInterval: 60000, // 每分鐘刷新
  });
}

/**
 * 建立日誌匯出任務
 */
export function useCreateLogExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logKeys.exports() });
    },
  });
}

/**
 * 獲取匯出狀態
 * @param exportId - 匯出任務 ID
 * @param polling - 是否輪詢更新
 */
export function useExportStatus(exportId: string | null, polling = false) {
  return useQuery({
    queryKey: logKeys.export(exportId || ''),
    queryFn: () => fetchExportStatus(exportId!),
    enabled: !!exportId,
    refetchInterval: polling ? 2000 : false, // 每 2 秒輪詢
  });
}

/**
 * 日誌即時串流 Hook
 * @param options - 串流選項
 */
export function useLogStream(options?: {
  levels?: LogLevel[];
  sources?: LogSource[];
  enabled?: boolean;
  onLog?: (log: LogEntry) => void;
  onError?: (error: Error) => void;
}) {
  const { levels, sources, enabled = true, onLog, onError } = options || {};

  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const onLogRef = useRef(onLog);
  const onErrorRef = useRef(onError);

  // 更新 callback refs
  onLogRef.current = onLog;
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = new URLSearchParams();
    if (levels?.length) params.set('levels', levels.join(','));
    if (sources?.length) params.set('sources', sources.join(','));

    const url = `${API_BASE}/stream?${params.toString()}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: StreamMessage = JSON.parse(event.data);

        if (message.type === 'log' && message.data) {
          setLogs((prev) => [message.data!, ...prev].slice(0, 500)); // 保留最近 500 條
          onLogRef.current?.(message.data);
        }
      } catch (e) {
        console.error('Failed to parse log stream message:', e);
      }
    };

    eventSource.onerror = () => {
      const err = new Error('日誌串流連線中斷');
      setError(err);
      setIsConnected(false);
      onErrorRef.current?.(err);

      // 5 秒後嘗試重連
      setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, 5000);
    };

    eventSourceRef.current = eventSource;
  }, [levels, sources, enabled]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    logs,
    error,
    connect,
    disconnect,
    clearLogs,
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 獲取日誌級別顏色
 */
export function getLogLevelColor(
  level: LogLevel
): 'default' | 'secondary' | 'warning' | 'destructive' {
  const colorMap: Record<LogLevel, 'default' | 'secondary' | 'warning' | 'destructive'> = {
    DEBUG: 'secondary',
    INFO: 'default',
    WARN: 'warning',
    ERROR: 'destructive',
    CRITICAL: 'destructive',
  };
  return colorMap[level] || 'default';
}

/**
 * 獲取日誌級別標籤
 */
export function getLogLevelLabel(level: LogLevel): string {
  const labelMap: Record<LogLevel, string> = {
    DEBUG: '除錯',
    INFO: '資訊',
    WARN: '警告',
    ERROR: '錯誤',
    CRITICAL: '嚴重',
  };
  return labelMap[level] || level;
}

/**
 * 獲取日誌來源標籤
 */
export function getLogSourceLabel(source: LogSource): string {
  const labelMap: Record<LogSource, string> = {
    WEB: '前端',
    API: 'API',
    AI: 'AI 服務',
    DATABASE: '資料庫',
    N8N: 'n8n',
    SCHEDULER: '排程',
    BACKGROUND: '背景任務',
    SYSTEM: '系統',
  };
  return labelMap[source] || source;
}

/**
 * 格式化日誌時間戳
 */
export function formatLogTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * 判斷是否為錯誤級別日誌
 */
export function isErrorLog(level: LogLevel): boolean {
  return level === 'ERROR' || level === 'CRITICAL';
}
