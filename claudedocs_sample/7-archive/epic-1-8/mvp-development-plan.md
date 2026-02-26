# IT 專案流程管理平台 MVP 開發計劃

> **狀態**: ✅ **MVP Phase 1 完成** (100% 完成 - 2025-10-22更新)
> **實際團隊規模**: 1-3 人（AI 輔助開發）
> **實際完成時程**: 8 週 (2025-10-02 至 2025-10-07)
> **架構**: Next.js 14 全棧開發 (Turborepo Monorepo + T3 Stack)
> **當前階段**: Post-MVP 增強階段 - 設計系統遷移與環境優化

## 🎉 MVP 完成總結 (2025-10-22更新)

### ✅ 所有 8 個 Epic 已完成
- **Epic 1**: Azure AD B2C 企業級認證系統 ✅
- **Epic 2**: CI/CD 與部署自動化 ✅
- **Epic 3**: 預算池與專案管理 ✅
- **Epic 4**: 提案與審批工作流 ✅
- **Epic 5**: 採購與供應商管理 ✅
- **Epic 6**: 費用記錄與財務整合 ✅
- **Epic 7**: 儀表板與基本報表 ✅
- **Epic 8**: 通知系統 (Email 整合) ✅

### 🚀 Post-MVP 增強成果 (2025-10-16 至 2025-10-22)
- **設計系統遷移**: 完成 Source Design System 遷移 (29 個頁面 + 15+ 新 UI 組件)
- **環境部署優化**: 完整的跨平台設置指引 + 自動化環境檢查
- **質量提升**: 修復 Webpack 警告、GitHub 同步、環境一致性問題
- **新增頁面**: Quotes, Settings, Register, Forgot Password
- **新增功能**: 主題切換、無障礙性增強、Toast 通知系統

## 📊 項目準備完整性評估

### ✅ 已完成的準備工作
- **架構設計**: Turborepo Monorepo + Next.js 14 全棧架構 ✅
- **資料庫設計**: Prisma schema with PostgreSQL ✅
- **技術棧統一**: T3 Stack (Next.js + tRPC + Prisma + TypeScript) ✅
- **用戶故事**: 詳細 Epic 和 Story 定義 ✅
- **API 規格**: tRPC 端點完整定義 ✅
- **PRD 文檔**: 完整產品需求文檔 ✅
- **架構文檔**: 全端架構設計文檔 ✅

### ✅ **所有準備工作已完成** (2025-10-02更新)
- **開發環境配置**: package.json, Docker, 環境變數 ✅ **已完成**
- **CI/CD 管道**: GitHub Actions 工作流 ✅ **已完成**
- **部署配置**: Docker 開發環境已完全配置並運行 ✅ **已完成**

## 🎯 MVP Phase 1 開發路線圖 - **🚧 進行中** (40% 完成)

> **🏆 重要更新**: 基礎架構、Budget Pool、Project、User 管理、BudgetProposal 審批工作流已完成

### 📅 Sprint 0：專案初始化與核心業務功能 (Week 0-1) - **🚧 進行中 (75%)**

**目標**: 建立完整的專案基礎架構和核心業務 CRUD - **✅ 大部分已達成**

#### Epic 0.1: 專案初始化與基礎架構設定 🔴 - **✅ 已完成**

**Week 0 Day 1-3: 架構建立**
- Next.js 14 Turborepo Monorepo 初始化
- TypeScript + Tailwind CSS 配置
- Prisma + PostgreSQL 本地環境
- 基礎 Docker 容器化
- tRPC API 層建立
- Radix UI 元件庫建立

**Week 0 Day 4-5: Budget Pool CRUD**
- Budget Pool 資料模型設計
- Budget Pool API 路由實現
- Budget Pool 前端頁面（列表、詳情、新增、編輯）
- BudgetPoolForm 表單元件
- 分頁與篩選功能

**交付物** - **✅ 全部完成**:
- ✅ 可運行的 Next.js 14 應用 - **已完成並運行**
- ✅ PostgreSQL + Docker 本地環境 - **已完成並整合**
- ✅ 基礎 Turborepo 配置 - **已完成**
- ✅ Budget Pool 完整 CRUD - **已完成**
- ✅ UI 元件庫 - **已完成**

