/**
 * @fileoverview Outlook 連線配置類型定義
 * @description
 *   定義 Outlook 連線配置的所有類型，包含：
 *   - 配置 CRUD 輸入/輸出型別
 *   - 過濾規則相關型別
 *   - 連線測試結果型別
 *   - API 回應型別
 *
 * @module src/types/outlook-config.types
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 配置輸入/輸出型別
 *   - 過濾規則型別
 *   - 連線測試型別
 *   - 表單資料型別
 *
 * @dependencies
 *   - @prisma/client - Prisma 模型類型
 *
 * @related
 *   - prisma/schema.prisma - 資料模型
 *   - src/services/outlook-config.service.ts - 服務層
 */

import type {
  OutlookConfig,
  OutlookFilterRule,
  OutlookRuleType,
  RuleOperator,
  City,
  User,
} from '@prisma/client';

// ============================================================
// 重新導出 Prisma 枚舉以便使用
// ============================================================

export type { OutlookRuleType, RuleOperator } from '@prisma/client';

// ============================================================
// 配置輸入型別
// ============================================================

/**
 * 建立配置輸入
 */
export interface CreateOutlookConfigInput {
  /** 配置名稱 */
  name: string;
  /** 配置描述 */
  description?: string;
  /** 監控的郵箱地址 */
  mailboxAddress: string;
  /** 監控的郵件資料夾 */
  mailFolders?: string[];
  /** Azure AD 租戶 ID */
  tenantId: string;
  /** 應用程式 ID */
  clientId: string;
  /** 客戶端密鑰 (明文，儲存時加密) */
  clientSecret: string;
  /** 關聯城市 ID (null 表示全域) */
  cityId?: string | null;
  /** 是否為全域配置 */
  isGlobal?: boolean;
  /** 允許的副檔名 */
  allowedExtensions?: string[];
  /** 最大附件大小 (MB) */
  maxAttachmentSizeMb?: number;
}

/**
 * 更新配置輸入 (部分欄位)
 */
export interface UpdateOutlookConfigInput {
  name?: string;
  description?: string | null;
  mailboxAddress?: string;
  mailFolders?: string[];
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  allowedExtensions?: string[];
  maxAttachmentSizeMb?: number;
  isActive?: boolean;
}

// ============================================================
// 過濾規則輸入型別
// ============================================================

/**
 * 建立過濾規則輸入
 */
export interface CreateFilterRuleInput {
  /** 規則名稱 */
  name: string;
  /** 規則描述 */
  description?: string;
  /** 規則類型 */
  ruleType: OutlookRuleType;
  /** 規則值 */
  ruleValue: string;
  /** 比對方式 */
  operator?: RuleOperator;
  /** 是否為白名單規則 */
  isWhitelist: boolean;
  /** 優先級 (數字越小越優先) */
  priority?: number;
}

/**
 * 更新過濾規則輸入
 */
export interface UpdateFilterRuleInput {
  name?: string;
  description?: string | null;
  ruleType?: OutlookRuleType;
  ruleValue?: string;
  operator?: RuleOperator;
  isWhitelist?: boolean;
  isActive?: boolean;
  priority?: number;
}

// ============================================================
// 連線測試型別
// ============================================================

/**
 * 郵件資料夾資訊
 */
export interface MailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

/**
 * 連線測試結果
 */
export interface OutlookConnectionTestResult {
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 (失敗時) */
  error?: string;
  /** 詳細資訊 (成功時) */
  details?: {
    /** 郵箱資訊 */
    mailboxInfo?: {
      displayName: string;
      email: string;
    };
    /** 已授權的權限 */
    permissions?: string[];
    /** 最近郵件數量 */
    recentMailCount?: number;
    /** 郵件資料夾列表 */
    folders?: MailFolder[];
  };
}

/**
 * 直接測試輸入 (未儲存的配置)
 */
