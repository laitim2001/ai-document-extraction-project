'use client';

/**
 * @fileoverview 即時日誌串流面板組件
 * @description
 *   顯示即時日誌串流，透過 SSE 接收新日誌。
 *   支援按級別和來源篩選即時日誌。
 *
 * @module src/components/features/admin/logs/LogStreamPanel
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useLogStream,
  getLogLevelLabel,
  getLogSourceLabel,
} from '@/hooks/use-logs';
import type { LogEntry } from '@/types/logging';
import { LogLevel, LogSource } from '@prisma/client';
import {
  X,
  Pause,
  Play,
  Trash2,
  Filter,
  Circle,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface LogStreamPanelProps {
  onClose: () => void;
  onSelectLog?: (logId: string) => void;
}

// ============================================================
// Constants
// ============================================================

const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
const LOG_SOURCES: LogSource[] = ['WEB', 'API', 'AI', 'DATABASE', 'N8N', 'SCHEDULER', 'BACKGROUND', 'SYSTEM'];

// ============================================================
// Sub-Components
// ============================================================

function LogLevelIcon({ level }: { level: LogLevel }) {
  const icons: Record<LogLevel, React.ReactNode> = {
    DEBUG: <Bug className="h-3 w-3" />,
    INFO: <Info className="h-3 w-3" />,
    WARN: <AlertTriangle className="h-3 w-3" />,
    ERROR: <AlertCircle className="h-3 w-3" />,
    CRITICAL: <AlertCircle className="h-3 w-3" />,
  };

  const colors: Record<LogLevel, string> = {
    DEBUG: 'text-gray-400',
    INFO: 'text-blue-500',
    WARN: 'text-yellow-500',
    ERROR: 'text-red-500',
    CRITICAL: 'text-red-600',
  };

  return <span className={colors[level]}>{icons[level]}</span>;
}

function StreamLogItem({
  log,
  onClick,
}: {
  log: LogEntry;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1.5 px-2 hover:bg-muted/50 cursor-pointer rounded text-sm font-mono',
        log.level === 'ERROR' || log.level === 'CRITICAL'
          ? 'bg-red-50 dark:bg-red-950/20'
          : ''
      )}
      onClick={onClick}
    >
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {new Date(log.timestamp).toLocaleTimeString('zh-TW', { hour12: false })}
      </span>
      <LogLevelIcon level={log.level} />
      <Badge variant="outline" className="text-[10px] h-4 px-1">
        {log.source}
      </Badge>
      <span className="flex-1 truncate">{log.message}</span>
    </div>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * @component LogStreamPanel
 * @description 即時日誌串流面板
 */
export function LogStreamPanel({ onClose, onSelectLog }: LogStreamPanelProps) {
  // --- State ---
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [selectedSources, setSelectedSources] = useState<LogSource[]>([]);

  // --- Refs ---
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Stream Hook ---
  const {
    isConnected,
    logs,
    error,
    clearLogs,
  } = useLogStream({
    levels: selectedLevels.length > 0 ? selectedLevels : undefined,
    sources: selectedSources.length > 0 ? selectedSources : undefined,
    enabled: !isPaused,
  });

  // --- Effects ---
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  // --- Handlers ---
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

  // --- Render ---
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">即時日誌</CardTitle>
            <div className="flex items-center gap-1.5">
              <Circle
                className={cn(
                  'h-2 w-2',
                  isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
                )}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? '已連線' : '未連線'}
              </span>
            </div>
            {error && (
              <Badge variant="destructive" className="text-xs">
                {error.message}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 篩選按鈕 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Filter className="h-3 w-3" />
                  篩選
                  {(selectedLevels.length > 0 || selectedSources.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
                      {selectedLevels.length + selectedSources.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>日誌級別</DropdownMenuLabel>
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
                <DropdownMenuSeparator />
                <DropdownMenuLabel>日誌來源</DropdownMenuLabel>
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

            {/* 控制按鈕 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? '繼續' : '暫停'}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              title="清除"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="關閉"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="flex items-center justify-between">
          <span>顯示最近 {logs.length} 筆日誌</span>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
            />
            <Label htmlFor="auto-scroll" className="text-xs cursor-pointer">
              自動捲動
            </Label>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] rounded border bg-muted/30" ref={scrollRef}>
          <div className="p-2 space-y-0.5">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {isPaused ? '串流已暫停' : '等待新的日誌...'}
              </div>
            ) : (
              logs.map((log) => (
                <StreamLogItem
                  key={log.id}
                  log={log}
                  onClick={() => onSelectLog?.(log.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
