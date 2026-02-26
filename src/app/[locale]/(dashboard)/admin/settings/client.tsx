'use client'

/**
 * @fileoverview System Settings Hub 客戶端主組件
 * @description
 *   Settings Hub 頁面的核心客戶端組件，以卡片網格佈局呈現所有系統設定類別。
 *
 *   **內嵌設定（展開式卡片）:**
 *   1. 一般設定 (General Settings) — 展開 GeneralSettingsForm
 *   2. 通知設定 (Notification Settings) — 展開 NotificationSettingsForm
 *   3. 資料保留 (Data Retention) — 展開 DataRetentionForm
 *
 *   **連結式卡片（導航至現有頁面）:**
 *   4. Pipeline Settings → /admin/pipeline-settings
 *   5. Prompt Configs → /admin/prompt-configs
 *   6. System Config → /admin/config
 *   7. Health Monitoring → /admin/monitoring/health
 *   8. Backup & Restore → /admin/backup
 *   9. Alert Rules → /admin/alerts
 *
 *   一次只能展開一張卡片。
 *
 * @module src/app/[locale]/(dashboard)/admin/settings/client
 * @since CHANGE-050 - System Settings Hub
 * @lastModified 2026-02-26
 *
 * @dependencies
 *   - lucide-react - 圖示
 *   - next-intl - 國際化
 *   - SettingsCard - 卡片組件
 *   - GeneralSettingsForm - 一般設定表單
 *   - NotificationSettingsForm - 通知設定表單
 *   - DataRetentionForm - 資料保留表單
 */

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Settings2,
  Bell,
  Clock,
  GitBranch,
  MessageSquareCode,
  Database,
  Activity,
  HardDrive,
} from 'lucide-react'
import {
  SettingsCard,
  GeneralSettingsForm,
  NotificationSettingsForm,
  DataRetentionForm,
} from '@/components/features/admin/settings'

// ============================================================
// Types
// ============================================================

/** 可展開的卡片識別碼 */
type ExpandableCard = 'general' | 'notifications' | 'retention'

// ============================================================
// Component
// ============================================================

/**
 * Settings Hub 客戶端主組件
 *
 * @description
 *   管理所有設定卡片的展開狀態（一次只允許一張卡片展開），
 *   並以響應式網格佈局呈現所有設定類別。
 */
export function SettingsClient() {
  const t = useTranslations('systemSettings')

  // --- State ---
  const [expandedCard, setExpandedCard] = useState<ExpandableCard | null>(null)

  // --- Handlers ---
  const handleToggle = useCallback((card: ExpandableCard) => {
    setExpandedCard((prev) => (prev === card ? null : card))
  }, [])

  // --- Render ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Inline Settings (Expandable Cards) */}
      <SettingsCard
        icon={Settings2}
        title={t('categories.general')}
        description={t('general.description')}
        expanded={expandedCard === 'general'}
        onToggle={() => handleToggle('general')}
      >
        <GeneralSettingsForm />
      </SettingsCard>

      <SettingsCard
        icon={Bell}
        title={t('categories.notifications')}
        description={t('notifications.description')}
        expanded={expandedCard === 'notifications'}
        onToggle={() => handleToggle('notifications')}
      >
        <NotificationSettingsForm />
      </SettingsCard>

      <SettingsCard
        icon={Clock}
        title={t('categories.retention')}
        description={t('retention.description')}
        expanded={expandedCard === 'retention'}
        onToggle={() => handleToggle('retention')}
      >
        <DataRetentionForm />
      </SettingsCard>

      {/* Link Cards (Navigate to Existing Pages) */}
      <SettingsCard
        icon={GitBranch}
        title={t('categories.pipeline')}
        description={t('categories.pipeline')}
        href="/admin/pipeline-settings"
      />

      <SettingsCard
        icon={MessageSquareCode}
        title={t('categories.prompt')}
        description={t('categories.prompt')}
        href="/admin/prompt-configs"
      />

      <SettingsCard
        icon={Database}
        title={t('categories.config')}
        description={t('categories.config')}
        href="/admin/config"
      />

      <SettingsCard
        icon={Activity}
        title={t('categories.health')}
        description={t('categories.health')}
        href="/admin/monitoring/health"
      />

      <SettingsCard
        icon={HardDrive}
        title={t('categories.backup')}
        description={t('categories.backup')}
        href="/admin/backup"
      />

      <SettingsCard
        icon={Bell}
        title={t('categories.alerts')}
        description={t('categories.alerts')}
        href="/admin/alerts"
      />
    </div>
  )
}
