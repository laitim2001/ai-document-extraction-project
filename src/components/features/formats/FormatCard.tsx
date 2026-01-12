'use client';

/**
 * @fileoverview 格式卡片組件
 * @description
 *   顯示單個文件格式的卡片，包含格式資訊、統計數據和配置狀態。
 *   點擊可進入格式詳情頁（Story 16-2）。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.1
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, FileText, Check, X, Files, Hash } from 'lucide-react';
import type { DocumentFormatListItem } from '@/types/document-format';
import {
  DOCUMENT_TYPE_LABELS_ZH,
  DOCUMENT_SUBTYPE_LABELS_ZH,
} from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface FormatCardProps {
  /** 格式資料 */
  format: DocumentFormatListItem;
  /** 自定義類名 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 格式卡片組件
 *
 * @description
 *   顯示文件格式的摘要資訊，包括：
 *   - 格式名稱和類型
 *   - 文件數量和術語數量
 *   - Prompt 和映射配置狀態
 *
 * @param props - 組件屬性
 */
export function FormatCard({ format, className }: FormatCardProps) {
  const router = useRouter();

  // --- Handlers ---
  const handleClick = React.useCallback(() => {
    router.push(`/companies/${format.companyId}/formats/${format.id}`);
  }, [router, format.companyId, format.id]);

  const handleEdit = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(`/companies/${format.companyId}/formats/${format.id}/edit`);
    },
    [router, format.companyId, format.id]
  );

  // --- 計算顯示名稱 ---
  const displayName =
    format.name ||
    `${DOCUMENT_SUBTYPE_LABELS_ZH[format.documentSubtype]} ${DOCUMENT_TYPE_LABELS_ZH[format.documentType]}`;

  const typeLabel = DOCUMENT_TYPE_LABELS_ZH[format.documentType];
  const subtypeLabel = DOCUMENT_SUBTYPE_LABELS_ZH[format.documentSubtype];
  const termCount = format.commonTerms?.length || 0;

  // --- Render ---
  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${className || ''}`}
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          <FileText className="mr-2 inline-block h-4 w-4 text-muted-foreground" />
          <span className="line-clamp-1">{displayName}</span>
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">開啟選單</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleEdit}>編輯</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">刪除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 類型標籤 */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{typeLabel}</Badge>
          <Badge variant="secondary">{subtypeLabel}</Badge>
        </div>

        {/* 統計資訊 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Files className="h-3.5 w-3.5" />
            {format.fileCount} 個文件
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-3.5 w-3.5" />
            {termCount} 個術語
          </span>
        </div>

        {/* 配置狀態 */}
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            Prompt:
            {format.hasPromptConfig ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
          <span className="flex items-center gap-1">
            映射:
            {format.hasMappingConfig ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
