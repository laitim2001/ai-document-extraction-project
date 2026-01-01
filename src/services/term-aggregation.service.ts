/**
 * @fileoverview Term Aggregation Service for Historical Data Analysis
 * @description
 *   Provides term aggregation and clustering functionality for analyzing
 *   extracted invoice terms from historical processing results:
 *   - Extracts and normalizes terms from HistoricalFile.extractionResult
 *   - Aggregates term frequency and company distribution
 *   - Clusters similar terms using Levenshtein distance
 *   - Supports filtering by batch, company, date range
 *   - Filters out address-like content from term extraction
 *
 * @module src/services/term-aggregation
 * @since Epic 0 - Story 0.5 (Term Aggregation and Initial Rules)
 * @lastModified 2025-12-30
 *
 * @features
 *   - Term extraction from JSON extraction results
 *   - Address-like term filtering (FIX-005)
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

/**
 * Address-related keywords to filter out from term extraction
 * These patterns indicate the term is likely an address rather than a charge description
 * @since FIX-005 - Address term filtering
 */
const ADDRESS_KEYWORDS = [
  // English address components
  'STREET', 'ROAD', 'AVENUE', 'BOULEVARD', 'LANE', 'DRIVE', 'COURT',
  'PLACE', 'SQUARE', 'WARD', 'DISTRICT', 'PROVINCE', 'CITY', 'COUNTY',
  'STATE', 'COUNTRY', 'FLOOR', 'BUILDING', 'TOWER', 'BLOCK', 'UNIT',
  'SUITE', 'APARTMENT', 'ROOM', 'HIGHWAY', 'EXPRESSWAY',
  // Vietnamese address components
  'DUONG', 'PHO', 'QUAN', 'PHUONG', 'TINH', 'THANH PHO', 'HUYEN', 'XA',
  'TANG', 'TOA NHA', 'CAN HO', 'PHONG', 'KHU', 'KHU PHO', 'AP',
  // Common abbreviations
  'ST', 'RD', 'AVE', 'BLVD', 'FLR', 'BLDG', 'BLK', 'APT',
];

/**
 * Country and major city names to filter out
 * @since FIX-005 - Address term filtering
 * @since FIX-006 - Added more cities and airport codes
 */
const LOCATION_NAMES = [
  // Countries
  'VIETNAM', 'VIET NAM', 'CHINA', 'HONG KONG', 'SINGAPORE', 'THAILAND',
  'MALAYSIA', 'INDONESIA', 'PHILIPPINES', 'TAIWAN', 'JAPAN', 'KOREA',
  'INDIA', 'AUSTRALIA', 'UNITED STATES', 'UNITED KINGDOM', 'GERMANY', 'FRANCE',
  // Major cities - Southeast Asia
  'HO CHI MINH', 'HOCHIMINH', 'SAIGON', 'HANOI', 'HA NOI', 'DA NANG',
  'HAI PHONG', 'CAN THO', 'NHA TRANG', 'VUNG TAU', 'BIEN HOA',
  'BINH DUONG', 'DONG NAI', 'LONG AN', 'BAC NINH', 'QUANG NINH',
  'BANGKOK', 'KUALA LUMPUR', 'JAKARTA', 'MANILA', 'TAIPEI',
  // Major cities - China
  'SHANGHAI', 'BEIJING', 'SHENZHEN', 'GUANGZHOU', 'KOWLOON', 'TSIM SHA TSUI',
  // Major cities - India (FIX-006)
  'BANGALORE', 'BENGALURU', 'CHENNAI', 'HYDERABAD', 'KOLKATA', 'PUNE',
  'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'KANPUR', 'NAGPUR', 'INDORE', 'THANE',
  'BHOPAL', 'VISAKHAPATNAM', 'PATNA', 'VADODARA', 'GHAZIABAD', 'LUDHIANA',
  'AGRA', 'NASHIK', 'FARIDABAD', 'MEERUT', 'RAJKOT', 'VARANASI', 'SRINAGAR',
  // Major cities - Other Asia
  'TOKYO', 'OSAKA', 'SEOUL', 'BUSAN', 'MUMBAI', 'NEW DELHI', 'DELHI',
  'SYDNEY', 'MELBOURNE', 'BRISBANE', 'PERTH', 'AUCKLAND',
];

/**
 * Common airport/city codes (IATA codes) to filter out
 * These 3-letter codes often appear at the start of address blocks
 * @since FIX-006 - Airport code filtering
 */
