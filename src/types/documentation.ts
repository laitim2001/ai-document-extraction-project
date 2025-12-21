/**
 * @fileoverview API Documentation types for OpenAPI spec and Swagger UI
 * @description
 *   Type definitions for:
 *   - OpenAPI specification structure
 *   - API version information
 *   - Error code references
 *   - Documentation metadata
 *
 * @module src/types/documentation
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

// ============================================================
// OpenAPI Types
// ============================================================

/**
 * OpenAPI specification structure
 */
export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components: OpenAPIComponents;
  tags?: OpenAPITag[];
  security?: OpenAPISecurityRequirement[];
}

/**
 * OpenAPI info section
 */
export interface OpenAPIInfo {
  title: string;
  description: string;
  version: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

/**
 * OpenAPI server definition
 */
export interface OpenAPIServer {
  url: string;
  description: string;
  variables?: Record<string, OpenAPIServerVariable>;
}

/**
 * OpenAPI server variable
 */
export interface OpenAPIServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

/**
 * OpenAPI path item
 */
export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
}

/**
 * OpenAPI operation
 */
export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
  deprecated?: boolean;
}

/**
 * OpenAPI parameter
 */
export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
}

/**
 * OpenAPI request body
 */
export interface OpenAPIRequestBody {
  description?: string;
  content: Record<string, OpenAPIMediaType>;
  required?: boolean;
}

/**
 * OpenAPI response
 */
export interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
  headers?: Record<string, OpenAPIHeader>;
}

/**
 * OpenAPI media type
 */
export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}

/**
 * OpenAPI schema (simplified)
 */
export interface OpenAPISchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  $ref?: string;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  additionalProperties?: boolean | OpenAPISchema;
}

/**
 * OpenAPI header
 */
export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
}

/**
 * OpenAPI example
 */
export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

/**
 * OpenAPI components section
 */
export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

/**
 * OpenAPI security scheme
 */
export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OpenAPIOAuthFlows;
  openIdConnectUrl?: string;
}

/**
 * OpenAPI OAuth flows
 */
export interface OpenAPIOAuthFlows {
  implicit?: OpenAPIOAuthFlow;
  password?: OpenAPIOAuthFlow;
  clientCredentials?: OpenAPIOAuthFlow;
  authorizationCode?: OpenAPIOAuthFlow;
}

/**
 * OpenAPI OAuth flow
 */
export interface OpenAPIOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * OpenAPI security requirement
 */
export type OpenAPISecurityRequirement = Record<string, string[]>;

/**
 * OpenAPI tag
 */
export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: {
    description?: string;
    url: string;
  };
}

// ============================================================
// API Version Types
// ============================================================

/**
 * API version information
 */
export interface APIVersionInfo {
  version: string;
  releaseDate: string;
  status: 'stable' | 'beta' | 'deprecated';
  deprecationDate?: string;
  sunsetDate?: string;
  changelog?: ChangelogEntry[];
}

/**
 * Changelog entry
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
}

// ============================================================
// Error Code Types
// ============================================================

/**
 * Error code reference
 */
export interface ErrorCodeReference {
  code: string;
  httpStatus: number;
  title: string;
  description: string;
  resolution: string;
  example?: ErrorCodeExample;
}

/**
 * Error code example
 */
export interface ErrorCodeExample {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: Record<string, string[]>;
}

/**
 * Error codes grouped by category
 */
export interface ErrorCodeCategory {
  category: string;
  description: string;
  codes: ErrorCodeReference[];
}

// ============================================================
// Documentation Response Types
// ============================================================

/**
 * OpenAPI spec response
 */
export interface OpenAPISpecResponse {
  success: boolean;
  data: OpenAPISpec;
  meta?: {
    cachedAt?: string;
    expiresAt?: string;
  };
}

/**
 * API version response
 */
export interface APIVersionResponse {
  success: boolean;
  data: APIVersionInfo;
}

/**
 * Error codes response
 */
export interface ErrorCodesResponse {
  success: boolean;
  data: {
    categories: ErrorCodeCategory[];
  };
}

// ============================================================
// Swagger UI Types
// ============================================================

/**
 * Swagger UI configuration
 */
export interface SwaggerUIConfig {
  url?: string;
  spec?: OpenAPISpec;
  dom_id?: string;
  deepLinking?: boolean;
  displayOperationId?: boolean;
  defaultModelsExpandDepth?: number;
  defaultModelExpandDepth?: number;
  displayRequestDuration?: boolean;
  docExpansion?: 'list' | 'full' | 'none';
  filter?: boolean | string;
  maxDisplayedTags?: number;
  showExtensions?: boolean;
  showCommonExtensions?: boolean;
  tagsSorter?: 'alpha' | ((a: string, b: string) => number);
  operationsSorter?: 'alpha' | 'method' | ((a: unknown, b: unknown) => number);
  persistAuthorization?: boolean;
  tryItOutEnabled?: boolean;
  withCredentials?: boolean;
}

/**
 * Swagger UI props for React component
 */
export interface SwaggerUIProps {
  spec?: OpenAPISpec;
  url?: string;
  layout?: string;
  docExpansion?: 'list' | 'full' | 'none';
  defaultModelsExpandDepth?: number;
  defaultModelExpandDepth?: number;
  displayOperationId?: boolean;
  displayRequestDuration?: boolean;
  filter?: boolean | string;
  supportedSubmitMethods?: string[];
  tryItOutEnabled?: boolean;
  persistAuthorization?: boolean;
}

// ============================================================
// Documentation Metadata Types
// ============================================================

/**
 * Documentation page metadata
 */
export interface DocPageMetadata {
  title: string;
  description: string;
  lastUpdated: string;
  version: string;
}

/**
 * Documentation navigation item
 */
export interface DocNavItem {
  title: string;
  href: string;
  description?: string;
  isActive?: boolean;
  children?: DocNavItem[];
}

/**
 * Documentation section
 */
export interface DocSection {
  id: string;
  title: string;
  content: string;
  subsections?: DocSection[];
}
