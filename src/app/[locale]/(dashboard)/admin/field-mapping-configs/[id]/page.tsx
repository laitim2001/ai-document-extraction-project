/**
 * @fileoverview Field Mapping 配置編輯頁
 * @description
 *   提供編輯現有 Field Mapping 配置的介面：
 *   - 載入現有配置和規則
 *   - 使用 MappingConfigPanel 進行編輯
 *   - 保存時同步規則變更（新增/更新/刪除）
 *   - 支援樂觀鎖版本控制
 *
 * @module src/app/(dashboard)/admin/field-mapping-configs/[id]
 * @since Epic 13 - Story 13.7
 * @lastModified 2026-01-07
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MappingConfigPanel } from '@/components/features/mapping-config';
import {
  useFieldMappingConfig,
  useUpdateFieldMappingConfig,
  transformToVisualConfig,
  type FieldMappingRuleDTO,
} from '@/hooks/use-field-mapping-configs';
import type {
  VisualMappingConfig,
  VisualMappingRule,
  SourceFieldDefinition,
  TargetFieldDefinition,
  ConfigScope,
} from '@/types/field-mapping';

// ============================================================================
// Constants - Standard Field Definitions
// ============================================================================

/**
 * 標準來源欄位定義
 * 這些是發票文件中常見的提取欄位
 */
const STANDARD_SOURCE_FIELDS: SourceFieldDefinition[] = [
  // Invoice 基本資訊
  { id: 'src-invoice-number', fieldName: 'InvoiceNumber', displayName: '發票號碼', category: 'invoice', sampleValue: 'INV-2024-001' },
  { id: 'src-invoice-date', fieldName: 'InvoiceDate', displayName: '發票日期', category: 'invoice', sampleValue: '2024-01-15' },
  { id: 'src-due-date', fieldName: 'DueDate', displayName: '到期日', category: 'invoice', sampleValue: '2024-02-15' },
  { id: 'src-po-number', fieldName: 'PurchaseOrderNumber', displayName: 'PO 號碼', category: 'invoice', sampleValue: 'PO-2024-001' },

  // 金額相關
  { id: 'src-subtotal', fieldName: 'SubTotal', displayName: '小計', category: 'amounts', sampleValue: '1000.00' },
  { id: 'src-tax-amount', fieldName: 'TaxAmount', displayName: '稅額', category: 'amounts', sampleValue: '50.00' },
  { id: 'src-total-amount', fieldName: 'TotalAmount', displayName: '總金額', category: 'amounts', sampleValue: '1050.00' },
  { id: 'src-currency', fieldName: 'Currency', displayName: '幣別', category: 'amounts', sampleValue: 'USD' },

  // 供應商資訊
  { id: 'src-vendor-name', fieldName: 'VendorName', displayName: '供應商名稱', category: 'vendor', sampleValue: 'ABC Company Ltd' },
  { id: 'src-vendor-address', fieldName: 'VendorAddress', displayName: '供應商地址', category: 'vendor', sampleValue: '123 Business St' },
  { id: 'src-vendor-tax-id', fieldName: 'VendorTaxId', displayName: '供應商統編', category: 'vendor', sampleValue: '12345678' },

  // 客戶資訊
  { id: 'src-customer-name', fieldName: 'CustomerName', displayName: '客戶名稱', category: 'customer', sampleValue: 'XYZ Corp' },
  { id: 'src-customer-address', fieldName: 'CustomerAddress', displayName: '客戶地址', category: 'customer', sampleValue: '456 Client Ave' },

  // 運輸相關
  { id: 'src-awb', fieldName: 'AWBNumber', displayName: 'AWB 號碼', category: 'shipping', sampleValue: '123-45678901' },
  { id: 'src-mawb', fieldName: 'MAWBNumber', displayName: 'MAWB 號碼', category: 'shipping', sampleValue: '123-45678901' },
  { id: 'src-hawb', fieldName: 'HAWBNumber', displayName: 'HAWB 號碼', category: 'shipping', sampleValue: 'HAWB-001' },
  { id: 'src-shipment-date', fieldName: 'ShipmentDate', displayName: '出貨日期', category: 'shipping', sampleValue: '2024-01-10' },
  { id: 'src-origin', fieldName: 'Origin', displayName: '起運地', category: 'shipping', sampleValue: 'HKG' },
  { id: 'src-destination', fieldName: 'Destination', displayName: '目的地', category: 'shipping', sampleValue: 'LAX' },
  { id: 'src-weight', fieldName: 'Weight', displayName: '重量', category: 'shipping', sampleValue: '150.5' },
  { id: 'src-pieces', fieldName: 'Pieces', displayName: '件數', category: 'shipping', sampleValue: '10' },

  // Line Items
  { id: 'src-line-description', fieldName: 'LineDescription', displayName: '項目描述', category: 'lineItem', sampleValue: 'Freight Service' },
  { id: 'src-line-quantity', fieldName: 'LineQuantity', displayName: '數量', category: 'lineItem', sampleValue: '1' },
  { id: 'src-line-unit-price', fieldName: 'LineUnitPrice', displayName: '單價', category: 'lineItem', sampleValue: '500.00' },
  { id: 'src-line-amount', fieldName: 'LineAmount', displayName: '項目金額', category: 'lineItem', sampleValue: '500.00' },
];

