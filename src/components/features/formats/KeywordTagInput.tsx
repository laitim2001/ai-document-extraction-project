'use client';

/**
 * @fileoverview 關鍵字標籤輸入組件
 * @description
 *   用於輸入和管理格式識別規則中的關鍵字列表。
 *   支援標籤式輸入，按 Enter 新增，點擊 X 刪除。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.3
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface KeywordTagInputProps {
  /** 關鍵字列表 */
  keywords: string[];
  /** 變更回調 */
  onChange: (keywords: string[]) => void;
  /** 輸入框提示文字 */
  placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 關鍵字標籤輸入組件
 *
 * @description
 *   標籤式輸入組件，用於管理關鍵字列表。
 *   - 按 Enter 新增關鍵字
 *   - 點擊 X 刪除關鍵字
 *   - 自動去重
 *   - 最多 50 個關鍵字
 */
export function KeywordTagInput({
  keywords,
  onChange,
  placeholder = '輸入關鍵字後按 Enter',
}: KeywordTagInputProps) {
  const [inputValue, setInputValue] = React.useState('');

  // --- Handlers ---

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        const trimmed = inputValue.trim();
        // 檢查是否重複且未達上限
        if (!keywords.includes(trimmed) && keywords.length < 50) {
          onChange([...keywords, trimmed]);
        }
        setInputValue('');
      }
    },
    [inputValue, keywords, onChange]
  );

  const removeKeyword = React.useCallback(
    (keyword: string) => {
      onChange(keywords.filter((k) => k !== keyword));
    },
    [keywords, onChange]
  );

  // --- Render ---

  return (
    <div className="space-y-2">
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                title="刪除關鍵字"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={keywords.length >= 50}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>按 Enter 新增關鍵字</span>
        <span>{keywords.length}/50</span>
      </div>
    </div>
  );
}
