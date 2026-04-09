# Pages & Routing Overview

> Generated: 2026-04-09 | Total Pages: 82 | Layouts: 4 | Loading: 1

---

## Layout Hierarchy

```
src/app/layout.tsx                        # L0: Root passthrough (no html/body)
  src/app/[locale]/layout.tsx             # L1: i18n Provider, html lang, Providers
    (auth)/layout.tsx                     # L2a: Centered card layout (public)
    (dashboard)/layout.tsx                # L2b: Sidebar+TopBar layout (auth required)
```

| File | Type | Notes |
|------|------|-------|
| `src/app/layout.tsx` | Server | Passthrough only, defers to [locale] |
| `src/app/[locale]/layout.tsx` | Server | NextIntlClientProvider, QueryProvider, AuthProvider, ThemeProvider, Toaster |
| `(auth)/layout.tsx` | Server | Centered card on gray bg, no sidebar |
| `(dashboard)/layout.tsx` | Server | `auth()` check, redirects unauthed, renders DashboardLayout |
| `documents/[id]/loading.tsx` | Server | Skeleton UI for document detail page |

---

## Auth Pages (6)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/auth/login` | Server | Azure AD SSO + local login entry |
| `/auth/register` | Server | Local account registration |
| `/auth/forgot-password` | Client | Password reset request form |
| `/auth/reset-password` | Client | Set new password (token-based) |
| `/auth/verify-email` | Client | Email verification result |
| `/auth/error` | Server | Auth error display |

---

## Dashboard Pages (72)

### Core Business (19 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard` | Server | Main dashboard with stats and quick actions |
| `/documents` | Client | Document list with filters, search, pagination |
| `/documents/upload` | Client | File upload interface |
| `/documents/[id]` | Client | Document detail (tabs: info, fields, timeline) |
| `/review` | Server | Pending review invoice list |
| `/review/[id]` | Server | Side-by-side PDF review interface |
| `/escalations` | Server | Escalation case list (Super User) |
| `/escalations/[id]` | Server | Escalation detail and resolution |
| `/rules` | Client | Mapping rule list |
| `/rules/new` | Client | Create new rule suggestion |
| `/rules/[id]` | Client | Rule detail view |
| `/rules/[id]/edit` | Client | Rule editor |
| `/rules/[id]/history` | Server | Rule version history timeline |
| `/rules/review` | Client | Rule review queue |
| `/rules/review/[id]` | Server | Rule review detail |
| `/companies` | Client | Company management list |
| `/companies/new` | Server | Create new company form |
| `/companies/[id]` | Server | Company detail (info, formats, rules, docs) |
| `/companies/[id]/edit` | Server | Edit company form |

### Company Sub-Routes (4 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/companies/[id]/formats/[formatId]` | Server | Format detail (terms, related docs) |
| `/companies/[id]/rules/[ruleId]/test` | Client | Rule testing interface |
| `/template-instances` | Server | Template instance list |
| `/template-instances/[id]` | Server | Template instance detail |

### Reports (4 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/reports/ai-cost` | Server | AI API cost analysis (trends, breakdown) |
| `/reports/cost` | Server | City-level cost report |
| `/reports/monthly` | Client | Monthly cost allocation report |
| `/reports/regional` | Server | Cross-city regional report |

### Other Dashboard Pages (4 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/global` | Client | Global management dashboard |
| `/profile` | Server | User profile, preferences, password change |
| `/audit/query` | Server | Audit log query (Auditor/Admin only) |
| `/rollback-history` | Server | Rule rollback history |

---

## Admin Pages (41 pages across 20 modules)

### CRUD Modules (8 modules, 24 pages)

Each follows: `page.tsx` (list) + `[id]/page.tsx` (edit) + `new/page.tsx` (create)

| Module | List | Edit | New | i18n NS |
|--------|------|------|-----|---------|
| data-templates | Server | Server | Server | dataTemplates |
| exchange-rates | Client | Client | Server | exchangeRate |
| field-definition-sets | Client | Client | Client | fieldDefinitionSet |
| field-mapping-configs | Server | Server | Server | fieldMappingConfig |
| pipeline-settings | Client | Client | Server | pipelineConfig |
| prompt-configs | Server | Server | Server | promptConfig |
| reference-numbers | Server | Server | Server | referenceNumber |
| template-field-mappings | Server | Server | Server | templateFieldMapping |

### Single-Page Admin Modules (10 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/alerts` | Server | Alert rule management (CRUD, enable/disable) |
| `/admin/backup` | Client | Data backup and restore management |
| `/admin/config` | Client | System configuration management |
| `/admin/integrations/outlook` | Client | Outlook connection configuration |
| `/admin/monitoring/health` | Server | System health monitoring dashboard |
| `/admin/performance` | Server | Performance monitoring (API/DB/AI/System) |
| `/admin/roles` | Server | Role management |
| `/admin/settings` | Server | System settings hub |
| `/admin/term-analysis` | Server | Term aggregation and classification |
| `/admin/users` | Server | User management |

### Special Admin Modules (4 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/companies/review` | Server | Pending company review queue |
| `/admin/historical-data` | Client | Historical data batch management |
| `/admin/historical-data/files/[fileId]` | Server | Historical file detail |
| `/admin/document-preview-test` | Server | Document preview integration test |

### Admin Test Tools (3 pages)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/test/extraction-compare` | Client | V2 vs V3 extraction comparison |
| `/admin/test/extraction-v2` | Client | V2 extraction testing |
| `/admin/test/template-matching` | Server | Template matching 6-step wizard |

---

## Docs Pages (2)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/docs` | Server | Swagger UI API documentation |
| `/docs/examples` | Server | SDK code examples (TS, Python, C#) |

---

## Root Pages (2)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Server | Root redirect (handled by middleware) |
| `/[locale]` | Server | Locale homepage redirect |

---

## Summary Statistics

| Category | Count | Client | Server |
|----------|-------|--------|--------|
| Auth | 6 | 3 | 3 |
| Dashboard Core | 19 | 8 | 11 |
| Company Sub-Routes | 4 | 1 | 3 |
| Reports | 4 | 1 | 3 |
| Other Dashboard | 4 | 1 | 3 |
| Admin CRUD | 24 | 9 | 15 |
| Admin Single-Page | 10 | 3 | 7 |
| Admin Special | 4 | 1 | 3 |
| Admin Test | 3 | 2 | 1 |
| Docs | 2 | 0 | 2 |
| Root | 2 | 0 | 2 |
| **Total** | **82** | **29** | **53** |
| Layouts | 4 | 0 | 4 |
| Loading screens | 1 | 0 | 1 |