/**
 * 標準目標欄位定義
 * 這些是系統期望的標準化輸出欄位
 */
const STANDARD_TARGET_FIELDS: TargetFieldDefinition[] = [
  // Invoice 基本資訊
  { id: 'tgt-invoice-number', fieldName: 'invoiceNumber', displayName: 'Invoice Number', category: 'invoice', dataType: 'string', required: true },
  { id: 'tgt-invoice-date', fieldName: 'invoiceDate', displayName: 'Invoice Date', category: 'invoice', dataType: 'date', required: true },
  { id: 'tgt-due-date', fieldName: 'dueDate', displayName: 'Due Date', category: 'invoice', dataType: 'date', required: false },
  { id: 'tgt-po-number', fieldName: 'poNumber', displayName: 'PO Number', category: 'invoice', dataType: 'string', required: false },

  // 金額相關
  { id: 'tgt-subtotal', fieldName: 'subtotal', displayName: 'Subtotal', category: 'amounts', dataType: 'number', required: false },
  { id: 'tgt-tax-amount', fieldName: 'taxAmount', displayName: 'Tax Amount', category: 'amounts', dataType: 'number', required: false },
  { id: 'tgt-total-amount', fieldName: 'totalAmount', displayName: 'Total Amount', category: 'amounts', dataType: 'number', required: true },
  { id: 'tgt-currency', fieldName: 'currency', displayName: 'Currency', category: 'amounts', dataType: 'string', required: true },

  // 供應商資訊
  { id: 'tgt-vendor-name', fieldName: 'vendorName', displayName: 'Vendor Name', category: 'vendor', dataType: 'string', required: true },
  { id: 'tgt-vendor-address', fieldName: 'vendorAddress', displayName: 'Vendor Address', category: 'vendor', dataType: 'string', required: false },
  { id: 'tgt-vendor-tax-id', fieldName: 'vendorTaxId', displayName: 'Vendor Tax ID', category: 'vendor', dataType: 'string', required: false },

  // 客戶資訊
  { id: 'tgt-customer-name', fieldName: 'customerName', displayName: 'Customer Name', category: 'customer', dataType: 'string', required: false },
  { id: 'tgt-customer-address', fieldName: 'customerAddress', displayName: 'Customer Address', category: 'customer', dataType: 'string', required: false },

  // 運輸相關
  { id: 'tgt-awb-number', fieldName: 'awbNumber', displayName: 'AWB Number', category: 'shipping', dataType: 'string', required: false },
  { id: 'tgt-mawb-number', fieldName: 'mawbNumber', displayName: 'MAWB Number', category: 'shipping', dataType: 'string', required: false },
  { id: 'tgt-hawb-number', fieldName: 'hawbNumber', displayName: 'HAWB Number', category: 'shipping', dataType: 'string', required: false },
  { id: 'tgt-shipment-date', fieldName: 'shipmentDate', displayName: 'Shipment Date', category: 'shipping', dataType: 'date', required: false },
  { id: 'tgt-origin', fieldName: 'origin', displayName: 'Origin', category: 'shipping', dataType: 'string', required: false },
  { id: 'tgt-destination', fieldName: 'destination', displayName: 'Destination', category: 'shipping', dataType: 'string', required: false },
  { id: 'tgt-weight', fieldName: 'weight', displayName: 'Weight (kg)', category: 'shipping', dataType: 'number', required: false },
  { id: 'tgt-pieces', fieldName: 'pieces', displayName: 'Pieces', category: 'shipping', dataType: 'number', required: false },

  // Line Items
  { id: 'tgt-line-description', fieldName: 'lineDescription', displayName: 'Line Description', category: 'lineItem', dataType: 'string', required: false },
  { id: 'tgt-line-quantity', fieldName: 'lineQuantity', displayName: 'Line Quantity', category: 'lineItem', dataType: 'number', required: false },
  { id: 'tgt-line-unit-price', fieldName: 'lineUnitPrice', displayName: 'Line Unit Price', category: 'lineItem', dataType: 'number', required: false },
  { id: 'tgt-line-amount', fieldName: 'lineAmount', displayName: 'Line Amount', category: 'lineItem', dataType: 'number', required: false },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * 比較規則變更，計算需要新增、更新、刪除的規則
 */
function compareRules(
  originalRules: FieldMappingRuleDTO[],
  newRules: VisualMappingRule[]
): {
  toCreate: VisualMappingRule[];
  toUpdate: Array<{ id: string; rule: VisualMappingRule }>;
  toDelete: string[];
} {
  const originalIds = new Set(originalRules.map((r) => r.id));
  const newIds = new Set(newRules.filter((r) => !r.id.startsWith('rule_')).map((r) => r.id));

  // Rules to create: new rules without existing IDs (generated IDs start with 'rule_')
  const toCreate = newRules.filter((r) => r.id.startsWith('rule_'));

  // Rules to update: rules that exist in both sets
  const toUpdate = newRules
    .filter((r) => !r.id.startsWith('rule_') && originalIds.has(r.id))
    .map((rule) => ({ id: rule.id, rule }));

  // Rules to delete: original rules not in new set
  const toDelete = originalRules
    .filter((r) => !newIds.has(r.id) && !newRules.some((nr) => nr.id === r.id))
    .map((r) => r.id);

  return { toCreate, toUpdate, toDelete };
}

// ============================================================================
// Loading Component
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24" />
        <Separator orientation="vertical" className="h-6" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function EditFieldMappingConfigPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const configId = params.id as string;

  // --- Queries ---
  const {
    data: configData,
    isLoading,
    error,
  } = useFieldMappingConfig(configId);

  const updateConfigMutation = useUpdateFieldMappingConfig(configId);

  // --- State ---
  const [isSaving, setIsSaving] = React.useState(false);

  // --- Derived State ---
  const config = configData?.data;
  const visualConfig = React.useMemo(() => {
    if (!config) return null;
    return transformToVisualConfig(config);
  }, [config]);

  // --- Handlers ---
  const handleSave = React.useCallback(
    async (updatedConfig: VisualMappingConfig) => {
      if (!config) return;

      setIsSaving(true);

      try {
        // Step 1: Update config metadata
        await updateConfigMutation.mutateAsync({
          name: updatedConfig.name,
          description: updatedConfig.description || null,
          scope: updatedConfig.scope,
          companyId: updatedConfig.companyId || null,
          documentFormatId: updatedConfig.documentFormatId || null,
          isActive: updatedConfig.isActive,
          version: config.version,
        });

        // Step 2: Sync rules
        const { toCreate, toUpdate, toDelete } = compareRules(
          config.rules,
          updatedConfig.rules
        );

        // Delete removed rules
        for (const ruleId of toDelete) {
          await fetch(`/api/v1/field-mapping-configs/${configId}/rules/${ruleId}`, {
            method: 'DELETE',
          });
        }

        // Update existing rules
        for (const { id, rule } of toUpdate) {
          await fetch(`/api/v1/field-mapping-configs/${configId}/rules/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceFields: rule.sourceFields,
              targetField: rule.targetField,
              transformType: rule.transformType,
              transformParams: rule.transformParams,
              priority: rule.priority,
              isActive: rule.isActive,
              description: rule.description,
            }),
          });
        }

        // Create new rules
        for (const rule of toCreate) {
          await fetch(`/api/v1/field-mapping-configs/${configId}/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceFields: rule.sourceFields,
              targetField: rule.targetField,
              transformType: rule.transformType,
              transformParams: rule.transformParams,
              priority: rule.priority,
              isActive: rule.isActive,
              description: rule.description,
            }),
          });
        }

        // Step 3: Reorder rules if needed
        const finalRuleIds = updatedConfig.rules
          .filter((r) => !r.id.startsWith('rule_'))
          .map((r) => r.id);

        if (finalRuleIds.length > 0) {
          await fetch(`/api/v1/field-mapping-configs/${configId}/rules/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruleIds: finalRuleIds }),
          });
        }

        toast({
          title: '儲存成功',
          description: `已更新配置「${updatedConfig.name}」`,
        });

        // Navigate back to list
        router.push('/admin/field-mapping-configs');
      } catch (err) {
        toast({
          variant: 'destructive',
          title: '儲存失敗',
          description: err instanceof Error ? err.message : '未知錯誤',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [config, configId, updateConfigMutation, toast, router]
  );

  const handleScopeChange = React.useCallback(
    (scope: ConfigScope, companyId: string | null, formatId: string | null) => {
      console.log('Scope changed:', { scope, companyId, formatId });
    },
    []
  );

  // --- Loading State ---
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // --- Error State ---
  if (error || !visualConfig) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/field-mapping-configs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : '載入配置失敗，配置可能不存在'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/field-mapping-configs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            編輯欄位映射配置
          </h1>
          <p className="text-muted-foreground">
            {visualConfig.name}
          </p>
        </div>
      </div>

      {/* Config Panel */}
      <MappingConfigPanel
        initialConfig={visualConfig}
        sourceFields={STANDARD_SOURCE_FIELDS}
        targetFields={STANDARD_TARGET_FIELDS}
        onSave={handleSave}
        onScopeChange={handleScopeChange}
        isSaving={isSaving}
      />
    </div>
  );
}
