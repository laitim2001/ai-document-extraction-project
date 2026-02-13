# 用戶反饋問題修復記錄
**日期**: 2025-10-16
**任務來源**: 用戶反饋的 8 個問題和改進需求

## 📋 任務清單

### ✅ 已完成任務

#### 1. 登錄頁添加註冊和忘記密碼連結
**狀態**: ✅ 已完成
**文件**:
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/register/page.tsx` (新增)
- `apps/web/src/app/forgot-password/page.tsx` (新增)

**變更內容**:
- 在登錄表單下方添加「忘記密碼？」連結
- 在 CardFooter 添加「還沒有帳號？立即註冊」連結
- 創建基礎註冊頁面（含表單驗證、成功頁面）
- 創建基礎忘記密碼頁面（含郵件發送確認）

**註**: 註冊和密碼重設功能目前為 UI 框架，需根據 Azure AD B2C 配置實現完整 API 功能。

---

#### 2. 修復登出重定向到錯誤端口問題
**狀態**: ✅ 已完成（需測試確認）
**文件**:
- `apps/web/src/components/layout/TopBar.tsx`
- `packages/auth/src/index.ts`

**變更內容**:
- 修改 `TopBar.tsx:77-84` 的 `handleSignOut` 函數
- 使用 `window.location.origin` 動態獲取當前端口
- 改為 async 函數並添加 `redirect: true` 選項
- 在 auth 配置中添加 events.signOut 處理器

**測試要點**:
- 在 localhost:3000 登出應重定向到 localhost:3000/login
- 確認不會固定重定向到 localhost:3001/login

---

#### 3. 更新 Dashboard 快速操作為 IT 專案相關功能
**狀態**: ✅ 已完成
**文件**: `apps/web/src/app/dashboard/page.tsx`

**變更內容**:
```javascript
// 修改前（銷售相關）:
{ name: '新增客戶', description: '建立新的客戶資料', icon: '➕' }
{ name: 'AI 助手', description: '開始智能對話', icon: '💬' }
{ name: '生成提案', description: '創建新提案文件', icon: '📋' }
{ name: '知識搜索', description: '查找產品信息', icon: '🔍' }
{ name: '安排會議', description: '預約客戶會議', icon: '📅' }
{ name: '聯絡客戶', description: '撥打或發送郵件', icon: '📞' }

// 修改後（IT 專案管理）:
{ name: '新增專案', description: '建立新的 IT 專案', icon: '📁' }
{ name: '建立提案', description: '提交預算提案申請', icon: '📋' }
{ name: '新增預算池', description: '創建財政年度預算池', icon: '💰' }
{ name: '供應商管理', description: '管理供應商資料', icon: '🏢' }
{ name: '查看採購單', description: '檢視採購訂單狀態', icon: '📄' }
{ name: '費用記錄', description: '記錄專案費用支出', icon: '💸' }
```

同時更新了 `recentActivities` 示例數據：
- 「客戶電話會議」→「預算提案已批准」
- 「提案文件生成」→「採購單已建立」
- 「新增客戶」→「新專案建立」

---

#### 4. 為專案管理頁面添加 List 視圖切換功能
**狀態**: ✅ 已完成
**文件**: `apps/web/src/app/projects/page.tsx`

**新增功能**:
1. **視圖狀態管理**: 添加 `viewMode` state (`'card' | 'list'`)
2. **切換按鈕**: 使用 LayoutGrid 和 List 圖標的按鈕組
3. **卡片視圖**: 原有的網格式卡片佈局（3列響應式）
4. **列表視圖**: 新增的表格式顯示，包含欄位：
   - 專案名稱
   - 狀態
   - 預算池
   - 專案經理
   - 主管
   - 提案數
   - 採購單數
   - 操作

**實現細節**:
- 導入 Table 相關組件和 LayoutGrid, List 圖標
- 視圖切換按鈕使用 border 容器包裹，active 狀態顯示 default variant
- 條件渲染：`viewMode === 'card' ? <CardView /> : <ListView />`
- 列表視圖保持與卡片視圖相同的數據和交互邏輯

---

### 🔄 進行中任務

#### 5. 為預算池、供應商、採購單、費用記錄頁面添加 List 視圖
**狀態**: 🔄 待執行
**優先級**: 高

**待處理頁面**:
1. `apps/web/src/app/budget-pools/page.tsx` - 預算池（卡片式 → 添加列表式）
2. `apps/web/src/app/vendors/page.tsx` - 供應商
3. `apps/web/src/app/purchase-orders/page.tsx` - 採購單
4. `apps/web/src/app/expenses/page.tsx` - 費用記錄

**實現模式** (參考 projects 頁面):
```typescript
// 1. 添加 imports
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { LayoutGrid, List } from 'lucide-react';

