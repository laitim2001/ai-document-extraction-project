/**
 * @fileoverview API Documentation Redirect Endpoint
 * @description
 *   Redirects to the main documentation page at /docs.
 *   Provides a consistent entry point for API documentation.
 *
 * @module src/app/api/docs/route
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { NextResponse } from 'next/server';

/**
 * GET /api/docs
 * Redirects to the Swagger UI documentation page
 */
export async function GET() {
  return NextResponse.redirect(new URL('/docs', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
