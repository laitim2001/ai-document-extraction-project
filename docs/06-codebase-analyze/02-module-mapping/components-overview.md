# Components Layer Overview

> Generated: 2026-04-09 | Scope: `src/components/**` | 371 TSX files across 12 directories

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total TSX files** | 371 |
| **Client components** (`'use client'` or `"use client"`) | 360 (97.0%) |
| **Server components** | 11 (3.0%) |
| **Top-level directories** | 12 (+ `layouts/` empty placeholder) |
| **features/ subdirectories** | 38 |

### State Management Patterns (usage across 371 files)

| Pattern | Files Using | Notes |
|---------|-------------|-------|
| next-intl (`useTranslations`) | 209 (56%) | Pervasive i18n adoption |
| React Hook Form (`useForm`) | 34 (9%) | All form-heavy components |
| React Query (`useQuery/useMutation`) | 23 (6%) | Data fetching in feature components |
| Zustand stores | 4 (1%) | Only `reviewStore` (4 files) |
| @dnd-kit (drag & drop) | 2 | `MappingRuleList.tsx`, `SortableRuleItem.tsx` |

### Most Imported UI Primitives (Top 15)

> Counts scoped to `src/components/` only. Full project counts (including `src/app/`) are higher (e.g., button 272, badge 155, card 152).

| UI Component | Import Count | UI Component | Import Count |
|--------------|-------------|--------------|-------------|
| button | 221 | textarea | 44 |
| badge | 139 | tooltip | 32 |
| card | 106 | checkbox | 30 |
| input | 84 | alert-dialog | 30 |
| select | 75 | scroll-area | 27 |
| skeleton | 70 | dropdown-menu | 27 |
| label | 66 | tabs | 24 |
| table | 56 | switch | 24 |
| dialog | 51 | form | 23 |
| alert | 51 | separator | 20 |

### Most Used Custom Hooks (Top 10)

| Hook | Files | Hook | Files |
|------|-------|------|-------|
| use-toast | 37 | use-users | 5 |
| use-template-instances | 7 | useRetention | 5 |
| use-roles | 7 | use-cities | 5 |
| useUserCity | 6 | use-restore | 4 |
| use-reference-numbers | 6 | use-logs | 4 |
| use-historical-file-detail | 6 | use-field-label | 4 |
| use-field-definition-sets | 6 | use-exchange-rates | 4 |

---

## Directory Breakdown

### 1. `ui/` -- 34 files (shadcn/ui primitives)

| File | Client | File | Client |
|------|--------|------|--------|
| accordion | Y | pagination | Y |
| alert | N | popover | Y |
| alert-dialog | Y | progress | Y |
| avatar | Y | radio-group | Y |
| badge | N | resizable | Y |
| button | N | scroll-area | Y |
| calendar | Y | select | Y |
| card | N | separator | Y |
| checkbox | Y | skeleton | N |
| collapsible | Y | slider | Y |
| command | Y | switch | Y |
| dialog | Y | table | N |
| dropdown-menu | Y | tabs | Y |
| form | Y | textarea | N |
| input | N | toast | Y |
| label | Y | toaster | Y |
| month-picker | Y | tooltip | Y |

Client: 26 / Server: 8. Server components are pure presentational wrappers (alert, badge, button, card, input, skeleton, table, textarea). Note: some files use `"use client"` (double quotes) rather than `'use client'` (single quotes).

### 2. `layout/` -- 5 files (all client)

| File | Purpose |
|------|---------|
| CityIndicator.tsx | Displays user's active city badge |
| DashboardHeader.tsx | Dashboard page header with breadcrumbs |
| DashboardLayout.tsx | Main dashboard layout container with sidebar |
| Sidebar.tsx | i18n-enabled sidebar navigation with collapsible sections |
| TopBar.tsx | Top toolbar with user menu, locale switcher, notifications |

### 3. `dashboard/` -- 10 files (all client)

