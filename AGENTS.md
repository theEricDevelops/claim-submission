# Claim Submission App — Agent Guide

## Project Overview

Public adjuster claim submission app with DocuSeal agreement generation. Two-package monorepo:

- **`server/`** — Express + `@docuseal/api` (CommonJS, compiled with `tsc`)
- **`client/`** — React 18 + Vite (ESM, built with `vite build`)

## Key Commands

```bash
# Dev (two terminals)
cd server && npm run dev              # tsx watch, Express on :3000
cd client && npm run dev              # Vite on :5173, proxies /api → :3000

# Build
cd server && npm run build            # tsc → server/dist/
cd client && npm run build            # tsc -b && vite build → client/dist/

# Docker
docker compose up --build             # Single container, Express on :3000
```

## Code Conventions

| Rule | Standard |
|------|----------|
| Strings | Double quotes (`"`) |
| Semicolons | Required |
| Types | `unknown` over `any`, explicit interfaces, no inline types for objects with 3+ fields |
| Imports | `import x from "y"` (default) / `import { x } from "y"` (named) |
| React | Functional components, `useState`/`useEffect` hooks, default exports |
| Server module | CommonJS (no `"type": "module"` in package.json) |
| Client module | ESM (`"type": "module"` in package.json) |
| Async | `async`/`await`, no raw `.then()` |

## Architecture

```
Client (React/Vite)                        Server (Express)              DocuSeal API
─────────────────                          ──────────────                ────────────
ClaimForm.tsx (multi-step)                  routes/claim.ts               @docuseal/api
  Step 0: AddressInput                        POST /api/claims              getTemplate()
  Step 1: Insured entries                   routes/template.ts             createSubmission()
  Step 2: Loss Details (dynamic)              POST /api/templates/fields
  Step 3: Adjuster Info
  Step 4: Review

Shared components: AddressInput, ContactFields, NameField, StepIndicator
```

## Multi-Step Flow

| Step | Component | Purpose |
|------|-----------|---------|
| 0 | `AddressInput` (autocomplete + manual toggle) | Property loss address, state extraction |
| 1 | Inline insured entries with add/remove (max 2) | Individual (salutation/first/middle/last/suffix) or Company, phone/email, optional different mailing address |
| 2 | Loss details (static + dynamic template fields) | Date of loss, loss type, insurer, policy#, claim#, notes |
| 3 | Adjuster info | First/last name, email, phone, license# |
| 4 | Review & submit | Read-only summary → submit |

## Data Flow

1. User fills Step 0 (address), state is extracted
2. User fills Step 1 (insureds) — max 2, individual or company
3. On Step 1→2 transition, client calls `POST /api/templates/fields` with `{state, insuredCount}`
4. Server resolves template ID via `resolveTemplateId(state, count)`, calls `docuseal.getTemplate(id)` to fetch fields
5. Server returns template fields; client renders Step 2 with them
6. Client sends full `ClaimFormData` to `POST /api/claims`
7. Server validates, maps variables (individual/company fields, mailing addresses), calls `docuseal.createSubmission()`
8. Returns submission result

## Template Routing

`server/src/services/docuseal.ts:resolveTemplateId()` constructs key `{STATE}_{count}` from form data and looks it up in `template-mapping.json`:

```json
{ "CA_1": 1000001, "CA_2": 1000002, "FL_1": 1000003, ... }
```

Add new entries for new state/count combos. Map file is mounted at `/app/template-mapping.json` in Docker (also searched at project root and relative to server dist).

## Variable Naming

Template variable names use snake_case.

### Individual insured
```
insured_first_name, insured_middle_name, insured_last_name
insured_salutation, insured_suffix
insured_email, insured_phone
insured_mailing_address, insured_mailing_city, insured_mailing_state, insured_mailing_zip
```
Suffix `_N` for additional insureds (e.g. `insured_first_name_2`).

### Company insured
```
insured_company_name
insured_email, insured_phone
insured_mailing_address, insured_mailing_city, insured_mailing_state, insured_mailing_zip
```

### Property & Loss
```
property_address, property_street, property_city, property_state, property_zip
date_of_loss, loss_type, insurance_company, policy_number, claim_number
```

### Adjuster
```
adjuster_first_name, adjuster_last_name, adjuster_email, adjuster_phone, adjuster_license_number
```

Add/rename variables in `server/src/routes/claim.ts` (variables object in POST handler).

## File Map

| Path | Purpose |
|------|---------|
| `server/src/index.ts` | Express setup, serves client static files |
| `server/src/config.ts` | Loads env vars + template-mapping.json |
| `server/src/services/docuseal.ts` | `@docuseal/api` wrapper |
| `server/src/routes/claim.ts` | POST /api/claims handler, validation, variable mapping |
| `server/src/routes/template.ts` | POST /api/templates/fields — fetches template fields from DocuSeal |
| `client/src/types.ts` | Shared types: AddressValue, NamedInsured, ClaimFormData, constants |
| `client/src/api/claim.ts` | `submitClaim()` + `fetchTemplateFields()` typed fetch wrappers |
| `client/src/components/ClaimForm.tsx` | Multi-step form container (5 steps) |
| `client/src/components/AddressInput.tsx` | Reusable address input (autocomplete + manual toggle) |
| `client/src/components/ContactFields.tsx` | Reusable phone + email fields |
| `client/src/components/NameField.tsx` | Reusable single text field with label |
| `client/src/components/StepIndicator.tsx` | Step progress indicator |
| `template-mapping.json` | `"STATE_N": template_id` entries |
| `.env.example` | `DOCUSEAL_API_KEY`, `DOCUSEAL_API_URL`, `PORT` |

## Shared Components (DRY)

| Component | Used In | Props |
|-----------|---------|-------|
| `AddressInput` | Step 0 (property), Step 1 (mailing per insured) | `label`, `value: AddressValue`, `onChange`, `required` |
| `ContactFields` | Step 1 (per insured), Step 3 (adjuster) | `phone`, `email`, `onPhoneChange`, `onEmailChange` |
| `NameField` | Step 1 (first/middle/last), Step 3 (adjuster names) | `label`, `value`, `onChange`, `required` |
| `StepIndicator` | ClaimForm (top of form) | `currentStep`, `totalSteps`, `labels` |

## Adding a Form Field

1. Add type to `client/src/types.ts` (ClaimFormData or NamedInsured)
2. Add state + input to the relevant step render function in `ClaimForm.tsx`
3. Add variable mapping in `server/src/routes/claim.ts`
4. Ensure the DocuSeal template has a matching field name

## Extending Insured Count

The `namedInsureds` array supports up to 2 insureds. To increase the max:
- Client: Change the `namedInsureds.length < 2` guard in `ClaimForm.tsx` (add button logic)
- Template mapping: Add entries like `"CA_3": 1000009`
- Server loops over `namedInsureds` dynamically — no server code changes needed
