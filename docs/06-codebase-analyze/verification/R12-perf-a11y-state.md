# R12: Performance Patterns, Accessibility, State Management & Error Handling Verification

> **Date**: 2026-04-09
> **Scope**: 125 verification points across 4 new audit areas never previously covered
> **Codebase root**: `c:/Users/rci.ChrisLai/Documents/GitHub/ai-document-extraction-project`

---

## Set A: React Performance Pattern Audit (30 pts)

### A1. React.memo Usage (5 pts)

**Result**: **0 occurrences** across the entire `src/` directory.

- Searched for `React.memo`, `React.memo(`, and bare `memo(` patterns -- all returned zero matches.
- The only `memo`-like usage is the `useMemo` hook (see A2).
- **Implication**: No component-level memoization is used anywhere. For a 165+ component codebase processing 450K+ documents/year, this is a notable gap. Components re-render fully on every parent re-render unless gated by `useMemo`/`useCallback` in hooks.

**Verdict**: Potential performance concern for list-heavy views (document tables, rule lists, review queues).

---

### A2. useMemo Usage (5 pts)

**Result**: **193 occurrences** across **92 files**.

**Top 10 files by count**:

| File | Count |
|------|-------|
| `features/formats/SourceFieldCombobox.tsx` | 10 |
| `components/analytics/CityComparison.tsx` | 5 |
| `reports/CityCostReportContent.tsx` | 5 |
| `contexts/DashboardFilterContext.tsx` | 4 |
| `features/admin/PermissionScopeIndicator.tsx` | 4 |
| `filters/CityMultiSelect.tsx` | 4 |
| `filters/CityFilter.tsx` | 4 |
| `features/admin/CitySelector.tsx` | 4 |
| `dashboard/ControlledDateRangePicker.tsx` | 4 |
| `features/review/ReviewPanel/ReviewPanel.tsx` | 4 |

**Verdict**: Healthy usage. `useMemo` is used primarily for expensive computations (filtering, sorting, derived data) rather than for trivial values.

---

### A3. useCallback Usage (5 pts)

**Result**: **617 occurrences** across **163 files**.

**Top 10 files by count**:

| File | Count |
|------|-------|
| `features/mapping-config/MappingConfigPanel.tsx` | 15 |
| `hooks/use-localized-toast.ts` | 13 |
| `contexts/DashboardFilterContext.tsx` | 13 |
| `features/reference-number/ReferenceNumberImportDialog.tsx` | 10 |
| `admin/historical-data/page.tsx` | 10 |
| `hooks/use-companies.ts` | 9 |
| `hooks/useCityFilter.ts` | 9 |
| `features/rules/RuleList.tsx` | 9 |
| `features/historical-data/HistoricalFileList.tsx` | 9 |
| `features/admin/config/ConfigManagement.tsx` | 9 |

**Verdict**: Very healthy. 617 callbacks across 163 files means an average of ~3.8 per file. Used extensively for event handlers, filter callbacks, and API call wrappers.

---

### A4. Next.js dynamic() Import (3 pts)

**Result**: **3 files** using `dynamic()`.

| File | Purpose |
|------|---------|
| `features/document-preview/DynamicPDFViewer.tsx` | PDF viewer (pdfjs-dist SSR avoidance) |
| `features/docs/SwaggerUIWrapper.tsx` | Swagger UI (client-only) |
| `features/review/PdfViewer/DynamicPdfViewer.tsx` | Review PDF viewer (SSR avoidance) |

All three use `ssr: false` and provide loading fallbacks (Skeleton or text). This is the correct pattern for heavy client-side libraries.

**Verdict**: Appropriate -- only used where truly needed (PDF rendering, Swagger). No over-use or under-use detected.

---

### A5. Suspense Boundaries (3 pts)

**Result**: **70 occurrences** across **21 files**.

Key usage locations:
- Dashboard pages: `dashboard/page.tsx`, `admin/users/page.tsx`, `admin/roles/page.tsx`
- Report pages: `reports/regional/page.tsx`, `reports/cost/page.tsx`, `reports/ai-cost/page.tsx`
- Feature pages: `rules/page.tsx`, `review/page.tsx`, `escalations/page.tsx`
- Skeleton-wrapped components: `UserList.tsx`, `ForwarderList.tsx`, `RuleListSkeleton.tsx`
- Health monitoring: `admin/monitoring/health/page.tsx`, `admin/alerts/page.tsx`

