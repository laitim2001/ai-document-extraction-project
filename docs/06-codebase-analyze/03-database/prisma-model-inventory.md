# Prisma Model Inventory

> **Field Count Accuracy Note**: The "Fields" column uses an inconsistent counting
> methodology and is approximately accurate (plus or minus 1-3 fields per model). Timestamp fields
> (createdAt/updatedAt) and fields added by later CHANGE migrations may be undercounted.
> For exact field counts, consult `prisma/schema.prisma` directly.

> Generated: 2026-04-09 | Schema: `prisma/schema.prisma` | Total: **122 models**, **113 enums**, **256 relations**

---

## Schema Statistics Summary

| Metric | Count |
|--------|-------|
| Total Models | 122 |
| Total Enums | 113 |
| Total Relations (`@relation`) | 256 |
| Cascade Deletes (`onDelete: Cascade`) | 46 |
| SetNull Deletes (`onDelete: SetNull`) | 1 |
| PK type: `uuid()` | 47 models |
| PK type: `cuid()` | 74 models |
| PK type: none (manual/composite) | 1 (VerificationToken) |

---

## Domain 1: User & Auth (8 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 1 | User | 19 | cuid | Has many: Account, Session, Document, AuditLog, etc. (80+ relations) | Core user account |
| 2 | Account | 12 | cuid | BelongsTo: User (Cascade) | OAuth provider account (NextAuth) |
| 3 | Session | 7 | cuid | BelongsTo: User (Cascade) | Login session with IP/UA tracking |
| 4 | VerificationToken | 3 | composite | None | Email verification token |
| 5 | Role | 6 | cuid | Has many: UserRole | RBAC role definition with permissions array |
| 6 | UserRole | 5 | cuid | BelongsTo: User (Cascade), Role (Cascade), City? | User-role-city assignment |
| 7 | UserCityAccess | 8 | uuid | BelongsTo: User (Cascade), City, User(grantor) | City-level access control |
| 8 | UserRegionAccess | 8 | uuid | BelongsTo: User (Cascade), Region, User(grantor) | Region-level access control |

## Domain 2: Region & City (2 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 9 | Region | 11 | uuid | Self-ref (parent/children), Has many: City, UserRegionAccess, ReferenceNumber, PipelineConfig | Geographic region hierarchy |
| 10 | City | 11 | uuid | BelongsTo: Region. Has many: Document, SystemConfig, AlertRule, etc. | City configuration hub |

## Domain 3: Document Processing (7 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 11 | Document | 25 | uuid | BelongsTo: User, City, Company?, Forwarder?, TemplateInstance?. Has: OcrResult, ExtractionResult, ProcessingQueue, Correction[], ReviewRecord[] | Core document entity |
| 12 | OcrResult | 13 | uuid | BelongsTo: Document (Cascade) | OCR extraction raw result + confidence |
| 13 | ExtractionResult | 32 | uuid | BelongsTo: Document (Cascade), Forwarder?, Company? | V3 3-stage extraction with AI details |
| 14 | ProcessingQueue | 17 | uuid | BelongsTo: Document (Cascade), User?(assignee) | Review queue routing (AUTO/QUICK/FULL) |
| 15 | DocumentProcessingStage | 14 | cuid | BelongsTo: Document (Cascade) | Per-stage processing tracker |
| 16 | DocumentFormat | 11 | cuid | BelongsTo: Company. Has: FieldMappingConfig[], PromptConfig[], TemplateFieldMapping[] | Company document format definition |
| 17 | BulkOperation | 9 | uuid | None (stores rule IDs in JSON) | Batch operation tracking for undo |

## Domain 4: Company Management (3 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 18 | Company | 20 | uuid | Self-ref (mergedInto). Has many: Document, MappingRule, DocumentFormat, DataTemplate, etc. | Primary company entity (post-REFACTOR-001) |
| 19 | Forwarder | 15 | uuid | Has many: Document, MappingRule, ForwarderIdentification | Legacy forwarder (deprecated, backward-compat) |
| 20 | ForwarderIdentification | 14 | uuid | BelongsTo: Document (Cascade), Forwarder?, User? | Document-to-forwarder match record |

