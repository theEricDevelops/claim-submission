# Claim Submission App — Specification

## 1. Overview

A multi-step public adjuster claim submission application. Users enter loss address → insured party information → loss details (template-driven) → adjuster information, then the app generates a DocuSeal submission agreement via the DocuSeal API. The app is a single Next.js 16 project using `pnpm`.

---

## 2. Architecture

### 2.1 Project Structure

```plain
claim-submission/
├── app/                             # Next.js App Router
│   ├── api/
│   │   ├── claims/route.ts          # POST /api/claims — full claim submission (auth + Zod validated)
│   │   ├── config/route.ts          # GET /api/config — returns {} (no longer exposes keys)
│   │   ├── geoapify/route.ts        # GET /api/geoapify — server-side Geoapify proxy (auth required)
│   │   └── templates/fields/route.ts # POST /api/templates/fields — fetches DocuSeal template fields + submitters (auth + Zod validated)
│   ├── globals.css                  # All application styles (Tailwind v4 + custom vars, .field-error, etc.)
│   ├── layout.tsx                   # Root layout (HTML shell, ThemeProvider, inline theme-script)
│   └── page.tsx                     # Main page → renders ClaimForm
├── components/                      # React client components ("use client")
│   ├── AddressInput.tsx             # Geoapify autocomplete + manual toggle with address verification
│   ├── ClaimForm.tsx                # Multi-step form container (5 steps, 0-indexed)
│   ├── ContactFields.tsx            # Phone + email pair with blur validation
│   ├── NameField.tsx                # Single labeled text input with blur validation
│   ├── StepIndicator.tsx            # Step progress indicator (clickable on review step)
│   ├── ThemeProvider.tsx            # Dark mode context (localStorage + system preference)
│   └── ThemeToggle.tsx              # Dark/light toggle button in layout header
├── lib/                             # Server-only services
│   ├── auth.ts                      # JWT session creation + API key / Bearer token verification
│   ├── config.ts                    # Env vars loader (DOCUSEAL, GEOAPIFY, SESSION_SECRET, API_SHARED_SECRET, DATABASE_URL)
│   ├── db.ts                        # Prisma client singleton
│   ├── docuseal.ts                  # @docuseal/api wrapper (template resolution, field fetching, submission)
│   └── validation.ts                # Zod schemas for claim submission + template field requests
├── prisma/                          # Prisma ORM
│   ├── schema.prisma                # Database schema (SQLite)
│   └── migrations/                  # Generated migration files
├── types/                           # Shared TypeScript types
│   └── index.ts                     # AddressValue, NamedInsured, ClaimFormData, TemplateField, constants, helpers
├── next.config.mjs                  # Next.js configuration (security headers, allowedDevOrigins)
├── postcss.config.mjs               # PostCSS with @tailwindcss/postcss
├── proxy.ts                         # Next.js 16 proxy/middleware — session cookie creation + in-memory rate limiting
├── Dockerfile                       # Next.js standalone Docker build (pnpm, node:lts)
├── docker-compose.yml               # Single container on port 3000
├── .env / .env.example              # PORT, DOCUSEAL_API_KEY, DOCUSEAL_API_URL, GEOAPIFY_API_KEY, SESSION_SECRET, API_SHARED_SECRET, DATABASE_URL
├── AGENTS.md                        # Agent reference guide
├── SPEC.md                          # This specification
├── tsconfig.json                    # TypeScript configuration
├── pnpm-lock.yaml                   # pnpm lockfile
├── pnpm-workspace.yaml              # pnpm workspace config
└── package.json                     # next, react, @docuseal/api, jose, zod, tailwindcss, @prisma/client, prisma
```

### 2.2 Data Flow

