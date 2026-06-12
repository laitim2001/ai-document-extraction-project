# Tech Spec: Story 22.5 - 單元測試框架建立

> **Version**: 1.0.0
> **Created**: 2026-04-28
> **Status**: Draft
> **Story Key**: STORY-22-5
> **對應風險**: SDLC-10 —— Phase 2 評為 L0

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 22.5 |
| **Epic** | Epic 22 - Enterprise Security |
| **Estimated Effort** | 5 Story Points（~5 person-days） |
| **Dependencies** | 無（為 Story 22-3、22-4 的硬性前置） |
| **Blocking** | Story 22-3（迴歸測試）、Story 22-4 AC9（unit-tests required check） |
| **修復路線圖位置** | Wave 2 #5（`current-state-assessment.md` Wave 2） |

---

## Objective

安裝 Vitest 測試框架並建立完整測試結構，補齊 6 大安全相關邏輯（auth / permission / Zod / rate-limit / audit-log / 既有 batch-processor）的單元測試，CI 強制覆蓋率 ≥ 60% 起步，半年內提升至 80%。

---

## Vitest vs Jest 取捨

### 選擇 Vitest 的關鍵理由

| 因素 | Vitest | Jest | 本專案考量 |
|------|--------|------|----------|
| **與既有規範對齊** | ✅ `.claude/rules/testing.md` 已假設 Vitest | ❌ 需改規範 | 🟢 Vitest 勝 |
| **TypeScript 原生支援** | ✅ 直接執行 .ts | ⚠️ 需 ts-jest | 🟢 Vitest 勝 |
| **ESM 支援** | ✅ 原生 | ⚠️ 需 experimental flag | 🟢 Vitest 勝 |
| **配置複雜度** | 🟢 單一 vitest.config.ts | 🟡 babel.config + jest.config + ts-jest | 🟢 Vitest 勝 |
| **Watch mode 速度** | 🟢 極快（HMR-like） | 🟡 普通 | 🟢 Vitest 勝 |
| **Next.js 15 相容** | ✅ 支援（社群驗證） | ✅ 官方 next/jest | 🟡 平手 |
| **生態成熟度** | 🟡 增長中（v2.x 穩定） | 🟢 業界標準 | 🟡 Jest 略勝 |
| **Mock API** | `vi.fn()`, `vi.mock()` | `jest.fn()`, `jest.mock()` | 🟡 平手 |
| **覆蓋率工具** | c8 / istanbul | istanbul | 🟡 平手 |

### 結論

**選用 Vitest**，主要原因：
1. 既有 `.claude/rules/testing.md` 已假設使用 Vitest——避免改規範產生額外漣漪
2. TypeScript + ESM 開箱即用，省下 ts-jest 配置成本
3. 單一配置檔（vitest.config.ts），維護簡單

### 風險與 fallback

若 Vitest 與 Next.js 15.0.0 出現相容性問題（已驗證社群有 success case，風險低）：
- **Fallback**：改用 `next/jest`（Jest）
- **觸發條件**：Vitest 無法解析 `next/server`、`next/headers` 或 path alias
- **決策點**：Task 1 完成後，跑一個 smoke test（測 next-auth mock）確認可行

---

