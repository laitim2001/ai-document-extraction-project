# Tech Spec: Story 8-1 用戶操作日誌記錄

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Story ID | 8.1 |
| Epic | Epic 8: 審計追溯與合規 |
| 優先級 | Critical |
| 預估點數 | 8 |
| 狀態 | Ready for Dev |
| 依賴 | Story 1.2 (用戶資料庫) |

## 1. 概述

### 1.1 目標
實現完整的用戶操作日誌記錄系統，確保所有用戶操作都被追蹤，支援審計和合規需求。

### 1.2 用戶故事
**As a** 系統
**I want** 記錄所有用戶操作日誌
**So that** 可以追蹤誰在何時做了什麼操作

### 1.3 範圍
- 審計日誌數據模型設計
- 不可篡改性保護機制
- 審計日誌服務（同步/異步寫入）
- API 中間件整合
- 敏感操作詳細記錄

---

## 2. 數據庫設計

### 2.1 AuditLog 模型

```prisma
model AuditLog {
  id              String      @id @default(uuid())

  // 用戶資訊
  userId          String      @map("user_id")
  userName        String      @map("user_name")
  userEmail       String?     @map("user_email")

  // 操作資訊
  action          AuditAction
  resourceType    String      @map("resource_type")
  resourceId      String?     @map("resource_id")
  resourceName    String?     @map("resource_name")

  // 操作詳情
  description     String?
  changes         Json?       // { before: {...}, after: {...} }
  metadata        Json?

  // 請求資訊
  ipAddress       String?     @map("ip_address")
  userAgent       String?     @map("user_agent")
  requestId       String?     @map("request_id")
  sessionId       String?     @map("session_id")

  // 結果
  status          AuditStatus @default(SUCCESS)
  errorMessage    String?     @map("error_message")

  // 城市隔離
  cityCode        String?     @map("city_code")

  // 歸檔標記
  isArchived      Boolean     @default(false) @map("is_archived")

  // 時間戳
  createdAt       DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)

  user            User        @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([action])
  @@index([resourceType, resourceId])
  @@index([createdAt])
  @@index([cityCode, createdAt])
  @@index([status])
  @@map("audit_logs")
}

enum AuditAction {
  CREATE
  READ
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  EXPORT
  IMPORT
  APPROVE
  REJECT
  ESCALATE
  CONFIGURE
}

enum AuditStatus {
  SUCCESS
  FAILURE
  PARTIAL
}
```

### 2.2 SecurityLog 模型 (安全事件)

```prisma
model SecurityLog {
  id          String            @id @default(uuid())
  userId      String?           @map("user_id")
  eventType   SecurityEventType @map("event_type")
  severity    SecuritySeverity
  description String
  details     Json?
  ipAddress   String?           @map("ip_address")
  userAgent   String?           @map("user_agent")
  createdAt   DateTime          @default(now()) @map("created_at")

  @@index([eventType])
  @@index([severity])
  @@index([createdAt])
  @@map("security_logs")
}

enum SecurityEventType {
  UNAUTHORIZED_ACCESS
  TAMPERING_ATTEMPT
  SUSPICIOUS_ACTIVITY
  AUTHENTICATION_FAILURE
  PERMISSION_VIOLATION
  DATA_BREACH_ATTEMPT
}

enum SecuritySeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 2.3 不可篡改性觸發器

```sql
-- 阻止 UPDATE
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_logs (
    id, user_id, event_type, severity, description, details, created_at
  ) VALUES (
    gen_random_uuid(),
    current_setting('app.current_user_id', true),
    'TAMPERING_ATTEMPT',
    'CRITICAL',
    'Attempted to modify audit log record',
    jsonb_build_object('audit_log_id', OLD.id, 'attempted_action', 'UPDATE'),
    NOW()
  );
  RAISE EXCEPTION 'Audit logs cannot be modified';
END;
$$ LANGUAGE plpgsql;

-- 阻止 DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_logs (
    id, user_id, event_type, severity, description, details, created_at
  ) VALUES (
    gen_random_uuid(),
    current_setting('app.current_user_id', true),
    'TAMPERING_ATTEMPT',
    'CRITICAL',
    'Attempted to delete audit log record',
    jsonb_build_object('audit_log_id', OLD.id, 'attempted_action', 'DELETE'),
    NOW()
  );
  RAISE EXCEPTION 'Audit logs cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();