```plain
Client (browser)                     Next.js (proxy.ts → API)          DocuSeal / Geoapify
──────────────────                   ─────────────────────────          ──────────────────
  page load ───────────────────►     proxy.ts: createSessionJWT()
  ◄── httpOnly session cookie set     (auto on first visit)

  AddressInput.tsx                    GET /api/geoapify?endpoint=...     Geoapify Geocoding API
  fetch("/api/geoapify?...") ────►    verifyRequest() ─────────────►    /v1/geocode/autocomplete
                                      (session cookie or API key)        /v1/geocode/search
                                      forwards request + apiKey
  ◄── geocoding results               (key never reaches browser)

ClaimForm.tsx (Step 0→1)             app/api/templates/fields           @docuseal/api
  POST /api/templates/fields ───►     verifyRequest() ──────────────►   listTemplates()
  {state, insuredCount: 1}            Zod validation                     (cached in memory)
                                      resolveTemplateId()
  validates template exists

ClaimForm.tsx (Step 1→2)             app/api/templates/fields           @docuseal/api
  POST /api/templates/fields ───►     verifyRequest() ──────────────►   listTemplates()
  {state, insuredCount=N}             Zod validation                     getTemplate()
                                      resolveTemplateId()
                                      getTemplateFields() + submitters
  ◄── {fields, submitters}

ClaimForm.tsx                        app/api/claims                     @docuseal/api
  POST /api/claims ──────────────►    verifyRequest() ──────────────►   createSubmission()
  {state, fieldValues, ...}           Zod validation                     POST /submissions
                                      resolveTemplateId()               (submitters[].values)
                                      getTemplateSubmitters()
                                      getTemplateFields()
                                      maps values per-submitter
  ◄── submission result
```

**Rate limiting** (applied in proxy.ts for non-GET API routes only):

- `POST /api/claims`: 10 requests/hour per IP
- Other non-GET API: 100 requests/hour per IP
- GET requests (geoapify, config): not rate limited

### 2.3 Multi-Step Flow (0-Indexed)

| Step | Name | Component | Purpose |
| ------ | ------ | ----------- | --------- |
| 0 | **Loss Address** | `AddressInput` (Geoapify autocomplete + manual toggle) | Property loss address, extracts state for template routing. Template pre-validated on transition to Step 1. |
| 1 | **Insured Parties** | Inline insured entries with add/remove (max 2) | Individual (salutation/first/middle/last/suffix) or Company, phone/email, optional different mailing address |
| 2 | **Loss Details** | Dynamic template fields | Renders all template fields from DocuSeal (excluding auto-populated, signature/initials, and signing-date fields). Checkbox fields for exclusive claim type selection. |
| 3 | **Adjuster Info** | `ContactFields` + inline fields + `AddressInput` | First/last name, email, phone, license#, mailing address |
| 4 | **Review & Submit** | Read-only summary with clickable step indicator | Submit → DocuSeal |

#### Step Navigation

- **Next** advances (validates each step); **Back** returns (preserves all state).
- Step 0→1 transition: pre-validates template exists for state with `insuredCount: 1`. If no template, error shown on Step 0.
- Step 1→2 transition: fetches template fields and submitters from DocuSeal. If no template for `{state}_{count}`, error shown on Step 1.
- **Auto-focus**: When a step renders, the first `input`, `select`, or `textarea` receives focus so the user can start typing immediately.
- **Enter key**: On any step before Step 4, Enter triggers Next instead of form submission.
- **Step 4**: **StepIndicator** is clickable — click any completed step number to jump back and edit.
- **Validation failures**: Next button is disabled when current step fails validation. Individual field errors appear on blur, or all at once when clicking Next with invalid data.

### 2.4 Form Fields

#### Step 0 — Loss Address

| Field | Input | Required | Max Length |
| ------- | ------- | ---------- | ------------ |
| Property Address | Geoapify autocomplete text input (server-proxied) + manual toggle to street/city/state/zip fields | Yes | 500 (autocomplete), 200 (street), 100 (city), 10 (zip) |
| Apt / Suite | Text (manual mode only) | No | 200 |

