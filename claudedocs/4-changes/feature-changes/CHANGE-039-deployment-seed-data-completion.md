# CHANGE-039: 部署 Seed 數據完善 — 新環境可直接運行

> **日期**: 2026-02-13
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Feature Enhancement
> **影響範圍**: `prisma/seed.ts`、seed-data 模組、`.env.example`

---

## 變更背景

### 現有問題

現有 seed 覆蓋率約 **60-65%**。基礎的 RBAC、區域/城市、公司、映射規則、系統配置已涵蓋，但部署到全新環境後存在以下關鍵缺口，導致系統無法直接使用核心功能：

| # | 資料類別 | 現況 | 影響 |
|---|----------|------|------|
| 1 | 生產 Admin 帳號 | 🔴 無可登入帳號 | 無法登入系統進行配置 |
| 2 | PromptConfig | 🔴 無硬編碼 seed | AI 提取管線完全無法運行 |
| 3 | FieldMappingConfig | 🔴 無 seed | 欄位映射配置層缺失 |
| 4 | AlertRule | 🔴 無 seed | 系統不會產生任何告警 |
| 5 | ExchangeRate | 🔴 無 seed | V3.1 匯率轉換步驟失敗 |
| 6 | .env.example | ⚠️ 不完整 | 缺少 UPSTASH_REDIS_*、N8N_* 等變數 |

### 已有涵蓋範圍（10/20 項完整）

| # | 資料類別 | Seed 現況 | 狀態 |
|---|----------|-----------|------|
| 1 | 角色 (Role) | 6 個系統角色 + 22 個權限 | ✅ |
| 2 | 區域 (Region) | 4 個 (GLOBAL/APAC/EMEA/AMER) | ✅ |
| 3 | 城市 (City) | 10 個 (TPE/HKG/SGP/TYO/SHA/SYD/LON/FRA/NYC/LAX) | ✅ |
| 4 | 公司/Forwarder | 15 家 (Express 4 + Ocean 8 + Regional 2 + Unknown 1) | ✅ |
| 5 | 映射規則 (MappingRule) | ~33 條 (25 通用 + 公司特定) | ✅ |
| 6 | 系統配置 (SystemConfig) | ~30 項 (5 類別) | ✅ |
| 7 | 資料範本 (DataTemplate) | 3 個 (ERP 標準/費用報表/物流追蹤) | ✅ |
| 8 | 範本欄位映射 (TemplateFieldMapping) | 1 組 (ERP 標準 GLOBAL) | ✅ |
| 9 | Pipeline 配置 (PipelineConfig) | 1 個 GLOBAL (預設 disabled) | ✅ |
| 10 | 系統帳號 | system@..internal + dev@example.com | ⚠️ 部分 |

### 目標

完善 seed 數據，使得新環境部署後：
1. 有可登入的 Admin 帳號（Credentials provider）
2. AI 提取管線有基礎 prompt 可運行
3. 欄位映射配置有預設值
4. 關鍵系統告警自動生效
5. 基礎匯率資料可用
6. `.env.example` 包含所有必要變數

---

## 變更內容

### 1. 生產 Admin 帳號（🔴 P0 — 最高優先）

#### 現有行為

seed 只建立了：
- `system@ai-document-extraction.internal` — 系統帳號，**沒有密碼**，無法登入
- `dev@example.com` (id: `dev-user-1`) — 開發帳號，依賴 Dev Login 機制

#### 變更方案

在 `seed.ts` 新增一個含密碼的 Credentials 帳號：

```typescript
// 生產 Admin 帳號（可透過 Credentials provider 登入）
const adminUser = await prisma.user.upsert({
  where: { email: 'admin@ai-document-extraction.com' },
  update: { status: 'ACTIVE' },
  create: {
    email: 'admin@ai-document-extraction.com',
    name: 'Admin',
    password: await hashPassword('ChangeMe@2026!'),  // bcryptjs hash
    status: 'ACTIVE',
    isGlobalAdmin: true,
    emailVerified: new Date(),
    roles: {
      create: { roleId: systemAdminRole.id },
    },
  },
})
```

