'use client';

/**
 * @fileoverview 格式常見術語表格組件
 * @description
 *   顯示格式的常見術語列表，支援搜尋和分頁。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-31
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Hash, ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FormatTermsTableProps {
  /** 術語列表 */
  terms: string[];
}

// ============================================================================
// Constants
// ============================================================================

const ITEMS_PER_PAGE = 20;

// ============================================================================
// Component
// ============================================================================

/**
 * 格式常見術語表格組件
 *
 * @description
 *   顯示格式的常見術語，支援：
 *   - 搜尋篩選
 *   - 分頁顯示
 *   - 頻率排序（術語已預排序）
 *
 * @param props - 組件屬性
 */
export function FormatTermsTable({ terms }: FormatTermsTableProps) {
  const t = useTranslations('formats.detail.terms');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  // 篩選術語
  const filteredTerms = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return terms;
    }
    const query = searchQuery.toLowerCase();
    return terms.filter((term) => term.toLowerCase().includes(query));
  }, [terms, searchQuery]);

  // 計算分頁
  const totalPages = Math.ceil(filteredTerms.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTerms = filteredTerms.slice(startIndex, endIndex);

  // 重置頁碼當搜尋改變時
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // --- 空狀態 ---
  if (terms.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Hash className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">{t('emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('emptyDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t('title')}
          <Badge variant="secondary" className="ml-2">
            {terms.length}
          </Badge>
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* 術語列表 */}
        {filteredTerms.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 min-h-[200px]">
              {paginatedTerms.map((term, index) => (
                <Badge
                  key={`${term}-${index}`}
                  variant="outline"
                  className="px-3 py-1.5"
                >
                  {term}
                </Badge>
              ))}
            </div>

            {/* 分頁控制 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {t('showing', {
                    start: startIndex + 1,
                    end: Math.min(endIndex, filteredTerms.length),
                    total: filteredTerms.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('previous')}
                  </Button>
                  <span className="text-sm">
                    {t('page', { page: currentPage, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {t('next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              {t('noResults', { query: searchQuery })}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-2"
            >
              {t('clearSearch')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
