# Hooks, Types, Lib & Support Modules Overview

> Generated: 2026-04-09 | Total files across all sections: 305

---

## 1. Hooks (`src/hooks/`) — 104 files

### Data Fetching (Query) — 74 files

| File | Purpose |
|------|---------|
| `use-accessible-cities.ts` | Fetch user-accessible cities list |
| `use-accuracy.ts` | Query rule accuracy metrics |
| `useAiCost.ts` | Query AI API cost summary data |
| `useAlertRules.ts` | CRUD hooks for alert rules |
| `use-alerts.ts` | Alert management queries (list/acknowledge/resolve) |
| `useAlerts.ts` | Alert list and statistics queries |
| `useAuditQuery.ts` | Audit log search and filtering queries |
| `useAuditReports.ts` | Audit report job list and generation |
| `use-backup.ts` | Backup list, creation, and deletion |
| `use-backup-schedule.ts` | Backup schedule CRUD queries |
| `useChangeHistory.ts` | Resource change history queries |
| `use-cities.ts` | City list query |
| `useCityCost.ts` | City-level AI cost summary queries |
| `use-city-cost-report.ts` | City cost report queries |
| `use-companies.ts` | Company list React Query hook |
| `use-company-detail.ts` | Company detail with related data |
| `use-company-formats.ts` | Company document format list and creation |
| `useCompanyList.ts` | Company list with filtering/pagination |
| `useDashboardStatistics.ts` | Dashboard aggregate statistics |
| `use-data-templates.ts` | Data template CRUD hooks |
| `use-document.ts` | Single document query |
| `use-document-detail.ts` | Document detail page data fetching |
| `use-document-formats.ts` | Document format options query |
| `use-document-progress.ts` | Document processing progress polling |
| `use-documents.ts` | Document list with pagination |
| `useEscalationDetail.ts` | Single escalation case detail |
| `useEscalationList.ts` | Escalation case list with filtering |
| `use-exchange-rates.ts` | Exchange rate CRUD hooks |
| `use-field-definition-sets.ts` | Field definition set CRUD hooks |
| `use-field-mapping-configs.ts` | Field mapping config query and mutation |
| `use-format-analysis.ts` | Format analysis data fetching |
| `use-format-detail.ts` | Single format detail query |
| `use-format-files.ts` | Format-associated files list |
| `use-forwarder-detail.ts` | Forwarder detail (deprecated, use company) |
| `useForwarderList.ts` | Forwarder list (deprecated, use company) |
| `use-forwarders.ts` | Forwarder list query (deprecated) |
| `use-health-monitoring.ts` | System health monitoring queries |
| `use-historical-data.ts` | Historical data batch and file management |
| `use-historical-file-detail.ts` | Historical file full detail query |
| `useImpactAnalysis.ts` | Rule change impact analysis report |
| `use-logs.ts` | System log queries (list/detail/stats/export/stream) |
| `use-monthly-report.ts` | Monthly cost report history and generation |
| `use-n8n-health.ts` | n8n connection health status queries |
| `use-outlook-config.ts` | Outlook config CRUD and connection test |
| `use-pending-companies.ts` | Pending-review company list query |
| `use-performance.ts` | Performance monitoring data (overview/timeseries/slowest) |
| `use-pipeline-configs.ts` | Pipeline config CRUD hooks |
| `useProcessingStats.ts` | City processing volume statistics |
| `use-profile.ts` | User profile query and update |
| `use-prompt-configs.ts` | Prompt config query and mutation |
| `use-reference-numbers.ts` | Reference number CRUD hooks |
| `use-regions.ts` | Region list query |
| `use-restore.ts` | Data restore records and operations |
| `useRetention.ts` | Data retention policy CRUD |
| `useReviewDetail.ts` | Review detail data (document + fields + queue) |
| `useReviewQueue.ts` | Review queue list with auto-refresh |
| `use-roles.ts` | Role CRUD hooks |
| `use-rollback.ts` | Rollback history query |
| `use-sharepoint-config.ts` | SharePoint config CRUD and connection test |
| `useSuggestionDetail.ts` | Rule suggestion detail query |
| `useSuggestionList.ts` | Rule suggestion list with filtering |
| `use-system-config.ts` | System config query, update, rollback |
| `use-system-settings.ts` | System settings CRUD hooks |
| `use-template-field-mappings.ts` | Template field mapping CRUD with 3-tier resolution |
| `use-template-instances.ts` | Template instance CRUD hooks |
| `use-term-aggregation.ts` | Term aggregation stats and trigger |
| `use-term-analysis.ts` | Term aggregation and AI classification |
| `useTraceability.ts` | Document source tracing and report generation |
| `use-users.ts` | User management (list/create/update) |
| `useVersions.ts` | Rule version history and rollback |
| `use-webhook-config.ts` | n8n webhook config CRUD and test |
| `useWorkflowError.ts` | Workflow error detail and statistics |
| `useWorkflowExecutions.ts` | Workflow execution list and detail |
| `useWorkflowTrigger.ts` | Manual workflow trigger and retry |