| File | Purpose |
|------|---------|
| AccessDeniedAlert.tsx | Permission-denied alert banner |
| ControlledDateRangePicker.tsx | Controlled date range input with form integration |
| DashboardFilters.tsx | Dashboard filter wrapper (date range + forwarder) |
| DashboardStats.tsx | Stats container fetching dashboard KPIs |
| DashboardStatsWithDateRange.tsx | Stats wrapper with date range context |
| DateRangePicker.tsx | Standalone date range picker |
| DateRangeQuickSelect.tsx | Quick presets (7d, 30d, 90d, YTD) |
| ForwarderComparisonChart.tsx | Bar/line chart comparing forwarder metrics |
| ForwarderMultiSelect.tsx | Multi-select dropdown for forwarder filtering |
| StatCard.tsx | Single KPI stat card with trend indicator |

### 4. `reports/` -- 7 files (all client)

| File | Purpose |
|------|---------|
| AiCostReportContent.tsx | AI cost breakdown report view |
| CityComparisonTable.tsx | City-by-city metric comparison table |
| CityCostReportContent.tsx | Per-city cost report content |
| CityDetailPanel.tsx | Detailed city drill-down panel |
| ExportDialog.tsx | Report export dialog (PDF/Excel) |
| MonthlyReportDialog.tsx | Monthly cost allocation report generator |
| RegionalReportContent.tsx | Regional summary report view |

### 5. `audit/` -- 3 files (all client)

| File | Purpose |
|------|---------|
| AuditQueryForm.tsx | Audit trail search form with date/user/action filters |
| AuditResultTable.tsx | Paginated audit query results table |
| DocumentTraceView.tsx | Full document processing trace visualization |

### 6. `filters/` -- 2 files (all client)

| File | Purpose |
|------|---------|
| CityFilter.tsx | City filter with URL query param sync |
| CityMultiSelect.tsx | Multi-city selection dropdown |

### 7. Single-file directories (all client)

| Directory | File | Purpose |
|-----------|------|---------|
| `admin/` | PerformanceDashboard.tsx | System performance metrics dashboard |
| `analytics/` | CityComparison.tsx | City comparison analytics view |
| `auth/` | CityRestricted.tsx | RBAC wrapper restricting access by city |
| `export/` | MultiCityExportDialog.tsx | Multi-city batch export dialog |

### 8. `layouts/` -- 0 files (empty placeholder with `.gitkeep`)

---

## `features/` Directory -- 306 files across 38 subdirectories

### Features by File Count

| Subdirectory | Files | Domain | Subdirectory | Files | Domain |
|-------------|-------|--------|-------------|-------|--------|
| admin | 47 | System Admin | exchange-rate | 6 | Finance |
| review | 27 | Document Review | suggestions | 6 | AI Rules |
| rules | 22 | Mapping Rules | escalation | 6 | Escalation |
| formats | 17 | Format Config | data-template | 5 | Templates |
| historical-data | 16 | Data Import | document-source | 5 | Doc Sources |
| template-instance | 13 | Template Data | retention | 5 | Data Lifecycle |
| forwarders | 12 | Company Mgmt | pipeline-config | 4 | Pipeline |
| template-field-mapping | 11 | Field Mapping | global | 4 | Global View |
| document | 11 | Document Core | docs | 4 | API Docs |
| document-preview | 10 | PDF Preview | confidence | 3 | Confidence |
| prompt-config | 10 | Prompt Mgmt | audit | 3 | Audit |
| mapping-config | 9 | Mapping Config | auth | 3 | Auth Forms |
| reference-number | 8 | Ref Numbers | outlook | 3 | Outlook |
| field-definition-set | 7 | Field Defs | rule-version | 3 | Rule Versions |
| reports | 3 | Reports | companies | 2 | Companies |
| rule-review | 6 | Rule Review | format-analysis | 2 | Format Drill |
| template-match | 5 | Template Match | history | 2 | Change History |
| | | | locale | 1 | i18n Switch |
| | | | region | 1 | Region Select |
| | | | term-analysis | 2 | Term Analysis |
| | | | sharepoint | 2 | SharePoint |

Client: 303 / Server: 3 (ConfidenceIndicator, PdfLoadingSkeleton, ReviewQueueSkeleton)

---

### features/admin (47 files, 9 sub-modules)

