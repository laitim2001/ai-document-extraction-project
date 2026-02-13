# CHANGE-013: 專案導入 Charge Out OpCos 欄位解析

> **建立日期**: 2025-12-14
> **完成日期**: 2025-12-14
> **修復日期**: 2025-12-14 (改為 company name 匹配，備用 code 匹配)
> **狀態**: ✅ 已完成
> **相關功能**: FEAT-010 (Project Data Import)
> **優先級**: High

## 1. 變更概述

### 1.1 背景
目前專案導入功能 (FEAT-010) 已支援 Charge Out OpCos 欄位的讀取，但缺乏完整的解析邏輯來處理多選 OpCo 的情況。

### 1.2 目標
- 支援逗號分隔的 OpCo 代碼解析（如 "RAP,RAPO,RHK"）
- 驗證 OpCo 代碼格式
- 正確建立 ProjectChargeOutOpCo 關聯

## 2. 需求規格

### 2.1 輸入格式
| 輸入值 | 處理方式 | 結果 |
|--------|----------|------|
| `Ricoh Asia Pacific,Ricoh Hong Kong` | 逗號分隔解析 (company name) | 建立 2 個 OpCo 關聯 |
| `Ricoh Asia Pacific` | 單一值 | 建立 1 個 OpCo 關聯 |
| `RAP,RHK` | 逗號分隔解析 (備用: company code) | 建立 2 個 OpCo 關聯 |
| `NA` | 視為空值 | 不建立關聯 |
| 空白/null | 視為空值 | 不建立關聯 |
| `RAP;RAPO` | 格式錯誤 | 標記為錯誤，不導入 |
| `INVALID_NAME` | 名稱不存在 | 標記為警告，跳過該名稱 |

> **重要**: 匹配優先順序為 company name > company code（大小寫不敏感）

### 2.2 驗證規則
1. **格式驗證**: 必須使用逗號分隔（非分號或其他符號）
2. **代碼驗證**: 每個代碼必須存在於 OperatingCompany 表中
3. **空值處理**: 空白、null、"NA"、"N/A" 視為空值

### 2.3 錯誤處理
- 格式錯誤 → 整行標記為錯誤，顯示在錯誤分頁
- 部分代碼無效 → 警告提示，但繼續導入有效的代碼

## 3. 實施結果

### 3.1 前端修改 (`apps/web/src/app/[locale]/project-data-import/page.tsx`)

**新增 `parseChargeOutOpCos` 函數**:
```typescript
interface ChargeOutOpCosParseResult {
  value: string | null;
  isValid: boolean;
  error?: string;
}

function parseChargeOutOpCos(value: unknown): ChargeOutOpCosParseResult {
  // 空值處理
  if (value === null || value === undefined || value === '') {
    return { value: null, isValid: true };
  }

  const strValue = String(value).trim();

  // NA / N/A 視為空值
  if (strValue.toUpperCase() === 'NA' || strValue.toUpperCase() === 'N/A') {
    return { value: null, isValid: true };
  }

  // 檢查是否使用了錯誤的分隔符（分號）
  if (strValue.includes(';')) {
    return {
      value: null,
      isValid: false,
      error: 'Invalid format: use comma (,) to separate OpCo codes, not semicolon (;)',
    };
  }

  // 解析逗號分隔的代碼並標準化（轉大寫、去空白）
  const codes = strValue.split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);

  if (codes.length === 0) {
    return { value: null, isValid: true };
  }

  // 返回標準化後的字串（逗號分隔）
  return { value: codes.join(','), isValid: true };
}
```

**解析邏輯更新**:
- 在解析專案資料前先調用 `parseChargeOutOpCos`
- 格式錯誤時加入錯誤列表

**ImportResult 類型更新**:
- 添加 `warnings` 欄位支援警告信息

**UI 更新**:
- 結果頁面添加警告列表顯示區塊

### 3.2 後端修改 (`packages/api/src/routers/project.ts`)

**新增 warnings 數組**:
```typescript
const warnings: Array<{
  row: number;
  projectCode: string;
  message: string;
}> = [];
```

**增強 OpCo 解析邏輯**:
- 記錄無效的 OpCo 代碼
- 將無效代碼加入 warnings 數組

**返回結構更新**:
```typescript
return {
  success: errors.length === 0,
  totalProcessed: input.projects.length,
  created,
  updated,
  skipped,
  errors,
  warnings, // 新增
};
```

### 3.3 i18n 翻譯更新

**en.json**:
```json
"errors": {
  "invalidOpCoFormat": "Invalid OpCo format: use comma (,) to separate codes, not semicolon (;)"
},
"result": {
  "warningDetails": "Warnings"
}
```

**zh-TW.json**:
```json
"errors": {
  "invalidOpCoFormat": "OpCo 格式無效：請使用逗號 (,) 分隔代碼，而非分號 (;)"
},
"result": {
  "warningDetails": "警告"
}
```

## 4. 影響範圍

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/app/[locale]/project-data-import/page.tsx` | 修改 | 添加 parseChargeOutOpCos 函數、格式驗證、警告顯示 |
| `packages/api/src/routers/project.ts` | 修改 | 增強 OpCo 驗證邏輯、添加 warnings 返回 |
| `apps/web/src/messages/en.json` | 修改 | 添加錯誤訊息翻譯 |
| `apps/web/src/messages/zh-TW.json` | 修改 | 添加錯誤訊息翻譯 |

## 5. 驗收標準

- [x] 逗號分隔的 OpCo 代碼可正確解析
- [x] 空值和 NA 正確處理為空
- [x] 使用分號分隔時顯示格式錯誤
- [x] 無效的 OpCo 代碼有警告提示
- [x] 導入結果正確建立 ProjectChargeOutOpCo 關聯

## 6. 測試驗證

| 測試案例 | 輸入 | 預期結果 | 狀態 |
|----------|------|----------|------|
| 正確格式 | `RAP,RAPO,RHK` | 建立 3 個關聯 | ✅ |
| 單一值 | `RAP` | 建立 1 個關聯 | ✅ |
| 空值 | 空白 | 無關聯 | ✅ |
| NA 處理 | `NA` | 無關聯 | ✅ |
| 格式錯誤 | `RAP;RAPO` | 顯示錯誤 | ✅ |
| 無效代碼 | `INVALID` | 顯示警告 | ✅ |

---

**維護者**: AI 助手
**最後更新**: 2025-12-14
