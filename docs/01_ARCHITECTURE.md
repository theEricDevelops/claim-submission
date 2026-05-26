# Architecture

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | ^16.2.6 |
| UI Library | React | ^19.2.6 |
| Language | TypeScript | ^5.9.3 |
| Styling | Tailwind CSS | ^4.3.0 |
| Database | PostgreSQL | 16+ |
| ORM | Prisma | ^7.8.0 |
| Auth Tokens | jose (JWT) | ^6.2.3 |
| Validation | Zod | ^4.4.3 |
| Linting | Biome | ^2.4.15 |
| Package Manager | pnpm | |
| Containerization | Docker | |
| External API – DocuSeal | `@docuseal/api` | ^1.0.23 |
| External API – Geoapify | REST (server-proxied) | |
| DB Driver | `pg` (node-postgres) | ^8.21.0 |

---

## 2. Project Structure

```
claim-submission/
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Root layout (HTML shell, ThemeProvider, inline theme-script)
│   ├── page.tsx                    # Main page — renders ClaimForm
│   ├── globals.css                 # All application styles (Tailwind v4 + CSS custom properties)
│   └── api/
│       ├── claims/route.ts         # POST /api/claims — full claim submission
│       ├── config/route.ts         # GET /api/config — public config (currently empty)
│       ├── geoapify/route.ts       # GET /api/geoapify — server-side Geoapify proxy
│       └── templates/fields/route.ts # POST /api/templates/fields — fetch template fields
├── components/                    # React client components
│   ├── ClaimForm.tsx               # Multi-step form container (5 steps)
│   ├── AddressInput.tsx            # Geoapify autocomplete + manual toggle
│   ├── ContactFields.tsx           # Phone + email pair with blur validation
│   ├── NameField.tsx               # Single labeled text input with blur validation
│   ├── StepIndicator.tsx           # Step progress indicator (clickable)
│   ├── ThemeProvider.tsx           # Dark mode context (localStorage + system preference)
│   └── ThemeToggle.tsx             # Dark/light toggle button
├── lib/                           # Server-only services
│   ├── auth.ts                     # JWT session creation + API key / Bearer token verification
│   ├── config.ts                   # Env vars loader (DOCUSEAL, GEOAPIFY, SESSION_SECRET, API_SHARED_SECRET, DATABASE_URL)
│   ├── db.ts                       # Prisma client singleton (PostgreSQL adapter)
│   ├── docuseal.ts                 # @docuseal/api wrapper (template resolution, field fetching, submission)
│   ├── validation.ts               # Zod schemas for claim submission + template field requests
│   └── generated/prisma/           # Generated Prisma client (gitignored)
├── prisma/
│   ├── schema.prisma               # Main schema (generator + datasource config)
│   ├── prisma.config.ts            # Prisma config (schema path, migration path, datasource URL)
│   ├── models/                     # Model files split by domain
│   │   ├── enums.prisma            # All enums
│   │   ├── tenant.prisma           # Tenant, TenantConfig, TenantRole, TenantInvite
│   │   ├── user.prisma             # User
│   │   ├── member.prisma           # Member
│   │   ├── person.prisma           # Person
│   │   ├── company.prisma          # Company
│   │   ├── companyContact.prisma   # CompanyContact (Person ↔ Company join)
│   │   ├── contact.prisma          # Contact, Phone, Email, Address
│   │   ├── policy.prisma           # Policy
│   │   ├── job.prisma              # Job
│   │   ├── lead.prisma             # Lead
│   │   ├── assignmentContact.prisma # AssignmentContact (polymorphic job/lead assignee)
│   │   ├── contract.prisma         # Contract
│   │   ├── document.prisma         # Document
│   │   ├── note.prisma             # Note (polymorphic)
│   │   ├── activity.prisma         # Activity (polymorphic)
│   │   └── email.prisma            # EmailMessage (polymorphic)
│   └── migrations/                 # Generated migration files (gitignored until created)
├── types/
│   └── index.ts                    # Shared TypeScript types
├── proxy.ts                        # Next.js middleware — session cookies + rate limiting
├── next.config.mjs                 # Next.js configuration (security headers, allowedDevOrigins)
├── prisma.config.ts                # Prisma CLI configuration
├── postcss.config.mjs              # PostCSS with @tailwindcss/postcss
├── tsconfig.json                   # TypeScript config (ES2022 target, strict, bundler module resolution)
├── biome.json                      # Biome linter/formatter config
├── package.json                    # Project dependencies
├── pnpm-workspace.yaml             # pnpm workspace and allowBuilds config
├── Dockerfile                      # Multi-stage production build
├── docker-compose.yml              # Single-container deployment
└── .env.example                    # Environment variable template
```

