'use client';

/**
 * @fileoverview 格式基本資訊組件
 * @description
 *   顯示格式的基本資訊，包含：
 *   - 格式名稱、類型、子類型
 *   - 文件數量
 *   - 格式特徵
 *   - 時間資訊
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { formatDateTime as formatDateTimeI18n } from '@/lib/i18n-date';
import type { Locale } from '@/i18n/config';
import type { DocumentFormatDetail, DocumentFormatFeatures, DocumentType, DocumentSubtype } from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface FormatBasicInfoProps {
  /** 格式詳情 */
  format: DocumentFormatDetail;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 格式化日期時間（使用 locale）
 */
function formatDateTime(dateString: string, locale: string): string {
  return formatDateTimeI18n(dateString, locale as Locale);
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 資訊行
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * 布林值顯示
 */
function BooleanDisplay({ value, trueLabel, falseLabel }: {
  value: boolean | undefined;
  trueLabel: string;
  falseLabel: string;
}) {
  if (value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  return value ? (
    <span className="flex items-center gap-1 text-green-600">
      <Check className="h-4 w-4" />
      {trueLabel}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-muted-foreground">
      <X className="h-4 w-4" />
      {falseLabel}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 格式基本資訊組件
 *
 * @description
 *   以卡片形式顯示格式的基本資訊和特徵。
 *
 * @param props - 組件屬性
 */
export function FormatBasicInfo({ format }: FormatBasicInfoProps) {
  const t = useTranslations('formats');
  const locale = useLocale();

  const features: DocumentFormatFeatures = format.features || {
    hasLineItems: false,
    hasHeaderLogo: false,
  };

  // 獲取翻譯後的類型標籤
  const getTypeLabel = (type: DocumentType) => t(`documentTypes.${type}`);
  const getSubtypeLabel = (subtype: DocumentSubtype) => t(`documentSubtypes.${subtype}`);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 格式資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.basicInfo.formatInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label={t('detail.basicInfo.formatName')} value={format.name || '-'} />
          <InfoRow
            label={t('detail.basicInfo.documentType')}
            value={getTypeLabel(format.documentType)}
          />
          <InfoRow
            label={t('detail.basicInfo.documentSubtype')}
            value={getSubtypeLabel(format.documentSubtype)}
          />
          <InfoRow label={t('detail.basicInfo.fileCount')} value={t('detail.basicInfo.fileUnit', { count: format.fileCount })} />
          <InfoRow label={t('detail.basicInfo.termCount')} value={t('detail.basicInfo.termUnit', { count: format.commonTerms.length })} />
        </CardContent>
      </Card>

      {/* 格式特徵卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.basicInfo.features')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">{t('detail.basicInfo.hasLineItems')}</span>
            <BooleanDisplay value={features.hasLineItems} trueLabel={t('detail.basicInfo.yes')} falseLabel={t('detail.basicInfo.no')} />
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">{t('detail.basicInfo.hasHeaderLogo')}</span>
            <BooleanDisplay value={features.hasHeaderLogo} trueLabel={t('detail.basicInfo.yes')} falseLabel={t('detail.basicInfo.no')} />
          </div>
          <InfoRow label={t('detail.basicInfo.currency')} value={features.currency || '-'} />
          <InfoRow label={t('detail.basicInfo.language')} value={features.language || '-'} />
          {features.layoutPattern && (
            <InfoRow label={t('detail.basicInfo.layoutPattern')} value={features.layoutPattern} />
          )}
        </CardContent>
      </Card>

      {/* 公司資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.basicInfo.company')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label={t('detail.basicInfo.companyName')} value={format.company.name} />
          <InfoRow label={t('detail.basicInfo.companyCode')} value={format.company.code} />
        </CardContent>
      </Card>

      {/* 時間資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.basicInfo.time')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label={t('detail.basicInfo.createdAt')} value={formatDateTime(format.createdAt, locale)} />
          <InfoRow label={t('detail.basicInfo.updatedAt')} value={formatDateTime(format.updatedAt, locale)} />
        </CardContent>
      </Card>

      {/* 常見欄位（如果有）*/}
      {features.typicalFields && features.typicalFields.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('detail.basicInfo.typicalFields')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {features.typicalFields.map((field, index) => (
                <Badge key={index} variant="outline">
                  {field}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
