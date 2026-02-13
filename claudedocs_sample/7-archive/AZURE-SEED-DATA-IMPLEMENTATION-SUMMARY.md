# Azure Seed Data 實施總結

> **文檔版本**: 1.0.0
> **創建日期**: 2025-11-22
> **作者**: Development Team + AI Assistant
> **目的**: 總結 Azure 部署 seed data 自動化實施成果

---

## 🎯 問題背景

### 原始問題
在 Azure 環境部署後,Registration API 返回 **500 錯誤**,而本地環境運行正常。

### Root Cause 分析
經過系統性診斷發現:
1. **錯誤類型**: Prisma P2003 (Foreign key constraint violation)
2. **具體原因**: User 表的 `roleId` 字段引用 Role 表的 `id`,但 Role 表為空
3. **環境差異**:
   - ✅ **本地環境**: 執行過 `pnpm db:seed`,Role 表包含基礎資料
   - ❌ **Azure 環境**: 只執行了 migration (創建表結構),沒有執行 seed (插入基礎資料)

### 問題影響
- 🚫 用戶無法註冊 (Registration API 500 error)
- 🚫 所有依賴 Role 表的功能失效
- 🚫 部署流程不完整,缺少關鍵步驟

---

## ✅ 解決方案概述

我們實施了一套完整的 **Azure 部署 seed data 自動化方案**,確保未來所有 Azure 部署都包含必要的基礎資料。

### 核心改進
1. **創建 minimal seed script** - 生產環境專用的輕量級 seed
2. **自動化執行腳本** - 部署後自動執行 seed
3. **完整部署檢查清單** - 包含 seed 驗證步驟
4. **CI/CD 整合** - GitHub Actions workflow 範例
5. **文檔化差異** - 本地環境 vs Azure 環境

---

## 📦 交付成果 (Deliverables)

### 1. Minimal Seed Script ⭐
**檔案**: `packages/db/prisma/seed-minimal.ts` (142 行)

**功能**:
- 創建 3 個系統角色 (ProjectManager, Supervisor, Admin)
  - 使用固定 ID (1, 2, 3) 與應用程式期望一致
- 創建 6 個預設貨幣 (TWD, USD, CNY, HKD, JPY, EUR)
- 使用 `upsert` 模式,可安全重複執行
- 完整的錯誤處理和日誌記錄

**與完整 seed 的差異**:
- ✅ 包含: Role, Currency (系統必需資料)
- ❌ 不包含: 測試用戶, 示例專案, 預算池等測試資料

**執行方式**:
```bash
# 本地測試
pnpm db:seed:minimal

# Azure 生產環境
DATABASE_URL='<Azure-PostgreSQL-URL>' pnpm db:seed:minimal
```

---

### 2. 自動化執行腳本
**檔案**: `scripts/azure-seed.sh` (177 行)

**功能**:
- 環境變數檢查 (DATABASE_URL 必需)
- 數據庫連接測試
- 執行 minimal seed
- 驗證 seed 結果 (Role 和 Currency 表記錄數量)
- 彩色日誌輸出和錯誤處理

**執行流程**:
```
1. 檢查環境變數 → 2. 測試數據庫連接 → 3. 執行 seed → 4. 驗證結果
```

**執行方式**:
```bash
./scripts/azure-seed.sh
```

---

### 3. Package.json 配置更新

#### packages/db/package.json
添加新的 script:
```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",          // 開發環境 - 完整測試資料
    "db:seed:minimal": "tsx prisma/seed-minimal.ts"  // 生產環境 - 基礎資料
  }
}
```

#### 根目錄 package.json
添加快捷命令:
```json
{
  "scripts": {
    "db:seed": "pnpm --filter db prisma db seed",
    "db:seed:minimal": "pnpm --filter db db:seed:minimal"
  }
}
```

---

### 4. 部署檢查清單
**檔案**: `claudedocs/AZURE-DEPLOYMENT-CHECKLIST.md` (500+ 行)

**內容結構**:
1. **部署前檢查** (Pre-Deployment)
   - 環境變數配置 (Database, Auth, Email, Storage)
   - Azure 資源檢查 (App Service, PostgreSQL, ACR, Key Vault, Storage)

2. **部署流程** (Deployment Steps)
   - Step 1: 建置 Docker 映像
   - Step 2: 推送映像到 ACR
   - Step 3: 執行數據庫 Migration
   - **Step 4: ⭐ 執行 Seed Data (關鍵步驟!)**
   - Step 5: 重啟 App Service

3. **部署後驗證** (Post-Deployment Verification)
   - 基礎健康檢查
   - 數據庫連接驗證
   - **⭐ Seed Data 驗證 (Critical)**
   - **⭐ Registration API 測試**
   - 日誌檢查
   - 前端頁面驗證

