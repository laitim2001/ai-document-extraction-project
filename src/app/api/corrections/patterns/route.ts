/**
 * @fileoverview 修正模式列表 API 路由
 * @description
 *   提供修正模式的列表查詢功能：
 *   - 支援分頁和過濾
 *   - 支援多種排序方式
 *   - 包含統計摘要
 *
 * @module src/app/api/corrections/patterns/route
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分頁查詢
 *   - Forwarder 過濾
 *   - 狀態過濾
 *   - 欄位名稱搜尋
 *   - 多欄位排序
 *
 * @permissions
 *   - GET: RULE_VIEW
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/types/permissions';
import type { PatternStatus, Prisma } from '@prisma/client';

// ============================================================
// Types
// ============================================================

type PatternOrderByField = 'occurrenceCount' | 'confidence' | 'lastSeenAt' | 'firstSeenAt';
type SortOrder = 'asc' | 'desc';

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否擁有指定權限
 */
function hasPermission(
  roles: Array<{ permissions: string[] }> | undefined,
  permission: string
): boolean {
  if (!roles) return false;
  return roles.some((role) => role.permissions.includes(permission));
}

// ============================================================
// GET /api/corrections/patterns - 獲取模式列表
// ============================================================

/**
 * 獲取修正模式列表
 *
 * @description
 *   支援分頁、過濾和排序的模式列表查詢
 *
 * @query
 *   - forwarderId: Forwarder ID 過濾
 *   - fieldName: 欄位名稱搜尋（模糊匹配）
 *   - status: 狀態過濾（DETECTED, CANDIDATE, SUGGESTED, PROCESSED, IGNORED）
 *   - minOccurrences: 最小發生次數（預設 1）
 *   - page: 頁碼（預設 1）
 *   - pageSize: 每頁筆數（預設 20，最大 100）
 *   - sortBy: 排序欄位（occurrenceCount, confidence, lastSeenAt）
 *   - sortOrder: 排序方向（asc, desc）
 *
 * @authentication
 *   需要 RULE_VIEW 權限
 */
export async function GET(request: NextRequest) {
  // 驗證用戶認證
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
      },
      { status: 401 }
    );
  }

  // 檢查權限
  if (!hasPermission(session.user.roles, PERMISSIONS.RULE_VIEW)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'RULE_VIEW permission required',
        },
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // 解析查詢參數
    const forwarderId = searchParams.get('forwarderId') || undefined;
    const fieldName = searchParams.get('fieldName') || undefined;
    const status = searchParams.get('status') as PatternStatus | null;
    const minOccurrences = parseInt(searchParams.get('minOccurrences') || '1');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const sortBy = (searchParams.get('sortBy') as PatternOrderByField) || 'lastSeenAt';
    const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

    // 構建查詢條件
    const where: Prisma.CorrectionPatternWhereInput = {
      occurrenceCount: { gte: minOccurrences },
    };

    if (forwarderId) {
      where.forwarderId = forwarderId;
    }

    if (fieldName) {
      where.fieldName = {
        contains: fieldName,
        mode: 'insensitive',
      };
    }

    if (status) {
      where.status = status;
    }

    // 計算分頁
    const skip = (page - 1) * pageSize;

    // 構建排序
    const orderBy: Prisma.CorrectionPatternOrderByWithRelationInput = {};
    if (sortBy === 'occurrenceCount') {
      orderBy.occurrenceCount = sortOrder;
    } else if (sortBy === 'confidence') {
      orderBy.confidence = sortOrder;
    } else if (sortBy === 'firstSeenAt') {
      orderBy.firstSeenAt = sortOrder;
    } else {
      orderBy.lastSeenAt = sortOrder;
    }

    // 並行查詢
    const [patterns, total, summary] = await Promise.all([
      prisma.correctionPattern.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          forwarder: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: { corrections: true },
          },
        },
      }),
      prisma.correctionPattern.count({ where }),
      prisma.correctionPattern.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // 處理摘要
    const summaryMap = summary.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        patterns: patterns.map((p) => {
          // 從 patterns JSON 中提取代表性模式
          const patternsData = p.patterns as Array<{
            originalValue?: string;
            correctedValue?: string;
            samples?: Array<{ originalValue?: string; correctedValue?: string }>;
          }>;
          const firstPattern = patternsData?.[0];

          return {
            id: p.id,
            forwarder: p.forwarder,
            fieldName: p.fieldName,
            originalPattern: firstPattern?.originalValue || '',
            correctedPattern: firstPattern?.correctedValue || '',
            occurrenceCount: p.occurrenceCount,
            status: p.status,
            confidence: p.confidence,
            correctionCount: p._count.corrections,
            firstSeenAt: p.firstSeenAt.toISOString(),
            lastSeenAt: p.lastSeenAt.toISOString(),
          };
        }),
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        summary: {
          totalPatterns: Object.values(summaryMap).reduce((a, b) => a + b, 0),
          candidatePatterns: summaryMap['CANDIDATE'] || 0,
          detectedPatterns: summaryMap['DETECTED'] || 0,
          processedPatterns:
            (summaryMap['PROCESSED'] || 0) +
            (summaryMap['SUGGESTED'] || 0) +
            (summaryMap['IGNORED'] || 0),
        },
      },
    });
  } catch (error) {
    console.error('[Patterns API] Failed to fetch patterns:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch patterns',
        },
      },
      { status: 500 }
    );
  }
}
