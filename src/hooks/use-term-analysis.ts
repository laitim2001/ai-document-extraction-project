/**
 * @fileoverview Term Analysis Hooks
 * @description
 *   React Query hooks for term aggregation and classification:
 *   - Fetch aggregated terms with filtering
 *   - Trigger AI classification
 *   - Manage term selection state
 *
 * @module src/hooks/use-term-analysis
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AggregatedTerm,
  TermAggregationResult,
} from '@/services/term-aggregation.service';
import type {
  TermClassification,
  BatchClassificationResult,
} from '@/services/term-classification.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Term analysis filter parameters
 */
export interface TermAnalysisFilters {
  batchId?: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
  minFrequency?: number;
  limit?: number;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ============================================================================
// Query Keys
// ============================================================================

export const termAnalysisKeys = {
  all: ['term-analysis'] as const,
  list: (filters: TermAnalysisFilters) =>
    [...termAnalysisKeys.all, 'list', filters] as const,
  classification: (terms: string[]) =>
    [...termAnalysisKeys.all, 'classification', terms] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches aggregated terms from API
 */
async function fetchAggregatedTerms(
  filters: TermAnalysisFilters
): Promise<TermAggregationResult> {
  const params = new URLSearchParams();

  if (filters.batchId) params.set('batchId', filters.batchId);
  if (filters.companyId) params.set('companyId', filters.companyId);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.minFrequency)
    params.set('minFrequency', filters.minFrequency.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());

  const response = await fetch(
    `/api/admin/term-analysis?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch terms');
  }

  const result: ApiResponse<TermAggregationResult> = await response.json();
  return result.data;
}

/**
 * Classifies terms using AI
 */
async function classifyTermsApi(
  terms: string[]
): Promise<BatchClassificationResult> {
  const response = await fetch('/api/admin/term-analysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ terms }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to classify terms');
  }

  const result: ApiResponse<BatchClassificationResult> = await response.json();
  return result.data;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch aggregated terms
 *
 * @param filters - Query filters
 * @param enabled - Whether to enable the query
 */
export function useAggregatedTerms(
  filters: TermAnalysisFilters = {},
  enabled = true
) {
  return useQuery({
    queryKey: termAnalysisKeys.list(filters),
    queryFn: () => fetchAggregatedTerms(filters),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to classify terms using AI
 */
export function useClassifyTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classifyTermsApi,
    onSuccess: () => {
      // Invalidate term lists to refresh with new classifications
      queryClient.invalidateQueries({
        queryKey: termAnalysisKeys.all,
      });
    },
  });
}

/**
 * Hook to get term with classification result
 *
 * @description
 *   Merges aggregated term data with AI classification results
 */
export function useTermWithClassification(
  term: AggregatedTerm,
  classification?: TermClassification
) {
  if (!classification) {
    return {
      ...term,
      suggestedCategory: undefined,
      confidence: undefined,
    };
  }

  return {
    ...term,
    suggestedCategory: classification.category,
    confidence: classification.confidence,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  AggregatedTerm,
  TermAggregationResult,
  TermClassification,
  BatchClassificationResult,
};
