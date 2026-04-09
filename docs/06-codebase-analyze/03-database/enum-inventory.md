# Prisma Enum Inventory

> Generated: 2026-04-09 | Total: **113 enums** | Source: `prisma/schema.prisma`

---

## User & Access Control (4 enums)

| # | Enum | Values |
|---|------|--------|
| 1 | UserStatus | ACTIVE, INACTIVE, SUSPENDED |
| 2 | AccessLevel | READ_ONLY, FULL |
| 3 | RegionStatus | ACTIVE, INACTIVE |
| 4 | CityStatus | ACTIVE, INACTIVE, PENDING |

## Document Processing (6 enums)

| # | Enum | Values |
|---|------|--------|
| 5 | DocumentStatus | UPLOADING, UPLOADED, OCR_PROCESSING, OCR_COMPLETED, OCR_FAILED, MAPPING_PROCESSING, MAPPING_COMPLETED, REF_MATCH_FAILED, PENDING_REVIEW, IN_REVIEW, COMPLETED, FAILED, APPROVED, ESCALATED |
| 6 | ProcessingPath | AUTO_APPROVE, QUICK_REVIEW, FULL_REVIEW, MANUAL_REQUIRED |
| 7 | DocumentSourceType | MANUAL_UPLOAD, SHAREPOINT, OUTLOOK, API, N8N_WORKFLOW |
| 8 | ProcessingStage | RECEIVED, UPLOADED, OCR_PROCESSING, AI_EXTRACTION, FORWARDER_IDENTIFICATION, FIELD_MAPPING, VALIDATION, REVIEW_PENDING, REVIEW_COMPLETED, COMPLETED |
| 9 | ProcessingStageStatus | PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED |
| 10 | ExtractionStatus | PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED |

## Company & Forwarder (4 enums)

| # | Enum | Values |
|---|------|--------|
| 11 | CompanyType | FORWARDER, EXPORTER, CARRIER, CUSTOMS_BROKER, OTHER, UNKNOWN |
| 12 | CompanyStatus | ACTIVE, INACTIVE, PENDING, MERGED |
| 13 | CompanySource | MANUAL, AUTO_CREATED, IMPORTED |
| 14 | ForwarderStatus | ACTIVE, INACTIVE, PENDING |

## Identification (1 enum)

| # | Enum | Values |
|---|------|--------|
| 15 | IdentificationStatus | PENDING, IDENTIFIED, NEEDS_REVIEW, UNIDENTIFIED, FAILED |

## Review & Correction (6 enums)

| # | Enum | Values |
|---|------|--------|
| 16 | ReviewAction | APPROVED, CORRECTED, ESCALATED |
| 17 | CorrectionType | NORMAL, EXCEPTION |
| 18 | PatternStatus | DETECTED, CANDIDATE, SUGGESTED, PROCESSED, IGNORED |
| 19 | EscalationReason | UNKNOWN_FORWARDER, RULE_NOT_APPLICABLE, POOR_QUALITY, OTHER, UNKNOWN_COMPANY |
| 20 | EscalationStatus | PENDING, IN_PROGRESS, RESOLVED, CANCELLED |
| 21 | QueueStatus | PENDING, IN_PROGRESS, COMPLETED, SKIPPED, CANCELLED |

## Mapping Rules (10 enums)

| # | Enum | Values |
|---|------|--------|
| 22 | RuleStatus | DRAFT, PENDING_REVIEW, ACTIVE, DEPRECATED |
| 23 | SuggestionStatus | PENDING, APPROVED, REJECTED, IMPLEMENTED |
| 24 | SuggestionSource | MANUAL, AUTO_LEARNING, IMPORT |
| 25 | ExtractionType | REGEX, KEYWORD, POSITION, AI_PROMPT, TEMPLATE |
| 26 | RollbackTrigger | AUTO, MANUAL, EMERGENCY |
| 27 | ChangeType | CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE |
| 28 | ChangeRequestStatus | PENDING, APPROVED, REJECTED, CANCELLED |
| 29 | TestTaskStatus | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| 30 | TestChangeType | IMPROVED, REGRESSED, UNCHANGED, BOTH_WRONG, BOTH_RIGHT |
| 31 | FieldMappingScope | GLOBAL, COMPANY, FORMAT |

## Field Mapping & Transform (2 enums)