### Mutation-Only — 13 files

| File | Purpose |
|------|---------|
| `useApproveReview.ts` | Submit review approval mutation |
| `useCreateRule.ts` | Create mapping rule suggestion mutation |
| `useEscalateReview.ts` | Escalate review case mutation |
| `useResolveEscalation.ts` | Resolve escalation (approve/correct/reject) |
| `useRuleApprove.ts` | Approve rule suggestion mutation |
| `useRuleEdit.ts` | Edit rule via change request mutation |
| `useRulePreview.ts` | Preview rule extraction on document |
| `useRuleReject.ts` | Reject rule suggestion mutation |
| `useRuleTest.ts` | Start/cancel batch rule test |
| `useRuleVersion.ts` | Rule cache version polling and invalidation |
| `useSaveCorrections.ts` | Submit field corrections mutation |
| `useSimulation.ts` | Run rule simulation on historical data |
| `useTestRule.ts` | Test mapping rule pattern extraction |

### UI / Utility — 15 files

| File | Purpose |
|------|---------|
| `use-auth.ts` | Client-side auth state (session/role/permissions) |
| `use-batch-progress.ts` | SSE subscription for batch processing progress |
| `useCityFilter.ts` | City filter synced to URL parameters |
| `use-debounce.ts` | Debounce value changes (delay-based) |
| `useDebounce.ts` | Debounce input for search optimization |
| `use-field-label.ts` | Resolve localized field labels from DataTemplate |
| `use-locale-preference.ts` | Manage user locale (LocalStorage + DB persistence) |
| `use-localized-date.ts` | Locale-aware date formatting hook |
| `use-localized-format.ts` | Unified date/number/currency formatting hook |
| `use-localized-toast.ts` | Internationalized toast notifications |
| `use-localized-zod.ts` | Localized Zod validation error messages |
| `useMediaQuery.ts` | Browser media query listener for responsive layout |
| `use-pdf-preload.ts` | PDF document preloading for faster preview |
| `use-toast.ts` | Toast notification state management (event-driven) |
| `useUserCity.ts` | User city access permissions and role checks |

---

## 2. Types (`src/types/`) — 93 files

### Document & Extraction (15 files)

| File | Domain |
|------|--------|
| `data-template.ts` | Data template structure |
| `document-format.ts` | Document format definition |
| `document-issuer.ts` | Document issuer identification |
| `document-progress.ts` | Processing progress tracking |
| `document-source.types.ts` | Document source (SharePoint/Outlook/Upload) |
| `extracted-field.ts` | Extracted field with confidence/position |
| `extraction.ts` | Extraction pipeline types |
| `extraction-v3.types.ts` | V3 three-stage extraction types |
| `format-matching.ts` | Format matching engine types |
| `invoice-fields.ts` | Invoice field definitions |
| `issuer-identification.ts` | Issuer identification result types |
| `template-field-mapping.ts` | Template-to-field mapping types |
| `template-instance.ts` | Template instance and row types |
| `template-matching-engine.ts` | Template matching engine types |
| `unified-processor.ts` | Unified document processor types |

