# Tech Spec: Story 3-3 信心度顏色編碼顯示

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 3.3
- **Title**: 信心度顏色編碼顯示
- **Epic**: Epic 3 - 發票審核與修正工作流

### 1.2 Story Description
作為數據處理員，我希望通過顏色快速識別需要關注的欄位，以便優先檢查低信心度的項目。

### 1.3 Dependencies
- **Story 3-2**: 並排 PDF 對照審核界面（提供審核界面基礎）
- **Story 2-5**: 信心度計算（提供信心度數據）

---

## 2. Acceptance Criteria Mapping

| AC ID | Description | Implementation Approach |
|-------|-------------|------------------------|
| AC1 | 顏色編碼 | CSS 變數 + ConfidenceBadge 組件 + 背景色 |
| AC2 | 信心度詳情提示 | Tooltip + ConfidenceTooltip 組件 |
| AC3 | 篩選低信心度 | 本地狀態過濾 + showLowConfidenceOnly toggle |

---

## 3. Architecture Overview

### 3.1 Design System Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    信心度視覺系統                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  三重編碼系統 (WCAG 2.1 AA 合規)                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  HIGH (≥90%)     │  顏色: 綠色  │  形狀: ✓ 勾號  │  數字: 90-100 │
│  ─────────────────────────────────────────────────────────────  │
│  MEDIUM (70-89%) │  顏色: 黃色  │  形狀: ○ 圓圈  │  數字: 70-89  │
│  ─────────────────────────────────────────────────────────────  │
│  LOW (<70%)      │  顏色: 紅色  │  形狀: △ 三角  │  數字: 0-69   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── lib/
│   └── confidence/
│       ├── thresholds.ts              # 閾值配置
│       └── utils.ts                   # 工具函數
├── components/features/review/
│   ├── ConfidenceBadge.tsx            # 信心度徽章 (已存在，擴展)
│   ├── ConfidenceTooltip.tsx          # 信心度詳情 Tooltip
│   ├── ConfidenceIndicator.tsx        # 信心度指示器 (形狀)
│   ├── FieldRow.tsx                   # 欄位列 (擴展顏色)
│   └── LowConfidenceFilter.tsx        # 低信心度篩選切換
└── styles/
    └── confidence.css                 # 信心度相關樣式
```

---

## 4. Implementation Guide

### Phase 1: Configuration Layer (AC1)

#### 4.1.1 信心度閾值配置

**File**: `src/lib/confidence/thresholds.ts`

```typescript
// 信心度等級
export type ConfidenceLevel = 'high' | 'medium' | 'low'

// 閾值配置（從環境變數或配置讀取）
export const CONFIDENCE_THRESHOLDS = {
  high: {
    min: 90,
    max: 100,
    level: 'high' as ConfidenceLevel,
    label: '高信心度',
    icon: '✓',
    shape: 'check',
    // HSL 格式，方便調整
    color: {
      hsl: '142 76% 36%',     // 綠色
      bg: 'hsl(142, 76%, 95%)',
      border: 'hsl(142, 76%, 36%)',
      text: 'hsl(142, 76%, 25%)'
    }
  },
  medium: {
    min: 70,
    max: 89,
    level: 'medium' as ConfidenceLevel,
    label: '中信心度',
    icon: '○',
    shape: 'circle',
    color: {
      hsl: '45 93% 47%',      // 黃色
      bg: 'hsl(45, 93%, 95%)',
      border: 'hsl(45, 93%, 47%)',
      text: 'hsl(45, 93%, 30%)'
    }
  },
  low: {
    min: 0,
    max: 69,
    level: 'low' as ConfidenceLevel,
    label: '低信心度',
    icon: '△',
    shape: 'triangle',
    color: {
      hsl: '0 84% 60%',       // 紅色
      bg: 'hsl(0, 84%, 95%)',
      border: 'hsl(0, 84%, 60%)',
      text: 'hsl(0, 84%, 35%)'
    }
  }
} as const

// 獲取信心度等級
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high.min) return 'high'
  if (score >= CONFIDENCE_THRESHOLDS.medium.min) return 'medium'
  return 'low'
}

// 獲取信心度配置
export function getConfidenceConfig(score: number) {
  const level = getConfidenceLevel(score)
  return CONFIDENCE_THRESHOLDS[level]
}
```

#### 4.1.2 信心度工具函數

**File**: `src/lib/confidence/utils.ts`

```typescript
import { ConfidenceLevel, getConfidenceConfig } from './thresholds'

