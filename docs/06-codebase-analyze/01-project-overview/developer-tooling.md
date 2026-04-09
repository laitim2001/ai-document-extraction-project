# Developer Tooling Analysis

> Analyzed: 2026-04-09
> Scope: Root-level configuration files, VS Code integration, build pipeline, code quality tools

---

## 1. Root Configuration Files

### Build & Framework

| File | Purpose | Key Settings |
|------|---------|-------------|
| `next.config.ts` | Next.js 15 configuration | React strict mode, `next-intl` plugin, ESLint ignored during builds, server actions (10MB body limit), webpack externals for canvas/pdf libs |
| `tailwind.config.ts` | Tailwind CSS 3.4 | Dark mode via `class`, custom `confidence` colors (high/medium/low), `tailwindcss-animate` plugin, shadcn/ui CSS variable system |
| `postcss.config.mjs` | PostCSS pipeline | `tailwindcss` + `autoprefixer` plugins |
| `tsconfig.json` | TypeScript 5.0 compiler | `strict: true`, target ES2017, bundler module resolution, `@/*` path alias to `./src/*`, incremental builds, Next.js plugin |
| `components.json` | shadcn/ui CLI config | Default style, RSC enabled, TSX, base color `slate`, CSS variables, aliases for `@/components`, `@/lib`, `@/hooks` |

### Code Quality

| File | Purpose | Key Settings |
|------|---------|-------------|
| `.eslintrc.json` | ESLint 8.57 rules | Extends `next/core-web-vitals` + `next/typescript`. Custom rules: no-unused-vars (warn, `_` prefix ignored), no-explicit-any (warn), prefer-const (error), no-console (warn, allows `warn`/`error`) |
| `.prettierrc` | Prettier formatting | No semicolons, single quotes, 2-space tabs, ES5 trailing commas, 100 char print width, LF line endings |

### Infrastructure

| File | Purpose | Key Settings |
|------|---------|-------------|
| `docker-compose.yml` | Docker Compose 3.8 | 5 services: PostgreSQL 15 (port 5433), pgAdmin (port 5050), OCR Extraction Python FastAPI (port 8000), Forwarder Mapping Python FastAPI (port 8001), Azurite storage emulator (ports 10010-10012). 3 named volumes. |
| `.gitignore` | Git exclusions | Standard Node.js ignores + `.env*`, `.next/`, `.claude/settings.local.json`, `.vscode/settings.json`, test artifacts, debug scripts, Windows encoding glitch patterns |
| `.env.example` | Environment template | 16 environment variable groups: DATABASE_URL, AUTH_SECRET, Azure AD, app URL, Azure Blob Storage (Azurite default), Azure Document Intelligence, OCR/Mapping service URLs, Azure OpenAI GPT-5.2, unified processor flag, Upstash Redis, n8n, Microsoft Graph, bcrypt config |

### Package Configuration

| File | Purpose |
|------|---------|
| `package.json` | Project manifest (v1.0.0, private) |

---

## 2. NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev --port 3005` | Development server (default port 3005) |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `next lint` | ESLint check |
| `type-check` | `tsc --noEmit` | TypeScript type verification |
| `db:generate` | `prisma generate` | Generate Prisma Client |
| `db:migrate` | `prisma migrate dev` | Run database migrations |
| `db:studio` | `prisma studio` | Prisma database GUI |
| `db:push` | `prisma db push` | Push schema to database |
| `db:seed` | `prisma db seed` | Seed database (via ts-node) |
| `index:check` | `node scripts/check-index-sync.js` | Verify barrel export sync |
| `i18n:check` | `npx ts-node scripts/check-i18n-completeness.ts` | Verify i18n translation completeness |

Notable: No `format` (Prettier), `test`, or `e2e` scripts defined. Prettier formatting relies on VS Code editor integration. Playwright 1.57 is in devDependencies but has no npm script.

---

## 3. VS Code Integration

