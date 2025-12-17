# Tech Spec: Story 9-4 - Outlook 連線配置

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.4 |
| 標題 | Outlook 連線配置 |
| 優先級 | High |
| 估計點數 | 5 |
| 狀態 | ready-for-dev |
| 前置依賴 | Story 9-3 (Outlook 郵件附件擷取 API) |

---

## 目錄

1. [概述](#概述)
2. [架構設計](#架構設計)
3. [資料庫設計](#資料庫設計)
4. [型別定義](#型別定義)
5. [服務層實作](#服務層實作)
6. [API 路由設計](#api-路由設計)
7. [前端元件](#前端元件)
8. [測試規格](#測試規格)
9. [驗收標準對照](#驗收標準對照)

---

## 概述

### 功能摘要

本 Story 實作 Outlook 連線配置管理功能，讓系統管理員可以透過管理介面配置 Outlook 郵箱連線設定，包括 Azure AD 認證資訊、郵件過濾規則，以及城市級別的配置管理。

### 核心功能

1. **連線配置表單** - 提供完整的 Azure AD 和郵箱設定介面
2. **連線測試** - 驗證 Azure AD 憑證和郵箱存取權限
3. **城市級別配置** - 支援不同城市配置不同的監控郵箱
4. **郵件過濾規則** - 可視化規則編輯器，支援拖曳排序

### 與 Story 9-3 的關係

Story 9-3 定義了 OutlookConfig 和 OutlookFilterRule 的基礎模型，本 Story 擴展這些模型並實作完整的配置管理 UI 和服務層。

---

## 架構設計

### 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Settings Page                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              OutlookConfigList                             │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Config Card 1 (Global)                    [Edit]    │  │ │
│  │  │ Config Card 2 (Taipei)                    [Edit]    │  │ │
│  │  │ Config Card 3 (Shanghai)                  [Edit]    │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              OutlookConfigForm                             │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Basic Info │ Azure AD │ Attachment Settings         │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  [Test Connection]                      [Save Config]      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         OutlookFilterRulesEditor (DnD)                     │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ ≡ Rule 1: Sender Domain = @vendor.com [Whitelist]  │  │ │
│  │  │ ≡ Rule 2: Subject Contains "Invoice" [Whitelist]   │  │ │
│  │  │ ≡ Rule 3: Sender Email = spam@... [Blacklist]      │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  [+ Add Rule]                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /api/admin/integrations/outlook                             │ │
│  │   GET    → List all configs                                 │ │
│  │   POST   → Create new config                                │ │
│  │                                                              │ │
│  │ /api/admin/integrations/outlook/:configId                   │ │
│  │   GET    → Get single config                                │ │
│  │   PUT    → Update config                                    │ │
│  │   DELETE → Soft delete config                               │ │
│  │                                                              │ │
│  │ /api/admin/integrations/outlook/:configId/test              │ │
│  │   POST   → Test connection                                  │ │
│  │                                                              │ │
│  │ /api/admin/integrations/outlook/:configId/rules             │ │
│  │   GET    → List rules                                       │ │
│  │   POST   → Create rule                                      │ │
│  │   PUT    → Reorder rules                                    │ │
│  │                                                              │ │
│  │ /api/admin/integrations/outlook/:configId/rules/:ruleId     │ │
│  │   PUT    → Update rule                                      │ │
│  │   DELETE → Delete rule                                      │ │
│  │                                                              │ │
│  │ /api/admin/integrations/outlook/test                        │ │
│  │   POST   → Test with raw credentials (no config saved)      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             OutlookConfigService                            │ │
│  │  ├─ createConfig(input, userId)                             │ │
│  │  ├─ updateConfig(configId, input, userId)                   │ │
│  │  ├─ testConnection(configId)                                │ │
│  │  ├─ testConnectionWithInput(input)                          │ │
│  │  ├─ getConfigs(options)                                     │ │
│  │  ├─ getConfig(configId)                                     │ │
│  │  ├─ toggleActive(configId, isActive)                        │ │
│  │  ├─ deleteConfig(configId)                                  │ │
│  │  ├─ addFilterRule(configId, input)                          │ │
│  │  ├─ updateFilterRule(ruleId, input)                         │ │
│  │  ├─ deleteFilterRule(ruleId)                                │ │
│  │  ├─ getFilterRules(configId)                                │ │
│  │  └─ reorderFilterRules(configId, ruleIds)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             OutlookMailService (Extended)                   │ │
│  │  ├─ testMailboxAccess()                                     │ │
│  │  ├─ getMailboxInfo()                                        │ │
│  │  ├─ getRecentMailCount(hours)                               │ │
│  │  └─ getMailFolders()                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             EncryptionService                               │ │
│  │  ├─ encrypt(plaintext)                                      │ │
│  │  └─ decrypt(ciphertext)                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             Microsoft Graph API                             │ │
│  │  ├─ GET /users/{mailbox}                                    │ │
│  │  ├─ GET /users/{mailbox}/messages                           │ │
│  │  └─ GET /users/{mailbox}/mailFolders                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 資料流程

```
┌──────────────────────────────────────────────────────────────────┐
│                 連線測試流程                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin ─────────────────────────────────────────────────────┐    │
│    │                                                        │    │
│    │ 1. 填寫 Azure AD 憑證                                  │    │
│    │    (tenantId, clientId, clientSecret)                 │    │
│    │                                                        │    │
│    ▼                                                        │    │
│  ┌──────────────────────────┐                               │    │
│  │   OutlookConfigForm     │                               │    │
│  │   點擊 "測試連線"        │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 2. POST /api/admin/integrations/outlook/test│    │
│               │    或 /:configId/test                       │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   OutlookConfigService  │                               │    │
│  │   testConnection()      │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 3. 解密 clientSecret (如已儲存)              │    │
│               │    或使用原始值 (新配置)                     │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   OutlookMailService    │                               │    │
│  │   testMailboxAccess()   │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 4. 使用 Client Credentials Flow             │    │
│               │    獲取 Access Token                        │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   Azure AD              │                               │    │
│  │   POST /oauth2/token    │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 5. 驗證郵箱存取權限                          │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   Microsoft Graph API   │                               │    │
│  │   GET /users/{mailbox}  │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 6. 回傳測試結果                              │    │
│               │    - 成功: 郵箱資訊, 最近郵件數              │    │
│               │    - 失敗: 錯誤訊息                         │    │
│               ▼                                             │    │
│  Admin ◄────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                 過濾規則處理流程                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  郵件進入 ──────────────────────────────────────────────────┐    │
│    │                                                        │    │
│    ▼                                                        │    │
│  ┌──────────────────────────────────────────────────────┐   │    │
│  │ 載入配置的所有規則 (按 priority 排序)                 │   │    │
│  │   Rule 1 (priority: 0) → Rule 2 (priority: 1) → ...  │   │    │
│  └────────────────────────┬─────────────────────────────┘   │    │
│                           │                                 │    │
│                           ▼                                 │    │
│  ┌──────────────────────────────────────────────────────┐   │    │
│  │ 逐一評估規則                                          │   │    │
│  │                                                      │   │    │
│  │   for each rule:                                     │   │    │
│  │     if rule.isActive == false: continue              │   │    │
│  │                                                      │   │    │
│  │     match = evaluateRule(mail, rule)                 │   │    │
│  │                                                      │   │    │
│  │     if match && rule.isWhitelist:                    │   │    │
│  │       return ALLOW                                   │   │    │
│  │                                                      │   │    │
│  │     if match && !rule.isWhitelist:                   │   │    │
│  │       return BLOCK                                   │   │    │
│  │                                                      │   │    │
│  │   // 沒有規則匹配                                     │   │    │
│  │   if hasWhitelistRules:                              │   │    │
│  │     return BLOCK  // 白名單模式：未匹配則拒絕          │   │    │
│  │   else:                                              │   │    │
│  │     return ALLOW  // 黑名單模式：未匹配則允許          │   │    │
│  └──────────────────────────────────────────────────────┘   │    │
│                                                             │    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 資料庫設計

### Prisma Schema (擴展 Story 9-3)

```prisma
// prisma/schema.prisma

// ============================================
// Outlook 配置 (完整欄位)
// ============================================
model OutlookConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String                    // 配置名稱
  description       String?                   // 配置描述

  // 郵箱設定
  mailboxAddress    String                    // 監控的郵箱地址
  mailFolders       String[]  @default(["inbox"]) // 監控的資料夾

  // Azure AD 設定
  tenantId          String                    // Azure AD 租戶 ID
  clientId          String                    // 應用程式 ID
  clientSecret      String                    // 加密儲存的客戶端密鑰

  // 城市關聯 (每個城市最多一個配置)
  cityId            String?   @unique
  city              City?     @relation(fields: [cityId], references: [id])

  // 全域配置標記 (cityId 為 null 且 isGlobal 為 true)
  isGlobal          Boolean   @default(false)

  // 附件過濾
  allowedExtensions String[]  @default(["pdf", "jpg", "jpeg", "png", "tiff"])
  maxAttachmentSizeMb Int     @default(30)

  // 過濾規則
  filterRules       OutlookFilterRule[]

  // 狀態
  isActive          Boolean   @default(true)
  lastTestedAt      DateTime?                 // 最後測試時間
  lastTestResult    Boolean?                  // 最後測試結果
  lastTestError     String?                   // 最後測試錯誤訊息

  // 統計
  totalProcessed    Int       @default(0)     // 已處理郵件總數
  lastProcessedAt   DateTime?                 // 最後處理時間

  // 審計欄位
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       String
  createdBy         User      @relation("OutlookConfigCreator", fields: [createdById], references: [id])
  updatedById       String?
  updatedBy         User?     @relation("OutlookConfigUpdater", fields: [updatedById], references: [id])

  // 關聯
  fetchLogs         OutlookFetchLog[]

  @@index([cityId])
  @@index([isActive])
  @@index([isGlobal])
  @@map("outlook_configs")
}

// ============================================
// Outlook 過濾規則
// ============================================
model OutlookFilterRule {
  id              String              @id @default(cuid())
  configId        String
  config          OutlookConfig       @relation(fields: [configId], references: [id], onDelete: Cascade)

  // 規則識別
  name            String              // 規則名稱
  description     String?             // 規則描述

  // 規則設定
  ruleType        OutlookRuleType     // 規則類型
  ruleValue       String              // 規則值
  ruleOperator    RuleOperator        @default(EQUALS) // 比對方式

  // 白名單/黑名單
  isWhitelist     Boolean             @default(true)

  // 狀態
  isActive        Boolean             @default(true)
  priority        Int                 @default(0)     // 優先級（數字越小越優先）

  // 時間戳
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([configId])
  @@index([isActive])
  @@index([priority])
  @@map("outlook_filter_rules")
}

// ============================================
// 過濾規則類型
// ============================================
enum OutlookRuleType {
  SENDER_EMAIL      // 寄件者 Email 完整地址
  SENDER_DOMAIN     // 寄件者網域 (例: @vendor.com)
  SENDER_NAME       // 寄件者顯示名稱
  SUBJECT_KEYWORD   // 主旨包含關鍵字
  SUBJECT_REGEX     // 主旨正則表達式
  ATTACHMENT_TYPE   // 附件類型 (例: pdf, xlsx)
  ATTACHMENT_NAME   // 附件名稱模式
  HAS_ATTACHMENT    // 是否有附件 (ruleValue: "true"/"false")
  MAIL_FOLDER       // 郵件資料夾
}

// ============================================
// 規則比對方式
// ============================================
enum RuleOperator {
  EQUALS          // 完全匹配
  CONTAINS        // 包含
  STARTS_WITH     // 開頭
  ENDS_WITH       // 結尾
  REGEX           // 正則表達式
  NOT_EQUALS      // 不等於
  NOT_CONTAINS    // 不包含
}

// User model 擴展 (relations)
model User {
  // ... 現有欄位 ...

  // Outlook 配置關聯
  createdOutlookConfigs   OutlookConfig[] @relation("OutlookConfigCreator")
  updatedOutlookConfigs   OutlookConfig[] @relation("OutlookConfigUpdater")
}

// City model 擴展 (relation)
model City {
  // ... 現有欄位 ...

  // Outlook 配置關聯
  outlookConfig   OutlookConfig?
}
```

### 資料約束條件

```sql
-- 確保全域配置唯一
CREATE UNIQUE INDEX idx_outlook_config_global
ON outlook_configs(is_global)
WHERE is_global = true AND is_active = true;

-- 確保每個城市只有一個啟用的配置
CREATE UNIQUE INDEX idx_outlook_config_city
ON outlook_configs(city_id)
WHERE city_id IS NOT NULL AND is_active = true;
```

---

## 型別定義

### 配置相關型別

```typescript
// types/outlook-config.types.ts

import {
  OutlookConfig,
  OutlookFilterRule,
  OutlookRuleType,
  RuleOperator,
  City,
  User
} from '@prisma/client'

// ============================================
// 配置輸入型別
// ============================================

/** 建立配置輸入 */
export interface CreateOutlookConfigInput {
  /** 配置名稱 */
  name: string
  /** 配置描述 */
  description?: string
  /** 監控的郵箱地址 */
  mailboxAddress: string
  /** 監控的郵件資料夾 */
  mailFolders?: string[]
  /** Azure AD 租戶 ID */
  tenantId: string
  /** 應用程式 ID */
  clientId: string
  /** 客戶端密鑰 (明文，儲存時加密) */
  clientSecret: string
  /** 關聯城市 ID (null 表示全域) */
  cityId?: string | null
  /** 是否為全域配置 */
  isGlobal?: boolean
  /** 允許的副檔名 */
  allowedExtensions?: string[]
  /** 最大附件大小 (MB) */
  maxAttachmentSizeMb?: number
}

/** 更新配置輸入 (部分欄位) */
export interface UpdateOutlookConfigInput {
  name?: string
  description?: string
  mailboxAddress?: string
  mailFolders?: string[]
  tenantId?: string
  clientId?: string
  clientSecret?: string
  allowedExtensions?: string[]
  maxAttachmentSizeMb?: number
  isActive?: boolean
}

// ============================================
// 過濾規則輸入型別
// ============================================

/** 建立過濾規則輸入 */
export interface CreateFilterRuleInput {
  /** 規則名稱 */
  name: string
  /** 規則描述 */
  description?: string
  /** 規則類型 */
  ruleType: OutlookRuleType
  /** 規則值 */
  ruleValue: string
  /** 比對方式 */
  ruleOperator?: RuleOperator
  /** 是否為白名單規則 */
  isWhitelist: boolean
  /** 優先級 (數字越小越優先) */
  priority?: number
}

/** 更新過濾規則輸入 */
export interface UpdateFilterRuleInput {
  name?: string
  description?: string
  ruleType?: OutlookRuleType
  ruleValue?: string
  ruleOperator?: RuleOperator
  isWhitelist?: boolean
  isActive?: boolean
  priority?: number
}

// ============================================
// 連線測試型別
// ============================================

/** 連線測試結果 */
export interface OutlookConnectionTestResult {
  /** 是否成功 */
  success: boolean
  /** 錯誤訊息 (失敗時) */
  error?: string
  /** 詳細資訊 (成功時) */
  details?: {
    /** 郵箱資訊 */
    mailboxInfo?: {
      displayName: string
      email: string
    }
    /** 已授權的權限 */
    permissions?: string[]
    /** 最近郵件數量 */
    recentMailCount?: number
    /** 郵件資料夾列表 */
    folders?: Array<{
      id: string
      displayName: string
      totalItemCount: number
    }>
  }
}

/** 直接測試輸入 (未儲存的配置) */
export interface TestConnectionInput {
  mailboxAddress: string
  tenantId: string
  clientId: string
  clientSecret: string
}

// ============================================
// 查詢選項型別
// ============================================

/** 配置查詢選項 */
export interface GetOutlookConfigsOptions {
  /** 篩選特定城市 */
  cityId?: string
  /** 是否包含停用的配置 */
  includeInactive?: boolean
  /** 是否包含過濾規則 */
  includeRules?: boolean
}

// ============================================
// 回應型別
// ============================================

/** 配置回應 (含關聯) */
export interface OutlookConfigWithRelations extends OutlookConfig {
  city?: Pick<City, 'id' | 'name' | 'code'> | null
  filterRules?: OutlookFilterRule[]
  createdBy?: Pick<User, 'id' | 'name'>
  updatedBy?: Pick<User, 'id' | 'name'> | null
}

/** API 回應 (密鑰遮蔽) */
export interface OutlookConfigApiResponse extends Omit<OutlookConfigWithRelations, 'clientSecret'> {
  /** 遮蔽後的密鑰 */
  clientSecret: '********'
}

// ============================================
// 規則評估相關型別
// ============================================

/** 郵件資訊 (用於規則評估) */
export interface MailInfoForRules {
  senderEmail: string
  senderName: string
  subject: string
  attachments: Array<{
    name: string
    contentType: string
    size: number
  }>
  folder: string
}

/** 規則評估結果 */
export interface RuleEvaluationResult {
  /** 是否允許處理 */
  allowed: boolean
  /** 匹配的規則 (如有) */
  matchedRule?: OutlookFilterRule
  /** 評估原因 */
  reason: string
}

// ============================================
// 表單型別 (前端使用)
// ============================================

/** 配置表單資料 */
export interface OutlookConfigFormData {
  name: string
  description: string
  mailboxAddress: string
  mailFolders: string
  tenantId: string
  clientId: string
  clientSecret: string
  cityId: string | null
  isGlobal: boolean
  allowedExtensions: string
  maxAttachmentSizeMb: number
}

/** 過濾規則表單資料 */
export interface FilterRuleFormData {
  name: string
  description: string
  ruleType: OutlookRuleType
  ruleValue: string
  ruleOperator: RuleOperator
  isWhitelist: boolean
}
```

### Zod 驗證 Schema

```typescript
// lib/validations/outlook-config.schema.ts

import { z } from 'zod'

// ============================================
// 配置驗證
// ============================================

/** 建立配置驗證 */
export const createOutlookConfigSchema = z.object({
  name: z.string()
    .min(1, '名稱為必填')
    .max(100, '名稱不可超過 100 字'),
  description: z.string()
    .max(500, '描述不可超過 500 字')
    .optional(),
  mailboxAddress: z.string()
    .email('請輸入有效的郵箱地址'),
  mailFolders: z.array(z.string())
    .default(['inbox']),
  tenantId: z.string()
    .min(1, '租戶 ID 為必填')
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '租戶 ID 格式不正確'
    ),
  clientId: z.string()
    .min(1, '應用程式 ID 為必填')
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '應用程式 ID 格式不正確'
    ),
  clientSecret: z.string()
    .min(1, '客戶端密鑰為必填'),
  cityId: z.string()
    .cuid('城市 ID 格式不正確')
    .optional()
    .nullable(),
  isGlobal: z.boolean()
    .default(false),
  allowedExtensions: z.array(z.string())
    .default(['pdf', 'jpg', 'jpeg', 'png', 'tiff']),
  maxAttachmentSizeMb: z.number()
    .min(1, '最小 1 MB')
    .max(50, '最大 50 MB')
    .default(30)
})

/** 更新配置驗證 */
export const updateOutlookConfigSchema = z.object({
  name: z.string()
    .min(1, '名稱為必填')
    .max(100, '名稱不可超過 100 字')
    .optional(),
  description: z.string()
    .max(500, '描述不可超過 500 字')
    .optional()
    .nullable(),
  mailboxAddress: z.string()
    .email('請輸入有效的郵箱地址')
    .optional(),
  mailFolders: z.array(z.string())
    .optional(),
  tenantId: z.string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '租戶 ID 格式不正確'
    )
    .optional(),
  clientId: z.string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '應用程式 ID 格式不正確'
    )
    .optional(),
  clientSecret: z.string()
    .min(1)
    .optional(),
  allowedExtensions: z.array(z.string())
    .optional(),
  maxAttachmentSizeMb: z.number()
    .min(1, '最小 1 MB')
    .max(50, '最大 50 MB')
    .optional(),
  isActive: z.boolean()
    .optional()
})

/** 測試連線驗證 */
export const testConnectionSchema = z.object({
  mailboxAddress: z.string().email('請輸入有效的郵箱地址'),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填')
})

// ============================================
// 過濾規則驗證
// ============================================

/** 規則類型 enum */
const ruleTypeEnum = z.enum([
  'SENDER_EMAIL',
  'SENDER_DOMAIN',
  'SENDER_NAME',
  'SUBJECT_KEYWORD',
  'SUBJECT_REGEX',
  'ATTACHMENT_TYPE',
  'ATTACHMENT_NAME',
  'HAS_ATTACHMENT',
  'MAIL_FOLDER'
])

/** 規則運算子 enum */
const ruleOperatorEnum = z.enum([
  'EQUALS',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'REGEX',
  'NOT_EQUALS',
  'NOT_CONTAINS'
])

/** 建立過濾規則驗證 */
export const createFilterRuleSchema = z.object({
  name: z.string()
    .min(1, '規則名稱為必填')
    .max(100, '規則名稱不可超過 100 字'),
  description: z.string()
    .max(500, '描述不可超過 500 字')
    .optional(),
  ruleType: ruleTypeEnum,
  ruleValue: z.string()
    .min(1, '規則值為必填'),
  ruleOperator: ruleOperatorEnum
    .default('EQUALS'),
  isWhitelist: z.boolean(),
  priority: z.number()
    .int('優先級必須為整數')
    .min(0, '優先級不可小於 0')
    .default(0)
})

/** 更新過濾規則驗證 */
export const updateFilterRuleSchema = z.object({
  name: z.string()
    .min(1, '規則名稱為必填')
    .max(100, '規則名稱不可超過 100 字')
    .optional(),
  description: z.string()
    .max(500, '描述不可超過 500 字')
    .optional()
    .nullable(),
  ruleType: ruleTypeEnum.optional(),
  ruleValue: z.string().min(1).optional(),
  ruleOperator: ruleOperatorEnum.optional(),
  isWhitelist: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional()
})

/** 重新排序規則驗證 */
export const reorderRulesSchema = z.object({
  ruleIds: z.array(z.string().cuid('規則 ID 格式不正確'))
    .min(1, '至少需要一個規則 ID')
})

// ============================================
// 型別導出
// ============================================

export type CreateOutlookConfigInput = z.infer<typeof createOutlookConfigSchema>
export type UpdateOutlookConfigInput = z.infer<typeof updateOutlookConfigSchema>
export type TestConnectionInput = z.infer<typeof testConnectionSchema>
export type CreateFilterRuleInput = z.infer<typeof createFilterRuleSchema>
export type UpdateFilterRuleInput = z.infer<typeof updateFilterRuleSchema>
```

---

## 服務層實作

### OutlookConfigService

```typescript
// lib/services/outlook-config.service.ts

import { PrismaClient, OutlookConfig, OutlookFilterRule, Prisma } from '@prisma/client'
import { OutlookMailService } from './outlook-mail.service'
import { EncryptionService } from './encryption.service'
import {
  CreateOutlookConfigInput,
  UpdateOutlookConfigInput,
  CreateFilterRuleInput,
  UpdateFilterRuleInput,
  OutlookConnectionTestResult,
  TestConnectionInput,
  GetOutlookConfigsOptions,
  OutlookConfigWithRelations
} from '@/types/outlook-config.types'

export class OutlookConfigService {
  private prisma: PrismaClient
  private encryption: EncryptionService

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.encryption = new EncryptionService()
  }

  // ============================================
  // 配置 CRUD 操作
  // ============================================

  /**
   * 建立新的 Outlook 配置
   */
  async createConfig(
    input: CreateOutlookConfigInput,
    userId: string
  ): Promise<OutlookConfigWithRelations> {
    // 驗證唯一性約束
    await this.validateConfigUniqueness(input.cityId, input.isGlobal)

    // 加密客戶端密鑰
    const encryptedSecret = await this.encryption.encrypt(input.clientSecret)

    const config = await this.prisma.outlookConfig.create({
      data: {
        name: input.name,
        description: input.description,
        mailboxAddress: input.mailboxAddress,
        mailFolders: input.mailFolders || ['inbox'],
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecret: encryptedSecret,
        cityId: input.cityId || null,
        isGlobal: input.isGlobal || false,
        allowedExtensions: input.allowedExtensions || ['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
        maxAttachmentSizeMb: input.maxAttachmentSizeMb || 30,
        createdById: userId
      },
      include: this.getConfigInclude()
    })

    return config as OutlookConfigWithRelations
  }

  /**
   * 更新配置
   */
  async updateConfig(
    configId: string,
    input: UpdateOutlookConfigInput,
    userId: string
  ): Promise<OutlookConfigWithRelations> {
    // 驗證配置存在
    await this.prisma.outlookConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    const updateData: Prisma.OutlookConfigUpdateInput = {
      ...input,
      updatedById: userId,
      updatedAt: new Date()
    }

    // 如果提供新密鑰，則加密
    if (input.clientSecret) {
      updateData.clientSecret = await this.encryption.encrypt(input.clientSecret)
    }

    const config = await this.prisma.outlookConfig.update({
      where: { id: configId },
      data: updateData,
      include: this.getConfigInclude()
    })

    return config as OutlookConfigWithRelations
  }

  /**
   * 取得配置列表
   */
  async getConfigs(
    options: GetOutlookConfigsOptions = {}
  ): Promise<OutlookConfigWithRelations[]> {
    const where: Prisma.OutlookConfigWhereInput = {}

    if (options.cityId) {
      where.cityId = options.cityId
    }

    if (!options.includeInactive) {
      where.isActive = true
    }

    const configs = await this.prisma.outlookConfig.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, code: true } },
        filterRules: options.includeRules !== false
          ? { where: { isActive: true }, orderBy: { priority: 'asc' } }
          : false,
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: [
        { isGlobal: 'desc' },
        { city: { name: 'asc' } },
        { createdAt: 'desc' }
      ]
    })

    return configs as OutlookConfigWithRelations[]
  }

  /**
   * 取得單一配置
   */
  async getConfig(configId: string): Promise<OutlookConfigWithRelations | null> {
    const config = await this.prisma.outlookConfig.findUnique({
      where: { id: configId },
      include: this.getConfigInclude(true)
    })

    return config as OutlookConfigWithRelations | null
  }

  /**
   * 切換配置啟用狀態
   */
  async toggleActive(
    configId: string,
    isActive: boolean
  ): Promise<OutlookConfigWithRelations> {
    const config = await this.prisma.outlookConfig.update({
      where: { id: configId },
      data: { isActive },
      include: this.getConfigInclude()
    })

    return config as OutlookConfigWithRelations
  }

  /**
   * 軟刪除配置
   */
  async deleteConfig(configId: string): Promise<void> {
    await this.prisma.outlookConfig.update({
      where: { id: configId },
      data: { isActive: false }
    })
  }

  // ============================================
  // 連線測試
  // ============================================

  /**
   * 測試已儲存配置的連線
   */
  async testConnection(configId: string): Promise<OutlookConnectionTestResult> {
    const config = await this.prisma.outlookConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    try {
      // 解密客戶端密鑰
      const decryptedSecret = await this.encryption.decrypt(config.clientSecret)

      const result = await this.executeConnectionTest({
        mailboxAddress: config.mailboxAddress,
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: decryptedSecret
      })

      // 更新測試結果
      await this.updateTestResult(configId, result.success, result.error)

      return result

    } catch (error) {
      const errorMessage = this.parseGraphError(error)
      await this.updateTestResult(configId, false, errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 使用原始憑證測試連線 (未儲存的配置)
   */
  async testConnectionWithInput(
    input: TestConnectionInput
  ): Promise<OutlookConnectionTestResult> {
    try {
      return await this.executeConnectionTest(input)
    } catch (error) {
      return {
        success: false,
        error: this.parseGraphError(error)
      }
    }
  }

  /**
   * 執行連線測試
   */
  private async executeConnectionTest(
    credentials: TestConnectionInput
  ): Promise<OutlookConnectionTestResult> {
    const mailService = new OutlookMailService(
      {
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret
      },
      credentials.mailboxAddress
    )

    // 測試基本連線
    const testResult = await mailService.testMailboxAccess()

    if (!testResult.success) {
      return { success: false, error: testResult.error }
    }

    // 獲取詳細資訊
    const [mailboxInfo, recentCount, folders] = await Promise.all([
      mailService.getMailboxInfo(),
      mailService.getRecentMailCount(24),
      mailService.getMailFolders()
    ])

    return {
      success: true,
      details: {
        mailboxInfo: {
          displayName: mailboxInfo.displayName,
          email: mailboxInfo.mail
        },
        permissions: ['Mail.Read', 'Mail.ReadBasic'],
        recentMailCount: recentCount,
        folders: folders.slice(0, 10) // 限制返回數量
      }
    }
  }

  // ============================================
  // 過濾規則操作
  // ============================================

  /**
   * 新增過濾規則
   */
  async addFilterRule(
    configId: string,
    input: CreateFilterRuleInput
  ): Promise<OutlookFilterRule> {
    // 驗證配置存在
    await this.prisma.outlookConfig.findUniqueOrThrow({
      where: { id: configId }
    })

    // 取得目前最大優先級
    const maxPriority = await this.prisma.outlookFilterRule.aggregate({
      where: { configId },
      _max: { priority: true }
    })

    const nextPriority = input.priority ?? ((maxPriority._max.priority ?? -1) + 1)

    return this.prisma.outlookFilterRule.create({
      data: {
        configId,
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        ruleValue: input.ruleValue,
        ruleOperator: input.ruleOperator || 'EQUALS',
        isWhitelist: input.isWhitelist,
        priority: nextPriority
      }
    })
  }

  /**
   * 更新過濾規則
   */
  async updateFilterRule(
    ruleId: string,
    input: UpdateFilterRuleInput
  ): Promise<OutlookFilterRule> {
    return this.prisma.outlookFilterRule.update({
      where: { id: ruleId },
      data: {
        ...input,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 刪除過濾規則
   */
  async deleteFilterRule(ruleId: string): Promise<void> {
    await this.prisma.outlookFilterRule.delete({
      where: { id: ruleId }
    })
  }

  /**
   * 取得配置的所有過濾規則
   */
  async getFilterRules(configId: string): Promise<OutlookFilterRule[]> {
    return this.prisma.outlookFilterRule.findMany({
      where: { configId },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  }

  /**
   * 重新排序過濾規則
   */
  async reorderFilterRules(
    configId: string,
    ruleIds: string[]
  ): Promise<void> {
    // 驗證所有規則都屬於此配置
    const rules = await this.prisma.outlookFilterRule.findMany({
      where: { configId },
      select: { id: true }
    })

    const existingIds = new Set(rules.map(r => r.id))
    const invalidIds = ruleIds.filter(id => !existingIds.has(id))

    if (invalidIds.length > 0) {
      throw new Error(`無效的規則 ID: ${invalidIds.join(', ')}`)
    }

    // 批次更新優先級
    await this.prisma.$transaction(
      ruleIds.map((id, index) =>
        this.prisma.outlookFilterRule.update({
          where: { id },
          data: { priority: index }
        })
      )
    )
  }

  // ============================================
  // 私有輔助方法
  // ============================================

  /**
   * 驗證配置唯一性
   */
  private async validateConfigUniqueness(
    cityId?: string | null,
    isGlobal?: boolean
  ): Promise<void> {
    // 檢查城市配置唯一性
    if (cityId) {
      const existingCityConfig = await this.prisma.outlookConfig.findFirst({
        where: { cityId, isActive: true }
      })
      if (existingCityConfig) {
        throw new Error('此城市已有啟用的 Outlook 配置')
      }
    }

    // 檢查全域配置唯一性
    if (isGlobal) {
      const existingGlobalConfig = await this.prisma.outlookConfig.findFirst({
        where: { isGlobal: true, isActive: true }
      })
      if (existingGlobalConfig) {
        throw new Error('已存在啟用的全域 Outlook 配置')
      }
    }
  }

  /**
   * 更新測試結果
   */
  private async updateTestResult(
    configId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.prisma.outlookConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: success,
        lastTestError: error || null
      }
    })
  }

  /**
   * 解析 Microsoft Graph API 錯誤
   */
  private parseGraphError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Azure AD 認證錯誤
      if (message.includes('invalid_client')) {
        return '無效的應用程式 ID 或客戶端密鑰'
      }
      if (message.includes('invalid_tenant') ||
          (message.includes('tenant') && message.includes('not found'))) {
        return '找不到指定的租戶 ID，請確認 Azure AD 租戶設定'
      }
      if (message.includes('unauthorized_client')) {
        return '應用程式未被授權存取此資源'
      }

      // 郵箱存取錯誤
      if (message.includes('mailbox') && message.includes('not found')) {
        return '找不到指定的郵箱，請確認郵箱地址正確'
      }
      if (message.includes('access_denied') || message.includes('accessdenied')) {
        return '存取被拒絕，請確認應用程式已獲得 Mail.Read 權限'
      }
      if (message.includes('resourcenotfound')) {
        return '找不到指定的資源，請確認郵箱地址正確'
      }

      // 網路錯誤
      if (message.includes('network') || message.includes('econnrefused')) {
        return '網路連線失敗，請檢查網路設定'
      }
      if (message.includes('timeout')) {
        return '連線逾時，請稍後再試'
      }

      return error.message
    }

    return '未知錯誤'
  }

  /**
   * 取得配置關聯查詢
   */
  private getConfigInclude(includeAllRules = false) {
    return {
      city: { select: { id: true, name: true, code: true } },
      filterRules: includeAllRules
        ? { orderBy: { priority: 'asc' as const } }
        : { where: { isActive: true }, orderBy: { priority: 'asc' as const } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  }
}
```

### OutlookMailService 擴展

```typescript
// lib/services/outlook-mail.service.ts (擴展方法)

import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials'

export interface AzureCredentials {
  tenantId: string
  clientId: string
  clientSecret: string
}

export interface MailboxInfo {
  displayName: string
  mail: string
  userPrincipalName: string
}

export interface MailFolder {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
}

export class OutlookMailService {
  private client: Client
  private mailboxAddress: string

  constructor(credentials: AzureCredentials, mailboxAddress: string) {
    this.mailboxAddress = mailboxAddress

    const credential = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    )

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    })

    this.client = Client.initWithMiddleware({ authProvider })
  }

  /**
   * 測試郵箱存取權限
   */
  async testMailboxAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      // 嘗試讀取使用者資訊
      await this.client
        .api(`/users/${this.mailboxAddress}`)
        .select('id,displayName')
        .get()

      return { success: true }
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message }
      }
      return { success: false, error: '未知錯誤' }
    }
  }

  /**
   * 獲取郵箱資訊
   */
  async getMailboxInfo(): Promise<MailboxInfo> {
    const user = await this.client
      .api(`/users/${this.mailboxAddress}`)
      .select('displayName,mail,userPrincipalName')
      .get()

    return {
      displayName: user.displayName || '',
      mail: user.mail || user.userPrincipalName || '',
      userPrincipalName: user.userPrincipalName || ''
    }
  }

  /**
   * 獲取最近郵件數量
   */
  async getRecentMailCount(hours: number = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    try {
      const result = await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .filter(`receivedDateTime ge ${since}`)
        .count()
        .top(1)
        .get()

      return result['@odata.count'] || 0
    } catch (error) {
      // 如果計數失敗，嘗試獲取所有郵件並計數
      const result = await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .filter(`receivedDateTime ge ${since}`)
        .select('id')
        .top(1000)
        .get()

      return result.value?.length || 0
    }
  }

  /**
   * 獲取郵件資料夾列表
   */
  async getMailFolders(): Promise<MailFolder[]> {
    const result = await this.client
      .api(`/users/${this.mailboxAddress}/mailFolders`)
      .select('id,displayName,totalItemCount,unreadItemCount')
      .top(50)
      .get()

    return result.value.map((folder: any) => ({
      id: folder.id,
      displayName: folder.displayName,
      totalItemCount: folder.totalItemCount || 0,
      unreadItemCount: folder.unreadItemCount || 0
    }))
  }

  /**
   * 獲取特定資料夾的子資料夾
   */
  async getChildFolders(folderId: string): Promise<MailFolder[]> {
    const result = await this.client
      .api(`/users/${this.mailboxAddress}/mailFolders/${folderId}/childFolders`)
      .select('id,displayName,totalItemCount,unreadItemCount')
      .get()

    return result.value.map((folder: any) => ({
      id: folder.id,
      displayName: folder.displayName,
      totalItemCount: folder.totalItemCount || 0,
      unreadItemCount: folder.unreadItemCount || 0
    }))
  }
}
```

### FilterRuleEvaluator Service

```typescript
// lib/services/filter-rule-evaluator.service.ts