// 信心度因素分解
export interface ConfidenceFactors {
  ocrConfidence: number        // OCR 信心度 (30%)
  ruleMatchScore: number       // 規則匹配分數 (30%)
  formatValidationScore: number // 格式驗證分數 (25%)
  historicalAccuracy: number   // 歷史準確率 (15%)
}

// 信心度權重
const CONFIDENCE_WEIGHTS = {
  ocrConfidence: 0.30,
  ruleMatchScore: 0.30,
  formatValidationScore: 0.25,
  historicalAccuracy: 0.15
}

// 計算加權信心度
export function calculateOverallConfidence(factors: ConfidenceFactors): number {
  const weighted =
    factors.ocrConfidence * CONFIDENCE_WEIGHTS.ocrConfidence +
    factors.ruleMatchScore * CONFIDENCE_WEIGHTS.ruleMatchScore +
    factors.formatValidationScore * CONFIDENCE_WEIGHTS.formatValidationScore +
    factors.historicalAccuracy * CONFIDENCE_WEIGHTS.historicalAccuracy

  return Math.round(weighted)
}

// 格式化信心度因素為顯示文本
export function formatConfidenceFactors(factors: ConfidenceFactors): {
  label: string
  value: number
  weight: string
}[] {
  return [
    {
      label: 'OCR 識別',
      value: Math.round(factors.ocrConfidence),
      weight: '30%'
    },
    {
      label: '規則匹配',
      value: Math.round(factors.ruleMatchScore),
      weight: '30%'
    },
    {
      label: '格式驗證',
      value: Math.round(factors.formatValidationScore),
      weight: '25%'
    },
    {
      label: '歷史準確',
      value: Math.round(factors.historicalAccuracy),
      weight: '15%'
    }
  ]
}

// 獲取信心度描述
export function getConfidenceDescription(level: ConfidenceLevel): string {
  const descriptions = {
    high: '提取結果可信度高，通常無需修改',
    medium: '建議快速檢查確認',
    low: '需要仔細檢查和可能的修正'
  }
  return descriptions[level]
}
```

---

### Phase 2: CSS Variables (AC1)

**File**: `src/app/globals.css` (添加)

```css
@layer base {
  :root {
    /* 信心度顏色系統 */
    --confidence-high: 142 76% 36%;
    --confidence-high-bg: 142 76% 95%;
    --confidence-high-text: 142 76% 25%;

    --confidence-medium: 45 93% 47%;
    --confidence-medium-bg: 45 93% 95%;
    --confidence-medium-text: 45 93% 30%;

    --confidence-low: 0 84% 60%;
    --confidence-low-bg: 0 84% 95%;
    --confidence-low-text: 0 84% 35%;
  }

  .dark {
    /* 深色模式調整 */
    --confidence-high-bg: 142 76% 15%;
    --confidence-high-text: 142 76% 75%;

    --confidence-medium-bg: 45 93% 15%;
    --confidence-medium-text: 45 93% 75%;

    --confidence-low-bg: 0 84% 15%;
    --confidence-low-text: 0 84% 75%;
  }
}

/* 信心度動畫 */
@keyframes confidence-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.confidence-low-attention {
  animation: confidence-pulse 2s ease-in-out infinite;
}
```

---

### Phase 3: UI Components (AC1, AC2, AC3)

#### 4.3.1 增強版信心度徽章

**File**: `src/components/features/review/ConfidenceBadge.tsx` (擴展)

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { getConfidenceConfig, ConfidenceLevel } from '@/lib/confidence/thresholds'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  score: number  // 0-100
  showIcon?: boolean
  showLabel?: boolean
  size?: 'sm' | 'default' | 'lg'
  variant?: 'badge' | 'inline' | 'pill'
  className?: string
}

export function ConfidenceBadge({
  score,
  showIcon = true,
  showLabel = false,
  size = 'default',
  variant = 'badge',
  className
}: ConfidenceBadgeProps) {
  const config = getConfidenceConfig(score)

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0 h-5',
    default: 'text-sm px-2 py-0.5 h-6',
    lg: 'text-base px-3 py-1 h-8'
  }

  const colorClasses = {
    high: 'bg-[hsl(var(--confidence-high-bg))] text-[hsl(var(--confidence-high-text))] border-[hsl(var(--confidence-high))]',
    medium: 'bg-[hsl(var(--confidence-medium-bg))] text-[hsl(var(--confidence-medium-text))] border-[hsl(var(--confidence-medium))]',
    low: 'bg-[hsl(var(--confidence-low-bg))] text-[hsl(var(--confidence-low-text))] border-[hsl(var(--confidence-low))]'
  }[config.level]

  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        {showIcon && <ConfidenceIndicator level={config.level} size={size} />}
        <span className={cn('font-medium', colorClasses.split(' ')[1])}>
          {score}%
        </span>
      </span>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        colorClasses,
        'font-medium',
        config.level === 'low' && 'confidence-low-attention',
        className
      )}
    >
      {showIcon && (
        <ConfidenceIndicator
          level={config.level}
          size={size}
          className="mr-1"
        />
      )}
      {showLabel ? config.label : `${score}%`}
    </Badge>
  )
}
```