**代碼統計** - **✅ 已完成**:
- Monorepo 架構: ~500行
- Prisma Schema: ~400行
- tRPC API: ~600行
- Budget Pool CRUD: ~1,200行
- UI 元件庫: ~1,500行
- Docker 配置: ~300行
- **總計**: ~5,300行核心代碼

---

#### Epic 0.2: 專案與使用者管理 🔴 - **✅ 已完成**

**Week 0 Day 6: Project CRUD**
- Project 資料模型完善（新增 startDate/endDate）
- Project API 路由實現
- Project 前端頁面（列表、詳情、新增、編輯）
- ProjectForm 表單元件

**Week 1 Day 1: User 管理系統**
- User 資料模型完善
- User API 路由實現（CRUD + getManagers + getSupervisors）
- User 前端頁面（列表、詳情、新增、編輯）
- UserForm 表單元件
- 角色管理（ProjectManager/Supervisor/Admin）

**Week 1 Day 1: BudgetProposal 審批工作流**
- BudgetProposal 資料模型設計
- 審批工作流狀態機（Draft → PendingApproval → Approved/Rejected/MoreInfoRequired）
- BudgetProposal API 路由（CRUD + submit + approve + reject + addComment）
- BudgetProposal 前端頁面（列表、詳情、新增、編輯）
- ProposalActions 審批操作元件
- CommentSection 評論元件
- History 歷史記錄追蹤

**交付物** - **✅ 全部完成**:
- ✅ Project 完整 CRUD - **已完成**
- ✅ User 管理系統 - **已完成**
- ✅ BudgetProposal 審批工作流 - **已完成**
- ✅ 評論與歷史記錄系統 - **已完成**

**代碼統計** - **✅ 已完成**:
- Project CRUD: ~1,200行
- User 管理: ~1,500行
- BudgetProposal 系統: ~2,000行
- **總計**: ~4,700行核心業務代碼
- **累計專案代碼**: ~10,000行

---

#### Epic 0.3: 認證系統基礎 - **📋 待開始 (25%)**

**Week 1 Day 2-3: Azure AD B2C 基礎整合**
- Azure AD B2C 租戶設定
- NextAuth.js 配置
- Azure AD B2C Provider 整合
- 基礎登入/登出功能
- Session 管理

**交付物** - **📋 待開始**:
- [ ] Azure AD B2C 基礎認證
- [ ] 登入/登出頁面
- [ ] Session 管理
- [ ] 受保護路由

**預估代碼**: ~800行

---

**Sprint 0 整體驗收標準**:
- ✅ Monorepo 架構運行正常
- ✅ Budget Pool CRUD 完整功能
- ✅ Project CRUD 完整功能
- ✅ User 管理系統運行
- ✅ BudgetProposal 審批工作流運行
- [ ] Azure AD B2C 基礎認證

**當前進度**: 75% (6/8 主要交付物完成)

---

### 📅 Sprint 1: 供應商與採購管理 (Week 2-3) - **📋 待開始**

**目標**: 實現供應商管理和報價比較功能

#### Epic 5: 採購與供應商管理 🔴

**Week 2 Day 1-2: 供應商管理**
- Vendor 資料模型設計
- Vendor API 路由實現
- Vendor 前端頁面（列表、詳情、新增、編輯）
- VendorForm 表單元件
- 供應商基本信息管理

**Week 2 Day 3-4: 報價管理**
- Quote 資料模型設計
- Quote API 路由實現（CRUD + uploadFile）
- Quote 前端頁面（列表、詳情、上傳）
- QuoteForm 表單元件
- 報價檔案上傳（Azure Blob Storage）

**Week 2 Day 5: 供應商選擇**
- 報價比較介面
- 供應商評分系統
- 最終供應商選擇功能

**Week 3 Day 1-2: 採購單生成**
- PurchaseOrder 資料模型設計
- PurchaseOrder API 路由實現
- PurchaseOrder 生成邏輯（基於選定的 Quote）
- PurchaseOrder 前端頁面（列表、詳情）
- PO 狀態管理

**交付物**:
- [ ] 完整的供應商管理系統
- [ ] 報價上傳和比較功能
- [ ] 採購單生成功能
- [ ] 供應商評分系統

**預估代碼**: ~2,500行

---