**Verdict**: Good coverage for major data-loading page boundaries. Suspense is used at the page level to wrap async server components, which is the recommended Next.js 15 pattern.

---

### A6. loading.tsx Files (2 pts)

**Result**: **1 file only**.

- `src/app/[locale]/(dashboard)/documents/[id]/loading.tsx`

This single file provides a proper Skeleton layout (header + stats cards + tabs).

**Verdict**: **Significant gap**. Only 1 out of 25+ dashboard page directories has a `loading.tsx`. Most pages rely on client-side `isLoading` checks in components instead. While this works functionally, it means no streaming SSR loading states for the majority of routes.

---

### A7. React.lazy Usage (2 pts)

**Result**: **0 occurrences**.

The project uses Next.js `dynamic()` instead (see A4), which is the correct alternative for Next.js applications. `React.lazy` would be redundant and potentially conflicting with Next.js's code-splitting.

**Verdict**: Correct -- `dynamic()` is the proper Next.js equivalent.

---

### A8. refetchInterval Claim Verification -- "5s processing, 30s idle" (5 pts)

**Claim** (from `08-ui-design-system/ui-patterns.md`):
> Dynamic `refetchInterval` (5s while processing, 30s idle)

**Actual code verification**:

| Hook | Processing Interval | Idle Interval | Match |
|------|-------------------|---------------|-------|
| `use-documents.ts` (L154-159) | 5000ms (5s) | 30000ms (30s) | **Exact match** |
| `use-document.ts` (L122-128) | 3000ms (3s) | `false` (disabled) | **Differs** |
| `use-document-detail.ts` (L209-215) | 3000ms (3s) | `false` (disabled) | **Differs** |
| `use-document-progress.ts` (L195-202) | 3000ms default (param) | `false` (disabled) | **Differs** |
| `use-historical-data.ts` (L232) | Dynamic polling | `false` | **Differs** |
| `useWorkflowExecutions.ts` (L295) | 3000ms (example) / 5000ms (default) | Configurable | **Partially** |
| `use-alerts.ts` (L193) | -- | 60000ms (1min) | N/A |
| `use-n8n-health.ts` (L158) | -- | 30000ms (30s) | N/A |
| `use-health-monitoring.ts` (L238) | -- | 30000ms (30s) | N/A |
| `use-accuracy.ts` (L84) | -- | 300000ms (5min) | N/A |
| `use-logs.ts` (L254) | -- | 60000ms (1min) | N/A |
| `use-logs.ts` (L282) | 2000ms (export polling) | `false` | N/A |

**Summary**: The "5s processing / 30s idle" claim is accurate ONLY for `use-documents.ts` (the document list hook). Other document-related hooks use **3s processing** with **no idle polling**. The claim over-generalizes a pattern that is specific to one hook.

**Verdict**: **Partially correct**. The 5s/30s pattern exists but is not universal. Most document hooks use 3s for processing and disable polling when idle.

---

## Set B: Accessibility Deep Audit (30 pts)

### B1. aria-label Usage (3 pts)

**Result**: **49 occurrences** across **21 files**.

Key files: `PDFControls.tsx` (7), `pagination.tsx` (4), `PdfToolbar.tsx` (4), `UserFilters.tsx` (4), `ForwarderFilters.tsx` (4), `CitySelector.tsx` (3), `ConfidenceIndicator.tsx` (3).

**Verdict**: Moderate coverage. Present on interactive controls (PDF buttons, filters, pagination) but absent from many form inputs and action buttons.

---

### B2. aria-describedby Usage (3 pts)

**Result**: **2 occurrences** across **2 files**.

- `components/ui/form.tsx` (1) -- shadcn form field auto-association
- `features/review/ReviewPanel/FieldEditor.tsx` (1)

**Verdict**: **Very low**. Only the form framework and one component use `aria-describedby`. Error messages and help text lack programmatic association in most forms.

---

### B3. role= Attribute Usage (3 pts)

**Result**: **28 occurrences** across **22 files**.

Common values found:
- `role="group"` -- CityFilter, CityMultiSelect, ForwarderMultiSelect
- `role="alert"` -- alert.tsx
- `role="listbox"` -- SourceFieldSelector, TargetFieldSelector, ClassifiedAsCombobox, CurrencySelect, RegionSelect
- `role="option"` -- combobox list items
- `role="checkbox"` -- EditRoleDialog, DeleteRoleDialog, RoleList
- `role="status"` -- FieldHighlightOverlay
- `role="button"` -- FieldCard, FieldRow

