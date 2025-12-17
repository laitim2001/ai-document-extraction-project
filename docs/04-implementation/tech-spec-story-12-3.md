# Tech Spec: Story 12-3 - 錯誤告警配置 (Error Alert Configuration)

## 1. Overview

### 1.1 Story Information
- **Story ID**: 12-3
- **Epic**: Epic 12 - 系統管理與監控
- **Priority**: High
- **Story Points**: 8
- **Functional Requirements**: FR61 (告警配置)

### 1.2 User Story
**As a** 系統管理員,
**I want** 配置錯誤告警規則,
**So that** 當系統出現問題時能及時收到通知。

### 1.3 Dependencies
- **Story 12-1**: System Health Monitoring Dashboard (健康指標來源)
- **Story 12-2**: Performance Metrics Tracking (效能指標來源)

### 1.4 Acceptance Criteria Summary
| AC ID | Description | Priority |
|-------|-------------|----------|
| AC1 | 告警規則創建 - 設定名稱、條件、級別、通知管道 | Must Have |
| AC2 | 觸發條件類型 - 服務不可用、錯誤率、回應時間等 | Must Have |
| AC3 | 告警通知發送 - 包含告警詳情和快速連結 | Must Have |
| AC4 | 恢復通知 - 條件恢復正常時發送通知 | Should Have |
| AC5 | 告警歷史記錄 - 顯示所有歷史告警及處理狀態 | Must Have |

---

## 2. Architecture Design

### 2.1 System Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                    Alert Configuration System                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ AlertRule    │    │ Alert        │    │ Alert        │          │
│  │ Service      │───▶│ Evaluation   │───▶│ Notification │          │
│  │              │    │ Service      │    │ Service      │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌──────────────────────────────────────────────────────┐          │
│  │               PostgreSQL Database                     │          │
│  │  AlertRule │ Alert │ AlertNotification                │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Health       │    │ Performance  │    │ System       │          │
│  │ Check Svc    │    │ Service      │    │ Resource     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             ▼                                        │
│                   ┌──────────────┐                                   │
│                   │ Alert        │                                   │
│                   │ Evaluation   │ (Every 60 seconds)               │
│                   │ Job          │                                   │
│                   └──────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow
```
[Alert Rule Created] ──▶ [AlertRuleService.createRule()]
                                     │
                                     ▼
[Evaluation Job] ──▶ [AlertEvaluationService.evaluateAllRules()]
        │                            │
        │                    ┌───────┴───────┐
        │                    ▼               ▼
        │            [getMetricValue()]  [checkCondition()]
        │                    │               │
        │                    └───────┬───────┘
        │                            ▼
        │              [Condition Met?] ──No──▶ [Check Recovery]
        │                    │                        │
        │                   Yes                      Yes
        │                    ▼                        ▼
        │            [createAlert()]          [recoverAlert()]
        │                    │                        │
        │                    └───────────┬────────────┘
        │                                ▼
        │                 [AlertNotificationService]
        │                          │
        │              ┌───────────┼───────────┐
        │              ▼           ▼           ▼
        │           [Email]    [Teams]    [Webhook]
        └──────────────────────────────────────────────▶ [Repeat]
```

### 2.3 Component Diagram
```
┌─────────────────────────────────────────────────────┐
│                   Admin UI Layer                     │
├─────────────────────────────────────────────────────┤
│  AlertRuleManagement  │  AlertHistory  │  AlertConfig│
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    API Layer                         │
├─────────────────────────────────────────────────────┤
│  /api/admin/alerts/rules                            │
│  /api/admin/alerts                                  │
│  /api/admin/alerts/[id]/acknowledge                 │
│  /api/admin/alerts/[id]/resolve                     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                  Service Layer                       │
├─────────────────────────────────────────────────────┤
│  AlertRuleService     │  AlertEvaluationService     │
│  AlertNotificationSvc │  AlertEvaluationJob         │
└─────────────────────────────────────────────────────┘
```

---

## 3. Database Design

### 3.1 Prisma Schema

```prisma
// ===========================================
// 告警規則模型
// ===========================================

model AlertRule {
  id              String              @id @default(cuid())

  // 基本資訊
  name            String
  description     String?
  isActive        Boolean             @default(true)

  // 觸發條件
  conditionType   AlertConditionType
  metric          String              // 監控的指標名稱
  operator        AlertOperator
  threshold       Float
  duration        Int                 // 持續時間（秒）

  // 進階條件
  serviceName     String?             // 特定服務
  endpoint        String?             // 特定端點

  // 告警級別
  severity        AlertSeverity

  // 通知設定
  channels        Json                // AlertChannel[]
  recipients      Json                // string[] - 用戶 ID 或 Email

  // 冷卻時間
  cooldownMinutes Int                 @default(15)

  // 多城市支援
  cityId          String?
  city            City?               @relation(fields: [cityId], references: [id])

  // 創建者
  createdById     String
  createdBy       User                @relation(fields: [createdById], references: [id])

  // 時間記錄
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  // 關聯
  alerts          Alert[]

  @@index([isActive])
  @@index([conditionType])
  @@index([severity])
  @@index([cityId])
}

enum AlertConditionType {
  SERVICE_DOWN        // 服務不可用
  ERROR_RATE          // 錯誤率
  RESPONSE_TIME       // 回應時間
  QUEUE_BACKLOG       // 隊列積壓
  STORAGE_LOW         // 儲存空間不足
  CPU_HIGH            // CPU 使用率高
  MEMORY_HIGH         // 記憶體使用率高
  CUSTOM_METRIC       // 自定義指標
}

enum AlertOperator {
  GREATER_THAN        // >
  GREATER_THAN_EQ     // >=
  LESS_THAN           // <
  LESS_THAN_EQ        // <=
  EQUALS              // =
  NOT_EQUALS          // !=
}

enum AlertSeverity {
  INFO                // 資訊
  WARNING             // 警告
  CRITICAL            // 嚴重
  EMERGENCY           // 緊急
}

// ===========================================
// 告警實例模型
// ===========================================

model Alert {
  id              String              @id @default(cuid())

  // 規則關聯
  ruleId          String
  rule            AlertRule           @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  // 狀態
  status          AlertStatus         @default(FIRING)
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  resolvedBy      String?
  resolvedAt      DateTime?
  resolution      String?             // 解決說明

  // 觸發資訊
  triggeredValue  Float               // 觸發時的值
  triggeredAt     DateTime            @default(now())
  recoveredAt     DateTime?

  // 詳細資訊
  details         Json?               // 額外的上下文資訊
  metricData      Json?               // 觸發時的指標數據

  // 通知記錄
  notificationsSent Json?             // 發送的通知記錄

  // 多城市支援
  cityId          String?
  city            City?               @relation(fields: [cityId], references: [id])

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  // 關聯
  notifications   AlertNotification[]

  @@index([ruleId])
  @@index([status])
  @@index([triggeredAt])
  @@index([cityId])
}

enum AlertStatus {
  FIRING            // 告警中
  ACKNOWLEDGED      // 已確認
  RESOLVED          // 已解決
  RECOVERED         // 自動恢復
}

// ===========================================
// 通知發送記錄模型
// ===========================================

model AlertNotification {
  id              String              @id @default(cuid())
  alertId         String
  alert           Alert               @relation(fields: [alertId], references: [id], onDelete: Cascade)
  channel         NotificationChannel
  recipient       String
  subject         String
  body            String              @db.Text
  status          NotificationStatus
  errorMessage    String?
  sentAt          DateTime?
  createdAt       DateTime            @default(now())

  @@index([alertId])
  @@index([status])
}

enum NotificationChannel {
  EMAIL
  TEAMS
  WEBHOOK
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}
```

