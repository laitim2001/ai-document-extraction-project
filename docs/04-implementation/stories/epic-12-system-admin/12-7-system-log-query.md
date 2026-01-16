# Story 12-7: 系統日誌查詢

## Story 資訊
- **Story ID**: 12-7
- **Epic**: Epic 12 - 系統管理與監控
- **優先級**: High
- **預估點數**: 8
- **FR 覆蓋**: FR59, FR60

## User Story
**As a** 系統管理員,
**I want** 查詢和分析系統日誌,
**So that** 我可以診斷問題和追蹤系統行為。

## Acceptance Criteria

### AC 12-7-1: 日誌篩選搜尋
```gherkin
Given 系統管理員在日誌查詢頁面
When 搜尋日誌
Then 支援以下篩選條件：
  - 時間範圍
  - 日誌級別（Debug/Info/Warning/Error/Critical）
  - 服務來源（Web/AI/Database/n8n）
  - 關鍵字搜尋
  - 用戶 ID 或請求 ID
```

### AC 12-7-2: 日誌列表顯示
```gherkin
Given 日誌查詢結果
When 查看日誌列表
Then 顯示：
  - 時間戳
  - 日誌級別（顏色編碼）
  - 服務來源
  - 訊息摘要
And 點擊可展開完整內容
```

### AC 12-7-3: 日誌詳情
```gherkin
Given 某筆日誌
When 查看詳情
Then 顯示：
  - 完整日誌訊息
  - 堆疊追蹤（如有）
  - 關聯的請求 ID
  - 相關的用戶資訊
  - 連結到相關的其他日誌
```

### AC 12-7-4: 日誌分頁與匯出
```gherkin
Given 日誌查詢
When 結果量大
Then 支援分頁（每頁 100 筆）
And 支援匯出（最多 10,000 筆）
```

### AC 12-7-5: 即時日誌串流
```gherkin
Given 即時日誌
When 需要監控
Then 提供「即時日誌串流」功能
And 可以暫停/繼續串流
```

## Technical Specifications

### 1. Prisma Data Models

```prisma
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

// 系統日誌
model SystemLog {
  id              String      @id @default(cuid())

  // 日誌內容
  level           LogLevel
  source          LogSource
  message         String
  details         Json?       // 額外詳情

  // 追蹤資訊
  correlationId   String?     // 請求追蹤 ID
  requestId       String?     // HTTP 請求 ID
  sessionId       String?     // Session ID

  // 關聯資訊
  userId          String?
  user            User?       @relation(fields: [userId], references: [id])
  resourceType    String?     // 相關資源類型
  resourceId      String?     // 相關資源 ID

  // 錯誤資訊
  errorCode       String?
  stackTrace      String?     @db.Text

  // HTTP 資訊
  httpMethod      String?
  httpPath        String?
  httpStatusCode  Int?
  responseTimeMs  Int?

  // 元資料
  environment     String?     // production/staging/development
  hostname        String?     // 伺服器主機名
  version         String?     // 應用版本

  // 時間
  timestamp       DateTime    @default(now())

  @@index([timestamp])
  @@index([level, timestamp])
  @@index([source, timestamp])
  @@index([correlationId])
  @@index([userId, timestamp])
  @@index([resourceType, resourceId])
}

// 日誌保留設定
model LogRetentionPolicy {
  id              String      @id @default(cuid())
  level           LogLevel
  retentionDays   Int         @default(30)
  isEnabled       Boolean     @default(true)
  updatedAt       DateTime    @updatedAt
}

// 日誌匯出記錄
model LogExport {
  id              String      @id @default(cuid())

  // 匯出條件
  filters         Json        // 篩選條件
  exportedCount   Int
  fileSize        Int?

  // 檔案資訊
  fileName        String
  storagePath     String?

  // 狀態
  status          String      // pending/completed/failed
  errorMessage    String?

  // 審計
  createdAt       DateTime    @default(now())
  completedAt     DateTime?
  createdBy       String
  createdByUser   User        @relation(fields: [createdBy], references: [id])

  @@index([createdAt])
}
```