import { OutlookFilterRule, OutlookRuleType, RuleOperator } from '@prisma/client'
import { MailInfoForRules, RuleEvaluationResult } from '@/types/outlook-config.types'

export class FilterRuleEvaluator {
  /**
   * 評估郵件是否符合過濾規則
   */
  evaluate(
    mail: MailInfoForRules,
    rules: OutlookFilterRule[]
  ): RuleEvaluationResult {
    // 取得啟用的規則並按優先級排序
    const activeRules = rules
      .filter(r => r.isActive)
      .sort((a, b) => a.priority - b.priority)

    if (activeRules.length === 0) {
      return {
        allowed: true,
        reason: '沒有設定過濾規則，允許所有郵件'
      }
    }

    // 檢查是否有白名單規則
    const hasWhitelistRules = activeRules.some(r => r.isWhitelist)

    // 逐一評估規則
    for (const rule of activeRules) {
      const matched = this.matchRule(mail, rule)

      if (matched) {
        if (rule.isWhitelist) {
          return {
            allowed: true,
            matchedRule: rule,
            reason: `符合白名單規則: ${rule.name}`
          }
        } else {
          return {
            allowed: false,
            matchedRule: rule,
            reason: `符合黑名單規則: ${rule.name}`
          }
        }
      }
    }

    // 沒有匹配任何規則
    if (hasWhitelistRules) {
      // 有白名單規則但沒匹配，拒絕
      return {
        allowed: false,
        reason: '未符合任何白名單規則'
      }
    } else {
      // 只有黑名單規則且沒匹配，允許
      return {
        allowed: true,
        reason: '未符合任何黑名單規則'
      }
    }
  }

