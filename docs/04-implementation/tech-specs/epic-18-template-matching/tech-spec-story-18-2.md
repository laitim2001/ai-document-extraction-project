# Tech Spec: Story 18.2 - Template Instance 數據模型與管理服務

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-2

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 18.2 |
| **Epic** | Epic 18 - 數據模版匹配與輸出 |
| **Estimated Effort** | 6 Story Points |
| **Dependencies** | Story 18-1 |
| **Blocking** | Story 18-3, 18-5, 18-6 |

---

## Objective

建立 TemplateInstance 和 TemplateInstanceRow 數據模型，用於存儲填充後的模版數據。

---

## Implementation Guide

### Phase 1: Prisma Schema

```prisma
enum TemplateInstanceStatus {
  DRAFT
  PROCESSING
  COMPLETED
  EXPORTED
  ERROR
}

enum TemplateInstanceRowStatus {
  PENDING
  VALID
  INVALID
  SKIPPED
}

model TemplateInstance {
  id                String    @id @default(cuid())
  dataTemplateId    String    @map("data_template_id")
  dataTemplate      DataTemplate @relation(fields: [dataTemplateId], references: [id])
  name              String
  description       String?
  status            TemplateInstanceStatus @default(DRAFT)
  rowCount          Int       @default(0) @map("row_count")
  validRowCount     Int       @default(0) @map("valid_row_count")
  errorRowCount     Int       @default(0) @map("error_row_count")
  rows              TemplateInstanceRow[]
  exportedAt        DateTime? @map("exported_at")
  exportedBy        String?   @map("exported_by")
  exportFormat      String?   @map("export_format")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  createdBy         String?   @map("created_by")

  @@index([dataTemplateId])
  @@index([status])
  @@index([createdAt])
  @@map("template_instances")
}

model TemplateInstanceRow {
  id                    String    @id @default(cuid())
  templateInstanceId    String    @map("template_instance_id")
  templateInstance      TemplateInstance @relation(fields: [templateInstanceId], references: [id], onDelete: Cascade)
  rowKey                String    @map("row_key")
  rowIndex              Int       @map("row_index")
  sourceDocumentIds     String[]  @map("source_document_ids")
  fieldValues           Json      @map("field_values")
  validationErrors      Json?     @map("validation_errors")
  status                TemplateInstanceRowStatus @default(PENDING)
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  @@unique([templateInstanceId, rowKey])
  @@index([templateInstanceId])
  @@index([status])
  @@map("template_instance_rows")
}
```

### Phase 2: 類型定義

```typescript
// src/types/template-instance.ts

export type TemplateInstanceStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'EXPORTED' | 'ERROR';
export type TemplateInstanceRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SKIPPED';

export interface TemplateInstance {
  id: string;
  dataTemplateId: string;
  name: string;
  description?: string | null;
  status: TemplateInstanceStatus;
  rowCount: number;
  validRowCount: number;
  errorRowCount: number;
  exportedAt?: string | null;
  exportedBy?: string | null;
  exportFormat?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export interface TemplateInstanceRow {
  id: string;
  templateInstanceId: string;
  rowKey: string;
  rowIndex: number;
  sourceDocumentIds: string[];
  fieldValues: Record<string, unknown>;
  validationErrors?: Record<string, string> | null;
  status: TemplateInstanceRowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: Record<string, string>;
}
```

### Phase 3: 服務層核心方法

```typescript
// src/services/template-instance.service.ts

export class TemplateInstanceService {
  // CRUD
  async list(filters, page, limit): Promise<{ instances: TemplateInstanceSummary[]; total: number }>;
  async getById(id: string): Promise<TemplateInstance | null>;
  async create(input: CreateTemplateInstanceInput): Promise<TemplateInstance>;
  async update(id: string, input: UpdateTemplateInstanceInput): Promise<TemplateInstance>;
  async delete(id: string): Promise<void>;

  // 行管理
  async getRows(instanceId: string, page, limit, filters): Promise<{ rows: TemplateInstanceRow[]; total: number }>;
  async addRow(instanceId: string, input: AddRowInput): Promise<TemplateInstanceRow>;
  async updateRow(rowId: string, input: UpdateRowInput): Promise<TemplateInstanceRow>;
  async deleteRow(rowId: string): Promise<void>;

  // 驗證
  async validateRow(row: TemplateInstanceRow, templateFields: DataTemplateField[]): Promise<ValidationResult>;
  async validateAllRows(instanceId: string): Promise<{ valid: number; invalid: number }>;

  // 統計
  async updateStatistics(instanceId: string): Promise<void>;

  // 狀態管理
  async changeStatus(instanceId: string, newStatus: TemplateInstanceStatus): Promise<void>;
}
```

### Phase 4: API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/v1/template-instances | 列表 |
| POST | /api/v1/template-instances | 創建 |
| GET | /api/v1/template-instances/:id | 詳情 |
| PATCH | /api/v1/template-instances/:id | 更新 |
| DELETE | /api/v1/template-instances/:id | 刪除 |
| GET | /api/v1/template-instances/:id/rows | 行列表 |
| POST | /api/v1/template-instances/:id/rows | 添加行 |
| PATCH | /api/v1/template-instances/:id/rows/:rowId | 更新行 |
| DELETE | /api/v1/template-instances/:id/rows/:rowId | 刪除行 |

---

## File Structure

```
src/
├── types/template-instance.ts
├── validations/template-instance.ts
├── services/template-instance.service.ts
├── hooks/use-template-instances.ts
└── app/api/v1/template-instances/
    ├── route.ts
    ├── [id]/route.ts
    └── [id]/rows/
        ├── route.ts
        └── [rowId]/route.ts
```

---

## Testing Checklist

- [ ] TemplateInstance CRUD 正常
- [ ] TemplateInstanceRow CRUD 正常
- [ ] 行驗證邏輯正確
- [ ] 統計數據自動更新
- [ ] 狀態轉換正確
