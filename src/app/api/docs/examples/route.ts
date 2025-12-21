/**
 * @fileoverview SDK Examples API Endpoint
 * @description
 *   Returns SDK code examples for multiple programming languages.
 *   Supports TypeScript, Python, and C#.
 *
 * @module src/app/api/docs/examples/route
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { NextRequest, NextResponse } from 'next/server';
import { exampleGeneratorService } from '@/services/example-generator.service';

/**
 * GET /api/docs/examples
 * Returns all SDK examples organized by category
 *
 * Query params:
 * - category: Filter by category ID (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (category) {
      const categoryData = exampleGeneratorService.getExamplesByCategory(category);

      if (!categoryData) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Category '${category}' not found`,
            instance: '/api/docs/examples',
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: categoryData,
        },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // 1 hour cache
          },
        }
      );
    }

    // Return all examples
    const examples = exampleGeneratorService.getAllExamples();

    return NextResponse.json(
      {
        success: true,
        data: examples,
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
    const message = error instanceof Error ? error.message : 'Failed to load examples';

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: message,
        instance: '/api/docs/examples',
      },
      { status: 500 }
    );
  }
}