#### 4.3.2 信心度形狀指示器

**File**: `src/components/features/review/ConfidenceIndicator.tsx`

```typescript
import { ConfidenceLevel } from '@/lib/confidence/thresholds'
import { Check, Circle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function ConfidenceIndicator({
  level,
  size = 'default',
  className
}: ConfidenceIndicatorProps) {
  const sizeMap = {
    sm: 'h-3 w-3',
    default: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const iconClass = cn(sizeMap[size], className)

  switch (level) {
    case 'high':
      return <Check className={cn(iconClass, 'text-[hsl(var(--confidence-high))]')} />
    case 'medium':
      return <Circle className={cn(iconClass, 'text-[hsl(var(--confidence-medium))]')} />
    case 'low':
      return <AlertTriangle className={cn(iconClass, 'text-[hsl(var(--confidence-low))]')} />
  }
}
```

#### 4.3.3 信心度詳情 Tooltip

**File**: `src/components/features/review/ConfidenceTooltip.tsx`

```typescript
'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfidenceFactors } from '@/lib/confidence/utils'
import { getConfidenceConfig, getConfidenceDescription } from '@/lib/confidence/thresholds'
import { formatConfidenceFactors } from '@/lib/confidence/utils'
import { Progress } from '@/components/ui/progress'
import { ConfidenceIndicator } from './ConfidenceIndicator'

interface ConfidenceTooltipProps {
  score: number
  factors?: ConfidenceFactors
  children: React.ReactNode
}

export function ConfidenceTooltip({
  score,
  factors,
  children
}: ConfidenceTooltipProps) {
  const config = getConfidenceConfig(score)
  const description = getConfidenceDescription(config.level)

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="w-[280px] p-4"
        >
          {/* 頭部 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ConfidenceIndicator level={config.level} size="lg" />
              <span className="font-semibold">{config.label}</span>
            </div>
            <span className="text-2xl font-bold">{score}%</span>
          </div>

          {/* 描述 */}
          <p className="text-sm text-muted-foreground mb-3">
            {description}
          </p>

          {/* 因素分解 */}
          {factors && (
            <div className="space-y-2 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground">
                信心度計算因素
              </p>
              {formatConfidenceFactors(factors).map((factor) => (
                <div key={factor.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{factor.label}</span>
                    <span className="text-muted-foreground">
                      {factor.value}% ({factor.weight})
                    </span>
                  </div>
                  <Progress
                    value={factor.value}
                    className="h-1"
                  />
                </div>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

#### 4.3.4 增強版欄位列組件

**File**: `src/components/features/review/ReviewPanel/FieldRow.tsx` (更新)

```typescript
'use client'

import { ExtractedField, ConfidenceFactors } from '@/types/review'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { ConfidenceTooltip } from '../ConfidenceTooltip'
import { getConfidenceConfig } from '@/lib/confidence/thresholds'
import { cn } from '@/lib/utils'
import { MapPin, Edit3 } from 'lucide-react'

interface FieldRowProps {
  field: ExtractedField
  isSelected: boolean
  onSelect: () => void
  onEdit?: () => void
  confidenceFactors?: ConfidenceFactors
}

// 欄位名稱中英對照
const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: '發票號碼',
  invoiceDate: '發票日期',
  dueDate: '到期日',
  currency: '幣別',
  totalAmount: '總金額',
  shipperName: '發貨人名稱',
  consigneeName: '收貨人名稱',
  vesselName: '船名',
  voyageNumber: '航次',
  containerNumber: '貨櫃號',
  blNumber: '提單號',
  // ... 更多欄位對照
}

