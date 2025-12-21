/**
 * @fileoverview OpenAPI Specification Loader Service
 * @description
 *   Loads, parses, and caches the OpenAPI specification file.
 *   Provides methods to access spec data and validate the spec.
 *
 *   Features:
 *   - YAML file loading and parsing
 *   - In-memory caching with TTL
 *   - Spec validation
 *   - Error handling for missing/invalid specs
 *
 * @module src/services/openapi-loader.service
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 *
 * @dependencies
 *   - js-yaml - YAML parsing
 *   - fs/promises - File system operations
 *   - path - Path resolution
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { OpenAPISpec, APIVersionInfo, ErrorCodeCategory } from '@/types/documentation';

// ============================================================
// Types
// ============================================================

/**
 * Cache entry for OpenAPI spec
 */
interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Service configuration
 */
interface OpenAPILoaderConfig {
  specPath: string;
  cacheTTL: number; // in milliseconds
}

// ============================================================
// Constants
// ============================================================

/**
 * Default cache TTL: 5 minutes
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Default spec file path
 */
const DEFAULT_SPEC_PATH = 'openapi/spec.yaml';

// ============================================================
// Service Class
// ============================================================

/**
 * OpenAPI Loader Service
 * Handles loading, caching, and accessing OpenAPI specification
 */
class OpenAPILoaderService {
  private config: OpenAPILoaderConfig;
  private specCache: CacheEntry<OpenAPISpec> | null = null;

  constructor(config?: Partial<OpenAPILoaderConfig>) {
    this.config = {
      specPath: config?.specPath ?? DEFAULT_SPEC_PATH,
      cacheTTL: config?.cacheTTL ?? DEFAULT_CACHE_TTL,
    };
  }

