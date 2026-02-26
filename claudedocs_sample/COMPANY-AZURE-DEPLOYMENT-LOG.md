# 公司 Azure 環境部署日誌

> **環境**: company/dev (app-itpm-company-dev-001)
> **資源群組**: RG-RCITest-RAPO-N8N
> **URL**: https://app-itpm-company-dev-001.azurewebsites.net
> **建立日期**: 2025-12-14

---

## 重要更新: 完整 Schema 同步機制 (2025-12-15)

### 問題根源

經過深入分析，發現 Schema 一直不同步的根本原因：

| 環境 | 同步方式 | 問題 |
|------|---------|------|
| 本地開發 | `pnpm db:push` | 直接同步 schema.prisma，所有變更即時生效 |
| Azure 部署 | `prisma migrate deploy` | 只執行 migrations/ 中的文件，但 migrations **不完整** |

**缺失的 Migrations:**
- FEAT-001: 只有 projectCode, globalFlag, priority (缺少 currencyId)
- FEAT-006: 完全缺失 (8 個 Project 欄位)
- FEAT-010: 部分缺失 (7 個 Project 欄位)

### 解決方案

新增**完整 Schema 同步機制**，通過 Health API 作為執行通道：

1. **schemaDefinition.ts** - 唯一真相來源，定義所有 31 個表格的預期欄位
2. **fullSchemaCompare API** - 對比所有表格和欄位差異
3. **fullSchemaSync API** - 一鍵修復所有差異

### 新的部署流程

```bash
# 部署後必須執行 Schema 同步
# 1. 檢查差異
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaCompare

# 2. 執行同步 (如有差異)
curl -X POST https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaSync

# 3. 驗證
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fullSchemaCompare
# 應該返回 "status": "synced"
```

**詳細說明**: 參見 `claudedocs/SCHEMA-SYNC-MECHANISM.md`

---

## 部署歷史

### v29-fix-date (2025-12-15)

| 項目 | 內容 |
|------|------|
| **版本** | v29-fix-date |
| **日期** | 2025-12-15 |
| **變更內容** | 修正 PurchaseOrder 欄位名稱錯誤 |
| **狀態** | ✅ 成功 |

**根本原因分析:**

這是導致 Azure 部署一直失敗的**真正根本原因**：

1. **schema.prisma 定義的是 `date` 欄位** (第 333 行)
2. **但 schemaCompare API 錯誤地期望 `poDate`**
3. 導致修復 API 把正確的 `date` **錯誤地重命名** 為 `poDate`
4. 結果所有 PurchaseOrder 相關查詢失敗（quote.ts, vendor.ts）

**問題表現:**
- project.getById → 500 錯誤
- vendor.getById → 500 錯誤 (orderBy: { date: 'desc' })
- quote.getAll → 500 錯誤 (`PurchaseOrder.date` does not exist)

**修正內容:**
1. schemaCompare: 將期望欄位從 `poDate` 改回 `date`
2. fixAllSchemaIssues: 修正邏輯為把 `poDate` 改回 `date`
3. fixAllSchemaComplete: 同上修正

**執行修復:**
```bash
curl -X POST "https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fixAllSchemaComplete"
```

**修復結果:**
- Schema 狀態: synced (完全同步)
- PurchaseOrder.date: ✅ 正確存在

**驗證結果:**
- ✅ Projects 列表頁: 200
- ✅ Project 詳情頁: 200
- ✅ Vendors 列表頁: 200
- ✅ Vendor 詳情頁: 200
- ✅ Quotes 頁面: 200
- ✅ Dashboard: 200
- ✅ Proposals: 200
- ✅ Purchase Orders: 200
- ✅ Expenses: 200
- ✅ OM Expenses: 200
- ✅ OM Summary: 200
- ✅ OM Expense Categories: 200
- ✅ Settings Currencies: 200

**教訓學習:**
- 在編寫診斷 API 時，必須仔細對照 schema.prisma 的實際定義
- 不要假設欄位名稱，應該從源頭 (schema.prisma) 確認
- 修復 API 應該有更強的驗證機制，避免做出錯誤的修改

---

### v28-fix-complete (2025-12-14)

| 項目 | 內容 |
|------|------|
| **版本** | v28-fix-complete |
| **日期** | 2025-12-14 |
| **變更內容** | 完整 Schema 修復 + Permission 權限補齊 |
| **狀態** | ✅ 成功 |

