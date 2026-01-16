/**
 * @fileoverview Term Analysis Admin Page
 * @description
 *   Admin interface for term aggregation and classification:
 *   - View aggregated terms from historical processing
 *   - Filter by batch, company, frequency
 *   - Trigger AI classification for selected terms
 *   - Create mapping rules from terms
 *
 * @module src/app/(dashboard)/admin/term-analysis
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 */

'use client';

import * as React from 'react';
import { Bot, Sparkles, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TermFilters, TermTable } from '@/components/features/term-analysis';
import {
  useAggregatedTerms,
  useClassifyTerms,
  type TermAnalysisFilters,
  type AggregatedTerm,
  type TermClassification,
} from '@/hooks/use-term-analysis';

// ============================================================================
// Page Component
// ============================================================================

export default function TermAnalysisPage() {
  // --- State ---
  const [filters, setFilters] = React.useState<TermAnalysisFilters>({});
  const [selectedTerms, setSelectedTerms] = React.useState<Set<string>>(new Set());
  const [classifications, setClassifications] = React.useState<
    Record<string, TermClassification>
  >({});

  // --- Queries ---
  const {
    data: aggregationResult,
    isLoading: isLoadingTerms,
    error: termsError,
    refetch,
  } = useAggregatedTerms(filters);

  const {
    mutate: classifyTerms,
    isPending: isClassifying,
  } = useClassifyTerms();

  // --- Derived State ---
  const terms = aggregationResult?.terms ?? [];
  // Calculate statistics from the aggregation result
  const stats = aggregationResult
    ? {
        uniqueTerms: aggregationResult.totalTerms,
        totalOccurrences: aggregationResult.terms.reduce(
          (sum, t) => sum + t.frequency,
          0
        ),
        companiesCount: new Set(
          aggregationResult.terms.flatMap((t) =>
            t.companyDistribution.map((c) => c.companyId)
          )
        ).size,
        batchesCount: aggregationResult.totalDocuments,
      }
    : null;
  const hasSelectedTerms = selectedTerms.size > 0;
  const unclassifiedSelectedCount = [...selectedTerms].filter(
    (t) => !classifications[t]
  ).length;

  // --- Handlers ---

  const handleClassifySelected = React.useCallback(() => {
    const termsToClassify = [...selectedTerms].filter((t) => !classifications[t]);
    if (termsToClassify.length === 0) return;

    classifyTerms(termsToClassify, {
      onSuccess: (result) => {
        // Merge new classifications with existing
        // Convert array to Record<string, TermClassification>
        const newClassifications = result.classifications.reduce(
          (acc, classification) => {
            acc[classification.term] = classification;
            return acc;
          },
          {} as Record<string, TermClassification>
        );
        setClassifications((prev) => ({
          ...prev,
          ...newClassifications,
        }));
      },
    });
  }, [selectedTerms, classifications, classifyTerms]);

  const handleCreateRule = React.useCallback(
    (term: AggregatedTerm, category?: string) => {
      // Navigate to rule creation with pre-filled data
      const params = new URLSearchParams({
        term: term.term,
        ...(category && { category }),
        frequency: term.frequency.toString(),
      });
      window.location.href = `/admin/rules/new?${params.toString()}`;
    },
    []
  );

  const handleRefresh = React.useCallback(() => {
    setClassifications({});
    refetch();
  }, [refetch]);

  // --- Render ---

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">術語分析</h1>
          <p className="text-muted-foreground">
            分析歷史處理結果中的收費術語，並建立映射規則
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          重新整理
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>唯一術語數</CardDescription>
              <CardTitle className="text-2xl">
                {stats.uniqueTerms.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>總出現次數</CardDescription>
              <CardTitle className="text-2xl">
                {stats.totalOccurrences.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>涉及公司數</CardDescription>
              <CardTitle className="text-2xl">
                {stats.companiesCount.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>涉及批次數</CardDescription>
              <CardTitle className="text-2xl">
                {stats.batchesCount.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">篩選條件</CardTitle>
        </CardHeader>
        <CardContent>
          <TermFilters
            filters={filters}
            onFiltersChange={setFilters}
            batches={[]}
            companies={[]}
          />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {termsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            載入術語資料時發生錯誤：
            {termsError instanceof Error ? termsError.message : '未知錯誤'}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            已選取 {selectedTerms.size} 個術語
          </Badge>
          {hasSelectedTerms && unclassifiedSelectedCount > 0 && (
            <Button
              onClick={handleClassifySelected}
              disabled={isClassifying}
              size="sm"
            >
              {isClassifying ? (
                <>
                  <Bot className="h-4 w-4 mr-2 animate-pulse" />
                  AI 分類中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI 分類 ({unclassifiedSelectedCount})
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasSelectedTerms && (
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              批量建立規則
            </Button>
          )}
        </div>
      </div>

      {/* Terms Table */}
      <Card>
        <CardContent className="pt-6">
          <TermTable
            terms={terms}
            classifications={classifications}
            selectedTerms={selectedTerms}
            onSelectionChange={setSelectedTerms}
            onCreateRule={handleCreateRule}
            isLoading={isLoadingTerms}
          />
        </CardContent>
      </Card>

      {/* AI Classification Info */}
      <Alert>
        <Bot className="h-4 w-4" />
        <AlertDescription>
          AI 分類使用 GPT-5.2 模型分析術語，並根據物流行業標準費用類別提供建議。
          分類信心度 ≥90% 為高信心（自動通過），70-89% 為中信心（快速審核），&lt;70% 為低信心（完整審核）。
        </AlertDescription>
      </Alert>
    </div>
  );
}
