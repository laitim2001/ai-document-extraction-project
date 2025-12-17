# Story Development Checklist (Story 開發檢查清單)

本文件提供 AI 助手在開發每個 Story 時的標準化檢查清單，確保一致性和品質。

---

## 1. 開發前準備 (Pre-Development)

### 1.1 Context 載入
- [ ] 閱讀 `implementation-context.md` 了解專案整體架構
- [ ] 閱讀對應的 Story 檔案 (`stories/story-X-Y-*.md`)
- [ ] 閱讀對應的 Tech Spec (`tech-specs/epic-XX-*/tech-spec-story-X-Y.md`)
- [ ] 確認 Story 的前置依賴是否已完成
- [ ] 檢查 `component-registry.md` 是否有可重用的元件
- [ ] 檢查 `api-registry.md` 是否有相關的 API 端點

### 1.2 需求確認
- [ ] 理解 Story 的業務目標和驗收標準 (Acceptance Criteria)
- [ ] 確認 UI/UX 設計要求 (如有)
- [ ] 確認 API 規格和資料模型
- [ ] 確認效能和安全要求
- [ ] 列出所有需要實作的功能點

---

## 2. 開發階段 (Development)

### 2.1 後端開發 (Backend)

#### 資料模型 (Prisma)
- [ ] 更新 `prisma/schema.prisma` (如需要)
- [ ] 執行 `npx prisma generate` 生成客戶端
- [ ] 執行 `npx prisma migrate dev --name <migration-name>` (如有 schema 變更)
- [ ] 確認 RLS (Row Level Security) 策略已定義 (如適用)

#### Services (服務層)
- [ ] 建立/更新服務檔案於 `src/services/`
- [ ] 遵循既有的服務模式 (單例模式或類別)
- [ ] 實作完整的錯誤處理
- [ ] 添加適當的日誌記錄 (使用專案統一的 logger)
- [ ] 實作輸入驗證 (使用 Zod)

#### API Routes
- [ ] 建立/更新 API 路由於 `src/app/api/`
- [ ] 使用 Next.js App Router 模式
- [ ] 實作身份驗證檢查 (authOptions)
- [ ] 實作權限檢查 (角色和城市權限)
- [ ] 定義完整的 Zod 驗證 schema
- [ ] 返回標準化的 API 回應格式
- [ ] 添加適當的 HTTP 狀態碼

#### 安全性
- [ ] 實作 RBAC 權限檢查
- [ ] 實作城市資料隔離 (RLS)
- [ ] 防止 SQL 注入 (使用 Prisma 參數化查詢)
- [ ] 驗證所有用戶輸入
- [ ] 記錄審計日誌 (如需要)

### 2.2 前端開發 (Frontend)

#### 頁面和元件
- [ ] 建立頁面於 `src/app/(protected)/` 或 `src/app/(public)/`
- [ ] 建立可重用元件於 `src/components/`
- [ ] 使用 shadcn/ui 元件庫
- [ ] 使用 Tailwind CSS 樣式
- [ ] 實作響應式設計 (RWD)
- [ ] 支援深色/淺色主題 (如適用)

#### 狀態管理
- [ ] 使用 React Query 進行資料獲取
- [ ] 使用 Zustand 進行全局狀態管理 (如需要)
- [ ] 實作樂觀更新 (如適用)
- [ ] 處理載入和錯誤狀態

#### 表單處理
- [ ] 使用 React Hook Form 進行表單管理
- [ ] 使用 Zod 進行前端驗證
- [ ] 顯示適當的驗證錯誤訊息
- [ ] 實作表單提交狀態 (loading/success/error)

#### 國際化 (i18n)
- [ ] 所有使用者可見文字使用 `next-intl`
- [ ] 更新 `messages/zh-TW.json` 和 `messages/en.json`
- [ ] 日期/數字格式使用 locale 感知的格式化

#### 無障礙性 (Accessibility)
- [ ] 添加適當的 ARIA 標籤
- [ ] 確保鍵盤導航支援
- [ ] 確保足夠的顏色對比度
- [ ] 提供替代文字 (圖片)

---

## 3. 測試階段 (Testing)

### 3.1 單元測試
- [ ] 服務層函數測試
- [ ] 工具函數測試
- [ ] 驗證邏輯測試

### 3.2 整合測試
- [ ] API 端點測試
- [ ] 資料庫操作測試