### 3.2 Database Indexes
```sql
-- 告警規則查詢優化
CREATE INDEX idx_alert_rule_active_type ON "AlertRule"("isActive", "conditionType");
CREATE INDEX idx_alert_rule_city ON "AlertRule"("cityId") WHERE "cityId" IS NOT NULL;

-- 告警查詢優化
CREATE INDEX idx_alert_status_time ON "Alert"("status", "triggeredAt" DESC);
CREATE INDEX idx_alert_rule_status ON "Alert"("ruleId", "status");
CREATE INDEX idx_alert_city_time ON "Alert"("cityId", "triggeredAt" DESC);

-- 通知查詢優化
CREATE INDEX idx_notification_alert ON "AlertNotification"("alertId", "status");
```

---

## 4. API Design

### 4.1 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/alerts/rules` | 獲取告警規則列表 |
| POST | `/api/admin/alerts/rules` | 創建告警規則 |
| GET | `/api/admin/alerts/rules/:id` | 獲取告警規則詳情 |
| PUT | `/api/admin/alerts/rules/:id` | 更新告警規則 |
| DELETE | `/api/admin/alerts/rules/:id` | 刪除告警規則 |
| PATCH | `/api/admin/alerts/rules/:id/toggle` | 啟用/停用規則 |
| GET | `/api/admin/alerts` | 獲取告警列表 |
| GET | `/api/admin/alerts/:id` | 獲取告警詳情 |
| POST | `/api/admin/alerts/:id/acknowledge` | 確認告警 |
| POST | `/api/admin/alerts/:id/resolve` | 解決告警 |
| GET | `/api/admin/alerts/statistics` | 獲取告警統計 |

### 4.2 Request/Response Schemas

#### Create Alert Rule
```typescript
// POST /api/admin/alerts/rules
// Request
interface CreateAlertRuleRequest {
  name: string;                        // 1-100 chars
  description?: string;                // max 500 chars
  conditionType: AlertConditionType;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;                    // 30-3600 seconds
  serviceName?: string;
  endpoint?: string;
  severity: AlertSeverity;
  channels: Array<{
    type: 'EMAIL' | 'TEAMS' | 'WEBHOOK';
    config: Record<string, any>;
  }>;
  recipients: string[];                // min 1
  cooldownMinutes?: number;            // 5-1440, default 15
  cityId?: string;
}

// Response
interface CreateAlertRuleResponse {
  data: {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    conditionType: string;
    metric: string;
    operator: string;
    threshold: number;
    duration: number;
    severity: string;
    channels: any[];
    recipients: string[];
    cooldownMinutes: number;
    createdAt: string;
    updatedAt: string;
  };
}
```

#### List Alerts
```typescript
// GET /api/admin/alerts?status=FIRING&severity=CRITICAL&page=1&pageSize=20
// Response
interface ListAlertsResponse {
  data: {
    items: Array<{
      id: string;
      ruleId: string;
      ruleName: string;
      status: AlertStatus;
      severity: AlertSeverity;
      triggeredValue: number;
      triggeredAt: string;
      recoveredAt?: string;
      acknowledgedAt?: string;
      acknowledgedBy?: string;
      resolvedAt?: string;
      resolution?: string;
      details?: any;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
}
```

#### Acknowledge Alert
```typescript
// POST /api/admin/alerts/:id/acknowledge
// Request (empty body)

// Response
interface AcknowledgeAlertResponse {
  data: {
    id: string;
    status: 'ACKNOWLEDGED';
    acknowledgedAt: string;
    acknowledgedBy: string;
  };
}
```

#### Resolve Alert
```typescript
// POST /api/admin/alerts/:id/resolve
// Request
interface ResolveAlertRequest {
  resolution: string;                  // 解決說明
}

// Response
interface ResolveAlertResponse {
  data: {
    id: string;
    status: 'RESOLVED';
    resolvedAt: string;
    resolvedBy: string;
    resolution: string;
  };
}
```

---

## 5. TypeScript Types

```typescript
// types/alerts.ts

// ===========================================
// Enums
// ===========================================

export enum AlertConditionType {
  SERVICE_DOWN = 'SERVICE_DOWN',
  ERROR_RATE = 'ERROR_RATE',
  RESPONSE_TIME = 'RESPONSE_TIME',
  QUEUE_BACKLOG = 'QUEUE_BACKLOG',
  STORAGE_LOW = 'STORAGE_LOW',
  CPU_HIGH = 'CPU_HIGH',
  MEMORY_HIGH = 'MEMORY_HIGH',
  CUSTOM_METRIC = 'CUSTOM_METRIC',
}

export enum AlertOperator {
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_EQ = 'GREATER_THAN_EQ',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_EQ = 'LESS_THAN_EQ',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY',
}

export enum AlertStatus {
  FIRING = 'FIRING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  RECOVERED = 'RECOVERED',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  TEAMS = 'TEAMS',
  WEBHOOK = 'WEBHOOK',
}

// ===========================================
// Alert Rule Types
// ===========================================

export interface AlertChannel {
  type: NotificationChannel;
  config: EmailConfig | TeamsConfig | WebhookConfig;
}

export interface EmailConfig {
  smtpOverride?: string;
}

export interface TeamsConfig {
  webhookUrl: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
}

export interface AlertRuleInput {
  name: string;
  description?: string;
  conditionType: AlertConditionType;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;
  serviceName?: string;
  endpoint?: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  recipients: string[];
  cooldownMinutes?: number;
  cityId?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  conditionType: AlertConditionType;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;
  serviceName?: string;
  endpoint?: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  recipients: string[];
  cooldownMinutes: number;
  cityId?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Alert Types
// ===========================================

export interface Alert {
  id: string;
  ruleId: string;
  rule?: AlertRule;
  status: AlertStatus;
  triggeredValue: number;
  triggeredAt: Date;
  recoveredAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  details?: AlertDetails;
  metricData?: MetricData;
  cityId?: string;
}

export interface AlertDetails {
  serviceName?: string;
  endpoint?: string;
  additionalInfo?: Record<string, any>;
}

export interface MetricData {
  metric: string;
  threshold: number;
  operator: string;
  duration: number;
  samples?: number[];
}

// ===========================================
// Metric Value Types
// ===========================================

export interface MetricValue {
  value: number;
  timestamp: Date;
  details?: Record<string, any>;
}

// ===========================================
// Statistics Types
// ===========================================

export interface AlertStatistics {
  total: number;
  byStatus: Record<AlertStatus, number>;
  bySeverity: Record<AlertSeverity, number>;
  byConditionType: Record<AlertConditionType, number>;
  averageResolutionTime: number; // minutes
  recentAlerts: Alert[];
}
```

---

## 6. Service Layer Implementation

### 6.1 Alert Rule Service