| # | Enum | Values |
|---|------|--------|
| 32 | FieldTransformType | DIRECT, CONCAT, SPLIT, LOOKUP, CUSTOM, FORMULA |
| 33 | FieldDefinitionScope | GLOBAL, COMPANY, FORMAT |

## Notification (2 enums)

| # | Enum | Values |
|---|------|--------|
| 34 | NotificationPriority | LOW, NORMAL, HIGH, URGENT |
| 35 | NotificationChannel | EMAIL, TEAMS, WEBHOOK |

## Security (2 enums)

| # | Enum | Values |
|---|------|--------|
| 36 | SecurityEventType | UNAUTHORIZED_ACCESS_ATTEMPT, CROSS_CITY_ACCESS_VIOLATION, INVALID_CITY_REQUEST, RESOURCE_ACCESS_DENIED, SUSPICIOUS_ACTIVITY, PERMISSION_ELEVATION_ATTEMPT, TAMPERING_ATTEMPT |
| 37 | SecuritySeverity | LOW, MEDIUM, HIGH, CRITICAL |

## Audit (3 enums)

| # | Enum | Values |
|---|------|--------|
| 38 | AuditAction | CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, APPROVE, REJECT, ESCALATE, CONFIGURE, GRANT, REVOKE |
| 39 | AuditStatus | SUCCESS, FAILURE, PARTIAL |
| 40 | HistoryChangeType | CREATE, UPDATE, DELETE, RESTORE |

## System Configuration (5 enums)

| # | Enum | Values |
|---|------|--------|
| 41 | ConfigCategory | PROCESSING, NOTIFICATION, SECURITY, DISPLAY, INTEGRATION, AI_MODEL, THRESHOLD, SYSTEM |
| 42 | ConfigScope | GLOBAL, REGION, CITY |
| 43 | ConfigValueType | STRING, NUMBER, BOOLEAN, JSON, SECRET, ENUM |
| 44 | ConfigEffectType | IMMEDIATE, RESTART_REQUIRED, SCHEDULED |
| 45 | ConfigChangeType | CREATED, UPDATED, ACTIVATED, DEACTIVATED, DELETED |

## Reports (5 enums)

| # | Enum | Values |
|---|------|--------|
| 46 | ReportJobStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| 47 | ReportStatus | PENDING, GENERATING, COMPLETED, FAILED |
| 48 | AuditReportType | PROCESSING_RECORDS, CHANGE_HISTORY, FULL_AUDIT, COMPLIANCE_SUMMARY |
| 49 | ReportOutputFormat | EXCEL, PDF, CSV, JSON |
| 50 | ReportJobStatus2 | PENDING, QUEUED, PROCESSING, GENERATING, SIGNING, COMPLETED, FAILED, CANCELLED, EXPIRED |

## AI & API (2 enums)

| # | Enum | Values |
|---|------|--------|
| 51 | ApiProvider | AZURE_DOC_INTELLIGENCE, OPENAI, AZURE_OPENAI |
| 52 | NotificationStatus | PENDING, SENT, FAILED, ACKNOWLEDGED, RECOVERED |

## Data Retention (5 enums)

| # | Enum | Values |
|---|------|--------|
| 53 | DataType | AUDIT_LOG, DATA_CHANGE_HISTORY, DOCUMENT, EXTRACTION_RESULT, PROCESSING_RECORD, USER_SESSION, API_USAGE_LOG, SYSTEM_LOG |
| 54 | StorageTier | HOT, COOL, COLD, ARCHIVE |
| 55 | ArchiveStatus | PENDING, ARCHIVING, ARCHIVED, FAILED, RESTORING, RESTORED |
| 56 | DeletionRequestStatus | PENDING, APPROVED, REJECTED, EXECUTING, COMPLETED, FAILED |
| 57 | RestoreRequestStatus | PENDING, IN_PROGRESS, COMPLETED, FAILED, EXPIRED |

## SharePoint (1 enum)

| # | Enum | Values |
|---|------|--------|
| 58 | SharePointFetchStatus | PENDING, DOWNLOADING, PROCESSING, COMPLETED, FAILED, DUPLICATE |

## Outlook (4 enums)