## Domain 5: Mapping & Rules (12 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 21 | MappingRule | 20 | uuid | BelongsTo: Company?, Forwarder?, User?, RuleSuggestion?. Has: RuleVersion[], RuleApplication[] | Core mapping rule with versioning |
| 22 | RuleSuggestion | 19 | uuid | BelongsTo: Forwarder?, Company?, Escalation?, CorrectionPattern?, User(reviewer/suggester) | AI/manual rule suggestion |
| 23 | SuggestionSample | 7 | uuid | BelongsTo: RuleSuggestion (Cascade), Document | Sample case for suggestion |
| 24 | RuleVersion | 8 | uuid | BelongsTo: MappingRule (Cascade), User(creator) | Rule version history |
| 25 | RuleApplication | 10 | uuid | BelongsTo: MappingRule (Cascade), Document (Cascade), User? | Rule usage tracking |
| 26 | RollbackLog | 9 | uuid | BelongsTo: MappingRule (Cascade) | Rule rollback audit |
| 27 | RuleChangeRequest | 13 | uuid | BelongsTo: MappingRule?, Forwarder?, Company?, User(requester/reviewer) | Rule change approval workflow |
| 28 | RuleTestTask | 16 | uuid | BelongsTo: MappingRule (Cascade), Company?, Forwarder?, User. Has: RuleTestDetail[] | A/B test task for rule changes |
| 29 | RuleTestDetail | 12 | uuid | BelongsTo: RuleTestTask (Cascade), Document | Per-document test result |
| 30 | RuleCacheVersion | 5 | uuid | None | Cache invalidation tracker |
| 31 | FieldMappingConfig | 11 | cuid | BelongsTo: Company?, DocumentFormat?, DataTemplate?. Has: FieldMappingRule[] | Hierarchical field mapping (GLOBAL/COMPANY/FORMAT) |
| 32 | FieldMappingRule | 9 | cuid | BelongsTo: FieldMappingConfig (Cascade) | Individual mapping transform rule |

## Domain 6: Review & Correction (7 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 33 | ReviewRecord | 10 | uuid | BelongsTo: Document (Cascade), User(reviewer) | Human review action record |
| 34 | Correction | 10 | uuid | BelongsTo: Document (Cascade), User(corrector), CorrectionPattern? | Field correction record |
| 35 | CorrectionPattern | 14 | uuid | BelongsTo: Forwarder?, Company?. Has: Correction[], RuleSuggestion? | Detected correction pattern |
| 36 | PatternAnalysisLog | 9 | uuid | None | Pattern analysis batch run log |
| 37 | FieldCorrectionHistory | 10 | uuid | BelongsTo: Forwarder?, Company? | Field-level accuracy tracking over time |
| 38 | Escalation | 11 | uuid | BelongsTo: Document (Cascade), User(escalator/assignee/resolver). Has: RuleSuggestion? | Document escalation workflow |
| 39 | Notification | 10 | uuid | BelongsTo: User (Cascade) | User notification (read/unread) |

## Domain 7: Audit & Security (5 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 40 | AuditLog | 17 | uuid | BelongsTo: User, City?(by code) | Immutable audit trail |
| 41 | SecurityLog | 13 | uuid | BelongsTo: User (Cascade), User?(resolver) | Security event tracking |
| 42 | DataChangeHistory | 12 | uuid | BelongsTo: User(changer) | Generic resource version history |
| 43 | TraceabilityReport | 7 | manual | BelongsTo: Document, User(generator) | Document processing traceability |
| 44 | StatisticsAuditLog | 7 | uuid | None | Statistics integrity audit |

## Domain 8: Reports & Statistics (6 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 45 | ReportJob | 11 | uuid | BelongsTo: User | Async report generation job |
| 46 | MonthlyReport | 14 | uuid | BelongsTo: User?(generator) | Monthly cost/volume report |
| 47 | AuditReportJob | 23 | cuid | BelongsTo: User(requester). Has: AuditReportDownload[] | Audit report with digital signature |
| 48 | AuditReportDownload | 6 | cuid | BelongsTo: AuditReportJob (Cascade), User | Download tracking |
| 49 | ProcessingStatistics | 14 | uuid | BelongsTo: City(by code) | Daily processing stats per city |
| 50 | HourlyProcessingStats | 9 | uuid | None | Hourly processing stats |

## Domain 9: AI Cost Tracking (3 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 51 | ApiUsageLog | 11 | uuid | BelongsTo: Document? | API call cost tracking (tokens + cost) |
| 52 | ApiPricingConfig | 11 | uuid | Has: ApiPricingHistory[] | Provider pricing configuration |
| 53 | ApiPricingHistory | 12 | uuid | BelongsTo: ApiPricingConfig (Cascade) | Price change history |

## Domain 10: System Configuration (4 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 54 | SystemConfig | 18 | cuid | BelongsTo: City?(by code), User?(updater). Has: ConfigHistory[] | Key-value config with scope/category |
| 55 | ConfigHistory | 9 | cuid | BelongsTo: SystemConfig (Cascade), User(changer) | Config change audit trail |
| 56 | PipelineConfig | 14 | cuid | BelongsTo: Region?, Company? | Pipeline feature flags (ref-match, FX) per scope |
| 57 | SystemSetting | 7 | uuid | None | Simple key-value system settings (CHANGE-050) |

