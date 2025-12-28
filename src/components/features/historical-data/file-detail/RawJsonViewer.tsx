/**
 * @fileoverview RawJsonViewer - 原始 JSON 查看器
 * @description
 *   顯示文件完整的原始 JSON 資料，包含：
 *   - 可展開/收合的 JSON 樹狀結構
 *   - 語法高亮
 *   - 複製功能
 *
 * @module src/components/features/historical-data/file-detail/RawJsonViewer
 * @since CHANGE-003 - 歷史數據文件詳情頁
 * @lastModified 2025-12-28
 */

'use client';

import * as React from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Code } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HistoricalFileDetail } from '@/hooks/use-historical-file-detail';

// ============================================================
// Types
// ============================================================

interface RawJsonViewerProps {
  data: HistoricalFileDetail;
}

interface JsonNodeProps {
  data: unknown;
  name?: string;
  level?: number;
  defaultExpanded?: boolean;
}

// ============================================================
// JsonNode Component
// ============================================================

/**
 * 遞歸渲染 JSON 節點
 */
function JsonNode({ data, name, level = 0, defaultExpanded = true }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(level < 2 ? defaultExpanded : false);

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);
  const isEmpty = isObject && Object.keys(data as object).length === 0;

  // 渲染基本類型
  if (!isObject) {
    let valueClass = 'text-emerald-600 dark:text-emerald-400'; // string
    let displayValue = JSON.stringify(data);

    if (typeof data === 'number') {
      valueClass = 'text-blue-600 dark:text-blue-400';
      displayValue = String(data);
    } else if (typeof data === 'boolean') {
      valueClass = 'text-purple-600 dark:text-purple-400';
      displayValue = String(data);
    } else if (data === null) {
      valueClass = 'text-gray-500';
      displayValue = 'null';
    }

    return (
      <span className="inline-flex items-center gap-1">
        {name && <span className="text-rose-600 dark:text-rose-400">&quot;{name}&quot;</span>}
        {name && <span className="text-gray-600">: </span>}
        <span className={valueClass}>{displayValue}</span>
      </span>
    );
  }

  // 渲染空對象/數組
  if (isEmpty) {
    return (
      <span className="inline-flex items-center gap-1">
        {name && <span className="text-rose-600 dark:text-rose-400">&quot;{name}&quot;</span>}
        {name && <span className="text-gray-600">: </span>}
        <span className="text-gray-500">{isArray ? '[]' : '{}'}</span>
      </span>
    );
  }

  const entries = Object.entries(data as object);
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  return (
    <div className="inline">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-0.5 hover:bg-muted rounded px-0.5 -ml-0.5"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {name && <span className="text-rose-600 dark:text-rose-400">&quot;{name}&quot;</span>}
        {name && <span className="text-gray-600">: </span>}
        <span className="text-gray-600">{bracketOpen}</span>
        {!isExpanded && (
          <>
            <span className="text-gray-400 mx-1">...</span>
            <span className="text-gray-600">{bracketClose}</span>
            <span className="text-gray-400 text-xs ml-1">({entries.length})</span>
          </>
        )}
      </button>

      {isExpanded && (
        <>
          <div className="ml-4 border-l border-gray-200 dark:border-gray-700 pl-2">
            {entries.map(([key, value], index) => (
              <div key={key} className="py-0.5">
                <JsonNode
                  data={value}
                  name={isArray ? undefined : key}
                  level={level + 1}
                  defaultExpanded={level < 1}
                />
                {index < entries.length - 1 && <span className="text-gray-600">,</span>}
              </div>
            ))}
          </div>
          <span className="text-gray-600">{bracketClose}</span>
        </>
      )}
    </div>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * @component RawJsonViewer
 * @description 顯示原始 JSON 資料的查看器組件
 */
export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="h-4 w-4" />
            原始 JSON
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={cn(copied && 'text-green-600')}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-3 w-3" />
                已複製
              </>
            ) : (
              <>
                <Copy className="mr-2 h-3 w-3" />
                複製
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[600px] overflow-auto rounded-lg bg-gray-50 p-4 font-mono text-sm dark:bg-gray-900">
          <JsonNode data={data} defaultExpanded={true} />
        </div>
      </CardContent>
    </Card>
  );
}