-- 權限設置
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
GRANT INSERT, SELECT ON audit_logs TO app_user;
```

---

## 3. 類型定義

```typescript
// src/types/audit.ts

export interface AuditLogEntry {
  userId: string;
  userName: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  status?: AuditStatus;
  errorMessage?: string;
  cityCode?: string;
}

export type AuditAction =
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT'
  | 'APPROVE' | 'REJECT' | 'ESCALATE' | 'CONFIGURE';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

// 敏感操作定義
export const SENSITIVE_OPERATIONS: Record<string, string[]> = {
  user: ['CREATE', 'UPDATE', 'DELETE'],
  role: ['CREATE', 'UPDATE', 'DELETE'],
  mappingRule: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
  systemConfig: ['UPDATE', 'CONFIGURE'],
  apiPricing: ['UPDATE'],
  forwarder: ['CREATE', 'UPDATE', 'DELETE']
};

export function isSensitiveOperation(resourceType: string, action: string): boolean {
  return SENSITIVE_OPERATIONS[resourceType]?.includes(action) ?? false;
}
```

---

## 4. 審計日誌服務

```typescript
// src/services/audit-log.service.ts

import { prisma } from '@/lib/prisma';
import { AuditLogEntry, isSensitiveOperation } from '@/types/audit';

export class AuditLogService {
  private static instance: AuditLogService;
  private writeQueue: AuditLogEntry[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 1000;

  static getInstance(): AuditLogService {
    if (!this.instance) {
      this.instance = new AuditLogService();
    }
    return this.instance;
  }

  private constructor() {
    this.startFlushTimer();
  }

  /**
   * 記錄審計日誌
   */
  async log(entry: AuditLogEntry): Promise<void> {
    // 敏感操作同步寫入
    if (isSensitiveOperation(entry.resourceType, entry.action)) {
      await this.writeImmediately(entry);
      return;
    }

    // 非敏感操作批次寫入
    this.writeQueue.push(entry);
    if (this.writeQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  private async writeImmediately(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          userName: entry.userName,
          userEmail: entry.userEmail,
          action: entry.action as any,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          resourceName: entry.resourceName,
          description: entry.description,
          changes: entry.changes,
          metadata: entry.metadata,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          requestId: entry.requestId,
          sessionId: entry.sessionId,
          status: (entry.status || 'SUCCESS') as any,
          errorMessage: entry.errorMessage,
          cityCode: entry.cityCode
        }
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      await this.logWriteFailure(entry, error);
    }
  }

  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return;

    const entries = [...this.writeQueue];
    this.writeQueue = [];

    try {
      await prisma.auditLog.createMany({
        data: entries.map(entry => ({
          userId: entry.userId,
          userName: entry.userName,
          userEmail: entry.userEmail,
          action: entry.action as any,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          resourceName: entry.resourceName,
          description: entry.description,
          changes: entry.changes,
          metadata: entry.metadata,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          requestId: entry.requestId,
          sessionId: entry.sessionId,
          status: (entry.status || 'SUCCESS') as any,
          errorMessage: entry.errorMessage,
          cityCode: entry.cityCode
        }))
      });
    } catch (error) {
      console.error('Failed to batch write audit logs:', error);
      for (const entry of entries) {
        await this.writeImmediately(entry);
      }
    }
  }

  private startFlushTimer(): void {
    this.flushTimeout = setInterval(() => {
      this.flush().catch(console.error);
    }, this.FLUSH_INTERVAL);
  }

