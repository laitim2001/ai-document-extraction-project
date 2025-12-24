/**
 * @fileoverview Bulk Rule Operations API
 * @description
 *   Provides bulk operations for mapping rules:
 *   - POST: Bulk create rules from term analysis
 *   - PATCH: Bulk update existing rules
 *   - DELETE: Bulk delete/deactivate rules
 *
 *   All operations are recorded in BulkOperation for undo capability.
 *
 * @module src/app/api/rules/bulk
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
 * Schema for bulk create operation
 */
const bulkCreateSchema = z.object({
  rules: z.array(z.object({
    sourcePattern: z.string().min(1),
    targetCategory: z.string().min(1),
    forwarderId: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).optional(),
    priority: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  })).min(1).max(100),
});

/**
 * Schema for bulk update operation
 */
const bulkUpdateSchema = z.object({
  ruleIds: z.array(z.string()).min(1).max(100),
  updates: z.object({
    status: z.enum(['ACTIVE', 'DEPRECATED', 'PENDING_REVIEW']).optional(),
    priority: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  }),
});

/**
 * Schema for bulk delete operation
 */
const bulkDeleteSchema = z.object({
  ruleIds: z.array(z.string()).min(1).max(100),
  hardDelete: z.boolean().optional(), // Default: soft delete (isActive = false)
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
// POST /api/rules/bulk - Bulk Create
// ============================================================================

/**
 * POST /api/rules/bulk
 * Create multiple mapping rules at once
 *
 * @body BulkCreateRequest
 *   - rules: Array of rule definitions
 *
 * @returns Created rules and bulk operation ID for undo
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
    const validation = bulkCreateSchema.safeParse(body);

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

    const { rules } = validation.data;

    // Create rules in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdRules = [];

      for (const rule of rules) {
        // Build extraction pattern
        const extractionPattern = {
          type: 'TERM_MAPPING',
          sourcePattern: rule.sourcePattern,
          targetCategory: rule.targetCategory,
          confidence: rule.confidence ?? 0.8,
        };

        const created = await tx.mappingRule.create({
          data: {
            forwarderId: rule.forwarderId || null, // null = Universal rule
            fieldName: 'charge_category',
            fieldLabel: rule.sourcePattern,
            extractionPattern,
            status: 'ACTIVE',
            version: 1,
            priority: rule.priority ?? 50,
            isRequired: false,
            isActive: true,
            category: 'other',
            createdBy: session.user.id,
          },
          select: {
            id: true,
            fieldLabel: true,
            forwarderId: true,
          },
        });

        createdRules.push({
          id: created.id,
          sourcePattern: rule.sourcePattern,
          targetCategory: rule.targetCategory,
          forwarderId: created.forwarderId,
        });
      }

      // Record bulk operation for undo capability
      const bulkOperation = await tx.bulkOperation.create({
        data: {
          operationType: 'BULK_CREATE',
          affectedRules: createdRules,
          metadata: {
            count: createdRules.length,
            timestamp: new Date().toISOString(),
          },
          createdBy: session.user.id,
        },
      });

      return {
        rules: createdRules,
        bulkOperationId: bulkOperation.id,
      };
    });

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: 'MAPPING_CREATED',
      entityType: 'MappingRule',
      entityId: result.bulkOperationId,
      details: {
        bulkOperation: 'BULK_CREATE',
        count: result.rules.length,
        ruleIds: result.rules.map((r) => r.id),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        created: result.rules.length,
        rules: result.rules,
        bulkOperationId: result.bulkOperationId,
        message: `Successfully created ${result.rules.length} rules`,
      },
    });
  } catch (error) {
    console.error('[Bulk Create Rules] Error:', error);
    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to create rules',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/rules/bulk - Bulk Update
// ============================================================================

/**
 * PATCH /api/rules/bulk
 * Update multiple mapping rules at once
 *
 * @body BulkUpdateRequest
 *   - ruleIds: Array of rule IDs to update
 *   - updates: Object with fields to update
 *
 * @returns Updated count and bulk operation ID for undo
 */
export async function PATCH(request: NextRequest) {
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
    const validation = bulkUpdateSchema.safeParse(body);

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

    const { ruleIds, updates } = validation.data;

    // Get previous states for undo
    const previousStates = await prisma.mappingRule.findMany({
      where: { id: { in: ruleIds } },
      select: {
        id: true,
        status: true,
        priority: true,
        isActive: true,
      },
    });

    // Update rules in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Perform bulk update
      await tx.mappingRule.updateMany({
        where: { id: { in: ruleIds } },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });

      // Record bulk operation for undo
      const bulkOperation = await tx.bulkOperation.create({
        data: {
          operationType: 'BULK_UPDATE',
          affectedRules: previousStates.map((rule) => ({
            id: rule.id,
            previousState: rule,
            newState: updates,
          })),
          metadata: {
            count: ruleIds.length,
            updates,
            timestamp: new Date().toISOString(),
          },
          createdBy: session.user.id,
        },
      });

      return {
        updatedCount: ruleIds.length,
        bulkOperationId: bulkOperation.id,
      };
    });

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: 'MAPPING_UPDATED',
      entityType: 'MappingRule',
      entityId: result.bulkOperationId,
      details: {
        bulkOperation: 'BULK_UPDATE',
        count: result.updatedCount,
        ruleIds,
        updates,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        updated: result.updatedCount,
        bulkOperationId: result.bulkOperationId,
        message: `Successfully updated ${result.updatedCount} rules`,
      },
    });
  } catch (error) {
    console.error('[Bulk Update Rules] Error:', error);
    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update rules',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/rules/bulk - Bulk Delete
// ============================================================================

/**
 * DELETE /api/rules/bulk
 * Delete or deactivate multiple mapping rules
 *
 * @body BulkDeleteRequest
 *   - ruleIds: Array of rule IDs to delete
 *   - hardDelete: If true, permanently delete; otherwise soft delete
 *
 * @returns Deleted count and bulk operation ID for undo
 */
export async function DELETE(request: NextRequest) {
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
    const validation = bulkDeleteSchema.safeParse(body);

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

    const { ruleIds, hardDelete = false } = validation.data;

    // Get previous states for undo (only for soft delete)
    const previousStates = await prisma.mappingRule.findMany({
      where: { id: { in: ruleIds } },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        extractionPattern: true,
        companyId: true,
        status: true,
        priority: true,
        isActive: true,
      },
    });

    // Delete/deactivate rules in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let deletedCount = 0;

      if (hardDelete) {
        // Hard delete - permanently remove
        const deleted = await tx.mappingRule.deleteMany({
          where: { id: { in: ruleIds } },
        });
        deletedCount = deleted.count;
      } else {
        // Soft delete - set isActive = false
        const updated = await tx.mappingRule.updateMany({
          where: { id: { in: ruleIds } },
          data: {
            isActive: false,
            updatedById: session.user.id,
            updatedAt: new Date(),
          },
        });
        deletedCount = updated.count;
      }

      // Record bulk operation for undo
      const bulkOperation = await tx.bulkOperation.create({
        data: {
          operationType: hardDelete ? 'BULK_HARD_DELETE' : 'BULK_SOFT_DELETE',
          affectedRules: previousStates,
          metadata: {
            count: deletedCount,
            hardDelete,
            timestamp: new Date().toISOString(),
          },
          createdBy: session.user.id,
        },
      });

      return {
        deletedCount,
        bulkOperationId: bulkOperation.id,
        canUndo: !hardDelete,
      };
    });

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: 'MAPPING_DELETED',
      entityType: 'MappingRule',
      entityId: result.bulkOperationId,
      details: {
        bulkOperation: hardDelete ? 'BULK_HARD_DELETE' : 'BULK_SOFT_DELETE',
        count: result.deletedCount,
        ruleIds,
        hardDelete,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        deleted: result.deletedCount,
        bulkOperationId: result.bulkOperationId,
        canUndo: result.canUndo,
        message: `Successfully ${hardDelete ? 'deleted' : 'deactivated'} ${result.deletedCount} rules`,
      },
    });
  } catch (error) {
    console.error('[Bulk Delete Rules] Error:', error);
    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to delete rules',
      },
      { status: 500 }
    );
  }
}