### Settings (`.vscode/settings.json`)

| Category | Configuration |
|----------|--------------|
| Format on save | Enabled, default formatter: Prettier |
| Code actions on save | ESLint auto-fix + organize imports |
| Editor | 2-space tabs, insert spaces, no auto-detection |
| TypeScript | Non-relative imports preferred, auto-update imports on file move, single quotes |
| File associations | `*.css` treated as `tailwindcss` |
| Search exclusions | `node_modules`, `dist`, `.next`, `coverage` |
| Tailwind CSS | Class regex for `cva()` and `cn()` utility functions |
| Prisma | Prisma formatter for `.prisma` files |
| Per-language formatters | TypeScript/TSX/JSON/JSONC use Prettier; Markdown has word wrap enabled |

### Recommended Extensions (`.vscode/extensions.json`)

16 extensions organized by category:

| Category | Extensions |
|----------|-----------|
| Core dev tools | `vscode-eslint`, `prettier-vscode`, `vscode-tailwindcss`, `prisma` |
| TypeScript/React | `vscode-typescript-next`, `es7-react-js-snippets` |
| Docker | `vscode-docker` |
| Git | `gitlens`, `git-graph` |
| Productivity | `path-intellisense`, `code-spell-checker`, `vscode-todo-highlight`, `errorlens` |
| API development | `rest-client` |
| Theme | `material-icon-theme` |

### Code Snippets (`.vscode/typescript.code-snippets`)

527-line snippet file with 22 project-specific snippets:

| Prefix | Purpose |
|--------|---------|
| `file-header-service` | JSDoc header for service files |
| `file-header-api` | JSDoc header for API routes |
| `file-header-hook` | JSDoc header for hooks |
| `file-header-component` | JSDoc header for components |
| `file-header-types` | Simplified JSDoc header for types |
| `func-doc` / `func-doc-simple` | Function JSDoc comments |
| `section` / `subsection` | Section separator comments |
| `rfc-feature` | Full feature component template with structure |
| `rfc-simple` | Simple component template |
| `hook-query` | React Query data-fetching hook |
| `hook-mutation` | React Query mutation hook |
| `api-get-list` | API GET list route with pagination |
| `api-post-create` | API POST create route with Zod validation |
| `zod-model` / `zod-input` | Zod validation schemas |
| `interface-props` | Component Props interface |
| `type-response` | API response type |
| `clog` | Contextual console.log |
| `trycatch` | Try-catch block |
| `todo` / `fixme` | TODO/FIXME comments |
| `prisma-findmany` / `prisma-create` / `prisma-transaction` | Prisma ORM operations |

---

## 4. Build Pipeline Deep Dive (`next.config.ts`)

### Plugins
- **next-intl**: Wraps Next.js config via `createNextIntlPlugin('./src/i18n/request.ts')` for i18n routing

### Webpack Customizations
- **Client-side**: Aliases `canvas` to `false` (not available in browser)
- **Server-side**: Externalizes `canvas`, `pdf-to-img`, `pdfjs-dist` as CommonJS modules to avoid bundling native/ESM issues
- **Context**: FIX-026 workaround for pdfjs-dist v5 ESM incompatibility with webpack eval-based source maps

### Experimental Features
- `serverActions.bodySizeLimit`: 10MB (for file upload handling)

### Build Flags
- `eslint.ignoreDuringBuilds`: `true` (temporary, allows build with ESLint warnings/errors)
- `reactStrictMode`: `true`

---

## 5. TypeScript Configuration

| Setting | Value | Impact |
|---------|-------|--------|
| `strict` | `true` | Enables all strict checks (noImplicitAny, strictNullChecks, etc.) |
| `target` | `ES2017` | Output compatibility level |
| `module` | `esnext` | Modern ES module syntax |
| `moduleResolution` | `bundler` | Next.js bundler-native resolution |
| `incremental` | `true` | Faster rebuilds via `.tsbuildinfo` cache |
| `isolatedModules` | `true` | Required for SWC/esbuild transpilation |
| `skipLibCheck` | `true` | Skips type-checking `.d.ts` files for speed |
| `noEmit` | `true` | Type-check only, no output files |
| `paths` | `@/* -> ./src/*` | Single path alias for all source imports |