### 📅 Sprint 2: 費用記錄與審批 (Week 3-4) - **📋 待開始**

**目標**: 實現費用記錄和審批流程

#### Epic 6: 費用記錄與財務整合 🔴

**Week 3 Day 3-4: 費用記錄**
- Expense 資料模型設計
- Expense API 路由實現（CRUD + 關聯 PO）
- Expense 前端頁面（列表、詳情、新增、編輯）
- ExpenseForm 表單元件
- 發票上傳功能

**Week 3 Day 5: 費用審批**
- Expense 審批工作流（Draft → PendingApproval → Approved → Paid）
- ExpenseActions 審批操作元件
- 審批歷史記錄

**Week 4 Day 1: 預算池對接**
- Expense 與 BudgetPool 關聯邏輯
- 預算使用統計
- 預算餘額計算

**Week 4 Day 2: Charge Out 功能**
- Charge Out 邏輯實現
- 專案歸檔功能
- 成本分攤報告

**交付物**:
- [ ] 完整的費用記錄系統
- [ ] 費用審批工作流
- [ ] 預算池對接功能
- [ ] Charge Out 功能

**預估代碼**: ~2,000行

---

### 📅 Sprint 3: 儀表板與報告 (Week 4-5) - **📋 待開始**

**目標**: 提供角色化儀表板和基礎報告功能

#### Epic 7: 儀表板與基礎報告 🔴

**Week 4 Day 3-4: ProjectManager 儀表板**
- PM 儀表板頁面設計
- 我的專案概覽
- 待處理提案
- 費用記錄快速入口
- 關鍵指標卡片

**Week 4 Day 5: Supervisor 儀表板**
- Supervisor 儀表板頁面設計
- 待審批提案列表
- 專案監控概覽
- 預算使用情況
- 團隊績效指標

**Week 5 Day 1: Budget Pool 概覽**
- Budget Pool 總覽頁面
- 預算分配視覺化
- 預算使用趨勢圖
- 專案預算排名

**Week 5 Day 2: 基礎數據導出**
- 數據導出功能（Excel/CSV）
- 報告範本設計
- 批量導出功能

**交付物**:
- [ ] ProjectManager 儀表板
- [ ] Supervisor 儀表板
- [ ] Budget Pool 概覽頁面
- [ ] 基礎數據導出功能

**預估代碼**: ~1,500行

---

### 📅 Sprint 4: 通知系統 (Week 5) - **📋 待開始**

**目標**: 實現自動化通知機制

#### Epic 8: 通知系統 🔴

**Week 5 Day 3: Email 通知服務**
- SendGrid 整合
- Email 範本設計
- 通知配置管理

**Week 5 Day 4-5: 自動化通知**
- 提案提交通知
- 審批狀態變更通知
- 費用審批通知
- 即將到期提醒
- 預算警告通知

**交付物**:
- [ ] Email 通知服務
- [ ] 自動化通知觸發器
- [ ] 通知範本庫
- [ ] 通知偏好設置

**預估代碼**: ~1,000行

---

### 📅 Sprint 5: 認證完善與整合測試 (Week 6-7) - **📋 待開始**

**目標**: 完善認證系統和系統整合測試

#### Epic 1: 平台基礎與用戶認證（完善階段）

**Week 6 Day 1-2: 角色權限系統**
- 角色權限矩陣設計
- tRPC protectedProcedure 中間件
- 頁面級別權限控制
- API 級別權限驗證

**Week 6 Day 3-4: Azure AD B2C 完整整合**
- 用戶註冊流程
- 密碼重置流程
- 多因素認證（MFA）
- SSO 整合測試

**Week 6 Day 5 - Week 7: 整合測試**
- 端到端測試（Playwright）
- API 整合測試
- 用戶旅程測試
- 性能測試

**交付物**:
- [ ] 完整的角色權限系統
- [ ] Azure AD B2C 完整功能
- [ ] 整合測試套件
- [ ] 性能測試報告

**預估代碼**: ~1,500行（含測試）

---

### 📅 Sprint 6: 優化與部署準備 (Week 7-8) - **📋 待開始**

**目標**: 系統優化和生產部署準備

#### Epic 2: CI/CD 與部署自動化

**Week 7 Day 3-4: CI/CD 完善**
- GitHub Actions 工作流完善
- 自動化測試集成
- 代碼品質檢查（ESLint, TypeScript）
- 自動化部署腳本

