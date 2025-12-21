/**
 * @fileoverview OpenAPI Specification Endpoint
 * @description
 *   Returns the OpenAPI 3.0 specification as JSON.
 *   Used by Swagger UI and other API documentation tools.
 *
 * @module src/app/api/openapi/route
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { NextResponse } from 'next/server';
import { openAPILoaderService } from '@/services/openapi-loader.service';

/**
 * GET /api/openapi
 * Returns the OpenAPI specification as JSON
 */
export async function GET() {
  try {
    const spec = await openAPILoaderService.getSpecAsJson();
    const cacheInfo = openAPILoaderService.getCacheInfo();

    return NextResponse.json(
      {
        success: true,
        data: spec,
        meta: cacheInfo
          ? {
              cachedAt: cacheInfo.cachedAt,
              expiresAt: cacheInfo.expiresAt,
            }
          : undefined,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes cache
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load OpenAPI spec';

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: message,
        instance: '/api/openapi',
      },
      { status: 500 }
    );
  }
}