| # | Enum | Values |
|---|------|--------|
| 59 | OutlookRuleType | SENDER_EMAIL, SENDER_DOMAIN, SUBJECT_KEYWORD, SUBJECT_REGEX, ATTACHMENT_TYPE, ATTACHMENT_NAME |
| 60 | RuleOperator | EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, REGEX |
| 61 | OutlookSubmissionType | MESSAGE_ID, DIRECT_UPLOAD |
| 62 | OutlookFetchStatus | PENDING, FETCHING, PROCESSING, COMPLETED, PARTIAL, FAILED, FILTERED |

## n8n & Webhook (4 enums)

| # | Enum | Values |
|---|------|--------|
| 63 | N8nEventType | DOCUMENT_RECEIVED, DOCUMENT_PROCESSING, DOCUMENT_COMPLETED, DOCUMENT_FAILED, DOCUMENT_REVIEW_NEEDED, WORKFLOW_STARTED, WORKFLOW_COMPLETED, WORKFLOW_FAILED |
| 64 | WebhookDeliveryStatus | PENDING, SENDING, SUCCESS, FAILED, RETRYING, EXHAUSTED |
| 65 | WebhookTestResult | SUCCESS, FAILED, TIMEOUT, ERROR |
| 66 | WebhookEventType | INVOICE_PROCESSING, INVOICE_COMPLETED, INVOICE_FAILED, INVOICE_REVIEW_REQUIRED |

## Workflow (3 enums)

| # | Enum | Values |
|---|------|--------|
| 67 | WorkflowTriggerType | SCHEDULED, MANUAL, WEBHOOK, DOCUMENT, EVENT |
| 68 | WorkflowExecutionStatus | PENDING, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED, TIMEOUT |
| 69 | StepExecutionStatus | PENDING, RUNNING, COMPLETED, FAILED, SKIPPED |

## External API (5 enums)

| # | Enum | Values |
|---|------|--------|
| 70 | SubmissionType | FILE_UPLOAD, BASE64, URL_REFERENCE |
| 71 | TaskPriority | NORMAL, HIGH |
| 72 | ApiTaskStatus | QUEUED, PROCESSING, COMPLETED, FAILED, REVIEW_REQUIRED, EXPIRED |
| 73 | ExternalWebhookDeliveryStatus | PENDING, SENDING, DELIVERED, FAILED, RETRYING |
| 74 | ServiceType | WEB_APP, AI_SERVICE, DATABASE, STORAGE, N8N, CACHE, EXTERNAL_API |

## Health & Performance (3 enums)

| # | Enum | Values |
|---|------|--------|
| 75 | HealthStatus | HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN, UNCONFIGURED |
| 76 | HealthCheckType | SCHEDULED, MANUAL, ON_ERROR, ON_RECOVERY, STARTUP |
| 77 | StatsPeriodType | HOURLY, DAILY, WEEKLY, MONTHLY |

## Alert System (4 enums)

| # | Enum | Values |
|---|------|--------|
| 78 | AlertType | CONNECTION_FAILURE, HIGH_ERROR_RATE, RESPONSE_TIMEOUT, SERVICE_DEGRADED, SERVICE_RECOVERED, CONFIGURATION_ERROR, AUTHENTICATION_FAILURE, RATE_LIMIT_EXCEEDED |
| 79 | AlertSeverity | INFO, WARNING, ERROR, CRITICAL, EMERGENCY |
| 80 | AlertStatus | ACTIVE, ACKNOWLEDGED, RESOLVED, SUPPRESSED, FIRING, RECOVERED |
| 81 | AlertConditionType | SERVICE_DOWN, ERROR_RATE, RESPONSE_TIME, QUEUE_BACKLOG, STORAGE_LOW, CPU_HIGH, MEMORY_HIGH, CUSTOM_METRIC |

## Alert Operator (1 enum)

| # | Enum | Values |
|---|------|--------|
| 82 | AlertOperator | GREATER_THAN, GREATER_THAN_EQ, LESS_THAN, LESS_THAN_EQ, EQUALS, NOT_EQUALS |

## Backup & Restore (7 enums)

| # | Enum | Values |
|---|------|--------|
| 83 | BackupType | FULL, INCREMENTAL, DIFFERENTIAL |
| 84 | BackupStatus | PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED |
| 85 | BackupSource | DATABASE, FILES, CONFIG, FULL_SYSTEM |
| 86 | BackupTrigger | SCHEDULED, MANUAL, PRE_RESTORE |
| 87 | RestoreType | FULL, PARTIAL, DRILL, POINT_IN_TIME |
| 88 | RestoreStatus | PENDING, VALIDATING, PRE_BACKUP, IN_PROGRESS, VERIFYING, COMPLETED, FAILED, CANCELLED, ROLLED_BACK |
| 89 | RestoreScope | DATABASE, FILES, CONFIG, ALL |

