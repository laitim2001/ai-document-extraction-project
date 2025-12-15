# 核心架構決策

## 決策優先級分析

**關鍵決策（阻塞實作）：**
- 數據庫 ORM 選擇 → 影響所有數據操作
- 認證整合方式 → 影響所有 API 安全
- 前後端通信模式 → 影響 API 設計

**重要決策（塑造架構）：**
- 緩存策略 → 影響性能優化
- 狀態管理 → 影響前端複雜度
- 部署平台 → 影響運維方式

**延後決策（MVP 後）：**
- 進階監控儀表板
- 自動擴展策略
- 災難恢復詳細配置

## 數據架構

| 項目 | 決策 | 版本 | 原因 |
|------|------|------|------|
| ORM | Prisma | 最新穩定版 | 成熟穩定、社群資源豐富、學習曲線低 |
| 遷移工具 | Prisma Migrate | 配套 | 與 ORM 整合、支持版本控制 |
| 緩存 | Azure Cache for Redis | - | 企業級、高效能 |
| 數據庫連接 | @prisma/client | - | Prisma 官方客戶端 |

## 認證與安全

| 項目 | 決策 | 版本 | 原因 |
|------|------|------|------|
| Azure AD 整合 | NextAuth + Azure AD Provider | v5 | 統一抽象、社群支持 |
| Session 管理 | JWT（無狀態） | - | 分佈式相容 |
| 授權模式 | RBAC | - | 符合 PRD 角色定義 |
| API 安全 | JWT Bearer Token | - | Azure AD 相容 |

**角色權限矩陣：**

| 角色 | 處理發票 | 查看報表 | 管理規則 | 系統配置 |
|------|:--------:|:--------:|:--------:|:--------:|
| DataProcessor | ✅ | ❌ | ❌ | ❌ |
| Manager | ✅ | ✅ | ❌ | ❌ |
| SuperUser | ✅ | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |

## API 與通信模式

| 項目 | 決策 | 原因 |
|------|------|------|
| 前後端通信 | REST API | 與 Python 後端相容 |
| 數據獲取 | React Query v5 | 緩存、重試、樂觀更新 |
| API 文檔 | OpenAPI 3.0 | 自動生成、業界標準 |
| 錯誤格式 | RFC 7807 Problem Details | 統一錯誤結構 |

**API 層級：**

```
Client → Next.js API Routes (BFF) → Python Services → Azure AI
```

## 前端架構

| 項目 | 決策 | 版本 | 原因 |
|------|------|------|------|
| 狀態管理 | Zustand | v4+ | 輕量、簡單 |
| 伺服器狀態 | React Query | v5 | 緩存、同步 |
| 表單 | React Hook Form + Zod | 最新 | 性能、類型安全 |
| PDF 渲染 | react-pdf | 最新 | 成熟穩定 |
| 圖表 | Recharts | 最新 | React 原生、響應式 |

## 基礎設施與部署

| 項目 | 決策 | 原因 |
|------|------|------|
| Next.js 部署 | Azure App Service | Azure 生態一致 |
| Python 服務 | Azure Container Apps | 按需擴展 |
| CI/CD | GitHub Actions | 免費、整合佳 |
| 監控 | Azure Application Insights | 統一監控 |
| 日誌 | Azure Log Analytics | 7 年保留 |
| Secret 管理 | Azure Key Vault | 企業級安全 |

## 決策影響分析

**實作順序：**
1. 專案初始化（Next.js + shadcn/ui）
2. 數據庫設計與 Prisma 配置
3. Azure AD 認證整合
4. API 層建立（BFF 模式）
5. Python 服務部署
6. AI 服務整合

---
