# Seed Data & Database Bootstrap Analysis

> **分析日期**: 2026-04-09
> **入口文件**: `prisma/seed.ts` (1,457 行)
> **Seed Data 目錄**: `prisma/seed-data/` (7 模組)
> **執行命令**: `npx prisma db seed`

---

## 1. 種子資料模型清單

seed.ts 共操作 **15 個 Prisma Model**，分為核心種子和匯出恢復兩部分。

### 核心種子（硬編碼 + seed-data/ 模組）

| # | Model | 記錄數 | 來源 | 說明 |
|---|-------|--------|------|------|
| 1 | `Role` | 6 | 硬編碼 (ROLE_NAMES) | 系統角色 |
| 2 | `Region` | 4 | 硬編碼 | GLOBAL, APAC, EMEA, AMER |
| 3 | `City` | 10 | 硬編碼 | TPE, HKG, SGP, TYO, SHA, SYD, LON, FRA, NYC, LAX |
| 4 | `User` | 3 | 硬編碼 | system, dev-user-1, admin |
| 5 | `Company` | 15 | `seed-data/forwarders.ts` | 14 物流公司 + 1 UNKNOWN |
| 6 | `MappingRule` | ~36 | `seed-data/mapping-rules.ts` | Universal + Company-specific |
| 7 | `SystemConfig` | ~34 | `seed-data/config-seeds.ts` | 5 大類系統配置 |
| 8 | `DataTemplate` | 3 | 硬編碼 | ERP/費用報表/物流追蹤 |
| 9 | `TemplateFieldMapping` | 1 | 硬編碼 (12 rules) | ERP 全域映射 |
| 10 | `PromptConfig` | 5 | `seed-data/prompt-configs.ts` | V3.1 三階段 + 通用 |
| 11 | `FieldMappingConfig` | 1 | `seed-data/field-mapping-configs.ts` | GLOBAL 預設映射 |
| 12 | `AlertRule` | 4 | `seed-data/alert-rules.ts` | 4 個關鍵告警 |
| 13 | `ExchangeRate` | 16 | `seed-data/exchange-rates.ts` | 8 幣對 x 2 (正向+反向) |
| 14 | `PipelineConfig` | 1 | 硬編碼 | GLOBAL 管線配置 |

### 匯出恢復（條件性，依 exported-data.json）

| Model | 來源 | 說明 |
|-------|------|------|
| `Company` | `prisma/seed/exported-data.json` | 非預設公司恢復 |
| `DocumentFormat` | 同上 | 文件格式定義恢復 |
| `PromptConfig` | 同上 | 自訂 Prompt 恢復 |

---

## 2. 種子資料詳細內容

### 2.1 角色 (Role) - 6 個

| 角色 | 權限數 | 說明 |
|------|--------|------|
| System Admin | 全部 | 系統管理員 |
| Super User | 多數 | 規則和 Company 管理 |
| Data Processor | 基礎 | 發票處理（預設角色） |
| City Manager | 城市級 | 城市級別管理 |
| Regional Manager | 區域級 | 多城市管理 |
| Auditor | 唯讀 | 審計存取 |

### 2.2 區域與城市

**區域 (4)**:
- GLOBAL (UTC, sortOrder: 0)
- APAC - Asia Pacific (Asia/Hong_Kong, sortOrder: 1)
- EMEA - Europe, Middle East & Africa (Europe/London, sortOrder: 2)
- AMER - Americas (America/New_York, sortOrder: 3)

**城市 (10)**: Taipei(TWD), Hong Kong(HKD), Singapore(SGD), Tokyo(JPY), Shanghai(CNY), Sydney(AUD), London(GBP), Frankfurt(EUR), New York(USD), Los Angeles(USD)

### 2.3 用戶 (User) - 3 個

| 用戶 | Email | 角色 | 用途 |
|------|-------|------|------|
| System | system@ai-document-extraction.internal | System Admin | 系統操作用 |
| Development User | dev@example.com (id: dev-user-1) | System Admin + isGlobalAdmin | 開發模式 |
| Admin | admin@ai-document-extraction.com | System Admin + isGlobalAdmin | 生產環境初始登入 |

> **安全注意**: Admin 用戶使用硬編碼密碼 `ChangeMe@2026!`，部署後必須立即更改。

### 2.4 公司 (Company) - 15 個

**Express (4)**: DHL, FedEx(FDX), UPS, TNT
**Ocean (8)**: Maersk, MSC, CMA CGM, Hapag-Lloyd(HLAG), Evergreen(EVRG), COSCO, ONE, Yang Ming(YML)
**Regional (2)**: SF Express(SF), Kerry Logistics(KERRY)
**特殊 (1)**: UNKNOWN（無法識別文件用）

每個公司含 `identificationPatterns`（名稱變體、關鍵詞、格式正則、Logo 文字）。
DHL 和 Maersk 自動設定 `defaultTemplateId` → `erp-standard-import`。

