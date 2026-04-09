# API Routes - Admin Domain (`/admin/*`)

> 106 route files | Auth: 101/106 (95.3%) | Zod: 65/106 (61.3%) | Generated: 2026-04-09

---

## Alerts (9 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 1 | `/admin/alerts` | GET POST | Y | Y | Alert list and creation |
| 2 | `/admin/alerts/:id` | GET | Y | N | Alert detail |
| 3 | `/admin/alerts/:id/acknowledge` | POST | Y | Y | Acknowledge alert |
| 4 | `/admin/alerts/:id/resolve` | POST | Y | Y | Resolve alert |
| 5 | `/admin/alerts/rules` | GET POST | Y | Y | Alert rule list and creation |
| 6 | `/admin/alerts/rules/:id` | GET PUT DELETE | Y | Y | Single alert rule CRUD |
| 7 | `/admin/alerts/rules/:id/toggle` | PATCH | Y | N | Toggle alert rule status |
| 8 | `/admin/alerts/statistics` | GET | Y | N | Alert statistics |
| 9 | `/admin/alerts/summary` | GET | Y | N | Alert summary |

## API Keys (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 10 | `/admin/api-keys` | GET POST | Y | Y | API key list and creation |
| 11 | `/admin/api-keys/:keyId` | GET PATCH DELETE | Y | Y | Single API key CRUD |
| 12 | `/admin/api-keys/:keyId/rotate` | POST | Y | N | Rotate API key |
| 13 | `/admin/api-keys/:keyId/stats` | GET | Y | N | API key usage stats |

## Backups (6 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 14 | `/admin/backups` | GET POST | Y | Y | Backup list and creation |
| 15 | `/admin/backups/:id` | GET DELETE | Y | N | Backup detail and deletion |
| 16 | `/admin/backups/:id/cancel` | POST | Y | N | Cancel backup |
| 17 | `/admin/backups/:id/preview` | GET | Y | N | Preview backup contents |
| 18 | `/admin/backups/storage` | GET | Y | Y | Storage usage stats |
| 19 | `/admin/backups/summary` | GET | Y | N | Backup status summary |

## Backup Schedules (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 20 | `/admin/backup-schedules` | GET POST | Y | Y | Schedule list and creation |
| 21 | `/admin/backup-schedules/:id` | GET PATCH DELETE | Y | Y | Single schedule CRUD |
| 22 | `/admin/backup-schedules/:id/run` | POST | Y | N | Manual schedule execution |
| 23 | `/admin/backup-schedules/:id/toggle` | POST | Y | N | Enable/disable schedule |

## Cities (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 24 | `/admin/cities` | GET | Y | N | Admin city list |

## Companies (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 25 | `/admin/companies/:id` | GET PATCH | Y | Y | Company detail and update |
| 26 | `/admin/companies/merge` | POST | Y | Y | Merge duplicate companies |
| 27 | `/admin/companies/pending` | GET | Y | N | Pending company list |

## Config (8 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 28 | `/admin/config` | GET POST | Y | Y | System config list and creation |
| 29 | `/admin/config/:key` | GET PUT DELETE | Y | Y | Single config CRUD |
| 30 | `/admin/config/:key/history` | GET | Y | Y | Config change history |
| 31 | `/admin/config/:key/reset` | POST | Y | Y | Reset config to default |
| 32 | `/admin/config/:key/rollback` | POST | Y | Y | Rollback config version |
| 33 | `/admin/config/export` | POST | Y | N | Export all configs |
| 34 | `/admin/config/import` | POST | Y | Y | Import configs |
| 35 | `/admin/config/reload` | POST | Y | N | Reload config cache |

## Document Preview Test (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 36 | `/admin/document-preview-test/extract` | POST | **N** | N | OCR extraction test (file upload) |

## Health (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 37 | `/admin/health` | GET POST | Y | N | System health overview |
| 38 | `/admin/health/:serviceName` | GET | Y | Y | Single service health detail |