### Company & Rules (11 files)

| File | Domain |
|------|--------|
| `company.ts` | Company entity types |
| `company-filter.ts` | Company list filter params |
| `forwarder.ts` | Forwarder entity (legacy) |
| `forwarder-filter.ts` | Forwarder filter (legacy) |
| `field-mapping.ts` | Field mapping configuration |
| `rule.ts` | Mapping rule entity |
| `rule-test.ts` | Rule testing types |
| `suggestion.ts` | Rule suggestion types |
| `term-learning.ts` | Term learning types |
| `term-validation.ts` | Term validation types |
| `pattern.ts` | Pattern detection types |

### Review & Workflow (8 files)

| File | Domain |
|------|--------|
| `escalation.ts` | Escalation case types |
| `review.ts` | Review queue and detail types |
| `change-request.ts` | Change request workflow types |
| `change-tracking.ts` | Change tracking types |
| `workflow-error.ts` | Workflow error types |
| `workflow-execution.ts` | Workflow execution types |
| `workflow-trigger.ts` | Workflow trigger types |
| `traceability.ts` | Document traceability chain types |

### Confidence & Routing (3 files)

| File | Domain |
|------|--------|
| `confidence.ts` | Confidence score types |
| `routing.ts` | Confidence routing decision types |
| `prompt-resolution.ts` | Prompt resolution result types |

### Admin & Monitoring (12 files)

| File | Domain |
|------|--------|
| `alerts.ts` | Alert entity types |
| `alert-service.ts` | Alert service types |
| `backup.ts` | Backup entity types |
| `config.ts` | System config types |
| `dynamic-config.ts` | Dynamic config types |
| `health-monitoring.ts` | Health check types |
| `logging.ts` | Logging types |
| `monitoring.ts` | Monitoring types |
| `performance.ts` | Performance metrics types |
| `restore.ts` | Data restore types |
| `retention.ts` | Data retention types |
| `version.ts` | Version tracking types |

### Reports & Analytics (9 files)

| File | Domain |
|------|--------|
| `accuracy.ts` | Accuracy metrics types |
| `ai-cost.ts` | AI cost tracking types |
| `city-cost.ts` | City cost aggregation types |
| `dashboard.ts` | Dashboard widget types |
| `dashboard-filter.ts` | Dashboard filter params |
| `monthly-report.ts` | Monthly report types |
| `regional-report.ts` | Regional report types |
| `report-export.ts` | Report export config types |
| `processing-statistics.ts` | Processing statistics types |

### Auth & User (6 files)

| File | Domain |
|------|--------|
| `next-auth.d.ts` | NextAuth session augmentation |
| `permissions.ts` | Permission enum/types |
| `permission-categories.ts` | Permission category grouping |
| `role.ts` | Role entity types |
| `role-permissions.ts` | Role-permission mapping types |
| `user.ts` | User entity types |

### Prompt Config (3 files)

| File | Domain |
|------|--------|
| `prompt-config.ts` | Prompt config entity and enums |
| `prompt-config-ui.ts` | Prompt config UI display types |
| `prompt-resolution.ts` | Prompt resolution types |

### External API (10 files in `external-api/`)

| File | Domain |
|------|--------|
| `index.ts` | Barrel export |
| `auth.ts` | API key auth types |
| `query.ts` | External query params |
| `response.ts` | Standardized API response |
| `result.ts` | Processing result types |
| `status.ts` | Status tracking types |
| `steps.ts` | Processing step types |
| `submission.ts` | Document submission types |
| `validation.ts` | Input validation types |
| `webhook.ts` | Webhook payload types |

### Integration & Config (17 files)

