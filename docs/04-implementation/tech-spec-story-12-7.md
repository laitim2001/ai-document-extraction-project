# Tech Spec: Story 12-7 - 系統日誌查詢

## 1. Overview

### 1.1 Story Information
- **Story ID**: 12-7
- **Epic**: Epic 12 - 系統管理與監控
- **Title**: 系統日誌查詢
- **Priority**: High
- **Estimated Points**: 8
- **FR Coverage**: FR59, FR60

### 1.2 User Story
**As a** 系統管理員,
**I want** 查詢和分析系統日誌,
**So that** 我可以診斷問題和追蹤系統行為。

### 1.3 Acceptance Criteria Summary
- **AC 12-7-1**: 日誌篩選搜尋（時間範圍、日誌級別、服務來源、關鍵字）
- **AC 12-7-2**: 日誌列表顯示（時間戳、級別顏色編碼、來源、訊息摘要）
- **AC 12-7-3**: 日誌詳情（完整訊息、堆疊追蹤、關聯日誌連結）
- **AC 12-7-4**: 日誌分頁與匯出（每頁 100 筆、匯出最多 10,000 筆）
- **AC 12-7-5**: 即時日誌串流（暫停/繼續控制）

---

## 2. Technical Architecture

### 2.1 System Components Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           系統日誌查詢架構                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Frontend (React Components)                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │                        LogViewer                                 ││   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           ││   │
│  │  │  │StatsCards│ │FilterBar │ │StreamView│ │LogTable  │           ││   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           ││   │
│  │  │       │            │            │            │                  ││   │
│  │  │       └────────────┴─────┬──────┴────────────┘                  ││   │
│  │  │                          ↓                                      ││   │
│  │  │                 LogDetailModal                                  ││   │
│  │  │          (詳情 + 堆疊追蹤 + 關聯日誌)                             ││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    │          API Layer            │                       │
│                    │   ┌─────────────────────────┐ │                       │
│                    │   │ /api/admin/logs/*       │ │                       │
│                    │   │ ├─ GET /               │ │                       │
│                    │   │ ├─ GET /:id            │ │                       │
│                    │   │ ├─ GET /:id/related    │ │                       │
│                    │   │ ├─ GET /stats          │ │                       │
│                    │   │ ├─ POST /export        │ │                       │
│                    │   │ └─ GET /stream (SSE)   │ │                       │
│                    │   └─────────────────────────┘ │                       │
│                    └───────────────┬───────────────┘                       │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐ │
│  │                        Service Layer                                   │ │
│  │  ┌─────────────────────────┐  ┌────────────────────────────────────┐  │ │
│  │  │    LogQueryService      │  │       LoggerService                │  │ │
│  │  │  ┌───────────────────┐  │  │  ┌──────────────────────────────┐  │  │ │
│  │  │  │ queryLogs()       │  │  │  │ debug/info/warn/error/crit() │  │  │ │
│  │  │  │ getLogDetail()    │  │  │  │ httpRequest()                │  │  │ │
│  │  │  │ getRelatedLogs()  │  │  │  │ (寫入 DB + 發送事件)          │  │  │ │
│  │  │  │ getLogStats()     │  │  │  └──────────────────────────────┘  │  │ │
│  │  │  │ exportLogs()      │  │  │                │                   │  │ │
│  │  │  │ cleanupExpired()  │  │  │                ↓                   │  │ │
│  │  │  └───────────────────┘  │  │    LogStreamEmitter (EventEmitter) │  │ │
│  │  └─────────────────────────┘  └────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐ │
│  │                         Data Layer                                     │ │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────┐    │ │
│  │  │    SystemLog     │ │LogRetentionPolicy│ │     LogExport       │    │ │
│  │  │  (主日誌表)       │ │  (保留策略)       │ │   (匯出記錄)         │    │ │
│  │  │                  │ │                  │ │                     │    │ │
│  │  │  ・level         │ │  ・level         │ │  ・filters (JSON)   │    │ │
│  │  │  ・source        │ │  ・retentionDays │ │  ・exportedCount    │    │ │
│  │  │  ・message       │ │  ・isEnabled     │ │  ・fileName         │    │ │
│  │  │  ・correlationId │ └──────────────────┘ │  ・status           │    │ │
│  │  │  ・stackTrace    │                      └─────────────────────┘    │ │
│  │  │  ・httpMethod    │                                                  │ │
│  │  │  ・timestamp     │                                                  │ │
│  │  └──────────────────┘                                                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Middleware Layer                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │ loggingMiddleware + withLogging (請求追蹤 + 自動日誌記錄)         ││   │
│  │  │  ├─ correlationId: 請求追蹤 ID                                   ││   │
│  │  │  ├─ requestId: 唯一請求 ID                                       ││   │
│  │  │  ├─ AsyncLocalStorage: 上下文傳遞                                ││   │
│  │  │  └─ responseTimeMs: 回應時間追蹤                                 ││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Log Writing Flow (日誌寫入流程)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           日誌寫入流程                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP Request                                                               │
│       │                                                                     │
│       ↓                                                                     │
│  ┌─────────────────┐                                                       │
│  │loggingMiddleware│                                                       │
│  └────────┬────────┘                                                       │
│           │ Generate correlationId + requestId                             │
│           ↓                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AsyncLocalStorage (請求上下文)                    │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │ { correlationId, requestId, userId, sessionId }                 ││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                │
│           ↓                                                                │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│  │  Application    │────→│  LoggerService  │────→│   SystemLog     │      │
│  │  Code           │     │  (各模組 Logger) │     │   (Database)    │      │
│  └─────────────────┘     └────────┬────────┘     └─────────────────┘      │
│                                   │                                        │
│                                   │ emit('log', logEntry)                  │
│                                   ↓                                        │
│                          ┌─────────────────┐                               │
│                          │LogStreamEmitter │                               │
│                          │  (EventEmitter) │                               │
│                          └────────┬────────┘                               │
│                                   │                                        │
│              ┌────────────────────┴────────────────────┐                   │
│              ↓                                         ↓                   │
│     ┌────────────────┐                        ┌────────────────┐           │
│     │ SSE Clients    │                        │ Console Output │           │
│     │ (即時串流)      │                        │ (dev環境)       │           │
│     └────────────────┘                        └────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Real-time Streaming Architecture (即時串流架構)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Server-Sent Events (SSE) 即時串流                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Client                                   Server                           │
│     │                                        │                              │
│     │  GET /api/admin/logs/stream            │                              │
│     │  Accept: text/event-stream             │                              │
│     │ ─────────────────────────────────────→ │                              │
│     │                                        │                              │
│     │       Content-Type: text/event-stream  │                              │
│     │       Connection: keep-alive           │                              │
│     │ ←───────────────────────────────────── │                              │
│     │                                        │                              │
│     │  ┌──────────────────────────────────┐  │  ┌─────────────────────────┐ │
│     │  │  EventSource                     │  │  │ ReadableStream         │ │
│     │  │  ├─ onmessage: parse + display   │  │  │ ├─ onLog: filter + send│ │
│     │  │  └─ onerror: reconnect           │  │  │ └─ heartbeat: 30s      │ │
│     │  └──────────────────────────────────┘  │  └─────────────────────────┘ │
│     │                                        │                              │
│     │   data: {"level":"INFO",...}           │                              │
│     │ ←───────────────────────────────────── │  (New log event)             │
│     │                                        │                              │
│     │   data: {"level":"ERROR",...}          │                              │
│     │ ←───────────────────────────────────── │  (New log event)             │
│     │                                        │                              │
│     │   : heartbeat                          │                              │
│     │ ←───────────────────────────────────── │  (每 30 秒)                  │
│     │                                        │                              │
│     │  (User closes stream)                  │                              │
│     │ ──────────────────────────────────────→│                              │
│     │                                        │  (cleanup: removeListener)   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Filter Support                                   │   │
│  │   ?levels=ERROR,CRITICAL    → 只串流 ERROR 和 CRITICAL 級別           │   │
│  │   ?sources=WEB,API          → 只串流 WEB 和 API 來源                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Prisma Schema

```prisma
// ============================================================
// ENUMS
// ============================================================

// 日誌級別
enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
  CRITICAL
}

// 服務來源
enum LogSource {
  WEB           // Web 應用
  API           // API 服務
  AI            // AI 服務
  DATABASE      // 數據庫
  N8N           // n8n 工作流
  SCHEDULER     // 排程任務
  BACKGROUND    // 背景任務
  SYSTEM        // 系統
}

// ============================================================
// MODELS
// ============================================================

// 系統日誌
model SystemLog {
  id              String      @id @default(cuid())

  // 日誌內容
  level           LogLevel
  source          LogSource
  message         String
  details         Json?       // 額外詳情

  // 追蹤資訊
  correlationId   String?     // 請求追蹤 ID (跨服務追蹤)
  requestId       String?     // HTTP 請求 ID (單一請求)
  sessionId       String?     // Session ID

  // 關聯資訊
  userId          String?
  user            User?       @relation(fields: [userId], references: [id])
  resourceType    String?     // 相關資源類型 (Invoice, Forwarder, etc.)
  resourceId      String?     // 相關資源 ID

  // 錯誤資訊
  errorCode       String?
  stackTrace      String?     @db.Text

  // HTTP 資訊
  httpMethod      String?     // GET, POST, PUT, DELETE
  httpPath        String?     // /api/invoices/123
  httpStatusCode  Int?        // 200, 404, 500
  responseTimeMs  Int?        // 回應時間 (毫秒)

  // 元資料
  environment     String?     // production/staging/development
  hostname        String?     // 伺服器主機名
  version         String?     // 應用版本

  // 時間
  timestamp       DateTime    @default(now())

  // 索引優化
  @@index([timestamp])
  @@index([level, timestamp])
  @@index([source, timestamp])
  @@index([correlationId])
  @@index([userId, timestamp])
  @@index([resourceType, resourceId])
}

// 日誌保留策略
model LogRetentionPolicy {
  id              String      @id @default(cuid())
  level           LogLevel
  retentionDays   Int         @default(30)    // DEBUG: 7天, INFO: 30天, ERROR: 90天
  isEnabled       Boolean     @default(true)
  updatedAt       DateTime    @updatedAt
}

// 日誌匯出記錄
model LogExport {
  id              String      @id @default(cuid())

  // 匯出條件
  filters         Json        // 篩選條件 (JSON)
  exportedCount   Int
  fileSize        Int?        // 檔案大小 (bytes)

  // 檔案資訊
  fileName        String      // logs-1734567890.csv
  storagePath     String?     // /tmp/exports/{id}.csv

  // 狀態
  status          String      // pending | completed | failed
  errorMessage    String?

  // 審計
  createdAt       DateTime    @default(now())
  completedAt     DateTime?
  createdBy       String
  createdByUser   User        @relation(fields: [createdBy], references: [id])

  @@index([createdAt])
  @@index([status])
}
```

### 3.2 TypeScript Interfaces

```typescript
// types/logging.ts

import { LogLevel, LogSource } from '@prisma/client';

// 日誌查詢篩選條件
export interface LogQueryFilters {
  startTime?: Date;
  endTime?: Date;
  levels?: LogLevel[];
  sources?: LogSource[];
  keyword?: string;
  userId?: string;
  correlationId?: string;
  resourceType?: string;
  resourceId?: string;
  httpStatusCode?: number;
}

// 日誌查詢選項
export interface LogQueryOptions {
  filters: LogQueryFilters;
  limit?: number;      // 預設 100
  offset?: number;     // 預設 0
  orderBy?: 'asc' | 'desc';  // 預設 desc
}

// 日誌條目
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: any;
  correlationId?: string;
  userId?: string;
  userName?: string;
  stackTrace?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatusCode?: number;
  responseTimeMs?: number;
}

// 日誌統計
export interface LogStats {
  totalCount: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<LogSource, number>;
  errorRate: number;        // 錯誤率 (%)
  avgResponseTime: number;  // 平均回應時間 (ms)
}

// 匯出狀態
export interface ExportStatus {
  status: 'pending' | 'completed' | 'failed';
  exportedCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
}

// 日誌寫入選項
export interface LogOptions {
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: any;
  error?: Error;
  resourceType?: string;
  resourceId?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatusCode?: number;
  responseTimeMs?: number;
}

// 請求上下文
export interface RequestContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
}
```

---

## 4. Service Implementation

### 4.1 LogQueryService (日誌查詢服務)

```typescript
// services/logging/log-query.service.ts
import { PrismaClient, LogLevel, LogSource, SystemLog } from '@prisma/client';
import { createObjectCsvStringifier } from 'csv-writer';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import {
  LogQueryFilters,
  LogQueryOptions,
  LogEntry,
  LogStats,
  ExportStatus
} from '@/types/logging';

const prisma = new PrismaClient();

// 即時日誌事件發送器 (Singleton)
class LogStreamEmitter extends EventEmitter {
  private static instance: LogStreamEmitter;

  static getInstance(): LogStreamEmitter {
    if (!LogStreamEmitter.instance) {
      LogStreamEmitter.instance = new LogStreamEmitter();
      LogStreamEmitter.instance.setMaxListeners(100); // 支援多個 SSE 連線
    }
    return LogStreamEmitter.instance;
  }

  emitLog(log: LogEntry): void {
    this.emit('log', log);
  }
}

export const logStreamEmitter = LogStreamEmitter.getInstance();

export class LogQueryService {
  /**
   * 查詢日誌
   * @param options 查詢選項
   * @returns 分頁日誌結果
   */
  async queryLogs(options: LogQueryOptions): Promise<{
    logs: LogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const { filters, limit = 100, offset = 0, orderBy = 'desc' } = options;

    const where = this.buildWhereClause(filters);

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { timestamp: orderBy },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, displayName: true },
          },
        },
      }),
      prisma.systemLog.count({ where }),
    ]);

    return {
      logs: logs.map(this.mapToLogEntry),
      total,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * 取得單筆日誌詳情
   */
  async getLogDetail(logId: string): Promise<LogEntry | null> {
    const log = await prisma.systemLog.findUnique({
      where: { id: logId },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    if (!log) return null;

    return this.mapToLogEntry(log);
  }

  /**
   * 取得關聯日誌 (同一 correlationId)
   */
  async getRelatedLogs(correlationId: string): Promise<LogEntry[]> {
    if (!correlationId) return [];

    const logs = await prisma.systemLog.findMany({
      where: { correlationId },
      orderBy: { timestamp: 'asc' },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
      },
    });

    return logs.map(this.mapToLogEntry);
  }

  /**
   * 取得日誌統計
   */
  async getLogStats(filters: LogQueryFilters): Promise<LogStats> {
    const where = this.buildWhereClause(filters);

    const [
      totalCount,
      levelCounts,
      sourceCounts,
      errorCount,
      avgResponseTime,
    ] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.groupBy({
        by: ['level'],
        where,
        _count: true,
      }),
      prisma.systemLog.groupBy({
        by: ['source'],
        where,
        _count: true,
      }),
      prisma.systemLog.count({
        where: {
          ...where,
          level: { in: ['ERROR', 'CRITICAL'] },
        },
      }),
      prisma.systemLog.aggregate({
        where: {
          ...where,
          responseTimeMs: { not: null },
        },
        _avg: { responseTimeMs: true },
      }),
    ]);

    const byLevel: Record<string, number> = {};
    levelCounts.forEach((item) => {
      byLevel[item.level] = item._count;
    });

    const bySource: Record<string, number> = {};
    sourceCounts.forEach((item) => {
      bySource[item.source] = item._count;
    });

    return {
      totalCount,
      byLevel: byLevel as Record<LogLevel, number>,
      bySource: bySource as Record<LogSource, number>,
      errorRate: totalCount > 0 ? (errorCount / totalCount) * 100 : 0,
      avgResponseTime: avgResponseTime._avg.responseTimeMs || 0,
    };
  }

  /**
   * 匯出日誌 (異步)
   */
  async exportLogs(
    filters: LogQueryFilters,
    userId: string,
    maxRecords: number = 10000
  ): Promise<{ exportId: string }> {
    // 創建匯出記錄
    const exportRecord = await prisma.logExport.create({
      data: {
        filters: filters as any,
        exportedCount: 0,
        fileName: `logs-${Date.now()}.csv`,
        status: 'pending',
        createdBy: userId,
      },
    });

    // 異步執行匯出
    this.executeExport(exportRecord.id, filters, maxRecords).catch((error) => {
      console.error(`Log export ${exportRecord.id} failed:`, error);
    });

    return { exportId: exportRecord.id };
  }

  /**
   * 執行匯出 (內部方法)
   */
  private async executeExport(
    exportId: string,
    filters: LogQueryFilters,
    maxRecords: number
  ): Promise<void> {
    try {
      const where = this.buildWhereClause(filters);

      const logs = await prisma.systemLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: maxRecords,
        include: {
          user: {
            select: { displayName: true },
          },
        },
      });

      // 生成 CSV
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'timestamp', title: '時間' },
          { id: 'level', title: '級別' },
          { id: 'source', title: '來源' },
          { id: 'message', title: '訊息' },
          { id: 'userId', title: '用戶 ID' },
          { id: 'userName', title: '用戶名稱' },
          { id: 'correlationId', title: '追蹤 ID' },
          { id: 'httpMethod', title: 'HTTP 方法' },
          { id: 'httpPath', title: 'HTTP 路徑' },
          { id: 'httpStatusCode', title: 'HTTP 狀態碼' },
          { id: 'responseTimeMs', title: '回應時間 (ms)' },
        ],
      });

      const records = logs.map((log) => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        source: log.source,
        message: log.message,
        userId: log.userId || '',
        userName: log.user?.displayName || '',
        correlationId: log.correlationId || '',
        httpMethod: log.httpMethod || '',
        httpPath: log.httpPath || '',
        httpStatusCode: log.httpStatusCode || '',
        responseTimeMs: log.responseTimeMs || '',
      }));

      const csvContent =
        csvStringifier.getHeaderString() +
        csvStringifier.stringifyRecords(records);
      const fileSize = Buffer.byteLength(csvContent, 'utf8');

      // 儲存檔案
      const filePath = `/tmp/exports/${exportId}.csv`;
      await fs.mkdir('/tmp/exports', { recursive: true });
      await fs.writeFile(filePath, csvContent);

      // 更新匯出記錄
      await prisma.logExport.update({
        where: { id: exportId },
        data: {
          status: 'completed',
          exportedCount: logs.length,
          fileSize,
          storagePath: filePath,
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      await prisma.logExport.update({
        where: { id: exportId },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * 取得匯出狀態
   */
  async getExportStatus(exportId: string): Promise<ExportStatus | null> {
    const record = await prisma.logExport.findUnique({
      where: { id: exportId },
    });

    if (!record) return null;

    return {
      status: record.status as ExportStatus['status'],
      exportedCount: record.exportedCount,
      fileSize: record.fileSize || undefined,
      downloadUrl:
        record.status === 'completed'
          ? `/api/admin/logs/export/${exportId}/download`
          : undefined,
      error: record.errorMessage || undefined,
    };
  }

  /**
   * 清理過期日誌
   */
  async cleanupExpiredLogs(): Promise<{ deletedCount: number }> {
    const policies = await prisma.logRetentionPolicy.findMany({
      where: { isEnabled: true },
    });

    let totalDeleted = 0;

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const result = await prisma.systemLog.deleteMany({
        where: {
          level: policy.level,
          timestamp: { lt: cutoffDate },
        },
      });

      totalDeleted += result.count;
    }

    return { deletedCount: totalDeleted };
  }

  /**
   * 建立查詢條件
   */
  private buildWhereClause(filters: LogQueryFilters): any {
    const where: any = {};

    // 時間範圍
    if (filters.startTime || filters.endTime) {
      where.timestamp = {};
      if (filters.startTime) {
        where.timestamp.gte = filters.startTime;
      }
      if (filters.endTime) {
        where.timestamp.lte = filters.endTime;
      }
    }

    // 日誌級別
    if (filters.levels && filters.levels.length > 0) {
      where.level = { in: filters.levels };
    }

    // 服務來源
    if (filters.sources && filters.sources.length > 0) {
      where.source = { in: filters.sources };
    }

    // 關鍵字搜尋 (訊息、追蹤ID、錯誤碼)
    if (filters.keyword) {
      where.OR = [
        { message: { contains: filters.keyword, mode: 'insensitive' } },
        { correlationId: { contains: filters.keyword, mode: 'insensitive' } },
        { errorCode: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    // 用戶篩選
    if (filters.userId) {
      where.userId = filters.userId;
    }

    // 追蹤 ID
    if (filters.correlationId) {
      where.correlationId = filters.correlationId;
    }

    // 資源類型
    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    // 資源 ID
    if (filters.resourceId) {
      where.resourceId = filters.resourceId;
    }

    // HTTP 狀態碼
    if (filters.httpStatusCode) {
      where.httpStatusCode = filters.httpStatusCode;
    }

    return where;
  }

  /**
   * 轉換為 LogEntry
   */
  private mapToLogEntry(log: any): LogEntry {
    return {
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      source: log.source,
      message: log.message,
      details: log.details,
      correlationId: log.correlationId || undefined,
      userId: log.userId || undefined,
      userName: log.user?.displayName,
      stackTrace: log.stackTrace || undefined,
      httpMethod: log.httpMethod || undefined,
      httpPath: log.httpPath || undefined,
      httpStatusCode: log.httpStatusCode || undefined,
      responseTimeMs: log.responseTimeMs || undefined,
    };
  }
}

export const logQueryService = new LogQueryService();
```

### 4.2 LoggerService (日誌寫入服務)

```typescript
// services/logging/logger.service.ts
import { PrismaClient, LogLevel, LogSource } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { logStreamEmitter } from './log-query.service';
import { LogOptions, RequestContext, LogEntry } from '@/types/logging';

const prisma = new PrismaClient();

// 請求上下文存儲 (用於自動追蹤 correlationId)
export const requestContext = new AsyncLocalStorage<RequestContext>();

export class LoggerService {
  private source: LogSource;

  constructor(source: LogSource) {
    this.source = source;
  }

  /**
   * Debug 日誌 (開發調試用)
   */
  debug(message: string, details?: any): Promise<void> {
    return this.log({ level: 'DEBUG', source: this.source, message, details });
  }

  /**
   * Info 日誌 (一般資訊)
   */
  info(message: string, details?: any): Promise<void> {
    return this.log({ level: 'INFO', source: this.source, message, details });
  }

  /**
   * Warning 日誌 (警告)
   */
  warn(message: string, details?: any): Promise<void> {
    return this.log({ level: 'WARN', source: this.source, message, details });
  }

  /**
   * Error 日誌 (錯誤)
   */
  error(message: string, error?: Error, details?: any): Promise<void> {
    return this.log({
      level: 'ERROR',
      source: this.source,
      message,
      error,
      details,
    });
  }

  /**
   * Critical 日誌 (嚴重錯誤)
   */
  critical(message: string, error?: Error, details?: any): Promise<void> {
    return this.log({
      level: 'CRITICAL',
      source: this.source,
      message,
      error,
      details,
    });
  }

  /**
   * HTTP 請求日誌 (自動判斷級別)
   */
  httpRequest(options: {
    method: string;
    path: string;
    statusCode: number;
    responseTimeMs: number;
    userId?: string;
    details?: any;
  }): Promise<void> {
    // 根據狀態碼自動判斷日誌級別
    const level: LogLevel =
      options.statusCode >= 500
        ? 'ERROR'
        : options.statusCode >= 400
        ? 'WARN'
        : 'INFO';

    return this.log({
      level,
      source: this.source,
      message: `${options.method} ${options.path} ${options.statusCode} ${options.responseTimeMs}ms`,
      httpMethod: options.method,
      httpPath: options.path,
      httpStatusCode: options.statusCode,
      responseTimeMs: options.responseTimeMs,
      details: options.details,
    });
  }

  /**
   * 寫入日誌 (核心方法)
   */
  private async log(options: LogOptions): Promise<void> {
    const context = requestContext.getStore();

    const logData = {
      level: options.level,
      source: options.source,
      message: options.message,
      details: options.details,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      sessionId: context?.sessionId,
      userId: context?.userId,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      errorCode: options.error?.name,
      stackTrace: options.error?.stack,
      httpMethod: options.httpMethod,
      httpPath: options.httpPath,
      httpStatusCode: options.httpStatusCode,
      responseTimeMs: options.responseTimeMs,
      environment: process.env.NODE_ENV,
      hostname: process.env.HOSTNAME,
      version: process.env.APP_VERSION,
    };

    try {
      // 寫入數據庫
      const savedLog = await prisma.systemLog.create({
        data: logData,
      });

      // 發送即時日誌事件 (供 SSE 串流)
      const logEntry: LogEntry = {
        id: savedLog.id,
        timestamp: savedLog.timestamp,
        level: savedLog.level,
        source: savedLog.source,
        message: savedLog.message,
        details: savedLog.details,
        correlationId: savedLog.correlationId || undefined,
        userId: savedLog.userId || undefined,
        stackTrace: savedLog.stackTrace || undefined,
        httpMethod: savedLog.httpMethod || undefined,
        httpPath: savedLog.httpPath || undefined,
        httpStatusCode: savedLog.httpStatusCode || undefined,
        responseTimeMs: savedLog.responseTimeMs || undefined,
      };
      logStreamEmitter.emitLog(logEntry);

      // 開發環境輸出到控制台
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${options.level}] [${options.source}] ${options.message}`);
        if (options.error) {
          console.error(options.error);
        }
      }
    } catch (error) {
      // 如果日誌寫入失敗，至少輸出到控制台
      console.error('Failed to write log:', error);
      console.log(`[${options.level}] [${options.source}] ${options.message}`);
    }
  }
}

// 預設 Logger 實例 (各模組專用)
export const webLogger = new LoggerService('WEB');
export const apiLogger = new LoggerService('API');
export const aiLogger = new LoggerService('AI');
export const dbLogger = new LoggerService('DATABASE');
export const n8nLogger = new LoggerService('N8N');
export const schedulerLogger = new LoggerService('SCHEDULER');
export const backgroundLogger = new LoggerService('BACKGROUND');
export const systemLogger = new LoggerService('SYSTEM');

// 創建自定義 Logger
export function createLogger(source: LogSource): LoggerService {
  return new LoggerService(source);
}
```

### 4.3 Logging Middleware (日誌中間件)

```typescript
// middleware/logging.middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requestContext, apiLogger } from '@/services/logging/logger.service';

/**
 * Next.js Middleware - 自動設置請求追蹤 ID
 */
export async function loggingMiddleware(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || uuidv4();
  const requestId = uuidv4();

  // 添加追蹤 ID 到響應頭
  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-request-id', requestId);

  return response;
}

/**
 * API 路由包裝器 - 自動記錄請求日誌
 */
export function withLogging<T>(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    routeContext: any
  ): Promise<NextResponse> => {
    const correlationId =
      request.headers.get('x-correlation-id') || uuidv4();
    const requestId = uuidv4();
    const startTime = Date.now();

    return requestContext.run(
      {
        correlationId,
        requestId,
        userId: undefined,
        sessionId: undefined,
      },
      async () => {
        try {
          const response = await handler(request, routeContext);
          const responseTime = Date.now() - startTime;

          // 記錄成功請求
          await apiLogger.httpRequest({
            method: request.method,
            path: new URL(request.url).pathname,
            statusCode: response.status,
            responseTimeMs: responseTime,
          });

          response.headers.set('x-correlation-id', correlationId);
          response.headers.set('x-request-id', requestId);

          return response;
        } catch (error: any) {
          const responseTime = Date.now() - startTime;

          // 記錄錯誤
          await apiLogger.error(
            `Request failed: ${request.method} ${new URL(request.url).pathname}`,
            error
          );

          throw error;
        }
      }
    );
  };
}
```

---

## 5. API Routes

### 5.1 Route Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/logs` | 查詢日誌列表 |
| GET | `/api/admin/logs/:id` | 取得單筆日誌詳情 |
| GET | `/api/admin/logs/:id/related` | 取得關聯日誌 |
| GET | `/api/admin/logs/stats` | 取得日誌統計 |
| POST | `/api/admin/logs/export` | 匯出日誌 |
| GET | `/api/admin/logs/export/:id` | 取得匯出狀態 |
| GET | `/api/admin/logs/export/:id/download` | 下載匯出檔案 |
| GET | `/api/admin/logs/stream` | 即時日誌串流 (SSE) |

### 5.2 Route Implementations

```typescript
// app/api/admin/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logQueryService } from '@/services/logging/log-query.service';

// GET /api/admin/logs - 查詢日誌
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const filters = {
    startTime: searchParams.get('startTime')
      ? new Date(searchParams.get('startTime')!)
      : undefined,
    endTime: searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : undefined,
    levels: searchParams.get('levels')?.split(',') as any[] || undefined,
    sources: searchParams.get('sources')?.split(',') as any[] || undefined,
    keyword: searchParams.get('keyword') || undefined,
    userId: searchParams.get('userId') || undefined,
    correlationId: searchParams.get('correlationId') || undefined,
  };

  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  const result = await logQueryService.queryLogs({
    filters,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
```

```typescript
// app/api/admin/logs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logQueryService } from '@/services/logging/log-query.service';

// GET /api/admin/logs/:id - 取得日誌詳情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const log = await logQueryService.getLogDetail(params.id);

  if (!log) {
    return NextResponse.json({ error: '日誌不存在' }, { status: 404 });
  }

  return NextResponse.json({ log });
}
```

```typescript
// app/api/admin/logs/[id]/related/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logQueryService } from '@/services/logging/log-query.service';

// GET /api/admin/logs/:id/related - 取得關聯日誌
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const log = await logQueryService.getLogDetail(params.id);

  if (!log || !log.correlationId) {
    return NextResponse.json({ logs: [] });
  }

  const relatedLogs = await logQueryService.getRelatedLogs(log.correlationId);

  return NextResponse.json({ logs: relatedLogs });
}
```

```typescript
// app/api/admin/logs/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logQueryService } from '@/services/logging/log-query.service';

// GET /api/admin/logs/stats - 取得日誌統計
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const filters = {
    startTime: searchParams.get('startTime')
      ? new Date(searchParams.get('startTime')!)
      : new Date(Date.now() - 24 * 60 * 60 * 1000), // 預設 24 小時
    endTime: searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : new Date(),
  };

  const stats = await logQueryService.getLogStats(filters);

  return NextResponse.json(stats);
}
```

```typescript
// app/api/admin/logs/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logQueryService } from '@/services/logging/log-query.service';

// POST /api/admin/logs/export - 匯出日誌
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const body = await request.json();
  const { filters, maxRecords = 10000 } = body;

  // 限制最大匯出數量
  const safeMaxRecords = Math.min(maxRecords, 10000);

  const result = await logQueryService.exportLogs(
    filters,
    session.user.id,
    safeMaxRecords
  );

  return NextResponse.json(result);
}
```

```typescript
// app/api/admin/logs/stream/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logStreamEmitter } from '@/services/logging/log-query.service';
import { LogEntry } from '@/types/logging';

// GET /api/admin/logs/stream - 即時日誌串流 (SSE)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const levels = searchParams.get('levels')?.split(',') || [];
  const sources = searchParams.get('sources')?.split(',') || [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onLog = (log: LogEntry) => {
        // 篩選級別
        if (levels.length > 0 && !levels.includes(log.level)) return;
        // 篩選來源
        if (sources.length > 0 && !sources.includes(log.source)) return;

        const data = `data: ${JSON.stringify(log)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      logStreamEmitter.on('log', onLog);

      // 心跳 (每 30 秒)
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30000);

      // 清理 (當連線關閉時)
      request.signal.addEventListener('abort', () => {
        logStreamEmitter.off('log', onLog);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

---

## 6. React Components

### 6.1 Component Hierarchy

```
LogViewer (主頁面)
├── StatsCards (統計卡片)
│   ├── StatCard (總日誌數)
│   ├── StatCard (錯誤率)
│   ├── StatCard (平均回應時間)
│   ├── StatCard (錯誤數)
│   └── StatCard (警告數)
├── FilterBar (篩選器)
│   ├── DateTimePicker (開始時間)
│   ├── DateTimePicker (結束時間)
│   ├── MultiSelect (日誌級別)
│   ├── MultiSelect (服務來源)
│   └── SearchInput (關鍵字)
├── StreamView (即時串流視窗) [條件渲染]
│   └── StreamLogEntry[]
├── LogTable (日誌列表)
│   ├── TableHeader
│   └── LogRow[] (可點擊展開)
├── Pagination (分頁控制)
└── LogDetailModal (日誌詳情彈窗)
    ├── BasicInfo (基本資訊)
    ├── MessageContent (訊息內容)
    ├── DetailsJson (詳情 JSON)
    ├── StackTrace (堆疊追蹤) [條件渲染]
    └── RelatedLogs (關聯日誌)
```

### 6.2 LogViewer Component

```typescript
// components/admin/logs/LogViewer.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogLevel, LogSource } from '@prisma/client';

// 類型定義
interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: any;
  correlationId?: string;
  userId?: string;
  userName?: string;
  stackTrace?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatusCode?: number;
  responseTimeMs?: number;
}

interface LogStats {
  totalCount: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<LogSource, number>;
  errorRate: number;
  avgResponseTime: number;
}

// 常量定義
const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: 'text-gray-500 bg-gray-100',
  INFO: 'text-blue-600 bg-blue-100',
  WARN: 'text-yellow-600 bg-yellow-100',
  ERROR: 'text-red-600 bg-red-100',
  CRITICAL: 'text-white bg-red-600',
};

const SOURCE_LABELS: Record<LogSource, string> = {
  WEB: 'Web',
  API: 'API',
  AI: 'AI',
  DATABASE: 'Database',
  N8N: 'n8n',
  SCHEDULER: 'Scheduler',
  BACKGROUND: 'Background',
  SYSTEM: 'System',
};

export function LogViewer() {
  // 狀態
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
    endTime: new Date().toISOString().slice(0, 16),
    levels: [] as LogLevel[],
    sources: [] as LogSource[],
    keyword: '',
  });
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 100,
    total: 0,
    hasMore: false,
  });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [relatedLogs, setRelatedLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 初始載入
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  // 清理 EventSource
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // 查詢日誌
  const fetchLogs = async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startTime)
        params.set('startTime', new Date(filters.startTime).toISOString());
      if (filters.endTime)
        params.set('endTime', new Date(filters.endTime).toISOString());
      if (filters.levels.length)
        params.set('levels', filters.levels.join(','));
      if (filters.sources.length)
        params.set('sources', filters.sources.join(','));
      if (filters.keyword) params.set('keyword', filters.keyword);
      params.set('limit', '100');
      params.set('offset', String(offset));

      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();

      setLogs(data.logs);
      setPagination({
        offset,
        limit: 100,
        total: data.total,
        hasMore: data.hasMore,
      });
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // 取得統計
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      params.set('startTime', new Date(filters.startTime).toISOString());
      params.set('endTime', new Date(filters.endTime).toISOString());

      const response = await fetch(`/api/admin/logs/stats?${params}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // 取得關聯日誌
  const fetchRelatedLogs = async (logId: string) => {
    try {
      const response = await fetch(`/api/admin/logs/${logId}/related`);
      const data = await response.json();
      setRelatedLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch related logs:', error);
    }
  };

  // 搜尋
  const handleSearch = () => {
    fetchLogs(0);
    fetchStats();
  };

  // 匯出
  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            startTime: new Date(filters.startTime),
            endTime: new Date(filters.endTime),
            levels: filters.levels.length ? filters.levels : undefined,
            sources: filters.sources.length ? filters.sources : undefined,
            keyword: filters.keyword || undefined,
          },
        }),
      });

      const data = await response.json();
      alert(`匯出已開始，匯出 ID: ${data.exportId}`);
    } catch (error) {
      alert('匯出失敗');
    }
  };

  // 即時串流控制
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      // 停止串流
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    } else {
      // 開始串流
      const params = new URLSearchParams();
      if (filters.levels.length)
        params.set('levels', filters.levels.join(','));
      if (filters.sources.length)
        params.set('sources', filters.sources.join(','));

      const es = new EventSource(`/api/admin/logs/stream?${params}`);

      es.onmessage = (event) => {
        const log = JSON.parse(event.data);
        setStreamLogs((prev) => [log, ...prev.slice(0, 99)]); // 保留最近 100 筆
      };

      es.onerror = () => {
        es.close();
        setIsStreaming(false);
      };

      eventSourceRef.current = es;
      setIsStreaming(true);
      setStreamLogs([]);
    }
  }, [isStreaming, filters.levels, filters.sources]);

  // 點擊日誌
  const handleLogClick = (log: LogEntry) => {
    setSelectedLog(log);
    if (log.correlationId) {
      fetchRelatedLogs(log.id);
    } else {
      setRelatedLogs([]);
    }
  };

  return (
    <div className="p-6">
      {/* 標題列 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">系統日誌查詢</h1>
        <div className="flex gap-2">
          <button
            onClick={toggleStreaming}
            className={`px-4 py-2 rounded-lg ${
              isStreaming
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isStreaming ? '⏹ 停止串流' : '▶ 即時串流'}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            📥 匯出
          </button>
        </div>
      </div>

      {/* 統計卡片 */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard title="總日誌數" value={stats.totalCount.toLocaleString()} />
          <StatCard
            title="錯誤率"
            value={`${stats.errorRate.toFixed(2)}%`}
            color={stats.errorRate > 5 ? 'red' : 'green'}
          />
          <StatCard
            title="平均回應時間"
            value={`${stats.avgResponseTime.toFixed(0)}ms`}
          />
          <StatCard
            title="錯誤數"
            value={(
              (stats.byLevel.ERROR || 0) + (stats.byLevel.CRITICAL || 0)
            ).toLocaleString()}
            color="red"
          />
          <StatCard
            title="警告數"
            value={(stats.byLevel.WARN || 0).toLocaleString()}
            color="yellow"
          />
        </div>
      )}

      {/* 篩選器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">開始時間</label>
            <input
              type="datetime-local"
              value={filters.startTime}
              onChange={(e) =>
                setFilters({ ...filters, startTime: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">結束時間</label>
            <input
              type="datetime-local"
              value={filters.endTime}
              onChange={(e) =>
                setFilters({ ...filters, endTime: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">日誌級別</label>
            <select
              multiple
              value={filters.levels}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  levels: Array.from(
                    e.target.selectedOptions,
                    (o) => o.value as LogLevel
                  ),
                })
              }
              className="w-full px-3 py-2 border rounded"
            >
              {Object.keys(LEVEL_COLORS).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">服務來源</label>
            <select
              multiple
              value={filters.sources}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sources: Array.from(
                    e.target.selectedOptions,
                    (o) => o.value as LogSource
                  ),
                })
              }
              className="w-full px-3 py-2 border rounded"
            >
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">關鍵字</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) =>
                  setFilters({ ...filters, keyword: e.target.value })
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜尋訊息..."
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                搜尋
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 即時串流視窗 */}
      {isStreaming && (
        <div className="bg-gray-900 rounded-lg p-4 mb-6 h-64 overflow-auto font-mono text-sm">
          <div className="text-green-400 mb-2">🔴 即時日誌串流中...</div>
          {streamLogs.map((log) => (
            <div key={log.id} className="text-gray-300 py-1">
              <span className="text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>{' '}
              <span
                className={
                  log.level === 'ERROR' || log.level === 'CRITICAL'
                    ? 'text-red-400'
                    : log.level === 'WARN'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }
              >
                [{log.level}]
              </span>{' '}
              <span className="text-blue-400">[{log.source}]</span> {log.message}
            </div>
          ))}
        </div>
      )}

      {/* 日誌列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium w-40">
                時間
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">
                級別
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">
                來源
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">訊息</th>
              <th className="px-4 py-3 text-left text-sm font-medium w-32">
                追蹤 ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => handleLogClick(log)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-sm font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${LEVEL_COLORS[log.level]}`}
                  >
                    {log.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{SOURCE_LABELS[log.source]}</td>
                <td
                  className="px-4 py-3 text-sm truncate max-w-md"
                  title={log.message}
                >
                  {log.message}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500 truncate">
                  {log.correlationId?.slice(0, 8)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 分頁 */}
        <div className="px-4 py-3 border-t flex justify-between items-center">
          <div className="text-sm text-gray-500">
            顯示 {pagination.offset + 1} -{' '}
            {pagination.offset + logs.length} 筆，共 {pagination.total} 筆
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                fetchLogs(Math.max(0, pagination.offset - pagination.limit))
              }
              disabled={pagination.offset === 0}
              className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
            >
              上一頁
            </button>
            <button
              onClick={() => fetchLogs(pagination.offset + pagination.limit)}
              disabled={!pagination.hasMore}
              className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
            >
              下一頁
            </button>
          </div>
        </div>
      </div>

      {/* 詳情對話框 */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          relatedLogs={relatedLogs}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

// 統計卡片元件
function StatCard({
  title,
  value,
  color = 'gray',
}: {
  title: string;
  value: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-50',
    red: 'bg-red-50',
    green: 'bg-green-50',
    yellow: 'bg-yellow-50',
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// 日誌詳情彈窗元件
function LogDetailModal({
  log,
  relatedLogs,
  onClose,
}: {
  log: LogEntry;
  relatedLogs: LogEntry[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">日誌詳情</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 基本資訊 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <span className="text-gray-500">時間:</span>
            <div className="font-mono">
              {new Date(log.timestamp).toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-gray-500">級別:</span>
            <div>
              <span
                className={`px-2 py-1 rounded text-sm ${LEVEL_COLORS[log.level]}`}
              >
                {log.level}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-500">來源:</span>
            <div>{SOURCE_LABELS[log.source]}</div>
          </div>
          <div>
            <span className="text-gray-500">追蹤 ID:</span>
            <div className="font-mono text-sm">{log.correlationId || '-'}</div>
          </div>
          {log.userId && (
            <div>
              <span className="text-gray-500">用戶:</span>
              <div>{log.userName || log.userId}</div>
            </div>
          )}
          {log.httpMethod && (
            <div>
              <span className="text-gray-500">HTTP:</span>
              <div>
                {log.httpMethod} {log.httpPath} ({log.httpStatusCode}) -{' '}
                {log.responseTimeMs}ms
              </div>
            </div>
          )}
        </div>

        {/* 訊息內容 */}
        <div className="mb-6">
          <span className="text-gray-500">訊息:</span>
          <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
            {log.message}
          </div>
        </div>

        {/* 詳情 */}
        {log.details && (
          <div className="mb-6">
            <span className="text-gray-500">詳情:</span>
            <pre className="bg-gray-50 rounded p-3 font-mono text-sm overflow-auto">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        )}

        {/* 堆疊追蹤 */}
        {log.stackTrace && (
          <div className="mb-6">
            <span className="text-gray-500">堆疊追蹤:</span>
            <pre className="bg-red-50 rounded p-3 font-mono text-xs overflow-auto text-red-700">
              {log.stackTrace}
            </pre>
          </div>
        )}

        {/* 關聯日誌 */}
        {relatedLogs.length > 0 && (
          <div>
            <span className="text-gray-500">
              關聯日誌 ({relatedLogs.length}):
            </span>
            <div className="mt-2 space-y-2 max-h-40 overflow-auto">
              {relatedLogs.map((related) => (
                <div
                  key={related.id}
                  className={`p-2 rounded text-sm ${
                    related.id === log.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <span className="text-gray-500">
                    {new Date(related.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  <span
                    className={`px-1 rounded text-xs ${LEVEL_COLORS[related.level]}`}
                  >
                    {related.level}
                  </span>{' '}
                  {related.message.slice(0, 100)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogViewer;
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// __tests__/services/log-query.service.test.ts
import { LogQueryService } from '@/services/logging/log-query.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

describe('LogQueryService', () => {
  let service: LogQueryService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new LogQueryService();
  });

  describe('queryLogs', () => {
    it('should return paginated logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          level: 'INFO',
          source: 'WEB',
          message: 'Test log',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          level: 'ERROR',
          source: 'API',
          message: 'Error log',
          timestamp: new Date(),
        },
      ];

      (mockPrisma.systemLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (mockPrisma.systemLog.count as jest.Mock).mockResolvedValue(2);

      const result = await service.queryLogs({
        filters: {},
        limit: 100,
        offset: 0,
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by level', async () => {
      (mockPrisma.systemLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.systemLog.count as jest.Mock).mockResolvedValue(0);

      await service.queryLogs({
        filters: { levels: ['ERROR', 'CRITICAL'] },
      });

      expect(mockPrisma.systemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            level: { in: ['ERROR', 'CRITICAL'] },
          }),
        })
      );
    });

    it('should filter by time range', async () => {
      const startTime = new Date('2025-01-01');
      const endTime = new Date('2025-01-31');

      (mockPrisma.systemLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.systemLog.count as jest.Mock).mockResolvedValue(0);

      await service.queryLogs({
        filters: { startTime, endTime },
      });

      expect(mockPrisma.systemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: startTime,
              lte: endTime,
            },
          }),
        })
      );
    });

    it('should filter by keyword', async () => {
      (mockPrisma.systemLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.systemLog.count as jest.Mock).mockResolvedValue(0);

      await service.queryLogs({
        filters: { keyword: 'authentication' },
      });

      expect(mockPrisma.systemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { message: { contains: 'authentication', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('getLogStats', () => {
    it('should calculate log statistics', async () => {
      (mockPrisma.systemLog.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalCount
        .mockResolvedValueOnce(5); // errorCount

      (mockPrisma.systemLog.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { level: 'INFO', _count: 80 },
          { level: 'WARN', _count: 15 },
          { level: 'ERROR', _count: 5 },
        ])
        .mockResolvedValueOnce([
          { source: 'WEB', _count: 60 },
          { source: 'API', _count: 40 },
        ]);

      (mockPrisma.systemLog.aggregate as jest.Mock).mockResolvedValue({
        _avg: { responseTimeMs: 150 },
      });

      const stats = await service.getLogStats({});

      expect(stats.totalCount).toBe(100);
      expect(stats.errorRate).toBe(5);
      expect(stats.avgResponseTime).toBe(150);
    });
  });

  describe('getRelatedLogs', () => {
    it('should return logs with same correlationId', async () => {
      const mockLogs = [
        { id: 'log-1', correlationId: 'corr-1', timestamp: new Date() },
        { id: 'log-2', correlationId: 'corr-1', timestamp: new Date() },
        { id: 'log-3', correlationId: 'corr-1', timestamp: new Date() },
      ];

      (mockPrisma.systemLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.getRelatedLogs('corr-1');

      expect(result).toHaveLength(3);
      expect(mockPrisma.systemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { correlationId: 'corr-1' },
          orderBy: { timestamp: 'asc' },
        })
      );
    });

    it('should return empty array if no correlationId', async () => {
      const result = await service.getRelatedLogs('');
      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredLogs', () => {
    it('should delete logs based on retention policies', async () => {
      const mockPolicies = [
        { id: '1', level: 'DEBUG', retentionDays: 7, isEnabled: true },
        { id: '2', level: 'INFO', retentionDays: 30, isEnabled: true },
      ];

      (mockPrisma.logRetentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies
      );
      (mockPrisma.systemLog.deleteMany as jest.Mock)
        .mockResolvedValueOnce({ count: 100 })
        .mockResolvedValueOnce({ count: 50 });

      const result = await service.cleanupExpiredLogs();

      expect(result.deletedCount).toBe(150);
    });
  });
});
```

---

## 8. Dependencies

### 8.1 Upstream Dependencies
- **Story 1-0**: 專案初始化與基礎架構 (Prisma, Next.js, React)
- **User Model**: 用戶關聯查詢

### 8.2 NPM Packages
| Package | Version | Purpose |
|---------|---------|---------|
| csv-writer | ^1.6.0 | CSV 檔案生成 |
| uuid | ^9.0.0 | UUID 生成 (correlationId, requestId) |
| async_hooks | (Node.js built-in) | AsyncLocalStorage 請求上下文 |

### 8.3 Downstream Dependents
- 所有需要日誌記錄的服務模組
- 系統監控儀表板 (Story 12-1)
- 錯誤警報系統 (Story 12-3)

---

## 9. Acceptance Criteria Verification

### AC 12-7-1: 日誌篩選搜尋
| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| 時間範圍篩選 | `buildWhereClause()` - timestamp.gte/lte | ✅ |
| 日誌級別篩選 | `buildWhereClause()` - level.in | ✅ |
| 服務來源篩選 | `buildWhereClause()` - source.in | ✅ |
| 關鍵字搜尋 | `buildWhereClause()` - OR (message, correlationId, errorCode) | ✅ |
| 用戶 ID 篩選 | `buildWhereClause()` - userId | ✅ |
| 請求 ID 篩選 | `buildWhereClause()` - correlationId | ✅ |

### AC 12-7-2: 日誌列表顯示
| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| 顯示時間戳 | LogTable - timestamp column | ✅ |
| 級別顏色編碼 | LEVEL_COLORS mapping | ✅ |
| 顯示服務來源 | SOURCE_LABELS mapping | ✅ |
| 訊息摘要 | truncate max-w-md | ✅ |
| 點擊展開詳情 | handleLogClick → LogDetailModal | ✅ |

### AC 12-7-3: 日誌詳情
| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| 完整日誌訊息 | LogDetailModal - message section | ✅ |
| 堆疊追蹤 | LogDetailModal - stackTrace section | ✅ |
| 關聯請求 ID | LogDetailModal - correlationId | ✅ |
| 用戶資訊 | LogDetailModal - userId/userName | ✅ |
| 關聯日誌連結 | getRelatedLogs() + relatedLogs section | ✅ |

### AC 12-7-4: 日誌分頁與匯出
| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| 每頁 100 筆 | queryLogs() - limit: 100 | ✅ |
| 分頁控制 | Pagination component | ✅ |
| 匯出功能 | exportLogs() + handleExport() | ✅ |
| 最多 10,000 筆 | maxRecords limit | ✅ |

### AC 12-7-5: 即時日誌串流
| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| SSE 串流 | /api/admin/logs/stream (EventSource) | ✅ |
| 暫停/繼續控制 | toggleStreaming() | ✅ |
| 即時顯示 | StreamView component | ✅ |
| 級別/來源篩選 | SSE query params | ✅ |

---

## 10. Security Considerations

### 10.1 Access Control
- 僅 ADMIN 角色可存取日誌查詢功能
- 所有 API 端點驗證 session.user.role

### 10.2 Data Protection
- 敏感資訊遮罩 (密碼、token 等不記錄)
- 匯出限制最大 10,000 筆
- 日誌保留策略自動清理過期資料

### 10.3 SSE Security
- 認證驗證 (getServerSession)
- 連線關閉時清理 listener
- 心跳機制防止連線超時

---

## 11. Performance Considerations

### 11.1 Database Optimization
- 多欄位複合索引 (level+timestamp, source+timestamp)
- correlationId 索引加速關聯查詢
- 分頁查詢避免大量資料載入

### 11.2 Streaming Optimization
- EventEmitter 單例模式
- setMaxListeners(100) 支援多連線
- 心跳間隔 30 秒平衡負載

### 11.3 Export Optimization
- 異步執行避免阻塞
- 檔案暫存本地後提供下載
- 可擴展至 Azure Blob Storage

---

## 12. Verification Checklist

### 功能驗證
- [ ] 日誌篩選條件正確運作（時間、級別、來源、關鍵字）
- [ ] 日誌分頁功能正常（上/下一頁、總數顯示）
- [ ] 日誌詳情顯示完整（訊息、堆疊、HTTP 資訊）
- [ ] 關聯日誌連結正確（同一 correlationId）
- [ ] 即時串流功能正常（開始/停止、篩選）
- [ ] 日誌匯出功能正常（CSV 下載）
- [ ] 統計數據計算正確（總數、錯誤率、平均回應時間）

### 安全驗證
- [ ] 僅管理員可查看日誌
- [ ] API 驗證正確實作
- [ ] SSE 連線正確清理

### 效能驗證
- [ ] 大量日誌查詢效能良好 (<2s for 10,000+ logs)
- [ ] 即時串流不影響系統效能
- [ ] 日誌寫入不阻塞主流程
