/**
 * @fileoverview 系統日誌即時串流 API
 * @description
 *   提供 Server-Sent Events (SSE) 即時日誌串流功能。
 *   支援按級別和來源篩選即時日誌。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/stream/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - GET /api/admin/logs/stream - SSE 日誌串流
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { logStreamEmitter } from '@/services/logging';
import { LogEntry } from '@/types/logging';
import { LogLevel, LogSource } from '@prisma/client';

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/admin/logs/stream
 * SSE 日誌串流
 */
export async function GET(request: NextRequest) {
  // 驗證權限
  const session = await auth();
  if (!session?.user) {
    return new Response(
      JSON.stringify({
        type: 'https://api.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: '需要登入',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 檢查管理員權限
  const isAdmin =
    session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        type: 'https://api.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: '需要管理員權限',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 解析篩選參數
  const searchParams = request.nextUrl.searchParams;
  const levelsParam = searchParams.get('levels');
  const sourcesParam = searchParams.get('sources');

  const filterLevels = levelsParam ? (levelsParam.split(',') as LogLevel[]) : null;
  const filterSources = sourcesParam ? (sourcesParam.split(',') as LogSource[]) : null;

  // 建立 SSE 串流
  const encoder = new TextEncoder();
  let isConnected = true;

  const stream = new ReadableStream({
    start(controller) {
      // 發送連線成功訊息
      const connectMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // 設定心跳
      const heartbeatInterval = setInterval(() => {
        if (!isConnected) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          const heartbeat = `:heartbeat ${Date.now()}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          clearInterval(heartbeatInterval);
          isConnected = false;
        }
      }, 30000); // 每 30 秒發送心跳

      // 日誌事件處理器
      const logHandler = (log: LogEntry) => {
        if (!isConnected) return;

        // 應用篩選
        if (filterLevels && !filterLevels.includes(log.level)) return;
        if (filterSources && !filterSources.includes(log.source)) return;

        try {
          const message = `data: ${JSON.stringify({ type: 'log', data: log })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // 連線已關閉
          isConnected = false;
          logStreamEmitter.off('log', logHandler);
          clearInterval(heartbeatInterval);
        }
      };

      // 註冊事件監聽
      logStreamEmitter.on('log', logHandler);

      // 處理取消/關閉
      request.signal.addEventListener('abort', () => {
        isConnected = false;
        logStreamEmitter.off('log', logHandler);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // 控制器可能已關閉
        }
      });
    },
    cancel() {
      isConnected = false;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 nginx 緩衝
    },
  });
}
