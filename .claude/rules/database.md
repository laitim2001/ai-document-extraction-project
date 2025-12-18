---
paths: prisma/**/*
---

# 資料庫規範

## Prisma Schema 命名規範

```prisma
// 模型名稱: PascalCase 單數
model Document {
  // --- 主鍵 ---
  id            String   @id @default(cuid())

  // --- 業務欄位（camelCase）---
  fileName      String   @map("file_name")
  fileType      String   @map("file_type")
  status        DocumentStatus @default(PENDING)

  // --- 時間戳 ---
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // --- 關聯 ---
  forwarderId   String   @map("forwarder_id")
  forwarder     Forwarder @relation(fields: [forwarderId], references: [id])

  // --- 索引 ---
  @@index([status])
  @@index([forwarderId])

  // --- 表名映射（snake_case 複數）---
  @@map("documents")
}

enum DocumentStatus {
  PENDING
  PROCESSING
  COMPLETED
  ERROR
}
```

## 欄位命名對照

| TypeScript | Database | 說明 |
|------------|----------|------|
| `camelCase` | `snake_case` | 使用 `@map()` |
| `createdAt` | `created_at` | 時間戳 |
| `userId` | `user_id` | 外鍵 |

## 遷移命名

```bash
# 格式: 動作_對象_描述
npx prisma migrate dev --name create_documents_table
npx prisma migrate dev --name add_status_to_documents
npx prisma migrate dev --name add_index_on_forwarder_id
```

## 關聯設計

```prisma
// 一對多
model User {
  documents Document[]
}

model Document {
  userId    String @map("user_id")
  user      User   @relation(fields: [userId], references: [id])
}

// 級聯刪除
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

// 設為 NULL
user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
```

## 索引策略

```prisma
// 單欄位索引
@@index([status])

// 複合索引
@@index([forwarderId, status])

// 唯一索引
@@unique([email])
```

## 常用查詢模式

```typescript
// 分頁查詢
const documents = await prisma.document.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});

// 包含關聯
const document = await prisma.document.findUnique({
  where: { id },
  include: { forwarder: true },
});

// 事務
await prisma.$transaction([
  prisma.document.update(...),
  prisma.auditLog.create(...),
]);
```

## 相關文件
- Schema: `prisma/schema.prisma`
- 客戶端: `src/lib/prisma.ts`
- 遷移: `prisma/migrations/`