## vitest.config.ts 範例

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),  // 為日後組件測試預留
  ],
  test: {
    globals: true,                    // describe/it/expect 全域可用
    environment: 'happy-dom',         // 預設 DOM-needing
    environmentMatchGlobs: [
      ['tests/unit/services/**', 'node'],          // 純服務用 node
      ['tests/unit/middlewares/**', 'node'],
      ['tests/unit/lib/**', 'node'],
      ['tests/unit/components/**', 'happy-dom'],   // 為日後預留
    ],
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/e2e/**',  // E2E 由 Playwright 處理
    ],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    pool: 'forks',  // Windows + Prisma mock 相容
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 4,
      }
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/services/**/*.ts',
        'src/middlewares/**/*.ts',
        'src/lib/**/*.ts',
        'src/app/api/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/**',
        'prisma/migrations/**',
        '.next/**',
        'node_modules/**',
        'messages/**',
        '**/*.gen.ts',
        '**/index.ts',  // re-export 檔案
      ],
      thresholds: {
        // 第 1-3 個月（起步）
        lines: 60,
        branches: 50,
        functions: 60,
        statements: 60,

        // 對 6 大安全項目額外設定 per-file 閾值
        perFile: false,  // 整體先達標
        // 半年後改成：
        // lines: 80,
        // branches: 70,
        // functions: 80,
      }
    }
  }
});
```

---

## 測試結構與檔案組織

```
tests/
├── setup.ts                              # 全域 hooks
├── unit/
│   ├── middlewares/
│   │   ├── auth.test.ts                  # AC4
│   │   └── audit-log.test.ts             # AC8
│   ├── lib/
│   │   ├── auth/
│   │   │   └── permissions.test.ts       # AC5
│   │   └── validations/
│   │       ├── exchange-rate.test.ts     # AC6
│   │       ├── field-definition-set.test.ts
│   │       ├── outlook-config.test.ts
│   │       ├── pipeline-config.test.ts
│   │       ├── prompt-config.test.ts
│   │       ├── reference-number.test.ts
│   │       ├── region.test.ts
│   │       ├── role.test.ts
│   │       └── user.test.ts
│   └── services/
│       ├── batch-processor-parallel.test.ts  # 既有
│       └── rate-limit.test.ts            # AC7
├── integration/
│   └── (本 story 不寫，預留結構)
├── e2e/                                  # 既有 Playwright，不變
├── fixtures/
│   ├── pdf-samples/                      # 為 Story 22-3 預留
│   ├── prompt-injection-samples/         # 為 Story 22-3 預留
│   └── seed-data/
│       ├── users.json
│       ├── companies.json
│       └── permissions.json
└── mocks/
    ├── prisma.ts
    ├── next-auth.ts
    ├── azure-blob.ts
    ├── openai.ts
    └── redis.ts
```

### `tests/setup.ts` 範例

```typescript
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 全域 mock：next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// 全域 mock：next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

beforeAll(() => {
  // 設定測試環境變數
  process.env.NODE_ENV = 'test';
  process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
```

---

## Mock 策略

### Prisma Mock（`tests/mocks/prisma.ts`）

使用 `vitest-mock-extended` 自動產生 deep mock：

```typescript
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '@/lib/prisma';

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  // mockReset 在每個 test 前清空
  Object.values(prismaMock).forEach((value: any) => {
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach((method: any) => {
        if (typeof method?.mockReset === 'function') method.mockReset();
      });
    }
  });
});
```

### NextAuth Mock（`tests/mocks/next-auth.ts`）

```typescript
import { vi } from 'vitest';
import type { Session } from 'next-auth';

export const mockSession = (overrides?: Partial<Session>): Session => ({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    permissions: ['INVOICE_VIEW'],
    ...overrides?.user,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn().mockResolvedValue(mockSession()),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(mockSession()),
}));
```

### Azure Blob Mock（`tests/mocks/azure-blob.ts`）

```typescript
import { vi } from 'vitest';

export const mockBlobClient = {
  upload: vi.fn().mockResolvedValue({ etag: 'mock-etag' }),
  download: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn().mockReturnValue({
      getContainerClient: vi.fn().mockReturnValue({
        getBlockBlobClient: vi.fn().mockReturnValue(mockBlobClient),
      }),
    }),
  },
}));
```

### OpenAI Mock（`tests/mocks/openai.ts`）

```typescript
import { vi } from 'vitest';

export const mockOpenAIResponse = (content: any) => ({
  choices: [{
    message: {
      content: typeof content === 'string' ? content : JSON.stringify(content),
      role: 'assistant',
    },
    finish_reason: 'stop',
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(mockOpenAIResponse({})),
      },
    },
  })),
}));
```

### Redis Mock（`tests/mocks/redis.ts`）

```typescript
import { vi } from 'vitest';

export const inMemoryRedis = new Map<string, string>();

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(async (key: string) => inMemoryRedis.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      inMemoryRedis.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(inMemoryRedis.get(key) ?? '0', 10);
      const next = current + 1;
      inMemoryRedis.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (key: string) => {
      const had = inMemoryRedis.has(key);
      inMemoryRedis.delete(key);
      return had ? 1 : 0;
    }),
  })),
}));
```

---

## 6 大安全測試案例

### Test 1: Auth Middleware（`tests/unit/middlewares/auth.test.ts`）

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withAuth } from '@/middlewares/auth';
import { mockSession } from '../../mocks/next-auth';

describe('withAuth middleware', () => {
  it('rejects unauthenticated user with 401', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const req = new Request('http://test/api/secret');
    const res = await wrapped(req);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects authenticated user without permission with 403', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession({
      user: { ...mockSession().user, permissions: [] }
    }));
    const handler = vi.fn();
    const wrapped = withAuth(handler, { permission: 'INVOICE_DELETE' });
    const req = new Request('http://test/api/secret');
    const res = await wrapped(req);
    expect(res.status).toBe(403);
  });

  it('allows authorized user', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession({
      user: { ...mockSession().user, permissions: ['INVOICE_DELETE'] }
    }));
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler, { permission: 'INVOICE_DELETE' });
    const req = new Request('http://test/api/secret');
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('rejects X-Dev-Bypass-Auth in production', async () => {
    process.env.NODE_ENV = 'production';
    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const req = new Request('http://test/api/secret', {
      headers: { 'X-Dev-Bypass-Auth': 'true' },
    });
    const res = await wrapped(req);
    expect(res.status).toBe(401);
    process.env.NODE_ENV = 'test';
  });

  // 更多 case：session expired, JWT tampered, ...
});
```