### 2.5 映射規則 (MappingRule) - ~36 條

- **Universal (Tier 1)**: 通用欄位映射（invoice_number, date, vendor, amount 等）
- **Company-specific (Tier 2)**: DHL, FedEx, UPS, Maersk 各有特定規則覆蓋

### 2.6 系統配置 (SystemConfig) - ~34 條

分為 5 大類: PROCESSING, INTEGRATION, SECURITY, NOTIFICATION, SYSTEM

### 2.7 Prompt 配置 - 5 個

STAGE_1_COMPANY_IDENTIFICATION, STAGE_2_FORMAT_IDENTIFICATION, STAGE_3_FIELD_EXTRACTION, FIELD_EXTRACTION, TERM_CLASSIFICATION（全部 GLOBAL scope）

### 2.8 匯率 - 16 筆

8 個幣對 (USD 對 TWD/HKD/SGD/JPY/CNY/EUR/GBP/AUD) x 2 方向，2026 年度參考值。

### 2.9 告警規則 - 4 條

AI Service Unavailable (CRITICAL), OCR Service Timeout (ERROR), Queue Backlog (WARNING), High Error Rate (ERROR)

---

## 3. 冪等性分析

| 策略 | 使用模型 | 說明 |
|------|---------|------|
| **upsert** (by unique key) | Role, Region, City, User, Company | 完全冪等 |
| **findFirst + update/create** | MappingRule, SystemConfig, PromptConfig, FieldMappingConfig, AlertRule | 冪等（先查再決定） |
| **findFirst + skip** | ExchangeRate | 冪等（存在則跳過） |
| **findUnique + update/create** | DataTemplate, TemplateFieldMapping | 冪等 |
| **findFirst + skip** | PipelineConfig | 冪等（存在則跳過） |

**結論**: seed.ts **完全冪等**，可安全重複執行。使用 upsert 或 find-then-create 模式確保不會產生重複資料。SystemConfig 更新時只更新元資料（name, description），不覆蓋用戶自訂的 value。

---

## 4. SQL 文件與非標準遷移

### prisma/sql/

| 文件 | 說明 | 何時執行 |
|------|------|---------|
| `audit_log_immutability.sql` | 建立 audit_logs 表的 BEFORE UPDATE/DELETE 觸發器，防止審計日誌被修改或刪除。觸發竄改時自動記錄到 security_logs。 | 需手動執行或加入遷移 |

**注意**: 此 SQL 未包含在 seed.ts 或 Prisma migration 中，需要 DBA 手動執行。

### prisma/seed/

| 文件 | 說明 |
|------|------|
| `exported-data.json` | 之前環境匯出的資料（companies, documentFormats, promptConfigs, mappingRules, systemConfigs, roles, regions, cities, dataTemplates），用於遷移到新環境時恢復自訂資料 |

### prisma/migrations/

標準 Prisma 遷移目錄，包含 `migration_lock.toml` 和各版本的 SQL 遷移腳本。

---

## 5. 環境準備需求

### 前置條件

```bash
# 1. Docker 服務必須運行（PostgreSQL）
docker-compose up -d

# 2. .env 必須設定 DATABASE_URL
#    例: postgresql://user:pass@localhost:5433/dbname

# 3. Prisma Client 必須已生成
npx prisma generate

# 4. 資料庫遷移必須已執行
npx prisma migrate dev
```

### Seed 依賴的外部模組

| 模組 | 來源 | 用途 |
|------|------|------|
| `src/types/role-permissions.ts` | 應用代碼 | ROLE_NAMES, ROLE_PERMISSIONS, ROLE_DESCRIPTIONS |
| `src/lib/password.ts` | 應用代碼 | hashPassword（Admin 用戶密碼雜湊） |
| `@prisma/client` | Prisma | ORM 客戶端 |
| `@prisma/adapter-pg` + `pg` | Prisma | PostgreSQL 適配器 |
| `dotenv/config` | npm | 環境變數載入 |

### 執行順序

```
1. docker-compose up -d     (PostgreSQL 啟動)
2. npx prisma generate       (生成 Client)
3. npx prisma migrate dev    (執行遷移)
4. npx prisma db seed        (種子資料)
5. [手動] psql < prisma/sql/audit_log_immutability.sql  (審計觸發器)
```

---

## 6. 關鍵發現與建議

| 項目 | 發現 | 建議 |
|------|------|------|
| Admin 硬編碼密碼 | `ChangeMe@2026!` 寫在代碼中 | 首次部署後強制更改，或改為環境變數 |
| audit_log_immutability.sql | 未自動化執行 | 考慮加入 Prisma migration 或 seed.ts |
| exported-data.json | 用於環境遷移恢復 | 確保定期匯出以備份自訂資料 |
| Forwarder 命名殘留 | seed-data/ 仍使用 `forwarderId` 參數名 | 低優先級清理（不影響功能） |

---

*分析完成: 2026-04-09*