  /**
   * 匹配單一規則
   */
  private matchRule(
    mail: MailInfoForRules,
    rule: OutlookFilterRule
  ): boolean {
    const { ruleType, ruleValue, ruleOperator } = rule

    switch (ruleType) {
      case 'SENDER_EMAIL':
        return this.matchString(mail.senderEmail, ruleValue, ruleOperator)

      case 'SENDER_DOMAIN':
        const senderDomain = this.extractDomain(mail.senderEmail)
        return this.matchString(senderDomain, ruleValue, ruleOperator)

      case 'SENDER_NAME':
        return this.matchString(mail.senderName, ruleValue, ruleOperator)

      case 'SUBJECT_KEYWORD':
        return this.matchString(mail.subject, ruleValue, ruleOperator)

      case 'SUBJECT_REGEX':
        return this.matchRegex(mail.subject, ruleValue)

      case 'ATTACHMENT_TYPE':
        return mail.attachments.some(att =>
          this.matchString(
            this.getFileExtension(att.name),
            ruleValue,
            ruleOperator
          )
        )

      case 'ATTACHMENT_NAME':
        return mail.attachments.some(att =>
          this.matchString(att.name, ruleValue, ruleOperator)
        )

      case 'HAS_ATTACHMENT':
        const hasAttachment = mail.attachments.length > 0
        return ruleValue.toLowerCase() === 'true' ? hasAttachment : !hasAttachment

      case 'MAIL_FOLDER':
        return this.matchString(mail.folder, ruleValue, ruleOperator)

      default:
        return false
    }
  }