  /**
   * Load and parse OpenAPI spec from YAML file
   */
  async loadSpec(): Promise<OpenAPISpec> {
    // Check cache first
    if (this.specCache && new Date() < this.specCache.expiresAt) {
      return this.specCache.data;
    }

    // Load from file
    const specPath = path.resolve(process.cwd(), this.config.specPath);

    try {
      const fileContent = await fs.readFile(specPath, 'utf-8');
      const spec = yaml.load(fileContent) as OpenAPISpec;

      // Validate basic structure
      if (!spec.openapi || !spec.info || !spec.paths) {
        throw new Error('Invalid OpenAPI specification: missing required fields');
      }

      // Cache the result
      const now = new Date();
      this.specCache = {
        data: spec,
        cachedAt: now,
        expiresAt: new Date(now.getTime() + this.config.cacheTTL),
      };

      return spec;
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`OpenAPI spec file not found at: ${specPath}`);
      }
      throw error;
    }
  }

  /**
   * Get OpenAPI spec as JSON
   */
  async getSpecAsJson(): Promise<OpenAPISpec> {
    return this.loadSpec();
  }

  /**
   * Get API version information
   */
  async getVersionInfo(): Promise<APIVersionInfo> {
    const spec = await this.loadSpec();

    return {
      version: spec.info.version,
      releaseDate: new Date().toISOString().split('T')[0],
      status: 'stable',
      changelog: [
        {
          version: spec.info.version,
          date: new Date().toISOString().split('T')[0],
          type: 'added',
          description: 'Initial API release with invoice extraction endpoints',
        },
      ],
    };
  }

  /**
   * Get error codes reference
   */
  async getErrorCodes(): Promise<ErrorCodeCategory[]> {
    return [
      {
        category: 'Authentication',
        description: 'Errors related to API authentication',
        codes: [
          {
            code: 'INVALID_API_KEY',
            httpStatus: 401,
            title: 'Invalid API Key',
            description: 'The provided API key is invalid or has been revoked.',
            resolution: 'Verify your API key is correct and active in the developer portal.',
            example: {
              type: 'https://api.example.com/errors/unauthorized',
              title: 'Unauthorized',
              status: 401,
              detail: 'Invalid or expired API key',
              instance: '/api/v1/invoices',
            },
          },
          {
            code: 'EXPIRED_API_KEY',
            httpStatus: 401,
            title: 'Expired API Key',
            description: 'The API key has expired.',
            resolution: 'Generate a new API key from the developer portal.',
          },
          {
            code: 'MISSING_AUTH_HEADER',
            httpStatus: 401,
            title: 'Missing Authorization Header',
            description: 'The Authorization header is required but was not provided.',
            resolution: 'Include the Authorization header with Bearer token in your request.',
          },
        ],
      },
      {
        category: 'Validation',
        description: 'Errors related to request validation',
        codes: [
          {
            code: 'INVALID_REQUEST_BODY',
            httpStatus: 400,
            title: 'Invalid Request Body',
            description: 'The request body failed validation.',
            resolution: 'Check the request body against the API schema.',
            example: {
              type: 'https://api.example.com/errors/validation',
              title: 'Validation Error',
              status: 400,
              detail: 'One or more fields failed validation',
              instance: '/api/v1/invoices',
              errors: {
                forwarderId: ['Invalid UUID format'],
              },
            },
          },
          {
            code: 'UNSUPPORTED_FILE_TYPE',
            httpStatus: 400,
            title: 'Unsupported File Type',
            description: 'The uploaded file type is not supported.',
            resolution: 'Upload a file in PDF, JPEG, or PNG format.',
          },
          {
            code: 'FILE_TOO_LARGE',
            httpStatus: 413,
            title: 'File Too Large',
            description: 'The uploaded file exceeds the maximum allowed size.',
            resolution: 'Reduce the file size to under 10MB.',
          },
        ],
      },
      {
        category: 'Rate Limiting',
        description: 'Errors related to API rate limits',
        codes: [
          {
            code: 'RATE_LIMIT_EXCEEDED',
            httpStatus: 429,
            title: 'Rate Limit Exceeded',
            description: 'Too many requests have been made in a short period.',
            resolution: 'Wait for the rate limit window to reset and retry.',
            example: {
              type: 'https://api.example.com/errors/rate-limit',
              title: 'Too Many Requests',
              status: 429,
              detail: 'Rate limit exceeded. Please retry after 60 seconds.',
              instance: '/api/v1/invoices',
            },
          },
          {
            code: 'CONCURRENT_LIMIT_EXCEEDED',
            httpStatus: 429,
            title: 'Concurrent Request Limit Exceeded',
            description: 'Too many concurrent requests are being processed.',
            resolution: 'Wait for some requests to complete before making new ones.',
          },
        ],
      },
      {
        category: 'Resource',
        description: 'Errors related to resource access',
        codes: [
          {
            code: 'TASK_NOT_FOUND',
            httpStatus: 404,
            title: 'Task Not Found',
            description: 'The specified task ID does not exist.',
            resolution: 'Verify the task ID is correct.',
          },
          {
            code: 'WEBHOOK_NOT_FOUND',
            httpStatus: 404,
            title: 'Webhook Not Found',
            description: 'The specified webhook ID does not exist.',
            resolution: 'Verify the webhook ID is correct.',
          },
          {
            code: 'FORWARDER_NOT_FOUND',
            httpStatus: 404,
            title: 'Forwarder Not Found',
            description: 'The specified forwarder ID does not exist.',
            resolution: 'Verify the forwarder ID is correct or create a new forwarder.',
          },
        ],
      },
      {
        category: 'Processing',
        description: 'Errors related to document processing',
        codes: [
          {
            code: 'OCR_FAILED',
            httpStatus: 500,
            title: 'OCR Processing Failed',
            description: 'The document could not be processed by the OCR engine.',
            resolution: 'Ensure the document is readable and try again.',
          },
          {
            code: 'EXTRACTION_FAILED',
            httpStatus: 500,
            title: 'Data Extraction Failed',
            description: 'Failed to extract data from the document.',
            resolution: 'The document format may not be supported. Contact support.',
          },
          {
            code: 'CLASSIFICATION_FAILED',
            httpStatus: 500,
            title: 'Classification Failed',
            description: 'Failed to classify the extracted data.',
            resolution: 'Review the forwarder mapping rules or contact support.',
          },
        ],
      },
      {
        category: 'Server',
        description: 'Server-side errors',
        codes: [
          {
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            title: 'Internal Server Error',
            description: 'An unexpected error occurred on the server.',
            resolution: 'Try again later. If the problem persists, contact support.',
          },
          {
            code: 'SERVICE_UNAVAILABLE',
            httpStatus: 503,
            title: 'Service Unavailable',
            description: 'The service is temporarily unavailable.',
            resolution: 'The service is under maintenance. Try again later.',
          },
        ],
      },
    ];
  }

  /**
   * Get all endpoints from the spec
   */
  async getEndpoints(): Promise<Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    tags?: string[];
  }>> {
    const spec = await this.loadSpec();
    const endpoints: Array<{
      path: string;
      method: string;
      operationId?: string;
      summary?: string;
      tags?: string[];
    }> = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            tags: operation.tags,
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Get cache metadata
   */
  getCacheInfo(): { cachedAt: string; expiresAt: string } | null {
    if (!this.specCache) {
      return null;
    }

    return {
      cachedAt: this.specCache.cachedAt.toISOString(),
      expiresAt: this.specCache.expiresAt.toISOString(),
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.specCache = null;
  }

  /**
   * Reload spec (bypasses cache)
   */
  async reloadSpec(): Promise<OpenAPISpec> {
    this.clearCache();
    return this.loadSpec();
  }
}

// ============================================================
// Singleton Instance
// ============================================================

/**
 * Singleton instance of OpenAPI Loader Service
 */
export const openAPILoaderService = new OpenAPILoaderService();

/**
 * Export class for testing and custom configurations
 */
export { OpenAPILoaderService };
