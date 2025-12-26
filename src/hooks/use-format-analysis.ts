/**
 * @fileoverview Format Analysis Hook
 * @description
 *   React Query hook for fetching and managing format analysis data.
 *   Provides:
 *   - Hierarchical term aggregation for batch
 *   - Format-specific term data
 *   - Loading and error states
 *
 * @module src/hooks/use-format-analysis
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @related
 *   - src/types/document-format.ts - 類型定義
 *   - src/app/api/v1/batches/[batchId]/hierarchical-terms/route.ts - API 端點
 *   - src/components/features/format-analysis/ - UI 組件
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  HierarchicalTermAggregation,
  CompanyTermNode,
  FormatTermNode,
  AggregationSummary,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface UseFormatAnalysisOptions {
  /** Batch ID to fetch data for */
  batchId: string;
  /** Whether to auto-refresh */
  autoRefresh?: boolean;
  /** Refresh interval in ms */
  refreshInterval?: number;
}

export interface UseFormatAnalysisReturn {
  /** Company nodes with format and term data */
  companies: CompanyTermNode[];
  /** Aggregation summary */
  summary: AggregationSummary | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch data */
  refetch: () => void;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch hierarchical term aggregation for a batch
 */
async function fetchHierarchicalTerms(
  batchId: string
): Promise<HierarchicalTermAggregation> {
  const response = await fetch(`/api/v1/batches/${batchId}/hierarchical-terms`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to fetch hierarchical terms: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch terms for a specific format
 */
async function fetchFormatTerms(formatId: string): Promise<FormatTermNode> {
  const response = await fetch(`/api/v1/formats/${formatId}/terms`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to fetch format terms: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching hierarchical format analysis data
 *
 * @param options - Hook options
 * @returns Format analysis data and state
 *
 * @example
 * ```tsx
 * const { companies, summary, isLoading } = useFormatAnalysis({ batchId: '123' });
 * ```
 */
export function useFormatAnalysis({
  batchId,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseFormatAnalysisOptions): UseFormatAnalysisReturn {
  const query = useQuery({
    queryKey: ['hierarchical-terms', batchId],
    queryFn: () => fetchHierarchicalTerms(batchId),
    enabled: !!batchId,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 60000, // 1 minute
  });

  return {
    companies: query.data?.companies || [],
    summary: query.data?.summary || null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching terms for a specific format
 *
 * @param formatId - Format ID to fetch terms for
 * @returns Format terms data and state
 *
 * @example
 * ```tsx
 * const { format, isLoading } = useFormatTerms(selectedFormatId);
 * ```
 */
export function useFormatTerms(formatId: string | null) {
  const query = useQuery({
    queryKey: ['format-terms', formatId],
    queryFn: () => (formatId ? fetchFormatTerms(formatId) : null),
    enabled: !!formatId,
    staleTime: 60000, // 1 minute
  });

  return {
    format: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Combined hook for format analysis with selected format
 *
 * @param batchId - Batch ID
 * @returns Combined format analysis state
 *
 * @example
 * ```tsx
 * const {
 *   companies,
 *   summary,
 *   selectedFormat,
 *   setSelectedFormat,
 *   isLoading,
 * } = useFormatAnalysisWithSelection('batch-123');
 * ```
 */
export function useFormatAnalysisWithSelection(batchId: string) {
  const [selectedFormatId, setSelectedFormatId] = React.useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = React.useState<FormatTermNode | null>(null);

  const analysisQuery = useFormatAnalysis({ batchId });

  // When a format is selected from the tree, we already have the data
  const handleFormatSelect = (formatId: string, format: FormatTermNode) => {
    setSelectedFormatId(formatId);
    setSelectedFormat(format);
  };

  return {
    ...analysisQuery,
    selectedFormatId,
    selectedFormat,
    selectFormat: handleFormatSelect,
    clearSelection: () => {
      setSelectedFormatId(null);
      setSelectedFormat(null);
    },
  };
}

// Import React for useState
import * as React from 'react';