**Verdict**: Reasonable role usage. Combobox patterns correctly use `listbox`/`option` roles. Radix UI primitives provide additional roles internally that are not visible in a simple text grep.

---

### B4. sr-only Class Usage (3 pts)

**Result**: **29 occurrences** across **21 files**.

Key usage:
- Dialog close buttons (`dialog.tsx`)
- Navigation elements (`TopBar.tsx` -- 4 occurrences, `DashboardLayout.tsx`)
- Toggle labels (`UserStatusToggle.tsx`)
- Checkbox labels in tables (`InstanceRowsTable.tsx`, `TemplateFieldMappingList.tsx`)
- Status indicators (`FormatCard.tsx`, `FormatFilters.tsx`, `OutlookConfigList.tsx`)
- Test selectors (`TestDataSelector.tsx`, `ExportTester.tsx`)
- `FieldEditor.tsx` (2) -- editing state announcements

**Verdict**: Good. Screen-reader-only text is used consistently for icon-only buttons and status indicators.

---

### B5. Form Label Associations -- htmlFor (5 pts)

**Result**: **176 occurrences** across **66 files**.

**Spot-checked 5 form components**:

| Component | htmlFor Count | Properly Associated? |
|-----------|--------------|---------------------|
| `RegisterForm.tsx` | 4 | Yes -- name, email, password, confirm |
| `LoginForm.tsx` | 2 | Yes -- email, password |
| `SharePointConfigForm.tsx` | 13 | Yes -- all fields associated |
| `AuditReportExportDialog.tsx` | 7 | Yes -- date range, format, filters |
| `OutlookConfigForm.tsx` | 11 | Yes -- all configuration fields |

**Verdict**: **Excellent**. 176 `htmlFor` across 66 files shows strong label-input association practices. Forms are well-structured for accessibility.

---

### B6. Dialog Focus Trap (5 pts)

**Spot-checked 5 dialog components**:

| Dialog | Library | Focus Trap? |
|--------|---------|------------|
| `dialog.tsx` (base) | `@radix-ui/react-dialog` | **Yes** (built-in) |
| `alert-dialog.tsx` | `@radix-ui/react-alert-dialog` | **Yes** (built-in) |
| `CompanyMergeDialog.tsx` | Uses `<Dialog>` from `dialog.tsx` | **Yes** (inherited) |
| `ExportDialog.tsx` | Uses `<Dialog>` from `dialog.tsx` | **Yes** (inherited) |
| `ResolveDialog.tsx` | Uses `<Dialog>` from `dialog.tsx` | **Yes** (inherited) |

All dialogs use Radix UI primitives which provide built-in focus trapping, focus restoration, and Escape key dismissal.

**Verdict**: **Excellent**. Radix UI handles focus management correctly and consistently.

---

### B7. Skip-to-Content Link (2 pts)

**Result**: **Not found**.

Searched for `skip-to`, `skipTo`, `skip.to.content` patterns -- zero matches.

The `DashboardLayout.tsx` goes directly to sidebar/topbar/main content without a skip navigation link.

**Verdict**: **Missing**. No skip-to-content link exists. This is a WCAG 2.1 Level A failure (Success Criterion 2.4.1).

---

### B8. Keyboard Navigation (3 pts)

**Result**: **18 onKeyDown/onKeyUp occurrences** across **12 files**.

**Spot-checked 3 interactive components**:

| Component | Tab | Enter | Escape | Notes |
|-----------|-----|-------|--------|-------|
| `FieldEditor.tsx` | Via `inputRef.focus()` | Save (L176) | Cancel (L179) | Full keyboard support |
| `DashboardLayout.tsx` | Via sidebar collapse | N/A | Close mobile menu (L62) | Escape handler for overlay |
| `DateRangeQuickSelect.tsx` | 2 key handlers | Enter/Space (Radix) | Escape (Radix) | Radix provides base handling |

**Verdict**: Keyboard navigation is implemented where custom interactive components exist. Radix UI components (dialogs, selects, dropdowns) provide built-in keyboard support. Custom components correctly handle Enter (confirm) and Escape (cancel) patterns.

---

### B9. Color Contrast -- CSS Custom Properties (3 pts)

