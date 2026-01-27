/**
 * @fileoverview Localized field label hook
 * @description
 *   Resolves DataTemplate field labels based on current locale.
 *   Looks up standardFields translations first, falls back to field.label
 *   for custom (non-standard) fields.
 *
 * @module src/hooks/use-field-label
 * @since Epic 17 - i18n
 * @lastModified 2026-01-27
 *
 * @dependencies
 *   - next-intl (useTranslations)
 *   - messages/{locale}/standardFields.json
 */

'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { DataTemplateField } from '@/types/data-template';

/**
 * Hook to get localized field labels.
 *
 * @description
 *   For standard fields (defined in standardFields.json),
 *   returns the translated label based on current locale.
 *   For custom fields not in the translation files,
 *   falls back to the stored field.label value.
 *
 * @returns A function that takes a DataTemplateField and returns the localized label string.
 *
 * @example
 * ```typescript
 * const getFieldLabel = useFieldLabel();
 * const label = getFieldLabel(field); // "Invoice Number" (en) or "發票號碼" (zh-TW)
 * ```
 */
export function useFieldLabel() {
  const tFields = useTranslations('standardFields');

  return useCallback(
    (field: DataTemplateField): string => {
      try {
        // Attempt to resolve from standardFields translations
        // Key format: fields.{field_name} e.g. "fields.invoice_number"
        const key = `fields.${field.name}` as Parameters<typeof tFields>[0];
        return tFields(key);
      } catch {
        // Not a standard field or translation missing — use stored label
        return field.label;
      }
    },
    [tFields]
  );
}
