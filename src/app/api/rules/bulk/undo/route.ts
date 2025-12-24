/**
 * @fileoverview Bulk Operation Undo API
 * @description
 *   Provides undo functionality for bulk rule operations:
 *   - POST: Undo a specific bulk operation by ID
 *   - GET: List recent bulk operations that can be undone
 *
 * @module src/app/api/rules/bulk/undo
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 *
 * @dependencies
 *   - next/server - Next.js API handling
 *   - @/lib/auth - NextAuth authentication
 *   - @/lib/prisma - Prisma client
 *   - @/lib/audit - Audit logging
 *   - zod - Input validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { PERMISSIONS } from '@/types/permissions';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Schema for undo request
 */
const undoSchema = z.object({
  bulkOperationId: z.string().uuid(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has rule management permission
 */
function hasRuleManagePermission(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false;
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  );
}

// ============================================================================
// GET /api/rules/bulk/undo - List Undoable Operations
// ============================================================================

/**
 * GET /api/rules/bulk/undo
 * List recent bulk operations that can be undone
 *
 * @query limit - Maximum number of operations to return (default: 10)
 *
 * @returns List of recent undoable bulk operations
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'RULE_MANAGE permission required',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10', 10));

    // Get recent undoable operations
    const operations = await prisma.bulkOperation.findMany({
      where: {
        isUndone: false,
        // Only operations that can be undone (not hard deletes)
        operationType: {
          notIn: ['BULK_HARD_DELETE'],
        },
        // Only operations within last 24 hours
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        operationType: true,
        metadata: true,
        createdAt: true,
        createdBy: true,
      },
    });

    // Format response
    const formattedOperations = operations.map((op) => {
      const metadata = op.metadata as Record<string, unknown> | null;
      return {
        id: op.id,
        operationType: op.operationType,
        affectedCount: metadata?.count ?? 0,
        createdAt: op.createdAt.toISOString(),
        createdBy: op.createdBy,
        canUndo: true,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        operations: formattedOperations,
        count: formattedOperations.length,
      },
    });
  } catch (error) {
    console.error('[List Undoable Operations] Error:', error);
    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to list operations',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/rules/bulk/undo - Undo Operation
// ============================================================================

/**
 * POST /api/rules/bulk/undo
 * Undo a specific bulk operation
 *
 * @body UndoRequest
 *   - bulkOperationId: ID of the bulk operation to undo
 *
 * @returns Undo result
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'RULE_MANAGE permission required',
        },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = undoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { bulkOperationId } = validation.data;

    // Get the bulk operation
    const operation = await prisma.bulkOperation.findUnique({
      where: { id: bulkOperationId },
    });

    if (!operation) {
      return NextResponse.json(
        {
          type: 'not_found',
          title: 'Not Found',
          status: 404,
          detail: 'Bulk operation not found',
        },
        { status: 404 }
      );
    }

    if (operation.isUndone) {
      return NextResponse.json(
        {
          type: 'conflict',
          title: 'Conflict',
          status: 409,
          detail: 'This operation has already been undone',
        },
        { status: 409 }
      );
    }

    if (operation.operationType === 'BULK_HARD_DELETE') {
      return NextResponse.json(
        {
          type: 'bad_request',
          title: 'Bad Request',
          status: 400,
          detail: 'Hard delete operations cannot be undone',
        },
        { status: 400 }
      );
    }

    const affectedRules = operation.affectedRules as Array<{
      id: string;
      previousState?: Record<string, unknown>;
      sourcePattern?: string;
      targetCategory?: string;
      forwarderId?: string | null;
    }>;

    // Perform undo in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let undoneCount = 0;

      switch (operation.operationType) {
        case 'BULK_CREATE':
          // Undo create: delete the created rules
          const createRuleIds = affectedRules.map((r) => r.id);
          const deleteResult = await tx.mappingRule.deleteMany({
            where: { id: { in: createRuleIds } },
          });
          undoneCount = deleteResult.count;
          break;

        case 'BULK_UPDATE':
          // Undo update: restore previous states
          for (const rule of affectedRules) {
            if (rule.previousState) {
              const prevState = rule.previousState as Record<string, unknown>;
              await tx.mappingRule.update({
                where: { id: rule.id },
                data: {
                  status: prevState.status as 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'DEPRECATED' | undefined,
                  priority: prevState.priority as number | undefined,
                  isActive: prevState.isActive as boolean | undefined,
                  updatedAt: new Date(),
                },
              });
              undoneCount++;
            }
          }
          break;

        case 'BULK_SOFT_DELETE':
          // Undo soft delete: reactivate the rules
          const softDeleteIds = affectedRules.map((r) => r.id);
          const reactivateResult = await tx.mappingRule.updateMany({
            where: { id: { in: softDeleteIds } },
            data: {
              isActive: true,
              updatedAt: new Date(),
            },
          });
          undoneCount = reactivateResult.count;
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.operationType}`);
      }

      // Mark operation as undone
      await tx.bulkOperation.update({
        where: { id: bulkOperationId },
        data: {
          isUndone: true,
          undoneAt: new Date(),
          undoneBy: session.user.id,
        },
      });

      return { undoneCount };
    });

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: 'MAPPING_UPDATED',
      entityType: 'BulkOperation',
      entityId: bulkOperationId,
      details: {
        undoOperation: true,
        operationType: operation.operationType,
        undoneCount: result.undoneCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        undone: result.undoneCount,
        operationType: operation.operationType,
        message: `Successfully undone ${operation.operationType} affecting ${result.undoneCount} rules`,
      },
    });
  } catch (error) {
    console.error('[Undo Bulk Operation] Error:', error);
    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to undo operation',
      },
      { status: 500 }
    );
  }
}