```typescript
// lib/services/monitoring/alertRuleService.ts
import { prisma } from '@/lib/prisma';
import {
  AlertConditionType,
  AlertOperator,
  AlertSeverity,
  AlertRuleInput,
  AlertRule,
} from '@/types/alerts';

export interface AlertRuleListOptions {
  isActive?: boolean;
  severity?: AlertSeverity;
  conditionType?: AlertConditionType;
  cityId?: string;
  page?: number;
  pageSize?: number;
}

export interface AlertRuleListResult {
  items: AlertRule[];
  total: number;
  page: number;
  pageSize: number;
}

export class AlertRuleService {
  /**
   * 創建告警規則
   */
  async createRule(input: AlertRuleInput, userId: string): Promise<AlertRule> {
    const rule = await prisma.alertRule.create({
      data: {
        name: input.name,
        description: input.description,
        conditionType: input.conditionType,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold,
        duration: input.duration,
        serviceName: input.serviceName,
        endpoint: input.endpoint,
        severity: input.severity,
        channels: input.channels,
        recipients: input.recipients,
        cooldownMinutes: input.cooldownMinutes || 15,
        cityId: input.cityId,
        createdById: userId,
      },
    });

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ALERT_RULE_CREATE',
        resourceType: 'AlertRule',
        resourceId: rule.id,
        description: `創建告警規則: ${rule.name}`,
        metadata: { severity: input.severity, conditionType: input.conditionType },
      },
    });

    return this.mapToAlertRule(rule);
  }

  /**
   * 更新告警規則
   */
  async updateRule(
    ruleId: string,
    updates: Partial<AlertRuleInput>,
    userId: string
  ): Promise<AlertRule | null> {
    const existing = await prisma.alertRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) return null;

    const rule = await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        name: updates.name,
        description: updates.description,
        conditionType: updates.conditionType,
        metric: updates.metric,
        operator: updates.operator,
        threshold: updates.threshold,
        duration: updates.duration,
        serviceName: updates.serviceName,
        endpoint: updates.endpoint,
        severity: updates.severity,
        channels: updates.channels,
        recipients: updates.recipients,
        cooldownMinutes: updates.cooldownMinutes,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ALERT_RULE_UPDATE',
        resourceType: 'AlertRule',
        resourceId: ruleId,
        description: `更新告警規則: ${rule.name}`,
      },
    });

    return this.mapToAlertRule(rule);
  }

  /**
   * 啟用/停用規則
   */
  async toggleRule(ruleId: string, isActive: boolean, userId: string): Promise<boolean> {
    await prisma.alertRule.update({
      where: { id: ruleId },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: isActive ? 'ALERT_RULE_ENABLE' : 'ALERT_RULE_DISABLE',
        resourceType: 'AlertRule',
        resourceId: ruleId,
        description: `${isActive ? '啟用' : '停用'}告警規則`,
      },
    });

    return true;
  }

  /**
   * 刪除規則
   */
  async deleteRule(ruleId: string, userId: string): Promise<boolean> {
    const rule = await prisma.alertRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) return false;

    await prisma.alertRule.delete({
      where: { id: ruleId },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ALERT_RULE_DELETE',
        resourceType: 'AlertRule',
        resourceId: ruleId,
        description: `刪除告警規則: ${rule.name}`,
      },
    });

    return true;
  }

  /**
   * 獲取規則列表
   */
  async listRules(options: AlertRuleListOptions = {}): Promise<AlertRuleListResult> {
    const {
      isActive,
      severity,
      conditionType,
      cityId,
      page = 1,
      pageSize = 20,
    } = options;

    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (severity) where.severity = severity;
    if (conditionType) where.conditionType = conditionType;
    if (cityId) where.cityId = cityId;

    const [rules, total] = await Promise.all([
      prisma.alertRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: {
            select: { id: true, displayName: true },
          },
          _count: {
            select: { alerts: true },
          },
        },
      }),
      prisma.alertRule.count({ where }),
    ]);

    return {
      items: rules.map(r => this.mapToAlertRule(r)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 獲取規則詳情
   */
  async getRule(ruleId: string): Promise<AlertRule | null> {
    const rule = await prisma.alertRule.findUnique({
      where: { id: ruleId },
      include: {
        createdBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    return rule ? this.mapToAlertRule(rule) : null;
  }

  /**
   * 獲取活躍規則（用於評估）
   */
  async getActiveRules(cityId?: string): Promise<any[]> {
    const where: any = { isActive: true };
    if (cityId) where.cityId = cityId;

    return prisma.alertRule.findMany({ where });
  }

  private mapToAlertRule(rule: any): AlertRule {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description || undefined,
      isActive: rule.isActive,
      conditionType: rule.conditionType as AlertConditionType,
      metric: rule.metric,
      operator: rule.operator as AlertOperator,
      threshold: rule.threshold,
      duration: rule.duration,
      serviceName: rule.serviceName || undefined,
      endpoint: rule.endpoint || undefined,
      severity: rule.severity as AlertSeverity,
      channels: rule.channels as any[],
      recipients: rule.recipients as string[],
      cooldownMinutes: rule.cooldownMinutes,
      cityId: rule.cityId || undefined,
      createdById: rule.createdById,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}

export const alertRuleService = new AlertRuleService();
```

### 6.2 Alert Evaluation Service

