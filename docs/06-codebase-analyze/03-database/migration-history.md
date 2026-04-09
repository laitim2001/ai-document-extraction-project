# Migration History & Schema Statistics

> Generated: 2026-04-09 | Source: `prisma/migrations/` and `prisma/schema.prisma`

---

## Migration Timeline

| # | Date | Migration Name | Description |
|---|------|---------------|-------------|
| 1 | 2025-12-18 03:15 | `add_rbac_tables` | User, Account, Session, VerificationToken, Role, UserRole |
| 2 | 2025-12-18 03:42 | `add_city_model` | City model for multi-city support |
| 3 | 2025-12-18 07:54 | `add_document_model` | Document core model |
| 4 | 2025-12-18 08:38 | `add_ocr_result` | OcrResult model for OCR extraction |
| 5 | 2025-12-18 08:53 | `add_forwarder_identification` | Forwarder + ForwarderIdentification |
| 6 | 2025-12-18 09:13 | `add_mapping_rules_and_extraction_results` | MappingRule, ExtractionResult, FieldCorrectionHistory |
| 7 | 2025-12-18 09:58 | `add_processing_queue` | ProcessingQueue model |
| 8 | 2025-12-18 15:43 | `add_story_3_6_correction_type_and_rule_suggestion` | Correction, CorrectionPattern, RuleSuggestion, RuleVersion, etc. |
| 9 | 2025-12-18 16:05 | `add_story_3_7_escalation_model` | Escalation model |
| 10 | 2025-12-19 01:00 | `add_multi_city_support` | UserCityAccess, multi-city RBAC |

**Note**: Only 10 migrations are present in the repository. The schema has evolved significantly beyond these initial migrations (from 6 models to 122), indicating that later schema changes were applied via `prisma migrate dev` or `prisma db push` without creating numbered migration directories, or migrations were squashed/consolidated.

---

## Schema Statistics

### Overall Counts

| Metric | Count |
|--------|-------|
| **Total Models** | 122 |
| **Total Enums** | 113 |
| **Total Relations** (`@relation`) | 256 |
| **Schema Lines** | ~4,355 |

### Primary Key Distribution

| PK Type | Count | Percentage | Usage |
|---------|-------|------------|-------|
| `@default(cuid())` | 74 | 60.7% | Older/core models (User, Session, Role, SystemConfig, Backup, Alert, etc.) |
| `@default(uuid())` | 47 | 38.5% | Newer models (Document, Company, Region, HistoricalBatch, FieldDefinitionSet, etc.) |
| Manual/Composite | 1 | 0.8% | VerificationToken (composite `@@unique([identifier, token])`) |

> **Migration note**: Project is migrating from `cuid()` to `uuid()`. New models use `uuid()`.

### Cascade Delete Analysis (46 relations)

Models with `onDelete: Cascade` — deleting the parent removes all children:

| Parent Model | Cascade Children |
|--------------|-----------------|
| User | Account, Session, UserRole, UserCityAccess, UserRegionAccess, SecurityLog |
| Document | OcrResult, ExtractionResult, ProcessingQueue, DocumentProcessingStage, Correction, ReviewRecord, FieldExtractionFeedback |
| MappingRule | RuleVersion, RuleApplication, RollbackLog, RuleTestTask |
| RuleSuggestion | SuggestionSample |
| RuleTestTask | RuleTestDetail |
| SystemConfig | ConfigHistory |
| ApiPricingConfig | ApiPricingHistory |
| DataRetentionPolicy | (no direct cascade, but children reference it) |
| AuditReportJob | AuditReportDownload |
| HistoricalBatch | HistoricalFile, TermAggregationResult |
| HistoricalFile | FileTransactionParty |
| Backup | RestoreRecord |
| RestoreRecord | RestoreDrill, RestoreLog |
| OutlookConfig | OutlookFilterRule |
| N8nApiKey | N8nApiCall |
| WebhookConfig | WebhookConfigHistory |
| WorkflowExecution | WorkflowExecutionStep |
| ExternalApiTask | ExternalWebhookDelivery |
| ExternalApiKey | ExternalWebhookConfig, ApiAuditLog |
| AlertRule | Alert |
| Alert | AlertRuleNotification |
| FieldMappingConfig | FieldMappingRule |
| DataTemplate | TemplateFieldMapping |
| TemplateInstance | TemplateInstanceRow |
| FieldDefinitionSet | FieldExtractionFeedback |
| Notification | (User cascade) |

### SetNull Delete (1 relation)

| Parent | Child | Field |
|--------|-------|-------|
| ExchangeRate | ExchangeRate | `inverseOfId` (self-referential) |

### Domain Size Distribution

