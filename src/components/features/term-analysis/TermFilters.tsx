/**
 * @fileoverview Term Analysis Filter Bar
 * @description
 *   Filter controls for term aggregation:
 *   - Batch selection
 *   - Company filter
 *   - Date range
 *   - Minimum frequency
 *
 * @module src/components/features/term-analysis/TermFilters
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 *
 * @related
 *   - src/hooks/use-term-analysis.ts - 術語分析數據 Hook
 *   - src/components/features/term-analysis/TermTable.tsx - 術語表格組件
 */

'use client';

import * as React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TermAnalysisFilters } from '@/hooks/use-term-analysis';

// ============================================================================
// Types
// ============================================================================

interface TermFiltersProps {
  /** Current filter values */
  filters: TermAnalysisFilters;
  /** Filter change handler */
  onFiltersChange: (filters: TermAnalysisFilters) => void;
  /** Available batches for selection */
  batches?: Array<{ id: string; name: string }>;
  /** Available companies for selection */
  companies?: Array<{ id: string; name: string }>;
}

// ============================================================================
// Component
// ============================================================================

export function TermFilters({
  filters,
  onFiltersChange,
  batches = [],
  companies = [],
}: TermFiltersProps) {
  // --- Handlers ---

  const handleFilterChange = React.useCallback(
    (key: keyof TermAnalysisFilters, value: string | number | undefined) => {
      onFiltersChange({
        ...filters,
        [key]: value === '' ? undefined : value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleClearFilters = React.useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== ''
  );

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Batch Filter */}
        <div className="space-y-2">
          <Label htmlFor="batch-filter">Batch</Label>
          <Select
            value={filters.batchId || ''}
            onValueChange={(value) => handleFilterChange('batchId', value)}
          >
            <SelectTrigger id="batch-filter">
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All batches</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company Filter */}
        <div className="space-y-2">
          <Label htmlFor="company-filter">Company</Label>
          <Select
            value={filters.companyId || ''}
            onValueChange={(value) => handleFilterChange('companyId', value)}
          >
            <SelectTrigger id="company-filter">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Min Frequency Filter */}
        <div className="space-y-2">
          <Label htmlFor="min-frequency">Min. Frequency</Label>
          <Input
            id="min-frequency"
            type="number"
            min={1}
            placeholder="1"
            value={filters.minFrequency || ''}
            onChange={(e) =>
              handleFilterChange(
                'minFrequency',
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
          />
        </div>

        {/* Result Limit */}
        <div className="space-y-2">
          <Label htmlFor="limit">Result Limit</Label>
          <Select
            value={filters.limit?.toString() || ''}
            onValueChange={(value) =>
              handleFilterChange('limit', value ? parseInt(value) : undefined)
            }
          >
            <SelectTrigger id="limit">
              <SelectValue placeholder="500 (default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">500 (default)</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="1000">1000</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
