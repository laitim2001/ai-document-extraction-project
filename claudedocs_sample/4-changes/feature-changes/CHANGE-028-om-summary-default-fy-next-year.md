# CHANGE-028: OM Summary 預設 Fiscal Year 改為下一年度

> **建立日期**: 2025-12-16
> **狀態**: 📋 待確認
> **優先級**: Low
> **複雜度**: 低
> **預估工時**: 0.5 小時

---

## 1. 變更概述

### 1.1 當前行為
- OM Summary 頁面的 Fiscal Year 下拉選單預設選取**當前年度** (如 2025 年選取 FY2025)

### 1.2 期望行為
- OM Summary 頁面的 Fiscal Year 下拉選單預設選取**下一年度** (如 2025 年預設選取 FY2026)

### 1.3 變更原因
- 符合業務需求：通常在當年度規劃下一年度的 OM 預算
- 提升用戶體驗：減少手動選擇步驟

---

## 2. 技術設計

### 2.1 影響範圍

| 類型 | 檔案路徑 | 變更說明 |
|------|----------|----------|
| 頁面 | `apps/web/src/app/[locale]/om-summary/page.tsx` | 修改預設 FY 初始化邏輯 |

### 2.2 實現方案

**當前代碼** (預估):
```typescript
const [financialYear, setFinancialYear] = useState(new Date().getFullYear());
```

**修改後**:
```typescript
// CHANGE-028: 預設選取下一年度
const [financialYear, setFinancialYear] = useState(new Date().getFullYear() + 1);
```

---

## 3. 測試計畫

### 3.1 測試項目
- [ ] 2025 年開啟頁面，預設顯示 FY2026
- [ ] 下拉選單仍可選擇其他年度
- [ ] 切換年度後資料正確載入

### 3.2 邊界情況
- [ ] 確認年度選項列表包含下一年度

---

## 4. 確認事項

**請確認以下事項：**

1. ✅ 預設選取下一年度的邏輯是否正確？
2. ❓ 是否需要在 O&M Summary 和 Project Summary 兩個 Tab 都套用此邏輯？
3. ❓ 年度選項範圍是否需要調整？(目前可能只到當年)

---

## 5. 相關文件
- `apps/web/src/app/[locale]/om-summary/page.tsx` - OM Summary 主頁面
- `CHANGE-004-om-summary-header-detail-display.md` - OM Summary 相關變更記錄
