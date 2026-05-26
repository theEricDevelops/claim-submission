# Claim Submission App — Specification

## 1. Overview

A multi-step public adjuster claim submission application. Users enter loss address → insured party information → loss details (template-driven) → adjuster information, then the app generates a DocuSeal submission agreement via the DocuSeal API. The app is a single Next.js 14 project using `pnpm`.

---

## 2. Architecture

### 2.1 Project Structure

```
claim-submission/
├── app/                             # Next.js App Router
│   ├── api/
│   │   ├── claims/route.ts          # POST /api/claims — full claim submission
│   │   ├── config/route.ts          # GET /api/config — serves Google Places API key
│   │   └── templates/fields/route.ts # POST /api/templates/fields — fetches DocuSeal template fields + submitters
│   ├── globals.css                  # All application styles (includes .field-error, .field-error-msg)
│   ├── layout.tsx                   # Root layout (HTML shell)
│   └── page.tsx                     # Main page → renders ClaimForm
├── components/                      # React client components ("use client")
│   ├── AddressInput.tsx             # Google Places PlaceAutocompleteElement + manual toggle
│   ├── ClaimForm.tsx                # Multi-step form container (5 steps, 0-indexed)
│   ├── ContactFields.tsx            # Phone + email pair
│   ├── NameField.tsx                # Single labeled text input
│   └── StepIndicator.tsx            # Step progress indicator (clickable on review step)
├── lib/                             # Server-side services
│   ├── config.ts                    # Env vars loader
│   └── docuseal.ts                  # @docuseal/api wrapper (template resolution, field fetching, submission)
├── types/                           # Shared TypeScript types
│   └── index.ts                     # AddressValue, NamedInsured, ClaimFormData, TemplateField, constants
├── next.config.mjs                  # Next.js configuration
├── Dockerfile                       # Next.js standalone Docker build
├── docker-compose.yml               # Single container on port 3000
├── .env / .env.example              # PORT, DOCUSEAL_API_KEY, DOCUSEAL_API_URL, GOOGLE_PLACES_API_KEY
├── AGENTS.md                        # Agent reference guide
├── SPEC.md                          # This specification
├── template-mapping.json            # Retained as documentation only (not used at runtime)
└── package.json                     # next, react, @docuseal/api, @types/google.maps
```

### 2.2 Data Flow

```
Client (browser)                     Next.js API Routes           DocuSeal API
──────────────────                   ──────────────────           ────────────
GET  /api/config ───────────────►    returns googlePlacesApiKey
   (load Maps JS API with Places)
   PlaceAutocompleteElement
   gmp-select → placePrediction.toPlace().fetchFields()
   addressComponents extracted

ClaimForm.tsx (Step 0→1)             app/api/templates/fields     @docuseal/api
  POST /api/templates/fields ──►      resolveTemplateId() ────►   listTemplates()
  {state, insuredCount: 1}            returns prefix→ID mapping    (cached in memory)
   validates template exists

ClaimForm.tsx (Step 1→2)             app/api/templates/fields     @docuseal/api
  POST /api/templates/fields ──►      resolveTemplateId() ────►   listTemplates()
  {state, insuredCount=N}             getTemplateFields() ────►   getTemplate()
                                       getTemplateSubmitters()    (fields + submitters)
                                       returns {fields, submitters}

ClaimForm.tsx                         app/api/claims               @docuseal/api
  POST /api/claims ──────────────►    resolveTemplateId()          createSubmission()
  {state, fieldValues, ...}           getTemplateSubmitters()      POST /submissions/init
                                       getTemplateFields()         (submitters[].values)
                                       maps values per-submitter via submitter_uuid
                                       returns submission result
```

### 2.3 Multi-Step Flow (0-Indexed)

| Step | Name | Component | Purpose |
|------|------|-----------|---------|
| 0 | **Loss Address** | `AddressInput` (autocomplete + manual toggle) | Property loss address, extracts state for template routing. Template pre-validated on transition to Step 1. |
| 1 | **Insured Parties** | Inline insured entries with add/remove (max 2) | Individual (salutation/first/middle/last/suffix) or Company, phone/email, optional different mailing address |
| 2 | **Loss Details** | Dynamic template fields | Renders all template fields from DocuSeal (excluding auto-populated, signature/initials, and signing-date fields). Checkbox fields for exclusive/independent claim type selection. |
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