```typescript
// lib/services/monitoring/alertEvaluationService.ts
import { prisma } from '@/lib/prisma';
import { AlertConditionType, AlertOperator, AlertStatus, MetricValue } from '@/types/alerts';
import { alertNotificationService } from './alertNotificationService';
import { healthCheckService } from './healthCheckService';

export class AlertEvaluationService {
  /**
   * 評估所有活躍規則
   */
  async evaluateAllRules(): Promise<void> {
    const rules = await prisma.alertRule.findMany({
      where: { isActive: true },
    });

    console.log(`[AlertEvaluation] Evaluating ${rules.length} active rules`);

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (error) {
        console.error(`[AlertEvaluation] Error evaluating rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * 評估單一規則
   */
  async evaluateRule(rule: any): Promise<void> {
    // 獲取當前指標值
    const metric = await this.getMetricValue(rule);

    if (!metric) {
      console.warn(`[AlertEvaluation] Could not get metric value for rule ${rule.id}`);
      return;
    }

    // 檢查是否滿足觸發條件
    const isTriggered = this.checkCondition(
      metric.value,
      rule.operator as AlertOperator,
      rule.threshold
    );

    // 獲取現有的告警
    const existingAlert = await prisma.alert.findFirst({
      where: {
        ruleId: rule.id,
        status: { in: ['FIRING', 'ACKNOWLEDGED'] },
      },
      orderBy: { triggeredAt: 'desc' },
    });

    if (isTriggered) {
      if (!existingAlert) {
        // 檢查冷卻時間
        const canTrigger = await this.checkCooldown(rule);
        if (!canTrigger) {
          console.log(`[AlertEvaluation] Rule ${rule.id} is in cooldown period`);
          return;
        }

        // 創建新告警
        await this.createAlert(rule, metric);
      }
    } else {
      if (existingAlert && existingAlert.status === 'FIRING') {
        // 恢復告警
        await this.recoverAlert(existingAlert.id, metric);
      }
    }
  }

  /**
   * 獲取指標值
   */
  private async getMetricValue(rule: any): Promise<MetricValue | null> {
    const since = new Date(Date.now() - rule.duration * 1000);

    switch (rule.conditionType as AlertConditionType) {
      case AlertConditionType.SERVICE_DOWN:
        return this.getServiceHealthMetric(rule.serviceName!);

      case AlertConditionType.ERROR_RATE:
        return this.getErrorRateMetric(since, rule.endpoint, rule.cityId);

      case AlertConditionType.RESPONSE_TIME:
        return this.getResponseTimeMetric(since, rule.endpoint, rule.cityId);

      case AlertConditionType.QUEUE_BACKLOG:
        return this.getQueueBacklogMetric(rule.cityId);

      case AlertConditionType.STORAGE_LOW:
        return this.getStorageMetric();

      case AlertConditionType.CPU_HIGH:
        return this.getCpuMetric(since);

      case AlertConditionType.MEMORY_HIGH:
        return this.getMemoryMetric(since);

      default:
        return null;
    }
  }

  /**
   * 服務健康指標
   */
  private async getServiceHealthMetric(serviceName: string): Promise<MetricValue> {
    const health = await healthCheckService.getOverallHealth();
    const service = health.services.find(s => s.serviceName === serviceName);

    return {
      value: service?.status === 'HEALTHY' ? 1 : 0,
      timestamp: new Date(),
      details: { serviceName, status: service?.status },
    };
  }

  /**
   * 錯誤率指標
   */
  private async getErrorRateMetric(
    since: Date,
    endpoint?: string | null,
    cityId?: string | null
  ): Promise<MetricValue> {
    const where: any = { timestamp: { gt: since } };
    if (endpoint) where.endpoint = endpoint;
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { statusCode: true },
    });

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() };
    }

    const errors = metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errors / metrics.length) * 100;

    return {
      value: errorRate,
      timestamp: new Date(),
      details: { totalRequests: metrics.length, errors, endpoint },
    };
  }

  /**
   * 回應時間指標 (P95)
   */
  private async getResponseTimeMetric(
    since: Date,
    endpoint?: string | null,
    cityId?: string | null
  ): Promise<MetricValue> {
    const where: any = { timestamp: { gt: since } };
    if (endpoint) where.endpoint = endpoint;
    if (cityId) where.cityId = cityId;

    const metrics = await prisma.apiPerformanceMetric.findMany({
      where,
      select: { responseTime: true },
    });

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() };
    }

    const times = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const p95Index = Math.ceil(0.95 * times.length) - 1;
    const p95 = times[Math.max(0, p95Index)];

    return {
      value: p95,
      timestamp: new Date(),
      details: { sampleSize: metrics.length, endpoint },
    };
  }

  /**
   * 隊列積壓指標
   */
  private async getQueueBacklogMetric(cityId?: string | null): Promise<MetricValue> {
    const where: any = { status: 'PENDING' };
    if (cityId) where.cityId = cityId;

    const pendingTasks = await prisma.document.count({ where });

    return {
      value: pendingTasks,
      timestamp: new Date(),
    };
  }

  /**
   * 儲存空間指標
   */
  private async getStorageMetric(): Promise<MetricValue> {
    // 實際應從 Azure Blob Storage 獲取使用量
    const usedPercent = 50; // 模擬值

    return {
      value: 100 - usedPercent, // 返回剩餘百分比
      timestamp: new Date(),
    };
  }

  /**
   * CPU 指標
   */
  private async getCpuMetric(since: Date): Promise<MetricValue> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { cpuUsage: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() };
    }

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;

    return {
      value: avgCpu,
      timestamp: new Date(),
      details: { sampleSize: metrics.length },
    };
  }

  /**
   * 記憶體指標
   */
  private async getMemoryMetric(since: Date): Promise<MetricValue> {
    const metrics = await prisma.systemResourceMetric.findMany({
      where: { timestamp: { gt: since } },
      select: { memoryUsage: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    if (metrics.length === 0) {
      return { value: 0, timestamp: new Date() };
    }

    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;

    return {
      value: avgMemory,
      timestamp: new Date(),
      details: { sampleSize: metrics.length },
    };
  }

  /**
   * 檢查條件
   */
  private checkCondition(
    value: number,
    operator: AlertOperator,
    threshold: number
  ): boolean {
    switch (operator) {
      case AlertOperator.GREATER_THAN:
        return value > threshold;
      case AlertOperator.GREATER_THAN_EQ:
        return value >= threshold;
      case AlertOperator.LESS_THAN:
        return value < threshold;
      case AlertOperator.LESS_THAN_EQ:
        return value <= threshold;
      case AlertOperator.EQUALS:
        return value === threshold;
      case AlertOperator.NOT_EQUALS:
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * 檢查冷卻時間
   */
  private async checkCooldown(rule: any): Promise<boolean> {
    const lastAlert = await prisma.alert.findFirst({
      where: { ruleId: rule.id },
      orderBy: { triggeredAt: 'desc' },
    });

    if (!lastAlert) return true;

    const cooldownEnd = new Date(
      lastAlert.triggeredAt.getTime() + rule.cooldownMinutes * 60 * 1000
    );

    return new Date() >= cooldownEnd;
  }

  /**
   * 創建告警
   */
  private async createAlert(rule: any, metric: MetricValue): Promise<void> {
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        status: 'FIRING',
        triggeredValue: metric.value,
        details: metric.details,
        metricData: {
          metric: rule.metric,
          threshold: rule.threshold,
          operator: rule.operator,
          duration: rule.duration,
        },
        cityId: rule.cityId,
      },
      include: { rule: true },
    });

    console.log(`[AlertEvaluation] Alert triggered: ${rule.name} (${alert.id})`);

    // 發送通知
    await alertNotificationService.sendAlertNotification(alert as any, 'triggered');
  }

  /**
   * 恢復告警
   */
  private async recoverAlert(alertId: string, metric: MetricValue): Promise<void> {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RECOVERED',
        recoveredAt: new Date(),
      },
      include: { rule: true },
    });

    console.log(`[AlertEvaluation] Alert recovered: ${alert.rule.name} (${alertId})`);

    // 發送恢復通知
    await alertNotificationService.sendAlertNotification(alert as any, 'recovered');
  }
}

export const alertEvaluationService = new AlertEvaluationService();
```

### 6.3 Alert Notification Service

```typescript
// lib/services/monitoring/alertNotificationService.ts
import { prisma } from '@/lib/prisma';
import { AlertSeverity, NotificationChannel } from '@/types/alerts';

interface AlertWithRule {
  id: string;
  status: string;
  triggeredValue: number;
  triggeredAt: Date;
  recoveredAt?: Date | null;
  rule: {
    id: string;
    name: string;
    description?: string | null;
    severity: string;
    metric: string;
    operator: string;
    threshold: number;
    channels: any;
    recipients: any;
  };
}