  /**
   * 字串匹配
   */
  private matchString(
    value: string,
    pattern: string,
    operator: RuleOperator
  ): boolean {
    const normalizedValue = value.toLowerCase()
    const normalizedPattern = pattern.toLowerCase()

    switch (operator) {
      case 'EQUALS':
        return normalizedValue === normalizedPattern

      case 'CONTAINS':
        return normalizedValue.includes(normalizedPattern)

      case 'STARTS_WITH':
        return normalizedValue.startsWith(normalizedPattern)

      case 'ENDS_WITH':
        return normalizedValue.endsWith(normalizedPattern)

      case 'REGEX':
        return this.matchRegex(value, pattern)

      case 'NOT_EQUALS':
        return normalizedValue !== normalizedPattern

      case 'NOT_CONTAINS':
        return !normalizedValue.includes(normalizedPattern)

      default:
        return false
    }
  }

  /**
   * 正則表達式匹配
   */
  private matchRegex(value: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i')
      return regex.test(value)
    } catch (error) {
      // 無效的正則表達式
      console.error(`Invalid regex pattern: ${pattern}`, error)
      return false
    }
  }

  /**
   * 從郵箱地址提取網域
   */
  private extractDomain(email: string): string {
    const atIndex = email.lastIndexOf('@')
    return atIndex >= 0 ? email.substring(atIndex) : ''
  }

  /**
   * 從檔案名稱提取副檔名
   */
  private getFileExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.')
    return dotIndex >= 0 ? filename.substring(dotIndex + 1).toLowerCase() : ''
  }
}
```

---

## API 路由設計

### 配置列表與建立

```typescript
// app/api/admin/integrations/outlook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import { createOutlookConfigSchema } from '@/lib/validations/outlook-config.schema'
import { z } from 'zod'