**Week 7 Day 5 - Week 8 Day 1: Azure 部署**
- Azure App Service 配置
- Azure Database for PostgreSQL 設置
- Azure Blob Storage 配置
- Azure AD B2C 生產環境設置

**Week 8 Day 2-3: 性能優化**
- 資料庫查詢優化
- API 響應時間優化
- 前端打包優化
- 圖片和靜態資源優化

**Week 8 Day 4-5: 用戶驗收測試**
- UAT 測試計劃
- 用戶測試執行
- Bug 修復
- 文檔完善

**交付物**:
- [ ] 完整的 CI/CD 管道
- [ ] Azure 生產環境部署
- [ ] 性能優化報告
- [ ] UAT 測試報告
- [ ] 用戶手冊和管理員指南

**預估代碼**: ~800行（含部署腳本）

---

## 🛠️ 技術實施細節

### 核心技術棧
```yaml
Frontend:
  - Next.js 14 (App Router)
  - TypeScript 5.x
  - Tailwind CSS 3.x
  - Radix UI / Headless UI

Backend:
  - Next.js Server Components
  - tRPC 10.x (API 層)
  - Prisma ORM 5.x
  - PostgreSQL 16

認證:
  - Azure AD B2C
  - NextAuth.js

部署:
  - Azure App Service
  - Azure Database for PostgreSQL
  - Azure Blob Storage
  - GitHub Actions CI/CD

工具鏈:
  - Turborepo (Monorepo)
  - pnpm (Package Manager)
  - Docker (本地開發)
  - ESLint + Prettier
```

### 資料庫架構
```prisma
// 核心數據模型（已實現）
model User {
  id       String  @id @default(uuid())
  name     String?
  email    String  @unique
  roleId   String
  role     Role    @relation(fields: [roleId], references: [id])
  // ... 其他欄位和關聯
}

model BudgetPool {
  id          String   @id @default(uuid())
  name        String
  fiscalYear  String
  totalAmount Decimal
  description String?
  status      String   @default("Active")
  // ... 關聯
}

model Project {
  id           String    @id @default(uuid())
  name         String
  description  String?
  status       String    @default("Draft")
  managerId    String
  supervisorId String
  budgetPoolId String
  startDate    DateTime
  endDate      DateTime?
  // ... 關聯
}

model BudgetProposal {
  id          String   @id @default(uuid())
  projectId   String
  title       String
  description String
  amount      Decimal
  status      String   @default("Draft")
  // ... 關聯 (comments, history)
}

// 待實現模型
model Vendor { ... }
model Quote { ... }
model PurchaseOrder { ... }
model Expense { ... }
```

### API 架構
```typescript
// tRPC Router 結構
export const appRouter = createTRPCRouter({
  health: healthRouter,           // ✅ 已實現
  budgetPool: budgetPoolRouter,   // ✅ 已實現
  project: projectRouter,         // ✅ 已實現
  user: userRouter,               // ✅ 已實現
  budgetProposal: budgetProposalRouter, // ✅ 已實現
  vendor: vendorRouter,           // 📋 待實現
  quote: quoteRouter,             // 📋 待實現
  purchaseOrder: purchaseOrderRouter, // 📋 待實現
  expense: expenseRouter,         // 📋 待實現
});
```

## 📋 Sprint 交付檢查清單

### Sprint 0 - 專案初始化與核心業務 **🚧 進行中 (75%)**
- [x] Turborepo Monorepo 架構 - **✅ 已完成**
- [x] Next.js 14 應用初始化 - **✅ 已完成**
- [x] Prisma + PostgreSQL 環境 - **✅ 已完成**
- [x] Docker 容器化 - **✅ 已完成**
- [x] tRPC API 層 - **✅ 已完成**
- [x] UI 元件庫 - **✅ 已完成**
- [x] Budget Pool CRUD - **✅ 已完成**
- [x] Project CRUD - **✅ 已完成**
- [x] User 管理系統 - **✅ 已完成**
- [x] BudgetProposal 審批工作流 - **✅ 已完成**
- [ ] Azure AD B2C 基礎整合 - **📋 待完成**