export class AlertNotificationService {
  /**
   * 發送告警通知
   */
  async sendAlertNotification(
    alert: AlertWithRule,
    type: 'triggered' | 'recovered'
  ): Promise<void> {
    const channels = alert.rule.channels as Array<{
      type: string;
      config: Record<string, any>;
    }>;
    const recipients = alert.rule.recipients as string[];

    const { subject, body } = this.buildNotificationContent(alert, type);

    for (const channel of channels) {
      for (const recipient of recipients) {
        try {
          await this.sendToChannel(channel.type as NotificationChannel, {
            recipient,
            subject,
            body,
            config: { ...channel.config, severity: alert.rule.severity },
          });

          await prisma.alertNotification.create({
            data: {
              alertId: alert.id,
              channel: channel.type as NotificationChannel,
              recipient,
              subject,
              body,
              status: 'SENT',
              sentAt: new Date(),
            },
          });
        } catch (error) {
          console.error(`[AlertNotification] Failed to send to ${channel.type}:`, error);

          await prisma.alertNotification.create({
            data: {
              alertId: alert.id,
              channel: channel.type as NotificationChannel,
              recipient,
              subject,
              body,
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    }
  }

  /**
   * 構建通知內容
   */
  private buildNotificationContent(
    alert: AlertWithRule,
    type: 'triggered' | 'recovered'
  ): { subject: string; body: string } {
    const severityEmoji: Record<string, string> = {
      INFO: 'ℹ️',
      WARNING: '⚠️',
      CRITICAL: '🔴',
      EMERGENCY: '🚨',
    };

    const statusText = type === 'triggered' ? 'TRIGGERED' : 'RECOVERED';
    const statusEmoji = type === 'triggered' ? '🔔' : '✅';

    const subject = `${statusEmoji} [${alert.rule.severity}] ${alert.rule.name} - ${statusText}`;

    const duration = type === 'recovered' && alert.recoveredAt
      ? this.formatDuration(alert.triggeredAt, alert.recoveredAt)
      : null;

    const body = `
${severityEmoji[alert.rule.severity]} **Alert ${statusText}**

**Name:** ${alert.rule.name}
**Severity:** ${alert.rule.severity}
**Condition:** ${alert.rule.metric} ${this.formatOperator(alert.rule.operator)} ${alert.rule.threshold}
**Current Value:** ${alert.triggeredValue.toFixed(2)}
**Triggered At:** ${alert.triggeredAt.toISOString()}
${duration ? `**Duration:** ${duration}` : ''}
${type === 'recovered' ? `**Recovered At:** ${alert.recoveredAt?.toISOString()}` : ''}

${alert.rule.description ? `**Description:** ${alert.rule.description}` : ''}

[View in Dashboard](${process.env.NEXT_PUBLIC_APP_URL}/admin/monitoring/alerts/${alert.id})
    `.trim();

    return { subject, body };
  }

  /**
   * 格式化運算符
   */
  private formatOperator(operator: string): string {
    const map: Record<string, string> = {
      GREATER_THAN: '>',
      GREATER_THAN_EQ: '>=',
      LESS_THAN: '<',
      LESS_THAN_EQ: '<=',
      EQUALS: '=',
      NOT_EQUALS: '!=',
    };
    return map[operator] || operator;
  }

  /**
   * 格式化持續時間
   */
  private formatDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  /**
   * 發送到指定管道
   */
  private async sendToChannel(
    channel: NotificationChannel,
    options: {
      recipient: string;
      subject: string;
      body: string;
      config: Record<string, any>;
    }
  ): Promise<void> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        await this.sendEmail(options);
        break;
      case NotificationChannel.TEAMS:
        await this.sendTeams(options);
        break;
      case NotificationChannel.WEBHOOK:
        await this.sendWebhook(options);
        break;
    }
  }

  /**
   * 發送 Email
   */
  private async sendEmail(options: {
    recipient: string;
    subject: string;
    body: string;
    config: Record<string, any>;
  }): Promise<void> {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@example.com',
      to: options.recipient,
      subject: options.subject,
      text: options.body,
      html: options.body
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
    });
  }

  /**
   * 發送 Microsoft Teams
   */
  private async sendTeams(options: {
    recipient: string;
    subject: string;
    body: string;
    config: Record<string, any>;
  }): Promise<void> {
    const webhookUrl = options.config.webhookUrl || process.env.TEAMS_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error('Teams webhook URL not configured');
    }

    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(options.config.severity),
      summary: options.subject,
      sections: [
        {
          activityTitle: options.subject,
          facts: this.parseBodyToFacts(options.body),
          markdown: true,
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View in Dashboard',
          targets: [
            {
              os: 'default',
              uri: `${process.env.NEXT_PUBLIC_APP_URL}/admin/monitoring/alerts`,
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.status}`);
    }
  }

  /**
   * 發送 Webhook
   */
  private async sendWebhook(options: {
    recipient: string;
    subject: string;
    body: string;
    config: Record<string, any>;
  }): Promise<void> {
    const webhookUrl = options.config.url || options.recipient;

    const response = await fetch(webhookUrl, {
      method: options.config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.config.headers,
      },
      body: JSON.stringify({
        subject: options.subject,
        body: options.body,
        timestamp: new Date().toISOString(),
        severity: options.config.severity,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
  }

  /**
   * 獲取嚴重度顏色
   */
  private getSeverityColor(severity?: string): string {
    const colors: Record<string, string> = {
      INFO: '0076D7',
      WARNING: 'FFA500',
      CRITICAL: 'FF0000',
      EMERGENCY: '8B0000',
    };
    return colors[severity || 'INFO'] || '0076D7';
  }

  /**
   * 解析 body 為 facts
   */
  private parseBodyToFacts(body: string): Array<{ name: string; value: string }> {
    const facts: Array<{ name: string; value: string }> = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const match = line.match(/\*\*(.+?):\*\*\s*(.+)/);
      if (match) {
        facts.push({ name: match[1], value: match[2] });
      }
    }

    return facts;
  }
}

export const alertNotificationService = new AlertNotificationService();
```

### 6.4 Alert Evaluation Job

```typescript
// lib/jobs/alertEvaluationJob.ts
import { alertEvaluationService } from '@/lib/services/monitoring/alertEvaluationService';

export class AlertEvaluationJob {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * 啟動告警評估排程
   */
  start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.warn('[AlertEvaluationJob] Job already running');
      return;
    }

    console.log(`[AlertEvaluationJob] Starting with ${intervalMs}ms interval`);

    // 立即執行一次
    this.runOnce();

    // 定期評估
    this.intervalId = setInterval(async () => {
      await this.runOnce();
    }, intervalMs);
  }

  /**
   * 停止排程
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[AlertEvaluationJob] Job stopped');
    }
  }

  /**
   * 手動觸發評估
   */
  async runOnce(): Promise<void> {
    if (this.isRunning) {
      console.log('[AlertEvaluationJob] Previous evaluation still running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      await alertEvaluationService.evaluateAllRules();
      console.log(`[AlertEvaluationJob] Evaluation completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('[AlertEvaluationJob] Evaluation error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 檢查是否正在運行
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }
}

export const alertEvaluationJob = new AlertEvaluationJob();
```

---

## 7. UI Components

### 7.1 Alert Rule Management Component

```typescript
// components/admin/alerts/AlertRuleManagement.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AlertConditionType, AlertSeverity, AlertOperator } from '@/types/alerts';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  conditionType: string;
  metric: string;
  operator: string;
  threshold: number;
  duration: number;
  severity: string;
  channels: any[];
  recipients: string[];
  cooldownMinutes: number;
  createdAt: string;
  _count?: { alerts: number };
}

const CONDITION_LABELS: Record<string, string> = {
  SERVICE_DOWN: '服務不可用',
  ERROR_RATE: '錯誤率',
  RESPONSE_TIME: '回應時間',
  QUEUE_BACKLOG: '隊列積壓',
  STORAGE_LOW: '儲存空間不足',
  CPU_HIGH: 'CPU 使用率高',
  MEMORY_HIGH: '記憶體使用率高',
  CUSTOM_METRIC: '自定義指標',
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  INFO: { label: '資訊', color: 'bg-blue-100 text-blue-600', icon: 'ℹ️' },
  WARNING: { label: '警告', color: 'bg-yellow-100 text-yellow-600', icon: '⚠️' },
  CRITICAL: { label: '嚴重', color: 'bg-red-100 text-red-600', icon: '🔴' },
  EMERGENCY: { label: '緊急', color: 'bg-red-200 text-red-800', icon: '🚨' },
};

const OPERATOR_LABELS: Record<string, string> = {
  GREATER_THAN: '>',
  GREATER_THAN_EQ: '>=',
  LESS_THAN: '<',
  LESS_THAN_EQ: '<=',
  EQUALS: '=',
  NOT_EQUALS: '!=',
};

export function AlertRuleManagement() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [filter, setFilter] = useState<{
    severity?: string;
    isActive?: boolean;
  }>({});

  useEffect(() => {
    fetchRules();
  }, [filter]);

  const fetchRules = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.severity) params.set('severity', filter.severity);
      if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));

      const response = await fetch(`/api/admin/alerts/rules?${params}`);
      const data = await response.json();
      setRules(data.data.items);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/alerts/rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        fetchRules();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('確定要刪除此告警規則嗎？')) return;

    try {
      const response = await fetch(`/api/admin/alerts/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchRules();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">告警規則管理</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新增規則
        </button>
      </div>

      {/* 篩選器 */}
      <div className="flex gap-4 mb-6">
        <select
          value={filter.severity || ''}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">所有級別</option>
          {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.icon} {config.label}</option>
          ))}
        </select>

        <select
          value={filter.isActive === undefined ? '' : String(filter.isActive)}
          onChange={(e) => setFilter({
            ...filter,
            isActive: e.target.value === '' ? undefined : e.target.value === 'true'
          })}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">所有狀態</option>
          <option value="true">啟用中</option>
          <option value="false">已停用</option>
        </select>
      </div>

      {/* 規則列表 */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onToggle={() => handleToggleRule(rule.id, rule.isActive)}
            onEdit={() => setEditingRule(rule)}
            onDelete={() => handleDeleteRule(rule.id)}
          />
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          暫無告警規則，點擊上方按鈕新增
        </div>
      )}

      {/* 創建/編輯對話框 */}
      {(showCreateModal || editingRule) && (
        <AlertRuleModal
          rule={editingRule}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRule(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingRule(null);
            fetchRules();
          }}
        />
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: AlertRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RuleCard({ rule, onToggle, onEdit, onDelete }: RuleCardProps) {
  const severityConfig = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.INFO;

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${!rule.isActive ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{severityConfig.icon}</span>
            <h3 className="font-medium text-lg">{rule.name}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${severityConfig.color}`}>
              {severityConfig.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              rule.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {rule.isActive ? '啟用中' : '已停用'}
            </span>
          </div>

          {rule.description && (
            <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
          )}

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">條件類型:</span>
              <span className="ml-1">{CONDITION_LABELS[rule.conditionType]}</span>
            </div>
            <div>
              <span className="text-gray-400">閾值:</span>
              <span className="ml-1 font-mono">
                {rule.metric} {OPERATOR_LABELS[rule.operator]} {rule.threshold}
              </span>
            </div>
            <div>
              <span className="text-gray-400">持續時間:</span>
              <span className="ml-1">{rule.duration}秒</span>
            </div>
            <div>
              <span className="text-gray-400">冷卻時間:</span>
              <span className="ml-1">{rule.cooldownMinutes}分鐘</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-400">通知管道:</span>
              <span className="ml-1">
                {rule.channels.map(c => c.type).join(', ')}
              </span>
            </div>
            <div>
              <span className="text-gray-400">觸發次數:</span>
              <span className="ml-1">{rule._count?.alerts || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onToggle}
            className={`px-3 py-1 rounded text-sm ${
              rule.isActive
                ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                : 'bg-green-100 text-green-600 hover:bg-green-200'
            }`}
          >
            {rule.isActive ? '停用' : '啟用'}
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            編輯
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded text-sm"
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  );
}

