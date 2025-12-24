/**
 * @fileoverview Term Aggregation Service for Historical Data Analysis
 * @description
 *   Provides term aggregation and clustering functionality for analyzing
 *   extracted invoice terms from historical processing results:
 *   - Extracts and normalizes terms from HistoricalFile.extractionResult
 *   - Aggregates term frequency and company distribution
 *   - Clusters similar terms using Levenshtein distance
 *   - Supports filtering by batch, company, date range
 *
 * @module src/services/term-aggregation
 * @since Epic 0 - Story 0.5 (Term Aggregation and Initial Rules)
 * @lastModified 2025-12-24
 *
 * @features
 *   - Term extraction from JSON extraction results
 *   - Frequency counting with company distribution
 *   - Similar term clustering using string similarity
 *   - Configurable similarity threshold
 *
 * @dependencies
 *   - @prisma/client - Database access
 *   - src/lib/prisma - Prisma client instance
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { HistoricalFileStatus } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Company distribution data for a term
 */
export interface CompanyDistribution {
  companyId: string;
  companyName: string;
  count: number;
}

/**
 * Aggregated term data structure
 */
export interface AggregatedTerm {
  /** Normalized term text */
  term: string;
  /** Original term variations found */
  originalTerms: string[];
  /** Total occurrence frequency */
  frequency: number;
  /** Distribution across companies */
  companyDistribution: CompanyDistribution[];
  /** Similar terms (populated by clustering) */
  similarTerms: string[];
  /** AI-suggested category (optional) */
  suggestedCategory?: string;
  /** Classification confidence (optional) */
  confidence?: number;
}

/**
 * Term aggregation filter options
 */
export interface TermAggregationFilters {
  /** Filter by specific batch ID */
  batchId?: string;
  /** Filter by company ID */
  companyId?: string;
  /** Start date for filtering */
  startDate?: Date;
  /** End date for filtering */
  endDate?: Date;
  /** Minimum term frequency threshold */
  minFrequency?: number;
  /** Maximum number of terms to return */
  limit?: number;
}

/**
 * Term aggregation result
 */
