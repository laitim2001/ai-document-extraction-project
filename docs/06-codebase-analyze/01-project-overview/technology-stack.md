# Technology Stack - Complete Dependency Inventory

> Generated: 2026-04-09
> Source: `package.json`, `tsconfig.json`, `docker-compose.yml`, `prisma/schema.prisma`

---

## Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.0.0 | App Router framework (React Server Components) |
| `react` | ^18.3.0 | UI library |
| `react-dom` | ^18.3.0 | React DOM renderer |
| `typescript` | ^5.0.0 | Type system (strict mode, target ES2017) |

## Database & ORM

| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | ^7.2.0 | Schema definition, migrations, CLI |
| `@prisma/client` | ^7.2.0 | Type-safe database client |
| `@prisma/adapter-pg` | ^7.2.0 | PostgreSQL adapter for Prisma |
| `pg` | ^8.16.3 | PostgreSQL driver |
| PostgreSQL | 15-alpine | Database (Docker image) |

## Styling & UI Components

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.4.0 | Utility-first CSS framework |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities for Tailwind |
| `tailwind-merge` | ^3.4.0 | Merge Tailwind classes without conflicts |
| `class-variance-authority` | ^0.7.1 | Component variant management (shadcn/ui) |
| `clsx` | ^2.1.1 | Conditional class name utility |
| `lucide-react` | ^0.561.0 | Icon library |
| `next-themes` | ^0.4.6 | Dark/light theme support |
| `sonner` | ^2.0.7 | Toast notification library |
| `cmdk` | ^1.0.0 | Command palette component |

## Radix UI Primitives (19 packages)

| Package | Version |
|---------|---------|
| `@radix-ui/react-accordion` | ^1.2.12 |
| `@radix-ui/react-alert-dialog` | ^1.1.15 |
| `@radix-ui/react-avatar` | ^1.1.11 |
| `@radix-ui/react-checkbox` | ^1.3.3 |
| `@radix-ui/react-dialog` | ^1.1.15 |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 |
| `@radix-ui/react-label` | ^2.1.8 |
| `@radix-ui/react-popover` | ^1.1.15 |
| `@radix-ui/react-progress` | ^1.1.8 |
| `@radix-ui/react-radio-group` | ^1.3.8 |
| `@radix-ui/react-scroll-area` | ^1.2.10 |
| `@radix-ui/react-select` | ^2.2.6 |
| `@radix-ui/react-separator` | ^1.1.8 |
| `@radix-ui/react-slider` | ^1.3.6 |
| `@radix-ui/react-slot` | ^1.2.4 |
| `@radix-ui/react-switch` | ^1.2.6 |
| `@radix-ui/react-tabs` | ^1.1.13 |
| `@radix-ui/react-toast` | ^1.2.15 |
| `@radix-ui/react-tooltip` | ^1.2.8 |

## State Management & Data Fetching

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^5.0.9 | Client-side UI state management |
| `@tanstack/react-query` | ^5.90.12 | Server state, caching, synchronization |
| `@tanstack/react-table` | ^8.21.3 | Headless table with sorting/filtering/pagination |

## Forms & Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7.68.0 | Performant form management |
| `@hookform/resolvers` | ^5.2.2 | Zod/Yup resolver integration |
| `zod` | ^4.2.1 | Runtime schema validation |

## Internationalization (i18n)

| Package | Version | Purpose |
|---------|---------|---------|
| `next-intl` | ^4.7.0 | Locale routing, translations, formatting |

Supports 3 locales: `en`, `zh-TW`, `zh-CN` with 34 namespaces per locale.

## Authentication & Security

| Package | Version | Purpose |
|---------|---------|---------|
| `next-auth` | ^5.0.0-beta.30 | Authentication framework (Azure AD SSO + local) |
| `@auth/prisma-adapter` | ^2.11.1 | Prisma session/account adapter for NextAuth |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `jose` | ^6.1.3 | JWT/JWS/JWE operations (indirect — used internally by next-auth) |

## Azure Services

| Package | Version | Purpose |
|---------|---------|---------|
| `@azure/ai-form-recognizer` | ^5.1.0 | Azure Document Intelligence (OCR) |
| `@azure/identity` | ^4.13.0 | Azure AD authentication |
| `@azure/storage-blob` | ^12.29.1 | Azure Blob Storage (document storage) |

