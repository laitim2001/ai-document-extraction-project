---
paths: tests/**/*.{ts,tsx}, **/*.test.ts, **/*.spec.ts
---

# 測試規範

## 測試目錄結構

```
tests/
├── unit/                        # 單元測試
│   ├── services/
│   │   └── mapping-service.test.ts
│   └── utils/
│       └── confidence-calculator.test.ts
├── integration/                 # 整合測試
│   └── api/
│       └── documents.test.ts
└── e2e/                         # 端到端測試
    └── document-workflow.spec.ts
```

## 測試覆蓋率目標

| 類型 | 覆蓋率 | 範圍 |
|------|--------|------|
| 單元測試 | ≥ 80% | 核心業務邏輯、工具函數 |
| 整合測試 | ≥ 70% | API 端點、服務集成 |
| E2E 測試 | 關鍵流程 | 文件上傳、審核流程 |

## 單元測試模板

```typescript
/**
 * @fileoverview [模組名稱]單元測試
 * @module tests/unit/services/[name].test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MappingService } from '@/services/mapping';

describe('MappingService', () => {
  let service: MappingService;

  beforeEach(() => {
    service = new MappingService();
    vi.clearAllMocks();
  });

  describe('calculateConfidenceScore', () => {
    it('should return high confidence for exact match', () => {
      // Arrange
      const input = { tier: 'universal', matchType: 'exact' };

      // Act
      const result = service.calculateConfidenceScore(input);

      // Assert
      expect(result).toBeGreaterThanOrEqual(90);
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const invalidInput = null;

      // Act & Assert
      expect(() => service.calculateConfidenceScore(invalidInput))
        .toThrow('Invalid input');
    });
  });
});
```

## 測試命名規範

```typescript
// 格式: should [expected behavior] when [condition]
it('should return AUTO_APPROVE when confidence >= 90', () => {});
it('should throw ValidationError when input is empty', () => {});
it('should call OCR service once per document', () => {});
```

## Mock 模式

```typescript
// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock 外部服務
vi.mock('@/services/ocr', () => ({
  ocrService: {
    extractText: vi.fn().mockResolvedValue({ text: 'mocked' }),
  },
}));
```

## API 整合測試

```typescript
import { describe, it, expect } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/v1/documents/route';

describe('GET /api/v1/documents', () => {
  it('should return paginated documents', async () => {
    const { req } = createMocks({
      method: 'GET',
      query: { page: '1', limit: '10' },
    });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
  });
});
```

## 執行測試

```bash
# 運行所有測試
npm run test

# 監聽模式
npm run test:watch

# 覆蓋率報告
npm run test:coverage

# 只運行特定測試
npm run test -- --grep "MappingService"
```

## 測試最佳實踐

- ✅ 每個測試獨立，不依賴其他測試
- ✅ 使用 `beforeEach` 重置狀態
- ✅ 測試邊界條件和錯誤情況
- ✅ Mock 外部依賴（API、資料庫）
- ❌ 不要測試實現細節，測試行為
- ❌ 不要在測試中使用真實的外部服務