| Sub-module | Files | Components |
|-----------|-------|------------|
| **alerts** | 5 | AlertDashboard, AlertHistory, AlertRuleManagement, AlertRuleTable, CreateAlertRuleDialog |
| **api-keys** | 3 | ApiKeyManagement, ApiKeyTable, CreateApiKeyDialog |
| **backup** | 7 | BackupList, BackupManagement, BackupScheduleList, BackupStatusCard, CreateBackupDialog, ScheduleDialog, StorageUsageCard |
| **config** | 4 | ConfigEditDialog, ConfigHistoryDialog, ConfigItem, ConfigManagement |
| **logs** | 4 | LogDetailDialog, LogExportDialog, LogStreamPanel, LogViewer |
| **monitoring** | 1 | HealthDashboard |
| **restore** | 4 | RestoreDetailDialog, RestoreDialog, RestoreList, RestoreManagement |
| **roles** | 5 | AddRoleDialog, DeleteRoleDialog, EditRoleDialog, PermissionSelector, RoleList |
| **settings** | 4 | DataRetentionForm, GeneralSettingsForm, NotificationSettingsForm, SettingsCard |

Admin total: 37 files are dialogs/forms/tables; 10 are dashboards/cards.

### features/review (27 files) -- Document Review Workflow

| Component | Purpose |
|-----------|---------|
| ReviewQueue.tsx | Main review queue list page |
| ReviewQueueTable.tsx | Paginated review queue data table |
| ReviewPanel.tsx | Side panel for reviewing a single document |
| ReviewDetailLayout.tsx | Split-view layout: PDF left + fields right |
| ReviewActions.tsx | Approve/reject/escalate action buttons |
| ReviewFilters.tsx | Queue filters (status, confidence, company) |
| FieldEditor.tsx | Editable extracted field with correction tracking |
| FieldGroup.tsx | Grouped fields by category |
| FieldRow.tsx | Single field row with confidence indicator |
| QuickReviewMode.tsx | Streamlined review for high-confidence items |
| ApprovalConfirmDialog.tsx | Approval confirmation with notes |
| CorrectionTypeDialog.tsx | Dialog for selecting correction type |
| CorrectionTypeSelector.tsx | Correction type radio selector |
| EscalationDialog.tsx | Escalation to supervisor dialog |
| LowConfidenceFilter.tsx | Filter for low-confidence fields only |
| UnsavedChangesGuard.tsx | Warns before navigating away with unsaved edits |
| ValidationMessage.tsx | Field-level validation message display |
| ConfidenceBadge.tsx | Color-coded confidence score badge |
| ConfidenceIndicator.tsx | Visual confidence bar (server component) |
| ConfidenceTooltip.tsx | Confidence score breakdown tooltip |
| ProcessingPathBadge.tsx | AUTO/QUICK/FULL routing path badge |
| PdfViewer.tsx | PDF viewer container for review |
| DynamicPdfViewer.tsx | Lazy-loaded PDF viewer |
| PdfToolbar.tsx | PDF zoom/page navigation toolbar |
| PdfHighlightOverlay.tsx | Highlights extracted fields on PDF |
| PdfLoadingSkeleton.tsx | PDF loading placeholder (server component) |
| ReviewQueueSkeleton.tsx | Queue loading placeholder (server component) |

### features/rules (22 files) -- Mapping Rule Management

| Component | Purpose |
|-----------|---------|
| RuleList.tsx | Main rule listing page |
| RuleTable.tsx | Paginated rules data table |
| RuleFilters.tsx | Rule search/filter bar |
| RuleDetailView.tsx | Full rule detail page |
| RuleCreationPanel.tsx | New rule creation wizard |
| NewRuleForm.tsx | Rule creation form with validation |
| RuleEditDialog.tsx | Edit existing rule dialog |
| RuleEditForm.tsx | Rule edit form fields |
| RulePreviewPanel.tsx | Rule impact preview before save |
| RuleTestPanel.tsx | Test rule against sample documents |
| RuleTestConfig.tsx | Configure test parameters |
| TestResultComparison.tsx | Before/after test result diff |
| RulePatternViewer.tsx | View rule matching patterns |
| BulkRuleActions.tsx | Bulk enable/disable/delete actions |
| RuleStats.tsx | Rule usage statistics |
| RuleSummaryCards.tsx | Summary KPI cards for rules |
| RuleStatusBadge.tsx | Active/inactive/draft status badge |
| AccuracyMetrics.tsx | Rule accuracy over time metrics |
| ExtractionTypeIcon.tsx | Icon for extraction type (OCR/AI/Manual) |
| ImpactStatistics.tsx | Rule change impact statistics |
| RecentApplicationsTable.tsx | Recent rule application log |
| RuleListSkeleton.tsx | Loading skeleton for rule list |

