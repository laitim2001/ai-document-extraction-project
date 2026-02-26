/**
 * @fileoverview FieldDefinitionSet Resolve API
 * @module src/app/api/v1/field-definition-sets/resolve
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @endpoints
 *   GET /api/v1/field-definition-sets/resolve - 依 companyId+formatId 解析合併欄位
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResolvedFields } from '@/services/field-definition-set.service';
import { resolveFieldsQuerySchema } from '@/lib/validations/field-definition-set.schema';

/**
 * GET /api/v1/field-definition-sets/resolve?companyId=xxx&documentFormatId=yyy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = resolveFieldsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await getResolvedFields(parsed.data.companyId, parsed.data.documentFormatId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[FieldDefinitionSet:resolve] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while resolving fields',
      },
      { status: 500 }
    );
  }
}