State is extracted from the selected address and stored for template key resolution. Manual entry requires street, city, state, and zip. Blur-based validation: after tabbing out of a field, an inline error appears if empty. Apt/Suite is optional.

#### Step 1 — Insured Parties

**Type selector** (default: `-- Select --`). No other fields visible until type chosen.

**Individual:**

| Field | Input | Required | Max Length |
| ------- | ------- | ---------- | ------------ |
| Salutation | Dropdown: Mr., Mrs., Ms., Dr., Prof., Rev. | No | — |
| First Name | Text (blur-validated) | Yes | 100 |
| Middle Name | Text | No | 100 |
| Last Name | Text (blur-validated) | Yes | 100 |
| Suffix | Dropdown: Jr., Sr., II, III, IV, V | No | — |
| Phone | Tel (blur-validated: 10 digits) | Yes | 30 |
| Email | Email (blur-validated: basic format) | Yes | 254 |

**Company:**

| Field | Input | Required | Max Length |
| ------- | ------- | ---------- | ------------ |
| Company Name | Text (blur-validated) | Yes | 200 |
| Phone | Tel (blur-validated) | Yes | 30 |
| Email | Email (blur-validated) | Yes | 254 |

**Mailing Address:** Checkbox "Different mailing address" → reveals `AddressInput` component. Falls back to property address when unchecked.

**Add/Remove:** Max 2 insureds total. + button to add, − button per entry (shown when > 1).

#### Step 2 — Loss Details

No hardcoded fields. All fields are rendered dynamically from the DocuSeal template's field list, filtered to exclude:

- Fields assigned to auto-populated roles (Loss Address from Step 0, Insured info from Step 1, Adjuster info from Step 3)
- Fields with type `signature` or `initials` (signing-stage fields)
- Fields with "sign" or "initial" in their name (e.g., signing dates)

**Special rendering:**

- `Non-Emergency Claim`, `Emergency Claim`, `Supplemental Claim` → render as checkboxes. Checking stores `"X"` (DocuSeal checkbox convention). Emergency and Non-Emergency are mutually exclusive (checking one clears the other).
- All text/date fields get `maxLength={5000}`.

#### Step 3 — Adjuster Information

| Field | Input | Required | Max Length |
| ------- | ------- | ---------- | ------------ |
| First Name | Text (blur-validated) | Yes | 100 |
| Last Name | Text (blur-validated) | Yes | 100 |
| Email | Email (blur-validated) | Yes | 254 |
| Phone | Tel (blur-validated: 10 digits) | Yes | 30 |
| License # | Text | Yes | 50 |
| Mailing Address | `AddressInput` | No | 500 (autocomplete) / 200/100/10 (manual) |

#### Step 4 — Review & Submit

- Read-only summary of all entered data including extra field values.
- Step indicator bars are clickable to jump to any completed step.
- "Submit & Generate Agreement" sends full payload to `POST /api/claims`.
- Success: green screen with submission JSON.
- Error: red banner with retry.

### 2.5 Validation

#### Client-Side

| Step | Rule |
| ------ | ------ |
| 0 | All address components must be non-empty (street, city, state, zip). Apt/Suite optional. Errors shown on blur per field, or all at once when Next is clicked. |
| 1 | Type must be chosen. Individual: first + last name required. Company: company name required. Phone + email required for both. Phone must have exactly 10 digits (stripping country code + non-digits). Email must contain `@`. Errors shown on blur per field. |
| 2 | All required template fields must have a value |
| 3 | First name, last name, email, phone, license# all required. Phone 10 digits. Email format. Errors shown on blur per field. |
| 4 | (All steps must pass before submit) |

#### Server-Side (Zod)

- **`POST /api/claims`**: `claimSchema` validates state (2-letter US code), namedInsureds (1–10), property address, adjuster fields, fieldValues (key/value max 5000 chars each). All fields have `max()` constraints matching client-side `maxLength`.
- **`POST /api/templates/fields`**: `templatesFieldsSchema` validates state (2-letter, valid US code, uppercased), insuredCount (1–10 integer).
- On validation failure, returns `400` with `{ success: false, error: "Validation failed", details: [{ path, message }] }`.