### features/formats (17 files) -- Format Configuration

| Component | Purpose |
|-----------|---------|
| FormatList.tsx | Format listing with cards/table toggle |
| FormatCard.tsx | Single format summary card |
| FormatDetailView.tsx | Full format detail page |
| FormatForm.tsx | Format create/edit form |
| FormatBasicInfo.tsx | Basic format info section |
| FormatFilters.tsx | Format search filters |
| FormatFilesTable.tsx | Files associated with a format |
| FormatTermsTable.tsx | Term mappings within a format |
| FormatConfigPanel.tsx | Format configuration settings panel |
| ConfigInheritanceInfo.tsx | Shows config inheritance chain |
| CreateFormatDialog.tsx | New format creation dialog |
| IdentificationRulesEditor.tsx | Format identification rule editor |
| KeywordTagInput.tsx | Tag-style keyword input |
| LogoPatternEditor.tsx | Logo pattern matching editor |
| LinkedMappingConfig.tsx | Linked mapping configuration viewer |
| LinkedPromptConfig.tsx | Linked prompt configuration viewer |
| SourceFieldCombobox.tsx | Source field autocomplete combobox |

### features/historical-data (16 files) -- Historical Data Import

Components: BatchFileUploader, BatchProgressPanel, BatchSummaryCard, BatchErrorList, CreateBatchDialog, ExtractionResultPanel, FileInfoCard, HierarchicalTermsExportButton, HistoricalBatchList, HistoricalFileList, IssuerIdentificationPanel, LineItemsTable, ProcessingConfirmDialog, ProcessingTimeline, RawJsonViewer, TermAggregationSummary

### features/template-instance (13 files) -- Template Data Instances

Components: AddFileDialog, BulkActionsMenu, CreateInstanceDialog, ExportDialog, ExportFieldSelector, InstanceRowsTable, InstanceStatsOverview, RowDetailDrawer, RowEditDialog, TemplateInstanceCard, TemplateInstanceDetail, TemplateInstanceFilters, TemplateInstanceList

### features/forwarders (12 files) -- Company/Forwarder Management

Components: ForwarderActions, ForwarderDetailView, ForwarderFilters, ForwarderForm, ForwarderInfo, ForwarderList, ForwarderRulesTable, ForwarderStatsPanel, ForwarderTable, ForwarderTableSkeleton, LogoUploader, RecentDocumentsTable

### features/template-field-mapping (11 files) -- Field Mapping Config

Components: ClassifiedAsCombobox, FormulaEditor, LookupTableEditor, MappingRuleEditor, MappingRuleItem, MappingTestPanel, SourceFieldSelector, TargetFieldSelector, TemplateFieldMappingForm, TemplateFieldMappingList, TransformConfigEditor

### features/document (11 files) -- Document Core

Components: AiDetailsTab, DocumentAuditLog, DocumentDetailHeader, DocumentDetailStats, DocumentDetailTabs, DocumentListTable, FileUploader, ProcessingStatus, ProcessingTimeline, RetryButton, SmartRoutingBanner

### features/document-preview (10 files) -- PDF Preview

Components: DynamicPDFViewer, ExtractedFieldsPanel, FieldCard, FieldFilters, FieldHighlightOverlay, LineItemsTable, PDFControls, PDFErrorDisplay, PDFLoadingSkeleton, PDFViewer

### features/prompt-config (10 files) -- Prompt Management

Components: CollapsibleControls, CollapsiblePromptGroup, PromptConfigFilters, PromptConfigForm, PromptConfigList, PromptEditor, PromptTemplateInserter, PromptTester, ShowMoreButton, TemplatePreviewDialog

### features/mapping-config (9 files) -- Mapping Configuration

Components: ConfigSelector, MappingConfigPanel, MappingPreview, MappingRuleList (dnd-kit), RuleEditor, SortableRuleItem (dnd-kit), SourceFieldSelector, TargetFieldSelector, TransformConfigPanel