---

## 3. Next.js App Router

### 3.1 Routing

Next.js 16 App Router with file-system routing:

- **`app/page.tsx`** (`/`): Main entry point. Renders the `ClaimForm` multi-step form component.
- **`app/layout.tsx`**: Root layout providing the HTML shell, `ThemeProvider`, inline theme-script (prevents flash of wrong theme), and global CSS import.
- **`app/api/`**: API route handlers using the Route Handler pattern (`route.ts` files).

### 3.2 Layout

```tsx
// app/layout.tsx (simplified)
<html lang="en" suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />  {/* inline: reads localStorage before paint */}
  </head>
  <body>
    <ThemeProvider>
      <ThemeToggle />
      {children}
    </ThemeProvider>
  </body>
</html>
```

The inline script (`themeScript`) reads `localStorage('theme-preference')` or `prefers-color-scheme: dark` media query and applies the `.dark` class to `<html>` before React hydrates, preventing a flash of the wrong theme.

### 3.3 Middleware (`proxy.ts`)

Next.js middleware runs on every request matching `'/'` and `'/api/:path*'`.

**Two responsibilities:**

1. **Session provisioning**: On first page visit (no `session` cookie), creates a JWT session via `createSessionJWT()` and sets an httpOnly, secure, SameSite=lax cookie named `session`. This authenticates the browser for subsequent API calls.
2. **Rate limiting**: In-memory per-IP counters for non-GET API routes:
   - `POST /api/claims`: 10 requests/hour/IP
   - Other non-GET API (templates/fields): 100 requests/hour/IP
   - Returns `429 Too Many Requests` with `Retry-After` header when exceeded

---

## 4. API Layer

### 4.1 Endpoints

| Endpoint | Method | Auth | Rate Limit | Purpose |
|----------|--------|------|------------|---------|
| `/api/claims` | POST | Required | 10/hr | Submit claim → DocuSeal agreement |
| `/api/templates/fields` | POST | Required | 100/hr | Fetch DocuSeal template fields |
| `/api/geoapify` | GET | Required | None | Proxy address autocomplete/search |
| `/api/config` | GET | None | None | Public configuration (empty) |

### 4.2 Authentication (`lib/auth.ts`)

Three authentication methods accepted on all protected routes (checked in order):

1. **Session cookie**: JWT in httpOnly `session` cookie, auto-provisioned by `proxy.ts` on first visit.
2. **Bearer token**: `Authorization: Bearer <API_SHARED_SECRET>` header.
3. **API key**: `x-api-key` header matching `API_SHARED_SECRET`.

Session JWTs are signed with `SESSION_SECRET` using `jose` (HS256). No expiry on the JWT itself — the cookie `maxAge` (24h) controls session lifetime.

### 4.3 Validation (`lib/validation.ts`)

All API inputs validated with Zod before processing:
- `claimSchema`: Validates the full `ClaimFormData` — state, property address, insureds (max 2), adjuster info, field values.
- `templatesFieldsSchema`: Validates `{ state: string, insuredCount: number }`.

### 4.4 Request Flow

```
Browser ──> proxy.ts (middleware)
              ├── No session cookie? → Create JWT session, set cookie
              ├── POST /api/* → Rate limit check
              └── Forward to route handler

Route handler:
  ├── verifyAuth(request) → { verified: boolean }
  ├── parse + validate body with Zod
  ├── Call external service (DocuSeal / Geoapify)
  └── Return JSON response
```

---

## 5. Component Architecture

### 5.1 Client Components

All UI components are client components (`"use client"`). No server components are used in the interactive form.

### 5.2 Multi-Step Form (`ClaimForm.tsx`)

The 5-step form (`currentStep` 0–4) is managed by `ClaimForm.tsx`:

| Step | Name | Component | Key Logic |
|------|------|-----------|-----------|
| 0 | Loss Address | `AddressInput` | Geoapify autocomplete → state extraction |
| 1 | Insured Parties | Inline fields (add/remove, max 2) | Individual or Company toggle, phone/email blur validation |
| 2 | Loss Details | Dynamic template fields | Fetched from DocuSeal, filtered (no auto/signature fields) |
| 3 | Adjuster Info | `NameField` + `ContactFields` + `AddressInput` | First/last name, email, phone, license#, mailing address |
| 4 | Review & Submit | Read-only summary | Submit → POST /api/claims |

**Transition validation**: On each "Next" click, step fields are validated. On Step 0→1 and Step 1→2 boundaries, the client calls `POST /api/templates/fields` to pre-validate that a DocuSeal template exists for the given state + insured count.

### 5.3 Shared Components

| Component | Props | Used In |
|-----------|-------|---------|
| `AddressInput` | `label`, `value: AddressValue`, `onChange`, `required?`, `showErrors?` | Steps 0, 1 (mailing per insured), 3 (adjuster mailing) |
| `ContactFields` | `phone`, `email`, `onPhoneChange`, `onEmailChange`, `showErrors?` | Steps 1 (per insured), 3 (adjuster) |
| `NameField` | `label`, `value`, `onChange`, `required?`, `maxLength?`, `showError?` | Steps 1 (name components), 3 (adjuster names) |
| `StepIndicator` | `currentStep`, `totalSteps`, `labels`, `maxCompletedStep`, `onStepClick?` | ClaimForm (top of form) |

### 5.4 Theme System

- `ThemeProvider` (context) reads `localStorage('theme-preference')` or `prefers-color-scheme: dark`.
- `ThemeToggle` button toggles between light/dark, persists to localStorage.
- Inline `<script>` in `layout.tsx` applies the `.dark` class before first paint.
- Tailwind v4 dark variant via CSS custom properties in `globals.css`.

---

## 6. Data Layer

### 6.1 Prisma ORM + PostgreSQL

Prisma 7 with the `prisma-client-js` generator, connected to PostgreSQL via the `@prisma/adapter-pg` driver adapter.

**Configuration chain:**

```
prisma.config.ts              ← Prisma CLI reads this
  ├── schema: "prisma/"       ← All .prisma files under prisma/ and prisma/models/
  ├── migrations path
  └── datasource URL          ← from env DATABASE_URL

schema.prisma                 ← Generator + datasource provider
  └── generator → prisma-client-js → output: ../lib/generated/prisma

models/*.prisma               ← Split by domain, auto-discovered
```

### 6.2 Prisma Client Singleton (`lib/db.ts`)

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '@/lib/generated/prisma'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

The `globalThis` caching prevents connection pool exhaustion from Next.js hot-reload creating multiple instances in development.

### 6.3 Database Lifecycle

| Command | Purpose |
|---------|---------|
| `pnpm prisma generate` | Generate Prisma Client from schema |
| `pnpm prisma db push` | Push schema to database (dev, no migrations) |
| `pnpm prisma migrate dev` | Create + apply a new migration (development) |
| `pnpm prisma migrate deploy` | Apply pending migrations (production) |
| `pnpm prisma migrate reset` | Drop schema + re-apply all migrations |
| `pnpm prisma studio` | Launch Prisma Studio GUI |

### 6.4 Indexing Strategy

All foreign key columns are indexed for JOIN performance. Additional indexes cover common filter/lookup patterns (status, type, role, category), search fields (policy number, claim number, person name, invite email), and polymorphic type+id pairs. See `docs/02_DATA_MODEL.md` for the complete index list.

### 6.5 Data Model Overview

22 models across 17 files. Key entity relationships:

```
Tenant ──1:M──> Member/User/Role/Invite
Contact ◂──1:1──▸ Person | Company
Person ──1:1──> Member | User
Policy ──1:M──> Job | Lead
Job | Lead ──M:M──> Contact (via AssignmentContact)
Job | Lead ──1:M──> Contract | Document
Contract ──M:1──> Member (provider)
Contract ──M:M──> Contact (clients)
Note / Activity / EmailMessage ──(polymorphic)──> various entities
```

See `docs/02_DATA_MODEL.md` for the complete data model documentation.

---

## 7. External Integrations

### 7.1 DocuSeal (`lib/docuseal.ts`)

Wrapper around `@docuseal/api` for document template management and agreement signing.

**Key functions:**