## Domain 11: Data Retention (4 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 58 | DataRetentionPolicy | 15 | cuid | BelongsTo: User(creator). Has: DataArchiveRecord[], DataDeletionRequest[] | Hot/warm/cold storage policy |
| 59 | DataArchiveRecord | 20 | cuid | BelongsTo: DataRetentionPolicy. Has: DataRestoreRequest[] | Archive operation record |
| 60 | DataDeletionRequest | 16 | cuid | BelongsTo: DataRetentionPolicy, User(requester/approver) | Deletion approval workflow |
| 61 | DataRestoreRequest | 14 | cuid | BelongsTo: DataArchiveRecord, User(requester) | Archive restore request |

## Domain 12: SharePoint Integration (3 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 62 | SharePointConfig | 19 | cuid | BelongsTo: City?, User(creator/updater). Has: SharePointFetchLog[] | SharePoint connection config |
| 63 | SharePointFetchLog | 15 | cuid | BelongsTo: City, SharePointConfig?, Document? | File fetch audit log |
| 64 | ApiKey | 11 | cuid | BelongsTo: User(creator) | Internal API key management |

## Domain 13: Outlook Integration (3 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 65 | OutlookConfig | 19 | cuid | BelongsTo: City?, User(creator/updater). Has: OutlookFilterRule[], OutlookFetchLog[] | Outlook mailbox config |
| 66 | OutlookFilterRule | 10 | cuid | BelongsTo: OutlookConfig (Cascade) | Email filter rules |
| 67 | OutlookFetchLog | 18 | cuid | BelongsTo: City, OutlookConfig? | Email/attachment fetch log |

## Domain 14: n8n Integration (4 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 68 | N8nApiKey | 14 | cuid | BelongsTo: City(by code), User(creator). Has: N8nApiCall[], N8nIncomingWebhook[] | n8n API key with rate limiting |
| 69 | N8nApiCall | 12 | cuid | BelongsTo: N8nApiKey (Cascade) | n8n API call audit |
| 70 | N8nWebhookEvent | 19 | cuid | BelongsTo: Document? | Outbound webhook delivery to n8n |
| 71 | N8nIncomingWebhook | 13 | cuid | BelongsTo: N8nApiKey | Inbound webhook from n8n |

## Domain 15: Workflow (5 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 72 | WorkflowExecution | 20 | cuid | BelongsTo: City(by code), WorkflowDefinition?. Has: Document[], WorkflowExecutionStep[] | Workflow run instance |
| 73 | WorkflowExecutionStep | 11 | cuid | BelongsTo: WorkflowExecution (Cascade) | Workflow step execution |
| 74 | WorkflowDefinition | 14 | cuid | BelongsTo: City?(by code), User(creator/updater). Has: WorkflowExecution[] | n8n workflow registration |
| 75 | WebhookConfig | 15 | cuid | BelongsTo: City?(by code), User(creator/updater). Has: WebhookConfigHistory[] | Webhook endpoint config |
| 76 | WebhookConfigHistory | 9 | cuid | BelongsTo: WebhookConfig (Cascade), User(changer) | Webhook config change log |

## Domain 16: External API (6 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 77 | ExternalApiTask | 22 | cuid | BelongsTo: ExternalApiKey, City(by code), Document?. Has: ExternalWebhookDelivery[] | External API processing task |
| 78 | ExternalWebhookDelivery | 14 | cuid | BelongsTo: ExternalApiTask (Cascade) | Webhook delivery attempt |
| 79 | ExternalWebhookConfig | 10 | cuid | BelongsTo: ExternalApiKey (Cascade) | External webhook subscription |
| 80 | ExternalApiKey | 20 | cuid | BelongsTo: User(creator). Has: ExternalApiTask[], ExternalWebhookConfig[], ApiAuditLog[] | External API key with IP restriction |
| 81 | ApiAuthAttempt | 5 | cuid | None | API auth attempt log |
| 82 | ApiAuditLog | 14 | cuid | BelongsTo: ExternalApiKey (Cascade) | External API usage audit |

## Domain 17: Performance Monitoring (11 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 83 | ServiceHealthCheck | 9 | cuid | None | Service health ping record |
| 84 | ServiceAvailability | 9 | cuid | None | Hourly availability percentage |
| 85 | SystemOverallStatus | 4 | cuid | None | Current system status snapshot |
| 86 | ApiPerformanceMetric | 13 | cuid | None | API response time metrics |
| 87 | SystemResourceMetric | 12 | cuid | None | CPU/memory/heap metrics |
| 88 | AiServiceMetric | 15 | cuid | None | AI service latency and cost |
| 89 | DatabaseQueryMetric | 10 | cuid | None | DB query performance |
| 90 | PerformanceHourlySummary | 22 | cuid | None | Aggregated hourly performance |
| 91 | PerformanceThreshold | 7 | cuid | None | Alert threshold definitions |
| 92 | SystemHealthLog | 10 | cuid | BelongsTo: City?(by code) | Health status change log |
| 93 | N8nConnectionStats | 13 | cuid | BelongsTo: City?(by code) | n8n connection quality stats |

