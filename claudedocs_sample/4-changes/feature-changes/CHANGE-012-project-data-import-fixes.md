# CHANGE-012: Project Data Import Bug Fixes

> **建立日期**: 2025-12-13
> **完成日期**: 2025-12-13
> **狀態**: ✅ 完成
> **相關功能**: FEAT-010 (Project Data Import)

## 概述

修復 FEAT-010 專案數據導入功能的多個問題，包括欄位解析錯誤和編輯頁面欄位未顯示問題。

## 問題清單

### 問題 1: Probability/Priority 欄位無法正確導入

**症狀**: 導入後 Probability 和 Priority 欄位顯示預設值而非 Excel 中的值

**原因**:
- Excel 中 probability 是字串格式 ("high", "medium", "low")
- 代碼期望的是數字格式 (80, 50, 30)

**解決方案**:
在 `page.tsx` 中添加 `parseProbability()` 和 `parsePriority()` 函數，支援：
- 字串格式: "high", "h", "medium", "med", "m", "low", "l"
- 數字格式: >=80 為 High, <=30 為 Low, 其他為 Medium

### 問題 2: chargeOutMethod 欄位映射錯誤

**症狀**: chargeOutMethod 欄位無法從 Excel 正確讀取

**原因**: EXCEL_COLUMN_MAP 中的映射名稱錯誤
- 錯誤: `'Charge out description'`
- 正確: `'Charge out Method'`

**解決方案**: 修正 EXCEL_COLUMN_MAP 中的映射

### 問題 3: 編輯頁面欄位未顯示

**症狀**: 以下欄位在專案編輯頁面不顯示數據，即使資料庫已有數據
- CDO Review Required
- Manager Confirmed
- Pay For What
- Pay To Whom

**原因**:
`projects/[id]/edit/page.tsx` 的 initialData 物件未包含這些欄位，
導致 ProjectForm 組件無法接收到這些值。

**解決方案**:
在編輯頁面的 initialData 中添加缺失的欄位：
```typescript
initialData={{
  // ... 現有欄位
  // FEAT-010: 專案導入欄位
  isCdoReviewRequired: project.isCdoReviewRequired,
  isManagerConfirmed: project.isManagerConfirmed,
  payForWhat: project.payForWhat,
  payToWhom: project.payToWhom,
  fiscalYear: project.fiscalYear,
}}
```

## 修改檔案

### 前端
| 檔案 | 變更內容 |
|------|----------|
| `apps/web/src/app/[locale]/project-data-import/page.tsx` | 添加 parseProbability/parsePriority 函數，修正 chargeOutMethod 映射 |
| `apps/web/src/app/[locale]/projects/[id]/edit/page.tsx` | 添加 5 個缺失欄位到 initialData |

### 後端
| 檔案 | 變更內容 |
|------|----------|
| `packages/api/src/routers/project.ts` | 更新 probability/priority 的 schema 和解析邏輯 |

## 調試過程

1. 添加 debug 日誌追蹤數據流程
2. 確認瀏覽器 console 輸出正確的解析結果
3. 確認 server console 輸出正確的 API 接收數據
4. 確認 Prisma update/create 操作返回正確數據
5. 發現問題出在編輯頁面未傳遞欄位給表單組件

## 測試結果

- ✅ Probability 欄位正確導入 (字串格式支援)
- ✅ Priority 欄位正確導入 (字串格式支援)
- ✅ chargeOutMethod 欄位正確導入
- ✅ 編輯頁面正確顯示 CDO Review Required
- ✅ 編輯頁面正確顯示 Manager Confirmed
- ✅ 編輯頁面正確顯示 Pay For What
- ✅ 編輯頁面正確顯示 Pay To Whom

## 待清理

- [ ] 移除 `project-data-import/page.tsx` 中的 debug console.log
- [ ] 移除 `project.ts` 中的 debug console.log

---

**維護者**: AI 助手
**最後更新**: 2025-12-13