| Field | Input | Required |
|-------|-------|----------|
| Property Address | `PlaceAutocompleteElement` (Google Places New API) + manual toggle to street/city/state/zip fields | Yes (all components) |
| Apt / Suite | Text (manual mode only) | No |

State is extracted from the selected address and stored for template key resolution. Manual entry requires street, city, state, and zip. Blur-based validation: after tabbing out of a field, an inline error appears if empty. Apt/Suite is optional.

#### Step 1 — Insured Parties

**Type selector** (default: `-- Select --`). No other fields visible until type chosen.

**Individual:**
| Field | Input | Required |
|-------|-------|----------|
| Salutation | Dropdown: Mr., Mrs., Ms., Dr., Prof., Rev. | No |
| First Name | Text (blur-validated) | Yes |
| Middle Name | Text | No |
| Last Name | Text (blur-validated) | Yes |
| Suffix | Dropdown: Jr., Sr., II, III, IV, V | No |
| Phone | Tel (blur-validated: 10+ digits) | Yes |
| Email | Email (blur-validated: basic format) | Yes |

**Company:**
| Field | Input | Required |
|-------|-------|----------|
| Company Name | Text (blur-validated) | Yes |
| Phone | Tel (blur-validated) | Yes |
| Email | Email (blur-validated) | Yes |

**Mailing Address:** Checkbox "Different mailing address" → reveals `AddressInput` component. Falls back to property address when unchecked.

**Add/Remove:** Max 2 insureds total. + button to add, − button per entry (shown when > 1).

#### Step 2 — Loss Details

No hardcoded fields. All fields are rendered dynamically from the DocuSeal template's field list, filtered to exclude:
- Fields assigned to auto-populated roles (Loss Address from Step 0, Insured info from Step 1, Adjuster info from Step 3)
- Fields with type `signature` or `initials` (signing-stage fields)
- Fields with "sign" or "initial" in their name (e.g., signing dates)

**Special rendering:**
- `Non-Emergency Claim`, `Emergency Claim`, `Supplemental Claim` → render as checkboxes. Checking stores `"X"` (DocuSeal checkbox convention). Emergency and Non-Emergency are mutually exclusive (checking one clears the other).

#### Step 3 — Adjuster Information

| Field | Input | Required |
|-------|-------|----------|
| First Name | Text (blur-validated) | Yes |
| Last Name | Text (blur-validated) | Yes |
| Email | Email (blur-validated) | Yes |
| Phone | Tel (blur-validated: 10+ digits) | Yes |
| License # | Text | Yes |
| Mailing Address | `AddressInput` | No |

#### Step 4 — Review & Submit

- Read-only summary of all entered data including extra field values.
- Step indicator bars are clickable to jump to any completed step.
- "Submit & Generate Agreement" sends full payload to `POST /api/claims`.
- Success: green screen with submission JSON.
- Error: red banner with retry.

### 2.5 Validation Rules

| Step | Rule |
|------|------|
| 0 | All address components must be non-empty (street, city, state, zip). Apt/Suite optional. Errors shown on blur per field, or all at once when Next is clicked. |
| 1 | Type must be chosen. Individual: first + last name required. Company: company name required. Phone + email required for both. Phone must have 10+ digits (stripping non-digits). Email must contain `@`. Errors shown on blur per field. |
| 2 | All required template fields must have a value |
| 3 | First name, last name, email, phone, license# all required. Phone 10+ digits. Email format. Errors shown on blur per field. |
| 4 | (All steps must pass before submit) |

### 2.6 Server Endpoints