### 2.6 Server Endpoints

#### `POST /api/templates/fields`

**Auth:** Required (session cookie or `Authorization: Bearer <token>` or `x-api-key` header).

**Request:**

```json
{ "state": "TN", "insuredCount": 1 }
```

**Response (success):**

```json
{
  "success": true,
  "templateId": 2,
  "fields": [
    { "name": "Date of Loss", "type": "date", "required": true, "submitter_uuid": "abc" },
    { "name": "First Insured Name", "type": "text", "required": true, "submitter_uuid": "def" }
  ],
  "submitters": [
    { "name": "First Insured", "uuid": "def" },
    { "name": "Public Adjuster", "uuid": "ghi" }
  ]
}
```

**Response (validation error):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "path": "state", "message": "Invalid US state code" }]
}
```

**Response (template not found):**

```json
{ "success": false, "error": "No DocuSeal template configured for \"TN_1\". Create a template with name starting with \"TN_1\"" }
```

#### `POST /api/claims`

**Auth:** Required (session cookie or `Authorization: Bearer <token>` or `x-api-key` header).

**Request body:**

```json
{
  "state": "TN",
  "namedInsureds": [
    {
      "type": "individual",
      "salutation": "Mr.",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "(555) 123-4567",
      "email": "john@example.com"
    }
  ],
  "propertyAddress": {
    "formatted": "123 Main St, Nashville, TN 37201",
    "street": "123 Main St",
    "city": "Nashville",
    "state": "TN",
    "zip": "37201"
  },
  "adjuster": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@adjuster.com",
    "phone": "(555) 987-6543",
    "licenseNumber": "LIC12345"
  },
  "fieldValues": {
    "Date of Loss": "2026-05-01",
    "Insurance Carrier": "Acme Insurance"
  }
}
```

**Response (success):**

```json
{ "success": true, "submission": { "id": 6, "submitters": [...] } }
```

**Response (validation error):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "path": "state", "message": "Invalid US state code" }]
}
```

**Processing:**

1. Verify authentication (session JWT or API shared key)
2. Parse and validate body with Zod `claimSchema`
3. Resolve template ID from `{state}_{namedInsureds.length}`
4. Fetch template submitters and fields from DocuSeal
5. Build `submitter_uuid → role` mapping
6. Distribute `fieldValues` to each submitter based on their field's `submitter_uuid`
7. Create submission with `submitters[].values` (not top-level `variables`)
8. Fields without a mapped submitter are assigned to the first submitter

#### `GET /api/config`

**Auth:** None.

**Response:**

```json
{}
```

Returns empty object. Previously exposed the Geoapify API key — now proxied server-side via `/api/geoapify`.

#### `GET /api/geoapify`

**Auth:** Required (session cookie or `Authorization: Bearer <token>` or `x-api-key` header).

**Query params:** `endpoint` (`autocomplete` | `search`), plus all Geoapify query params (`text`, `type`, `country`, `limit`, etc.).

**Behavior:** Proxies the request to `https://api.geoapify.com/v1/geocode/{endpoint}` with the server-side `GEOAPIFY_API_KEY`. The API key never reaches the browser.

### 2.7 Authentication & Authorization

Two authentication methods are supported, checked in order:

1. **Session cookie (auto-provisioned):** `proxy.ts` creates a JWT session on first page visit via `createSessionJWT()`. The httpOnly, Secure (production), SameSite=Lax cookie is set on response. Valid for 24 hours.
2. **API shared key:** Clients may provide the shared secret via:
   - `Authorization: Bearer <API_SHARED_SECRET>` header
   - `x-api-key: <API_SHARED_SECRET>` header

All API routes (`/api/claims`, `/api/templates/fields`, `/api/geoapify`) call `verifyRequest()` and return `401 Unauthorized` if not authenticated. The `/api/config` endpoint is the only public route.