**安全考量**:
- 預設密碼 `ChangeMe@2026!` 符合密碼強度規則（大小寫+數字+特殊字符+12 位以上）
- seed.ts 中加入 `console.warn` 提醒生產環境必須立即修改密碼
- 密碼使用 bcryptjs 12 rounds hash 存儲

**依賴**: 需要在 seed.ts 中 import `bcryptjs` 或使用 `src/lib/password.ts` 的 `hashPassword`

---

### 2. PromptConfig Seed（🔴 P0）

#### 現有行為

PromptConfig 完全沒有硬編碼 seed，僅依賴 `exported-data.json` 恢復。全新部署時 AI 提取管線的所有階段都無法運行。

#### 變更方案

新建 `prisma/seed-data/prompt-configs.ts`，提供 5 個 GLOBAL scope 的基礎 PromptConfig：

| # | promptType | scope | 名稱 | 用途 |
|---|-----------|-------|------|------|
| 1 | `STAGE_1_COMPANY_IDENTIFICATION` | GLOBAL | 公司識別 Prompt | V3.1 階段一：從文件識別發行公司 |
| 2 | `STAGE_2_FORMAT_IDENTIFICATION` | GLOBAL | 格式識別 Prompt | V3.1 階段二：識別文件格式/子類型 |
| 3 | `STAGE_3_FIELD_EXTRACTION` | GLOBAL | 欄位提取 Prompt | V3.1 階段三：提取所有費用欄位 |
| 4 | `FIELD_EXTRACTION` | GLOBAL | 通用欄位提取 Prompt | V3 管線使用的單步提取 |
| 5 | `TERM_CLASSIFICATION` | GLOBAL | 術語分類 Prompt | 將提取的原始術語分類為標準費用類型 |

每個 PromptConfig 包含：
- `systemPrompt`: 角色設定和任務描述
- `userPromptTemplate`: 含 `{variables}` 的用戶提示模板
- `mergeStrategy`: `OVERRIDE`（預設）
- `variables`: 模板變數定義 JSON
- `isActive`: `true`
- `version`: `1`

---

### 3. FieldMappingConfig Seed（🟡 P1）

#### 現有行為

`FieldMappingConfig` 表完全為空。四層配置繼承中的映射配置層沒有預設值。

#### 變更方案

新建 `prisma/seed-data/field-mapping-configs.ts`，提供 1 個 GLOBAL 預設配置：

```typescript
{
  scope: 'GLOBAL',
  name: 'Default Global Mapping',
  description: '全局預設欄位映射配置，適用於所有公司和格式',
  isActive: true,
  version: 1,
  rules: [
    // 基礎的 sourceField → targetField 映射
    // 對應 DataTemplate "ERP Standard Export" 的欄位
  ]
}
```

---

### 4. AlertRule Seed（🟡 P1）

#### 現有行為

`AlertRule` 表完全為空。系統不會產生任何告警。

#### 變更方案

新建 `prisma/seed-data/alert-rules.ts`，提供 4 個關鍵系統告警：

| # | 名稱 | conditionType | metric | threshold | severity |
|---|------|---------------|--------|-----------|----------|
| 1 | AI 服務不可用 | `SERVICE_DOWN` | `ai_service_availability` | 0 | `CRITICAL` |
| 2 | OCR 服務回應超時 | `RESPONSE_TIME` | `ocr_response_time_ms` | 30000 | `ERROR` |
| 3 | 處理佇列堆積 | `QUEUE_BACKLOG` | `processing_queue_size` | 100 | `WARNING` |
| 4 | 錯誤率過高 | `ERROR_RATE` | `processing_error_rate` | 0.2 | `ERROR` |

**注意**: AlertRule 需要 `createdById`（User FK），將使用 systemUser 的 ID。

---