### Sprint 1 - 供應商與採購管理 **📋 待開始**
- [ ] Vendor CRUD
- [ ] Quote 管理和上傳
- [ ] 報價比較功能
- [ ] PurchaseOrder 生成
- [ ] PO 狀態管理

### Sprint 2 - 費用記錄與審批 **📋 待開始**
- [ ] Expense CRUD
- [ ] 費用審批工作流
- [ ] 預算池對接
- [ ] Charge Out 功能

### Sprint 3 - 儀表板與報告 **📋 待開始**
- [ ] ProjectManager 儀表板
- [ ] Supervisor 儀表板
- [ ] Budget Pool 概覽
- [ ] 數據導出功能

### Sprint 4 - 通知系統 **📋 待開始**
- [ ] Email 通知服務
- [ ] 自動化通知觸發器
- [ ] 通知範本庫

### Sprint 5 - 認證完善與測試 **📋 待開始**
- [ ] 角色權限系統
- [ ] Azure AD B2C 完整整合
- [ ] 整合測試套件
- [ ] 性能測試

### Sprint 6 - 優化與部署 **📋 待開始**
- [ ] CI/CD 管道完善
- [ ] Azure 生產環境部署
- [ ] 性能優化
- [ ] UAT 測試

## 🎯 成功標準和驗收條件

### MVP 最低可行產品標準
1. **用戶認證**: Azure AD B2C 完整整合，支援登入/登出/權限控制
2. **預算管理**: Budget Pool 和 Project 完整 CRUD
3. **提案審批**: 完整的提案提交和審批工作流
4. **採購管理**: 供應商管理、報價比較、PO 生成
5. **費用記錄**: 費用記錄、審批、預算對接、Charge Out
6. **儀表板**: 角色化儀表板和基礎報告
7. **通知系統**: 關鍵流程自動化通知

### 技術驗收標準
- **性能**: API 響應時間 < 500ms (P95)
- **可用性**: 本地開發環境 100% 正常運行
- **安全性**: Azure AD B2C 認證和角色權限控制
- **可維護性**: 完整的 TypeScript 類型安全和代碼文檔

### 業務驗收標準
- **功能完整度**: 6 步工作流全部實現
- **用戶體驗**: 響應式設計，支援桌面和平板
- **數據一致性**: 完整的審計追蹤和歷史記錄

## 🚀 下一步行動計劃

### 即將執行的任務（Sprint 0 剩餘）
1. **Azure AD B2C 基礎整合** (Week 1 Day 2-3)
2. **Sprint 0 整合測試**
3. **Sprint 1 規劃會議**

### Sprint 1 準備（Week 2 開始）
1. **Vendor 和 Quote 數據模型設計**
2. **報價上傳功能技術驗證**
3. **PurchaseOrder 生成邏輯設計**

---

## 🚀 **當前狀態總結** (2025-10-03)

### ✅ **成功達成的目標**
- **已完成 Sprint 0 的 75%**: 10 個主要交付物中已完成 6 個
- **累計代碼量**: ~10,000 行核心代碼
- **系統健康**: 所有已實現功能正常運行
- **技術成果**:
  - Turborepo Monorepo 架構穩定
  - 5 個完整的 tRPC API 路由
  - 完整的 Budget Pool、Project、User、BudgetProposal CRUD
  - 審批工作流狀態機實現
  - UI 元件庫建立完成

---

## 🎯 **下階段重點**

基於當前進度，建議下階段重點：

### **優先級 A: 完成 Sprint 0** 📈
- Azure AD B2C 基礎整合
- 認證系統測試
- Sprint 0 整合驗證
- 預估時程：2-3 天

### **優先級 B: 進入 Sprint 1** 🚀
- 供應商與採購管理功能
- 報價系統實現
- PO 生成功能
- 預估時程：1 週

### **優先級 C: 持續優化** 🔧
- 代碼品質提升
- 測試覆蓋率增加
- 文檔完善
- 預估時程：與開發並行

---

**📅 MVP Phase 1 開始**: ✅ **2025-10-02**
**🎯 當前進度**: 40% (Sprint 0 進行中)
**📆 預計完成**: 2025-11-20（8 週後）
**🏆 最終目標**: 企業級 IT 專案流程管理平台

---

**🏆 讓我們繼續 MVP 的開發旅程，完成剩餘的功能模組！** 🚀