### 2.8 Rate Limiting

Applied in `proxy.ts` using in-memory `Map<ip, {count, resetAt}>`:

| Endpoint | Limit | Window |
| ---------- | ------- | -------- |
| `POST /api/claims` | 10 requests | 1 hour |
| Other non-GET API | 100 requests | 1 hour |
| GET requests | not rate limited | — |

Returns `429 Too Many Requests` with a `Retry-After` header when exceeded. Counters are per-category per-IP, so address autocomplete (GET) requests never affect claims or template rate limits. Rate limit state is per-process (not shared across instances).

### 2.9 Template Routing

`lib/docuseal.ts:resolveTemplateId()` constructs key `{STATE}_{count}` and resolves the template ID by matching the **name prefix** in DocuSeal. Templates must be named with the prefix pattern `{STATE}_{count} - <description>`. The prefix-to-ID mapping is fetched from the DocuSeal API on first call and cached in memory (`cachedPrefixMap`). Call `clearTemplateCache()` to force a refresh.

Current templates with their prefixes:

- **ID 2:** `TN_1 - TN Public Adjuster Agreement Package (Single Insured)`
- **ID 1:** `TN_2 - TN Public Adjuster Agreement Package (Two Insured)`
- **ID 3:** `IL_1 - IL Public Adjuster Agreement`

To add a new template, create it in DocuSeal with the correct prefix and restart the server.

### 2.10 Variable Mapping (Client-Side)

The client builds `fieldValues` by iterating over template field names (from the DocuSeal API) and mapping form state:

| Template Field Name | Source |
| ------------------- | -------- |
| `Loss Address` | `propertyAddress.formatted` |
| `First Insured Name` | `namedInsureds[0]` (combined name) |
| `First Insured Phone` | `namedInsureds[0].phone` |
| `First Insured Email` | `namedInsureds[0].email` |
| `Insured Mailing Address` | `namedInsureds[0].mailingAddress.formatted` or `propertyAddress.formatted` |
| `Second Insured Name` | `namedInsureds[1]` (combined name) |
| `Second Insured Phone` | `namedInsureds[1].phone` |
| `Second Insured Email` | `namedInsureds[1].email` |
| `Public Adjuster Name` | Adjuster first + last |
| `Public Adjuster License Number` | `adjLicense` |
| `Public Adjuster Email` | `adjEmail` |
| `Public Adjuster Phone` | `adjPhone` |
| `Public Adjuster Mailing Address` | `adjMailingAddress.formatted` |
| `First Insured Signing Date` | (auto-calculated by DocuSeal, excluded from form) |
| `Public Adjuster Date Signed` | (auto-calculated by DocuSeal, excluded from form) |
| All other fields | User input from Step 2 dynamic fields |

### 2.11 Submitter Roles

| Role | Source | Template Fields |
| ------ | -------- | ---------------- |
| `First Insured` | `namedInsureds[0].email` | Fields with `submitter_uuid` matching "First Insured" role |
| `Second Insured` | `namedInsureds[1].email` | Fields with `submitter_uuid` matching "Second Insured" role |
| `Public Adjuster` | `adjuster.email` | Fields with `submitter_uuid` matching "Public Adjuster" role |

Values are distributed per-submitter using `submitters[].values` with exact template field names as keys.

### 2.12 Styling

Tailwind CSS v4 with CSS custom properties. Single `globals.css` with both light and dark themes (`.dark` class on `<html>`).

**Theme system:**

- `ThemeProvider` context reads `localStorage("theme-preference")` or `prefers-color-scheme: dark`.
- `ThemeToggle` button in layout header toggles between light/dark.
- Inline `<script>` in `layout.tsx` applies dark class before first paint to prevent flash.
- CSS variables control all colors — body, card, text, borders, buttons, errors, shadows.

