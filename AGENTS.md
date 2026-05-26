# Claim Submission App — Agent Guide

## Project Overview

Public adjuster claim submission app with DocuSeal agreement generation. Single Next.js 16 project:

- **`app/`** — Next.js App Router (pages + API routes)
- **`components/`** — React client components
- **`lib/`** — Server-side services (config, DocuSeal wrapper, auth, validation)
- **`types/`** — Shared TypeScript types

## Key Commands

```bash
pnpm dev              # next dev → http://localhost:3000
pnpm build            # next build → .next/
pnpm start            # next start -p 3000
docker compose up --build
```

## Architecture

```
Next.js 16 (single process, port 3000)
──────────────────────────────────────
Pages:                        API Routes:
  app/page.tsx                  app/api/claims/route.ts         (POST)
  (multi-step form)             app/api/templates/fields/route.ts (POST)
                                app/api/config/route.ts         (GET)
                                app/api/geoapify/route.ts       (GET)

Proxy: proxy.ts — session cookie + rate limiting

Components (client):
  ClaimForm.tsx     — multi-step form container
  AddressInput.tsx  — Geoapify autocomplete + manual toggle with address verification
  ContactFields.tsx — phone + email pair with blur validation
  NameField.tsx     — single labeled text input with blur validation
  StepIndicator.tsx — step progress indicator (clickable)
  ThemeProvider.tsx — dark mode context
  ThemeToggle.tsx   — dark/light toggle button

Server-only lib:
  lib/config.ts     — env vars loader
  lib/docuseal.ts   — @docuseal/api wrapper (template resolution, field fetching, submission)
  lib/auth.ts       — JWT session creation + API key / Bearer token verification
  lib/validation.ts — Zod schemas for claim submission + template field requests

Shared types:
  types/index.ts    — AddressValue, NamedInsured, ClaimFormData, TemplateField, constants, helpers
```

## Multi-Step Flow

| Step | Component | Purpose |
|------|-----------|---------|
| 0 | `AddressInput` (Geoapify autocomplete + manual toggle) | Property loss address, state extraction |
| 1 | Inline insured entries with add/remove (max 2) | Individual (salutation/first/middle/last/suffix) or Company, phone/email, optional different mailing address |
| 2 | Dynamic template fields (from DocuSeal) | Renders all non-auto-populated, non-signature fields |
| 3 | Adjuster info | First/last name, email, phone, license#, mailing address |
| 4 | Review & submit | Read-only summary → submit |

## Data Flow

1. User fills Step 0 (address), state is extracted
2. On Step 0→1 transition, client calls `POST /api/templates/fields` with `{state, insuredCount: 1}` to pre-validate a template exists for this state
3. If no template exists for the state, user stays on Step 0 with an error banner (error clears when address is modified)
4. User fills Step 1 (insureds) — max 2, individual or company
5. On Step 1→2 transition, client calls `POST /api/templates/fields` with `{state, insuredCount}`
6. Server resolves template ID via prefix matching in DocuSeal, calls `docuseal.getTemplate(id)` to fetch fields
7. If a matching template is found, server returns fields and client advances to Step 2
8. If no matching template exists, client stays on Step 1 and shows an error banner
9. Client sends full `ClaimFormData` to `POST /api/claims`
10. Server validates with Zod, authenticates via session JWT or API key, resolves template, maps variables (individual/company fields, mailing addresses), calls `docuseal.createSubmission()`
11. Returns submission result

All API routes (except `/api/config`) require authentication. `proxy.ts` auto-provisions an httpOnly session JWT on first page visit. GET requests (geoapify autocomplete) bypass rate limiting.

## Template Routing

`lib/docuseal.ts:resolveTemplateId()` constructs key `{STATE}_{count}` from form data and resolves the template ID by matching the **name prefix** in DocuSeal. Templates must be named with the prefix pattern:

```
{STATE}_{count} - <description>
```

Examples from current templates:
```
TN_1 - TN Public Adjuster Agreement Package (Single Insured)
TN_2 - TN Public Adjuster Agreement Package (Two Insured)
IL_1 - IL Public Adjuster Agreement
```

The prefix-to-ID mapping is fetched from the DocuSeal API on first call and cached in memory. To add a new template, create it in DocuSeal with the correct prefix and restart the server (or call `clearTemplateCache()`).