export function FieldRow({
  field,
  isSelected,
  onSelect,
  onEdit,
  confidenceFactors
}: FieldRowProps) {
  const config = getConfidenceConfig(field.confidence)

  // 背景色樣式
  const bgStyles = {
    high: 'hover:bg-[hsl(var(--confidence-high-bg))]',
    medium: 'hover:bg-[hsl(var(--confidence-medium-bg))]',
    low: 'bg-[hsl(var(--confidence-low-bg))] hover:bg-[hsl(var(--confidence-low-bg)/80%)]'
  }[config.level]

  // 左邊框指示器
  const borderStyles = {
    high: 'border-l-[hsl(var(--confidence-high))]',
    medium: 'border-l-[hsl(var(--confidence-medium))]',
    low: 'border-l-[hsl(var(--confidence-low))]'
  }[config.level]

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 cursor-pointer transition-all',
        'border-l-4',
        bgStyles,
        borderStyles,
        isSelected && 'ring-2 ring-inset ring-primary',
        config.level === 'low' && 'confidence-low-attention'
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {FIELD_LABELS[field.fieldName] || field.fieldName}
          </span>

          {/* 來源位置指示器 */}
          {field.sourcePosition && (
            <MapPin className="h-3 w-3 text-muted-foreground" />
          )}
        </div>

        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {field.value || '—'}
        </p>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* 信心度徽章帶 Tooltip */}
        <ConfidenceTooltip
          score={field.confidence}
          factors={confidenceFactors}
        >
          <div>
            <ConfidenceBadge score={field.confidence} size="sm" />
          </div>
        </ConfidenceTooltip>

        {/* 編輯按鈕 (低信心度顯示) */}
        {config.level === 'low' && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1 rounded hover:bg-accent"
          >
            <Edit3 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
```

#### 4.3.5 低信心度篩選組件

**File**: `src/components/features/review/LowConfidenceFilter.tsx`

```typescript
'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LowConfidenceFilterProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  lowConfidenceCount: number
  totalCount: number
  className?: string
}

export function LowConfidenceFilter({
  enabled,
  onToggle,
  lowConfidenceCount,
  totalCount,
  className
}: LowConfidenceFilterProps) {
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg',
      'bg-muted/50 border',
      enabled && 'border-[hsl(var(--confidence-low))] bg-[hsl(var(--confidence-low-bg))]',
      className
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn(
          'h-4 w-4',
          enabled ? 'text-[hsl(var(--confidence-low))]' : 'text-muted-foreground'
        )} />
        <Label
          htmlFor="low-confidence-filter"
          className="text-sm cursor-pointer"
        >
          僅顯示低信心度欄位
        </Label>
        <span className="text-xs text-muted-foreground">
          ({lowConfidenceCount}/{totalCount})
        </span>
      </div>

      <Switch
        id="low-confidence-filter"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </div>
  )
}
```

---

### Phase 4: Panel Integration (AC3)

#### 4.4.1 更新審核面板

**File**: `src/components/features/review/ReviewPanel/ReviewPanel.tsx` (更新)

```typescript
'use client'

import { useMemo, useState } from 'react'
import { ExtractedField, FieldGroupData, ReviewDetailData } from '@/types/review'
import { useReviewStore } from '@/stores/reviewStore'
import { FieldGroup } from './FieldGroup'
import { ReviewActions } from './ReviewActions'
import { LowConfidenceFilter } from '../LowConfidenceFilter'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { ProcessingPathBadge } from '../ProcessingPathBadge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getConfidenceLevel } from '@/lib/confidence/thresholds'

// 欄位分組配置
const FIELD_GROUPS: { key: string; displayName: string }[] = [
  { key: 'header', displayName: '發票基本資訊' },
  { key: 'shipper', displayName: '發貨人資訊' },
  { key: 'consignee', displayName: '收貨人資訊' },
  { key: 'shipment', displayName: '運輸資訊' },
  { key: 'charges', displayName: '費用明細' },
  { key: 'totals', displayName: '金額合計' },
  { key: 'other', displayName: '其他資訊' }
]

interface ReviewPanelProps {
  data: ReviewDetailData
  onApprove: () => void
  onSaveCorrections: () => void
  onEscalate: () => void
  isSubmitting?: boolean
}