### 3.3 E2E 測試 (如適用)
- [ ] 關鍵使用者流程測試
- [ ] 表單提交測試
- [ ] 錯誤處理測試

### 3.4 手動測試
- [ ] 功能驗證 (所有 Acceptance Criteria)
- [ ] 邊界條件測試
- [ ] 錯誤情況處理測試
- [ ] 權限測試 (不同角色)
- [ ] 響應式設計測試

---

## 4. 程式碼品質 (Code Quality)

### 4.1 程式碼風格
- [ ] 遵循 ESLint 規則
- [ ] 遵循 Prettier 格式化
- [ ] 檔案命名符合專案慣例
- [ ] 變數/函數命名清晰有意義

### 4.2 類型安全
- [ ] 所有新程式碼使用 TypeScript
- [ ] 避免使用 `any` 類型
- [ ] 定義完整的介面和類型
- [ ] 執行 `npm run type-check` 無錯誤

### 4.3 效能考量
- [ ] 避免不必要的重新渲染
- [ ] 使用適當的 React 優化 (useMemo, useCallback)
- [ ] 資料庫查詢優化 (避免 N+1)
- [ ] 適當的分頁和虛擬化 (大量資料)

### 4.4 文件更新
- [ ] 更新 `component-registry.md` (如新增元件)
- [ ] 更新 `api-registry.md` (如新增 API)
- [ ] 更新相關的 README (如需要)
- [ ] 添加必要的程式碼註解

---

## 5. 完成驗收 (Completion)

### 5.1 功能驗收
- [ ] 所有 Acceptance Criteria 已滿足
- [ ] 所有 API 端點正常運作
- [ ] UI 符合設計規格
- [ ] 錯誤處理正確

### 5.2 程式碼審查
- [ ] 自我審查程式碼變更
- [ ] 確認無遺留的 TODO 或 FIXME
- [ ] 確認無硬編碼的敏感資訊
- [ ] 確認無未使用的程式碼

### 5.3 更新文件
- [ ] 更新 `lessons-learned.md` (記錄重要發現)
- [ ] 標記 Story 狀態為 `done`

---

## 6. 常用命令 (Common Commands)

```bash
# 開發伺服器
npm run dev

# 類型檢查
npm run type-check

# Lint 檢查
npm run lint

# 格式化程式碼
npm run format

# Prisma 生成客戶端
npx prisma generate

# Prisma 資料庫遷移
npx prisma migrate dev --name <migration-name>

# Prisma Studio (資料庫 GUI)
npx prisma studio

# 執行測試
npm run test

# 建置
npm run build
```

---

## 7. 專案目錄結構參考

```
src/
├── app/
│   ├── (protected)/     # 需要登入的頁面
│   │   ├── dashboard/
│   │   ├── invoices/
│   │   ├── admin/
│   │   └── ...
│   ├── (public)/        # 公開頁面
│   │   └── login/
│   ├── api/             # API 路由
│   │   ├── auth/
│   │   ├── invoices/
│   │   ├── admin/
│   │   └── ...
│   └── layout.tsx
├── components/
│   ├── ui/              # shadcn/ui 元件
│   ├── forms/           # 表單元件
│   ├── tables/          # 表格元件
│   ├── charts/          # 圖表元件
│   └── layout/          # 佈局元件
├── services/            # 業務邏輯服務
├── lib/                 # 工具函數和配置
├── hooks/               # 自定義 React Hooks
├── types/               # TypeScript 類型定義
└── stores/              # Zustand 狀態存儲
```

---

## 8. 快速參考表

### HTTP 狀態碼
| 狀態碼 | 用途 |
|--------|------|
| 200 | 成功取得資料 |
| 201 | 成功建立資源 |
| 400 | 請求參數錯誤 |
| 401 | 未認證 |
| 403 | 無權限 |
| 404 | 資源不存在 |
| 409 | 資源衝突 |
| 500 | 伺服器錯誤 |

### 角色權限
| 角色 | 代碼 | 範圍 |
|------|------|------|
| 全域管理員 | GLOBAL_ADMIN | 所有城市、所有功能 |
| 區域經理 | REGIONAL_MANAGER | 指定城市群、管理功能 |
| 城市經理 | CITY_MANAGER | 單一城市、管理功能 |
| 超級使用者 | SUPER_USER | 單一城市、審核+一般功能 |
| 一般使用者 | USER | 單一城市、一般功能 |

---

*最後更新: 2025-12-17*
