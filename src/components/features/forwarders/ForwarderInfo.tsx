'use client'

/**
 * @fileoverview Forwarder 基本資訊組件
 * @description
 *   顯示 Forwarder 的基本資訊卡片，包含：
 *   - 名稱和代碼
 *   - 狀態標籤
 *   - 優先級
 *   - 規則摘要
 *   - 識別模式
 *
 * @module src/components/features/forwarders/ForwarderInfo
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/types/forwarder - 類型定義
 *   - @/components/ui - UI 組件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  ForwarderDetailView,
  ForwarderIdentificationPattern,
} from '@/types/forwarder'
import {
  FORWARDER_STATUS_CONFIG,
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
  const displayStatus = getForwarderDisplayStatus(forwarder.isActive)
  const statusConfig = FORWARDER_STATUS_CONFIG[displayStatus]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 基本資訊卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            基本資訊
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 名稱和狀態 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">名稱</p>
              <p className="font-medium">{forwarder.displayName || forwarder.name}</p>
            </div>
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
          </div>

          {/* 代碼 */}
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">代碼</p>
              <p className="font-mono font-medium">{forwarder.code}</p>
            </div>
          </div>

          {/* 優先級 */}
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">優先級</p>
              <p className="font-medium">{forwarder.priority}</p>
            </div>
          </div>

          {/* 識別模式 */}
          {forwarder.identificationPatterns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">識別模式</p>
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
            規則摘要
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 規則總數 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">規則總數</span>
              <span className="text-2xl font-bold">
                {forwarder.rulesSummary.total}
              </span>
            </div>

            {/* 按狀態分組 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.ACTIVE.className}>
                  {RULE_STATUS_CONFIG.ACTIVE.label}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary.byStatus.active}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.DRAFT.className}>
                  {RULE_STATUS_CONFIG.DRAFT.label}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary.byStatus.draft}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.PENDING_REVIEW.className}>
                  {RULE_STATUS_CONFIG.PENDING_REVIEW.label}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary.byStatus.pendingReview}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className={RULE_STATUS_CONFIG.DEPRECATED.className}>
                  {RULE_STATUS_CONFIG.DEPRECATED.label}
                </Badge>
                <p className="mt-1 text-xl font-semibold">
                  {forwarder.rulesSummary.byStatus.deprecated}
                </p>
              </div>
            </div>

            {/* 文件數量 */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">關聯文件</span>
              <span className="font-medium">
                {forwarder.documentCount ?? forwarder.stats.totalDocuments} 份
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
