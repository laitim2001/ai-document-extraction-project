---
paths: src/services/**/*.ts
---

# 服務層開發規範

## 核心架構 - 三層映射系統

```
輸入術語 → Tier 1 (Universal) → 找到？ → 返回結果
                  ↓ 未找到
           Tier 2 (Forwarder-Specific) → 找到？ → 返回結果
                  ↓ 未找到
           Tier 3 (LLM Classification) → 返回結果 + 信心度
```

### 層級說明
| 層級 | 名稱 | 職責 | 覆蓋率 |
|------|------|------|--------|
| Tier 1 | Universal Mapping | 通用術語映射 | 70-80% |
| Tier 2 | Forwarder-Specific | 特定 Forwarder 覆蓋 | 額外 10-15% |
| Tier 3 | LLM Classification | AI 智能分類 | 剩餘 5-10% |

## 信心度路由機制

```typescript
// 使用 src/services/index.ts 中的常數
import {
  CONFIDENCE_THRESHOLD_HIGH,    // 90
  CONFIDENCE_THRESHOLD_MEDIUM,  // 70
  getReviewType
} from '@/services';

// 路由邏輯
const reviewType = getReviewType(confidence);
// ≥ 90%: AUTO_APPROVE
// 70-89%: QUICK_REVIEW
// < 70%: FULL_REVIEW
```

## 服務設計原則

1. **單一職責**: 每個服務只處理一個業務領域
2. **依賴注入**: 服務通過構造函數接收依賴
3. **錯誤處理**: 使用自定義 Error 類型
4. **類型安全**: 所有輸入輸出都有明確類型
5. **可測試性**: 純函數優先，副作用隔離

## 服務文件結構

```
src/services/
├── index.ts              ← 統一導出 + 核心常數
├── mapping/
│   ├── index.ts          ← 模組導出
│   ├── mapping-service.ts
│   ├── tier-resolver.ts
│   └── confidence-calculator.ts
├── ocr/
│   └── ...
└── review/
    └── ...
```

## 錯誤處理模式

```typescript
// 自定義業務錯誤
export class MappingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MappingError';
  }
}

// 使用
throw new MappingError(
  'Unknown term',
  'MAPPING_NOT_FOUND',
  { term, forwarderId }
);
```

## 相關 Epic
- Epic 6: AI Classification Engine
- Epic 5: OCR & Document Processing
- Epic 7: Review Workflow