### Test 2: Permission Check（`tests/unit/lib/auth/permissions.test.ts`）

```typescript
import { describe, it, expect } from 'vitest';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/auth/permissions';

describe('hasPermission', () => {
  it('returns true if user has the permission', () => {
    const user = { permissions: ['INVOICE_CREATE', 'INVOICE_VIEW'] };
    expect(hasPermission(user as any, 'INVOICE_CREATE')).toBe(true);
  });

  it('returns false if user lacks the permission', () => {
    const user = { permissions: ['INVOICE_VIEW'] };
    expect(hasPermission(user as any, 'INVOICE_DELETE')).toBe(false);
  });

  it('handles wildcard admin permission', () => {
    const user = { permissions: ['*'] };
    expect(hasPermission(user as any, 'INVOICE_DELETE')).toBe(true);
  });
});
```

### Test 3: Zod Schema（`tests/unit/lib/validations/user.test.ts`）

```typescript
import { describe, it, expect } from 'vitest';
import { CreateUserSchema } from '@/lib/validations/user';

describe('CreateUserSchema', () => {
  it('accepts valid input', () => {
    const result = CreateUserSchema.safeParse({
      email: 'test@example.com',
      name: 'Test User',
      roleId: 'role-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = CreateUserSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = CreateUserSchema.safeParse({
      email: 'not-an-email',
      name: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('handles SQL injection payload (still valid string but no auto-execute)', () => {
    // Zod 不防 injection，但確認 type narrow 不破壞
    const result = CreateUserSchema.safeParse({
      email: "test@example.com'; DROP TABLE users--",
      name: 'Test',
    });
    expect(result.success).toBe(false);  // 因為 email 格式不對
  });
});
```

### Test 4: Rate Limit（`tests/unit/services/rate-limit.test.ts`）

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimitService } from '@/services/rate-limit.service';
import { inMemoryRedis } from '../../mocks/redis';