### 5. ExchangeRate Seed（🟢 P2）

#### 現有行為

`ExchangeRate` 表完全為空。V3.1 管線中的匯率轉換步驟（step 7）啟用時會因無匯率資料而失敗。

#### 變更方案

新建 `prisma/seed-data/exchange-rates.ts`，提供主要貨幣兌 USD 的基礎匯率：

| fromCurrency | toCurrency | rate | effectiveYear | source |
|-------------|-----------|------|---------------|--------|
| USD | TWD | 32.50 | 2026 | MANUAL |
| USD | HKD | 7.82 | 2026 | MANUAL |
| USD | SGD | 1.35 | 2026 | MANUAL |
| USD | JPY | 155.00 | 2026 | MANUAL |
| USD | CNY | 7.25 | 2026 | MANUAL |
| USD | EUR | 0.92 | 2026 | MANUAL |
| USD | GBP | 0.79 | 2026 | MANUAL |
| USD | AUD | 1.55 | 2026 | MANUAL |

**附帶反向匯率**: 8 對 → 16 筆記錄，使用 `AUTO_INVERSE` source 標記反向記錄。

---

### 6. .env.example 補全（🟢 P2）

#### 現有缺口

以下變數在代碼中使用但未列入 `.env.example`：

| 變數 | 用途 | 使用位置 |
|------|------|----------|
| `UPSTASH_REDIS_REST_URL` | Rate limiting + 快取 | `@upstash/redis` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 認證 | `@upstash/redis` |
| `N8N_BASE_URL` | n8n 工作流引擎 | SystemConfig 配置 |
| `N8N_API_KEY` | n8n API 認證 | n8n 整合 |
| `MICROSOFT_GRAPH_CLIENT_ID` | SharePoint/Outlook | Graph API |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | SharePoint/Outlook | Graph API |
| `MICROSOFT_GRAPH_TENANT_ID` | SharePoint/Outlook | Graph API |
| `BCRYPT_SALT_ROUNDS` | 密碼 hash 強度 | `src/lib/password.ts` |

---

## 修改的檔案

| # | 檔案 | 操作 | 變更內容 |
|---|------|------|----------|
| 1 | `prisma/seed.ts` | 修改 | 新增 Admin 帳號 + 整合新 seed 模組 + import bcryptjs |
| 2 | `prisma/seed-data/prompt-configs.ts` | **新建** | 5 個 GLOBAL PromptConfig seed |
| 3 | `prisma/seed-data/field-mapping-configs.ts` | **新建** | 1 個 GLOBAL FieldMappingConfig + 基礎 rules |
| 4 | `prisma/seed-data/alert-rules.ts` | **新建** | 4 個系統告警規則 |
| 5 | `prisma/seed-data/exchange-rates.ts` | **新建** | 8 對主要貨幣匯率（16 筆記錄） |
| 6 | `.env.example` | 修改 | 補充 8 個缺失環境變數 |

---

## 資料流

```
prisma/seed.ts (main)
  ├── import { hashPassword } from '../src/lib/password'  ← 新增
  ├── import { PROMPT_CONFIG_SEEDS } from './seed-data/prompt-configs'  ← 新增
  ├── import { FIELD_MAPPING_CONFIG_SEEDS } from './seed-data/field-mapping-configs'  ← 新增
  ├── import { ALERT_RULE_SEEDS } from './seed-data/alert-rules'  ← 新增
  ├── import { EXCHANGE_RATE_SEEDS } from './seed-data/exchange-rates'  ← 新增
  │
  ├── [現有] Seed Roles → Regions → Cities → System User → Dev User
  ├── [新增] Seed Admin User (with password)
  ├── [現有] Seed Companies → Mapping Rules → System Configs
  ├── [新增] Seed PromptConfigs (5 個 GLOBAL)
  ├── [新增] Seed FieldMappingConfigs (1 個 GLOBAL + rules)
  ├── [現有] Seed DataTemplates → TemplateFieldMappings → PipelineConfig
  ├── [新增] Seed AlertRules (4 個系統告警)
  ├── [新增] Seed ExchangeRates (16 筆記錄)
  └── [現有] Restore exported-data.json (如存在)
```