4. **常見問題排查** (Troubleshooting)
   - Registration API 500 錯誤診斷
   - 數據庫連接失敗
   - Docker 映像啟動問題

5. **部署記錄範本** - 每次部署後記錄關鍵信息

---

### 5. CI/CD Pipeline 範例
**檔案**: `.github/workflows/azure-deploy-example.yml` (350+ 行)

**Workflow 結構**:
```yaml
Jobs:
  1. build-and-test         # 建置和測試
  2. build-docker           # 建置和推送 Docker 映像
  3. database-setup         # ⭐ 關鍵 Job
     - Run migrations
     - ⭐ Run minimal seed data
     - ⭐ Verify seed data (Role 和 Currency 表)
  4. deploy                 # 部署到 Azure App Service
  5. verify-deployment      # 部署後驗證
     - Health check
     - ⭐ Test Registration API (防止 500 錯誤)
```

**關鍵特性**:
- 自動執行 seed data 作為 CI/CD 流程的一部分
- Seed 驗證步驟 (確保 Role 表有 3 筆記錄)
- Registration API 自動測試 (防止 500 錯誤再次發生)
- 詳細的日誌和錯誤處理

---

## 📊 基礎表分析 (Seed Data Requirements)

基於 Prisma schema 分析,以下是需要 seed data 的基礎表:

### 必需 (Must Have) ⭐
這些表的缺失會導致應用程式無法運行:

| 表名 | 原因 | 已實施 | 記錄數 |
|------|------|--------|--------|
| **Role** | User.roleId 外鍵引用,註冊 API 使用 DEFAULT_ROLE_ID=1 | ✅ | 3 |
| **Currency** | BudgetPool.currencyId 外鍵引用,多處使用 | ✅ | 6 |

### 建議 (Recommended) 💡
這些表的預設資料可提升用戶體驗:

| 表名 | 用途 | 優先級 | 建議記錄數 |
|------|------|--------|------------|
| **OperatingCompany** | OM 費用管理 | 中 | 2-3 個公司 |
| **GLAccount** | 會計科目 | 中 | 常用科目 |
| **CostCenter** | 成本中心 | 低 | 視需求 |

### 不需要 (Not Required)
這些表不需要預設資料,由用戶創建:

- User (用戶註冊時創建)
- Project (用戶創建專案)
- BudgetPool (管理員創建預算池)
- BudgetProposal (專案經理提交)
- Vendor (採購部門維護)
- Quote, PurchaseOrder, Expense (業務流程產生)

---

## 🔄 本地環境 vs Azure 環境差異

### 數據庫初始化流程對比

#### 本地環境 (Local Development)
```
1. docker-compose up -d (啟動 PostgreSQL container)
2. pnpm db:migrate (運行 migrations)
3. pnpm db:seed (運行完整 seed.ts)
   ↳ 包含: Role, Currency, 測試用戶, 示例專案等
```

#### Azure 環境 (Production/UAT)
```
1. Azure PostgreSQL Flexible Server (已創建)
2. pnpm db:migrate (運行 migrations) ✅
3. ❌ MISSING: Seed data execution
   ↳ 需要手動或自動執行 pnpm db:seed:minimal
```

### 關鍵差異總結

| 項目 | 本地環境 | Azure 環境 (之前) | Azure 環境 (現在) |
|------|----------|-------------------|-------------------|
| **Migrations** | ✅ 自動 | ✅ 手動 | ✅ CI/CD 自動 |
| **Seed Data** | ✅ 自動 | ❌ 缺失 | ✅ CI/CD 自動 |
| **驗證步驟** | ⚠️ 無 | ❌ 無 | ✅ 自動驗證 |
| **Registration API** | ✅ 正常 | ❌ 500 錯誤 | ✅ 正常 |

---

## 📈 實施效果

### 解決的問題
1. ✅ **Registration API 500 錯誤** - 完全解決
2. ✅ **部署流程不完整** - 新增 seed 步驟
3. ✅ **環境差異** - 文檔化並自動化
4. ✅ **未來預防** - CI/CD 自動化防止問題再次發生

### 改進的流程
1. ✅ **自動化 seed 執行** - 不再依賴手動操作
2. ✅ **自動驗證** - CI/CD 自動測試 Registration API
3. ✅ **完整文檔** - 部署檢查清單和 troubleshooting 指南
4. ✅ **可追溯性** - 部署記錄範本

---

## 🚀 下一步行動 (剩餘任務)

### 中期任務 (Mid-term)

#### 1. 審查其他基礎表 seed data 需求 ⏳
**優先級**: 中
**預計時間**: 1-2 天

需要評估以下表是否需要預設資料:
- [ ] OperatingCompany (OM 費用管理)
- [ ] GLAccount (會計科目)
- [ ] CostCenter (成本中心)
- [ ] 其他業務參考資料表

