/**
 * @fileoverview SDK Examples types for multi-language code samples
 * @description
 *   Type definitions for:
 *   - SDK example code snippets
 *   - Language configurations
 *   - Code highlighting settings
 *
 * @module src/types/sdk-examples
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

// ============================================================
// Language Types
// ============================================================

/**
 * Supported programming languages for SDK examples
 */
export type SDKLanguage = 'typescript' | 'python' | 'csharp';

/**
 * Language display configuration
 */
export interface LanguageConfig {
  id: SDKLanguage;
  name: string;
  extension: string;
  icon?: string;
  prismLanguage: string;
}

/**
 * Available language configurations
 */
export const LANGUAGE_CONFIGS: Record<SDKLanguage, LanguageConfig> = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    extension: 'ts',
    prismLanguage: 'typescript',
  },
  python: {
    id: 'python',
    name: 'Python',
    extension: 'py',
    prismLanguage: 'python',
  },
  csharp: {
    id: 'csharp',
    name: 'C#',
    extension: 'cs',
    prismLanguage: 'csharp',
  },
};

// ============================================================
// SDK Example Types
// ============================================================

/**
 * SDK example for a specific endpoint
 */
export interface SDKExample {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  title: string;
  description: string;
  code: Record<SDKLanguage, string>;
  dependencies?: Record<SDKLanguage, string[]>;
  notes?: string;
}

/**
 * SDK example category
 */
export interface SDKExampleCategory {
  id: string;
  name: string;
  description: string;
  examples: SDKExample[];
}

/**
 * Complete SDK examples collection
 */
export interface SDKExamplesCollection {
  version: string;
  lastUpdated: string;
  categories: SDKExampleCategory[];
}

// ============================================================
// Code Snippet Types
// ============================================================

/**
 * Code snippet with metadata
 */
export interface CodeSnippet {
  language: SDKLanguage;
  code: string;
  filename?: string;
  highlightLines?: number[];
  showLineNumbers?: boolean;
}

/**
 * Code block props for rendering
 */
export interface CodeBlockProps {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  title?: string;
  copyable?: boolean;
  wrapLongLines?: boolean;
}

// ============================================================
// Example Response Types
// ============================================================

/**
 * SDK examples API response
 */
export interface SDKExamplesResponse {
  success: boolean;
  data: SDKExamplesCollection;
}

/**
 * Single endpoint example response
 */
export interface EndpointExampleResponse {
  success: boolean;
  data: SDKExample;
}

// ============================================================
// Quick Start Types
// ============================================================

/**
 * Quick start guide section
 */
export interface QuickStartSection {
  id: string;
  title: string;
  description: string;
  steps: QuickStartStep[];
}

/**
 * Quick start step
 */
export interface QuickStartStep {
  stepNumber: number;
  title: string;
  description: string;
  code?: Record<SDKLanguage, string>;
  note?: string;
}

// ============================================================
// Installation Types
// ============================================================

/**
 * SDK installation instructions
 */
export interface SDKInstallation {
  language: SDKLanguage;
  packageManager: string;
  installCommand: string;
  importStatement: string;
  initializationCode: string;
}

/**
 * Installation instructions collection
 */
export const SDK_INSTALLATIONS: SDKInstallation[] = [
  {
    language: 'typescript',
    packageManager: 'npm',
    installCommand: 'npm install axios',
    importStatement: "import axios from 'axios';",
    initializationCode: `const api = axios.create({
  baseURL: 'https://api.example.com/api/v1',
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json',
  },
});`,
  },
  {
    language: 'python',
    packageManager: 'pip',
    installCommand: 'pip install requests',
    importStatement: 'import requests',
    initializationCode: `API_KEY = "your-api-key"
BASE_URL = "https://api.example.com/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}`,
  },
  {
    language: 'csharp',
    packageManager: 'NuGet',
    installCommand: 'dotnet add package System.Net.Http.Json',
    importStatement: `using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;`,
    initializationCode: `var httpClient = new HttpClient
{
    BaseAddress = new Uri("https://api.example.com/api/v1/")
};
httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", apiKey);`,
  },
];

// ============================================================
// Syntax Highlighting Types
// ============================================================

/**
 * Syntax highlighting theme
 */
export type SyntaxTheme = 'vs-dark' | 'vs-light' | 'dracula' | 'github-dark' | 'github-light';

/**
 * Syntax highlighting configuration
 */
export interface SyntaxHighlightConfig {
  theme: SyntaxTheme;
  showLineNumbers: boolean;
  wrapLongLines: boolean;
  copyButton: boolean;
  language: string;
}

/**
 * Default syntax highlighting configuration
 */
export const DEFAULT_SYNTAX_CONFIG: SyntaxHighlightConfig = {
  theme: 'vs-dark',
  showLineNumbers: true,
  wrapLongLines: false,
  copyButton: true,
  language: 'typescript',
};

// ============================================================
// Tab Component Types
// ============================================================

/**
 * Language tab for code examples
 */
export interface LanguageTab {
  id: SDKLanguage;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Tab panel content
 */
export interface TabPanelContent {
  language: SDKLanguage;
  code: string;
  filename?: string;
}

// ============================================================
// Example Metadata Types
// ============================================================

/**
 * Example metadata for tracking
 */
export interface ExampleMetadata {
  id: string;
  endpoint: string;
  method: string;
  createdAt: string;
  updatedAt: string;
  views?: number;
  copiedCount?: number;
}

/**
 * Example analytics
 */
export interface ExampleAnalytics {
  exampleId: string;
  language: SDKLanguage;
  action: 'view' | 'copy' | 'try';
  timestamp: string;
}