  private async logWriteFailure(entry: AuditLogEntry, error: any): Promise<void> {
    try {
      await prisma.securityLog.create({
        data: {
          userId: entry.userId,
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'HIGH',
          description: 'Failed to write audit log',
          details: {
            entry,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
    } catch {
      console.error('CRITICAL: Failed to log audit write failure', { entry, error });
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    await this.flush();
  }
}

export const auditLogService = AuditLogService.getInstance();
```

---

## 5. API 中間件

```typescript
// src/middleware/audit-log.middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { auditLogService } from '@/services/audit-log.service';
import { AuditAction, AuditLogEntry } from '@/types/audit';
import { v4 as uuidv4 } from 'uuid';

interface AuditConfig {
  action: AuditAction;
  resourceType: string;
  getResourceId?: (req: NextRequest, result?: any) => string | undefined;
  getResourceName?: (req: NextRequest, result?: any) => string | undefined;
  getDescription?: (req: NextRequest, result?: any) => string | undefined;
  getCityCode?: (req: NextRequest, result?: any) => string | undefined;
}

export function withAuditLog(
  config: AuditConfig,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await auth();
    const requestId = uuidv4();
    const startTime = Date.now();

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    let response: NextResponse;
    let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
    let errorMessage: string | undefined;
    let result: any;

    try {
      response = await handler(request);

      if (response.headers.get('content-type')?.includes('application/json')) {
        const cloned = response.clone();
        try {
          result = await cloned.json();
        } catch {}
      }

      if (!response.ok) {
        status = 'FAILURE';
        errorMessage = result?.error || `HTTP ${response.status}`;
      }
    } catch (error) {
      status = 'FAILURE';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      if (session?.user) {
        const entry: AuditLogEntry = {
          userId: session.user.id,
          userName: session.user.name || session.user.email || 'Unknown',
          userEmail: session.user.email,
          action: config.action,
          resourceType: config.resourceType,
          resourceId: config.getResourceId?.(request, result),
          resourceName: config.getResourceName?.(request, result),
          description: config.getDescription?.(request, result),
          ipAddress,
          userAgent,
          requestId,
          sessionId: session.user.id,
          status,
          errorMessage,
          cityCode: config.getCityCode?.(request, result) || session.user.primaryCityCode,
          metadata: {
            duration: Date.now() - startTime,
            method: request.method,
            path: new URL(request.url).pathname
          }
        };

        auditLogService.log(entry).catch(console.error);
      }
    }

    return response!;
  };
}
```

---

## 6. 使用範例

```typescript
// src/app/api/documents/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuditLog } from '@/middleware/audit-log.middleware';
import { prisma } from '@/lib/prisma';

async function getDocumentHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const document = await prisma.document.findUnique({
    where: { id: params.id }
  });

  if (!document) {
    return NextResponse.json(
      { success: false, error: 'Document not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: document });
}

export const GET = withAuditLog(
  {
    action: 'READ',
    resourceType: 'document',
    getResourceId: (req) => req.url.split('/').pop(),
    getCityCode: (_, result) => result?.data?.cityCode
  },
  (req) => getDocumentHandler(req, { params: { id: req.url.split('/').pop()! } })
);
```

---

## 7. 測試規格

### 7.1 單元測試

```typescript
// src/services/__tests__/audit-log.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogService } from '../audit-log.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma');

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    service = AuditLogService.getInstance();
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should write sensitive operations immediately', async () => {
      const entry = {
        userId: 'user-1',
        userName: 'Test User',
        action: 'DELETE' as const,
        resourceType: 'user',
        status: 'SUCCESS' as const
      };

      await service.log(entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DELETE' })
        })
      );
    });

    it('should batch non-sensitive operations', async () => {
      const entry = {
        userId: 'user-1',
        userName: 'Test User',
        action: 'READ' as const,
        resourceType: 'document',
        status: 'SUCCESS' as const
      };

      await service.log(entry);

      // 非敏感操作不會立即寫入
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
```

---

## 8. 驗收標準對照

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 基本操作日誌記錄 | AuditLog 模型 + withAuditLog 中間件自動記錄 |
| AC2 | 敏感操作詳細記錄 | SENSITIVE_OPERATIONS + changes JSON 欄位 |
| AC3 | 日誌不可篡改性 | PostgreSQL 觸發器阻止 UPDATE/DELETE |
| AC4 | 日誌查詢效能 | 複合索引 + 分區策略 |

---

## 9. 相關文件

- [Story 8-2: 數據變更追蹤](./tech-spec-story-8-2.md)
- [Story 8-3: 處理記錄查詢](./tech-spec-story-8-3.md)
- [Epic 8: 審計追溯與合規](../03-epics/sections/epic-8-audit-trail-compliance.md)