**問題背景:**
- v27 部署後仍有多個 API 500 錯誤
- project.getAll, project.getFiscalYears 因缺少 FEAT-001/006/010 欄位失敗
- budgetProposal.getAll, expense.getAll 因缺少欄位失敗
- omExpense.getById, omExpense.getSummary 500 錯誤
- Sidebar 缺少 Expense Categories, Currencies 選項

**根本原因分析:**
- schemaCompare API 只檢查部分欄位，遺漏 FEAT-001/006/010 新增的 19 個 Project 欄位
- Project 表缺少: projectCode, globalFlag, priority, currencyId, projectCategory,
  projectType, expenseType, chargeBackToOpCo, chargeOutMethod, probability, team,
  personInCharge, fiscalYear, isCdoReviewRequired, isManagerConfirmed, payForWhat,
  payToWhom, isOngoing, lastFYActualExpense
- Permission 表缺少 menu:om-expense-categories, menu:currencies 權限

**包含變更:**
- 新增 health.fixProjectSchema API (修復 Project 所有欄位)
- 新增 health.fixAllSchemaComplete API (一次性修復所有表格)
  - Project: 19 個 FEAT-001/006/010 欄位
  - BudgetProposal: budgetCategoryId, currencyId
  - PurchaseOrder: poDate
  - BudgetPool: isActive
  - OMExpense: categoryId, sourceExpenseId, hasItems, totalBudgetAmount, totalActualSpent, defaultOpCoId
  - OMExpenseItem: lastFYActualExpense, isOngoing
  - Expense: budgetCategoryId, vendorId, currencyId, requiresChargeOut, isOperationMaint
  - ExpenseItem: chargeOutOpCoId, categoryId
  - UserOperatingCompany, ProjectChargeOutOpCo: 創建表格
- 更新 fixPermissionTables API (新增 2 個權限)
  - menu:om-expense-categories (費用類別)
  - menu:currencies (幣別管理)

**執行修復:**
```bash
# 1. Schema 完整修復
curl -X POST "https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fixAllSchemaComplete"

# 2. Permission 權限修復 (18 個菜單權限)
curl -X POST "https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fixPermissionTables"
```

**修復結果:**
- Schema 狀態: synced (完全同步)
- Permission: 18 筆權限記錄
- RolePermission: 26 筆角色權限關聯

**驗證結果:**
- ✅ 登入頁面: 200
- ✅ Dashboard: 200
- ✅ 專案列表: 200
- ✅ 提案列表: 200
- ✅ 採購單: 200
- ✅ 費用記錄: 200
- ✅ OM 費用: 200
- ✅ OM 摘要: 200
- ✅ 費用類別: 200
- ✅ 幣別管理: 200

---

### v27-fix-schema (2025-12-14)

| 項目 | 內容 |
|------|------|
| **版本** | v27-fix-schema |
| **日期** | 2025-12-14 |
| **變更內容** | Schema 不同步完整修復 |
| **狀態** | ✅ 成功 |

**問題背景:**
- v26 部署後仍有 API 500 錯誤 (project.getAll, omExpense.getById, expense.getById)
- Schema 診斷發現：PurchaseOrder 缺少 poDate, BudgetPool 缺少 isActive

**包含變更:**
- 更新 health.fixAllSchemaIssues API (新增步驟 6, 7)
- PurchaseOrder: 重命名 date → poDate
- BudgetPool: 新增 isActive 欄位

**執行修復:**
```bash
curl -X POST "https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fixAllSchemaIssues"
```

**修復結果:**
- Schema 狀態: synced (完全同步)
- 缺失欄位: 無

**驗證結果:**
- ✅ 登入頁面: 200
- ✅ Dashboard: 200
- ✅ 專案列表: 200
- ✅ 用戶列表: 200
- ✅ OM 費用: 200
- ✅ 費用記錄: 200
- ✅ OM 摘要: 200
- ✅ 採購單: 200
- ✅ 預算池: 200

---

### v26-fix-permission (2025-12-14)

| 項目 | 內容 |
|------|------|
| **版本** | v26-fix-permission |
| **日期** | 2025-12-14 |
| **變更內容** | FEAT-011 Permission 表修復 |
| **狀態** | ✅ 成功 |

**問題背景:**
- v25 部署後發現 sidebar 消失，所有角色都看不到菜單
- permission.getMyPermissions API 返回 500 錯誤
- 根本原因：Permission、RolePermission、UserPermission 表不存在

**包含變更:**
- 新增 migration: `20251214100000_feat011_permission_tables`
- 新增 health.ts `fixPermissionTables` API
- 創建 Permission、RolePermission、UserPermission 表
- 植入 16 個預設菜單權限
- 分配角色預設權限 (Admin 獲得全部權限)

