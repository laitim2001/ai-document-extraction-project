/**
 * @fileoverview SDK Examples Documentation Page
 * @description
 *   Page displaying SDK code examples for TypeScript, Python, and C#.
 *   Includes quick start guide and comprehensive API usage examples.
 *
 * @module src/app/docs/examples/page
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { SDKExamplesContent } from '@/components/features/docs/SDKExamplesContent';

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: 'SDK Examples | Invoice Extraction API',
  description: 'Code examples for integrating with the Invoice Extraction API in TypeScript, Python, and C#.',
};

// ============================================================
// Page Component
// ============================================================

/**
 * SDK Examples Page
 * Displays comprehensive SDK examples for multiple languages
 */
export default function SDKExamplesPage() {
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
            <span className="text-sm text-muted-foreground">SDK Examples</span>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <a
              href="/docs"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              API Reference
            </a>
            <a
              href="/api/openapi"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI Spec
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">SDK Examples</h1>
          <p className="text-muted-foreground mb-8">
            Code examples for integrating with the Invoice Extraction API.
            Choose your preferred programming language.
          </p>

          <SDKExamplesContent />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row">
          <p className="text-sm text-muted-foreground">
            Invoice Extraction API v1.0.0
          </p>
          <div className="flex items-center space-x-4">
            <a
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              API Reference
            </a>
            <a
              href="/api/docs/error-codes"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Error Codes
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