Excluded from compilation: `node_modules`, `scripts`

---

## 6. Docker Services Architecture

```
docker-compose.yml (5 services)
├── postgres (PostgreSQL 15 Alpine)
│   ├── Port: 5433 -> 5432
│   ├── Volume: postgres_data
│   └── Healthcheck: pg_isready
├── pgadmin (dpage/pgadmin4)
│   ├── Port: 5050 -> 80
│   ├── Volume: pgadmin_data
│   └── Depends on: postgres
├── ocr-extraction (Python FastAPI, custom Dockerfile)
│   ├── Port: 8000 -> 8000
│   ├── Env: AZURE_DI_ENDPOINT, AZURE_DI_KEY
│   └── Healthcheck: HTTP /health
├── forwarder-mapping (Python FastAPI, custom Dockerfile)
│   ├── Port: 8001 -> 8001
│   ├── Depends on: postgres (healthy)
│   └── Healthcheck: HTTP /health
└── azurite (Azure Storage Emulator)
    ├── Ports: 10010 (Blob), 10011 (Queue), 10012 (Table)
    └── Volume: azurite_data
```

---

## 7. Key Dependencies Summary

### Production (77 packages)

| Category | Key Packages |
|----------|-------------|
| Framework | next 15.0.0, react 18.3, react-dom 18.3 |
| UI | 20 @radix-ui packages, lucide-react, tailwind-merge, class-variance-authority, cmdk, sonner, recharts |
| State | zustand 5.x, @tanstack/react-query 5.x, @tanstack/react-table 8.x |
| Forms | react-hook-form 7.x, @hookform/resolvers, zod 4.x |
| i18n | next-intl 4.7, next-themes |
| Database | @prisma/adapter-pg, pg |
| Azure | @azure/storage-blob, @azure/ai-form-recognizer, @azure/identity |
| PDF | pdfjs-dist 4.x, react-pdf 9.x, pdf-parse, pdf-to-img, pdfkit, unpdf |
| Auth | next-auth 5.0-beta.30, jose, bcryptjs |
| Other | openai 6.x, exceljs, nodemailer, @microsoft/microsoft-graph-client, @upstash/redis, @dnd-kit (4 packages), diff, swagger-ui-react |

### Development (14 packages)

| Package | Version | Purpose |
|---------|---------|---------|
| @prisma/client | 7.2 | ORM client |
| prisma | 7.2 | CLI + migrations |
| typescript | 5.x | Type system |
| eslint + eslint-config-next | 8.57 / 15.x | Linting |
| playwright | 1.57 | E2E testing |
| tailwindcss | 3.4 | CSS utility framework |
| postcss + autoprefixer | 8.4 / 10.4 | CSS processing |
| ts-node | 10.9 | TypeScript execution (seeds, scripts) |
| @types/* | Various | Type definitions (7 packages) |

---

## 8. Notable Gaps

| Area | Observation |
|------|-------------|
| Test runner | No Jest/Vitest configured; no `test` npm script |
| Prettier CLI | No `format` npm script; relies solely on VS Code |
| Bundle analyzer | No `@next/bundle-analyzer` installed |
| CI/CD | No `.github/workflows/`, no CI configuration files found |
| Husky/lint-staged | No pre-commit hooks configured |
| .dockerignore | File does not exist; Docker builds may include unnecessary files |
| Playwright config | No `playwright.config.ts` found despite Playwright 1.57 being installed |
| Storybook | Not installed; no component visual testing |
| Environment validation | No `@t3-oss/env-nextjs` or similar runtime env validation |