| File | Domain |
|------|--------|
| `audit.ts` | Audit entity types |
| `audit-query.ts` | Audit query params |
| `audit-report.ts` | Audit report types |
| `batch-company.ts` | Batch company processing |
| `batch-term-aggregation.ts` | Batch term aggregation |
| `date-range.ts` | Date range filter types |
| `exchange-rate.ts` | Exchange rate types |
| `reference-number.ts` | Reference number types |
| `region.ts` | Region entity types |
| `n8n.ts` | n8n workflow types |
| `outlook.ts` | Outlook integration types |
| `outlook-config.types.ts` | Outlook config types |
| `sharepoint.ts` | SharePoint integration types |
| `impact.ts` | Rule impact analysis types |
| `documentation.ts` | Documentation types |
| `sdk-examples.ts` | External API SDK example types |
| `index.ts` | Barrel export |

---

## 3. Lib (`src/lib/`) — 68 files

### `audit/` (2 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `logger.ts` | Structured audit event logger |

### `auth/` (2 files) + root auth (2 files)

| File | Purpose |
|------|---------|
| `auth/index.ts` | Barrel export |
| `auth/api-key.service.ts` | API key validation service |
| `auth/city-permission.ts` | City-based permission checks |
| `auth.ts` | NextAuth v5 configuration (root) |
| `auth.config.ts` | Auth providers and callbacks |

### `azure/` (2 files) + root (1 file)

| File | Purpose |
|------|---------|
| `azure/index.ts` | Barrel export |
| `azure/storage.ts` | Azure Blob Storage client wrapper |
| `azure-blob.ts` | Legacy blob upload/download helpers |

### `confidence/` (4 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `calculator.ts` | Multi-dimension confidence score calculator |
| `thresholds.ts` | Confidence threshold definitions |
| `utils.ts` | Confidence utility functions |

### `constants/` (3 files)

| File | Purpose |
|------|---------|
| `api-auth.ts` | API authentication constants |
| `error-types.ts` | RFC 7807 error type constants |
| `source-types.ts` | Document source type constants |

### `errors/` (1 file) + root (1 file)

| File | Purpose |
|------|---------|
| `errors.ts` | Base error classes and RFC 7807 helpers |
| `errors/prompt-resolution-errors.ts` | Prompt resolution specific errors |

### `learning/` (3 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `correctionAnalyzer.ts` | Analyze user corrections for patterns |
| `ruleSuggestionTrigger.ts` | Trigger rule suggestions from corrections |

### `metrics/` (2 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `prompt-metrics.ts` | Prompt performance metrics collection |

### `middleware/` (1 file)

| File | Purpose |
|------|---------|
| `n8n-api.middleware.ts` | n8n API request auth middleware |

### `pdf/` (2 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `coordinate-transform.ts` | PDF coordinate transformation utils |

### `prompts/` (3 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `extraction-prompt.ts` | Static extraction prompt templates |
| `optimized-extraction-prompt.ts` | Optimized extraction prompts |

### `reports/` (5 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `excel-generator.ts` | Excel report generation (ExcelJS) |
| `excel-i18n.ts` | Excel column/header translations |
| `hierarchical-terms-excel.ts` | Hierarchical term analysis Excel export |
| `pdf-generator.ts` | PDF report generation (pdfkit) |

### `routing/` (3 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `config.ts` | Confidence routing thresholds config |
| `router.ts` | Confidence-based routing decision engine |

### `upload/` (2 files)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `constants.ts` | Upload file size/type constraints |

### `utils/` (1 file)

| File | Purpose |
|------|---------|
| `string.ts` | String manipulation utilities |

### `validations/` (9 files)

| File | Purpose |
|------|---------|
| `exchange-rate.schema.ts` | Exchange rate Zod validation schema |
| `field-definition-set.schema.ts` | Field definition set Zod schema |
| `outlook-config.schema.ts` | Outlook config Zod schema |
| `pipeline-config.schema.ts` | Pipeline config Zod schema |
| `prompt-config.schema.ts` | Prompt config Zod schema |
| `reference-number.schema.ts` | Reference number Zod schema |
| `region.schema.ts` | Region Zod schema |
| `role.schema.ts` | Role Zod schema |
| `user.schema.ts` | User Zod schema |

