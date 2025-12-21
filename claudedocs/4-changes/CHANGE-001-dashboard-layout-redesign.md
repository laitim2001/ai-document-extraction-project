# CHANGE-001: Dashboard Layout Redesign

## 變更資訊

| 項目 | 內容 |
|------|------|
| 變更編號 | CHANGE-001 |
| 變更類型 | 功能增強 (SITUATION-3) |
| 優先級 | 高 |
| 開始日期 | 2025-12-21 |
| 狀態 | ✅ 已完成 |
| 回滾點 | commit `de32eb5` |

## 變更目標

將現有的簡單頂部導航佈局，升級為帶有側邊欄的現代化 Dashboard 佈局。

### 當前狀態
- 僅有頂部導航列
- 無側邊欄導航
- 內容區域使用 `max-w-7xl` 限制寬度

### 目標狀態
- 固定側邊欄 (w-72 = 288px)
- 頂部工具列（搜尋、主題切換、通知、用戶選單）
- 響應式設計（移動端側邊欄 overlay）
- 專業的 Dashboard 視覺風格

## 參考來源

- **參考項目**: ai-it-project-process-management-webapp
- **本地路徑**: `C:/Users/rci.ChrisLai/Documents/GitHub/reference-ui-project`
- **關鍵檔案**:
  - `apps/web/src/components/layout/dashboard-layout.tsx` (130 行)
  - `apps/web/src/components/layout/Sidebar.tsx` (462 行)
  - `apps/web/src/components/layout/TopBar.tsx` (287 行)

## 影響範圍分析

### 需要調整的頁面

| 頁面 | 當前樣式 | 需要調整 | 風險 |
|------|----------|----------|------|
| `/review/[id]` | `h-[calc(100vh-160px)]` | 高度計算需調整 | 中 |
| `/invoices/upload` | `max-w-3xl` | 無需調整 | 低 |
| 其他 Dashboard 頁面 | 標準佈局 | 自動適應 | 低 |

### 不受影響的功能
- ✅ API 路由邏輯
- ✅ 數據處理服務
- ✅ 認證授權機制
- ✅ 業務邏輯層

## 實施計劃

### Phase 1: 基礎組件創建
1. 建立 `src/components/layouts/Sidebar.tsx`
2. 建立 `src/components/layouts/TopBar.tsx`
3. 建立 `src/components/layouts/DashboardLayout.tsx`

### Phase 2: 佈局整合
4. 更新 `src/app/(dashboard)/layout.tsx` 使用新組件
5. 調整 review 頁面高度計算

### Phase 3: 驗證與優化
6. 測試響應式行為
7. 驗證現有功能正常運作

## 導航結構設計

```typescript
const navigation = [
  {
    title: '概覽',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: '全局視圖', href: '/global', icon: Globe },
    ]
  },
  {
    title: '文件處理',
    items: [
      { name: '發票列表', href: '/invoices', icon: FileText },
      { name: '上傳發票', href: '/invoices/upload', icon: Upload },
      { name: '待審核', href: '/review', icon: ClipboardCheck },
      { name: '升級案例', href: '/escalations', icon: AlertTriangle },
    ]
  },
  {
    title: '規則管理',
    items: [
      { name: '映射規則', href: '/mappings', icon: GitBranch },
      { name: 'Forwarder 管理', href: '/forwarders', icon: Building2 },
    ]
  },
  {
    title: '報表',
    items: [
      { name: '分析報表', href: '/reports', icon: BarChart3 },
      { name: '審計日誌', href: '/audit', icon: History },
    ]
  },
  {
    title: '系統管理',
    items: [
      { name: '系統設定', href: '/settings', icon: Settings },
      { name: '用戶管理', href: '/users', icon: Users },
    ]
  },
]
```

## i18n 備註

- 暫時保留語言切換圖標
- 實際多語言功能延後開發
- 相關組件使用靜態中文文字

## 技術債務

| 項目 | 說明 | 預計修復 |
|------|------|----------|
| i18n 整合 | 語言切換功能待實現 | 後續 Sprint |
| 通知功能 | 通知鈴鐺為靜態展示 | Epic 12 |
| 權限導航過濾 | 基於角色顯示/隱藏選單項 | Epic 1 擴展 |

## 驗收標準

- [x] 側邊欄正常顯示並可收合
- [x] 移動端 overlay 側邊欄正常運作
- [x] 頂部工具列所有按鈕可點擊
- [x] 現有頁面內容正常顯示
- [x] Review 頁面並排佈局正常
- [x] 主題切換功能正常
- [x] 響應式斷點行為正確
- [x] TypeScript 類型檢查通過
- [x] Build 成功

---

*建立日期: 2025-12-21*
*最後更新: 2025-12-21*