interface AlertRuleModalProps {
  rule: AlertRule | null;
  onClose: () => void;
  onSaved: () => void;
}

function AlertRuleModal({ rule, onClose, onSaved }: AlertRuleModalProps) {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    conditionType: rule?.conditionType || 'ERROR_RATE',
    metric: rule?.metric || 'error_rate',
    operator: rule?.operator || 'GREATER_THAN',
    threshold: rule?.threshold || 5,
    duration: rule?.duration || 300,
    severity: rule?.severity || 'WARNING',
    channels: rule?.channels || [{ type: 'EMAIL', config: {} }],
    recipients: rule?.recipients || [],
    cooldownMinutes: rule?.cooldownMinutes || 15,
  });
  const [recipientInput, setRecipientInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = rule
        ? `/api/admin/alerts/rules/${rule.id}`
        : '/api/admin/alerts/rules';
      const method = rule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSaved();
      } else {
        const data = await response.json();
        alert(`儲存失敗: ${data.error?.message || '未知錯誤'}`);
      }
    } catch (error) {
      alert('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const addRecipient = () => {
    if (recipientInput && !formData.recipients.includes(recipientInput)) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, recipientInput],
      });
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(r => r !== email),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-4">
          {rule ? '編輯告警規則' : '新增告警規則'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">規則名稱 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
                className="w-full px-3 py-2 border rounded"
                placeholder="例: API 錯誤率告警"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 border rounded"
                placeholder="告警規則的詳細描述..."
              />
            </div>
          </div>

          {/* 觸發條件 */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">觸發條件</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">條件類型 *</label>
                <select
                  value={formData.conditionType}
                  onChange={(e) => setFormData({ ...formData, conditionType: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">指標名稱 *</label>
                <input
                  type="text"
                  value={formData.metric}
                  onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="error_rate"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">運算符 *</label>
                <select
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">閾值 *</label>
                <input
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                  required
                  step="any"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">持續時間 (秒) *</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  required
                  min={30}
                  max={3600}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">告警級別 *</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.icon} {config.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 通知設定 */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">通知設定</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">通知管道</label>
              <div className="flex gap-4">
                {['EMAIL', 'TEAMS', 'WEBHOOK'].map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.channels.some(c => c.type === type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            channels: [...formData.channels, { type, config: {} }],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            channels: formData.channels.filter(c => c.type !== type),
                          });
                        }
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">通知對象</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded"
                  placeholder="輸入 Email 地址"
                />
                <button
                  type="button"
                  onClick={addRecipient}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  新增
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.recipients.map((email) => (
                  <span
                    key={email}
                    className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">冷卻時間 (分鐘)</label>
              <input
                type="number"
                value={formData.cooldownMinutes}
                onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) })}
                min={5}
                max={1440}
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">同一告警再次觸發的最小間隔</p>
            </div>
          </div>

          {/* 按鈕 */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded disabled:opacity-50"
            >
              {submitting ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AlertRuleManagement;
```

---

## 8. API Routes Implementation

### 8.1 Alert Rules Routes

```typescript
// app/api/admin/alerts/rules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertRuleService } from '@/lib/services/monitoring/alertRuleService';
import { z } from 'zod';

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  conditionType: z.enum([
    'SERVICE_DOWN', 'ERROR_RATE', 'RESPONSE_TIME',
    'QUEUE_BACKLOG', 'STORAGE_LOW', 'CPU_HIGH', 'MEMORY_HIGH', 'CUSTOM_METRIC'
  ]),
  metric: z.string().min(1),
  operator: z.enum([
    'GREATER_THAN', 'GREATER_THAN_EQ', 'LESS_THAN',
    'LESS_THAN_EQ', 'EQUALS', 'NOT_EQUALS'
  ]),
  threshold: z.number(),
  duration: z.number().min(30).max(3600),
  serviceName: z.string().optional(),
  endpoint: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']),
  channels: z.array(z.object({
    type: z.enum(['EMAIL', 'TEAMS', 'WEBHOOK']),
    config: z.record(z.any()),
  })).min(1),
  recipients: z.array(z.string()).min(1),
  cooldownMinutes: z.number().min(5).max(1440).optional(),
  cityId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const options = {
      isActive: searchParams.get('isActive') === 'true' ? true :
                searchParams.get('isActive') === 'false' ? false : undefined,
      severity: searchParams.get('severity') as any || undefined,
      conditionType: searchParams.get('conditionType') as any || undefined,
      cityId: searchParams.get('cityId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '20'), 100),
    };

    const result = await alertRuleService.listRules(options);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('List alert rules error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list alert rules' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createRuleSchema.parse(body);

    const rule = await alertRuleService.createRule(validated as any, session.user.id);

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    console.error('Create alert rule error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create alert rule' } },
      { status: 500 }
    );
  }
}
```

### 8.2 Alert List and Actions Routes

```typescript
// app/api/admin/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

    const where: any = {};
    if (status) where.status = status;
    if (severity) where.rule = { severity };

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              severity: true,
              conditionType: true,
            },
          },
        },
      }),
      prisma.alert.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        items: alerts.map(a => ({
          id: a.id,
          ruleId: a.ruleId,
          ruleName: a.rule.name,
          severity: a.rule.severity,
          conditionType: a.rule.conditionType,
          status: a.status,
          triggeredValue: a.triggeredValue,
          triggeredAt: a.triggeredAt.toISOString(),
          recoveredAt: a.recoveredAt?.toISOString(),
          acknowledgedAt: a.acknowledgedAt?.toISOString(),
          acknowledgedBy: a.acknowledgedBy,
          resolvedAt: a.resolvedAt?.toISOString(),
          resolution: a.resolution,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('List alerts error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list alerts' } },
      { status: 500 }
    );
  }
}

