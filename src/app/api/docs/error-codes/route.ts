/**
 * @fileoverview API Error Codes Reference Endpoint
 * @description
 *   Returns a comprehensive list of API error codes with descriptions,
 *   HTTP status codes, and resolution guidance.
 *
 * @module src/app/api/docs/error-codes/route
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { NextResponse } from 'next/server';
import { openAPILoaderService } from '@/services/openapi-loader.service';

/**
 * GET /api/docs/error-codes
 * Returns all API error codes organized by category
 */
export async function GET() {
  try {
    const errorCodes = await openAPILoaderService.getErrorCodes();

    return NextResponse.json(
      {
        success: true,
        data: {
          categories: errorCodes,
        },
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
    const message = error instanceof Error ? error.message : 'Failed to load error codes';

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: message,
        instance: '/api/docs/error-codes',
      },
      { status: 500 }
    );
  }
}