### 2. 日誌服務

```typescript
// services/logging/log-query.service.ts
import { PrismaClient, LogLevel, LogSource, SystemLog } from '@prisma/client';
import { createObjectCsvStringifier } from 'csv-writer';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

interface LogQueryFilters {
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

interface LogQueryOptions {
  filters: LogQueryFilters;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}

interface LogEntry {
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

interface LogStats {
  totalCount: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<LogSource, number>;
  errorRate: number;
  avgResponseTime: number;
}

// 即時日誌事件發送器
class LogStreamEmitter extends EventEmitter {
  private static instance: LogStreamEmitter;

  static getInstance(): LogStreamEmitter {
    if (!LogStreamEmitter.instance) {
      LogStreamEmitter.instance = new LogStreamEmitter();
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
   * 匯出日誌
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
   * 執行匯出
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

      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
      const fileSize = Buffer.byteLength(csvContent, 'utf8');

      // 儲存檔案（可改為上傳至 Azure Blob）
      const fs = await import('fs/promises');
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
  async getExportStatus(exportId: string): Promise<{
    status: string;
    exportedCount?: number;
    fileSize?: number;
    downloadUrl?: string;
    error?: string;
  } | null> {
    const record = await prisma.logExport.findUnique({
      where: { id: exportId },
    });

    if (!record) return null;

    return {
      status: record.status,
      exportedCount: record.exportedCount,
      fileSize: record.fileSize || undefined,
      downloadUrl: record.status === 'completed' ? `/api/admin/logs/export/${exportId}/download` : undefined,
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

    if (filters.startTime || filters.endTime) {
      where.timestamp = {};
      if (filters.startTime) {
        where.timestamp.gte = filters.startTime;
      }
      if (filters.endTime) {
        where.timestamp.lte = filters.endTime;
      }
    }

    if (filters.levels && filters.levels.length > 0) {
      where.level = { in: filters.levels };
    }

    if (filters.sources && filters.sources.length > 0) {
      where.source = { in: filters.sources };
    }

    if (filters.keyword) {
      where.OR = [
        { message: { contains: filters.keyword, mode: 'insensitive' } },
        { correlationId: { contains: filters.keyword, mode: 'insensitive' } },
        { errorCode: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.correlationId) {
      where.correlationId = filters.correlationId;
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.resourceId) {
      where.resourceId = filters.resourceId;
    }

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

### 3. 日誌寫入服務

```typescript
// services/logging/logger.service.ts
import { PrismaClient, LogLevel, LogSource } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { logStreamEmitter } from './log-query.service';

const prisma = new PrismaClient();

// 請求上下文存儲
export const requestContext = new AsyncLocalStorage<{
  correlationId: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
}>();

interface LogOptions {
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

export class LoggerService {
  private source: LogSource;

  constructor(source: LogSource) {
    this.source = source;
  }

  /**
   * Debug 日誌
   */
  debug(message: string, details?: any): Promise<void> {
    return this.log({ level: 'DEBUG', source: this.source, message, details });
  }

  /**
   * Info 日誌
   */
  info(message: string, details?: any): Promise<void> {
    return this.log({ level: 'INFO', source: this.source, message, details });
  }

  /**
   * Warning 日誌
   */
  warn(message: string, details?: any): Promise<void> {
    return this.log({ level: 'WARN', source: this.source, message, details });
  }

