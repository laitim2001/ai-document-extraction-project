# Story 8.1: 用戶操作日誌記錄

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 記錄所有用戶操作日誌,
**So that** 可以追蹤誰在何時做了什麼操作。

---

## Acceptance Criteria

### AC1: 基本操作日誌記錄

**Given** 用戶執行任何操作
**When** 操作完成
**Then** 系統記錄以下資訊：
- 用戶 ID 和用戶名
- 操作類型（創建/讀取/更新/刪除）
- 操作對象（資源類型和 ID）
- 操作時間（精確到毫秒）
- IP 地址和 User Agent
- 操作結果（成功/失敗）

### AC2: 敏感操作詳細記錄

**Given** 敏感操作
**When** 如用戶管理、規則變更、系統配置
**Then** 記錄操作前後的值變化

### AC3: 日誌不可篡改性

**Given** 操作日誌
**When** 嘗試修改或刪除
**Then** 系統拒絕操作
**And** 記錄此次嘗試至安全日誌

### AC4: 日誌查詢效能

**Given** 大量日誌記錄
**When** 按時間和用戶查詢
**Then** 查詢響應時間 < 3 秒
**And** 支援分頁和篩選

---

## Tasks / Subtasks

- [ ] **Task 1: 審計日誌模型設計** (AC: #1, #2)
  - [ ] 1.1 創建 `AuditLog` Prisma 模型
  - [ ] 1.2 設計欄位結構支援多種操作類型
  - [ ] 1.3 添加 JSON 欄位儲存變更詳情
  - [ ] 1.4 創建 Database Migration

- [ ] **Task 2: 不可篡改性保護** (AC: #3)
  - [ ] 2.1 創建 PostgreSQL 觸發器阻止 UPDATE/DELETE
  - [ ] 2.2 設置資料表權限（僅允許 INSERT）
  - [ ] 2.3 創建篡改嘗試日誌記錄
  - [ ] 2.4 設置數據庫審計

- [ ] **Task 3: 審計日誌服務** (AC: #1, #2)
  - [ ] 3.1 創建 `AuditLogService`
  - [ ] 3.2 實現通用日誌記錄方法
  - [ ] 3.3 實現敏感操作詳細記錄
  - [ ] 3.4 異步寫入避免阻塞主流程

- [ ] **Task 4: API 中間件整合** (AC: #1)
  - [ ] 4.1 創建 `withAuditLog` API 中間件
  - [ ] 4.2 自動捕獲請求資訊（IP、User Agent）
  - [ ] 4.3 整合到所有 API 路由
  - [ ] 4.4 處理批次操作日誌

- [ ] **Task 5: 敏感操作攔截器** (AC: #2)
  - [ ] 5.1 定義敏感操作清單
  - [ ] 5.2 創建變更前後值捕獲機制
  - [ ] 5.3 整合到 Prisma 中間件
  - [ ] 5.4 處理關聯數據變更

- [ ] **Task 6: 索引與效能優化** (AC: #4)
  - [ ] 6.1 創建時間範圍查詢索引
  - [ ] 6.2 創建用戶查詢索引
  - [ ] 6.3 創建資源類型索引
  - [ ] 6.4 設置分區策略（按月分區）

- [ ] **Task 7: 測試** (AC: #1-4)
  - [ ] 7.1 測試日誌記錄完整性
  - [ ] 7.2 測試不可篡改性
  - [ ] 7.3 測試敏感操作記錄
  - [ ] 7.4 效能測試

---

## Dev Notes

### 依賴項

- **Story 1.2**: 用戶資料庫（用戶資訊來源）

### Architecture Compliance

```prisma
// prisma/schema.prisma - 審計日誌模型
model AuditLog {
  id              String    @id @default(uuid())

  // 用戶資訊
  userId          String    @map("user_id")
  userName        String    @map("user_name")
  userEmail       String?   @map("user_email")

  // 操作資訊
  action          AuditAction
  resourceType    String    @map("resource_type")  // 'document', 'user', 'rule', etc.
  resourceId      String?   @map("resource_id")
  resourceName    String?   @map("resource_name")

  // 操作詳情
  description     String?
  changes         Json?     // { before: {...}, after: {...} }
  metadata        Json?     // 額外資訊

  // 請求資訊
  ipAddress       String?   @map("ip_address")
  userAgent       String?   @map("user_agent")
  requestId       String?   @map("request_id")
  sessionId       String?   @map("session_id")

  // 結果
  status          AuditStatus @default(SUCCESS)
  errorMessage    String?   @map("error_message")

  // 城市（用於數據隔離）
  cityCode        String?   @map("city_code")

  // 時間戳（精確到毫秒）
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  // 關聯
  user            User      @relation(fields: [userId], references: [id])

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

// 安全日誌（記錄安全事件和篡改嘗試）
model SecurityLog {
  id          String   @id @default(uuid())
  userId      String?  @map("user_id")
  eventType   SecurityEventType @map("event_type")
  severity    SecuritySeverity
  description String
  details     Json?
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  createdAt   DateTime @default(now()) @map("created_at")

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

```sql
-- migrations/xxx_audit_log_immutable.sql
-- PostgreSQL 觸發器：阻止審計日誌被修改或刪除

-- 阻止 UPDATE
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 記錄篡改嘗試
  INSERT INTO security_logs (
    id, user_id, event_type, severity, description, details, created_at
  ) VALUES (
    gen_random_uuid(),
    current_setting('app.current_user_id', true),
    'TAMPERING_ATTEMPT',
    'CRITICAL',
    'Attempted to modify audit log record',
    jsonb_build_object(
      'audit_log_id', OLD.id,
      'attempted_action', 'UPDATE'
    ),
    NOW()
  );

  RAISE EXCEPTION 'Audit logs cannot be modified';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 阻止 DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 記錄篡改嘗試
  INSERT INTO security_logs (
    id, user_id, event_type, severity, description, details, created_at
  ) VALUES (
    gen_random_uuid(),
    current_setting('app.current_user_id', true),
    'TAMPERING_ATTEMPT',
    'CRITICAL',
    'Attempted to delete audit log record',
    jsonb_build_object(
      'audit_log_id', OLD.id,
      'attempted_action', 'DELETE'
    ),
    NOW()
  );

  RAISE EXCEPTION 'Audit logs cannot be deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_update();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();

-- 設置表權限（僅允許 INSERT 和 SELECT）
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
GRANT INSERT, SELECT ON audit_logs TO app_user;
```

```typescript
// src/types/audit.ts
export interface AuditLogEntry {
  userId: string
  userName: string
  userEmail?: string
  action: AuditAction
  resourceType: string
  resourceId?: string
  resourceName?: string
  description?: string
  changes?: {
    before?: Record<string, any>
    after?: Record<string, any>
  }
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  requestId?: string
  sessionId?: string
  status?: 'SUCCESS' | 'FAILURE' | 'PARTIAL'
  errorMessage?: string
  cityCode?: string
}

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'ESCALATE'
  | 'CONFIGURE'

// 敏感操作定義
export const SENSITIVE_OPERATIONS: Record<string, string[]> = {
  user: ['CREATE', 'UPDATE', 'DELETE'],
  role: ['CREATE', 'UPDATE', 'DELETE'],
  mappingRule: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
  systemConfig: ['UPDATE', 'CONFIGURE'],
  apiPricing: ['UPDATE'],
  forwarder: ['CREATE', 'UPDATE', 'DELETE']
}

export function isSensitiveOperation(resourceType: string, action: string): boolean {
  return SENSITIVE_OPERATIONS[resourceType]?.includes(action) ?? false
}
```

```typescript
// src/services/audit-log.service.ts
import { prisma } from '@/lib/prisma'
import { AuditLogEntry, isSensitiveOperation } from '@/types/audit'

export class AuditLogService {
  private static instance: AuditLogService
  private writeQueue: AuditLogEntry[] = []
  private flushTimeout: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 100
  private readonly FLUSH_INTERVAL = 1000 // 1 秒

  private constructor() {
    // 設置定期刷新
    this.startFlushTimer()
  }

  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService()
    }
    return AuditLogService.instance
  }

  /**
   * 記錄審計日誌
   */
  async log(entry: AuditLogEntry): Promise<void> {
    // 對於敏感操作，同步寫入
    if (isSensitiveOperation(entry.resourceType, entry.action)) {
      await this.writeImmediately(entry)
      return
    }

    // 其他操作加入隊列批次寫入
    this.writeQueue.push(entry)

    if (this.writeQueue.length >= this.BATCH_SIZE) {
      await this.flush()
    }
  }

  /**
   * 同步寫入（敏感操作）
   */
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
      })
    } catch (error) {
      console.error('Failed to write audit log:', error)
      // 審計日誌失敗不應影響主流程，但需要記錄
      await this.logWriteFailure(entry, error)
    }
  }

  /**
   * 批次刷新隊列
   */
  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return

    const entries = [...this.writeQueue]
    this.writeQueue = []

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
      })
    } catch (error) {
      console.error('Failed to batch write audit logs:', error)
      // 失敗時嘗試逐筆寫入
      for (const entry of entries) {
        await this.writeImmediately(entry)
      }
    }
  }

  private startFlushTimer(): void {
    this.flushTimeout = setInterval(() => {
      this.flush().catch(console.error)
    }, this.FLUSH_INTERVAL)
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
      })
    } catch {
      // 最後手段：寫入控制台
      console.error('CRITICAL: Failed to log audit write failure', { entry, error })
    }
  }

  /**
   * 記錄敏感操作（包含變更前後值）
   */
  async logSensitiveOperation(
    entry: Omit<AuditLogEntry, 'changes'>,
    getBefore: () => Promise<Record<string, any> | null>,
    getAfter: () => Promise<Record<string, any> | null>
  ): Promise<void> {
    const before = await getBefore()
    // 執行操作由調用方處理
    const after = await getAfter()

    await this.log({
      ...entry,
      changes: { before, after }
    })
  }

  /**
   * 關閉服務（應用程式關閉時調用）
   */
  async shutdown(): Promise<void> {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout)
    }
    await this.flush()
  }
}