**執行修復:**
```bash
curl -X POST "https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.fixPermissionTables"
```

**修復結果:**
- Permission 表: 16 筆權限記錄
- RolePermission 表: 24 筆角色權限關聯

**驗證結果:**
- ✅ 登入頁面: 200
- ✅ Dashboard: 200
- ✅ 專案列表: 200
- ✅ 用戶列表: 200
- ✅ OM 費用: 200
- ✅ OM 摘要: 200
- ✅ 費用分攤: 200
- ✅ 數據導入: 200

---

### v25-change015-change016 (2025-12-14)

| 項目 | 內容 |
|------|------|
| **版本** | v25-change015-change016 |
| **日期** | 2025-12-14 |
| **變更內容** | CHANGE-015 + CHANGE-016 Dashboard 改進 |
| **狀態** | ✅ 成功 |

**包含變更:**
- **CHANGE-015**: Dashboard 作為通用登陸頁面
  - 移除 roleId 權限檢查，所有已登入用戶可訪問
  - 新增 Quick Actions 區塊，根據權限過濾顯示
- **CHANGE-016**: Dashboard 簡化版專業歡迎頁面
  - 採用方案 C 極簡專業風格
  - 顯示：系統名稱、用戶歡迎訊息、角色、日期、導航提示
  - 不顯示：統計數據、圖表、敏感資訊
  - 新增 i18n 翻譯鍵 (dashboard.welcome.*)
  - 備份完整版為 page-full-version.tsx.bak

**驗證結果:**
- ✅ 登入頁面: 200
- ✅ Dashboard: 200
- ✅ 專案列表: 200
- ✅ 用戶列表: 200
- ✅ OM 費用: 200
- ✅ OM 摘要: 200
- ✅ 費用分攤: 200
- ✅ 數據導入: 200

---

### v24-fix-feat008-column (2025-12-10)

| 項目 | 內容 |
|------|------|
| **版本** | v24-fix-feat008-column |
| **日期** | 2025-12-10 |
| **變更內容** | FEAT-008 欄位映射修復 |
| **狀態** | ✅ 成功 |

**包含變更:**
- 修正 EXCEL_COLUMN_MAP lastFYActualExpense 欄位映射 (Column N → Column K)
- 修復 500 錯誤 (getSummary + getById APIs)
- 更新 health.ts fixAllSchemaIssues 添加 FEAT-008 欄位修復

**驗證結果:**
- ✅ 所有頁面返回 200 OK
- ✅ OMExpenseItem 表新增 lastFYActualExpense 欄位

---

### v23-feat008-import (2025-12-10)

| 項目 | 內容 |
|------|------|
| **版本** | v23-feat008-import |
| **日期** | 2025-12-10 |
| **變更內容** | FEAT-008 OM Expense Data Import |
| **狀態** | ✅ 成功 (後續發現欄位問題，由 v24 修復) |

**包含變更:**
- 新增 data-import 頁面 (Excel 解析、預覽、批量導入)
- 支援 xlsx/xls 格式解析 (xlsx 庫)
- 表頭-明細關聯建立
- 創建 FEAT-008 資料庫 migration (lastFYActualExpense 欄位)

**遇到問題:**
- OMExpenseItem 表缺少 lastFYActualExpense 欄位 → 由 v24 修復

---

### v22-feat007-omexpenseitem (2025-12-05)

| 項目 | 內容 |
|------|------|
| **版本** | v22-feat007-omexpenseitem |
| **日期** | 2025-12-05 |
| **變更內容** | FEAT-007 OM Expense 表頭-明細架構重構 |
| **狀態** | ✅ 成功 |

**包含變更:**
- 新增 OMExpenseItem 模型 (支援多明細項目)
- 新增 6 個 API procedures (createWithItems, addItem, updateItem, removeItem, reorderItems, updateItemMonthlyRecords)
- 新增 3 個前端組件 (OMExpenseItemForm, OMExpenseItemList, OMExpenseItemMonthlyGrid)
- 支援拖曳排序 (@dnd-kit 整合)
- OMExpense → OMExpenseItem → OMExpenseMonthly 三層架構

---

### v21-schema-fix (2025-12-04)

| 項目 | 內容 |
|------|------|
| **版本** | v21-schema-fix |
| **日期** | 2025-12-04 |
| **變更內容** | FIX-007 系統化 Schema 診斷和修復工具 |
| **狀態** | ✅ 成功 |