- `resolveTemplateId(state, count)`: Constructs key `{STATE}_{count}`, fetches all templates from DocuSeal, matches by name prefix. Results cached in `cachedPrefixMap` (in-memory Map). Call `clearTemplateCache()` to refresh.
- `getTemplate(id)`: Fetch template metadata, fields, and submitters.
- `createSubmission(templateId, submitters)`: Creates a DocuSeal signing submission with pre-filled field values.

**Template naming convention**: Templates must be named with prefix `{STATE}_{count} - <description>`. Examples: `TN_1 - TN Public Adjuster Agreement Package (Single Insured)`.

### 7.2 Geoapify (`app/api/geoapify/route.ts`)

Server-side proxy for Geoapify Geocoding API. The browser calls `GET /api/geoapify?text=...&endpoint=autocomplete` and the server injects the `GEOAPIFY_API_KEY` before forwarding to `https://api.geoapify.com/v1/geocode/{endpoint}`. This keeps the API key server-side.

---

## 8. Security

| Layer | Implementation |
|-------|---------------|
| Authentication | Session JWT (auto-provisioned httpOnly cookie) + Bearer token / `x-api-key` header |
| Validation | Zod schemas on all API routes (malformed requests rejected before processing) |
| Rate Limiting | In-memory per-IP counters in middleware (10/hr claims, 100/hr templates) |
| CSP | Content-Security-Policy header (frame-ancestors 'none', no external scripts in production) |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer | `Referrer-Policy: strict-origin-when-cross-origin` |
| API Key Secrecy | Geoapify key is server-side only (not exposed to client) |
| Session Cookie | httpOnly, Secure (in production), SameSite=lax, path=/ |

---

## 9. Build & Deployment

### 9.1 Development

```bash
pnpm dev              # next dev → http://localhost:3000
pnpm build            # next build → production build
pnpm start            # next start -p 3000 (requires build first)
pnpm lint             # biome lint
pnpm format           # biome format
pnpm check            # biome check --write (lint + format + imports)
```

### 9.2 Docker

Single-container deployment via Docker:

**Dockerfile** — Multi-stage build:
1. **Build stage**: Install deps with pnpm, build Next.js, prune dev dependencies.
2. **Production stage**: Copy `.next`, `node_modules`, `package.json`, `next.config.mjs`. Runs as non-root `appuser`. Exposes port 3000.

**docker-compose.yml**:
```yaml
services:
  app:
    build: .
    container_name: claim-submission
    ports:
      - "3000:3000"
    env_file:
      - .env
```

### 9.3 Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | 3000 | Server port |
| `DATABASE_URL` | No | — | PostgreSQL connection string |
| `DOCUSEAL_API_KEY` | Yes | — | DocuSeal API authentication |
| `DOCUSEAL_API_URL` | No | `https://sign.plpas.com/api` | DocuSeal API base URL |
| `GEOAPIFY_API_KEY` | Yes | — | Geoapify Geocoding API |
| `SESSION_SECRET` | Yes | — | JWT signing secret (32+ chars, random) |
| `API_SHARED_SECRET` | Yes | — | Shared API key for programmatic access |

---

## 10. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "paths": { "@/*": ["./*"] }
  }
}
```

- **`@/` path alias**: Maps to project root for clean imports (`@/lib/auth`, `@/components/ClaimForm`).
- **Bundler module resolution**: Required for Next.js Turbopack / webpack.
- **Strict mode**: All strict type-checking options enabled.
- **ES2022**: Modern syntax (optional chaining, nullish coalescing, private fields, etc.).

---

## 11. Linting & Formatting

Using Biome as a unified linter and formatter (replaces ESLint + Prettier):

| Command | Action |
|---------|--------|
| `pnpm lint` | `biome lint .` — checks for code issues |
| `pnpm lint:fix` | `biome lint --write .` — auto-fixes lintable issues |
| `pnpm format` | `biome format --write .` — formats all files |
| `pnpm check` | `biome check --write .` — lint + format + organize imports |

---

## 12. Future Considerations

- **Testing**: Add Vitest (unit) and Playwright (e2e) test suites.
- **Persistent rate limiting**: Migrate from in-memory Map to Redis.
- **Multi-instance deployment**: Replace SQLite (if used) with PostgreSQL for horizontal scaling.
- **Claim dashboard**: List/filter claims by status, date, state.
- **Role-based access**: User authentication with adjuster vs. admin roles.
- **File uploads**: Direct document uploads linked to claims.
- **Audit log**: Track claim status changes and field edits.
