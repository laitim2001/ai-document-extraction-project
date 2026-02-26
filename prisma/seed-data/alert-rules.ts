/**
 * @fileoverview AlertRule Seed 數據
 * @description
 *   提供 4 個關鍵系統告警規則，確保新環境部署後
 *   系統能自動監控關鍵指標並產生告警。
 *
 *   告警規則:
 *   1. AI 服務不可用 (CRITICAL)
 *   2. OCR 服務回應超時 (ERROR)
 *   3. 處理佇列堆積 (WARNING)
 *   4. 錯誤率過高 (ERROR)
 *
 * @module prisma/seed-data/alert-rules
 * @since CHANGE-039
 * @lastModified 2026-02-13
 */

export interface AlertRuleSeed {
  name: string
  description: string
  conditionType: string
  metric: string
  operator: string
  threshold: number
  duration: number
  serviceName: string | null
  severity: string
  channels: string[]
  recipients: string[]
  cooldownMinutes: number
}

/**
 * 4 個系統告警規則 seed
 *
 * 注意: AlertRule 需要 createdById (User FK)，
 * 在 seed.ts 中使用 systemUser.id 設定。
 */
export const ALERT_RULE_SEEDS: AlertRuleSeed[] = [
  // ============================================================================
  // 1. AI 服務不可用 (CRITICAL)
  // ============================================================================
  {
    name: 'AI Service Unavailable',
    description: 'Azure OpenAI 服務無法連線或返回錯誤，AI 提取管線將完全無法運行',
    conditionType: 'SERVICE_DOWN',
    metric: 'ai_service_availability',
    operator: 'EQUALS',
    threshold: 0,
    duration: 60, // 60 秒內持續不可用
    serviceName: 'azure-openai',
    severity: 'CRITICAL',
    channels: ['EMAIL'],
    recipients: [],
    cooldownMinutes: 30,
  },

  // ============================================================================
  // 2. OCR 服務回應超時 (ERROR)
  // ============================================================================
  {
    name: 'OCR Service Response Timeout',
    description: 'Azure Document Intelligence 服務回應時間超過 30 秒閾值，可能影響文件處理速度',
    conditionType: 'RESPONSE_TIME',
    metric: 'ocr_response_time_ms',
    operator: 'GREATER_THAN',
    threshold: 30000, // 30 秒
    duration: 300, // 5 分鐘內持續超時
    serviceName: 'azure-document-intelligence',
    severity: 'ERROR',
    channels: ['EMAIL'],
    recipients: [],
    cooldownMinutes: 15,
  },

  // ============================================================================
  // 3. 處理佇列堆積 (WARNING)
  // ============================================================================
  {
    name: 'Processing Queue Backlog',
    description: '文件處理佇列中待處理項目超過 100 個，可能導致處理延遲',
    conditionType: 'QUEUE_BACKLOG',
    metric: 'processing_queue_size',
    operator: 'GREATER_THAN',
    threshold: 100,
    duration: 600, // 10 分鐘內持續堆積
    serviceName: null,
    severity: 'WARNING',
    channels: ['EMAIL'],
    recipients: [],
    cooldownMinutes: 60,
  },

  // ============================================================================
  // 4. 錯誤率過高 (ERROR)
  // ============================================================================
  {
    name: 'High Processing Error Rate',
    description: '文件處理錯誤率超過 20%，可能存在系統性問題需要排查',
    conditionType: 'ERROR_RATE',
    metric: 'processing_error_rate',
    operator: 'GREATER_THAN',
    threshold: 0.2, // 20%
    duration: 900, // 15 分鐘內持續高錯誤率
    serviceName: null,
    severity: 'ERROR',
    channels: ['EMAIL'],
    recipients: [],
    cooldownMinutes: 30,
  },
]