#### `POST /api/templates/fields`

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
    { "name": "Date of Loss", "type": "date", "required": true, "submitter_uuid": "..." },
    { "name": "First Insured Name", "type": "text", "required": true, "submitter_uuid": "..." }
  ],
  "submitters": [
    { "name": "First Insured", "uuid": "..." },
    { "name": "Public Adjuster", "uuid": "..." }
  ]
}
```

**Response (error):**
```json
{ "success": false, "error": "No DocuSeal template configured for \"TN\" with 1 named insured(s)." }
```

#### `POST /api/claims`

**Request body:**
```typescript
{
  state: string;
  namedInsureds: Array<{
    type: "individual" | "company";
    salutation?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string;
    companyName?: string;
    phone: string;
    email: string;
    mailingAddress?: AddressValue;
  }>;
  propertyAddress: AddressValue;
  adjuster: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    licenseNumber: string;
    mailingAddress?: AddressValue;
  };
  fieldValues?: Record<string, string>;
}
```

**Response (success):**
```json
{ "success": true, "submission": { "id": 6, "submitters": [...] } }
```

**Response (error):**
```json
{ "success": false, "error": "No DocuSeal template configured..." }
```

**Processing:**
1. Resolve template ID from `{state}_{namedInsureds.length}`
2. Fetch template submitters and fields from DocuSeal
3. Build `submitter_uuid → role` mapping
4. Distribute `fieldValues` to each submitter based on their field's `submitter_uuid`
5. Create submission with `submitters[].values` (not top-level `variables`)
6. Fields without a mapped submitter are assigned to the first submitter

### 2.7 Template Routing

`lib/docuseal.ts:resolveTemplateId()` constructs key `{STATE}_{count}` and resolves the template ID by matching the **name prefix** in DocuSeal. Templates must be named with the prefix pattern `{STATE}_{count} - <description>`. The prefix-to-ID mapping is fetched from the DocuSeal API on first call and cached in memory (`cachedPrefixMap`). Call `clearTemplateCache()` to force a refresh.

Current templates with their prefixes:
- **ID 2:** `TN_1 - TN Public Adjuster Agreement Package (Single Insured)`
- **ID 1:** `TN_2 - TN Public Adjuster Agreement Package (Two Insured)`
- **ID 3:** `IL_1 - IL Public Adjuster Agreement`

To add a new template, create it in DocuSeal with the correct prefix and restart the server.

### 2.8 Variable Mapping (Client-Side)

The client builds `fieldValues` by iterating over the **exact** template field names (from the DocuSeal API) and mapping form state:

| Template Field Name | Source |
|-------------------|--------|
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

### 2.9 Submitter Roles

| Role | Source | Template Fields |
|------|--------|----------------|
| `First Insured` | `namedInsureds[0].email` | Fields with `submitter_uuid` matching "First Insured" role |
| `Second Insured` | `namedInsureds[1].email` | Fields with `submitter_uuid` matching "Second Insured" role |
| `Public Adjuster` | `adjuster.email` | Fields with `submitter_uuid` matching "Public Adjuster" role |

Values are distributed per-submitter using `submitters[].values` with exact template field names as keys.

### 2.10 Styling

Single `globals.css` with classes: `.claim-form`, `fieldset`, `.field-row`, `.field`, `.field-narrow`, `.field-wide`, `.field-checkbox`, `.insured-entry`, `.places-widget-container`, `.extra-fields`, `.review-section`, `.step-indicator`, `.step-item.clickable`, `.nav-buttons`, `.btn-primary`, `.btn-secondary`, `.link-btn`, `.btn-add`, `.btn-remove`, `.error-msg` (red), `.field-error` (red border), `.field-error-msg` (red inline text), `.warning-msg` (yellow), `.success`.

### 2.11 Shared Components

| Component | Used In | Props |
|-----------|---------|-------|
| `AddressInput` | Step 0 (property), Step 1 (mailing per insured), Step 3 (adjuster mailing) | `label`, `value: AddressValue`, `onChange`, `required`, `showErrors?` |
| `ContactFields` | Step 1 (per insured), Step 3 (adjuster) | `phone`, `email`, `onPhoneChange`, `onEmailChange`, `showErrors?` |
| `NameField` | Step 1 (first/middle/last), Step 3 (adjuster) | `label`, `value`, `onChange`, `required`, `showError?` |
| `StepIndicator` | ClaimForm (top, all steps) | `currentStep`, `totalSteps`, `labels`, `onStepClick?` |

All shared components with blur-validation (`NameField`, `ContactFields`, `AddressInput`) track their own `blurred` state internally. Errors appear after the user tabs out of a field and clear when the user focuses back in.

### 2.12 Validation Behavior

- **Blur-based**: Each input component tracks whether it has been "touched" (focused then blurred). Errors appear only after blur.
- **Show-all mode**: When the user clicks Next and validation fails, `showFieldErrors` is set to `true`. This overrides the blur check, causing all invalid fields to show errors immediately. Resets when changing steps.
- **Class application**: Invalid fields get `className="field-error"` (red border + red focus shadow).
- **Error messages**: Shown as `.field-error-msg` divs below the input (e.g., "Enter a valid phone number", "First Name is required").
- **Clearing errors**: Focusing back into a field clears its blurred state, hiding the error. Re-blurring re-validates. Show-all mode is cleared when the step changes.
- **Next button**: Remains disabled via `validateStep()` which checks all fields. The blur/shown errors provide explicit guidance on what's wrong.

### 2.13 Address Autocomplete (`AddressInput.tsx`)

- Fetches API key from `GET /api/config` on mount.
- Loads Google Maps JS API via dynamic script injection with `libraries=places&callback=...&loading=async`.
- Uses `google.maps.places.PlaceAutocompleteElement` (new Places API, not deprecated `Autocomplete`).
- Events: `"gmp-select"` → `PlacePredictionSelectEvent.placePrediction.toPlace()` → `fetchFields({ fields: ["addressComponents", "formattedAddress"] })`.
- Address components extracted: `street_number` + `route` → street, `locality` → city, `administrative_area_level_1` → state, `postal_code` → zip.
- Manual toggle: "Enter address manually." → reveals street/apt&suite/city/state/zip fields with blur validation.
- Apt/Suite (`street2`) is an optional extra line (e.g., "Apt 4B") included in `formatted` when present.
- `includedRegionCodes: ["us"]` restricts to US addresses.
- Blur validation on each manual field (street, city, state, zip) with inline error messages.

---

## 3. Key Decisions

- **Template-driven Step 2**: No hardcoded fields. All fields are rendered from the DocuSeal template's field list, ensuring exact name matching.
- **Per-submitter values**: Field values are passed via `submitters[].values` (not top-level `variables`) using the field-to-submitter UUID mapping from the template, so each signer gets their assigned fields pre-filled.
- **Step 0 template pre-validation**: Checks template existence before the user fills in insured info, failing fast on unsupported states.
- **Step indicator clickable on review**: Completed step numbers are clickable on Step 4 for quick navigation.
- **Auto-focus on step change**: The first input/select/textarea receives focus when a new step renders.
- **Blur-based validation with inline errors**: Fields show red borders and error messages only after the user tabs out. Messages are specific (e.g., "Enter a valid phone number" instead of a generic error). When the user clicks Next and validation fails, all invalid fields show errors immediately via `showFieldErrors` prop.
- **Auto-focus on step change**: The first input/select/textarea receives focus when a new step renders.
- **Phone validation by digit count**: Strips all non-digit characters and requires 10+ digits. Accepts any formatting (dashes, parens, spaces).
- **Checkbox conventions**: Emergency/Non-Emergency/Supplemental Claim fields use `"X"` value convention matching DocuSeal checkbox behavior. Emergency and Non-Emergency are mutually exclusive.
- **No template-mapping.json**: Prefix-based template resolution via DocuSeal API — new templates auto-discovered on next server restart.
- **Title Case variable names**: Match DocuSeal template field names exactly.
- **pnpm**: Project uses pnpm as the package manager.
- **Enter key navigation**: Enter on any field before Step 4 triggers Next step instead of form submission.

## 4. Future Considerations

- More than 2 insureds (change `namedInsureds.length < 2` guard; server loops dynamically).
- File uploads (loss photos, documents).
- Additional state/template mapping entries.
- Coverage/Deductible entries.
