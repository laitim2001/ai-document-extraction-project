/**
 * @fileoverview 查表映射編輯器組件
 * @description
 *   用於編輯 LOOKUP 類型轉換的對照表
 *   支援動態新增/刪除對照項
 *
 * @module src/components/features/template-field-mapping
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ============================================================================
// Types
// ============================================================================

interface LookupTableEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  defaultValue?: unknown;
  onDefaultValueChange?: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

interface LookupEntry {
  id: string;
  key: string;
  value: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component LookupTableEditor
 * @description 查表映射編輯器
 */
export function LookupTableEditor({
  value,
  onChange,
  defaultValue,
  onDefaultValueChange,
  disabled = false,
  error,
  className,
}: LookupTableEditorProps) {
  const t = useTranslations('templateFieldMapping');

  // Convert object to array for editing
  const entries = React.useMemo<LookupEntry[]>(() => {
    return Object.entries(value).map(([k, v], i) => ({
      id: `entry-${i}`,
      key: k,
      value: String(v ?? ''),
    }));
  }, [value]);

  // Update single entry
  const handleEntryChange = React.useCallback(
    (id: string, field: 'key' | 'value', newValue: string) => {
      const newEntries = entries.map((e) =>
        e.id === id ? { ...e, [field]: newValue } : e
      );

      // Convert back to object
      const newTable: Record<string, unknown> = {};
      for (const entry of newEntries) {
        if (entry.key) {
          newTable[entry.key] = entry.value;
        }
      }
      onChange(newTable);
    },
    [entries, onChange]
  );

  // Add new entry
  const handleAddEntry = React.useCallback(() => {
    const newTable = { ...value, '': '' };
    onChange(newTable);
  }, [value, onChange]);

  // Remove entry
  const handleRemoveEntry = React.useCallback(
    (key: string) => {
      const newTable = { ...value };
      delete newTable[key];
      onChange(newTable);
    },
    [value, onChange]
  );

  // Check for duplicate keys
  const hasDuplicateKeys = React.useMemo(() => {
    const keys = entries.map((e) => e.key).filter(Boolean);
    return new Set(keys).size !== keys.length;
  }, [entries]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t('lookup.label')}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddEntry}
          disabled={disabled}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t('lookup.addEntry')}
        </Button>
      </div>

      {/* Error message */}
      {(error || hasDuplicateKeys) && (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">
            {error || t('lookup.duplicateKeyError')}
          </span>
        </div>
      )}

      {/* Lookup Table */}
      {entries.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">{t('lookup.sourceValue')}</TableHead>
                <TableHead className="w-[45%]">{t('lookup.targetValue')}</TableHead>
                <TableHead className="w-[10%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={entry.id}>
                  <TableCell className="p-2">
                    <Input
                      value={entry.key}
                      onChange={(e) =>
                        handleEntryChange(entry.id, 'key', e.target.value)
                      }
                      placeholder={t('lookup.keyPlaceholder')}
                      disabled={disabled}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      value={entry.value}
                      onChange={(e) =>
                        handleEntryChange(entry.id, 'value', e.target.value)
                      }
                      placeholder={t('lookup.valuePlaceholder')}
                      disabled={disabled}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveEntry(entry.key)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('lookup.emptyTable')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleAddEntry}
            disabled={disabled}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('lookup.addFirstEntry')}
          </Button>
        </div>
      )}

      {/* Default Value */}
      {onDefaultValueChange && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t('lookup.defaultValue')}
          </Label>
          <Input
            value={String(defaultValue ?? '')}
            onChange={(e) => onDefaultValueChange(e.target.value)}
            placeholder={t('lookup.defaultValuePlaceholder')}
            disabled={disabled}
            className="max-w-[300px]"
          />
          <p className="text-xs text-muted-foreground">
            {t('lookup.defaultValueHelp')}
          </p>
        </div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('lookup.entriesCount', { count: entries.length })}
        </p>
      )}
    </div>
  );
}