**Key CSS classes:** `.claim-form`, `fieldset`, `.field-row`, `.field`, `.field-narrow`, `.field-wide`, `.field-checkbox`, `.insured-entry`, `.address-autocomplete-field`, `.address-suggestions`, `.extra-fields`, `.review-section`, `.step-indicator`, `.step-item.clickable`, `.nav-buttons`, `.btn-primary`, `.btn-secondary`, `.link-btn`, `.btn-add`, `.btn-remove`, `.error-msg` (red), `.field-error` (red border), `.field-error-msg` (red inline text), `.warning-msg` (yellow), `.success`.

### 2.13 Shared Components

| Component | Used In | Props |
| ----------- | --------- | ------- |
| `AddressInput` | Step 0 (property), Step 1 (mailing per insured), Step 3 (adjuster mailing) | `label`, `value: AddressValue`, `onChange`, `required?`, `showErrors?` |
| `ContactFields` | Step 1 (per insured), Step 3 (adjuster) | `phone`, `email`, `onPhoneChange`, `onEmailChange`, `showErrors?` |
| `NameField` | Step 1 (first/middle/last), Step 3 (adjuster) | `label`, `value`, `onChange`, `required?`, `maxLength?`, `showError?` |
| `StepIndicator` | ClaimForm (top, all steps) | `currentStep`, `totalSteps`, `labels`, `maxCompletedStep`, `onStepClick?` |

All shared components with blur-validation (`NameField`, `ContactFields`, `AddressInput`) track their own `blurred` state internally. Errors appear after the user tabs out of a field and clear when the user focuses back in.

### 2.14 Validation Behavior

- **Blur-based**: Each input component tracks whether it has been "touched" (focused then blurred). Errors appear only after blur.
- **Show-all mode**: When the user clicks Next and validation fails, `showFieldErrors` is set to `true`. This overrides the blur check, causing all invalid fields to show errors immediately. Resets when changing steps.
- **Class application**: Invalid fields get `className="field-error"` (red border + red focus shadow).
- **Error messages**: Shown as `.field-error-msg` divs below the input (e.g., "Enter a valid phone number", "First Name is required").
- **Clearing errors**: Focusing back into a field clears its blurred state, hiding the error. Re-blurring re-validates. Show-all mode is cleared when the step changes.
- **Next button**: Remains disabled via `validateStep()` which checks all fields. The blur/shown errors provide explicit guidance on what's wrong.
- **Phone formatting**: On Step 1→2 and Step 3→4 transitions, `formatPhone()` normalizes phone to `(xxx) xxx-xxxx` format.
- **Server-side**: Zod validation on all API routes ensures data integrity regardless of client-side validation.

### 2.15 Address Autocomplete (`AddressInput.tsx`)

- Uses Geoapify Geocoding API proxied server-side via `GET /api/geoapify`.
- **Autocomplete mode**: User types → 200ms debounce → `fetch("/api/geoapify?endpoint=autocomplete&text=...&type=street&country=us&limit=5")` → dropdown of suggestions with keyboard navigation (ArrowUp/Down, Enter to select, Escape to dismiss).
- **Selection**: Extracts `housenumber`, `street`, `city`, `state`, `postcode`, `formatted` from the Geoapify feature properties. State is parsed from code or full name.
- **Manual toggle**: "Enter address manually." → reveals street/apt&suite/city/state/zip fields with blur validation.
- **Address verification**: When a manual field loses focus, a 300ms debounced call to `endpoint=search` verifies the address exists. If not found, a warning is shown with "Use this address anyway" option.
- **Apt/Suite (`street2`)**: Optional extra line included in `formatted` when present.
- **Validation**: Each manual field (street, city, state, zip) has blur-based inline error messages. Auto-complete has a single "Address is required" error.

### 2.16 Security