export const auditLogService = AuditLogService.getInstance()
```

```typescript
// src/middleware/audit-log.middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { auditLogService } from '@/services/audit-log.service'
import { AuditAction, AuditLogEntry } from '@/types/audit'
import { v4 as uuidv4 } from 'uuid'

interface AuditConfig {
  action: AuditAction
  resourceType: string
  getResourceId?: (req: NextRequest, result?: any) => string | undefined
  getResourceName?: (req: NextRequest, result?: any) => string | undefined
  getDescription?: (req: NextRequest, result?: any) => string | undefined
  getCityCode?: (req: NextRequest, result?: any) => string | undefined
}

export function withAuditLog(
  config: AuditConfig,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await auth()
    const requestId = uuidv4()
    const startTime = Date.now()

    // 提取請求資訊
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    let response: NextResponse
    let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
    let errorMessage: string | undefined
    let result: any

    try {
      response = await handler(request)

      // 嘗試解析響應以獲取資源資訊
      if (response.headers.get('content-type')?.includes('application/json')) {
        const clonedResponse = response.clone()
        try {
          result = await clonedResponse.json()
        } catch {
          // 忽略解析錯誤
        }
      }

      if (!response.ok) {
        status = 'FAILURE'
        errorMessage = result?.error || `HTTP ${response.status}`
      }
    } catch (error) {
      status = 'FAILURE'
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw error
    } finally {
      // 記錄審計日誌
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
          sessionId: session.user.id, // 或從 session 獲取
          status,
          errorMessage,
          cityCode: config.getCityCode?.(request, result) || session.user.primaryCityCode,
          metadata: {
            duration: Date.now() - startTime,
            method: request.method,
            path: new URL(request.url).pathname
          }
        }

        auditLogService.log(entry).catch(console.error)
      }
    }

    return response!
  }
}
```

```typescript
// src/app/api/documents/[id]/route.ts - 使用範例
import { NextRequest, NextResponse } from 'next/server'
import { withAuditLog } from '@/middleware/audit-log.middleware'
import { prisma } from '@/lib/prisma'

