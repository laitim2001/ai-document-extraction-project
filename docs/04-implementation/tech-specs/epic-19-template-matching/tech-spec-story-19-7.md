# Tech Spec: Story 19.7 - 批量文件自動匹配到模版

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-7

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 19.7 |
| **Epic** | Epic 19 - 數據模版匹配與輸出 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 19-3 |

---

## Objective

整合文件處理流程，實現自動和手動將處理完的文件匹配到數據模版。

---

## Implementation Guide

### Phase 1: 數據模型更新

```prisma
model Document {
  // ... 現有欄位

  // 新增：模版匹配
  templateInstanceId    String?   @map("template_instance_id")
  templateInstance      TemplateInstance? @relation(fields: [templateInstanceId], references: [id])
  templateMatchedAt     DateTime? @map("template_matched_at")
}

model DocumentFormat {
  // ... 現有欄位

  // 新增：預設模版
  defaultTemplateId     String?   @map("default_template_id")
  defaultTemplate       DataTemplate? @relation("FormatDefaultTemplate", fields: [defaultTemplateId], references: [id])
}

model Company {
  // ... 現有欄位

  // 新增：預設模版
  defaultTemplateId     String?   @map("default_template_id")
  defaultTemplate       DataTemplate? @relation("CompanyDefaultTemplate", fields: [defaultTemplateId], references: [id])
}
```

### Phase 2: 自動匹配服務

```typescript
// src/services/auto-template-matching.service.ts

export class AutoTemplateMatchingService {
  /**
   * 解析預設模版
   * 優先級：FORMAT > COMPANY > GLOBAL
   */
  async resolveDefaultTemplate(
    companyId: string,
    formatId?: string
  ): Promise<DataTemplate | null> {
    // 1. FORMAT 級別
    if (formatId) {
      const format = await prisma.documentFormat.findUnique({
        where: { id: formatId },
        include: { defaultTemplate: true },
      });
      if (format?.defaultTemplate) return format.defaultTemplate;
    }

    // 2. COMPANY 級別
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { defaultTemplate: true },
    });
    if (company?.defaultTemplate) return company.defaultTemplate;

    // 3. GLOBAL 級別
    return this.getGlobalDefaultTemplate();
  }

  /**
   * 自動匹配（處理完成後調用）
   */
  async autoMatch(documentId: string): Promise<MatchResult | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { companyId: true, documentFormatId: true },
    });

    if (!document?.companyId) return null;

    const template = await this.resolveDefaultTemplate(
      document.companyId,
      document.documentFormatId || undefined
    );

    if (!template) return null;

    const instance = await this.getOrCreateInstance(template.id);

    const engine = new TemplateMatchingEngineService();
    return engine.matchDocuments({
      documentIds: [documentId],
      templateInstanceId: instance.id,
    });
  }

  /**
   * 批量手動匹配
   */
  async batchMatch(params: BatchMatchParams): Promise<BatchMatchResult>;
}
```

### Phase 3: API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/v1/documents/match | 批量匹配 |
| POST | /api/v1/documents/:id/match | 單一文件匹配 |
| POST | /api/v1/documents/:id/unmatch | 取消匹配 |

### Phase 4: UI 組件

```typescript
// MatchToTemplateDialog - 手動選擇模版
interface MatchToTemplateDialogProps {
  documentIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: (result: MatchResult) => void;
}

// BulkMatchDialog - 批量匹配
interface BulkMatchDialogProps {
  documentIds: string[];  // 最多 500 個
  open: boolean;
  onClose: () => void;
}

// DefaultTemplateSelector - 預設模版選擇器
interface DefaultTemplateSelectorProps {
  value?: string;
  onChange: (templateId: string | null) => void;
}
```

---

## File Structure

```
prisma/schema.prisma  # 更新

src/
├── services/auto-template-matching.service.ts
├── app/api/v1/documents/
│   ├── match/route.ts
│   └── [id]/
│       ├── match/route.ts
│       └── unmatch/route.ts
└── components/features/documents/
    ├── MatchToTemplateDialog.tsx
    ├── BulkMatchDialog.tsx
    └── MatchStatusBadge.tsx
```

---

## Testing Checklist

- [ ] 自動匹配規則解析正確
- [ ] FORMAT > COMPANY > GLOBAL 優先級正確
- [ ] 單一文件匹配正常
- [ ] 批量匹配正常
- [ ] 取消匹配正常
- [ ] Document.templateInstanceId 正確更新