export interface TermAggregationResult {
  /** Aggregated terms sorted by frequency */
  terms: AggregatedTerm[];
  /** Total unique terms found */
  totalTerms: number;
  /** Total documents processed */
  totalDocuments: number;
  /** Date range of processed documents */
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

/**
 * Extraction result structure (JSON from HistoricalFile)
 */
interface ExtractionResultJson {
  invoiceData?: {
    items?: Array<{
      description?: string | null;
      amount?: {
        amount?: number | null;
        currencyCode?: string | null;
      } | null;
    }>;
  };
  // GPT Vision result structure
  extractedData?: {
    lineItems?: Array<{
      description?: string | null;
      chargeType?: string | null;
    }>;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default similarity threshold for term clustering (0-1) */
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/** Minimum term length to consider for aggregation */
const MIN_TERM_LENGTH = 2;

/** Maximum terms to return by default */
const DEFAULT_TERM_LIMIT = 500;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalizes a term for consistent aggregation
 * - Converts to uppercase
 * - Trims whitespace
 * - Removes special characters except common ones
 * - Collapses multiple spaces
 *
 * @param term - Raw term to normalize
 * @returns Normalized term string
 */
export function normalizeForAggregation(term: string): string {
  if (!term || typeof term !== 'string') {
    return '';
  }

  return term
    .toUpperCase()
    .trim()
    .replace(/[^\w\s\-\/\.&]/g, '') // Keep alphanumeric, spaces, hyphens, slashes, dots, ampersands
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Calculates Levenshtein distance between two strings
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance between strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculates similarity ratio between two strings (0-1)
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity ratio (1 = identical, 0 = completely different)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLength;
}

/**
 * Clusters similar terms together
 *
 * @param terms - Array of aggregated terms to cluster
 * @param threshold - Similarity threshold (0-1)
 */
export function clusterSimilarTerms(
  terms: AggregatedTerm[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): void {
  const n = terms.length;

  // For each term, find similar terms
  for (let i = 0; i < n; i++) {
    const term1 = terms[i];
    term1.similarTerms = [];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const term2 = terms[j];
      const similarity = calculateSimilarity(term1.term, term2.term);

      if (similarity >= threshold && similarity < 1) {
        term1.similarTerms.push(term2.term);
      }
    }
  }
}

/**
 * Extracts terms from an extraction result JSON
 *
 * @param extractionResult - JSON extraction result from HistoricalFile
 * @returns Array of extracted term strings
 */
export function extractTermsFromResult(
  extractionResult: Prisma.JsonValue
): string[] {
  if (!extractionResult || typeof extractionResult !== 'object') {
    return [];
  }

  const terms: string[] = [];
  const result = extractionResult as ExtractionResultJson;

  // Extract from invoiceData.items (Azure Document Intelligence format)
  if (result.invoiceData?.items) {
    for (const item of result.invoiceData.items) {
      if (item.description) {
        const normalized = normalizeForAggregation(item.description);
        if (normalized.length >= MIN_TERM_LENGTH) {
          terms.push(normalized);
        }
      }
    }
  }

  // Extract from extractedData.lineItems (GPT Vision format)
  if (result.extractedData?.lineItems) {
    for (const item of result.extractedData.lineItems) {
      if (item.description) {
        const normalized = normalizeForAggregation(item.description);
        if (normalized.length >= MIN_TERM_LENGTH) {
          terms.push(normalized);
        }
      }
      if (item.chargeType) {
        const normalized = normalizeForAggregation(item.chargeType);
        if (normalized.length >= MIN_TERM_LENGTH) {
          terms.push(normalized);
        }
      }
    }
  }

  return terms;
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Aggregates terms from historical processing results
 *
 * @description
 *   Extracts all terms from completed historical file processing results,
 *   aggregates them by frequency, tracks company distribution, and clusters
 *   similar terms together.
 *
 * @param filters - Optional filters for aggregation
 * @returns Aggregated term results with statistics
 *
 * @example
 * ```typescript
 * const result = await aggregateTerms({
 *   batchId: 'batch-123',
 *   minFrequency: 5,
 *   limit: 100
 * });
 * ```
 */
export async function aggregateTerms(
  filters: TermAggregationFilters = {}
): Promise<TermAggregationResult> {
  const {
    batchId,
    companyId,
    startDate,
    endDate,
    minFrequency = 1,
    limit = DEFAULT_TERM_LIMIT,
  } = filters;

  // Build query conditions
  const where: Prisma.HistoricalFileWhereInput = {
    status: 'COMPLETED' as HistoricalFileStatus,
    extractionResult: { not: Prisma.JsonNull },
  };

  if (batchId) {
    where.batchId = batchId;
  }

  if (startDate || endDate) {
    where.processedAt = {};
    if (startDate) {
      where.processedAt.gte = startDate;
    }
    if (endDate) {
      where.processedAt.lte = endDate;
    }
  }

  // Fetch historical files with their batch info
  // Note: Company distribution requires extracting from extraction result
  // as HistoricalBatch doesn't have a direct company relation
  const files = await prisma.historicalFile.findMany({
    where,
    select: {
      id: true,
      extractionResult: true,
      processedAt: true,
      batchId: true,
      batch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Note: companyId filter is not yet implemented as HistoricalBatch
  // doesn't have company relation. This will be addressed in future updates.
  const filteredFiles = files;

  // Build term aggregation map
  const termMap = new Map<
    string,
    {
      originalTerms: Set<string>;
      count: number;
      companies: Map<string, { name: string; count: number }>;
    }
  >();

  let dateMin: Date | null = null;
  let dateMax: Date | null = null;

  for (const file of filteredFiles) {
    // Track date range
    if (file.processedAt) {
      if (!dateMin || file.processedAt < dateMin) {
        dateMin = file.processedAt;
      }
      if (!dateMax || file.processedAt > dateMax) {
        dateMax = file.processedAt;
      }
    }

    // Extract terms from this file
    const rawTerms = extractTermsFromResult(file.extractionResult);

    for (const term of rawTerms) {
      const normalized = term; // Already normalized in extractTermsFromResult

      if (!termMap.has(normalized)) {
        termMap.set(normalized, {
          originalTerms: new Set(),
          count: 0,
          companies: new Map(),
        });
      }

      const termData = termMap.get(normalized)!;
      termData.originalTerms.add(term);
      termData.count++;

      // Track distribution by batch (as proxy for company)
      // Note: HistoricalBatch doesn't have direct company relation
      // Future: extract company info from extractionResult JSON
      const batchId = file.batchId;
      const batchName = file.batch?.name ?? 'Unknown Batch';
      if (batchId) {
        if (!termData.companies.has(batchId)) {
          termData.companies.set(batchId, { name: batchName, count: 0 });
        }
        termData.companies.get(batchId)!.count++;
      }
    }
  }

  // Convert to result format
  const aggregated: AggregatedTerm[] = [];

  for (const [term, data] of termMap.entries()) {
    // Apply minimum frequency filter
    if (data.count < minFrequency) {
      continue;
    }

    aggregated.push({
      term,
      originalTerms: Array.from(data.originalTerms),
      frequency: data.count,
      companyDistribution: Array.from(data.companies.entries()).map(
        ([companyId, info]) => ({
          companyId,
          companyName: info.name,
          count: info.count,
        })
      ),
      similarTerms: [], // Will be populated by clustering
    });
  }

  // Sort by frequency descending
  aggregated.sort((a, b) => b.frequency - a.frequency);

  // Apply limit
  const limitedTerms = aggregated.slice(0, limit);

  // Cluster similar terms
  clusterSimilarTerms(limitedTerms);

  return {
    terms: limitedTerms,
    totalTerms: aggregated.length,
    totalDocuments: filteredFiles.length,
    dateRange: {
      start: dateMin,
      end: dateMax,
    },
  };
}

/**
 * Gets term statistics for a specific batch
 *
 * @param batchId - Batch ID to analyze
 * @returns Term aggregation result for the batch
 */
export async function getBatchTermStatistics(
  batchId: string
): Promise<TermAggregationResult> {
  return aggregateTerms({ batchId });
}

/**
 * Gets term statistics for a specific company
 *
 * @param companyId - Company ID to analyze
 * @param options - Additional filter options
 * @returns Term aggregation result for the company
 */
export async function getCompanyTermStatistics(
  companyId: string,
  options: Omit<TermAggregationFilters, 'companyId'> = {}
): Promise<TermAggregationResult> {
  return aggregateTerms({ ...options, companyId });
}

/**
 * Finds terms that match or are similar to a search query
 *
 * @param query - Search query string
 * @param filters - Optional aggregation filters
 * @returns Matching aggregated terms
 */
export async function searchTerms(
  query: string,
  filters: TermAggregationFilters = {}
): Promise<AggregatedTerm[]> {
  const normalizedQuery = normalizeForAggregation(query);

  if (!normalizedQuery) {
    return [];
  }

  // Get all terms
  const result = await aggregateTerms(filters);

  // Filter by similarity to query
  return result.terms.filter((term) => {
    // Exact match
    if (term.term.includes(normalizedQuery)) {
      return true;
    }

    // Fuzzy match
    const similarity = calculateSimilarity(term.term, normalizedQuery);
    return similarity >= 0.6; // Lower threshold for search
  });
}

/**
 * Gets terms that need classification (no existing mapping rule)
 *
 * @param filters - Optional aggregation filters
 * @returns Terms without mapping rules
 */
export async function getUnmappedTerms(
  filters: TermAggregationFilters = {}
): Promise<AggregatedTerm[]> {
  const result = await aggregateTerms(filters);

  // Get existing mapping rules
  const existingRules = await prisma.mappingRule.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      fieldName: true,
    },
  });

  const mappedTerms = new Set(
    existingRules.map((r) => normalizeForAggregation(r.fieldName))
  );

  // Filter out terms that already have rules
  return result.terms.filter((term) => !mappedTerms.has(term.term));
}