## System Logging (4 enums)

| # | Enum | Values |
|---|------|--------|
| 90 | LogLevel | DEBUG, INFO, WARN, ERROR, CRITICAL |
| 91 | LogSource | WEB, API, AI, DATABASE, N8N, SCHEDULER, BACKGROUND, SYSTEM |
| 92 | LogExportFormat | CSV, JSON, TXT |
| 93 | LogExportStatus | PENDING, PROCESSING, COMPLETED, FAILED, EXPIRED |

## Historical Batch (5 enums)

| # | Enum | Values |
|---|------|--------|
| 94 | HistoricalBatchStatus | PENDING, PROCESSING, PAUSED, AGGREGATING, AGGREGATED, COMPLETED, FAILED, CANCELLED |
| 95 | DetectedFileType | NATIVE_PDF, SCANNED_PDF, IMAGE |
| 96 | HistoricalFileStatus | PENDING, DETECTING, DETECTED, PROCESSING, COMPLETED, FAILED, SKIPPED |
| 97 | ProcessingMethod | AZURE_DI, GPT_VISION, DUAL_PROCESSING |
| 98 | IssuerIdentificationMethod | LOGO, HEADER, LETTERHEAD, FOOTER, AI_INFERENCE |

## Transaction & Document Classification (4 enums)

| # | Enum | Values |
|---|------|--------|
| 99 | TransactionPartyRole | VENDOR, SHIPPER, CONSIGNEE, CARRIER, BUYER, SELLER, NOTIFY_PARTY, OTHER |
| 100 | DocumentType | INVOICE, DEBIT_NOTE, CREDIT_NOTE, STATEMENT, QUOTATION, BILL_OF_LADING, CUSTOMS_DECLARATION, OTHER |
| 101 | DocumentSubtype | OCEAN_FREIGHT, AIR_FREIGHT, LAND_TRANSPORT, CUSTOMS_CLEARANCE, WAREHOUSING, IMPORT, EXPORT, GENERAL |
| 102 | StandardChargeCategory | OCEAN_FREIGHT, AIR_FREIGHT, HANDLING_FEE, CUSTOMS_CLEARANCE, DOCUMENTATION_FEE, TERMINAL_HANDLING, INLAND_TRANSPORT, INSURANCE, STORAGE, FUEL_SURCHARGE, SECURITY_FEE, OTHER |

## Prompt Configuration (3 enums)

| # | Enum | Values |
|---|------|--------|
| 103 | PromptType | ISSUER_IDENTIFICATION, TERM_CLASSIFICATION, FIELD_EXTRACTION, VALIDATION, STAGE_1_COMPANY_IDENTIFICATION, STAGE_2_FORMAT_IDENTIFICATION, STAGE_3_FIELD_EXTRACTION |
| 104 | PromptScope | GLOBAL, COMPANY, FORMAT |
| 105 | MergeStrategy | OVERRIDE, APPEND, PREPEND |

## Template (4 enums)

| # | Enum | Values |
|---|------|--------|
| 106 | DataTemplateScope | GLOBAL, COMPANY |
| 107 | TemplateFieldMappingScope | GLOBAL, COMPANY, FORMAT |
| 108 | TemplateInstanceStatus | DRAFT, PROCESSING, COMPLETED, EXPORTED, ERROR |
| 109 | TemplateInstanceRowStatus | PENDING, VALID, INVALID, SKIPPED |

## Reference Number (2 enums)

| # | Enum | Values |
|---|------|--------|
| 110 | ReferenceNumberType | SHIPMENT, DELIVERY, BOOKING, CONTAINER, HAWB, MAWB, BL, CUSTOMS, OTHER |
| 111 | ReferenceNumberStatus | ACTIVE, EXPIRED, CANCELLED |

## Exchange Rate (1 enum)

| # | Enum | Values |
|---|------|--------|
| 112 | ExchangeRateSource | MANUAL, IMPORTED, AUTO_INVERSE |

## Pipeline Config (1 enum)

| # | Enum | Values |
|---|------|--------|
| 113 | PipelineConfigScope | GLOBAL, REGION, COMPANY |
