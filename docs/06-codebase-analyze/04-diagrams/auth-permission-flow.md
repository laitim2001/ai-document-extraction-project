# Authentication & Authorization Flow

> Generated: 2026-04-09 | Source: security-audit.md, integration-map.md, architecture-patterns.md

## Dual Authentication Paths

```mermaid
flowchart TD
    USER(["User"])

    USER -->|Corporate SSO| AAD_PATH
    USER -->|Email + Password| LOCAL_PATH

    subgraph AAD_PATH["Azure AD SSO Path"]
        AAD_LOGIN["Login via Azure AD (Entra ID)"]
        AAD_REDIRECT["OAuth redirect to Azure"]
        AAD_TOKEN["Azure returns ID token"]
        AAD_MATCH["Match/create User in DB<br/>via @auth/prisma-adapter"]
        AAD_LOGIN --> AAD_REDIRECT --> AAD_TOKEN --> AAD_MATCH
    end

    subgraph LOCAL_PATH["Local Credentials Path"]
        CRED_LOGIN["Email + Password form"]
        BCRYPT["bcrypt password verification<br/>src/lib/password.ts"]
        STATUS_CHECK{"User status<br/>== ACTIVE?"}
        EMAIL_CHECK{"Email<br/>verified?"}
        CRED_LOGIN --> BCRYPT --> STATUS_CHECK
        STATUS_CHECK -->|No| REJECT_STATUS(["Rejected: Inactive"])
        STATUS_CHECK -->|Yes| EMAIL_CHECK
        EMAIL_CHECK -->|No| REJECT_EMAIL(["Rejected: Unverified"])
        EMAIL_CHECK -->|Yes| AUTH_OK
    end

    AAD_MATCH --> SESSION
    AUTH_OK["Credentials Valid"] --> SESSION

    subgraph SESSION["JWT Session Creation"]
        JWT["Create JWT (8h max)<br/>NextAuth v5"]
        ENRICH["Enrich token with:<br/>- role<br/>- permissions[]<br/>- cityAccess[]<br/>- isGlobalAdmin<br/>- isRegionalManager"]
        JWT --> ENRICH
    end

    SESSION --> PROTECTED["Access Protected Resources"]
```

## Route Protection Architecture

```mermaid
flowchart TD
    REQUEST(["Incoming Request"])

    REQUEST --> MW{"src/middleware.ts<br/>Route check"}

    MW -->|"/api/*" path| API_SELF["API Routes<br/>(self-protect, no central middleware)"]
    MW -->|Page routes| AUTH_CONFIG["auth.config.ts<br/>authorized callback"]

    AUTH_CONFIG -->|"/dashboard/*"| CHECK_SESSION{"Has valid<br/>JWT session?"}
    AUTH_CONFIG -->|"/auth/*"| PUBLIC_AUTH["Public auth pages<br/>(login, register, forgot-pw)"]
    AUTH_CONFIG -->|Other pages| LOCALE["Locale redirect<br/>next-intl middleware"]

    CHECK_SESSION -->|Yes| DASHBOARD["Dashboard Pages"]
    CHECK_SESSION -->|No| REDIRECT_LOGIN["Redirect to /auth/login"]

    subgraph API_AUTH["API Auth Patterns (per-route)"]
        SESSION_CHECK["auth() session check<br/>201/331 routes (61%)"]
        APIKEY_CHECK["API key auth<br/>/v1/* external endpoints"]
        N8N_AUTH["n8n API middleware<br/>Custom API key validation"]
        NO_AUTH["No auth<br/>130 routes (39%)"]
    end

    API_SELF --> SESSION_CHECK
    API_SELF --> APIKEY_CHECK
    API_SELF --> N8N_AUTH
    API_SELF --> NO_AUTH
```

## City-Based Access Control (RLS)

```mermaid
flowchart LR
    SESSION["JWT Session<br/>cityAccess: string[]"]
    DB_CTX["db-context.ts<br/>$executeRawUnsafe"]
    PG_VAR["PostgreSQL<br/>set_config('app.user_city_codes', ...)"]
    QUERY["Service queries<br/>filter by cityCode"]

    SESSION --> DB_CTX --> PG_VAR --> QUERY

    subgraph ACCESS_LEVELS["Access Hierarchy"]
        GLOBAL["Global Admin<br/>All cities, all data"]
        REGIONAL["Regional Manager<br/>Cities in assigned regions"]
        CITY["City User<br/>Only assigned cities"]
    end
```

## Permission Model

| Concept | Implementation | Key Models |
|---------|---------------|------------|
| **Authentication** | NextAuth v5 (Azure AD + Credentials) | User, Account, Session |
| **Session** | JWT-based, 8h max, stateless | VerificationToken |
| **Roles** | RBAC with permissions array | Role, UserRole |
| **City Access** | Per-user city assignment | UserCityAccess, City |
| **Region Access** | Regional manager access | UserRegionAccess, Region |
| **API Keys** | External API access (n8n, v1) | ApiKey, N8nApiKey, ExternalApiKey |

## Auth Coverage Summary

| Domain | Coverage | Notes |
|--------|----------|-------|
| /admin/* | 91% | Well protected |
| /rules/*, /review/*, /audit/* | 100% | Fully protected |
| /documents/* | 79% | Some gaps |
| /v1/* | 17% | HIGH risk -- 64 unprotected routes |
| /cost/*, /dashboard/*, /statistics/* | 0% | HIGH risk -- no auth |
| **Overall** | **61%** (201/331) | Needs improvement |