## Variable Naming

Template variable names use **Title Case with spaces**, matching the DocuSeal template field names exactly.

### Common fields
```
Loss Address, Insurance Carrier, Date of Loss, Policy Number
Type of Loss, Claim Number, Description of Loss
```

### First Insured (index 0)
```
First Insured Name, First Insured Phone, First Insured Email
Insured Mailing Address
```

### Second Insured (index 1)
```
Second Insured Name, Second Insured Phone, Second Insured Email
```

### Public Adjuster
```
Public Adjuster Name, Public Adjuster License Number
Public Adjuster Email, Public Adjuster Phone, Public Adjuster Mailing Address
```

## File Map

| Path | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout (HTML shell, ThemeProvider, inline theme-script) |
| `app/page.tsx` | Main page — renders ClaimForm |
| `app/globals.css` | All application styles (Tailwind v4 + CSS custom properties) |
| `app/api/claims/route.ts` | POST /api/claims handler (auth + Zod validated) |
| `app/api/templates/fields/route.ts` | POST /api/templates/fields — fetches template fields + submitters |
| `app/api/config/route.ts` | GET /api/config — returns {} |
| `app/api/geoapify/route.ts` | GET /api/geoapify — server-side Geoapify proxy (auth required) |
| `lib/config.ts` | Env vars loader (DOCUSEAL, GEOAPIFY, SESSION_SECRET, API_SHARED_SECRET) |
| `lib/docuseal.ts` | @docuseal/api wrapper (template resolution by name prefix, field fetching, submission) |
| `lib/auth.ts` | JWT session creation + API key / Bearer token verification |
| `lib/validation.ts` | Zod schemas for claim submission + template field requests |
| `types/index.ts` | Shared types: AddressValue, NamedInsured, ClaimFormData, TemplateField, constants, helpers |
| `components/ClaimForm.tsx` | Multi-step form container (5 steps) |
| `components/AddressInput.tsx` | Address input (Geoapify autocomplete + manual toggle with address verification) |
| `components/ContactFields.tsx` | Phone + email fields with blur validation |
| `components/NameField.tsx` | Single text field with label and blur validation |
| `components/StepIndicator.tsx` | Step progress indicator (clickable) |
| `components/ThemeProvider.tsx` | Dark mode context (localStorage + system preference) |
| `components/ThemeToggle.tsx` | Dark/light toggle button |
| `proxy.ts` | Next.js 16 proxy — session cookie creation + in-memory rate limiting |
| `next.config.mjs` | Next.js config (security headers, allowedDevOrigins) |
| `postcss.config.mjs` | PostCSS with @tailwindcss/postcss |
| `tsconfig.json` | TypeScript config (ES2022 target, strict) |

## Shared Components (DRY)

| Component | Used In | Props |
|-----------|---------|-------|
| `AddressInput` | Step 0 (property), Step 1 (mailing per insured), Step 3 (adjuster mailing) | `label`, `value: AddressValue`, `onChange`, `required?`, `showErrors?` |
| `ContactFields` | Step 1 (per insured), Step 3 (adjuster) | `phone`, `email`, `onPhoneChange`, `onEmailChange`, `showErrors?` |
| `NameField` | Step 1 (first/middle/last), Step 3 (adjuster names) | `label`, `value`, `onChange`, `required?`, `maxLength?`, `showError?` |
| `StepIndicator` | ClaimForm (top of form) | `currentStep`, `totalSteps`, `labels`, `maxCompletedStep`, `onStepClick?` |

## Adding a Form Field

1. Add type to `types/index.ts` (ClaimFormData or NamedInsured)
2. Add state + input to the relevant step render function in `ClaimForm.tsx`
3. Add variable mapping in `app/api/claims/route.ts`
4. Ensure the DocuSeal template has a matching field name

## Extending Insured Count

The `namedInsureds` array supports up to 2 insureds. To increase the max:
- Client: Change the `namedInsureds.length < 2` guard in `ClaimForm.tsx` (add button logic)
- Server: Update `max(10)` in Zod schema in `lib/validation.ts`
- Template mapping: Add templates in DocuSeal with prefix `{STATE}_{count}` — server resolves dynamically
