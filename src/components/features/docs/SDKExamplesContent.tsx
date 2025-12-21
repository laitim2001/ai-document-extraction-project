'use client';

/**
 * @fileoverview SDK Examples Content Component
 * @description
 *   Client component that fetches and displays SDK examples.
 *   Organizes examples by category with language tabs.
 *
 * @module src/components/features/docs/SDKExamplesContent
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import * as React from 'react';
import { LanguageTabs } from './LanguageTabs';
import { CodeBlock } from './CodeBlock';
import type { SDKExamplesCollection, SDKLanguage } from '@/types/sdk-examples';

// ============================================================
// Types
// ============================================================

interface SDKExamplesContentProps {
  className?: string;
}

// ============================================================
// Installation Instructions
// ============================================================

const INSTALLATION_CODE: Record<SDKLanguage, string> = {
  typescript: `# Install dependencies
npm install axios

# For file uploads
npm install form-data`,
  python: `# Install dependencies
pip install requests`,
  csharp: `# Install NuGet packages
dotnet add package System.Net.Http.Json`,
};

const INIT_CODE: Record<SDKLanguage, string> = {
  typescript: `import axios from 'axios';

const API_KEY = process.env.INVOICE_API_KEY!;
const BASE_URL = 'https://api.example.com/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json',
  },
});`,
  python: `import requests
import os

API_KEY = os.getenv("INVOICE_API_KEY")
BASE_URL = "https://api.example.com/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}`,
  csharp: `using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;

var httpClient = new HttpClient
{
    BaseAddress = new Uri("https://api.example.com/api/v1/")
};

// Set authentication
httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", apiKey);`,
};

// ============================================================
// Component
// ============================================================

/**
 * SDKExamplesContent Component
 * Fetches and displays SDK examples with language switching
 */
export function SDKExamplesContent({ className }: SDKExamplesContentProps) {
  const [examples, setExamples] = React.useState<SDKExamplesCollection | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeCategory, setActiveCategory] = React.useState<string>('');

  React.useEffect(() => {
    async function fetchExamples() {
      try {
        const response = await fetch('/api/docs/examples');
        if (!response.ok) {
          throw new Error('Failed to fetch examples');
        }
        const data = await response.json();
        if (data.success && data.data) {
          setExamples(data.data);
          if (data.data.categories.length > 0) {
            setActiveCategory(data.data.categories[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load examples');
      } finally {
        setIsLoading(false);
      }
    }

    fetchExamples();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading examples...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-destructive mb-2">Failed to Load Examples</h2>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeExamples = examples?.categories.find(c => c.id === activeCategory);

  return (
    <div className={className}>
      {/* Quick Start Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>

        {/* Installation */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">1. Installation</h3>
          <LanguageTabs code={INSTALLATION_CODE} />
        </div>

        {/* Initialization */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">2. Initialize Client</h3>
          <LanguageTabs code={INIT_CODE} />
        </div>
      </section>

      {/* Examples by Category */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">API Examples</h2>

        {/* Category Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {examples?.categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Active Category Examples */}
        {activeExamples && (
          <div className="space-y-8">
            <p className="text-muted-foreground">{activeExamples.description}</p>

            {activeExamples.examples.map((example, index) => (
              <div key={index} className="border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded ${
                      example.method === 'GET'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : example.method === 'POST'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : example.method === 'PUT' || example.method === 'PATCH'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}
                  >
                    {example.method}
                  </span>
                  <code className="text-sm font-mono text-muted-foreground">
                    {example.endpoint}
                  </code>
                </div>

                <h3 className="text-lg font-semibold mb-2">{example.title}</h3>
                <p className="text-muted-foreground mb-4">{example.description}</p>

                {example.notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note:</strong> {example.notes}
                    </p>
                  </div>
                )}

                <LanguageTabs code={example.code} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rate Limiting Section */}
      <section className="mt-12 border rounded-lg p-6 bg-muted/50">
        <h2 className="text-xl font-semibold mb-4">Rate Limiting</h2>
        <p className="text-muted-foreground mb-4">
          The API enforces rate limits to ensure fair usage. Default limits are:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>60 requests per minute</strong> - Standard rate limit</li>
          <li><strong>10 concurrent requests</strong> - Maximum parallel requests</li>
        </ul>
        <p className="text-muted-foreground mt-4">
          Rate limit information is included in response headers:
        </p>
        <CodeBlock
          code={`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200`}
          language="text"
          showLineNumbers={false}
          className="mt-2"
        />
      </section>

      {/* Webhook Signature Section */}
      <section className="mt-8 border rounded-lg p-6 bg-muted/50">
        <h2 className="text-xl font-semibold mb-4">Webhook Signatures</h2>
        <p className="text-muted-foreground mb-4">
          Webhook payloads are signed using HMAC-SHA256. Verify the signature
          to ensure the webhook is authentic:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-4">
          <li>Extract the <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> header</li>
          <li>Compute HMAC-SHA256 of the raw request body using your webhook secret</li>
          <li>Compare using a timing-safe comparison function</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          See the Webhooks section above for complete verification examples.
        </p>
      </section>
    </div>
  );
}