// app/api/admin/alerts/[id]/acknowledge/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
    });

    if (!alert) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    if (alert.status !== 'FIRING') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: 'Alert cannot be acknowledged' } },
        { status: 400 }
      );
    }

    const updated = await prisma.alert.update({
      where: { id: params.id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: session.user.id,
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.status,
        acknowledgedAt: updated.acknowledgedAt?.toISOString(),
        acknowledgedBy: session.user.displayName,
      },
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to acknowledge alert' } },
      { status: 500 }
    );
  }
}

// app/api/admin/alerts/[id]/resolve/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resolution } = body;

    if (!resolution || typeof resolution !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Resolution is required' } },
        { status: 400 }
      );
    }

    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
    });

    if (!alert) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    if (!['FIRING', 'ACKNOWLEDGED'].includes(alert.status)) {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: 'Alert cannot be resolved' } },
        { status: 400 }
      );
    }

    const updated = await prisma.alert.update({
      where: { id: params.id },
      data: {
        status: 'RESOLVED',
        resolvedBy: session.user.id,
        resolvedAt: new Date(),
        resolution,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt?.toISOString(),
        resolvedBy: session.user.displayName,
        resolution: updated.resolution,
      },
    });
  } catch (error) {
    console.error('Resolve alert error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve alert' } },
      { status: 500 }
    );
  }
}
```

---

## 9. Test Plan

### 9.1 Unit Tests

```typescript
// __tests__/services/monitoring/alertEvaluationService.test.ts
import { alertEvaluationService } from '@/lib/services/monitoring/alertEvaluationService';
import { prismaMock } from '@/lib/__mocks__/prisma';
import { AlertOperator } from '@/types/alerts';

describe('AlertEvaluationService', () => {
  describe('checkCondition', () => {
    const testCases = [
      { value: 100, operator: 'GREATER_THAN', threshold: 50, expected: true },
      { value: 50, operator: 'GREATER_THAN', threshold: 100, expected: false },
      { value: 50, operator: 'GREATER_THAN_EQ', threshold: 50, expected: true },
      { value: 30, operator: 'LESS_THAN', threshold: 50, expected: true },
      { value: 50, operator: 'LESS_THAN_EQ', threshold: 50, expected: true },
      { value: 50, operator: 'EQUALS', threshold: 50, expected: true },
      { value: 50, operator: 'NOT_EQUALS', threshold: 100, expected: true },
    ];

    testCases.forEach(({ value, operator, threshold, expected }) => {
      it(`should return ${expected} for ${value} ${operator} ${threshold}`, () => {
        const result = alertEvaluationService['checkCondition'](
          value,
          operator as AlertOperator,
          threshold
        );
        expect(result).toBe(expected);
      });
    });
  });

  describe('evaluateRule', () => {
    it('should create alert when condition is met and no existing alert', async () => {
      const rule = {
        id: 'rule-1',
        name: 'High Error Rate',
        conditionType: 'ERROR_RATE',
        metric: 'api_error_rate',
        operator: 'GREATER_THAN',
        threshold: 5,
        duration: 300,
        cooldownMinutes: 15,
        severity: 'CRITICAL',
        channels: [{ type: 'EMAIL', config: {} }],
        recipients: ['admin@example.com'],
      };

      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { statusCode: 500 },
        { statusCode: 500 },
        { statusCode: 200 },
      ] as any);

      prismaMock.alert.findFirst.mockResolvedValue(null);
      prismaMock.alert.create.mockResolvedValue({
        id: 'alert-1',
        rule,
      } as any);

      await alertEvaluationService.evaluateRule(rule);

      expect(prismaMock.alert.create).toHaveBeenCalled();
    });

    it('should not create alert when in cooldown period', async () => {
      const rule = {
        id: 'rule-1',
        conditionType: 'ERROR_RATE',
        operator: 'GREATER_THAN',
        threshold: 5,
        duration: 300,
        cooldownMinutes: 15,
      };

      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { statusCode: 500 },
        { statusCode: 500 },
      ] as any);

      prismaMock.alert.findFirst
        .mockResolvedValueOnce(null) // No existing firing alert
        .mockResolvedValueOnce({
          id: 'old-alert',
          triggeredAt: new Date(), // Recent alert - in cooldown
        } as any);

      await alertEvaluationService.evaluateRule(rule);

      expect(prismaMock.alert.create).not.toHaveBeenCalled();
    });

    it('should recover alert when condition no longer met', async () => {
      const rule = {
        id: 'rule-1',
        conditionType: 'ERROR_RATE',
        operator: 'GREATER_THAN',
        threshold: 5,
        duration: 300,
      };

      prismaMock.apiPerformanceMetric.findMany.mockResolvedValue([
        { statusCode: 200 },
        { statusCode: 200 },
      ] as any);

      prismaMock.alert.findFirst.mockResolvedValue({
        id: 'alert-1',
        status: 'FIRING',
      } as any);

      prismaMock.alert.update.mockResolvedValue({
        id: 'alert-1',
        status: 'RECOVERED',
        rule: { name: 'Test Rule' },
      } as any);

      await alertEvaluationService.evaluateRule(rule);

      expect(prismaMock.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert-1' },
          data: expect.objectContaining({
            status: 'RECOVERED',
          }),
        })
      );
    });
  });
});

