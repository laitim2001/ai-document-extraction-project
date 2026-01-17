'use client'

/**
 * @fileoverview Forwarder 基本資訊組件（國際化版本）
 * @description
 *   顯示 Forwarder 的基本資訊卡片，包含：
 *   - 名稱和代碼
 *   - 狀態標籤
 *   - 優先級
 *   - 規則摘要
 *   - 識別模式
 *   - 完整國際化支援
 *
 * @module src/components/features/forwarders/ForwarderInfo
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// REFACTOR-001: 從 company.ts 導入類型（forwarder 類型已棄用）
import type {
  ForwarderDetailView,
  ForwarderIdentificationPattern,
} from '@/types/company'
import {
  LEGACY_FORWARDER_STATUS_CONFIG,
  RULE_STATUS_CONFIG,
  getForwarderDisplayStatus,
} from '@/types/forwarder'
import { Building2, Code, Hash, Shield, FileText } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ForwarderInfoProps {
  /** Forwarder 詳情資料 */
  forwarder: ForwarderDetailView
}

// ============================================================
// Component
// ============================================================

/**
 * Forwarder 基本資訊組件
 *
 * @description
 *   以卡片形式展示 Forwarder 的基本資訊和規則摘要
 */
export function ForwarderInfo({ forwarder }: ForwarderInfoProps) {
  const t = useTranslations('companies')
  const displayStatus = getForwarderDisplayStatus(forwarder.isActive)
  const statusI18nKey = forwarder.isActive ? 'active' : 'inactive'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 基本資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('detail.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 名稱和狀態 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('detail.name')}</p>
              <p className="font-medium">{forwarder.displayName || forwarder.name}</p>
            </div>
            <Badge className={LEGACY_FORWARDER_STATUS_CONFIG[displayStatus].className}>
              {t(`status.${statusI18nKey}`)}
            </Badge>
          </div>

          {/* 代碼 */}
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">{t('detail.code')}</p>
              <p className="font-mono font-medium">{forwarder.code}</p>
            </div>
          </div>

          {/* 優先級 */}
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">{t('detail.priority')}</p>
              <p className="font-medium">{forwarder.priority}</p>
            </div>
          </div>

          {/* 識別模式 */}
          {forwarder.identificationPatterns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('detail.identificationPatterns')}</p>
              </div>
              <div className="space-y-1">
                {forwarder.identificationPatterns.map(
                  (pattern: ForwarderIdentificationPattern, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Badge variant="outline" className="text-xs">
                        {pattern.type}
                      </Badge>
                      <span className="font-mono text-xs truncate">
                        {pattern.value}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 規則摘要卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('detail.rulesSummary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 規則總數 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('detail.totalRules')}</span>
              <span className="text-2xl font-bold">
                {forwarder.rulesSummary?.total ?? 0}
              </span>
            </div>

            {/* 按狀態分組 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.ACTIVE.className}>
                  {t('rulesTable.ruleStatus.active')}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary?.byStatus?.active ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.DRAFT.className}>
                  {t('rulesTable.ruleStatus.draft')}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary?.byStatus?.draft ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.PENDING_REVIEW.className}>
                  {t('rulesTable.ruleStatus.pendingReview')}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary?.byStatus?.pendingReview ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.DEPRECATED.className}>
                  {t('rulesTable.ruleStatus.deprecated')}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary?.byStatus?.deprecated ?? 0}
                </p>
              </div>
            </div>

            {/* 文件數量 */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">{t('detail.relatedDocuments')}</span>
              <span className="font-medium">
                {forwarder.documentCount ?? forwarder.stats.totalDocuments} {t('detail.documentsUnit')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
