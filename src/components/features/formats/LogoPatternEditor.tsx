'use client';

/**
 * @fileoverview Logo 特徵編輯器
 * @description
 *   用於編輯格式識別規則中的 Logo 特徵列表。
 *   支援新增、編輯、刪除 Logo 特徵。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.3
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { LOGO_POSITION_OPTIONS, type LogoPattern, type LogoPosition } from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface LogoPatternEditorProps {
  /** Logo 特徵列表 */
  patterns: LogoPattern[];
  /** 變更回調 */
  onChange: (patterns: LogoPattern[]) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Logo 特徵編輯器
 *
 * @description
 *   編輯格式識別規則中的 Logo 特徵。
 *   支援多個 Logo 特徵，每個包含位置和描述。
 */
export function LogoPatternEditor({ patterns, onChange }: LogoPatternEditorProps) {
  // --- Handlers ---

  const addPattern = React.useCallback(() => {
    onChange([...patterns, { position: 'top-left', description: '' }]);
  }, [patterns, onChange]);

  const removePattern = React.useCallback(
    (index: number) => {
      onChange(patterns.filter((_, i) => i !== index));
    },
    [patterns, onChange]
  );

  const updatePattern = React.useCallback(
    (index: number, updates: Partial<LogoPattern>) => {
      onChange(
        patterns.map((p, i) => (i === index ? { ...p, ...updates } : p))
      );
    },
    [patterns, onChange]
  );

  // --- Render ---

  return (
    <div className="space-y-3">
      {patterns.map((pattern, index) => (
        <div key={index} className="flex gap-2 items-start">
          <Select
            value={pattern.position}
            onValueChange={(value) =>
              updatePattern(index, { position: value as LogoPosition })
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOGO_POSITION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={pattern.description}
            onChange={(e) => updatePattern(index, { description: e.target.value })}
            placeholder="Logo 描述（例如：DHL 黃色 Logo）"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removePattern(index)}
            title="刪除"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {patterns.length < 10 && (
        <Button variant="outline" size="sm" onClick={addPattern}>
          <Plus className="h-4 w-4 mr-2" />
          新增 Logo 特徵
        </Button>
      )}
      {patterns.length >= 10 && (
        <p className="text-xs text-muted-foreground">已達到最大數量（10 個）</p>
      )}
    </div>
  );
}
