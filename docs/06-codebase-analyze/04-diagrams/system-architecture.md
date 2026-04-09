# System Architecture - High-Level Diagram

> Generated: 2026-04-09 | Source: architecture-patterns.md, integration-map.md, services-overview.md

This diagram shows the overall system architecture including the Next.js frontend, API layer, service layer, database, Python microservices, and all external service integrations.

```mermaid
graph TB
    subgraph Client["Browser Client"]
        UI["React 18.3 + shadcn/ui<br/>371 Components"]
        ZUSTAND["Zustand 5.x<br/>UI State"]
        RQ["React Query 5.x<br/>Server State"]
        RHF["React Hook Form + Zod<br/>Form Validation"]
    end

    subgraph NextJS["Next.js 15 App Router"]
        PAGES["[locale] Pages<br/>82 pages (6 auth + 76 dashboard)"]
        MW["Middleware<br/>Locale detection + Auth redirect"]
        API["API Routes<br/>331 files / 400+ endpoints"]
        I18N["next-intl<br/>34 namespaces x 3 languages"]
    end

    subgraph Services["Node.js Service Layer (200 files, ~100K LOC)"]
        UP["UnifiedDocumentProcessor<br/>V2/V3/V3.1 routing"]
        EV3["Extraction V3.1<br/>3-Stage Pipeline"]
        EV2["Extraction V2<br/>11-Step Pipeline"]
        MAP["Mapping Service<br/>3-Tier Resolution"]
        CONF["Confidence Scoring<br/>6-Dimension Weighted (5+1 optional)"]
        RULE["Rule Engine<br/>11 services"]
        BIZ["Business Services<br/>Company, Document, Review, Report, Audit"]
    end

    subgraph Python["Python Microservices (FastAPI)"]
        OCR["Extraction Service<br/>Port 8000"]
        PYMAP["Mapping Service<br/>Port 8001"]
    end

    subgraph Database["PostgreSQL 15"]
        PRISMA["Prisma ORM 7.2<br/>122 Models / 113 Enums"]
    end

    subgraph External["External Services"]
        AZDI["Azure Document<br/>Intelligence (OCR)"]
        AZOAI["Azure OpenAI<br/>GPT-5.2 + GPT-5-nano"]
        BLOB["Azure Blob Storage<br/>(Azurite in dev)"]
        GRAPH["Microsoft Graph API<br/>SharePoint + Outlook"]
        N8N["n8n Workflow Engine"]
        REDIS["In-Memory Rate Limiter<br/>(Upstash Redis is placeholder only)"]
        SMTP["SMTP / Nodemailer<br/>Email Notifications"]
        AAD["Azure AD (Entra ID)<br/>Enterprise SSO"]
    end

    Client -->|HTTP/HTTPS| NextJS
    PAGES --> API
    API --> Services
    UP --> EV3
    UP --> EV2
    EV3 --> MAP
    EV3 --> CONF

    Services --> PRISMA
    Services -->|HTTP :8000| OCR
    Services -->|HTTP :8001| PYMAP
    OCR --> AZDI
    EV3 -->|OpenAI SDK| AZOAI
    Services --> BLOB
    Services --> GRAPH
    Services --> N8N
    Services --> REDIS
    Services --> SMTP
    MW --> AAD
```

## Layer Responsibilities

| Layer | Responsibility | Key Metrics |
|-------|---------------|-------------|
| **Client** | UI rendering, state management, form validation | 371 components, 104 hooks |
| **Next.js** | Routing, i18n, middleware, API endpoints | 82 pages, 331 route files |
| **Service** | Business logic, pipeline orchestration, rules | 200 files, ~100K LOC |
| **Python** | OCR extraction, mapping resolution | 2 FastAPI services |
| **Database** | Persistence, audit trails | 122 Prisma models |
| **External** | AI, storage, email, auth, workflow automation | 9 integration categories |