describe('RateLimitService', () => {
  beforeEach(() => {
    inMemoryRedis.clear();
  });

  it('allows requests within limit', async () => {
    const result = await rateLimitService.checkLimit('test', 'user-1', { max: 10, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('rejects when limit exceeded', async () => {
    for (let i = 0; i < 10; i++) {
      await rateLimitService.checkLimit('test', 'user-1', { max: 10, windowSeconds: 60 });
    }
    const result = await rateLimitService.checkLimit('test', 'user-1', { max: 10, windowSeconds: 60 });
    expect(result.allowed).toBe(false);
  });

  it('falls back to in-memory when Redis fails', async () => {
    // mock Redis throw
    // verify in-memory mode kicks in
  });

  it('handles concurrent requests without race condition', async () => {
    const promises = Array.from({ length: 100 }, () =>
      rateLimitService.checkLimit('test', 'user-1', { max: 50, windowSeconds: 60 })
    );
    const results = await Promise.all(promises);
    const allowed = results.filter(r => r.allowed).length;
    expect(allowed).toBe(50);
  });

  it('respects whitelist for service accounts', async () => {
    const result = await rateLimitService.checkLimit('test', 'service-n8n', { max: 10, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.bypassed).toBe(true);
  });
});
```

### Test 5: Audit Log Middleware（`tests/unit/middlewares/audit-log.test.ts`）

略（同模式）

---

## 覆蓋率目標分階段

| 階段 | 時程 | Lines | Branches | Functions |
|------|------|-------|----------|-----------|
| **Phase A**（起步） | Story 22-5 完成（W2-W3）| 60% | 50% | 60% |
| **Phase B**（擴展） | 3 個月後 | 70% | 60% | 70% |
| **Phase C**（成熟） | 半年後 | 80% | 70% | 80% |

### 覆蓋率提升策略

```
Phase A：6 大安全項目達標（auth/permission/Zod/rate-limit/audit-log/batch-processor）
        其他 src/ 用 coverage.include 排除暫不要求

Phase B：每月補 5-10 個 services 的測試
        加入 integration tests 對 API endpoints

Phase C：所有 src/services/、src/middlewares/、src/lib/ 達 80%
        新功能必須附測試（PR template 強制）
```

---

## 與 Story 22-4 CI 整合

### `.github/workflows/tests.yml`

```yaml
name: Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:coverage
      - name: Upload coverage to PR
        uses: davelosert/vitest-coverage-report-action@v2
        if: always()
      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

### Required Status Check 整合

完成本 story 後，於 Story 22-4 的 Branch Protection 加入：
```
Tests / unit-tests
```

到 required status checks 列表（取代 advisory）。

---

## File Structure

```
package.json                                 # 修改
vitest.config.ts                             # 新增
tsconfig.json                                # 可能微調
.github/workflows/tests.yml                  # 新增（與 22-4 對接）

tests/
├── setup.ts                                 # 新增
├── unit/
│   ├── middlewares/
│   │   ├── auth.test.ts
│   │   └── audit-log.test.ts
│   ├── lib/
│   │   ├── auth/permissions.test.ts
│   │   └── validations/
│   │       └── *.test.ts (×9)
│   └── services/
│       ├── batch-processor-parallel.test.ts # 既有
│       └── rate-limit.test.ts
├── fixtures/
│   ├── pdf-samples/                         # 為 22-3 預留
│   ├── prompt-injection-samples/            # 為 22-3 預留
│   └── seed-data/
└── mocks/
    ├── prisma.ts
    ├── next-auth.ts
    ├── azure-blob.ts
    ├── openai.ts
    └── redis.ts

.claude/rules/testing.md                     # 修改
docs/08-security-and-governance/testing-strategy.md  # 新增
docs/06-deployment/01-local-deployment/onboarding-checklist.md  # 修改
claudedocs/CLAUDE.md                         # 修改（標註測試現狀升級）
```

---

## v1.2 矩陣對齊

| ID | 項目 | Phase 2 | 完成 22-5 後 |
|----|------|---------|-------------|
| **SDLC-10** | 安全測試（單元）| L0 | L2（達基準）|

達 L2 標準：「auth middleware test、Zod schema test、RBAC test、rate limit test 已實作」

---

## Risks & Mitigations

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| Vitest 與 Next.js 15 相容性問題 | 🟢 LOW | 🔴 HIGH | Task 1 結尾跑 smoke test；fallback 到 next/jest |
| 60% 覆蓋率閾值對既有 codebase 過嚴 | 🟡 MED | 🟡 MED | `coverage.include` 第一階段只納入 6 大項目，其他先排除 |
| Prisma deep mock 過於複雜 | 🟡 MED | 🟡 MED | 用 `vitest-mock-extended` 套件 |
| Windows 環境 happy-dom 問題 | 🟢 LOW | 🟢 LOW | fallback config 切換到 jsdom |
| 測試開發時程超過 5 天 | 🟡 MED | 🟡 MED | 先完成 6 大項目（最小可行），其他逐步補 |
| Mock OpenAI 與 Story 22-3 不對齊 | 🟢 LOW | 🟡 MED | 22-5 與 22-3 mock 設計提前對齊 |

---

## Definition of Done

- [ ] AC1-AC9 全部通過
- [ ] `vitest.config.ts` 配置完成且 `npm run test` 可執行
- [ ] 6 大測試檔案完成且各自達標：
  - [ ] auth middleware 覆蓋率 ≥ 80%
  - [ ] permissions 覆蓋率 ≥ 90%
  - [ ] 9 個 Zod schema 各自覆蓋率 ≥ 90%
  - [ ] rate-limit.service 覆蓋率 ≥ 85%
  - [ ] audit-log middleware 覆蓋率 ≥ 80%
- [ ] CI workflow `tests.yml` 在 PR 上實際觸發
- [ ] PR comment 顯示 coverage report
- [ ] 既有 `batch-processor-parallel.test.ts` 可被執行（去孤兒狀態）
- [ ] `.claude/rules/testing.md` 從規範變現實
- [ ] `testing-strategy.md` 完成（覆蓋率時程文檔化）
- [ ] Onboarding checklist 加入 `npm test` 步驟
