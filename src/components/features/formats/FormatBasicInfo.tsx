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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import type { DocumentFormatDetail, DocumentFormatFeatures } from '@/types/document-format';
import {
  DOCUMENT_TYPE_LABELS_ZH,
  DOCUMENT_SUBTYPE_LABELS_ZH,
} from '@/types/document-format';

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
 * 格式化日期時間
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
function BooleanDisplay({ value, trueLabel = '是', falseLabel = '否' }: {
  value: boolean | undefined;
  trueLabel?: string;
  falseLabel?: string;
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
  const features: DocumentFormatFeatures = format.features || {
    hasLineItems: false,
    hasHeaderLogo: false,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 格式資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">格式資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="格式名稱" value={format.name || '-'} />
          <InfoRow
            label="文件類型"
            value={DOCUMENT_TYPE_LABELS_ZH[format.documentType]}
          />
          <InfoRow
            label="文件子類型"
            value={DOCUMENT_SUBTYPE_LABELS_ZH[format.documentSubtype]}
          />
          <InfoRow label="文件數量" value={`${format.fileCount} 個`} />
          <InfoRow label="術語數量" value={`${format.commonTerms.length} 個`} />
        </CardContent>
      </Card>

      {/* 格式特徵卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">格式特徵</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">包含明細項目</span>
            <BooleanDisplay value={features.hasLineItems} />
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">包含公司 Logo</span>
            <BooleanDisplay value={features.hasHeaderLogo} />
          </div>
          <InfoRow label="貨幣" value={features.currency || '-'} />
          <InfoRow label="語言" value={features.language || '-'} />
          {features.layoutPattern && (
            <InfoRow label="版面特徵" value={features.layoutPattern} />
          )}
        </CardContent>
      </Card>

      {/* 公司資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">所屬公司</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="公司名稱" value={format.company.name} />
          <InfoRow label="公司代碼" value={format.company.code} />
        </CardContent>
      </Card>

      {/* 時間資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">時間資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="創建時間" value={formatDateTime(format.createdAt)} />
          <InfoRow label="更新時間" value={formatDateTime(format.updatedAt)} />
        </CardContent>
      </Card>

      {/* 常見欄位（如果有）*/}
      {features.typicalFields && features.typicalFields.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">常見欄位</CardTitle>
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