  /**
   * Error 日誌
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
   * Critical 日誌
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
   * HTTP 請求日誌
   */
  httpRequest(options: {
    method: string;
    path: string;
    statusCode: number;
    responseTimeMs: number;
    userId?: string;
    details?: any;
  }): Promise<void> {
    const level: LogLevel = options.statusCode >= 500 ? 'ERROR' :
                            options.statusCode >= 400 ? 'WARN' : 'INFO';

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
   * 寫入日誌
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

      // 發送即時日誌事件
      logStreamEmitter.emitLog({
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
      });

      // 同時輸出到控制台 (開發環境)
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

// 預設 Logger 實例
export const webLogger = new LoggerService('WEB');
export const apiLogger = new LoggerService('API');
export const aiLogger = new LoggerService('AI');
export const dbLogger = new LoggerService('DATABASE');
export const n8nLogger = new LoggerService('N8N');
export const schedulerLogger = new LoggerService('SCHEDULER');
export const systemLogger = new LoggerService('SYSTEM');

// 創建自定義 Logger
export function createLogger(source: LogSource): LoggerService {
  return new LoggerService(source);
}
```

### 4. 日誌中間件

```typescript
// middleware/logging.middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requestContext, apiLogger } from '@/services/logging/logger.service';

export async function loggingMiddleware(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || uuidv4();
  const requestId = uuidv4();
  const startTime = Date.now();

  // 設置請求上下文
  const context = {
    correlationId,
    requestId,
    userId: undefined, // 從 session 獲取
    sessionId: request.cookies.get('session')?.value,
  };

  // 添加 correlation ID 到響應頭
  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-request-id', requestId);

  // 記錄請求日誌 (在路由處理完成後)
  // 這裡可以使用 NextResponse 的 middleware 功能

  return response;
}

// API 路由包裝器
export function withLogging<T>(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext: any): Promise<NextResponse> => {
    const correlationId = request.headers.get('x-correlation-id') || uuidv4();
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

### 5. API Routes

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

  const result = await logQueryService.exportLogs(filters, session.user.id, maxRecords);

  return NextResponse.json(result);
}
```

```typescript
// app/api/admin/logs/stream/route.ts
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logStreamEmitter } from '@/services/logging/log-query.service';

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
      const onLog = (log: any) => {
        // 篩選
        if (levels.length > 0 && !levels.includes(log.level)) return;
        if (sources.length > 0 && !sources.includes(log.source)) return;

        const data = `data: ${JSON.stringify(log)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      logStreamEmitter.on('log', onLog);

      // 心跳
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30000);

      // 清理
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
      'Connection': 'keep-alive',
    },
  });
}
```

### 6. React Components

```typescript
// components/admin/logs/LogViewer.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogLevel, LogSource } from '@prisma/client';

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    endTime: new Date().toISOString().slice(0, 16),
    levels: [] as LogLevel[],
    sources: [] as LogSource[],
    keyword: '',
  });
  const [pagination, setPagination] = useState({ offset: 0, limit: 100, total: 0, hasMore: false });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [relatedLogs, setRelatedLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  const fetchLogs = async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startTime) params.set('startTime', new Date(filters.startTime).toISOString());
      if (filters.endTime) params.set('endTime', new Date(filters.endTime).toISOString());
      if (filters.levels.length) params.set('levels', filters.levels.join(','));
      if (filters.sources.length) params.set('sources', filters.sources.join(','));
      if (filters.keyword) params.set('keyword', filters.keyword);
      params.set('limit', '100');
      params.set('offset', String(offset));

      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();

      setLogs(data.logs);
      setPagination({ offset, limit: 100, total: data.total, hasMore: data.hasMore });
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchRelatedLogs = async (logId: string) => {
    try {
      const response = await fetch(`/api/admin/logs/${logId}/related`);
      const data = await response.json();
      setRelatedLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch related logs:', error);
    }
  };

  const handleSearch = () => {
    fetchLogs(0);
    fetchStats();
  };

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

  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    } else {
      const params = new URLSearchParams();
      if (filters.levels.length) params.set('levels', filters.levels.join(','));
      if (filters.sources.length) params.set('sources', filters.sources.join(','));

      const es = new EventSource(`/api/admin/logs/stream?${params}`);

      es.onmessage = (event) => {
        const log = JSON.parse(event.data);
        setStreamLogs((prev) => [log, ...prev.slice(0, 99)]);
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

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

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
          <StatCard title="平均回應時間" value={`${stats.avgResponseTime.toFixed(0)}ms`} />
          <StatCard
            title="錯誤數"
            value={((stats.byLevel.ERROR || 0) + (stats.byLevel.CRITICAL || 0)).toLocaleString()}
            color="red"
          />
          <StatCard title="警告數" value={(stats.byLevel.WARN || 0).toLocaleString()} color="yellow" />
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
              onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">結束時間</label>
            <input
              type="datetime-local"
              value={filters.endTime}
              onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">日誌級別</label>
            <select
              multiple
              value={filters.levels}
              onChange={(e) => setFilters({
                ...filters,
                levels: Array.from(e.target.selectedOptions, (o) => o.value as LogLevel),
              })}
              className="w-full px-3 py-2 border rounded"
            >
              {Object.keys(LEVEL_COLORS).map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">服務來源</label>
            <select
              multiple
              value={filters.sources}
              onChange={(e) => setFilters({
                ...filters,
                sources: Array.from(e.target.selectedOptions, (o) => o.value as LogSource),
              })}
              className="w-full px-3 py-2 border rounded"
            >
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">關鍵字</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
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
              </span>
              {' '}
              <span className={
                log.level === 'ERROR' || log.level === 'CRITICAL' ? 'text-red-400' :
                log.level === 'WARN' ? 'text-yellow-400' : 'text-green-400'
              }>
                [{log.level}]
              </span>
              {' '}
              <span className="text-blue-400">[{log.source}]</span>
              {' '}
              {log.message}
            </div>
          ))}
        </div>
      )}

      {/* 日誌列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium w-40">時間</th>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">級別</th>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">來源</th>
              <th className="px-4 py-3 text-left text-sm font-medium">訊息</th>
              <th className="px-4 py-3 text-left text-sm font-medium w-32">追蹤 ID</th>
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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${LEVEL_COLORS[log.level]}`}>
                    {log.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{SOURCE_LABELS[log.source]}</td>
                <td className="px-4 py-3 text-sm truncate max-w-md" title={log.message}>
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
            顯示 {pagination.offset + 1} - {pagination.offset + logs.length} 筆，共 {pagination.total} 筆
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(Math.max(0, pagination.offset - pagination.limit))}
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
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* 基本資訊 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <span className="text-gray-500">時間:</span>
            <div className="font-mono">{new Date(log.timestamp).toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-500">級別:</span>
            <div>
              <span className={`px-2 py-1 rounded text-sm ${LEVEL_COLORS[log.level]}`}>
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
              <div>{log.httpMethod} {log.httpPath} ({log.httpStatusCode}) - {log.responseTimeMs}ms</div>
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
            <span className="text-gray-500">關聯日誌 ({relatedLogs.length}):</span>
            <div className="mt-2 space-y-2 max-h-40 overflow-auto">
              {relatedLogs.map((related) => (
                <div
                  key={related.id}
                  className={`p-2 rounded text-sm ${
                    related.id === log.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <span className="text-gray-500">
                    {new Date(related.timestamp).toLocaleTimeString()}
                  </span>
                  {' '}
                  <span className={`px-1 rounded text-xs ${LEVEL_COLORS[related.level]}`}>
                    {related.level}
                  </span>
                  {' '}
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

### 7. Unit Tests

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
        { id: 'log-1', level: 'INFO', source: 'WEB', message: 'Test log' },
        { id: 'log-2', level: 'ERROR', source: 'API', message: 'Error log' },
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
        { id: 'log-1', correlationId: 'corr-1' },
        { id: 'log-2', correlationId: 'corr-1' },
      ];

      (mockPrisma.systemLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.getRelatedLogs('corr-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.systemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { correlationId: 'corr-1' },
        })
      );
    });

    it('should return empty array if no correlationId', async () => {
      const result = await service.getRelatedLogs('');
      expect(result).toEqual([]);
    });
  });
});
```

## Dependencies

### 前置 Stories
- **Story 1-0**: 專案初始化與基礎架構

### NPM 套件
- `csv-writer`: CSV 檔案生成
- `uuid`: UUID 生成

## Verification Checklist

### 功能驗證
- [ ] 日誌篩選條件正確運作
- [ ] 日誌分頁功能正常
- [ ] 日誌詳情顯示完整
- [ ] 關聯日誌連結正確
- [ ] 即時串流功能正常
- [ ] 日誌匯出功能正常
- [ ] 日誌保留策略正確執行

### 安全驗證
- [ ] 僅管理員可查看日誌
- [ ] 敏感資訊適當遮罩

### 效能驗證
- [x] 大量日誌查詢效能良好
- [x] 即時串流不影響系統效能
- [x] 日誌寫入不阻塞主流程

---

## Implementation Notes

### 完成日期
2025-12-21

### 實作摘要

#### 資料模型
- **SystemLog**: 系統日誌主表，包含 level、source、message、details、correlationId、requestId、sessionId 等欄位
- **LogRetentionPolicy**: 日誌保留策略，按級別設定保留天數
- **LogExport**: 日誌匯出任務記錄，支援 CSV/JSON/TXT 格式

#### 服務層
1. **LogQueryService** (`src/services/logging/log-query.service.ts`)
   - 多條件日誌查詢（時間、級別、來源、關鍵字、correlationId、userId）
   - 日誌詳情與關聯日誌查詢
   - 日誌統計分析（按級別、來源、錯誤率）
   - 日誌匯出（CSV/JSON/TXT）
   - 過期日誌清理

2. **LoggerService** (`src/services/logging/logger.service.ts`)
   - 多級別日誌記錄（debug, info, warn, error, critical）
   - AsyncLocalStorage 請求上下文追蹤
   - EventEmitter 即時串流事件廣播
   - 預設 Logger 實例（webLogger, apiLogger, aiLogger 等）

#### API Routes
- `GET /api/admin/logs` - 日誌列表查詢
- `GET /api/admin/logs/[id]` - 日誌詳情
- `GET /api/admin/logs/[id]/related` - 關聯日誌
- `GET /api/admin/logs/stats` - 日誌統計
- `POST /api/admin/logs/export` - 建立匯出任務
- `GET /api/admin/logs/export/[id]` - 匯出狀態
- `GET /api/admin/logs/stream` - SSE 即時串流
- `GET /api/admin/logs/retention` - 保留策略

#### React Hooks
- `useLogs` - 日誌列表查詢
- `useLogDetail` - 日誌詳情
- `useRelatedLogs` - 關聯日誌
- `useLogStats` - 統計數據
- `useCreateLogExport` - 建立匯出
- `useExportStatus` - 匯出狀態輪詢
- `useLogStream` - SSE 即時串流

#### UI 組件
- **LogViewer**: 日誌列表主頁面，含篩選、分頁、統計卡片
- **LogDetailDialog**: 日誌詳情對話框
- **LogExportDialog**: 匯出設定對話框（格式選擇、時間範圍、進度追蹤）
- **LogStreamPanel**: 即時日誌串流面板（SSE 連線、暫停/恢復、篩選）

### 技術特點
1. **AsyncLocalStorage**: 使用 Node.js AsyncLocalStorage 實現請求上下文追蹤
2. **SSE 串流**: 使用 Server-Sent Events 實現即時日誌推送
3. **批次匯出**: 異步處理大量日誌匯出，避免阻塞請求
4. **React Query**: 使用 TanStack Query 管理伺服器狀態和快取

### 已完成的 Acceptance Criteria
- [x] AC 12-7-1: 日誌篩選搜尋
- [x] AC 12-7-2: 日誌列表顯示
- [x] AC 12-7-3: 日誌詳情
- [x] AC 12-7-4: 日誌分頁與匯出
- [x] AC 12-7-5: 即時日誌串流