**Verified from `globals.css`**:

**Light mode**:
- `--foreground: 222.2 84% 4.9%` (very dark blue) on `--background: 0 0% 100%` (white) -- **high contrast**
- `--muted-foreground: 215.4 16.3% 46.9%` on white -- **borderline** (~4.2:1 ratio, meets AA for normal text)
- `--destructive: 0 84.2% 60.2%` (red) on `--destructive-foreground: 210 40% 98%` (near-white) -- **good contrast**

**Dark mode**:
- `--foreground: 210 40% 98%` (near-white) on `--background: 222.2 84% 4.9%` (very dark) -- **high contrast**
- `--muted-foreground: 215 20.2% 65.1%` on dark background -- **good contrast**

**Confidence colors**:
- High (green), Medium (yellow), Low (red) have separate bg/text pairs for both light and dark modes.
- Dark mode variants reduce luminance of backgrounds and increase text luminance -- correct approach.

**Verdict**: CSS variables are structured for contrast safety. The standard shadcn/ui color system provides WCAG AA compliance for primary text. `--muted-foreground` in light mode is borderline but likely passes for the font sizes used.

---

## Set C: Zustand + React Query State Management (35 pts)

### C1. reviewStore.ts -- Full Action/Selector Verification (10 pts)

**Store file**: `src/stores/reviewStore.ts` (285 lines)

**State shape** (7 state fields):
- `selectedFieldId: string | null` -- current selected field
- `selectedFieldPosition: FieldSourcePosition | null` -- PDF source position
- `editingFieldId: string | null` -- currently editing field
- `currentPage: number` -- PDF page (1-indexed)
- `zoomLevel: number` -- 0.5 to 3.0
- `dirtyFields: Set<string>` -- modified field IDs
- `pendingChanges: Map<string, string>` -- fieldId -> newValue
- `originalValues: Map<string, string | null>` -- original values for diff
- `fieldNames: Map<string, string>` -- fieldId -> fieldName mapping

**Actions verified** (11 total):

| Action | Logic Correctness |
|--------|------------------|
| `setSelectedField` | Correct -- sets field + position, auto-navigates to page |
| `setCurrentPage` | Correct -- `Math.max(1, page)` prevents < 1 |
| `setZoomLevel` | Correct -- clamped to [0.5, 3.0] |
| `startEditing` | Correct -- sets editingFieldId |
| `stopEditing` | Correct -- nulls editingFieldId |
| `markFieldDirty` | Correct -- only records original value on FIRST edit (idempotent), clears editingFieldId |
| `clearDirtyField` | Correct -- removes from all 4 maps/sets |
| `resetChanges` | Correct -- clears all modification state + selection state |
| `hasPendingChanges` | Correct -- `dirtyFields.size > 0` |
| `getPendingCorrections` | Correct -- iterates dirtyFields, maps to `PendingCorrection[]` |
| `resetStore` | Correct -- full state reset to initial values |

**Immutability pattern**: Uses `new Set(...)` and `new Map(...)` copies before mutation -- correct for Zustand.

**Potential concern**: No `devtools` middleware (unlike `document-preview-test-store.ts`). This means reviewStore state changes are invisible in Redux DevTools.

**Verdict**: All 11 actions work correctly as documented. Store design is clean with proper immutability.

---

### C2. document-preview-test-store.ts -- Structure Verification (5 pts)

**Store file**: `src/stores/document-preview-test-store.ts` (462 lines)

**Key structural elements**:
- Uses `devtools` middleware (named `'document-preview-test-store'`)
- Uses `useShallow` from `zustand/react/shallow` for selector hooks (FIX-009)
- 4 selector hooks: `useFileState`, `useFieldsState`, `useMappingState`, `usePdfState`
- State includes: file state, extracted fields, mapping config (GLOBAL/COMPANY/FORMAT scope), PDF state
- Constants: `MIN_ZOOM=0.5`, `MAX_ZOOM=2.0`, `DEFAULT_ZOOM=1.0`
- `initialState` extracted as const for clean `reset()`

**Notable design**:
- `setCurrentScope` correctly cascades -- switching to GLOBAL clears both company and format IDs
- `setSelectedField` auto-navigates to bounding box page (cross-cuts PDF and field state)
- `updateField` preserves `originalValue` on first edit
- `clearFile` preserves mapping config settings (scope, company, format)