## Domain 18: Alert System (5 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 94 | AlertRule | 14 | cuid | BelongsTo: City?, User(creator). Has: Alert[] | Alert condition definition |
| 95 | Alert | 13 | cuid | BelongsTo: AlertRule (Cascade), City?. Has: AlertRuleNotification[] | Active alert instance |
| 96 | AlertRuleNotification | 8 | cuid | BelongsTo: Alert (Cascade) | Alert notification delivery |
| 97 | AlertRecord | 14 | cuid | None | Legacy alert record (standalone) |
| 98 | AlertNotificationConfig | 12 | cuid | None | Legacy notification config |

## Domain 19: Backup & Restore (7 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 99 | Backup | 15 | cuid | BelongsTo: User?(creator), BackupSchedule?. Has: RestoreRecord[] | Backup record with checksum |
| 100 | BackupSchedule | 12 | cuid | BelongsTo: User?(creator). Has: Backup[] | Cron-based backup schedule |
| 101 | BackupConfig | 13 | cuid | None | Backup infrastructure config |
| 102 | BackupStorageUsage | 7 | cuid | None | Storage usage snapshot |
| 103 | RestoreRecord | 20 | cuid | BelongsTo: Backup (Cascade), User(creator). Has: RestoreDrill?, RestoreLog[] | Restore operation record |
| 104 | RestoreDrill | 8 | cuid | BelongsTo: RestoreRecord (Cascade) | Restore drill exercise |
| 105 | RestoreLog | 6 | cuid | BelongsTo: RestoreRecord (Cascade) | Restore operation log |

## Domain 20: System Logging (3 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 106 | SystemLog | 15 | cuid | BelongsTo: User? | Structured application log |
| 107 | LogRetentionPolicy | 7 | cuid | None | Per-level retention config |
| 108 | LogExport | 13 | cuid | BelongsTo: User(creator) | Log export job |

## Domain 21: Historical Batch Processing (4 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 109 | HistoricalBatch | 28 | uuid | BelongsTo: User(creator). Has: HistoricalFile[], TermAggregationResult? | Batch import job with company/format/term settings |
| 110 | HistoricalFile | 22 | uuid | BelongsTo: HistoricalBatch (Cascade), Company?, DocumentFormat?. Has: FileTransactionParty[] | Individual file in batch |
| 111 | TermAggregationResult | 9 | uuid | BelongsTo: HistoricalBatch (Cascade) | Term aggregation statistics |
| 112 | FileTransactionParty | 5 | uuid | BelongsTo: HistoricalFile (Cascade), Company | File-company transaction role |

## Domain 22: Prompt Configuration (2 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 113 | PromptConfig | 14 | cuid | BelongsTo: Company?, DocumentFormat? | AI prompt template (hierarchical scope) |
| 114 | PromptVariable | 8 | cuid | None | Reusable prompt variable definition |

## Domain 23: Template Management (4 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 115 | DataTemplate | 10 | cuid | BelongsTo: Company?. Has: TemplateFieldMapping[], TemplateInstance[], FieldMappingConfig[] | Data export template (ERP format) |
| 116 | TemplateFieldMapping | 11 | cuid | BelongsTo: DataTemplate (Cascade), Company?, DocumentFormat? | Template field mapping rules (hierarchical) |
| 117 | TemplateInstance | 12 | cuid | BelongsTo: DataTemplate. Has: TemplateInstanceRow[], Document[] | Filled template instance |
| 118 | TemplateInstanceRow | 8 | cuid | BelongsTo: TemplateInstance (Cascade) | Single data row in instance |

## Domain 24: Reference Number & Exchange Rate (2 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 119 | ReferenceNumber | 14 | cuid | BelongsTo: Region | Shipment/delivery reference number master |
| 120 | ExchangeRate | 12 | cuid | Self-ref (inverseOf/inverseRates) | Currency pair exchange rate |

## Domain 25: Field Definition & Pipeline (3 models)

| # | Model | Fields | PK | Key Relationships | Purpose |
|---|-------|--------|----|-------------------|---------|
| 121 | FieldDefinitionSet | 11 | uuid | BelongsTo: Company?, DocumentFormat?. Has: FieldExtractionFeedback[] | AI field extraction definition (CHANGE-042) |
| 122 | FieldExtractionFeedback | 11 | uuid | BelongsTo: FieldDefinitionSet (Cascade), Document (Cascade) | Extraction coverage feedback |