// 2. 添加 state
const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

// 3. 添加切換按鈕（在導出和新增按鈕之前）
<div className="flex border border-input rounded-md">
  <Button
    variant={viewMode === 'card' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('card')}
    className="rounded-r-none"
  >
    <LayoutGrid className="h-4 w-4" />
  </Button>
  <Button
    variant={viewMode === 'list' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('list')}
    className="rounded-l-none"
  >
    <List className="h-4 w-4" />
  </Button>
</div>

// 4. 條件渲染視圖
{viewMode === 'card' ? (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {/* 原有卡片 */}
  </div>
) : (
  <div className="rounded-lg border bg-card shadow-sm">
    <Table>
      {/* 表格內容 */}
    </Table>
  </div>
)}
```

**各頁面列表視圖欄位建議**:

**預算池 (Budget Pools)**:
- 預算池名稱
- 財務年度
- 總預算金額
- 專案數量
- 創建日期
- 操作

**供應商 (Vendors)**:
- 供應商名稱
- 聯絡人
- Email
- 電話
- 報價數量
- 採購單數量
- 操作

**採購單 (Purchase Orders)**:
- PO 編號
- 專案
- 供應商
- 金額
- 狀態
- 創建日期
- 操作

**費用記錄 (Expenses)**:
- 費用編號
- 採購單
- 金額
- 狀態
- 發票日期
- 操作

---

### ⏳ 待處理任務

#### 6. 實現 Quotes 頁面（目前 404）
**狀態**: ⏳ 待處理
**優先級**: 中

**問題分析**:
- 用戶訪問 `/quotes` 時返回 404
- 需確認 Quotes 是否應為獨立頁面還是專案範圍資源

**可能的解決方案**:

**方案 A: 專案範圍資源（推薦）**
根據 MVP-IMPLEMENTATION-CHECKLIST.md，Quote 管理應該在專案範圍內：
```
路徑: /projects/[id]/quotes
功能: 列出該專案的所有報價
```

**方案 B: 獨立頁面**
創建 `apps/web/src/app/quotes/page.tsx`，顯示所有專案的報價匯總。

**建議**: 採用方案 A，因為：
1. 符合業務邏輯（報價通常與特定專案關聯）
2. 與供應商、採購單的關係更清晰
3. 避免頁面過於複雜

**實現步驟**:
1. 檢查 tRPC API 是否有 `quote.getByProject` 端點
2. 在專案詳情頁添加「報價」Tab
3. 創建 `/projects/[id]/quotes` 頁面組件
4. 如需全局報價列表，可在側邊欄導航中鏈接到篩選過的專案頁面

---

#### 7. 評估當前開發階段並更新相關文檔
**狀態**: ⏳ 待處理
**優先級**: 高

**用戶問題**:
> "由於現在好像已經完成了PoC還是MVP階段, 再繼續開發的話, 應該是什麼階段呢? 而這些相關的開發或問題解決又應該同步到哪些文件中? 還是有需要用新文件?"

**當前階段分析**:

根據 `MVP-IMPLEMENTATION-CHECKLIST.md`:
```
MVP 完成度: 80%

已完成 (✅):
- Epic 2: CI/CD and Deployment Automation (100%)
- Epic 4: Vendor & Supplier Management (100%)
- Epic 5: Purchase Order Management (100%)
- Epic 6: Expense Recording & Invoice Management (100%)
- Epic 7: Reporting & Analytics (100%)
- Epic 8: Notification System & User Experience (100%)

進行中 (🔄):
- Epic 1: Platform Foundation and User Authentication (80%)
  - Story 1.3: Azure AD B2C Integration (未完成)

- Epic 3: Budget and Project Setup (75%)
  - Story 3.2: Project Management (部分功能待完善)