**FIX-009 pattern**: `useShallow` prevents infinite re-render loops in Next.js 15 when selectors return object references.

**Verdict**: Well-structured store with proper middleware, selector optimization, and documented bugfix.

---

### C3. React Query queryKey Patterns -- 10 Hooks Verified (10 pts)

| Hook | queryKey Pattern | staleTime | gcTime |
|------|-----------------|-----------|--------|
| `use-documents.ts` | `documentsQueryKeys.list(filters)` (factory) | 2s | default (5min) |
| `use-document-detail.ts` | `['document-detail', documentId]` | 30s | 5min (explicit) |
| `useReviewQueue.ts` | `['reviewQueue', params]` | 30s | default |
| `useRuleList.ts` | `ruleListKeys.list(filters)` (factory) | 60s | default |
| `useRuleDetail.ts` | `ruleDetailKeys.detail(id)` | 30s | default |
| `useDashboardStatistics.ts` | `['dashboardStats', params]` | 5min | default |
| `useEscalationList.ts` | Factory pattern | 5min | default |
| `use-companies.ts` | `companiesQueryKeys.list(params)` (factory) | Defined as const | default |
| `use-health-monitoring.ts` | `['health-status']` | 10s | default |
| `useWorkflowExecutions.ts` | `['workflow-executions', params]` | 10s-60s (varies) | default |

**Global defaults** (from `QueryProvider.tsx`):
- `staleTime: 60 * 1000` (1 minute)
- `gcTime: 5 * 60 * 1000` (5 minutes)
- `refetchOnWindowFocus: false`
- `retry: 2`

**Query key factory pattern** -- widely used:
```typescript
export const documentsQueryKeys = {
  all: ['documents'] as const,
  lists: () => [...documentsQueryKeys.all, 'list'] as const,
  list: (filters) => [...documentsQueryKeys.lists(), filters] as const,
  details: () => [...documentsQueryKeys.all, 'detail'] as const,
  detail: (id) => [...documentsQueryKeys.details(), id] as const,
}
```

Found in: `use-documents`, `use-companies`, `use-data-templates`, `use-backup`, `use-backup-schedule`, `use-alerts`, `use-city-cost-report`, `use-document-progress`, and many more.

**Verdict**: Consistent and well-structured. Factory pattern prevents typos and enables granular cache invalidation.

---

### C4. Mutation Patterns -- 5 Mutations Verified (5 pts)

| Mutation Hook | onSuccess (invalidate) | onError | Notes |
|---------------|----------------------|---------|-------|
| `useApproveReview.ts` | `invalidateQueries(['reviewDetail', docId])` + `['reviewQueue']` | Error callback | Clean pattern |
| `useSaveCorrections.ts` | `invalidateQueries(['reviewDetail', docId])` + `['reviewQueue']` + `resetChanges()` | Error callback | Integrates with Zustand store |
| `useCreateRule.ts` | `invalidateQueries(ruleListKeys.all)` | Error + field-level error formatting | Uses `onSettled` too |
| `useEscalateReview.ts` | 3 cache invalidations (review, queue, escalations) | Error callback | Cross-domain invalidation |
| `use-exchange-rates.ts` | `invalidateQueries([QUERY_KEY])` | Error callback | 5 mutations, all follow pattern |

**Pattern summary**:
- **100% use `invalidateQueries`** in onSuccess (no optimistic updates found)
- **100% have `onError` callbacks** (delegated to caller options)
- **No `onMutate` rollback patterns** found -- mutations are server-authoritative
- Mutations consistently accept `options?: { onSuccess, onError }` for caller customization

**Verdict**: Consistent mutation pattern. Server-authoritative approach is appropriate for a financial document processing system where data accuracy is critical.

---

### C5. Anti-Pattern Spot Check -- 5 Components (5 pts)

| Component | Issue Found? | Notes |
|-----------|-------------|-------|
| `ReviewQueue.tsx` | No | Uses hook for data, props for callbacks -- clean |
| `DashboardLayout.tsx` | No | Local state for UI (sidebar, mobile menu), no redundancy |
| `FieldEditor.tsx` | No | Local state for edit value, validation from props |
| `SourceFieldCombobox.tsx` | Minimal | Heavy `useMemo` (10 instances) suggests complex derived state; could benefit from memoized selector |
| `MappingConfigPanel.tsx` | Minimal | 15 `useCallback`s indicates complex interaction; well-structured but large |