const AIRPORT_CODES = [
  // China & Hong Kong
  'HKG', 'PEK', 'PVG', 'SHA', 'CAN', 'SZX', 'CTU', 'KMG', 'XIY', 'HGH',
  // Southeast Asia
  'SIN', 'BKK', 'KUL', 'CGK', 'MNL', 'SGN', 'HAN', 'DAD', 'CXR', 'PQC',
  // India
  'BLR', 'DEL', 'BOM', 'MAA', 'CCU', 'HYD', 'COK', 'AMD', 'GOI', 'PNQ',
  // Japan & Korea
  'NRT', 'HND', 'KIX', 'ICN', 'GMP', 'PUS', 'CJU',
  // Australia
  'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'CBR',
  // Taiwan
  'TPE', 'KHH', 'RMQ',
  // Others
  'DXB', 'DOH', 'AUH', 'SVO', 'CDG', 'LHR', 'FRA', 'AMS', 'JFK', 'LAX',
];

/**
 * Currency codes that indicate the term is a price/charge line item
 * If a term contains any of these codes, it should NOT be filtered out
 * even if it matches ADDRESS_PATTERNS (e.g., postal code pattern matching exchange rates)
 * @since FIX-005.1 - Currency code exception for price lines
 */
const CURRENCY_CODES = [
  // Major currencies used in freight invoices
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'SGD', 'THB',
  'MYR', 'IDR', 'PHP', 'VND', 'TWD', 'KRW', 'INR', 'AUD',
  'NZD', 'CAD', 'CHF', 'AED', 'SAR', 'KWD', 'BHD', 'QAR',
];

/**
 * Patterns that indicate an address-like term
 * @since FIX-005 - Address term filtering
 */
