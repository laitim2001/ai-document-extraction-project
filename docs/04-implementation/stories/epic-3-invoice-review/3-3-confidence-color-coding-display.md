# Story 3.3: 信心度顏色編碼顯示

**Status:** done

---

## Story

**As a** 數據處理員,
**I want** 通過顏色快速識別需要關注的欄位,
**So that** 我可以優先檢查低信心度的項目。

---

## Acceptance Criteria

### AC1: 顏色編碼

**Given** 審核界面的提取結果
**When** 顯示各欄位
**Then** 欄位背景顏色依信心度顯示：
- 綠色：>= 90%（高信心）
- 黃色：70-89%（中信心）
- 紅色：< 70%（低信心）

### AC2: 信心度詳情提示

**Given** 欄位顯示
**When** 滑鼠懸停在信心度指示器上
**Then** 顯示具體的信心度百分比和計算因素

### AC3: 篩選低信心度

**Given** 審核界面
**When** 點擊「僅顯示低信心度欄位」
**Then** 隱藏高信心度欄位，僅顯示需要關注的項目

---

## Tasks / Subtasks

- [x] **Task 1: 欄位顏色編碼** (AC: #1)
  - [x] 1.1 更新 `FieldRow.tsx` 組件（左側邊框顏色 + 背景色）
  - [x] 1.2 根據信心度設置背景色（CSS 變數）
  - [x] 1.3 整合 CONFIDENCE_THRESHOLDS（使用 getConfidenceLevel）

- [x] **Task 2: 信心度詳情 Tooltip** (AC: #2)
  - [x] 2.1 創建 `ConfidenceTooltip.tsx`
  - [x] 2.2 顯示百分比數值
  - [x] 2.3 顯示計算因素分解（Progress bar 視覺化）

- [x] **Task 3: 篩選控制** (AC: #3)
  - [x] 3.1 創建 `LowConfidenceFilter.tsx` 篩選切換按鈕
  - [x] 3.2 實現欄位過濾邏輯（ReviewPanel 整合）
  - [x] 3.3 篩選狀態管理（useState）

- [x] **Task 4: 視覺設計優化** (AC: #1)
  - [x] 4.1 CSS HSL 變數系統（支援深色模式）
  - [x] 4.2 確保無障礙對比度（WCAG 2.1 AA）
  - [x] 4.3 加入圖標輔助（ConfidenceIndicator 形狀指示器）

- [x] **Task 5: 驗證與測試** (AC: #1-3)
  - [x] 5.1 TypeScript 類型檢查通過
  - [x] 5.2 ESLint 檢查通過
  - [x] 5.3 組件導出更新

---

## Dev Notes

### 依賴項

- **Story 3.2**: 審核界面
- **Story 2.5**: 信心度計算

### Architecture Compliance

```typescript
// src/components/features/review/FieldRow.tsx
import { CONFIDENCE_THRESHOLDS } from '@/lib/confidence/thresholds'

interface FieldRowProps {
  fieldName: string
  value: string | null
  confidence: number
  factors?: ConfidenceFactors
  onSelect?: () => void
}

export function FieldRow({ fieldName, value, confidence, factors, onSelect }: FieldRowProps) {
  const level = confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low'
  const config = CONFIDENCE_THRESHOLDS[level]

  return (
    <div
      className={`field-row p-2 rounded cursor-pointer`}
      style={{ backgroundColor: `${config.color}20` }} // 20% opacity
      onClick={onSelect}
    >
      <div className="flex justify-between">
        <span className="font-medium">{fieldName}</span>
        <Tooltip content={<ConfidenceDetail confidence={confidence} factors={factors} />}>
          <ConfidenceBadge score={confidence} />
        </Tooltip>
      </div>
      <div className="text-sm">{value || '—'}</div>
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-33]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR16]
- [Source: docs/04-ux-design/sections/ux-04-color-coding.md]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.3 |
| Story Key | 3-3-confidence-color-coding-display |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR16, UX-04 |
| Dependencies | Story 3.2, Story 2.5 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-18*
