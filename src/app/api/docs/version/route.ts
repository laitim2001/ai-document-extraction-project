/**
 * @fileoverview API Version Information Endpoint
 * @description
 *   Returns current API version information including
 *   version number, release date, status, and changelog.
 *
 * @module src/app/api/docs/version/route
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { NextResponse } from 'next/server';
import { openAPILoaderService } from '@/services/openapi-loader.service';

/**
 * GET /api/docs/version
 * Returns API version information
 */
export async function GET() {
  try {
    const versionInfo = await openAPILoaderService.getVersionInfo();

    return NextResponse.json(
      {
        success: true,
        data: versionInfo,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // 1 hour cache
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load version info';

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: message,
        instance: '/api/docs/version',
      },
      { status: 500 }
    );
  }
}
