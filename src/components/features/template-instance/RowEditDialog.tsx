'use client';

/**
 * @fileoverview 行編輯對話框組件
 * @description
 *   提供對話框介面讓用戶編輯數據行的欄位值
 *
 * @module src/components/features/template-instance/RowEditDialog
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateRow } from '@/hooks/use-template-instances';
import { toast } from 'sonner';
import type { DataTemplateField } from '@/types/data-template';
import type { TemplateInstanceRow } from '@/types/template-instance';

// ============================================================================
// Types
// ============================================================================

interface RowEditDialogProps {
  instanceId: string;
  row: TemplateInstanceRow;
  templateFields: DataTemplateField[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 行編輯對話框組件
 */
export function RowEditDialog({
  instanceId,
  row,
  templateFields,
  open,
  onOpenChange,
  onSuccess,
}: RowEditDialogProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');

  // --- State ---
  const [fieldValues, setFieldValues] = React.useState<Record<string, unknown>>(
    row.fieldValues
  );

  // Reset field values when row changes
  React.useEffect(() => {
    setFieldValues(row.fieldValues);
  }, [row]);

  const { mutate: updateRow, isPending } = useUpdateRow(instanceId);

  // Sorted fields
  const sortedFields = React.useMemo(() => {
    return [...templateFields].sort((a, b) => a.order - b.order);
  }, [templateFields]);

  // Validation errors
  const errors = row.validationErrors ?? {};
  const hasErrors = Object.keys(errors).length > 0;

  // --- Handlers ---
  const handleFieldChange = React.useCallback((fieldName: string, value: unknown) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  const handleSubmit = React.useCallback(() => {
    updateRow(
      {
        rowId: row.id,
        input: { fieldValues },
      },
      {
        onSuccess: () => {
          toast.success(t('toast.rowUpdateSuccess'));
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(t('toast.rowUpdateError'), {
            description: error.message,
          });
        },
      }
    );
  }, [updateRow, row.id, fieldValues, t, onSuccess]);

  // --- Render field input ---
  const renderFieldInput = (field: DataTemplateField) => {
    const value = fieldValues[field.name];
    const fieldError = errors[field.name];

    switch (field.dataType) {
      case 'boolean':
        return (
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
          />
        );

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) =>
              handleFieldChange(
                field.name,
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
            className={fieldError ? 'border-red-500' : ''}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value || null)}
            className={fieldError ? 'border-red-500' : ''}
          />
        );

      default:
        return (
          <Input
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value || null)}
            className={fieldError ? 'border-red-500' : ''}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('editDialog.title')}</DialogTitle>
          <DialogDescription>{t('editDialog.description')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Row Key (read-only) */}
            <div className="space-y-2">
              <Label>{t('editDialog.rowKeyLabel')}</Label>
              <Input value={row.rowKey} disabled className="bg-muted" />
            </div>

            {/* Validation errors summary */}
            {hasErrors && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">{t('editDialog.validationErrors')}</p>
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {Object.entries(errors).map(([fieldName, error]) => {
                      const field = templateFields.find((f) => f.name === fieldName);
                      return (
                        <li key={fieldName}>
                          <strong>{field?.label ?? fieldName}:</strong> {error}
                        </li>
                      );
                    })}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasErrors && row.status === 'VALID' && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-600">
                  {t('editDialog.noErrors')}
                </AlertDescription>
              </Alert>
            )}

            {/* Field values section */}
            <div className="space-y-4 pt-2">
              <Label className="text-base font-medium">{t('editDialog.fieldsSection')}</Label>
              {sortedFields.map((field) => {
                const fieldError = errors[field.name];

                return (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      {field.label}
                      {field.isRequired && <span className="text-red-500">*</span>}
                    </Label>
                    {renderFieldInput(field)}
                    {fieldError && (
                      <p className="text-sm text-red-500">{fieldError}</p>
                    )}
                    {field.description && !fieldError && (
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t('editDialog.saving') : t('editDialog.saveAndValidate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
