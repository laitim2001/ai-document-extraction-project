# API Routes - V1 Domain (`/v1/*`)

> 77 route files | Auth: 3/77 (3.9%) | Zod: 64/77 (83.1%) | Generated: 2026-04-09

**Note**: The `/v1/*` domain is largely unprotected by session auth. Only `/v1/users/me/*` routes require authentication. Most v1 routes appear designed as internal/service APIs or rely on API-key middleware not captured by session-auth grep patterns.

---

## Admin Sub-routes (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 1 | `/v1/admin/costs/term-validation` | GET DELETE | N | Y | AI term validation cost query |
| 2 | `/v1/admin/terms/validate` | GET POST | N | Y | AI term validation |

## Batches (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 3 | `/v1/batches/:batchId/hierarchical-terms` | GET | N | Y | 3-tier term aggregation |
| 4 | `/v1/batches/:batchId/hierarchical-terms/export` | GET | N | Y | Hierarchical term report export |

## Data Templates (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 5 | `/v1/data-templates` | GET POST | N | Y | Template list and creation |
| 6 | `/v1/data-templates/:id` | GET PATCH DELETE | N | Y | Single template CRUD |
| 7 | `/v1/data-templates/available` | GET | N | N | Available templates for selection |

## Documents (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 8 | `/v1/documents/:id/match` | POST | N | Y | Single document template match |
| 9 | `/v1/documents/:id/unmatch` | POST | N | N | Unmatch document from template |
| 10 | `/v1/documents/match` | POST | N | Y | Bulk document template match |

## Exchange Rates (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 11 | `/v1/exchange-rates` | GET POST | N | Y | Rate list and creation |
| 12 | `/v1/exchange-rates/:id` | GET PATCH DELETE | N | Y | Single rate CRUD |
| 13 | `/v1/exchange-rates/:id/toggle` | POST | N | Y | Toggle rate active status |
| 14 | `/v1/exchange-rates/batch` | POST | N | Y | Batch rate query |
| 15 | `/v1/exchange-rates/convert` | POST | N | Y | Currency conversion |
| 16 | `/v1/exchange-rates/export` | GET | N | Y | Export rates |
| 17 | `/v1/exchange-rates/import` | POST | N | Y | Bulk import rates |

## Extraction V3 (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 18 | `/v1/extraction-v3/test` | GET POST | N | N | V3 extraction pipeline test |

## Field Definition Sets (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 19 | `/v1/field-definition-sets` | GET POST | N | Y | Set list and creation |
| 20 | `/v1/field-definition-sets/:id` | GET PATCH DELETE | N | Y | Single set CRUD |
| 21 | `/v1/field-definition-sets/:id/coverage` | GET | N | N | Field coverage analysis |
| 22 | `/v1/field-definition-sets/:id/fields` | GET | N | N | Set field list |
| 23 | `/v1/field-definition-sets/:id/toggle` | POST | N | N | Toggle set active status |
| 24 | `/v1/field-definition-sets/candidates` | GET | N | N | Candidate fields for new set |
| 25 | `/v1/field-definition-sets/resolve` | GET | N | Y | Resolve effective set for context |

## Field Mapping Configs (8 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 26 | `/v1/field-mapping-configs` | GET POST | N | Y | Config list and creation |
| 27 | `/v1/field-mapping-configs/:id` | GET PATCH DELETE | N | Y | Single config CRUD |
| 28 | `/v1/field-mapping-configs/:id/export` | GET | N | N | Export config |
| 29 | `/v1/field-mapping-configs/:id/rules` | POST | N | Y | Create mapping rule |
| 30 | `/v1/field-mapping-configs/:id/rules/:ruleId` | PATCH DELETE | N | Y | Single rule CRUD |
| 31 | `/v1/field-mapping-configs/:id/rules/reorder` | POST | N | Y | Reorder rules |
| 32 | `/v1/field-mapping-configs/:id/test` | POST | N | Y | Test config mapping |
| 33 | `/v1/field-mapping-configs/import` | POST | N | Y | Import config |

## Formats (6 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 34 | `/v1/formats` | GET POST | N | Y | Format list and creation |
| 35 | `/v1/formats/:id` | GET PATCH DELETE | N | Y | Single format CRUD |
| 36 | `/v1/formats/:id/configs` | GET | N | N | Format associated configs |
| 37 | `/v1/formats/:id/extracted-fields` | GET | N | N | Format extracted fields |
| 38 | `/v1/formats/:id/files` | GET | N | Y | Format associated files |
| 39 | `/v1/formats/:id/terms` | GET | N | N | Format term list |

## Invoices (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 40 | `/v1/invoices` | GET POST | N | Y | Invoice submission and list |
| 41 | `/v1/invoices/:taskId/document` | GET | N | Y | Original document download info |
| 42 | `/v1/invoices/:taskId/result` | GET | N | Y | Task result extraction |
| 43 | `/v1/invoices/:taskId/result/fields/:fieldName` | GET | N | Y | Single field value query |
| 44 | `/v1/invoices/:taskId/status` | GET | N | Y | Task status query |
| 45 | `/v1/invoices/batch-results` | POST | N | Y | Batch result query |
| 46 | `/v1/invoices/batch-status` | POST | N | Y | Batch status query |