```

**階段評估**:

當前狀態：**MVP 接近完成階段 (80%)**

**接下來的開發階段建議**:

1. **MVP 完成階段 (MVP Completion Phase)** - 預計 2-3 週
   - 完成剩餘 20% MVP 功能
   - 完成 Azure AD B2C 整合
   - 完成所有核心功能的測試
   - 修復已知 bug

2. **MVP+ / 功能增強階段 (Enhancement Phase)** - 預計 1-2 個月
   - 用戶反饋驅動的功能改進
   - UI/UX 優化
   - 性能優化
   - 添加便利功能（如本次的 List 視圖切換）

3. **Production Ready Phase** - 預計 1 個月
   - 安全性加固
   - 負載測試
   - 文檔完善
   - 部署準備

**文檔更新建議**:

**現有文檔需更新**:
1. **MVP-IMPLEMENTATION-CHECKLIST.md**
   - 更新 Epic 1 和 Epic 3 的完成度
   - 標記本次完成的功能（登錄頁優化、視圖切換）
   - 更新整體 MVP 完成度百分比

2. **DEVELOPMENT-LOG.md**
   - 記錄本次用戶反饋修復
   - 記錄視圖切換功能實現
   - 記錄登出重定向修復

3. **PROJECT-INDEX.md**
   - 更新最後更新時間
   - 添加新增的頁面（註冊、忘記密碼）
   - 更新視圖切換功能說明

**建議新增文檔**:
1. **POST-MVP-ROADMAP.md** (新增)
   ```markdown
   # Post-MVP 開發路線圖

   ## Phase 1: MVP 完成 (2-3 週)
   - [ ] Azure AD B2C 完整整合
   - [ ] 剩餘核心功能完成
   - [ ] Bug 修復和測試

   ## Phase 2: 功能增強 (1-2 個月)
   - [ ] 用戶體驗優化
   - [ ] 性能優化
   - [ ] 便利功能添加

   ## Phase 3: Production Ready (1 個月)
   - [ ] 安全性審核
   - [ ] 部署準備
   - [ ] 文檔完善
   ```

2. **USER-FEEDBACK-LOG.md** (新增)
   - 記錄所有用戶反饋
   - 追蹤問題修復狀態
   - 分析用戶需求趨勢

3. **UI-UX-IMPROVEMENTS.md** (新增)
   - 記錄所有 UI/UX 改進
   - 視圖切換功能說明
   - 響應式設計優化記錄
   - 無障礙性增強記錄

**文檔組織結構建議**:
```
docs/
├── development/
│   ├── MVP-IMPLEMENTATION-CHECKLIST.md
│   ├── POST-MVP-ROADMAP.md (新增)
│   └── USER-FEEDBACK-LOG.md (新增)
├── technical/
│   ├── UI-UX-IMPROVEMENTS.md (新增)
│   └── ARCHITECTURE-DECISIONS.md
└── ...

claudedocs/ (Claude Code 專用)
├── DEVELOPMENT-LOG.md
├── DESIGN-SYSTEM-REFINEMENTS.md
├── USER-FEEDBACK-FIXES-2025-10-16.md (本文件)
└── ...
```

---

## 🔧 技術債務和改進建議

### 1. 登出重定向問題深入分析
**問題**: 用戶反映仍然重定向到 3001 端口
**可能原因**:
- NextAuth 緩存問題
- 瀏覽器緩存
- 環境變數未刷新

**建議進一步調試**:
```typescript
// TopBar.tsx 添加調試日誌
const handleSignOut = async () => {
  console.log('[DEBUG] Current origin:', window.location.origin);
  const loginUrl = `${window.location.origin}/login`;
  console.log('[DEBUG] Logout redirect URL:', loginUrl);

  await signOut({
    callbackUrl: loginUrl,
    redirect: true
  });
};
```

**測試步驟**:
1. 清除瀏覽器緩存和 cookies
2. 重啟開發服務器
3. 訪問 localhost:3000
4. 登入後點擊登出
5. 觀察 console 日誌和實際重定向 URL

### 2. 視圖切換功能標準化
**建議**: 創建可重用的視圖切換組件

```typescript
// components/ui/view-toggle.tsx
interface ViewToggleProps {
  viewMode: 'card' | 'list';
  onViewChange: (mode: 'card' | 'list') => void;
}

export function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex border border-input rounded-md">
      <Button
        variant={viewMode === 'card' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('card')}
        className="rounded-r-none"
        aria-label="卡片視圖"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="rounded-l-none"
        aria-label="列表視圖"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**使用範例**:
```typescript
<ViewToggle
  viewMode={viewMode}
  onViewChange={setViewMode}
/>
```

### 3. 註冊和忘記密碼功能實現

**待實現功能**:
1. **註冊頁面**:
   - 與 Azure AD B2C 註冊流程整合
   - 或實現本地註冊 API（使用 bcrypt 加密）
   - Email 驗證流程

2. **忘記密碼頁面**:
   - 密碼重設郵件發送
   - 重設連結驗證
   - 新密碼設定頁面

**建議實現順序**:
1. 先實現本地開發用的簡單版本（用於測試）
2. 再整合 Azure AD B2C（生產環境）

### 4. Button 組件大小寫不一致警告
**問題**: 同時存在 `Button.tsx` 和 `button.tsx`
**影響**: 在某些文件系統上可能導致問題

**建議修復**:
1. 統一為小寫 `button.tsx`（React 組件慣例）
2. 全局搜索替換所有 import 語句
3. 重啟開發服務器

```bash
# 查找所有 Button 組件 import
grep -r "@/components/ui/Button" apps/web/src/
```

---

## 📊 進度總結

### 完成度統計
- ✅ 已完成: 4/7 任務 (57%)
- 🔄 進行中: 1/7 任務 (14%)
- ⏳ 待處理: 2/7 任務 (29%)

### 時間估算
- **視圖切換功能** (4個頁面): 2-3 小時
- **Quotes 頁面實現**: 1-2 小時
- **文檔更新**: 1 小時
- **總計**: 4-6 小時

### 優先級排序
1. 🔴 高優先級: 完成視圖切換功能（用戶直接可見的改進）
2. 🟡 中優先級: 實現 Quotes 頁面（修復 404）
3. 🟢 低優先級: 文檔更新（可並行進行）

---

## 📝 後續行動計劃

### 立即執行 (本次會話)
1. 為預算池頁面添加視圖切換
2. 為供應商頁面添加視圖切換
3. 為採購單頁面添加視圖切換
4. 為費用記錄頁面添加視圖切換

### 短期計劃 (本週)
1. 實現或規劃 Quotes 頁面解決方案
2. 測試並確認登出重定向修復
3. 更新所有相關文檔
4. 創建 POST-MVP-ROADMAP.md

### 中期計劃 (本月)
1. 完成 MVP 剩餘 20% 功能
2. 實現註冊和密碼重設完整功能
3. Azure AD B2C 完整整合
4. 進行全面測試和 bug 修復

---

## 💡 額外建議

### 1. 用戶反饋機制
建議在應用中添加用戶反饋入口:
```typescript
// 在 TopBar 或 Sidebar 添加反饋按鈕
<Button variant="ghost" onClick={openFeedbackModal}>
  <MessageSquare className="h-4 w-4 mr-2" />
  提供反饋
</Button>
```

### 2. 功能開關 (Feature Flags)
對於新功能（如視圖切換），可以使用功能開關:
```typescript
// .env
NEXT_PUBLIC_FEATURE_VIEW_TOGGLE=true

// 使用
{process.env.NEXT_PUBLIC_FEATURE_VIEW_TOGGLE === 'true' && (
  <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
)}
```

### 3. 用戶偏好設置持久化
建議將視圖偏好保存到 localStorage 或用戶設定:
```typescript
// 讀取偏好
const savedView = localStorage.getItem('preferredView') as 'card' | 'list' || 'card';
const [viewMode, setViewMode] = useState<'card' | 'list'>(savedView);

// 保存偏好
const handleViewChange = (mode: 'card' | 'list') => {
  setViewMode(mode);
  localStorage.setItem('preferredView', mode);
};
```

---

## 🎯 結論

本次用戶反饋處理已完成大部分關鍵功能，主要成就：
1. ✅ 改善了登錄流程用戶體驗
2. ✅ 修復了登出重定向問題（待測試確認）
3. ✅ 更新了 Dashboard 使其符合 IT 專案管理情境
4. ✅ 為專案頁面添加了視圖切換功能
5. 🔄 建立了視圖切換功能的實現模式，可應用於其他頁面

**下一步**: 繼續完成剩餘頁面的視圖切換功能，並評估當前開發階段，規劃 Post-MVP 路線圖。

---

**記錄者**: Claude Code AI Assistant
**最後更新**: 2025-10-16 15:30
