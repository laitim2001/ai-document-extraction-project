/**
 * @fileoverview Field Mapping 配置新增頁
 * @description
 *   提供建立新 Field Mapping 配置的介面：
 *   - 選擇配置範圍（GLOBAL/COMPANY/FORMAT）
 *   - 設定映射規則
 *   - 保存配置和規則
 *
 * @module src/app/(dashboard)/admin/field-mapping-configs/new
 * @since Epic 13 - Story 13.7
 * @lastModified 2026-01-07
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MappingConfigPanel } from '@/components/features/mapping-config';
import {
  useCreateFieldMappingConfig,
  useCreateFieldMappingRule,
} from '@/hooks/use-field-mapping-configs';
import type {
  VisualMappingConfig,
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
// Page Component
// ============================================================================

export default function NewFieldMappingConfigPage() {
  const t = useTranslations('fieldMappingConfig');
  const router = useRouter();
  const { toast } = useToast();

  // --- Mutations ---
  const createConfigMutation = useCreateFieldMappingConfig();
  const createRuleMutation = useCreateFieldMappingRule('');

  // --- State ---
  const [isSaving, setIsSaving] = React.useState(false);

  // --- Handlers ---
  const handleSave = React.useCallback(
    async (config: VisualMappingConfig) => {
      setIsSaving(true);

      try {
        // Step 1: Create the config
        const configResult = await createConfigMutation.mutateAsync({
          name: config.name || '新配置',
          description: config.description || undefined,
          scope: config.scope,
          companyId: config.companyId || null,
          documentFormatId: config.documentFormatId || null,
          isActive: config.isActive,
        });

        const newConfigId = configResult.data.id;

        // Step 2: Create rules if any
        if (config.rules.length > 0) {
          // Create rules sequentially to maintain order
          for (let i = 0; i < config.rules.length; i++) {
            const rule = config.rules[i];
            await fetch(`/api/v1/field-mapping-configs/${newConfigId}/rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceFields: rule.sourceFields,
                targetField: rule.targetField,
                transformType: rule.transformType,
                transformParams: rule.transformParams,
                priority: i + 1,
                isActive: rule.isActive,
                description: rule.description,
              }),
            });
          }
        }

        toast({
          title: t('toast.createSuccess.title'),
          description: t('toast.createSuccess.description', { name: configResult.data.name }),
        });

        // Navigate back to list
        router.push('/admin/field-mapping-configs');
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('toast.createError.title'),
          description: err instanceof Error ? err.message : t('error.unknown'),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [createConfigMutation, toast, router]
  );

  const handleScopeChange = React.useCallback(
    (scope: ConfigScope, companyId: string | null, formatId: string | null) => {
      // 可以在這裡根據範圍變更載入相關資料
      console.log('Scope changed:', { scope, companyId, formatId });
    },
    []
  );

  // --- Render ---
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/field-mapping-configs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('page.backToList')}
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.newTitle')}</h1>
          <p className="text-muted-foreground">
            {t('page.newDescription')}
          </p>
        </div>
      </div>

      {/* Config Panel */}
      <MappingConfigPanel
        sourceFields={STANDARD_SOURCE_FIELDS}
        targetFields={STANDARD_TARGET_FIELDS}
        onSave={handleSave}
        onScopeChange={handleScopeChange}
        isSaving={isSaving}
      />
    </div>
  );
}