## Pipeline Configs (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 47 | `/v1/pipeline-configs` | GET POST | N | Y | Pipeline config list/create |
| 48 | `/v1/pipeline-configs/:id` | GET PATCH DELETE | N | Y | Single config CRUD |
| 49 | `/v1/pipeline-configs/resolve` | GET | N | Y | Resolve effective config |

## Prompt Configs (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 50 | `/v1/prompt-configs` | GET POST | N | Y | Prompt config list/create |
| 51 | `/v1/prompt-configs/:id` | GET PATCH DELETE | N | Y | Single config CRUD |
| 52 | `/v1/prompt-configs/test` | POST | N | Y | Test prompt config |

## Reference Numbers (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 53 | `/v1/reference-numbers` | GET POST | N | Y | Ref number list/create |
| 54 | `/v1/reference-numbers/:id` | GET PATCH DELETE | N | Y | Single ref number CRUD |
| 55 | `/v1/reference-numbers/export` | GET | N | Y | Batch export |
| 56 | `/v1/reference-numbers/import` | POST | N | Y | Batch import |
| 57 | `/v1/reference-numbers/validate` | POST | N | Y | Batch validation |

## Regions (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 58 | `/v1/regions` | GET POST | N | Y | Region list/create |
| 59 | `/v1/regions/:id` | GET PATCH DELETE | N | Y | Single region CRUD |

## Template Field Mappings (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 60 | `/v1/template-field-mappings` | GET POST | N | Y | Mapping config list/create |
| 61 | `/v1/template-field-mappings/:id` | GET PATCH DELETE | N | Y | Single mapping CRUD |
| 62 | `/v1/template-field-mappings/resolve` | POST | N | Y | Resolve mapping for context |

## Template Instances (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 63 | `/v1/template-instances` | GET POST | N | Y | Instance list/create |
| 64 | `/v1/template-instances/:id` | GET PATCH DELETE | N | Y | Single instance CRUD |
| 65 | `/v1/template-instances/:id/export` | GET | N | N | Export instance data |
| 66 | `/v1/template-instances/:id/rows` | GET POST | N | Y | Instance row list/add |
| 67 | `/v1/template-instances/:id/rows/:rowId` | PATCH DELETE | N | Y | Single row CRUD |

## Template Matching (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 68 | `/v1/template-matching/check-config` | GET | N | Y | Check matching config |
| 69 | `/v1/template-matching/execute` | POST | N | Y | Execute template matching |
| 70 | `/v1/template-matching/preview` | POST | N | Y | Preview match results |
| 71 | `/v1/template-matching/validate` | POST | N | Y | Validate mapping config |

## Users (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 72 | `/v1/users/me` | GET PATCH | **Y** | Y | Current user profile |
| 73 | `/v1/users/me/locale` | GET PATCH | **Y** | Y | User locale preference |
| 74 | `/v1/users/me/password` | POST | **Y** | Y | Change password |

## Webhooks (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 75 | `/v1/webhooks` | GET | N | Y | Webhook delivery history |
| 76 | `/v1/webhooks/:deliveryId/retry` | POST | N | N | Retry webhook delivery |
| 77 | `/v1/webhooks/stats` | GET | N | Y | Webhook statistics |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total route files | 77 |
| HTTP methods | GET: 52, POST: 38, PATCH: 15, PUT: 0, DELETE: 14 (Total: 119) |
| Auth coverage | 3/77 (3.9%) -- only `/v1/users/me/*` |
| Zod coverage | 64/77 (83.1%) |
| File upload | 3 (extraction-v3/test, formats/:id/files, invoices, prompt-configs/test) |
| Webhook-related | 3 (webhooks, webhooks/stats, webhooks/:deliveryId/retry) |

### Sub-domain Breakdown

| Sub-domain | Routes | Key Function |
|------------|--------|-------------|
| field-mapping-configs | 8 | Field mapping configuration CRUD + rules |
| invoices | 7 | Core invoice processing API |
| exchange-rates | 7 | Currency exchange rate management |
| field-definition-sets | 7 | Standard field definition management |
| formats | 6 | Document format management |
| reference-numbers | 5 | Reference number CRUD + import/export |
| template-instances | 5 | Template instance data management |
| template-matching | 4 | Template matching engine |
| data-templates | 3 | Data template CRUD |
| documents | 3 | Document matching operations |
| pipeline-configs | 3 | Pipeline configuration |
| prompt-configs | 3 | AI prompt configuration |
| template-field-mappings | 3 | Template-to-field mapping |
| users | 3 | Current user profile/settings |
| webhooks | 3 | Webhook delivery tracking |
| admin | 2 | Admin cost/term validation |
| batches | 2 | Batch term analysis |
| extraction-v3 | 1 | V3 extraction testing |
| regions | 2 | Region management |