### Root-level utilities (14 files)

| File | Purpose |
|------|---------|
| `prisma.ts` | Prisma client singleton |
| `prisma-change-tracking.ts` | Prisma middleware for change tracking |
| `db-context.ts` | Database context with city-based RLS |
| `utils.ts` | General utilities (cn, etc.) |
| `url-params.ts` | URL parameter parsing helpers |
| `date-range-utils.ts` | Date range calculation utilities |
| `document-status.ts` | Document status transition logic |
| `email.ts` | Nodemailer email sending |
| `encryption.ts` | AES encryption/decryption |
| `hash.ts` | Hash generation utilities |
| `notification.ts` | Notification dispatch service |
| `password.ts` | Password hashing (bcrypt) |
| `token.ts` | JWT token generation/verification |
| `i18n-api-error.ts` | API error internationalization |
| `i18n-currency.ts` | Currency formatting by locale |
| `i18n-date.ts` | Date formatting by locale |
| `i18n-number.ts` | Number formatting by locale |
| `i18n-zod.ts` | Zod validation message localization |

---

## 4. Stores (`src/stores/`) — 2 files

### `reviewStore.ts` — Review Workflow UI State

| State Field | Type | Purpose |
|-------------|------|---------|
| `selectedFieldId` | `string \| null` | Currently selected field (linked to PDF highlight) |
| `selectedFieldPosition` | `FieldSourcePosition \| null` | PDF bounding box of selected field |
| `editingFieldId` | `string \| null` | Field currently being edited |
| `currentPage` | `number` | PDF page number (1-indexed) |
| `zoomLevel` | `number` | PDF zoom level (0.5-3.0) |
| `dirtyFields` | `Set<string>` | Modified field IDs |
| `pendingChanges` | `Map<string, string>` | fieldId to new value |
| `originalValues` | `Map<string, string \| null>` | fieldId to original value |
| `fieldNames` | `Map<string, string>` | fieldId to field name |

**Actions**: setSelectedField, setCurrentPage, setZoomLevel, startEditing, stopEditing, markFieldDirty, clearDirtyField, resetChanges, hasPendingChanges, getPendingCorrections, resetStore

### `document-preview-test-store.ts` — Document Preview Test Page State

| State Field | Type | Purpose |
|-------------|------|---------|
| `currentFile` | `UploadedFile \| null` | Currently uploaded file |
| `processingStatus` | `ProcessingStatus` | idle/uploading/processing/completed/error |
| `processingProgress` | `number` | Progress 0-100 |
| `error` | `ProcessingError \| null` | Error details |
| `extractedFields` | `ExtractedField[]` | Extracted field list |
| `selectedFieldId` | `string \| null` | Selected field (linked to PDF) |
| `fieldFilters` | `FieldFilterState` | Search/confidence/source filters |
| `currentScope` | `ConfigScope` | GLOBAL/COMPANY/FORMAT |
| `mappingRules` | `VisualMappingRule[]` | Current mapping rules |
| `currentPage/totalPages/zoomLevel` | `number` | PDF viewer state |

**Selector hooks**: useFileState, useFieldsState, useMappingState, usePdfState (all use `useShallow` to prevent re-render loops)

---

## 5. Validations (`src/validations/`) — 6 files

| File | Schemas |
|------|---------|
| `auth.ts` | Register, login, password reset Zod schemas |
| `data-template.ts` | Field validation rules, template fields, create/update template |
| `document-format.ts` | Recognition rules, format create/update schemas |
| `template-field-mapping.ts` | Transform params, mapping rules, create/update config |
| `template-instance.ts` | Instance create/update, row data, status transition |
| `template-matching.ts` | Match execution, preview, validation API input schemas |

---

## 6. Constants (`src/constants/`) — 5 files