export interface TestConnectionInput {
  mailboxAddress: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

// ============================================================
// 查詢選項型別
// ============================================================

/**
 * 配置查詢選項
 */
export interface GetOutlookConfigsOptions {
  /** 篩選特定城市 */
  cityId?: string;
  /** 是否包含停用的配置 */
  includeInactive?: boolean;
  /** 是否包含過濾規則 */
  includeRules?: boolean;
}

// ============================================================
// 回應型別
// ============================================================

/**
 * 城市簡要資訊
 */
export type CityBrief = Pick<City, 'id' | 'name' | 'code'>;

/**
 * 用戶簡要資訊
 */
export type UserBrief = Pick<User, 'id' | 'name'>;

/**
 * 配置回應 (含關聯)
 */
export interface OutlookConfigWithRelations extends OutlookConfig {
  city?: CityBrief | null;
  filterRules?: OutlookFilterRule[];
  createdBy?: UserBrief;
  updatedBy?: UserBrief | null;
}

/**
 * API 回應 (密鑰遮蔽)
 */
export interface OutlookConfigApiResponse
  extends Omit<OutlookConfigWithRelations, 'clientSecret'> {
  /** 遮蔽後的密鑰 */
  clientSecretMasked: string;
}

// ============================================================
// 規則評估相關型別
// ============================================================

/**
 * 郵件資訊 (用於規則評估)
 */
export interface MailInfoForRules {
  senderEmail: string;
  senderName: string;
  subject: string;
  attachments: Array<{
    name: string;
    contentType: string;
    size: number;
  }>;
  folder: string;
}

/**
 * 規則評估結果
 */
export interface RuleEvaluationResult {
  /** 是否允許處理 */
  allowed: boolean;
  /** 匹配的規則 (如有) */
  matchedRule?: OutlookFilterRule;
  /** 評估原因 */
  reason: string;
}

// ============================================================
// 表單型別 (前端使用)
// ============================================================

/**
 * 配置表單資料
 */
export interface OutlookConfigFormData {
  name: string;
  description: string;
  mailboxAddress: string;
  mailFolders: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  cityId: string | null;
  isGlobal: boolean;
  allowedExtensions: string;
  maxAttachmentSizeMb: number;
}

/**
 * 過濾規則表單資料
 */
export interface FilterRuleFormData {
  name: string;
  description: string;
  ruleType: OutlookRuleType;
  ruleValue: string;
  operator: RuleOperator;
  isWhitelist: boolean;
}

// ============================================================
// 列表/分頁型別
// ============================================================

/**
 * 分頁元資料
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 配置列表回應
 */
export interface OutlookConfigListResponse {
  data: OutlookConfigApiResponse[];
  meta?: {
    pagination?: PaginationMeta;
  };
}

// ============================================================
// 規則類型說明對照
// ============================================================

/**
 * 規則類型說明
 */
export const RULE_TYPE_LABELS: Record<OutlookRuleType, string> = {
  SENDER_EMAIL: '寄件者 Email',
  SENDER_DOMAIN: '寄件者網域',
  SUBJECT_KEYWORD: '主旨關鍵字',
  SUBJECT_REGEX: '主旨正則表達式',
  ATTACHMENT_TYPE: '附件類型',
  ATTACHMENT_NAME: '附件名稱模式',
};

/**
 * 規則運算子說明
 */
export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  EQUALS: '完全匹配',
  CONTAINS: '包含',
  STARTS_WITH: '開頭',
  ENDS_WITH: '結尾',
  REGEX: '正則表達式',
};

/**
 * 規則類型對應的預設運算子
 */
export const RULE_TYPE_DEFAULT_OPERATOR: Record<OutlookRuleType, RuleOperator> =
  {
    SENDER_EMAIL: 'EQUALS',
    SENDER_DOMAIN: 'ENDS_WITH',
    SUBJECT_KEYWORD: 'CONTAINS',
    SUBJECT_REGEX: 'REGEX',
    ATTACHMENT_TYPE: 'EQUALS',
    ATTACHMENT_NAME: 'CONTAINS',
  };