## AI / LLM Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `openai` | ^6.15.0 | OpenAI SDK (Azure OpenAI GPT-5.2 endpoint) |

## Microsoft Office 365 Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@microsoft/microsoft-graph-client` | ^3.0.7 | SharePoint, Outlook via Graph API |

## PDF Processing

| Package | Version | Purpose |
|---------|---------|---------|
| `pdfjs-dist` | ^4.10.38 | PDF parsing and rendering |
| `pdf-parse` | ^1.1.1 | Server-side PDF text extraction |
| `pdf-to-img` | ^5.0.0 | PDF to image conversion (for OCR) |
| `react-pdf` | ^9.2.1 | PDF viewer component |
| `pdfkit` | ^0.17.2 | PDF generation |
| `unpdf` | ^1.4.0 | Universal PDF utilities (indirect — peer dependency of pdf-to-img) |

## Data Export & Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| `exceljs` | ^4.4.0 | Excel file generation/export |
| `recharts` | ^3.6.0 | Chart components (dashboard/reports) |
| `react-syntax-highlighter` | ^16.1.0 | Code/JSON syntax highlighting |
| `swagger-ui-react` | ^5.31.0 | API documentation UI |

## Drag & Drop

| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | ^6.3.1 | Core drag-and-drop engine |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable list functionality |
| `@dnd-kit/modifiers` | ^9.0.0 | Drag modifiers (snap, restrict) |
| `@dnd-kit/utilities` | ^3.2.2 | DnD utility functions |

## Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `date-fns` | ^4.1.0 | Date manipulation |
| `diff` | ^8.0.2 | Text diff computation |
| `js-yaml` | ^4.1.1 | YAML parsing (pipeline configs) |
| `dotenv` | ^17.2.3 | Environment variable loading |
| `use-debounce` | ^10.0.6 | Debounce hook for search inputs |
| `p-queue-compat` | ^1.0.234 | Promise concurrency control |
| `canvas` | ^3.2.0 | Server-side canvas (indirect — required by pdfjs-dist for server-side PDF rendering) |
| `react-dropzone` | ^14.3.8 | File upload drop zone |
| `react-resizable-panels` | ^2.1.7 | Resizable panel layout |
| `react-day-picker` | ^9.13.0 | Date picker component |

## Caching

| Package | Version | Purpose |
|---------|---------|---------|
| `@upstash/redis` | ^1.35.8 | Redis caching (rule cache, rate limiting) |

## Email

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemailer` | ^7.0.12 | Email notifications (escalation, alerts) |

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^8.57.0 | Code linting |
| `eslint-config-next` | ^15.0.0 | Next.js ESLint rules |
| `playwright` | ^1.57.0 | E2E testing framework |
| `postcss` | ^8.4.0 | CSS post-processing |
| `autoprefixer` | ^10.4.0 | CSS vendor prefixing |
| `ts-node` | ^10.9.2 | TypeScript execution for scripts/seed |

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL | `postgres:15-alpine` | 5433 | Primary database |
| pgAdmin | `dpage/pgadmin4:latest` | 5050 | Database management UI |
| OCR Extraction | Custom FastAPI | 8000 | Azure Document Intelligence OCR |
| Forwarder Mapping | Custom FastAPI | 8001 | 3-tier mapping service |
| Azurite | `mcr.microsoft.com/azure-storage/azurite:latest` | 10010-10012 | Azure Storage emulator (Blob/Queue/Table) |

## Python Services (FastAPI)

| Service | Port | Purpose | LOC |
|---------|------|---------|-----|
| Extraction Service | 8000 | OCR via Azure Document Intelligence | ~1,400 |
| Mapping Service | 8001 | 3-tier term mapping + forwarder ID | ~1,300 |

Total Python: 12 files, 2,719 lines.

## TypeScript Configuration

| Setting | Value |
|---------|-------|
| Target | ES2017 |
| Module | ESNext |
| Module Resolution | Bundler |
| Strict | true |
| JSX | preserve |
| Incremental | true |
| Path alias | `@/*` → `./src/*` |

## Dependency Summary

| Category | Count |
|----------|-------|
| Production dependencies | 77 |
| Dev dependencies | 20 |
| Radix UI primitives | 19 |
| Docker services | 5 |
| Python services | 2 |
