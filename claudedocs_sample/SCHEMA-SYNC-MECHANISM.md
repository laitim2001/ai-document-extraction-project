# Schema 同步機制說明

> **建立日期**: 2025-12-15
> **適用環境**: 公司 Azure 環境 (app-itpm-company-dev-001)
> **問題背景**: Azure 環境無法直接執行 prisma migrate，需要通過 Health API 同步數據庫結構

---

## 問題根源分析

### 為什麼 Schema 一直不同步？

```
本地開發:  pnpm db:push  →  直接同步 schema.prisma 到數據庫 (所有變更即時生效)
Azure 部署: migrate deploy →  只執行 migrations/ 文件夾中的 migration 文件
```

**問題**: `migrations/` 文件夾只有 6 個 migration 文件，**不包含所有功能的變更**：

| 功能 | migrations 狀態 |
|------|----------------|
| FEAT-001 (Project 欄位擴展) | ❌ 部分缺失 (只有 projectCode, globalFlag, priority) |
| FEAT-006 (Project Summary Tab) | ❌ 完全缺失 (8 個欄位) |
| FEAT-010 (Project Data Import) | ❌ 部分缺失 (7 個欄位) |
| FEAT-007 (OM Expense 重構) | ⚠️ 部分支援 |
| FEAT-011 (Permission 權限) | ✅ 有 migration |

### 為什麼不能直接執行 Migration？

1. **Azure App Service 環境限制**: Container 啟動時執行 `prisma migrate deploy`，但 migrations 不完整
2. **無法直接訪問數據庫**: 公司 Azure 環境可能有網路限制
3. **Health API 成為唯一修改通道**: 通過 tRPC API 的 `$executeRaw` 執行 SQL

---

## 新的 Schema 同步機制

### 核心文件

| 文件 | 用途 |
|------|------|
| `packages/api/src/lib/schemaDefinition.ts` | **唯一真相來源** - 定義所有 31 個表格的預期欄位 |
| `packages/api/src/routers/health.ts` | Schema 同步 API 實現 |

### 新增 API

#### 1. `fullSchemaCompare` - 完整對比

**用途**: 對比所有 31 個 Prisma 模型的預期欄位與實際欄位

```bash
# 調用方式
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaCompare

# 返回結構
{
  "status": "synced" | "out_of_sync" | "error",
  "summary": {
    "totalTablesChecked": 31,
    "missingTables": ["Permission", ...],
    "tablesWithMissingColumns": [{ "table": "Project", "missing": [...] }],
    "allMissingColumns": ["Project.projectCode", ...],
    "fixSqlPreviewCount": 15
  },
  "comparison": { ... },
  "fixSqlPreview": ["ALTER TABLE ..."],
  "timestamp": "2025-12-15T..."
}
```

**優點**:
- 對比所有 31 個表格（不只是部分）
- 使用 `schemaDefinition.ts` 作為唯一真相來源
- 提供 SQL 修復預覽

#### 2. `fullSchemaSync` - 完整同步

**用途**: 一鍵修復所有缺失的表格和欄位

```bash
# 調用方式
curl -X POST https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaSync

# 返回結構
{
  "success": true,
  "fixedTables": 5,
  "fixedColumns": 42,
  "stillMissing": 0,
  "results": [
    "=== 完整 Schema 同步開始 ===",
    "📋 Phase 1: 檢查並創建缺失表格...",
    "  ✅ 創建 Permission 表",
    ...
  ],
  "timestamp": "2025-12-15T..."
}
```

**修復內容**:
- **Phase 1**: 創建缺失表格 (Permission, RolePermission, UserPermission, ProjectChargeOutOpCo, UserOperatingCompany)
- **Phase 2**: 修復 Project 表 (FEAT-001/006/010 共 19 個欄位)
- **Phase 3**: 修復 PurchaseOrder 表 (date, currencyId, approvedDate)
- **Phase 4**: 修復 BudgetPool 表 (isActive, description, currencyId)
- **Phase 5**: 修復 Expense 表 (7 個欄位)
- **Phase 6**: 修復 ExpenseItem 表 (categoryId, chargeOutOpCoId)
- **Phase 7**: 修復 OMExpense 表 (FEAT-007 共 6 個欄位)
- **Phase 8**: 修復 OMExpenseItem 表 (lastFYActualExpense, isOngoing)
- **Phase 9**: 創建必要索引

---

## 標準部署流程 (SOP)

### 部署前

