'use client';

/**
 * @fileoverview Swagger UI Wrapper Component
 * @description
 *   Client-side wrapper for Swagger UI React.
 *   Dynamically loads the OpenAPI spec and renders interactive documentation.
 *
 * @module src/components/features/docs/SwaggerUIWrapper
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// ============================================================
// Dynamic Import
// ============================================================

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(
  () => import('swagger-ui-react'),
  { ssr: false }
);

// ============================================================
// Types
// ============================================================

interface SwaggerUIWrapperProps {
  specUrl?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * SwaggerUIWrapper Component
 * Loads and renders Swagger UI with the OpenAPI specification
 */
export function SwaggerUIWrapper({ specUrl = '/api/openapi' }: SwaggerUIWrapperProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [spec, setSpec] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    async function loadSpec() {
      try {
        const response = await fetch(specUrl);
        if (!response.ok) {
          throw new Error(`Failed to load OpenAPI spec: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success && data.data) {
          setSpec(data.data);
        } else {
          throw new Error('Invalid spec response format');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load API specification');
      } finally {
        setIsLoading(false);
      }
    }

    loadSpec();
  }, [specUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-destructive mb-2">Failed to Load Documentation</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground">No API specification available</p>
      </div>
    );
  }

  return (
    <div className="swagger-ui-wrapper">
      <SwaggerUI
        spec={spec}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        defaultModelExpandDepth={1}
        displayOperationId={false}
        displayRequestDuration={true}
        filter={true}
        tryItOutEnabled={true}
        persistAuthorization={true}
      />
      <style jsx global>{`
        .swagger-ui-wrapper .swagger-ui {
          font-family: inherit;
        }
        .swagger-ui-wrapper .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui-wrapper .swagger-ui .info {
          margin-bottom: 2rem;
        }
        .swagger-ui-wrapper .swagger-ui .info .title {
          font-size: 2rem;
          font-weight: 600;
        }
        .swagger-ui-wrapper .swagger-ui .opblock-tag {
          font-size: 1.25rem;
          font-weight: 600;
          border-bottom: 1px solid hsl(var(--border));
        }
        .swagger-ui-wrapper .swagger-ui .opblock {
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
          margin-bottom: 1rem;
        }
        .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary {
          padding: 0.75rem 1rem;
        }
        .swagger-ui-wrapper .swagger-ui .opblock .opblock-summary-method {
          border-radius: 0.25rem;
          padding: 0.25rem 0.75rem;
          font-weight: 600;
        }
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: #10b981;
        }
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #3b82f6;
        }
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-put .opblock-summary-method {
          background: #f59e0b;
        }
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-patch .opblock-summary-method {
          background: #f59e0b;
        }
        .swagger-ui-wrapper .swagger-ui .opblock.opblock-delete .opblock-summary-method {
          background: #ef4444;
        }
        .swagger-ui-wrapper .swagger-ui .btn {
          border-radius: 0.375rem;
        }
        .swagger-ui-wrapper .swagger-ui .btn.execute {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border: none;
        }
        .swagger-ui-wrapper .swagger-ui .btn.execute:hover {
          background: hsl(var(--primary) / 0.9);
        }
        .swagger-ui-wrapper .swagger-ui select {
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
        }
        .swagger-ui-wrapper .swagger-ui input[type="text"],
        .swagger-ui-wrapper .swagger-ui textarea {
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
        }
        .swagger-ui-wrapper .swagger-ui .model-box {
          background: hsl(var(--muted));
          border-radius: 0.5rem;
          padding: 1rem;
        }
        .swagger-ui-wrapper .swagger-ui .responses-table {
          border-radius: 0.5rem;
          overflow: hidden;
        }
        @media (prefers-color-scheme: dark) {
          .swagger-ui-wrapper .swagger-ui {
            filter: invert(88%) hue-rotate(180deg);
          }
          .swagger-ui-wrapper .swagger-ui img {
            filter: invert(100%) hue-rotate(180deg);
          }
        }
      `}</style>
    </div>
  );
}
