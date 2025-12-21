/**
 * @fileoverview API Documentation Page with Swagger UI
 * @description
 *   Interactive API documentation page using Swagger UI.
 *   Loads OpenAPI spec dynamically and provides try-it-out functionality.
 *
 * @module src/app/docs/page
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { SwaggerUIWrapper } from '@/components/features/docs/SwaggerUIWrapper';

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: 'API Documentation | Invoice Extraction API',
  description: 'Interactive API documentation for the Invoice Extraction API. Explore endpoints, try requests, and view response schemas.',
};

// ============================================================
// Page Component
// ============================================================

/**
 * API Documentation Page
 * Renders Swagger UI with the OpenAPI specification
 */
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="flex items-center space-x-4">
            <Link href="/" className="font-semibold text-lg">
              Invoice Extraction API
            </Link>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm text-muted-foreground">API Documentation</span>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <a
              href="/docs/examples"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              SDK Examples
            </a>
            <a
              href="/api/openapi"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI Spec (JSON)
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <SwaggerUIWrapper />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row">
          <p className="text-sm text-muted-foreground">
            Invoice Extraction API v1.0.0
          </p>
          <div className="flex items-center space-x-4">
            <a
              href="/api/docs/error-codes"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Error Codes
            </a>
            <a
              href="/api/docs/version"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Version Info
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