| Layer | Mechanism |
| ------- | ----------- |
| Auth | JWT session cookie (auto-provisioned by proxy.ts) + shared API key (Bearer or x-api-key header) |
| Validation | Zod schemas on all API routes |
| Rate limiting | In-memory per-IP limits in proxy.ts |
| CSP | `default-src 'self'`; scripts `'unsafe-inline' 'unsafe-eval'` (React dev mode); styles `'unsafe-inline'`; images `self data:`; connect `self https://api.geoapify.com`; frame-ancestors `none` |
| API key protection | Geoapify key never reaches browser — proxied server-side through `/api/geoapify` |
| Error handling | Generic "An internal error occurred" returned to client; full errors logged server-side |
| HTTP headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

### 2.17 Environment Variables

| Variable | Required | Purpose |
| ---------- | ---------- | --------- |
| `PORT` | No (default 3000) | Server port |
| `DOCUSEAL_API_KEY` | Yes | DocuSeal API authentication |
| `DOCUSEAL_API_URL` | No | DocuSeal API base URL (default: `https://sign.plpas.com/api`) |
| `GEOAPIFY_API_KEY` | Yes | Geoapify Geocoding API |
| `SESSION_SECRET` | Yes | JWT signing secret (32+ chars, random) |
| `API_SHARED_SECRET` | Yes | Shared API key for programmatic access |
| `DATABASE_URL` | No | SQLite database path (default: `file:./dev.db`) |

### 2.18 Database — Prisma + SQLite

Prisma ORM with SQLite provides a zero-config embedded database for claim persistence, status tracking, and future multi-user features. No external database server is required.

#### Setup

```bash
pnpm add @prisma/client
pnpm add -D prisma
pnpm prisma init --datasource-provider sqlite
pnpm prisma db push    # initial schema
pnpm prisma generate   # generates @prisma/client
```

Migrations are generated via `pnpm prisma migrate dev`. The Prisma client is exported as a singleton from `lib/db.ts` to prevent connection proliferation in development (Next.js hot reload).

#### Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // default: "file:./dev.db"
}

model Claim {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Status lifecycle: draft → submitted → completed → cancelled
  status          String   @default("draft")

  // Loss address
  propertyStreet  String?
  propertyCity    String?
  propertyState   String?
  propertyZip     String?
  propertyFormatted String?

  // Adjuster
  adjusterFirstName  String?
  adjusterLastName   String?
  adjusterEmail      String?
  adjusterPhone      String?
  adjusterLicense    String?
  adjusterMailingFormatted String?

  // DocuSeal
  docusealSubmissionId  Int?    @unique
  docusealTemplateId    Int?
  docusealStatus        String? // pending, signed, completed

  // DocuSeal field values stored as JSON
  fieldValues       String? // JSON object

  // Relations
  namedInsureds  NamedInsured[]
}

model NamedInsured {
  id        String  @id @default(cuid())
  claimId   String
  claim     Claim   @relation(fields: [claimId], references: [id], onDelete: Cascade)

  type      String  // "individual" | "company"

  // Individual fields
  salutation String?
  firstName  String?
  middleName String?
  lastName   String?
  suffix     String?

  // Company fields
  companyName String?

  // Contact
  phone     String?
  email     String?

  // Mailing address (optional — falls back to property address)
  mailingStreet     String?
  mailingCity       String?
  mailingState      String?
  mailingZip        String?
  mailingFormatted  String?

  sortOrder Int @default(0)
}
```

#### `lib/db.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

#### Database Lifecycle

| Event | Action |
| ------- | -------- |
| Claim form submitted | `POST /api/claims` inserts a `Claim` row + `NamedInsured` rows, status `submitted` |
| Dev schema change | `pnpm prisma migrate dev` generates a new migration |
| Production deploy | `pnpm prisma migrate deploy` applies pending migrations |
| Reset dev DB | `pnpm prisma migrate reset` drops schema and re-applies all migrations |

---

## 3. Key Decisions