| File | Content |
|------|---------|
| `processing-steps.ts` | V2 unified processor 11-step pipeline config (priority/timeout/retry) |
| `processing-steps-v3.ts` | V3 extraction 7-step pipeline config |
| `prompt-config-list.ts` | List display constants (INITIAL_DISPLAY_COUNT=6, LOAD_MORE_INCREMENT=6) |
| `stage-prompt-templates.ts` | Stage 1-3 default prompt templates (variable + example versions) |
| `standard-fields.ts` | Standard field definitions (basic/vendor/logistics/cost/amount categories) |

---

## 7. Config (`src/config/`) — 2 files

| File | Content |
|------|---------|
| `feature-flags.ts` | Dynamic prompt flags + Extraction V3/V3.1 flags with canary routing |
| `index.ts` | Barrel export for feature flags |

**Feature flag groups**: Dynamic Prompt (5 flags), Extraction V3 (6 flags), Extraction V3.1 (3 flags)

---

## 8. i18n (`src/i18n/`) — 3 files

| File | Content |
|------|---------|
| `config.ts` | Locales (`en`, `zh-TW`, `zh-CN`), defaultLocale, names, HTML lang |
| `routing.ts` | next-intl routing (localePrefix: always) + navigation helpers (Link, useRouter, usePathname) |
| `request.ts` | Server-side translation loading for 34 namespaces with fallback chain |

---

## 9. Other Support Directories

### Contexts (`src/contexts/`) — 2 files

| File | Purpose |
|------|---------|
| `DashboardFilterContext.tsx` | Unified dashboard filter (date range + company + city) |
| `DateRangeContext.tsx` | Global date range state with URL sync |

### Events (`src/events/`) — 1 file

| File | Purpose |
|------|---------|
| `handlers/document-processed.handler.ts` | Post-processing event: update stats, non-blocking |

### Middlewares (`src/middlewares/`) — 5 files

| File | Purpose |
|------|---------|
| `audit-log.middleware.ts` | Auto audit logging HOF for API routes |
| `city-filter.ts` | City-based data filtering (Prisma where clause builder) |
| `external-api-auth.ts` | Bearer token + API key + IP whitelist auth |
| `resource-access.ts` | Resource-level city access verification |
| `index.ts` | Barrel export |

### Providers (`src/providers/`) — 3 files

| File | Purpose |
|------|---------|
| `AuthProvider.tsx` | NextAuth v5 SessionProvider wrapper |
| `QueryProvider.tsx` | React Query QueryClient + defaults |
| `ThemeProvider.tsx` | next-themes provider (light/dark/system) |

### Jobs (`src/jobs/`) — 2 files

| File | Purpose |
|------|---------|
| `pattern-analysis-job.ts` | Scheduled pattern analysis (manual trigger / n8n cron) |
| `webhook-retry-job.ts` | Retry failed webhook deliveries (manual trigger / n8n cron) |

---

## Summary

| Directory | Files | Role |
|-----------|-------|------|
| `src/hooks/` | 104 | React Query data fetching + UI utilities |
| `src/types/` | 93 | TypeScript type definitions across all domains |
| `src/lib/` | 68 | Core utilities (auth, DB, PDF, reports, i18n, validation schemas) |
| `src/stores/` | 2 | Zustand UI state (review workflow + preview test page) |
| `src/validations/` | 6 | Zod schemas for templates, auth, formats |
| `src/lib/validations/` | 9 | Zod schemas for admin entities (roles, users, configs) |
| `src/constants/` | 5 | Processing pipeline configs, standard fields, prompt templates |
| `src/config/` | 2 | Feature flags (dynamic prompts, V3/V3.1 extraction) |
| `src/i18n/` | 3 | Internationalization config (3 locales, 34 namespaces) |
| `src/contexts/` | 2 | React Contexts (dashboard filter, date range) |
| `src/events/` | 1 | Event handler (document processed) |
| `src/middlewares/` | 5 | API middlewares (audit, city filter, external auth, access) |
| `src/providers/` | 3 | App-level providers (auth, query, theme) |
| `src/jobs/` | 2 | Scheduled jobs (pattern analysis, webhook retry) |
| **Total** | **305** | |