```bash
# 1. 本地代碼已提交
git status

# 2. TypeScript 編譯通過
pnpm exec tsc --noEmit

# 3. 確認 schemaDefinition.ts 與 schema.prisma 同步
# (如果有新欄位，必須更新 schemaDefinition.ts)
```

### 部署

```bash
# 1. 登入 Azure
az login
az acr login --name acritpmcompany

# 2. 設定版本號
VERSION="v30-feature-name"

# 3. 建置和推送 Docker 映像
docker build -t acritpmcompany.azurecr.io/itpm-web:$VERSION .
docker push acritpmcompany.azurecr.io/itpm-web:$VERSION

# 4. 更新 App Service
az webapp config container set \
  --name app-itpm-company-dev-001 \
  --resource-group RG-RCITest-RAPO-N8N \
  --docker-custom-image-name acritpmcompany.azurecr.io/itpm-web:$VERSION

# 5. 重啟應用
az webapp restart \
  --name app-itpm-company-dev-001 \
  --resource-group RG-RCITest-RAPO-N8N
```

### 部署後 Schema 同步 (關鍵步驟!)

```bash
# 1. 檢查 Schema 差異
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaCompare

# 2. 如果有差異，執行完整同步
curl -X POST https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaSync

# 3. 驗證同步結果
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaCompare
# 應該返回 "status": "synced"

# 4. (可選) 修復 Permission 表權限
curl -X POST https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fixPermissionTables
```

### 驗證頁面

```bash
# 測試所有主要頁面
BASE_URL="https://app-itpm-company-dev-001.azurewebsites.net"

curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/projects"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/proposals"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/vendors"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/quotes"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/purchase-orders"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/expenses"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/om-expenses"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/om-summary"
```

---

## 維護指南

### 添加新欄位時

1. **更新 schema.prisma** - 在 `packages/db/prisma/schema.prisma` 添加欄位
2. **更新 schemaDefinition.ts** - 在 `packages/api/src/lib/schemaDefinition.ts` 的對應表格添加欄位名稱
3. **更新 fullSchemaSync** - 在 `health.ts` 的 `fullSchemaSync` API 添加 `ALTER TABLE` 語句
4. **本地測試** - 使用 `pnpm db:push` 同步本地數據庫
5. **部署後同步** - 執行 `fullSchemaSync` API

### schemaDefinition.ts 結構

```typescript
// 表格欄位定義 (唯一真相來源)
export const FULL_SCHEMA_DEFINITION: Record<string, string[]> = {
  Project: [
    'id', 'name', 'description', 'status', ...
    // FEAT-001: projectCode, globalFlag, priority, currencyId
    // FEAT-006: projectCategory, projectType, expenseType, ...
    // FEAT-010: fiscalYear, isCdoReviewRequired, ...
  ],
  // ... 其他表格
};

// 欄位類型對照 (用於生成 ALTER TABLE)
export const COLUMN_TYPE_MAP: Record<string, Record<string, { type: string; default?: string }>> = {
  Project: {
    projectCode: { type: 'TEXT', default: "''" },
    globalFlag: { type: 'TEXT', default: "'Region'" },
    // ...
  },
  // ...
};
```

---

## API 快速參考

| API | 方法 | 用途 |
|-----|------|------|
| `health.fullSchemaCompare` | GET | 完整對比所有表格和欄位 |
| `health.fullSchemaSync` | POST | 一鍵修復所有差異 |
| `health.schemaCompare` | GET | 舊版對比 (部分表格) |
| `health.fixAllSchemaComplete` | POST | 舊版修復 (保留向後兼容) |
| `health.fixPermissionTables` | POST | 修復 Permission 表並植入權限 |
| `health.dbCheck` | GET | 數據庫連線檢查 |

---

## 常見問題

### Q: 為什麼不直接修復 migrations 文件？

A: 理論上可以，但有以下考量：
1. Prisma migrations 是不可變的 (immutable)
2. 需要為每個缺失欄位創建新 migration
3. 本地開發使用 `db:push` 更方便
4. Health API 方案已經驗證可行且可維護

### Q: fullSchemaSync 會破壞現有數據嗎？

A: 不會。所有操作都使用 `ADD COLUMN IF NOT EXISTS` 或 `CREATE TABLE IF NOT EXISTS`，不會影響現有數據。

### Q: 如何知道需要更新 schemaDefinition.ts？

A: 當 schema.prisma 有變更時，應該同步更新 schemaDefinition.ts。建議建立 CI 檢查來驗證一致性。

---

**最後更新**: 2025-12-15
**維護者**: AI 助手