## Historical Data (19 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 39 | `/admin/historical-data/batches` | GET POST | Y | Y | Batch list and creation |
| 40 | `/admin/historical-data/batches/:batchId` | GET PATCH DELETE | Y | Y | Batch detail CRUD |
| 41 | `/admin/historical-data/batches/:batchId/cancel` | POST | Y | N | Cancel batch processing |
| 42 | `/admin/historical-data/batches/:batchId/company-stats` | GET | **N** | N | Batch company stats |
| 43 | `/admin/historical-data/batches/:batchId/files/retry` | POST | Y | Y | Bulk file retry |
| 44 | `/admin/historical-data/batches/:batchId/files/skip` | POST | Y | Y | Bulk file skip |
| 45 | `/admin/historical-data/batches/:batchId/pause` | POST | Y | N | Pause batch |
| 46 | `/admin/historical-data/batches/:batchId/process` | POST | Y | N | Process batch (internal trigger) |
| 47 | `/admin/historical-data/batches/:batchId/progress` | GET | Y | Y | Batch progress (SSE) |
| 48 | `/admin/historical-data/batches/:batchId/resume` | POST | Y | N | Resume batch |
| 49 | `/admin/historical-data/batches/:batchId/term-stats` | GET POST DELETE | **N** | Y | Term aggregation stats |
| 50 | `/admin/historical-data/files` | GET | Y | Y | File list |
| 51 | `/admin/historical-data/files/:id` | GET PATCH DELETE | Y | Y | Single file CRUD |
| 52 | `/admin/historical-data/files/:id/detail` | GET | **N** | Y | File full detail |
| 53 | `/admin/historical-data/files/:id/result` | GET | Y | N | File processing result |
| 54 | `/admin/historical-data/files/:id/retry` | POST | Y | N | Retry file processing |
| 55 | `/admin/historical-data/files/:id/skip` | POST | Y | N | Skip file |
| 56 | `/admin/historical-data/files/bulk` | POST | Y | Y | Bulk file operations |
| 57 | `/admin/historical-data/upload` | POST | Y | N | Upload historical data (file upload) |

## Integrations - n8n (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 58 | `/admin/integrations/n8n/webhook-configs` | GET POST | Y | Y | Webhook config list/create |
| 59 | `/admin/integrations/n8n/webhook-configs/:id` | GET PATCH DELETE | Y | Y | Single webhook config |
| 60 | `/admin/integrations/n8n/webhook-configs/:id/history` | GET | Y | Y | Config change history |
| 61 | `/admin/integrations/n8n/webhook-configs/:id/test` | POST | Y | N | Test webhook connection |

## Integrations - Outlook (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 62 | `/admin/integrations/outlook` | GET POST | Y | Y | Outlook config list/create |
| 63 | `/admin/integrations/outlook/:configId` | GET PUT DELETE | Y | Y | Single Outlook config |
| 64 | `/admin/integrations/outlook/:configId/rules` | GET POST | Y | Y | Filter rule list/create |
| 65 | `/admin/integrations/outlook/:configId/rules/:ruleId` | PUT DELETE | Y | Y | Single filter rule |
| 66 | `/admin/integrations/outlook/:configId/rules/reorder` | POST | Y | Y | Reorder filter rules |
| 67 | `/admin/integrations/outlook/:configId/test` | POST | Y | N | Test saved config |
| 68 | `/admin/integrations/outlook/test` | POST | Y | Y | Test new config (unsaved) |

## Integrations - SharePoint (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 69 | `/admin/integrations/sharepoint` | GET POST | Y | Y | SharePoint config list/create |
| 70 | `/admin/integrations/sharepoint/:configId` | GET PUT DELETE | Y | Y | Single SharePoint config |
| 71 | `/admin/integrations/sharepoint/:configId/test` | POST | Y | N | Test saved config |
| 72 | `/admin/integrations/sharepoint/test` | POST | Y | Y | Test new config (unsaved) |

