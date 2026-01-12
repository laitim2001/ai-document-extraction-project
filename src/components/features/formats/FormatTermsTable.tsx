'use client';

/**
 * @fileoverview 格式常見術語表格組件
 * @description
 *   顯示格式的常見術語列表，支援搜尋和分頁。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import * as React from 'react';
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
          <h3 className="text-lg font-medium mb-2">尚無常見術語</h3>
          <p className="text-sm text-muted-foreground">
            處理更多文件後，系統會自動識別並記錄常見術語。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          常見術語
          <Badge variant="secondary" className="ml-2">
            {terms.length}
          </Badge>
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋術語..."
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
                  顯示 {startIndex + 1} - {Math.min(endIndex, filteredTerms.length)} 共{' '}
                  {filteredTerms.length} 個術語
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一頁
                  </Button>
                  <span className="text-sm">
                    第 {currentPage} / {totalPages} 頁
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一頁
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              找不到符合「{searchQuery}」的術語
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-2"
            >
              清除搜尋
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