/**
 * GET /api/admin/integrations/outlook
 * 取得 Outlook 配置列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || undefined
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const service = new OutlookConfigService(prisma)
    const configs = await service.getConfigs({ cityId, includeInactive })

    // 遮蔽敏感資訊
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      clientSecret: '********'
    }))

    return NextResponse.json({
      success: true,
      data: sanitizedConfigs
    })

  } catch (error) {
    console.error('Failed to fetch Outlook configs:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取配置失敗' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/integrations/outlook
 * 建立新的 Outlook 配置
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = createOutlookConfigSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const config = await service.createConfig(validated, session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: '********'
      }
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: '資料驗證失敗',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message.includes('已有') || error.message.includes('已存在')) {
        return NextResponse.json(
          { error: 'ConflictError', message: error.message },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'BadRequest', message: error.message },
        { status: 400 }
      )
    }

    console.error('Failed to create Outlook config:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '建立配置失敗' },
      { status: 500 }
    )
  }
}
```

### 單一配置操作

```typescript
// app/api/admin/integrations/outlook/[configId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import { updateOutlookConfigSchema } from '@/lib/validations/outlook-config.schema'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ configId: string }>
}

/**
 * GET /api/admin/integrations/outlook/:configId
 * 取得單一配置詳情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const service = new OutlookConfigService(prisma)
    const config = await service.getConfig(configId)

    if (!config) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的配置' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: '********'
      }
    })

  } catch (error) {
    console.error('Failed to fetch Outlook config:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取配置失敗' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/integrations/outlook/:configId
 * 更新配置
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const body = await request.json()
    const validated = updateOutlookConfigSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const config = await service.updateConfig(configId, validated, session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: '********'
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: '資料驗證失敗',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的配置' },
        { status: 404 }
      )
    }

    console.error('Failed to update Outlook config:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '更新配置失敗' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/integrations/outlook/:configId
 * 軟刪除配置
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const service = new OutlookConfigService(prisma)
    await service.deleteConfig(configId)

    return NextResponse.json({
      success: true,
      message: '配置已停用'
    })

  } catch (error) {
    console.error('Failed to delete Outlook config:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '刪除配置失敗' },
      { status: 500 }
    )
  }
}
```

### 連線測試

```typescript
// app/api/admin/integrations/outlook/test/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import { testConnectionSchema } from '@/lib/validations/outlook-config.schema'
import { z } from 'zod'

/**
 * POST /api/admin/integrations/outlook/test
 * 使用原始憑證測試連線 (未儲存的配置)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = testConnectionSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const result = await service.testConnectionWithInput(validated)

    return NextResponse.json({
      success: result.success,
      data: result
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: '資料驗證失敗',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Connection test failed:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '連線測試失敗' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/integrations/outlook/[configId]/test/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'

interface RouteParams {
  params: Promise<{ configId: string }>
}

/**
 * POST /api/admin/integrations/outlook/:configId/test
 * 測試已儲存配置的連線
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const service = new OutlookConfigService(prisma)
    const result = await service.testConnection(configId)

    return NextResponse.json({
      success: result.success,
      data: result
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to read not found')) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的配置' },
        { status: 404 }
      )
    }

    console.error('Connection test failed:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '連線測試失敗' },
      { status: 500 }
    )
  }
}
```

### 過濾規則 API

```typescript
// app/api/admin/integrations/outlook/[configId]/rules/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import {
  createFilterRuleSchema,
  reorderRulesSchema
} from '@/lib/validations/outlook-config.schema'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ configId: string }>
}

/**
 * GET /api/admin/integrations/outlook/:configId/rules
 * 取得配置的過濾規則列表
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const service = new OutlookConfigService(prisma)
    const rules = await service.getFilterRules(configId)

    return NextResponse.json({
      success: true,
      data: rules
    })

  } catch (error) {
    console.error('Failed to fetch filter rules:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取規則失敗' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/integrations/outlook/:configId/rules
 * 新增過濾規則
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const body = await request.json()
    const validated = createFilterRuleSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const rule = await service.addFilterRule(configId, validated)

    return NextResponse.json({
      success: true,
      data: rule
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: '資料驗證失敗',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Record to read not found')) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的配置' },
        { status: 404 }
      )
    }

    console.error('Failed to create filter rule:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '建立規則失敗' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/integrations/outlook/:configId/rules
 * 重新排序規則
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { configId } = await params
    const body = await request.json()
    const { ruleIds } = reorderRulesSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    await service.reorderFilterRules(configId, ruleIds)

    return NextResponse.json({
      success: true,
      message: '規則順序已更新'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: '資料驗證失敗',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('無效的規則 ID')) {
      return NextResponse.json(
        { error: 'BadRequest', message: error.message },
        { status: 400 }
      )
    }

    console.error('Failed to reorder rules:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '更新排序失敗' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/admin/integrations/outlook/[configId]/rules/[ruleId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import { updateFilterRuleSchema } from '@/lib/validations/outlook-config.schema'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ configId: string; ruleId: string }>
}

/**
 * PUT /api/admin/integrations/outlook/:configId/rules/:ruleId
 * 更新過濾規則
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { ruleId } = await params
    const body = await request.json()
    const validated = updateFilterRuleSchema.parse(body)

    const service = new OutlookConfigService(prisma)
    const rule = await service.updateFilterRule(ruleId, validated)

    return NextResponse.json({
      success: true,
      data: rule
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: '資料驗證失敗',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的規則' },
        { status: 404 }
      )
    }

    console.error('Failed to update filter rule:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '更新規則失敗' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/integrations/outlook/:configId/rules/:ruleId
 * 刪除過濾規則
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: '需要管理員權限' },
        { status: 403 }
      )
    }

    const { ruleId } = await params
    const service = new OutlookConfigService(prisma)
    await service.deleteFilterRule(ruleId)

    return NextResponse.json({
      success: true,
      message: '規則已刪除'
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的規則' },
        { status: 404 }
      )
    }

    console.error('Failed to delete filter rule:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '刪除規則失敗' },
      { status: 500 }
    )
  }
}
```

---

## 前端元件

### OutlookConfigForm

```typescript
// components/admin/integrations/OutlookConfigForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  TestTube2,
  Save,
  Mail,
  Shield,
  Folder,
  HelpCircle,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

// Form Schema
const formSchema = z.object({
  name: z.string().min(1, '名稱為必填').max(100),
  description: z.string().max(500).optional(),
  mailboxAddress: z.string().email('請輸入有效的郵箱地址'),
  tenantId: z.string().min(1, '租戶 ID 為必填'),
  clientId: z.string().min(1, '應用程式 ID 為必填'),
  clientSecret: z.string().min(1, '客戶端密鑰為必填'),
  cityId: z.string().nullable(),
  isGlobal: z.boolean(),
  allowedExtensions: z.string(),
  maxAttachmentSizeMb: z.number().min(1).max(50)
})

type FormData = z.infer<typeof formSchema>

interface Props {
  configId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function OutlookConfigForm({ configId, onSuccess, onCancel }: Props) {
  const [showSecret, setShowSecret] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    error?: string
    details?: any
  } | null>(null)

  const queryClient = useQueryClient()
  const isEditing = Boolean(configId)

  // 獲取城市列表
  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities')
      if (!response.ok) throw new Error('Failed to fetch cities')
      const result = await response.json()
      return result.data || result
    }
  })

  // 獲取現有配置 (編輯模式)
  const { data: existingConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['outlook-config', configId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/integrations/outlook/${configId}`)
      if (!response.ok) throw new Error('Failed to fetch config')
      const result = await response.json()
      return result.data
    },
    enabled: isEditing
  })

  // 表單初始化
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      mailboxAddress: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      cityId: null,
      isGlobal: false,
      allowedExtensions: 'pdf,jpg,jpeg,png,tiff',
      maxAttachmentSizeMb: 30
    }
  })

  // 載入現有配置到表單
  useEffect(() => {
    if (existingConfig) {
      form.reset({
        name: existingConfig.name,
        description: existingConfig.description || '',
        mailboxAddress: existingConfig.mailboxAddress,
        tenantId: existingConfig.tenantId,
        clientId: existingConfig.clientId,
        clientSecret: '', // 不載入密鑰
        cityId: existingConfig.cityId,
        isGlobal: existingConfig.isGlobal,
        allowedExtensions: existingConfig.allowedExtensions?.join(',') || '',
        maxAttachmentSizeMb: existingConfig.maxAttachmentSizeMb
      })
    }
  }, [existingConfig, form])

  // 測試連線
  const testMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const endpoint = configId && !data.clientSecret
        ? `/api/admin/integrations/outlook/${configId}/test`
        : '/api/admin/integrations/outlook/test'

      const payload = configId && !data.clientSecret
        ? {}
        : {
            mailboxAddress: data.mailboxAddress,
            tenantId: data.tenantId,
            clientId: data.clientId,
            clientSecret: data.clientSecret
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Test failed')
      return result.data
    },
    onSuccess: (result) => {
      setTestResult(result)
      if (result.success) {
        toast.success('連線測試成功')
      } else {
        toast.error(`連線測試失敗: ${result.error}`)
      }
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message })
      toast.error('連線測試失敗')
    }
  })

  // 儲存配置
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const method = isEditing ? 'PUT' : 'POST'
      const endpoint = isEditing
        ? `/api/admin/integrations/outlook/${configId}`
        : '/api/admin/integrations/outlook'

      const payload = {
        ...data,
        allowedExtensions: data.allowedExtensions
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        // 編輯時如果沒有輸入新密鑰，不傳送
        ...(isEditing && !data.clientSecret ? { clientSecret: undefined } : {})
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Save failed')
      return result.data
    },
    onSuccess: () => {
      toast.success(isEditing ? '配置已更新' : '配置已建立')
      queryClient.invalidateQueries({ queryKey: ['outlook-configs'] })
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(error.message || '儲存失敗')
    }
  })

  const handleTest = () => {
    const values = form.getValues()

    // 驗證必填欄位
    if (!values.mailboxAddress || !values.tenantId || !values.clientId) {
      toast.error('請先填寫郵箱地址、租戶 ID 和應用程式 ID')
      return
    }

    // 新建立時需要密鑰
    if (!isEditing && !values.clientSecret) {
      toast.error('請填寫客戶端密鑰')
      return
    }

    testMutation.mutate(values)
  }

  const onSubmit = (data: FormData) => {
    // 新建立時需要密鑰
    if (!isEditing && !data.clientSecret) {
      form.setError('clientSecret', { message: '客戶端密鑰為必填' })
      return
    }
    saveMutation.mutate(data)
  }

  if (isEditing && isLoadingConfig) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本資訊 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              基本資訊
            </CardTitle>
            <CardDescription>
              設定配置的基本識別資訊
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>配置名稱 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：台北辦公室發票郵箱"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      關聯城市
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>選擇城市後，此配置只會處理該城市的文件</p>
                            <p>留空表示這是全域配置</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select
                      value={field.value || 'global'}
                      onValueChange={(value) => {
                        if (value === 'global') {
                          field.onChange(null)
                          form.setValue('isGlobal', true)
                        } else {
                          field.onChange(value)
                          form.setValue('isGlobal', false)
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇城市" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="global">
                          <span className="flex items-center gap-2">
                            🌐 全域配置
                          </span>
                        </SelectItem>
                        {cities?.map((city: any) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name} ({city.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="輸入配置的用途說明..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mailboxAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>郵箱地址 *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="invoice@yourcompany.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    系統將監控此郵箱的郵件附件
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Azure AD 設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Azure AD 設定
            </CardTitle>
            <CardDescription>
              在 Azure Portal 中註冊應用程式後取得以下資訊
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="tenantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>租戶 ID (Tenant ID) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Azure AD 目錄（租戶）識別碼
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>應用程式 ID (Client ID) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Azure AD 應用程式（用戶端）識別碼
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    客戶端密鑰 (Client Secret)
                    {!isEditing && ' *'}
                    {isEditing && (
                      <Badge variant="outline" className="ml-2">
                        留空保持原密鑰
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showSecret ? 'text' : 'password'}
                        placeholder={isEditing ? '輸入新密鑰或留空' : '輸入客戶端密鑰'}
                        className="pr-10"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Azure AD 應用程式的客戶端密鑰（會加密儲存）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 測試結果 */}
            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {testResult.success ? '連線測試成功' : '連線測試失敗'}
                </AlertTitle>
                <AlertDescription>
                  {testResult.success ? (
                    <div className="mt-2 space-y-1 text-sm">
                      <p>
                        <strong>郵箱：</strong>
                        {testResult.details?.mailboxInfo?.email}
                      </p>
                      <p>
                        <strong>顯示名稱：</strong>
                        {testResult.details?.mailboxInfo?.displayName}
                      </p>
                      {testResult.details?.recentMailCount !== undefined && (
                        <p>
                          <strong>最近 24 小時郵件：</strong>
                          {testResult.details.recentMailCount} 封
                        </p>
                      )}
                    </div>
                  ) : (
                    testResult.error
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testMutation.isPending}
              className="w-full"
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="mr-2 h-4 w-4" />
              )}
              測試連線
            </Button>
          </CardContent>
        </Card>

        {/* 附件過濾設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              附件過濾設定
            </CardTitle>
            <CardDescription>
              設定要處理的附件類型和大小限制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="allowedExtensions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>允許的副檔名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="pdf,jpg,jpeg,png,tiff"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      以逗號分隔多個副檔名
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxAttachmentSizeMb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最大附件大小 (MB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                      />
                    </FormControl>
                    <FormDescription>
                      建議不超過 50 MB
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? '更新配置' : '建立配置'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

### OutlookFilterRulesEditor

```typescript
// components/admin/integrations/OutlookFilterRulesEditor.tsx

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Filter,
  ShieldCheck,
  ShieldX,
  Loader2,
  Info
} from 'lucide-react'
import { toast } from 'sonner'

// 規則類型選項
const RULE_TYPES = [
  { value: 'SENDER_EMAIL', label: '寄件者 Email', placeholder: 'vendor@example.com' },
  { value: 'SENDER_DOMAIN', label: '寄件者網域', placeholder: '@example.com' },
  { value: 'SENDER_NAME', label: '寄件者名稱', placeholder: 'John Doe' },
  { value: 'SUBJECT_KEYWORD', label: '主旨關鍵字', placeholder: 'Invoice' },
  { value: 'SUBJECT_REGEX', label: '主旨正則表達式', placeholder: 'INV-\\d{4}' },
  { value: 'ATTACHMENT_TYPE', label: '附件類型', placeholder: 'pdf' },
  { value: 'ATTACHMENT_NAME', label: '附件名稱', placeholder: 'invoice' },
  { value: 'HAS_ATTACHMENT', label: '是否有附件', placeholder: 'true 或 false' }
] as const

// 比對方式選項
const OPERATORS = [
  { value: 'EQUALS', label: '等於' },
  { value: 'CONTAINS', label: '包含' },
  { value: 'STARTS_WITH', label: '開頭是' },
  { value: 'ENDS_WITH', label: '結尾是' },
  { value: 'REGEX', label: '正則匹配' },
  { value: 'NOT_EQUALS', label: '不等於' },
  { value: 'NOT_CONTAINS', label: '不包含' }
] as const

interface Rule {
  id: string
  name: string
  description?: string
  ruleType: string
  ruleValue: string
  ruleOperator: string
  isWhitelist: boolean
  isActive: boolean
  priority: number
}

interface Props {
  configId: string
}

// 可排序規則項目
function SortableRuleItem({
  rule,
  onEdit,
  onDelete,
  onToggle
}: {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const ruleTypeInfo = RULE_TYPES.find(t => t.value === rule.ruleType)
  const operatorInfo = OPERATORS.find(o => o.value === rule.ruleOperator)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-4 bg-background border rounded-lg
        ${isDragging ? 'shadow-lg' : ''}
        ${!rule.isActive ? 'opacity-60' : ''}
      `}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded touch-none"
        aria-label="拖曳排序"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{rule.name}</span>
          <Badge variant={rule.isWhitelist ? 'default' : 'destructive'} className="shrink-0">
            {rule.isWhitelist ? (
              <><ShieldCheck className="h-3 w-3 mr-1" />白名單</>
            ) : (
              <><ShieldX className="h-3 w-3 mr-1" />黑名單</>
            )}
          </Badge>
          {!rule.isActive && (
            <Badge variant="outline" className="shrink-0">已停用</Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">{ruleTypeInfo?.label}</span>
          {' '}{operatorInfo?.label}{' '}
          <code className="bg-muted px-1 rounded">{rule.ruleValue}</code>
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {rule.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={onToggle}
                  aria-label={rule.isActive ? '停用規則' : '啟用規則'}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {rule.isActive ? '點擊停用' : '點擊啟用'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

export function OutlookFilterRulesEditor({ configId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ruleType: 'SENDER_EMAIL',
    ruleValue: '',
    ruleOperator: 'CONTAINS',
    isWhitelist: true
  })

  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 獲取規則列表
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['outlook-filter-rules', configId],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/integrations/outlook/${configId}/rules`
      )
      if (!response.ok) throw new Error('Failed to fetch rules')
      const result = await response.json()
      return result.data as Rule[]
    }
  })

  // 建立/更新規則
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const method = editingRule ? 'PUT' : 'POST'
      const endpoint = editingRule
        ? `/api/admin/integrations/outlook/${configId}/rules/${editingRule.id}`
        : `/api/admin/integrations/outlook/${configId}/rules`

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Failed to save rule')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success(editingRule ? '規則已更新' : '規則已新增')
      queryClient.invalidateQueries({
        queryKey: ['outlook-filter-rules', configId]
      })
      handleCloseDialog()
    },
    onError: (error) => {
      toast.error(error.message || '儲存失敗')
    }
  })

  // 刪除規則
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(
        `/api/admin/integrations/outlook/${configId}/rules/${ruleId}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Failed to delete rule')
    },
    onSuccess: () => {
      toast.success('規則已刪除')
      queryClient.invalidateQueries({
        queryKey: ['outlook-filter-rules', configId]
      })
      setDeleteDialogOpen(false)
      setDeletingRuleId(null)
    },
    onError: () => {
      toast.error('刪除失敗')
    }
  })

  // 切換啟用狀態
  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const response = await fetch(
        `/api/admin/integrations/outlook/${configId}/rules/${ruleId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive })
        }
      )
      if (!response.ok) throw new Error('Failed to toggle rule')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['outlook-filter-rules', configId]
      })
    },
    onError: () => {
      toast.error('切換狀態失敗')
    }
  })

  // 重新排序
  const reorderMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      const response = await fetch(
        `/api/admin/integrations/outlook/${configId}/rules`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruleIds })
        }
      )
      if (!response.ok) throw new Error('Failed to reorder rules')
    },
    onError: () => {
      toast.error('排序失敗')
      queryClient.invalidateQueries({
        queryKey: ['outlook-filter-rules', configId]
      })
    }
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = rules.findIndex(r => r.id === active.id)
      const newIndex = rules.findIndex(r => r.id === over.id)
      const newOrder = arrayMove(rules, oldIndex, newIndex)

      // 樂觀更新
      queryClient.setQueryData(
        ['outlook-filter-rules', configId],
        newOrder
      )

      // 發送請求
      reorderMutation.mutate(newOrder.map(r => r.id))
    }
  }

  const handleOpenDialog = (rule?: Rule) => {
    if (rule) {
      setEditingRule(rule)
      setFormData({
        name: rule.name,
        description: rule.description || '',
        ruleType: rule.ruleType,
        ruleValue: rule.ruleValue,
        ruleOperator: rule.ruleOperator,
        isWhitelist: rule.isWhitelist
      })
    } else {
      setEditingRule(null)
      setFormData({
        name: '',
        description: '',
        ruleType: 'SENDER_EMAIL',
        ruleValue: '',
        ruleOperator: 'CONTAINS',
        isWhitelist: true
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingRule(null)
    setFormData({
      name: '',
      description: '',
      ruleType: 'SENDER_EMAIL',
      ruleValue: '',
      ruleOperator: 'CONTAINS',
      isWhitelist: true
    })
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('請輸入規則名稱')
      return
    }
    if (!formData.ruleValue.trim()) {
      toast.error('請輸入規則值')
      return
    }
    saveMutation.mutate(formData)
  }

  const handleDelete = (ruleId: string) => {
    setDeletingRuleId(ruleId)
    setDeleteDialogOpen(true)
  }

  const ruleTypeInfo = RULE_TYPES.find(t => t.value === formData.ruleType)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              過濾規則
            </CardTitle>
            <CardDescription>
              設定哪些郵件的附件會被處理
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            新增規則
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>尚未設定任何過濾規則</p>
              <p className="text-sm mt-1">所有郵件附件都會被處理</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rules.map(r => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {rules.map(rule => (
                    <SortableRuleItem
                      key={rule.id}
                      rule={rule}
                      onEdit={() => handleOpenDialog(rule)}
                      onDelete={() => handleDelete(rule.id)}
                      onToggle={(active) =>
                        toggleMutation.mutate({ ruleId: rule.id, isActive: active })
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* 規則說明 */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">規則處理邏輯：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>規則按順序評估（可拖曳調整順序）</li>
                  <li><strong>白名單規則</strong>：只處理符合條件的郵件</li>
                  <li><strong>黑名單規則</strong>：排除符合條件的郵件</li>
                  <li>如果有白名單規則，未匹配的郵件將被排除</li>
                  <li>如果只有黑名單規則，未匹配的郵件將被處理</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 新增/編輯規則對話框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? '編輯過濾規則' : '新增過濾規則'}
            </DialogTitle>
            <DialogDescription>
              設定郵件過濾條件
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">規則名稱 *</Label>
              <Input
                id="rule-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：只接收供應商郵件"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">描述</Label>
              <Textarea
                id="rule-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="輸入規則說明..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>規則類型 *</Label>
                <Select
                  value={formData.ruleType}
                  onValueChange={(v) => setFormData({ ...formData, ruleType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>比對方式</Label>
                <Select
                  value={formData.ruleOperator}
                  onValueChange={(v) => setFormData({ ...formData, ruleOperator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-value">規則值 *</Label>
              <Input
                id="rule-value"
                value={formData.ruleValue}
                onChange={(e) => setFormData({ ...formData, ruleValue: e.target.value })}
                placeholder={ruleTypeInfo?.placeholder || '輸入規則值'}
              />
            </div>

            <div className="space-y-2">
              <Label>規則模式</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.isWhitelist ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData({ ...formData, isWhitelist: true })}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  白名單
                </Button>
                <Button
                  type="button"
                  variant={!formData.isWhitelist ? 'destructive' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData({ ...formData, isWhitelist: false })}
                >
                  <ShieldX className="h-4 w-4 mr-2" />
                  黑名單
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.isWhitelist
                  ? '白名單：只處理符合此規則的郵件'
                  : '黑名單：排除符合此規則的郵件'
                }
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRule ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此規則？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原，規則將被永久刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRuleId && deleteMutation.mutate(deletingRuleId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

### OutlookConfigList

```typescript
// components/admin/integrations/OutlookConfigList.tsx

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Mail,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  TestTube2,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Globe
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toast } from 'sonner'

interface OutlookConfig {
  id: string
  name: string
  description?: string
  mailboxAddress: string
  cityId?: string
  city?: { id: string; name: string; code: string }
  isGlobal: boolean
  isActive: boolean
  lastTestedAt?: string
  lastTestResult?: boolean
  lastTestError?: string
  totalProcessed: number
  lastProcessedAt?: string
  filterRules?: any[]
  createdBy?: { id: string; name: string }
}

interface Props {
  onEdit: (configId: string) => void
  onNew: () => void
  onManageRules: (configId: string) => void
}

export function OutlookConfigList({ onEdit, onNew, onManageRules }: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // 獲取配置列表
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['outlook-configs'],
    queryFn: async () => {
      const response = await fetch('/api/admin/integrations/outlook')
      if (!response.ok) throw new Error('Failed to fetch configs')
      const result = await response.json()
      return result.data as OutlookConfig[]
    }
  })

  // 切換啟用狀態
  const toggleMutation = useMutation({
    mutationFn: async ({ configId, isActive }: { configId: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/integrations/outlook/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })
      if (!response.ok) throw new Error('Failed to toggle config')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-configs'] })
    },
    onError: () => {
      toast.error('切換狀態失敗')
    }
  })

  // 刪除配置
  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/admin/integrations/outlook/${configId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete config')
    },
    onSuccess: () => {
      toast.success('配置已停用')
      queryClient.invalidateQueries({ queryKey: ['outlook-configs'] })
      setDeleteDialogOpen(false)
      setDeletingConfigId(null)
    },
    onError: () => {
      toast.error('刪除失敗')
    }
  })

  // 測試連線
  const testMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(
        `/api/admin/integrations/outlook/${configId}/test`,
        { method: 'POST' }
      )
      const result = await response.json()
      return result.data
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('連線測試成功')
      } else {
        toast.error(`連線測試失敗: ${result.error}`)
      }
      queryClient.invalidateQueries({ queryKey: ['outlook-configs'] })
    },
    onError: () => {
      toast.error('連線測試失敗')
    }
  })

  const handleDelete = (configId: string) => {
    setDeletingConfigId(configId)
    setDeleteDialogOpen(true)
  }

  const getTestStatusBadge = (config: OutlookConfig) => {
    if (!config.lastTestedAt) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          未測試
        </Badge>
      )
    }

    if (config.lastTestResult) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          連線正常
        </Badge>
      )
    }

    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        連線失敗
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Outlook 配置</h2>
            <p className="text-sm text-muted-foreground">
              管理郵箱連線設定和過濾規則
            </p>
          </div>
          <Button onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            新增配置
          </Button>
        </div>

        {configs.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">尚未設定任何 Outlook 配置</p>
                <p className="text-sm mt-1">點擊上方按鈕新增第一個配置</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {configs.map(config => (
              <Card
                key={config.id}
                className={!config.isActive ? 'opacity-60' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {config.isGlobal ? (
                          <Globe className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Mail className="h-5 w-5" />
                        )}
                        {config.name}
                        {!config.isActive && (
                          <Badge variant="secondary">已停用</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{config.mailboxAddress}</span>
                        {config.city && (
                          <Badge variant="outline">
                            {config.city.name}
                          </Badge>
                        )}
                        {config.isGlobal && (
                          <Badge variant="outline" className="bg-blue-50">
                            全域
                          </Badge>
                        )}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({
                            configId: config.id,
                            isActive: checked
                          })
                        }
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(config.id)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            編輯配置
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onManageRules(config.id)}>
                            <Filter className="h-4 w-4 mr-2" />
                            管理規則
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => testMutation.mutate(config.id)}
                            disabled={testMutation.isPending}
                          >
                            <TestTube2 className="h-4 w-4 mr-2" />
                            測試連線
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(config.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            刪除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      {getTestStatusBadge(config)}
                      <span className="text-muted-foreground">
                        {config.filterRules?.length || 0} 個過濾規則
                      </span>
                      <span className="text-muted-foreground">
                        已處理 {config.totalProcessed} 封郵件
                      </span>
                    </div>
                    {config.lastTestedAt && (
                      <span className="text-muted-foreground text-xs">
                        上次測試：
                        {formatDistanceToNow(new Date(config.lastTestedAt), {
                          addSuffix: true,
                          locale: zhTW
                        })}
                      </span>
                    )}
                  </div>
                  {config.lastTestResult === false && config.lastTestError && (
                    <p className="text-xs text-destructive mt-2">
                      錯誤：{config.lastTestError}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要停用此配置？</AlertDialogTitle>
            <AlertDialogDescription>
              配置停用後將不再處理對應郵箱的郵件。您可以稍後重新啟用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingConfigId && deleteMutation.mutate(deletingConfigId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

---

## 測試規格

### 單元測試

```typescript
// __tests__/services/outlook-config.service.test.ts

import { OutlookConfigService } from '@/lib/services/outlook-config.service'
import { PrismaClient } from '@prisma/client'
import { mockDeep, DeepMockProxy } from 'jest-mock-extended'

describe('OutlookConfigService', () => {
  let service: OutlookConfigService
  let prisma: DeepMockProxy<PrismaClient>

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new OutlookConfigService(prisma)
  })

  describe('createConfig', () => {
    it('should create config with encrypted secret', async () => {
      const input = {
        name: 'Test Config',
        mailboxAddress: 'test@company.com',
        tenantId: '00000000-0000-0000-0000-000000000000',
        clientId: '00000000-0000-0000-0000-000000000001',
        clientSecret: 'test-secret'
      }

      prisma.outlookConfig.findFirst.mockResolvedValue(null)
      prisma.outlookConfig.create.mockResolvedValue({
        id: 'config-1',
        ...input,
        clientSecret: 'encrypted-secret',
        isActive: true,
        isGlobal: false
      } as any)

      const result = await service.createConfig(input, 'user-1')

      expect(result.name).toBe('Test Config')
      expect(prisma.outlookConfig.create).toHaveBeenCalled()
      // 驗證密鑰已加密 (非原始值)
      const createCall = prisma.outlookConfig.create.mock.calls[0][0]
      expect(createCall.data.clientSecret).not.toBe('test-secret')
    })

    it('should reject duplicate city config', async () => {
      prisma.outlookConfig.findFirst.mockResolvedValue({
        id: 'existing-config',
        cityId: 'city-1'
      } as any)

      await expect(
        service.createConfig(
          {
            name: 'Test',
            mailboxAddress: 'test@company.com',
            tenantId: '00000000-0000-0000-0000-000000000000',
            clientId: '00000000-0000-0000-0000-000000000001',
            clientSecret: 'secret',
            cityId: 'city-1'
          },
          'user-1'
        )
      ).rejects.toThrow('此城市已有啟用的 Outlook 配置')
    })

    it('should reject duplicate global config', async () => {
      prisma.outlookConfig.findFirst
        .mockResolvedValueOnce(null) // cityId check
        .mockResolvedValueOnce({ id: 'global-config', isGlobal: true } as any)

      await expect(
        service.createConfig(
          {
            name: 'Test',
            mailboxAddress: 'test@company.com',
            tenantId: '00000000-0000-0000-0000-000000000000',
            clientId: '00000000-0000-0000-0000-000000000001',
            clientSecret: 'secret',
            isGlobal: true
          },
          'user-1'
        )
      ).rejects.toThrow('已存在啟用的全域 Outlook 配置')
    })
  })

  describe('testConnection', () => {
    it('should return success for valid credentials', async () => {
      const mockConfig = {
        id: 'config-1',
        tenantId: 'tenant-id',
        clientId: 'client-id',
        clientSecret: 'encrypted-secret',
        mailboxAddress: 'test@company.com'
      }

      prisma.outlookConfig.findUniqueOrThrow.mockResolvedValue(mockConfig as any)
      prisma.outlookConfig.update.mockResolvedValue({} as any)

      // Mock OutlookMailService
      jest.mock('@/lib/services/outlook-mail.service', () => ({
        OutlookMailService: jest.fn().mockImplementation(() => ({
          testMailboxAccess: jest.fn().mockResolvedValue({ success: true }),
          getMailboxInfo: jest.fn().mockResolvedValue({
            displayName: 'Test User',
            mail: 'test@company.com'
          }),
          getRecentMailCount: jest.fn().mockResolvedValue(10),
          getMailFolders: jest.fn().mockResolvedValue([])
        }))
      }))

      const result = await service.testConnection('config-1')

      expect(result.success).toBe(true)
      expect(result.details?.mailboxInfo).toBeDefined()
    })

    it('should return error for invalid credentials', async () => {
      const mockConfig = {
        id: 'config-1',
        tenantId: 'invalid-tenant',
        clientId: 'client-id',
        clientSecret: 'encrypted-secret',
        mailboxAddress: 'test@company.com'
      }

      prisma.outlookConfig.findUniqueOrThrow.mockResolvedValue(mockConfig as any)
      prisma.outlookConfig.update.mockResolvedValue({} as any)

      // Mock failed connection
      jest.mock('@/lib/services/outlook-mail.service', () => ({
        OutlookMailService: jest.fn().mockImplementation(() => ({
          testMailboxAccess: jest.fn().mockResolvedValue({
            success: false,
            error: 'Invalid tenant'
          })
        }))
      }))

      const result = await service.testConnection('config-1')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('addFilterRule', () => {
    it('should create rule with auto-incremented priority', async () => {
      prisma.outlookConfig.findUniqueOrThrow.mockResolvedValue({ id: 'config-1' } as any)
      prisma.outlookFilterRule.aggregate.mockResolvedValue({
        _max: { priority: 2 }
      } as any)
      prisma.outlookFilterRule.create.mockResolvedValue({
        id: 'rule-1',
        name: 'Test Rule',
        priority: 3
      } as any)

      const result = await service.addFilterRule('config-1', {
        name: 'Test Rule',
        ruleType: 'SENDER_DOMAIN',
        ruleValue: '@vendor.com',
        isWhitelist: true
      })

      expect(result.priority).toBe(3)
    })
  })

  describe('reorderFilterRules', () => {
    it('should update priorities based on new order', async () => {
      prisma.outlookFilterRule.findMany.mockResolvedValue([
        { id: 'rule-1' },
        { id: 'rule-2' },
        { id: 'rule-3' }
      ] as any)
      prisma.$transaction.mockResolvedValue([])

      await service.reorderFilterRules('config-1', ['rule-3', 'rule-1', 'rule-2'])

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should reject invalid rule IDs', async () => {
      prisma.outlookFilterRule.findMany.mockResolvedValue([
        { id: 'rule-1' },
        { id: 'rule-2' }
      ] as any)

      await expect(
        service.reorderFilterRules('config-1', ['rule-1', 'rule-invalid'])
      ).rejects.toThrow('無效的規則 ID')
    })
  })
})
```

### 過濾規則評估測試

```typescript
// __tests__/services/filter-rule-evaluator.service.test.ts

import { FilterRuleEvaluator } from '@/lib/services/filter-rule-evaluator.service'
import { OutlookFilterRule, OutlookRuleType, RuleOperator } from '@prisma/client'

describe('FilterRuleEvaluator', () => {
  let evaluator: FilterRuleEvaluator

  beforeEach(() => {
    evaluator = new FilterRuleEvaluator()
  })

  const createRule = (
    overrides: Partial<OutlookFilterRule> = {}
  ): OutlookFilterRule => ({
    id: 'rule-1',
    configId: 'config-1',
    name: 'Test Rule',
    description: null,
    ruleType: 'SENDER_EMAIL' as OutlookRuleType,
    ruleValue: 'test@vendor.com',
    ruleOperator: 'EQUALS' as RuleOperator,
    isWhitelist: true,
    isActive: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })

  const createMail = (overrides = {}) => ({
    senderEmail: 'sender@example.com',
    senderName: 'Test Sender',
    subject: 'Test Subject',
    attachments: [{ name: 'invoice.pdf', contentType: 'application/pdf', size: 1000 }],
    folder: 'inbox',
    ...overrides
  })

  describe('whitelist rules', () => {
    it('should allow email matching whitelist rule', () => {
      const rules = [
        createRule({
          ruleType: 'SENDER_EMAIL',
          ruleValue: 'vendor@example.com',
          ruleOperator: 'EQUALS',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({ senderEmail: 'vendor@example.com' }),
        rules
      )

      expect(result.allowed).toBe(true)
      expect(result.matchedRule?.id).toBe('rule-1')
    })

    it('should block email not matching any whitelist rule', () => {
      const rules = [
        createRule({
          ruleType: 'SENDER_DOMAIN',
          ruleValue: '@vendor.com',
          ruleOperator: 'ENDS_WITH',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({ senderEmail: 'other@different.com' }),
        rules
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('未符合任何白名單')
    })
  })

  describe('blacklist rules', () => {
    it('should block email matching blacklist rule', () => {
      const rules = [
        createRule({
          ruleType: 'SENDER_DOMAIN',
          ruleValue: '@spam.com',
          ruleOperator: 'ENDS_WITH',
          isWhitelist: false
        })
      ]

      const result = evaluator.evaluate(
        createMail({ senderEmail: 'sender@spam.com' }),
        rules
      )

      expect(result.allowed).toBe(false)
      expect(result.matchedRule?.isWhitelist).toBe(false)
    })

    it('should allow email not matching any blacklist rule', () => {
      const rules = [
        createRule({
          ruleType: 'SUBJECT_KEYWORD',
          ruleValue: 'spam',
          ruleOperator: 'CONTAINS',
          isWhitelist: false
        })
      ]

      const result = evaluator.evaluate(
        createMail({ subject: 'Important Invoice' }),
        rules
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toContain('未符合任何黑名單')
    })
  })

  describe('rule operators', () => {
    it('should match CONTAINS operator', () => {
      const rules = [
        createRule({
          ruleType: 'SUBJECT_KEYWORD',
          ruleValue: 'Invoice',
          ruleOperator: 'CONTAINS',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({ subject: 'Your Invoice #12345' }),
        rules
      )

      expect(result.allowed).toBe(true)
    })

    it('should match REGEX operator', () => {
      const rules = [
        createRule({
          ruleType: 'SUBJECT_REGEX',
          ruleValue: 'INV-\\d{4}',
          ruleOperator: 'REGEX',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({ subject: 'Payment for INV-2024' }),
        rules
      )

      expect(result.allowed).toBe(true)
    })

    it('should match NOT_CONTAINS operator', () => {
      const rules = [
        createRule({
          ruleType: 'SUBJECT_KEYWORD',
          ruleValue: 'unsubscribe',
          ruleOperator: 'NOT_CONTAINS',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({ subject: 'Invoice Attached' }),
        rules
      )

      expect(result.allowed).toBe(true)
    })
  })

  describe('attachment rules', () => {
    it('should match attachment type', () => {
      const rules = [
        createRule({
          ruleType: 'ATTACHMENT_TYPE',
          ruleValue: 'pdf',
          ruleOperator: 'EQUALS',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({
          attachments: [{ name: 'document.pdf', contentType: 'application/pdf', size: 1000 }]
        }),
        rules
      )

      expect(result.allowed).toBe(true)
    })

    it('should check HAS_ATTACHMENT rule', () => {
      const rules = [
        createRule({
          ruleType: 'HAS_ATTACHMENT',
          ruleValue: 'true',
          ruleOperator: 'EQUALS',
          isWhitelist: true
        })
      ]

      const resultWithAttachment = evaluator.evaluate(
        createMail({ attachments: [{ name: 'file.pdf', contentType: 'application/pdf', size: 100 }] }),
        rules
      )
      expect(resultWithAttachment.allowed).toBe(true)

      const resultWithoutAttachment = evaluator.evaluate(
        createMail({ attachments: [] }),
        rules
      )
      expect(resultWithoutAttachment.allowed).toBe(false)
    })
  })

  describe('rule priority', () => {
    it('should evaluate rules in priority order', () => {
      const rules = [
        createRule({
          id: 'rule-1',
          priority: 1,
          ruleType: 'SENDER_DOMAIN',
          ruleValue: '@all.com',
          isWhitelist: false
        }),
        createRule({
          id: 'rule-2',
          priority: 0, // Higher priority (lower number)
          ruleType: 'SENDER_EMAIL',
          ruleValue: 'vip@all.com',
          isWhitelist: true
        })
      ]

      const result = evaluator.evaluate(
        createMail({ senderEmail: 'vip@all.com' }),
        rules
      )

      // Should match rule-2 first due to higher priority
      expect(result.allowed).toBe(true)
      expect(result.matchedRule?.id).toBe('rule-2')
    })
  })

  describe('inactive rules', () => {
    it('should skip inactive rules', () => {
      const rules = [
        createRule({
          isActive: false,
          ruleType: 'SENDER_EMAIL',
          ruleValue: 'blocked@example.com',
          isWhitelist: false
        })
      ]

      const result = evaluator.evaluate(
        createMail({ senderEmail: 'blocked@example.com' }),
        rules
      )

      // Should be allowed because rule is inactive
      expect(result.allowed).toBe(true)
    })
  })
})
```

### API 整合測試

```typescript
// __tests__/api/admin/integrations/outlook.test.ts

import { createMocks } from 'node-mocks-http'
import { GET, POST } from '@/app/api/admin/integrations/outlook/route'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    outlookConfig: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn()
    }
  }
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

describe('Outlook Config API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/admin/integrations/outlook', () => {
    it('should return 403 for non-admin users', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-1', role: 'USER' }
      })

      const { req } = createMocks({ method: 'GET' })
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should return configs for admin users', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' }
      })

      const mockConfigs = [
        {
          id: 'config-1',
          name: 'Test Config',
          mailboxAddress: 'test@company.com',
          clientSecret: 'encrypted-secret',
          isActive: true
        }
      ]

      ;(prisma.outlookConfig.findMany as jest.Mock).mockResolvedValue(mockConfigs)

      const { req } = createMocks({ method: 'GET' })
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data[0].clientSecret).toBe('********')
    })
  })

  describe('POST /api/admin/integrations/outlook', () => {
    it('should create config with valid input', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' }
      })

      ;(prisma.outlookConfig.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.outlookConfig.create as jest.Mock).mockResolvedValue({
        id: 'new-config',
        name: 'New Config',
        mailboxAddress: 'new@company.com',
        clientSecret: 'encrypted',
        isActive: true
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          name: 'New Config',
          mailboxAddress: 'new@company.com',
          tenantId: '00000000-0000-0000-0000-000000000000',
          clientId: '00000000-0000-0000-0000-000000000001',
          clientSecret: 'test-secret'
        }
      })

      const response = await POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.clientSecret).toBe('********')
    })

    it('should return 400 for invalid input', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' }
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          name: '', // Empty name should fail validation
          mailboxAddress: 'invalid-email'
        }
      })

      const response = await POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('ValidationError')
    })
  })
})
```

### E2E 測試

```typescript
// e2e/outlook-config.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Outlook Config Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'admin-password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display Outlook config list', async ({ page }) => {
    await page.goto('/admin/settings/integrations')

    await expect(page.getByText('Outlook 配置')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增配置' })).toBeVisible()
  })

  test('should create new Outlook config', async ({ page }) => {
    await page.goto('/admin/settings/integrations')

    // Click new config button
    await page.click('button:has-text("新增配置")')

    // Fill form
    await page.fill('[name="name"]', 'Test Outlook Config')
    await page.fill('[name="mailboxAddress"]', 'test@company.com')
    await page.fill('[name="tenantId"]', '00000000-0000-0000-0000-000000000000')
    await page.fill('[name="clientId"]', '00000000-0000-0000-0000-000000000001')
    await page.fill('[name="clientSecret"]', 'test-secret')

    // Save
    await page.click('button:has-text("建立配置")')

    // Verify success
    await expect(page.getByText('配置已建立')).toBeVisible()
    await expect(page.getByText('Test Outlook Config')).toBeVisible()
  })

  test('should test connection', async ({ page }) => {
    await page.goto('/admin/settings/integrations')

    // Open existing config menu
    await page.click('button[aria-label="更多選項"]')
    await page.click('text=測試連線')

    // Wait for test result
    await expect(
      page.getByText(/連線測試(成功|失敗)/)
    ).toBeVisible({ timeout: 10000 })
  })

  test('should manage filter rules', async ({ page }) => {
    await page.goto('/admin/settings/integrations')

    // Open rules editor
    await page.click('button[aria-label="更多選項"]')
    await page.click('text=管理規則')

    // Add new rule
    await page.click('button:has-text("新增規則")')
    await page.fill('[name="rule-name"]', 'Vendor Whitelist')
    await page.click('[role="combobox"]:has-text("規則類型")')
    await page.click('text=寄件者網域')
    await page.fill('[name="rule-value"]', '@vendor.com')
    await page.click('button:has-text("白名單")')
    await page.click('button:has-text("新增")')

    // Verify rule created
    await expect(page.getByText('Vendor Whitelist')).toBeVisible()
    await expect(page.getByText('@vendor.com')).toBeVisible()
  })

  test('should drag and drop to reorder rules', async ({ page }) => {
    await page.goto('/admin/settings/integrations')

    // Navigate to rules
    await page.click('button[aria-label="更多選項"]')
    await page.click('text=管理規則')

    // Get first and second rule handles
    const handles = page.locator('[aria-label="拖曳排序"]')
    const firstHandle = handles.first()
    const secondHandle = handles.nth(1)

    // Perform drag and drop
    await firstHandle.dragTo(secondHandle)

    // Verify order changed (check network request or visual order)
    await expect(page.getByText('排序失敗')).not.toBeVisible()
  })
})
```

---

## 驗收標準對照

| AC 編號 | 驗收標準 | 實作內容 | 狀態 |
|---------|----------|----------|------|
| AC1 | 連線配置表單 | `OutlookConfigForm` 元件提供完整表單，包含郵箱地址、Azure AD 租戶 ID、應用程式 ID、客戶端密鑰（加密儲存） | ✅ |
| AC2 | 連線測試 | `testConnection()` 和 `testConnectionWithInput()` 方法驗證連線設定，顯示成功/失敗結果及詳細資訊 | ✅ |
| AC3 | 城市級別配置 | `OutlookConfig.cityId` 欄位支援城市關聯，每個城市最多一個啟用的配置，支援全域配置 | ✅ |
| AC4 | 郵件過濾規則 | `OutlookFilterRule` 模型支援寄件者白名單/黑名單、主旨關鍵字、附件類型過濾，`OutlookFilterRulesEditor` 提供可視化編輯器 | ✅ |

---

## 相依性

### 前置 Stories
- **Story 9-3**: Outlook 郵件附件擷取 API（提供 OutlookConfig 基礎模型定義）

### 外部相依
- `@microsoft/microsoft-graph-client` - Microsoft Graph API 用戶端
- `@azure/identity` - Azure AD 認證
- `@dnd-kit/core`, `@dnd-kit/sortable` - 拖曳排序功能
- `date-fns` - 日期格式化

### 後續 Stories
- **Story 9-5**: 自動擷取來源追蹤（使用 OutlookConfig 配置進行文件來源追蹤）

---

## 部署注意事項

### 環境變數

```env
# 加密密鑰 (用於加密客戶端密鑰)
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Azure AD 設定 (可選，用於測試環境)
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
```

### 資料庫遷移

```bash
# 生成遷移
npx prisma migrate dev --name add_outlook_filter_rules_enhancements

# 執行遷移
npx prisma migrate deploy
```

### Azure AD 應用程式權限設定

1. 在 Azure Portal 註冊應用程式
2. 配置 API 權限：
   - Microsoft Graph > Application permissions
   - `Mail.Read` - 讀取所有使用者郵件
   - `Mail.ReadBasic.All` - 讀取基本郵件資訊
   - `User.Read.All` - 讀取使用者資訊（用於連線測試）
3. 由管理員授予同意

---

## 備註

### 安全性考量

1. **客戶端密鑰加密** - 使用 AES-256-GCM 加密儲存
2. **權限控制** - 僅 ADMIN 角色可存取配置管理 API
3. **敏感資訊遮蔽** - API 回應中遮蔽客戶端密鑰
4. **連線測試隔離** - 測試時不修改實際配置狀態

### 效能考量

1. **規則評估最佳化** - 規則按優先級排序後快取
2. **並行載入** - 連線測試時並行獲取郵箱資訊
3. **樂觀更新** - 拖曳排序時使用樂觀更新提升體驗