- **Geoapify over Google Places**: Switched from Google Places (PlaceAutocompleteElement) to Geoapify for autocomplete + geocoding. All requests are proxied server-side so the API key is never exposed to the browser.
- **Server-side Geoapify proxy (`/api/geoapify`)**: Eliminates C-1 security issue. The browser calls the Next.js route which injects the API key server-side.
- **Auth via proxy.ts + JWT**: Next.js 16 uses `proxy.ts` convention instead of `middleware.ts`. First visit provisions an httpOnly JWT session cookie; API routes verify it. Also supports Bearer token or x-api-key for programmatic access.
- **Zod validation**: All API endpoints parse and validate input with Zod schemas, providing consistent error responses and preventing malformed data.
- **Rate limiting in proxy.ts**: Simple in-memory per-IP limiter prevents abuse. Per-process (not shared across instances), acceptable for single-container deployment.
- **Template-driven Step 2**: No hardcoded fields. All fields are rendered from the DocuSeal template's field list, ensuring exact name matching.
- **Per-submitter values**: Field values are passed via `submitters[].values` (not top-level `variables`) using the field-to-submitter UUID mapping from the template, so each signer gets their assigned fields pre-filled.
- **Step 0 template pre-validation**: Checks template existence before the user fills in insured info, failing fast on unsupported states.
- **Step indicator clickable on review**: Completed step numbers are clickable on Step 4 for quick navigation.
- **Auto-focus on step change**: The first input/select/textarea receives focus when a new step renders.
- **Blur-based validation with inline errors**: Fields show red borders and error messages only after the user tabs out. Messages are specific (e.g., "Enter a valid phone number" instead of generic). When the user clicks Next and validation fails, all invalid fields show errors immediately via `showFieldErrors` prop.
- **Phone validation by digit count**: Strips all non-digit characters and country code (1), requires exactly 10 digits. Phone is formatted to `(xxx) xxx-xxxx` on step transitions.
- **Checkbox conventions**: Emergency/Non-Emergency/Supplemental Claim fields use `"X"` value convention matching DocuSeal checkbox behavior. Emergency and Non-Emergency are mutually exclusive.
- **Title Case variable names**: Match DocuSeal template field names exactly.
- **pnpm**: Project uses pnpm as the package manager.
- **Enter key navigation**: Enter on any field before Step 4 triggers Next step instead of form submission.
- **Dark mode**: Tailwind v4 dark variant via CSS custom properties. Theme persisted in localStorage with system preference fallback. Inline script prevents flash of wrong theme.
- **Security headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy set in `next.config.mjs`.
- **No template-mapping.json**: Prefix-based template resolution via DocuSeal API — new templates auto-discovered on next server restart.
- **Prisma + SQLite**: Chosen for zero external dependencies and simple single-container deployment. SQLite file lives on the container's filesystem (ephemeral in production without persistent volume — acceptable for initial deployment phase).
- **JSON `fieldValues` column**: Keeps the database schema decoupled from DocuSeal template changes. Template fields can be added/removed in DocuSeal without a database migration.
- **Singleton Prisma client** (`lib/db.ts`): Prevents connection pool exhaustion from Next.js hot-reload creating multiple instances in development.
- **Flat address columns**: Storing address components directly on the Claim/NamedInsured models avoids JOIN overhead for the current single-address-per-claim usage pattern. A separate Address table can be introduced later if address reuse/sharing is needed.

## 4. Future Considerations

- More than 2 insureds (change `namedInsureds.length < 2` guard; server loops dynamically; update `max(10)` in Zod).
- File uploads (loss photos, documents).
- Additional state/template mapping entries.
- Coverage/Deductible entries.
- Persistent rate limiting (Redis-backed instead of in-memory).
- Multi-tenant configuration.
- Persistent database (PostgreSQL for multi-instance deployments).
- Claim status dashboard (list/filter claims by status, date, state).
- User authentication (login/logout, role-based access: adjuster vs. admin).
- Claim editing after submission (draft → submitted workflow with change history).
- Document uploads linked to claims (photos, loss reports, estimates).
- Payment/coverage tracking per claim.
- Audit log for claim status changes and field edits.