const ADDRESS_PATTERNS = [
  // Floor/level patterns: "12F", "FLOOR 5", "5/F", "TANG 3"
  /\b\d+\s*(?:F|\/F|FL|FLR|FLOOR|TANG)\b/i,
  /\b(?:F|\/F|FL|FLR|FLOOR|TANG)\s*\d+\b/i,
  // Building number patterns: "NO. 123", "NO 45", "SO 78"
  /\b(?:NO\.?|SO)\s*\d+/i,
  // Street number patterns: "123 STREET", "45A ROAD"
  /^\d+[A-Z]?\s+(?:STREET|ROAD|DUONG|PHO)/i,
  // Postal/zip code patterns
  /\b\d{5,6}\b/,
  // Multiple comma-separated parts (typical address format): "A, B, C, D"
  /^[^,]+,[^,]+,[^,]+/,
  // Phone number patterns
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/,
  // Email patterns
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

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
 * Checks if a term contains any currency code
 * Used to identify price/charge line items that should not be filtered out
 *
 * @param term - Term to check (should be uppercase)
 * @returns true if the term contains a currency code
 * @since FIX-005.1 - Currency code exception for price lines
 */
function containsCurrencyCode(term: string): boolean {
  for (const code of CURRENCY_CODES) {
    // Use word boundary to match exact currency codes
    const pattern = new RegExp(`\\b${code}\\b`, 'i');
    if (pattern.test(term)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a term appears to be an address rather than a charge description
 * Used to filter out address-like content from term extraction
 *
 * @param term - Normalized term to check (should be uppercase)
 * @returns true if the term appears to be an address, false otherwise
 * @since FIX-005 - Address term filtering
 * @since FIX-005.1 - Added currency code exception for price lines
 * @since FIX-006 - Added airport code, person name, and company name filtering
 *
 * @example
 * isAddressLikeTerm('EXPRESS WORLDWIDE NONDOC') // false - valid charge term
 * isAddressLikeTerm('BO STREET WARD 13 DISTRICT 4') // true - address
 * isAddressLikeTerm('HO CHI MINH CITY VIETNAM') // true - location
 * isAddressLikeTerm('FREIGHT CHARGES USD 65.00 7.881487') // false - price line with currency
 * isAddressLikeTerm('HKG, HONG KONG') // true - airport code pattern (FIX-006)
 * isAddressLikeTerm('KATHY LAM') // true - person name (FIX-006)
 * isAddressLikeTerm('RICOH ASIA PACIFIC OPERATIONS LIMITED') // true - company name (FIX-006)
 */
export function isAddressLikeTerm(term: string): boolean {
  if (!term) return false;

  const upperTerm = term.toUpperCase();

  // FIX-005.1: Check if term contains currency code
  // If it does, this is likely a price/charge line item, not an address
  const hasCurrency = containsCurrencyCode(upperTerm);

  // Check for address keywords (with word boundary matching)
  // These are checked regardless of currency presence
  for (const keyword of ADDRESS_KEYWORDS) {
    // Create a regex pattern with word boundaries
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(upperTerm)) {
      return true;
    }
  }

  // Check for location names
  // These are checked regardless of currency presence
  for (const location of LOCATION_NAMES) {
    if (upperTerm.includes(location)) {
      return true;
    }
  }

  // FIX-006: Check if term starts with airport code (e.g., "HKG, HONG KONG", "BLR, BANGALORE")
  // Airport codes at the start typically indicate address blocks, not charge descriptions
  for (const code of AIRPORT_CODES) {
    // Check if term starts with airport code followed by comma, space, or newline
    const startsWithCode = new RegExp(`^${code}(?:[,\\s\\n]|$)`, 'i');
    if (startsWithCode.test(upperTerm)) {
      return true;
    }
  }

  // FIX-006: Check for person name patterns
  // Person names are typically 2-3 words, all letters, no numbers or special freight terms
  const words = upperTerm.split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 2 && words.length <= 4) {
    const allWordsAreNames = words.every((word) => {
      // Each word should be all letters (allowing hyphens for double names)
      return /^[A-Z]+(?:-[A-Z]+)?$/i.test(word);
    });
    // Check if this looks like a name (no freight-related keywords)
    const freightKeywords = [
      'FREIGHT',
      'CHARGE',
      'FEE',
      'SURCHARGE',
      'HANDLING',
      'CUSTOMS',
      'DUTY',
      'TAX',
      'IMPORT',
      'EXPORT',
      'CLEARANCE',
      'DOCUMENT',
      'EXPRESS',
      'DELIVERY',
      'SHIPPING',
      'TRANSPORT',
      'CARGO',
      'AIR',
      'SEA',
      'OCEAN',
      'FUEL',
      'SECURITY',
      'INSURANCE',
      'PICKUP',
      'COLLECT',
      'PREPAID',
    ];
    const hasFreightKeyword = words.some((w) => freightKeywords.includes(w));
    if (allWordsAreNames && !hasFreightKeyword && upperTerm.length < 30) {
      return true;
    }
  }

  // FIX-006: Check for company/building name patterns often extracted incorrectly
  // Patterns like "E.TOWN CENTRAL", "RICOH ASIA PACIFIC OPERATIONS LIMITED"
  const companyPatterns = [
    /\bLIMITED\b/i,
    /\bLTD\b/i,
    /\bCO\.\s*LTD\b/i,
    /\bCORP(?:ORATION)?\b/i,
    /\bINC(?:ORPORATED)?\b/i,
    /\bPTE\b/i,
    /\bPVT\b/i,
    /\bGMBH\b/i,
    /\bSDN\s*BHD\b/i,
    /\bS\.?A\.?\b/,
    /\bOPERATIONS\b/i,
    /\bCENTRAL\b/i,
    /\bPLAZA\b/i,
    /\bCENTRE\b/i,
    /\bCENTER\b/i,
  ];
  for (const pattern of companyPatterns) {
    if (pattern.test(upperTerm)) {
      return true;
    }
  }

  // FIX-005.1: Skip ADDRESS_PATTERNS check if term contains currency code
  // This prevents price lines like "FREIGHT CHARGES USD 65.00 7.881487" from being
  // incorrectly filtered by the postal code pattern matching "881487"
  if (!hasCurrency) {
    // Check for address-like patterns only if no currency code is present
    for (const pattern of ADDRESS_PATTERNS) {
      if (pattern.test(upperTerm)) {
        return true;
      }
    }
  }

  // Check if the term is too long (addresses tend to be verbose)
  // Valid charge terms are usually concise (< 60 chars)
  // Skip this check if term contains currency (price lines can be longer)
  if (!hasCurrency && upperTerm.length > 80) {
    return true;
  }

  return false;
}

/**
 * Calculates Levenshtein distance between two strings
 * NOTE: Internal helper function. Use `levenshteinDistance` from '@/services/similarity' for external use.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance between strings
 * @internal
 */
function levenshteinDistanceInternal(str1: string, str2: string): number {
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

  const distance = levenshteinDistanceInternal(str1, str2);
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
 * Filters out address-like content to only return valid charge terms
 *
 * @param extractionResult - JSON extraction result from HistoricalFile
 * @returns Array of extracted term strings (filtered, no addresses)
 * @since Updated in FIX-005 to filter address-like terms
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
        // Apply address filter (FIX-005)
        if (normalized.length >= MIN_TERM_LENGTH && !isAddressLikeTerm(normalized)) {
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
        // Apply address filter (FIX-005)
        if (normalized.length >= MIN_TERM_LENGTH && !isAddressLikeTerm(normalized)) {
          terms.push(normalized);
        }
      }
      if (item.chargeType) {
        const normalized = normalizeForAggregation(item.chargeType);
        // Apply address filter (FIX-005)
        if (normalized.length >= MIN_TERM_LENGTH && !isAddressLikeTerm(normalized)) {
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