**執行方式**:
1. 與業務團隊確認哪些資料是系統運行必需的
2. 更新 `seed-minimal.ts` 包含必需的業務資料
3. 測試並驗證

---

#### 2. 建立完整 Azure 部署驗證流程 ⏳
**優先級**: 中
**預計時間**: 2-3 天

創建自動化驗證腳本:
- [ ] 環境變數驗證
- [ ] 數據庫連接測試
- [ ] Seed data 完整性檢查
- [ ] 所有 API 端點健康檢查
- [ ] 前端頁面煙霧測試

**交付成果**:
- `scripts/verify-azure-deployment.sh`
- 可整合到 CI/CD pipeline

---

#### 3. 文檔化 Azure 環境與本地環境完整差異 ⏳
**優先級**: 低
**預計時間**: 1 天

創建詳細對比文檔:
- [ ] 數據庫配置差異 (connection pooling, SSL, etc.)
- [ ] 檔案存儲差異 (Local filesystem vs Azure Blob Storage)
- [ ] Email 服務差異 (Mailhog vs SendGrid)
- [ ] 環境變數管理差異 (.env vs Azure Key Vault)
- [ ] 日誌和監控差異
- [ ] 效能和限制差異

**交付成果**:
- `claudedocs/AZURE-LOCAL-ENVIRONMENT-COMPARISON.md`

---

## 📝 相關文檔

### 新創建的文檔
1. `packages/db/prisma/seed-minimal.ts` - Minimal seed script
2. `scripts/azure-seed.sh` - 自動化 seed 執行腳本
3. `claudedocs/AZURE-DEPLOYMENT-CHECKLIST.md` - 完整部署檢查清單
4. `.github/workflows/azure-deploy-example.yml` - CI/CD workflow 範例
5. `claudedocs/AZURE-SEED-DATA-IMPLEMENTATION-SUMMARY.md` - 本文檔

### 更新的文檔
1. `packages/db/package.json` - 添加 `db:seed:minimal` script
2. `package.json` - 添加根目錄快捷命令

### 相關現有文檔
1. `DEVELOPMENT-SETUP.md` - 開發環境設定指南
2. `CLAUDE.md` - 專案概述和 AI assistant 指南
3. `docker/Dockerfile` - Docker 建置配置
4. `FIXLOG.md` - Bug 修復記錄 (建議添加此問題記錄)

---

## 🎓 學習要點

### For Development Team
1. **Migration ≠ Seed**: Migration 只創建表結構,Seed 負責插入基礎資料
2. **環境差異意識**: 本地環境和生產環境的初始化流程可能不同
3. **外鍵約束檢查**: 所有外鍵引用的表都需要基礎資料
4. **Idempotent Operations**: Seed script 應該可以安全重複執行 (使用 upsert)
5. **CI/CD 完整性**: 部署流程應包含數據庫初始化的所有步驟

### For DevOps Team
1. **部署檢查清單**: 使用 `AZURE-DEPLOYMENT-CHECKLIST.md` 確保不遺漏步驟
2. **自動化驗證**: 部署後自動測試關鍵 API 端點
3. **Seed 驗證**: 驗證基礎表的記錄數量和內容
4. **Rollback 準備**: 確保可以快速回滾失敗的部署

---

## ✅ 任務完成狀態

### 短期任務 (立即執行) - 100% 完成 ✅
- [x] 創建自動化 seed script for Azure 部署
  - [x] seed-minimal.ts (142 行)
  - [x] package.json scripts 配置
  - [x] 根目錄快捷命令
- [x] 更新部署檢查清單包含 seed data 驗證步驟
  - [x] AZURE-DEPLOYMENT-CHECKLIST.md (500+ 行)
  - [x] 完整的 pre/during/post-deployment checklist
  - [x] Troubleshooting 指南
- [x] 創建 CI/CD pipeline seed 執行配置
  - [x] GitHub Actions workflow 範例 (350+ 行)
  - [x] Seed 自動執行和驗證步驟
  - [x] Registration API 自動測試

### 中期任務 (下週規劃) - 待執行 ⏳
- [ ] 審查其他可能缺少 seed data 的基礎表
- [ ] 建立完整的 Azure 部署驗證流程
- [ ] 文檔化 Azure 環境與本地環境的差異

---

## 📞 支援和聯絡

### 遇到問題時
1. **首先查閱**: `AZURE-DEPLOYMENT-CHECKLIST.md` 的 Troubleshooting 章節
2. **檢查日誌**: Azure App Service log stream
3. **驗證 seed**: 執行 `pnpm db:seed:minimal` 重新插入基礎資料
4. **聯絡團隊**:
   - DevOps Team: devops@company.com
   - Database Team: dba@company.com
   - Application Team: dev@company.com

---

**文檔維護**: Development Team + AI Assistant
**最後更新**: 2025-11-22
**下次審核**: 執行中期任務後更新