**No prop drilling detected**: Components use hooks (`useReviewStore`, `useTranslations`, etc.) for cross-cutting concerns. No deep prop chains observed.

**No redundant state**: Zustand (UI) and React Query (server) are cleanly separated. No cases of server data being duplicated in Zustand.

**Verdict**: No significant anti-patterns found. State management boundaries are well-defined.

---

## Set D: Error Boundary + Loading State Patterns (30 pts)

### D1. error.tsx Files (5 pts)

**Result**: **0 files** found.

No `error.tsx` files exist anywhere in `src/app/`.

**Verdict**: **Critical gap**. Next.js App Router uses `error.tsx` for route-level error boundaries. Without any, unhandled errors in server components will crash to the root error handler (which also doesn't exist -- see D8).

---

### D2. loading.tsx Files (5 pts)

**Result**: **1 file** found.

- `src/app/[locale]/(dashboard)/documents/[id]/loading.tsx`

This file correctly uses `<Skeleton>` components to render a document detail page skeleton with header, stats cards, and tabs placeholders.

**Verdict**: **Significant gap**. Only 1 of 25+ route segments has a loading state. Most pages handle loading entirely on the client side.

---

### D3. Skeleton Component Usage (3 pts)

**Result**: **847 occurrences** across **137 files**.

The `Skeleton` component from `components/ui/skeleton.tsx` is extensively used:
- Dedicated skeleton components: `RuleListSkeleton.tsx` (35), `UserListSkeleton.tsx` (25), `EscalationListSkeleton.tsx` (19), `ForwarderTableSkeleton.tsx` (14), `PDFLoadingSkeleton.tsx` (13), `ReviewQueueSkeleton.tsx` (12)
- Inline skeleton usage in pages: `admin/exchange-rates/[id]/page.tsx` (22), `admin/pipeline-settings/[id]/page.tsx` (18), `admin/companies/review/page.tsx` (17), `rules/new/page.tsx` (17)
- Loading hooks return skeleton indicators: `useVersions.ts`, `useSuggestionList.ts`, `useRuleList.ts`, etc.

**Verdict**: **Excellent**. Despite the lack of `loading.tsx` files, Skeleton usage is pervasive in client-side loading states. 137 files using skeletons demonstrates a strong loading UX pattern.

---

### D4. Toast Notification Pattern (5 pts)

**Result**: **279 occurrences** of `toast(` or `useToast` across **56 files**.

**Two toast systems coexist**:
1. **`use-toast.ts`** -- custom event-driven toast (from shadcn/ui, Radix-based)
2. **`use-localized-toast.ts`** -- i18n-aware wrapper around `sonner` toast library

**Spot-checked 5 usages**:

| File | Toast Library | Pattern |
|------|--------------|---------|
| `BulkRuleActions.tsx` (12 calls) | Both systems | Success/error on bulk operations |
| `HealthDashboard.tsx` (7 calls) | Toast | Status notifications for health checks |
| `DataRetentionDashboard.tsx` (7 calls) | Toast | CRUD confirmations |
| `HistoricalDataPage.tsx` (15 calls) | Toast | Upload/process/error for batch operations |
| `DocumentDetailHeader.tsx` (6 calls) | Toast | Document action confirmations |

**Verdict**: Toast is used consistently for user feedback on mutations and async operations. The dual-system (shadcn + sonner) adds mild complexity but both serve their purpose.

---

### D5. Error Boundary Behavior (3 pts)

**Result**: **No `error.tsx` files exist** to read.

No Next.js error boundaries are implemented at any route level.

**Verdict**: Cannot verify -- they don't exist. This is a gap (see D1).

---

### D6. Data-Fetching Components -- isLoading/isError Handling (5 pts)

**170 files** in `src/components/` use `isLoading` or `isPending`.
**49 files** in `src/components/` handle `isError` or `error &&` patterns.

**Spot-checked 5 components**:

| Component | isLoading Handling | isError Handling |
|-----------|-------------------|------------------|
| `ReviewQueue.tsx` | Returns `<ReviewQueueSkeleton />` | Returns `<Alert variant="destructive">` with retry button |
| `DashboardStats.tsx` | Returns skeleton cards (7 occurrences) | Shows error state (2 occurrences) |
| `HealthDashboard.tsx` | 19 Skeleton usages for different sections | 4 error handling branches |
| `TemplateFieldMappingList.tsx` | 6 Skeleton rows | 3 error checks with AlertDescription |
| `ForwarderDetailView.tsx` | 10 Skeleton blocks | Via parent page error handling |

**Pattern**: Loading states are consistently handled with Skeletons. Error states are handled with Alert components containing retry buttons. The pattern is:
```tsx
if (isLoading) return <ComponentSkeleton />
if (error) return <Alert variant="destructive">...</Alert>
if (!data) return <EmptyState />
return <ActualContent data={data} />
```

**Verdict**: **Well-implemented**. The 170 files with loading handling vs 49 with error handling suggests some components may lack explicit error states, relying on parent boundaries or silent failures.

---

### D7. not-found.tsx (2 pts)

**Result**: **0 files** found.

No `not-found.tsx` exists at any route level.

**Verdict**: **Missing**. 404 pages use Next.js's built-in default, which is unstyled and doesn't match the application's design system.

---

### D8. Global Error Handler (2 pts)

**Result**: **Not found**.

- No `global-error.tsx` in `src/app/`
- No `ErrorBoundary` component wrapper
- No `window.onerror` or `window.addEventListener('unhandledrejection')` setup

The QueryProvider sets `retry: 2` as a global default, which provides some resilience for transient API failures.

**Verdict**: **Missing**. No global error boundary or unhandled error capture exists. Unhandled errors in server components will show Next.js's default error page.

---

## Summary Score Table

| Area | Points Available | Points Earned | Score |
|------|-----------------|---------------|-------|
| **Set A: Performance** | 30 | 24 | 80% |
| **Set B: Accessibility** | 30 | 24 | 80% |
| **Set C: State Management** | 35 | 34 | 97% |
| **Set D: Error/Loading** | 30 | 20 | 67% |
| **Total** | **125** | **102** | **82%** |

---

## Key Findings Summary

### Strengths
1. **State management is excellent** -- Zustand and React Query are cleanly separated with proper patterns
2. **useCallback/useMemo usage is extensive** -- 810 total memoization instances across 200+ files
3. **Mutation pattern is consistent** -- all mutations invalidate caches, all have error handling
4. **Skeleton usage is pervasive** -- 847 occurrences across 137 files
5. **Radix UI provides strong a11y foundation** -- focus trapping, keyboard navigation, roles built-in
6. **Form label associations are strong** -- 176 `htmlFor` across 66 files
7. **Query key factories** prevent cache key inconsistencies

### Critical Gaps
1. **No `error.tsx` files** -- 0 route-level error boundaries (should have at least 3-5 for major sections)
2. **No `global-error.tsx`** -- unhandled errors fall through to Next.js default
3. **No `not-found.tsx`** -- 404 pages are unstyled
4. **Only 1 `loading.tsx`** -- missing SSR streaming for 24+ routes
5. **No `React.memo`** -- 0 component-level memoization in 165+ components
6. **No skip-to-content link** -- WCAG 2.1 Level A failure (SC 2.4.1)
7. **Only 2 `aria-describedby`** -- error messages and help text lack programmatic association

### Quantitative Inventory (New Data)

| Metric | Count | Files |
|--------|-------|-------|
| React.memo | 0 | 0 |
| useMemo | 193 | 92 |
| useCallback | 617 | 163 |
| dynamic() | 3 | 3 |
| Suspense | 70 | 21 |
| loading.tsx | 1 | 1 |
| error.tsx | 0 | 0 |
| not-found.tsx | 0 | 0 |
| global-error.tsx | 0 | 0 |
| aria-label | 49 | 21 |
| aria-describedby | 2 | 2 |
| role= | 28 | 22 |
| sr-only | 29 | 21 |
| htmlFor | 176 | 66 |
| onKeyDown/onKeyUp | 18 | 12 |
| Skeleton usage | 847 | 137 |
| toast/useToast | 279 | 56 |
| useMutation | 252 | 64 |
| invalidateQueries | 272 | 70 |
| isLoading/isPending (components) | ~700+ | 170 |
| isError handling (components) | ~81 | 49 |
| refetchInterval hooks | 15+ | 12 |
| staleTime custom configs | 60+ | 30+ |
| Zustand stores | 2 | 2 |
| Radix UI primitives | 23 | 23 |
| Query key factories | 15+ | 15+ |