async function getDocumentHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const document = await prisma.document.findUnique({
    where: { id: params.id }
  })

  if (!document) {
    return NextResponse.json(
      { success: false, error: 'Document not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, data: document })
}

export const GET = withAuditLog(
  {
    action: 'READ',
    resourceType: 'document',
    getResourceId: (req) => req.url.split('/').pop(),
    getCityCode: (req, result) => result?.data?.cityCode
  },
  (req) => getDocumentHandler(req, { params: { id: req.url.split('/').pop()! } })
)
```

```typescript
// src/lib/prisma-audit.middleware.ts
import { Prisma } from '@prisma/client'
import { auditLogService } from '@/services/audit-log.service'
import { SENSITIVE_OPERATIONS } from '@/types/audit'

// Prisma 中間件：自動捕獲敏感操作的變更
export const auditMiddleware: Prisma.Middleware = async (params, next) => {
  const sensitiveModels = Object.keys(SENSITIVE_OPERATIONS)

  // 檢查是否為敏感模型
  if (!params.model || !sensitiveModels.includes(params.model.toLowerCase())) {
    return next(params)
  }

  const action = params.action.toUpperCase()
  const resourceType = params.model.toLowerCase()

  // 檢查是否為敏感操作
  if (!SENSITIVE_OPERATIONS[resourceType]?.includes(action)) {
    return next(params)
  }

  let beforeValue: any = null

  // UPDATE 或 DELETE 前獲取原始值
  if (['update', 'delete'].includes(params.action)) {
    try {
      beforeValue = await (prisma as any)[params.model].findUnique({
        where: params.args.where
      })
    } catch {
      // 忽略錯誤
    }
  }

  // 執行操作
  const result = await next(params)

  // 獲取當前用戶（需要從上下文傳遞）
  const currentUser = (params.args as any).__auditUser

  if (currentUser) {
    await auditLogService.log({
      userId: currentUser.id,
      userName: currentUser.name || currentUser.email,
      userEmail: currentUser.email,
      action: action as any,
      resourceType,
      resourceId: result?.id || params.args.where?.id,
      changes: {
        before: beforeValue,
        after: result
      },
      status: 'SUCCESS'
    })
  }

  return result
}
```

### 安全考量

- **不可篡改性**: PostgreSQL 觸發器阻止 UPDATE/DELETE
- **完整記錄**: 包含 IP、User Agent、時間戳
- **敏感操作**: 記錄變更前後的完整值
- **審計分離**: 考慮使用獨立審計數據庫

### 效能考量

- **批次寫入**: 非敏感操作批次寫入減少 I/O
- **異步處理**: 避免阻塞主業務流程
- **索引優化**: 針對常用查詢欄位建立索引
- **分區策略**: 按月分區大表

### References

- [Source: docs/03-epics/sections/epic-8-audit-trail-compliance.md#story-81]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR48]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 8.1 |
| Story Key | 8-1-user-operation-log-recording |
| Epic | Epic 8: 審計追溯與合規 |
| FR Coverage | FR48 |
| Dependencies | Story 1.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