## Logs (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 73 | `/admin/logs` | GET | Y | Y | System log query |
| 74 | `/admin/logs/:id` | GET | Y | N | Log entry detail |
| 75 | `/admin/logs/:id/related` | GET | Y | Y | Related log entries |
| 76 | `/admin/logs/export` | POST | Y | Y | Export logs |
| 77 | `/admin/logs/export/:id` | GET | Y | N | Export job status |
| 78 | `/admin/logs/stats` | GET | Y | Y | Log statistics |
| 79 | `/admin/logs/stream` | GET | Y | N | Real-time log stream (SSE) |

## n8n Health (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 80 | `/admin/n8n-health` | GET POST | Y | Y | n8n health status |
| 81 | `/admin/n8n-health/changes` | GET | Y | Y | n8n status change log |
| 82 | `/admin/n8n-health/history` | GET | Y | Y | n8n health history |

## Performance (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 83 | `/admin/performance` | GET | Y | N | Performance overview |
| 84 | `/admin/performance/export` | GET | Y | N | Export performance data |
| 85 | `/admin/performance/slowest` | GET | Y | N | Slowest endpoints/queries |
| 86 | `/admin/performance/timeseries` | GET | Y | N | Performance time series |

## Restore (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 87 | `/admin/restore` | GET POST | Y | Y | Restore list and creation |
| 88 | `/admin/restore/:id` | GET DELETE | Y | N | Restore detail and cancel |
| 89 | `/admin/restore/:id/logs` | GET | Y | N | Restore operation logs |
| 90 | `/admin/restore/:id/rollback` | POST | Y | Y | Rollback restore |
| 91 | `/admin/restore/stats` | GET | Y | N | Restore statistics |

## Retention (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 92 | `/admin/retention/archives` | GET POST | Y | Y | Archive records |
| 93 | `/admin/retention/deletion` | GET POST | Y | Y | Deletion requests |
| 94 | `/admin/retention/deletion/:requestId/approve` | POST | Y | Y | Approve deletion |
| 95 | `/admin/retention/metrics` | GET | Y | N | Storage metrics |
| 96 | `/admin/retention/policies` | GET POST | Y | Y | Retention policies |
| 97 | `/admin/retention/policies/:id` | GET PATCH DELETE | Y | Y | Single policy CRUD |
| 98 | `/admin/retention/restore` | GET POST | Y | Y | Restore from archive |

## Roles (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 99 | `/admin/roles` | GET POST | Y | Y | Role list and creation |
| 100 | `/admin/roles/:id` | GET PATCH DELETE | Y | Y | Single role CRUD |

## Settings (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 101 | `/admin/settings` | GET PATCH | Y | Y | System settings list/batch update |
| 102 | `/admin/settings/:key` | GET PUT DELETE | Y | Y | Single setting CRUD |

## Term Analysis (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 103 | `/admin/term-analysis` | GET POST | **N** | Y | Term analysis operations |

## Users (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 104 | `/admin/users` | GET POST | Y | Y | User list and creation |
| 105 | `/admin/users/:id` | GET PATCH | Y | Y | Single user detail/update |
| 106 | `/admin/users/:id/status` | PATCH | Y | Y | User status management |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total route files | 106 |
| HTTP methods | GET: 71, POST: 54, PATCH: 12, PUT: 6, DELETE: 16 (Total: 159) |
| Auth coverage | 101/106 (95.3%) |
| Zod coverage | 65/106 (61.3%) |
| SSE endpoints | 2 (logs/stream, batches/progress) |
| File upload | 3 (document-preview-test, historical-data/upload, historical-data/batches) |
| Auth gaps | 5 routes: historical-data/batches/:batchId/company-stats (1), historical-data/batches/:batchId/term-stats (1), historical-data/files/:id/detail (1), document-preview-test/extract (1), term-analysis (1) |