### Remaining features/ (17 subdirectories, 65 files total)

| Subdirectory | Files | Key Components |
|-------------|-------|----------------|
| reference-number | 8 | List, Form, Filters, Import/Export dialogs, Status/Type badges |
| field-definition-set | 7 | List, Form, FieldCandidatePicker, FieldEntryEditor, CoverageSummary, ScopeBadge |
| exchange-rate | 6 | List, Form, Filters, Calculator, CurrencySelect, ImportDialog |
| escalation | 6 | ListTable, Filters, ResolveDialog, Reason/Status badges, ListSkeleton |
| suggestions | 6 | ImpactAnalysisPanel, ImpactStatisticsCards, ImpactTimeline, RiskCasesTable, SimulationConfigForm, SimulationResultsPanel |
| rule-review | 6 | ReviewDetailPage, ApproveDialog, RejectDialog, ImpactSummaryCard, SampleCasesTable, SuggestionInfo |
| retention | 5 | Dashboard, PolicyList, ArchiveRecordList, DeletionRequestList, StorageMetricsCard |
| data-template | 5 | List, Card, Form, Filters, FieldEditor |
| document-source | 5 | Badge, Details, SourceTypeFilter, SourceTypeStats, SourceTypeTrend |
| template-match | 5 | BulkMatchDialog, DefaultTemplateSelector, MatchStatusBadge, MatchToTemplateDialog, ConfigAlert |
| pipeline-config | 4 | List, Form, Filters, ScopeBadge |
| global | 4 | CityRankings, GlobalStats, GlobalTrend, RegionView |
| docs | 4 | CodeBlock, LanguageTabs, SDKExamplesContent, SwaggerUIWrapper |
| confidence | 3 | ConfidenceBadge, ConfidenceBreakdown, ConfidenceIndicator |
| auth | 3 | DevLoginForm, LoginForm, RegisterForm |
| audit | 3 | AuditReportExportDialog, AuditReportJobList, ReportIntegrityDialog |
| outlook | 3 | OutlookConfigForm, OutlookConfigList, OutlookFilterRulesEditor |
| rule-version | 3 | RollbackConfirmDialog, VersionCompareDialog, VersionDiffViewer |
| reports | 3 | AiCostCard, CityCostTable, CostAnomalyDialog |
| companies | 2 | CompanyMergeDialog, CompanyTypeSelector |
| format-analysis | 2 | CompanyFormatTree, FormatTermsPanel |
| history | 2 | ChangeHistoryTimeline, HistoryVersionCompareDialog |
| sharepoint | 2 | SharePointConfigForm, SharePointConfigList |
| term-analysis | 2 | TermFilters, TermTable |
| locale | 1 | LocaleSwitcher |
| region | 1 | RegionSelect |

---

## Architectural Observations

1. **Overwhelmingly client-side**: 97.0% of components use `'use client'` or `"use client"`. Only 11 are server components (8 in `ui/` presentational primitives + 3 skeleton/indicator components in `features/review/`).

2. **i18n saturation**: 56% of all components import `useTranslations`, indicating strong internationalization adoption across the UI layer.

3. **Minimal Zustand usage**: Only 4 files reference Zustand stores (all `reviewStore`). Server state is managed via React Query hooks; most UI state is component-local or URL-driven.

4. **Form pattern**: 34 components use React Hook Form, primarily in admin settings, rule/format/template editors, and configuration forms.

5. **features/ dominates**: 306 of 371 files (82%) live under `features/`, with `admin` (47), `review` (27), and `rules` (22) as the three largest feature domains.

6. **Consistent component patterns**: Each feature domain follows a `List + Detail + Form + Filters + Dialog` pattern. Tables are paginated, dialogs handle create/edit/delete, and badges provide status visualization.

7. **Drag-and-drop**: Only used in `mapping-config/` (MappingRuleList + SortableRuleItem) for reordering mapping rules.

8. **Button is king**: Imported 221 times within `src/components/` (272 project-wide), nearly 2x the next most-used UI component (badge at 139 / 155 project-wide). Dialog (51) and alert-dialog (30) combined show heavy use of modal patterns.