**包含變更:**
- 新增診斷 API：health.schemaCompare
- 新增修復 API：health.fixExpenseItemSchema, health.fixAllSchemaIssues
- 修復 Azure 資料庫缺失欄位：
  - ExpenseItem: categoryId, chargeOutOpCoId
  - OMExpense: categoryId, sourceExpenseId
  - Expense: budgetCategoryId, vendorId, currencyId, requiresChargeOut, isOperationMaint

**根本原因分析:**
- 本地環境使用 `db push` 同步
- Azure 環境只執行 migrations
- 導致 Schema 不同步

---

### v20-fix-expense-category (2025-12-04)

| 項目 | 內容 |
|------|------|
| **版本** | v20-fix-expense-category |
| **日期** | 2025-12-04 |
| **變更內容** | FIX-006 Expense budgetCategoryId 驗證修復 |
| **狀態** | ✅ 成功 |

**包含變更:**
- 修復創建 Expense 時的 Foreign key constraint violated 錯誤
- 在 expense.ts 創建前驗證 budgetCategoryId 是否有效

**問題描述:**
- 繼承的 budgetCategoryId 指向不存在的 BudgetCategory 記錄

---

### 初始部署 (2025-11-26)

| 項目 | 內容 |
|------|------|
| **版本** | latest (初始版本) |
| **日期** | 2025-11-26 |
| **變更內容** | 公司 Azure 環境首次部署 |
| **狀態** | ✅ 成功 |

**資源建立:**
- PostgreSQL: psql-itpm-company-dev-001
- 儲存帳戶: stitpmcompanydev001
- Container Registry: acritpmcompany
- App Service: app-itpm-company-dev-001

**修正歷史:**
| 時間 | 問題 | 修正 |
|------|------|------|
| 07:47 | DATABASE_URL 缺少主機名 | 添加完整連接字符串 |
| 07:55 | Role 表為空，導致註冊失敗 | 執行 POST /api/admin/seed |

**詳細配置:**
- 參考：`claudedocs/AZURE-DEPLOYMENT-COMPLETION-COMPANY.md`

---

## 部署流程 SOP

### 部署前檢查清單
- [ ] 本地代碼已提交並推送到 GitHub
- [ ] TypeScript 編譯通過 (`pnpm exec tsc --noEmit`)
- [ ] i18n 驗證通過 (`pnpm validate:i18n`)
- [ ] 確認要部署的變更內容

### 部署步驟
```bash
# 1. 登入 Azure
az login

# 2. 登入 ACR
az acr login --name acritpmcompany

# 3. 設定版本號
VERSION="vXX-feature-name"

# 4. 建置 Docker 映像
docker build -t acritpmcompany.azurecr.io/itpm-web:$VERSION .

# 5. 推送到 ACR
docker push acritpmcompany.azurecr.io/itpm-web:$VERSION

# 6. 更新 App Service
az webapp config container set \
  --name app-itpm-company-dev-001 \
  --resource-group RG-RCITest-RAPO-N8N \
  --docker-custom-image-name acritpmcompany.azurecr.io/itpm-web:$VERSION

# 7. 重啟應用
az webapp restart \
  --name app-itpm-company-dev-001 \
  --resource-group RG-RCITest-RAPO-N8N
```

### 部署後驗證
- [ ] 應用 URL 可訪問
- [ ] 登入頁面正常顯示
- [ ] 主要功能頁面正常 (Dashboard, Projects, OM Expenses 等)
- [ ] API Health Check 返回 200

### 問題排查
```bash
# 查看應用日誌
az webapp log tail \
  --name app-itpm-company-dev-001 \
  --resource-group RG-RCITest-RAPO-N8N

# 檢查容器配置
az webapp config container show \
  --name app-itpm-company-dev-001 \
  --resource-group RG-RCITest-RAPO-N8N

# Health API 診斷
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.check
curl https://app-itpm-company-dev-001.azurewebsites.net/api/trpc/health.schemaCompare
```

---

## 相關文件

- **部署指引**: `claudedocs/6-ai-assistant/prompts/SITUATION-7-AZURE-DEPLOY-COMPANY.md`
- **故障排查**: `claudedocs/6-ai-assistant/prompts/SITUATION-9-AZURE-TROUBLESHOOT-COMPANY.md`
- **初始部署報告**: `claudedocs/AZURE-DEPLOYMENT-COMPLETION-COMPANY.md`
- **資源清單**: `AZURE-RESOURCES-INVENTORY.md`

---

**最後更新**: 2025-12-14
**維護者**: AI 助手