---

## 不修改的部分

- **現有 seed 邏輯** — 所有既有 upsert 邏輯不變
- **exported-data.json 恢復機制** — 保持原有行為，硬編碼 seed 作為 fallback
- **Prisma Schema** — 不需要新增欄位或模型
- **API / 前端** — 純 seed 層變更，不影響運行時邏輯

---

## 實施順序

```
Phase 1 (P0): Admin 帳號 + PromptConfig
  → 部署後可登入 + AI 管線可運行

Phase 2 (P1): FieldMappingConfig + AlertRule
  → 欄位映射配置完整 + 系統告警生效

Phase 3 (P2): ExchangeRate + .env.example
  → 匯率轉換可用 + 新環境配置更完整
```

---

## 部署後仍需手動執行的步驟

即使所有 seed 改善完成，以下步驟仍需手動操作：

| # | 動作 | 方式 | 說明 |
|---|------|------|------|
| 1 | 修改 Admin 預設密碼 | 登入後在個人設定頁修改 | 🔴 必須 |
| 2 | 設定 Azure AD SSO | Azure Portal + .env | 啟用 SSO 登入 |
| 3 | 微調 PromptConfig 內容 | Admin UI `/admin/prompt-configs` | 根據實際效果調整 prompt |
| 4 | 設定外部整合 | Admin UI | SharePoint/Outlook/n8n |
| 5 | 更新匯率至最新值 | Admin UI `/admin/exchange-rates` | seed 匯率為參考值 |
| 6 | 設定備份排程 | Admin UI `/admin/backup` | 定期備份 |

---

## 驗證方式

### 自動驗證

```bash
# 1. 重置資料庫並執行 seed
npx prisma migrate reset --force

# 2. 確認 seed 執行無錯誤
# 預期輸出應包含所有新增項目的 ✅ Created 日誌

# 3. TypeScript 類型檢查
npx tsc --noEmit
```

### 手動驗證

- [ ] 使用 `admin@ai-document-extraction.com` / `ChangeMe@2026!` 登入成功
- [ ] 登入後可存取所有 Admin 頁面
- [ ] `/admin/prompt-configs` 顯示 5 個 GLOBAL prompt
- [ ] `/admin/field-mapping-configs` 顯示 1 個 GLOBAL 配置
- [ ] `/admin/alerts` 顯示 4 個系統告警規則
- [ ] `/admin/exchange-rates` 顯示 8 對匯率（16 筆記錄）
- [ ] 重複執行 `npx prisma db seed` 不報錯（upsert 幂等性）

---

## 檢查清單

### Phase 1 (P0)
- [x] `prisma/seed.ts` 新增 Admin 帳號（含 bcrypt hash）
- [x] `prisma/seed-data/prompt-configs.ts` 新建，含 5 個 GLOBAL PromptConfig
- [x] seed.ts 整合 prompt-configs seed 邏輯
- [ ] 驗證 Admin 登入成功

### Phase 2 (P1)
- [x] `prisma/seed-data/field-mapping-configs.ts` 新建
- [x] `prisma/seed-data/alert-rules.ts` 新建
- [x] seed.ts 整合 FieldMappingConfig + AlertRule seed 邏輯

### Phase 3 (P2)
- [x] `prisma/seed-data/exchange-rates.ts` 新建
- [x] `.env.example` 補充 8 個缺失變數
- [x] seed.ts 整合 ExchangeRate seed 邏輯

### 最終驗證
- [ ] `npx prisma migrate reset --force` 成功執行
- [x] `npx tsc --noEmit` 無類型錯誤
- [ ] 重複 seed 無錯誤（幂等性）

---

*文件建立日期: 2026-02-13*
*最後更新: 2026-02-13*
