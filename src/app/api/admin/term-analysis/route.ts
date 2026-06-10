/**
 * @fileoverview Term Analysis API Route
 * @description
 *   Provides endpoints for term aggregation and AI classification:
 *   - GET: Retrieve aggregated terms with filtering
 *   - POST: Trigger AI classification for selected terms
 *
 * @module src/app/api/admin/term-analysis
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/city-permission';
import { PERMISSIONS } from '@/types/permissions';
import {
  aggregateTerms,
  type TermAggregationFilters,
} from '@/services/term-aggregation.service';
import {
  classifyTerms,
  type BatchClassificationResult,
} from '@/services/term-classification.service';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Query parameters schema for GET request
 */
const getQuerySchema = z.object({
  batchId: z.string().optional(),
  companyId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minFrequency: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

/**
 * Request body schema for POST request (AI classification)
 */
const classifyRequestSchema = z.object({
  terms: z.array(z.string()).min(1).max(200),
});

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/admin/term-analysis
 *
 * Retrieves aggregated terms from historical processing results
 *
 * @query batchId - Filter by batch ID
 * @query companyId - Filter by company ID
 * @query startDate - Start date filter (ISO 8601)
 * @query endDate - End date filter (ISO 8601)
 * @query minFrequency - Minimum term frequency
 * @query limit - Maximum terms to return (default: 500)
 */
export async function GET(request: NextRequest) {
  try {
    // 認證與權限檢查（FIX-063 / ADMIN-1-001：原無任何認證，洩漏術語彙總業務資料）
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入以訪問此資源',
        },
        { status: 401 }
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要管理員權限以訪問術語分析',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const queryResult = getQuerySchema.safeParse({
      batchId: searchParams.get('batchId') || undefined,
      companyId: searchParams.get('companyId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      minFrequency: searchParams.get('minFrequency') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const filters: TermAggregationFilters = {
      batchId: queryResult.data.batchId,
      companyId: queryResult.data.companyId,
      startDate: queryResult.data.startDate
        ? new Date(queryResult.data.startDate)
        : undefined,
      endDate: queryResult.data.endDate
        ? new Date(queryResult.data.endDate)
        : undefined,
      minFrequency: queryResult.data.minFrequency,
      limit: queryResult.data.limit,
    };

    const result = await aggregateTerms(filters);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Term Analysis API] GET error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/server',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/term-analysis
 *
 * Triggers AI classification for selected terms
 *
 * @body terms - Array of terms to classify (max 200)
 */
export async function POST(request: NextRequest) {
  try {
    // 認證與權限檢查（FIX-063 / ADMIN-1-001：原無任何認證，可任意觸發 AI 分類消耗成本）
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入以訪問此資源',
        },
        { status: 401 }
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要管理員權限以觸發術語 AI 分類',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const bodyResult = classifyRequestSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: bodyResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { terms } = bodyResult.data;

    // Classify terms using AI
    const result: BatchClassificationResult = await classifyTerms(terms);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Term Analysis API] POST error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/server',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