| Domain | Model Count | Key Models |
|--------|-------------|------------|
| Performance Monitoring | 11 | ServiceHealthCheck, ApiPerformanceMetric, SystemResourceMetric |
| Mapping & Rules | 12 | MappingRule, RuleSuggestion, RuleVersion, FieldMappingConfig |
| User & Auth | 8 | User, Account, Session, Role, UserRole |
| Document Processing | 7 | Document, OcrResult, ExtractionResult, ProcessingQueue |
| Review & Correction | 7 | ReviewRecord, Correction, Escalation, CorrectionPattern |
| Backup & Restore | 7 | Backup, BackupSchedule, RestoreRecord, RestoreDrill |
| External API | 6 | ExternalApiTask, ExternalApiKey, ApiAuditLog |
| Reports & Statistics | 6 | ReportJob, MonthlyReport, ProcessingStatistics |
| Workflow | 5 | WorkflowExecution, WorkflowDefinition, WebhookConfig |
| Audit & Security | 5 | AuditLog, SecurityLog, DataChangeHistory |
| Alert System | 5 | AlertRule, Alert, AlertRecord |
| Data Retention | 4 | DataRetentionPolicy, DataArchiveRecord |
| Template Management | 4 | DataTemplate, TemplateFieldMapping, TemplateInstance |
| Historical Batch | 4 | HistoricalBatch, HistoricalFile |
| n8n Integration | 4 | N8nApiKey, N8nApiCall, N8nWebhookEvent |
| System Configuration | 4 | SystemConfig, ConfigHistory, PipelineConfig, SystemSetting |
| Company Management | 3 | Company, Forwarder, ForwarderIdentification |
| SharePoint Integration | 3 | SharePointConfig, SharePointFetchLog, ApiKey |
| Outlook Integration | 3 | OutlookConfig, OutlookFilterRule, OutlookFetchLog |
| AI Cost Tracking | 3 | ApiUsageLog, ApiPricingConfig, ApiPricingHistory |
| System Logging | 3 | SystemLog, LogRetentionPolicy, LogExport |
| Field Definition | 3 | FieldDefinitionSet, FieldExtractionFeedback, PipelineConfig |
| Region & City | 2 | Region, City |
| Prompt Configuration | 2 | PromptConfig, PromptVariable |
| Reference & Exchange | 2 | ReferenceNumber, ExchangeRate |

### Index Coverage

| Category | Count | Notes |
|----------|-------|-------|
| `@@index` declarations | 350+ | Comprehensive indexing across all models |
| `@@unique` constraints | 40+ | Business uniqueness rules |
| Composite indexes | 50+ | Multi-column indexes for query optimization |

### Relationship Patterns

| Pattern | Count | Examples |
|---------|-------|---------|
| One-to-One (unique FK) | ~15 | Document-OcrResult, Document-ExtractionResult, Document-ProcessingQueue |
| One-to-Many | ~200 | User-Document, Company-MappingRule, City-Document |
| Self-referential | 3 | Region (parent/children), Company (mergedInto/mergedFrom), ExchangeRate (inverseOf) |
| Named relations (same model pair) | 30+ | User has 40+ named relations (creator, reviewer, approver, etc.) |

### Scope/Hierarchy Patterns

Multiple models implement hierarchical configuration with scope levels:

| Model | Scope Levels | Override Order |
|-------|-------------|----------------|
| FieldMappingConfig | GLOBAL, COMPANY, FORMAT | GLOBAL -> COMPANY -> FORMAT |
| PromptConfig | GLOBAL, COMPANY, FORMAT | GLOBAL -> COMPANY -> FORMAT |
| TemplateFieldMapping | GLOBAL, COMPANY, FORMAT | GLOBAL -> COMPANY -> FORMAT |
| FieldDefinitionSet | GLOBAL, COMPANY, FORMAT | GLOBAL -> COMPANY -> FORMAT |
| PipelineConfig | GLOBAL, REGION, COMPANY | GLOBAL -> REGION -> COMPANY |
| SystemConfig | GLOBAL, REGION, CITY | GLOBAL -> REGION -> CITY |
| DataTemplate | GLOBAL, COMPANY | GLOBAL -> COMPANY |

### Key Observations

1. **User model is the hub**: 80+ relation fields, connecting to virtually every domain
2. **Document model is the second hub**: 64 relation fields, central to all processing
3. **City model** bridges geographic scope to all operational models
4. **Company model** replaced Forwarder (REFACTOR-001) but both coexist for backward compatibility
5. **Three-tier scope pattern** (GLOBAL/COMPANY/FORMAT) is the dominant config hierarchy
6. **No autoincrement PKs**: All models use either `uuid()` or `cuid()`
7. **Timestamps are universal**: Every model has `createdAt`; most have `updatedAt`
8. **Soft delete is rare**: Only `ExternalApiKey` has `deletedAt`; most use `isActive` flag