export function ReviewPanel({
  data,
  onApprove,
  onSaveCorrections,
  onEscalate,
  isSubmitting
}: ReviewPanelProps) {
  const { selectedFieldId, setSelectedField, hasPendingChanges } = useReviewStore()

  // 低信心度篩選狀態
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false)

  // 計算低信心度欄位數量
  const lowConfidenceCount = useMemo(() =>
    data.extraction.fields.filter(f => getConfidenceLevel(f.confidence) === 'low').length,
    [data.extraction.fields]
  )

  // 篩選後的欄位
  const filteredFields = useMemo(() => {
    if (!showLowConfidenceOnly) return data.extraction.fields

    return data.extraction.fields.filter(f =>
      getConfidenceLevel(f.confidence) === 'low'
    )
  }, [data.extraction.fields, showLowConfidenceOnly])

  // 將欄位按組分類
  const groupedFields = useMemo(() => {
    const groups: FieldGroupData[] = []
    const fieldsByGroup = new Map<string, ExtractedField[]>()

    filteredFields.forEach(field => {
      const group = field.fieldGroup || 'other'
      if (!fieldsByGroup.has(group)) {
        fieldsByGroup.set(group, [])
      }
      fieldsByGroup.get(group)!.push(field)
    })

    FIELD_GROUPS.forEach(({ key, displayName }) => {
      const fields = fieldsByGroup.get(key)
      if (fields && fields.length > 0) {
        groups.push({
          groupName: key,
          displayName,
          fields,
          isExpanded: true
        })
      }
    })

    return groups
  }, [filteredFields])

  const handleFieldSelect = (field: ExtractedField) => {
    setSelectedField(
      field.id === selectedFieldId ? null : field.id,
      field.sourcePosition
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 頭部信息 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold truncate" title={data.document.fileName}>
            {data.document.fileName}
          </h2>
          {data.processingQueue && (
            <ProcessingPathBadge path={data.processingQueue.processingPath} />
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Forwarder: {data.forwarder?.name || '未識別'}</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span>整體信心度:</span>
            <ConfidenceBadge score={data.extraction.overallConfidence} />
          </div>
        </div>

        {/* 低信心度篩選 (AC3) */}
        {lowConfidenceCount > 0 && (
          <LowConfidenceFilter
            enabled={showLowConfidenceOnly}
            onToggle={setShowLowConfidenceOnly}
            lowConfidenceCount={lowConfidenceCount}
            totalCount={data.extraction.fields.length}
          />
        )}
      </div>

      {/* 欄位列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {groupedFields.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {showLowConfidenceOnly
                ? '沒有低信心度欄位'
                : '沒有提取欄位'}
            </p>
          ) : (
            groupedFields.map((group) => (
              <FieldGroup
                key={group.groupName}
                group={group}
                selectedFieldId={selectedFieldId}
                onFieldSelect={handleFieldSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* 操作按鈕 */}
      <ReviewActions
        onApprove={onApprove}
        onSaveCorrections={onSaveCorrections}
        onEscalate={onEscalate}
        hasPendingChanges={hasPendingChanges()}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
```

---

## 5. Testing Guide

### 5.1 Unit Tests

**File**: `tests/unit/lib/confidence/thresholds.test.ts`

```typescript
import {
  getConfidenceLevel,
  getConfidenceConfig,
  CONFIDENCE_THRESHOLDS
} from '@/lib/confidence/thresholds'

describe('Confidence Thresholds', () => {
  describe('getConfidenceLevel', () => {
    it('should return high for scores >= 90', () => {
      expect(getConfidenceLevel(90)).toBe('high')
      expect(getConfidenceLevel(95)).toBe('high')
      expect(getConfidenceLevel(100)).toBe('high')
    })

    it('should return medium for scores 70-89', () => {
      expect(getConfidenceLevel(70)).toBe('medium')
      expect(getConfidenceLevel(80)).toBe('medium')
      expect(getConfidenceLevel(89)).toBe('medium')
    })

    it('should return low for scores < 70', () => {
      expect(getConfidenceLevel(0)).toBe('low')
      expect(getConfidenceLevel(50)).toBe('low')
      expect(getConfidenceLevel(69)).toBe('low')
    })
  })

  describe('getConfidenceConfig', () => {
    it('should return correct config for each level', () => {
      const highConfig = getConfidenceConfig(95)
      expect(highConfig.level).toBe('high')
      expect(highConfig.icon).toBe('✓')

      const mediumConfig = getConfidenceConfig(75)
      expect(mediumConfig.level).toBe('medium')
      expect(mediumConfig.icon).toBe('○')

      const lowConfig = getConfidenceConfig(50)
      expect(lowConfig.level).toBe('low')
      expect(lowConfig.icon).toBe('△')
    })
  })
})
```

### 5.2 Component Tests

**File**: `tests/unit/components/ConfidenceBadge.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { ConfidenceBadge } from '@/components/features/review/ConfidenceBadge'

describe('ConfidenceBadge', () => {
  it('should display score as percentage', () => {
    render(<ConfidenceBadge score={85} />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('should show check icon for high confidence', () => {
    render(<ConfidenceBadge score={95} showIcon />)
    expect(screen.getByRole('img', { name: /check/i })).toBeInTheDocument()
  })

  it('should apply correct color classes', () => {
    const { container, rerender } = render(<ConfidenceBadge score={95} />)
    expect(container.firstChild).toHaveClass(/confidence-high/)

    rerender(<ConfidenceBadge score={75} />)
    expect(container.firstChild).toHaveClass(/confidence-medium/)

    rerender(<ConfidenceBadge score={50} />)
    expect(container.firstChild).toHaveClass(/confidence-low/)
  })

  it('should show attention animation for low confidence', () => {
    const { container } = render(<ConfidenceBadge score={50} />)
    expect(container.firstChild).toHaveClass('confidence-low-attention')
  })
})
```

### 5.3 E2E Tests

**File**: `tests/e2e/confidence-display.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Confidence Color Coding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review/test-doc-id')
  })

  test('should display fields with correct color coding', async ({ page }) => {
    // 檢查高信心度欄位 (綠色)
    const highConfidenceField = page.locator('[data-confidence-level="high"]').first()
    await expect(highConfidenceField).toHaveCSS('border-left-color', /green/)

    // 檢查低信心度欄位 (紅色)
    const lowConfidenceField = page.locator('[data-confidence-level="low"]').first()
    await expect(lowConfidenceField).toHaveCSS('border-left-color', /red/)
  })

  test('should show tooltip on hover', async ({ page }) => {
    await page.locator('[data-testid="confidence-badge"]').first().hover()

    // 檢查 Tooltip 顯示
    await expect(page.locator('[role="tooltip"]')).toBeVisible()
    await expect(page.locator('[role="tooltip"]')).toContainText('信心度計算因素')
  })

  test('should filter to show only low confidence fields', async ({ page }) => {
    // 點擊篩選開關
    await page.getByLabel('僅顯示低信心度欄位').click()

    // 檢查只顯示低信心度欄位
    const fields = await page.locator('[data-testid="field-row"]').all()
    for (const field of fields) {
      await expect(field).toHaveAttribute('data-confidence-level', 'low')
    }
  })
})
```

---

## 6. Verification Checklist

### 6.1 Acceptance Criteria Verification

- [ ] **AC1**: 顏色編碼
  - [ ] 綠色背景/邊框用於 ≥90% 信心度
  - [ ] 黃色背景/邊框用於 70-89% 信心度
  - [ ] 紅色背景/邊框用於 <70% 信心度
  - [ ] 三重編碼（顏色+形狀+數字）正確顯示

- [ ] **AC2**: 信心度詳情提示
  - [ ] 懸停顯示 Tooltip
  - [ ] Tooltip 顯示百分比數值
  - [ ] Tooltip 顯示計算因素分解

- [ ] **AC3**: 篩選低信心度
  - [ ] 篩選切換按鈕正常工作
  - [ ] 篩選後只顯示低信心度欄位
  - [ ] 顯示低信心度欄位數量

### 6.2 Technical Verification

- [ ] CSS 變數正確定義
- [ ] 深色模式顏色正確
- [ ] 組件正確使用配置
- [ ] 無障礙對比度符合 WCAG 2.1 AA

### 6.3 UX Verification

- [ ] 低信心度欄位有脈動動畫
- [ ] Tooltip 延遲合理
- [ ] 顏色清晰可辨
- [ ] 色盲用戶可通過形狀辨識

---

## 7. Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/lib/confidence/thresholds.ts` | Create | 閾值配置 |
| `src/lib/confidence/utils.ts` | Create | 工具函數 |
| `src/app/globals.css` | Modify | 添加 CSS 變數 |
| `src/components/features/review/ConfidenceBadge.tsx` | Modify | 擴展功能 |
| `src/components/features/review/ConfidenceIndicator.tsx` | Create | 形狀指示器 |
| `src/components/features/review/ConfidenceTooltip.tsx` | Create | 詳情 Tooltip |
| `src/components/features/review/LowConfidenceFilter.tsx` | Create | 篩選組件 |
| `src/components/features/review/ReviewPanel/FieldRow.tsx` | Modify | 添加顏色編碼 |
| `src/components/features/review/ReviewPanel/ReviewPanel.tsx` | Modify | 整合篩選功能 |

---

*Tech Spec Created: 2025-12-16*
*Story Reference: 3-3-confidence-color-coding-display*