// __tests__/services/monitoring/alertRuleService.test.ts
import { alertRuleService } from '@/lib/services/monitoring/alertRuleService';
import { prismaMock } from '@/lib/__mocks__/prisma';

describe('AlertRuleService', () => {
  describe('createRule', () => {
    it('should create alert rule with valid input', async () => {
      const input = {
        name: 'Test Rule',
        conditionType: 'ERROR_RATE' as any,
        metric: 'error_rate',
        operator: 'GREATER_THAN' as any,
        threshold: 5,
        duration: 300,
        severity: 'WARNING' as any,
        channels: [{ type: 'EMAIL', config: {} }],
        recipients: ['admin@example.com'],
      };

      prismaMock.alertRule.create.mockResolvedValue({
        id: 'rule-1',
        ...input,
        isActive: true,
        cooldownMinutes: 15,
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      prismaMock.auditLog.create.mockResolvedValue({} as any);

      const result = await alertRuleService.createRule(input, 'user-1');

      expect(result.id).toBe('rule-1');
      expect(result.name).toBe('Test Rule');
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('toggleRule', () => {
    it('should toggle rule active status', async () => {
      prismaMock.alertRule.update.mockResolvedValue({
        id: 'rule-1',
        isActive: false,
      } as any);

      prismaMock.auditLog.create.mockResolvedValue({} as any);

      const result = await alertRuleService.toggleRule('rule-1', false, 'user-1');

      expect(result).toBe(true);
      expect(prismaMock.alertRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { isActive: false },
      });
    });
  });
});
```

### 9.2 Integration Tests

```typescript
// __tests__/integration/alerts.test.ts
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/admin/alerts/rules/route';

describe('Alert Rules API', () => {
  describe('GET /api/admin/alerts/rules', () => {
    it('should return paginated rules', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/admin/alerts/rules?page=1&pageSize=10',
      });

      // Mock session
      jest.mock('next-auth', () => ({
        getServerSession: jest.fn(() => ({
          user: { id: 'admin-1', role: 'ADMIN' },
        })),
      }));

      const response = await GET(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('items');
      expect(data.data).toHaveProperty('total');
    });

    it('should filter by severity', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/alerts/rules?severity=CRITICAL',
      });

      const response = await GET(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      data.data.items.forEach((rule: any) => {
        expect(rule.severity).toBe('CRITICAL');
      });
    });
  });

  describe('POST /api/admin/alerts/rules', () => {
    it('should create rule with valid input', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Rule',
          conditionType: 'ERROR_RATE',
          metric: 'error_rate',
          operator: 'GREATER_THAN',
          threshold: 5,
          duration: 300,
          severity: 'WARNING',
          channels: [{ type: 'EMAIL', config: {} }],
          recipients: ['test@example.com'],
        },
      });

      const response = await POST(req as any);

      expect(response.status).toBe(201);
    });

    it('should reject invalid input', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          name: '', // Invalid: empty name
          conditionType: 'ERROR_RATE',
        },
      });

      const response = await POST(req as any);

      expect(response.status).toBe(400);
    });
  });
});
```

### 9.3 E2E Tests

```typescript
// e2e/alerts.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Alert Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/monitoring/alerts');
  });

  test('should display alert rules list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('告警規則管理');
    await expect(page.locator('[data-testid="rule-card"]')).toBeVisible();
  });

  test('should create new alert rule', async ({ page }) => {
    await page.click('button:has-text("新增規則")');

    await page.fill('input[name="name"]', 'E2E Test Rule');
    await page.selectOption('select[name="conditionType"]', 'ERROR_RATE');
    await page.fill('input[name="threshold"]', '10');
    await page.selectOption('select[name="severity"]', 'WARNING');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button:has-text("新增")');

    await page.click('button:has-text("儲存")');

    await expect(page.locator('text=E2E Test Rule')).toBeVisible();
  });

  test('should toggle rule status', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="rule-card"]').first()
      .locator('button:has-text("停用")');

    await toggleButton.click();

    await expect(page.locator('[data-testid="rule-card"]').first()
      .locator('text=已停用')).toBeVisible();
  });

  test('should acknowledge firing alert', async ({ page }) => {
    await page.goto('/admin/monitoring/alerts/history');

    const firingAlert = page.locator('[data-testid="alert-row"]')
      .filter({ hasText: 'FIRING' })
      .first();

    await firingAlert.locator('button:has-text("確認")').click();

    await expect(firingAlert.locator('text=ACKNOWLEDGED')).toBeVisible();
  });
});
```

---

## 10. Security Considerations

### 10.1 Access Control
- 所有告警管理 API 需要 ADMIN 或 SUPER_USER 角色
- 告警規則的創建、編輯、刪除需記錄審計日誌
- 敏感的 Webhook URL 和 API Key 應加密存儲

### 10.2 Rate Limiting
- 告警評估服務應有防抖機制（cooldown）
- 通知發送應有頻率限制，避免告警風暴

### 10.3 Input Validation
- 所有 API 輸入使用 Zod schema 驗證
- Webhook URL 需驗證格式
- 閾值範圍應合理限制

---

## 11. Deployment Configuration

### 11.1 Environment Variables
```env
# Alert Notification
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=alerts@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=alerts@example.com

TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...

# Alert Evaluation
ALERT_EVALUATION_INTERVAL_MS=60000
```

### 11.2 Service Initialization
```typescript
// app/api/startup.ts
import { alertEvaluationJob } from '@/lib/jobs/alertEvaluationJob';

// 在應用啟動時初始化告警評估任務
if (process.env.NODE_ENV === 'production') {
  alertEvaluationJob.start(
    parseInt(process.env.ALERT_EVALUATION_INTERVAL_MS || '60000')
  );
}
```

---

## 12. Appendix

### 12.1 Condition Type Reference
| Type | Metric | Unit | Typical Threshold |
|------|--------|------|-------------------|
| SERVICE_DOWN | health_status | 0/1 | < 1 |
| ERROR_RATE | error_percentage | % | > 5% |
| RESPONSE_TIME | p95_latency | ms | > 1000ms |
| QUEUE_BACKLOG | pending_count | count | > 100 |
| STORAGE_LOW | available_percent | % | < 10% |
| CPU_HIGH | cpu_usage | % | > 80% |
| MEMORY_HIGH | memory_usage | % | > 85% |

### 12.2 Severity Level Guidelines
| Severity | Response Time | Example |
|----------|---------------|---------|
| INFO | Next business day | Routine metrics |
| WARNING | Within 4 hours | Performance degradation |
| CRITICAL | Within 1 hour | Service partial outage |
| EMERGENCY | Immediate | Complete service failure |

### 12.3 Related Stories
- Story 12-1: System Health Monitoring Dashboard
- Story 12-2: Performance Metrics Tracking
- Story 12-7: System Log Query
