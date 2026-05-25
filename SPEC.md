# Claim Submission App — Specification

## 1. Overview

A multi-step public adjuster claim submission application. Users enter loss address → insured party information → remaining loss details → adjuster information, then the app generates a DocuSeal submission agreement via the DocuSeal API. The app is a monorepo with a React/Vite client and Express server.

---

## 2. Existing Architecture (As-Is)

### 2.1 Project Structure

```
claim-submission/
├── server/                          # Express + @docuseal/api (CommonJS, tsc)
│   └── src/
│       ├── index.ts                 # Express setup, CORS, static serving
│       ├── config.ts                # Env vars + template-mapping.json loader
│       ├── routes/claim.ts          # POST /api/claims handler
│       └── services/docuseal.ts     # @docuseal/api wrapper
├── client/                          # React 18 + Vite (ESM)
│   └── src/
│       ├── App.tsx / App.css        # Root component + global styles
│       ├── main.tsx                 # React root mount
│       ├── api/claim.ts             # Typed submitClaim() fetch wrapper
│       └── components/ClaimForm.tsx # Single-page claim form
├── template-mapping.json            # "STATE_N" → template_id mapping
├── Dockerfile                       # Multi-stage Docker build
├── docker-compose.yml               # Single container on port 3000
├── .env / .env.example              # DOCUSEAL_API_KEY, DOCUSEAL_API_URL, PORT
└── AGENTS.md                        # Agent guide
```

### 2.2 Data Flow (Current)

```
ClaimForm.tsx                         Server (Express)               DocuSeal API
─────────────────                    ──────────────                 ────────────
  submitClaim(formData) ──POST /api/claims──>  validate()
                                                 │
                                          resolveTemplateId(state, count)
                                                 │
                                          createSubmission({
                                            template_id,
                                            submitters: [insureds..., adjuster],
                                            variables: { ...mapped fields }
                                          })
                                                 │
                                          response ──> success/error
```

### 2.3 Existing Form Fields (All on One Page)

| Section | Fields |
|---------|--------|
| Insured Info | State (dropdown), Insured Count (1-2 dropdown) |
| Named Insureds | Per insured: First Name, Last Name, Email (repeated for count) |
| Property & Loss | Property Address (textarea), Date of Loss, Loss Type, Insurance Company, Policy #, Claim # |
| Public Adjuster | First Name, Last Name, Email, Phone, License # |
| Additional | Notes (optional textarea) |

### 2.4 Server Endpoint: `POST /api/claims`

**Request body** (`ClaimRequestBody`):
```typescript
{
  state: string;
  namedInsureds: Array<{ firstName: string; lastName: string; email: string }>;
  propertyAddress: string;
  dateOfLoss: string;
  lossType: string;
  insuranceCompany: string;
  policyNumber: string;
  claimNumber: string;
  adjuster: { firstName: string; lastName: string; email: string; phone: string; licenseNumber: string };
  additionalDetails?: string;
}
```

**Validation**: Required: `state`, `namedInsureds` (non-empty), `adjuster.email`.

**Template resolution**: Key = `{STATE}_{count}` → lookup in `template-mapping.json`.

**Variable mapping**: Maps form fields to snake_case template variables:
- `insured_first_name`, `insured_last_name`, `insured_email` (suffix `_N` for additional)
- `property_address`, `date_of_loss`, `loss_type`, `insurance_company`, `policy_number`, `claim_number`
- `adjuster_first_name`, `adjuster_last_name`, `adjuster_email`, `adjuster_phone`, `adjuster_license_number`
- `additional_details`

**Submitters**: First insured → role `"First Named Insured"`, additional → `"Additional Named Insured N"`, adjuster → `"Public Adjuster"`.

### 2.5 Template Mapping (`template-mapping.json`)

```json
{ "CA_1": 1000001, "CA_2": 1000002, "FL_1": 1000003, "FL_2": 1000004, "TX_1": 1000005, "TX_2": 1000006, "NY_1": 1000007, "NY_2": 1000008 }
```

### 2.6 Styling

Single `App.css` stylesheet with CSS classes: `.claim-form`, `.fieldset`, `.field-row`, `.field`, `.insured-block`, `.submit-btn`, `.error-msg`, `.success`.

---

## 3. New Requirements (To-Be)

### 3.1 Multi-Step Flow

The form is broken into sequential steps displayed one at a time:

| Step | Name | Purpose |
|------|------|---------|
| 1 | **Loss Address** | Single autocomplete address input → determines state |
| 2 | **Insured Parties** | Add 1-2 insureds with type, name, contact, optional mailing address |
| 3 | **Loss Details** | Remaining loss information fields |
| 4 | **Adjuster Info** | Public adjuster information |
| → | **Review / Submit** | Submit to DocuSeal |

#### Step Navigation

- **Next button** advances to the next step; **Back button** returns to previous.
- Each step validates its fields before allowing advance.
- State from previous steps is preserved when navigating back.
- **Step indicator** (e.g., progress bar or numbered steps) shows current step.

---

### 3.2 Step 1 — Loss Address

#### 3.2.1 Address Autocomplete

- Single text input for `Property Address` (street, city, state, zip combined).
- The input provides **autocomplete suggestions** fetched from a geocoding/address service via the server (or direct client-side integration).
- **Behavior**: As the user types, show matching address suggestions in a dropdown below the input.
- Once an address is selected from autocomplete:
  - The full formatted address populates the input.
  - The **state** is extracted (from the address components) and stored for later use in template resolution.
- Below the input, a clickable link: **"Enter address manually."**
  - Clicking this hides the autocomplete field and shows individual text fields: **Street Address**, **City**, **State** (dropdown of US states + DC), **ZIP Code**.
  - A link below the manual fields: **"Use address lookup instead."** toggles back.
- The state selection (whether from autocomplete or manual) must be recorded for later template lookup.

#### 3.2.2 State Determination

- From autocomplete: extracted from the selected address object.
- From manual entry: selected from the state dropdown.
- Used as the `{STATE}` portion of the template mapping key.

---

### 3.3 Step 2 — Insured Parties

#### 3.3.1 Insured Type Selection

Each insured entry has a dropdown with two options:
- **Individual** — person
- **Company** — business entity

#### 3.3.2 Fields by Type

**Individual:**
| Field | Input Type | Required |
|-------|-----------|----------|
| Salutation | Dropdown: Mr., Mrs., Ms., Dr., etc. | No |
| First Name | Text | Yes |
| Middle Name | Text | No |
| Last Name | Text | Yes |
| Suffix | Dropdown: Jr., Sr., II, III, IV, etc. | No |
| Phone | Tel | Yes |
| Email | Email | Yes |

**Company:**
| Field | Input Type | Required |
|-------|-----------|----------|
| Company Name | Text | Yes |
| Phone | Tel | Yes |
| Email | Email | Yes |

#### 3.3.3 Mailing Address

Each insured has a "Different mailing address" checkbox below the contact fields.

- **Unchecked**: Mailing address = property loss address (from Step 1). No extra fields shown.
- **Checked**: Reveals the same address input pattern (autocomplete + manual toggle) as Step 1, labeled "Mailing Address".

#### 3.3.4 Adding / Removing Insureds

- A **plus (+) button** below the last insured entry adds another insured (max 2 total).
- Each insured block has a **remove (−) button** (only shown when there are at least 2 insureds).
- When removing, re-index as needed (first insured is always index 0).
- Animated transitions for add/remove.

#### 3.3.5 Template Key and API Call

After confirming insureds (clicking Next on Step 2):
1. Client sends a request to a **new server endpoint** (or includes in the insured step data) containing the state and the number of insured signers.
2. Server resolves the template ID from `template-mapping.json` using key `{STATE}_{insuredCount}`.
3. Server fetches the template fields from the DocuSeal API to determine which variables the template expects.
4. Returns template metadata and expected field list to the client.
5. Client uses this information to render the remaining form sections (Steps 3 and 4) with only the fields the template supports.

**Suggested server endpoint**: `POST /api/template-fields`
```typescript
// Request
{ state: string; insuredCount: number }
// Response
{
  templateId: number;
  fields: Array<{ name: string; type: string; required: boolean }>;
}
```

This uses `@docuseal/api` to get template fields (via `docuseal.getTemplate()` or similar).

---

### 3.4 Step 3 — Loss Details

Rendered dynamically based on template fields returned from Step 2. Must include at minimum:
- **Date of Loss** (date picker)
- **Loss Type** (dropdown: Fire, Water, Wind, Hail, Theft, Vandalism, Smoke, Mold, Lightning, Explosion, Vehicle, Other)
- **Insurance Company** (text)
- **Policy Number** (text)
- **Claim Number** (text)
- Additional template-specific fields as returned by the API

---

### 3.5 Step 4 — Adjuster Information

- **First Name** (text, required)
- **Last Name** (text, required)
- **Email** (email, required)
- **Phone** (tel, required)
- **License Number** (text, required)

---

### 3.6 Step 5 — Review & Submit

- Read-only summary of all entered data.
- "Submit" button sends the full payload to `POST /api/claims`.
- On success: show success screen with submission details.
- On error: show error message with retry option.

---

### 3.7 Shared Address Component (DRY)

A reusable `AddressInput` component used for:

1. **Property Loss Address** (Step 1)
2. **Mailing Address** (per insured, Step 2)
3. (Future) Any other address needed

**Props:**
```typescript
interface AddressInputProps {
  label: string;              // "Property Address" or "Mailing Address"
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  required?: boolean;
}

interface AddressValue {
  formatted: string;          // Full formatted address
  street: string;
  city: string;
  state: string;
  zip: string;
}
```

**Component states:**
- Autocomplete mode (default)
- Manual mode (after clicking "Enter address manually")
- Toggleable between the two

---

### 3.8 Server Changes

#### 3.8.1 New Endpoint: `POST /api/template-fields`

```typescript
// Request
interface TemplateFieldsRequest {
  state: string;
  insuredCount: number; // 1 or 2
}
// Response
interface TemplateFieldsResponse {
  templateId: number;
  fields: Array<{ name: string; type: string; required: boolean }>;
}
```

Implementation: Resolves template ID via `resolveTemplateId(state, insuredCount)`, then calls DocuSeal API to get template fields.

#### 3.8.2 Updated `POST /api/claims`

The existing endpoint is updated to accept the expanded request body reflecting the new form structure:

```typescript
interface NewClaimRequestBody {
  state: string;
  namedInsureds: Array<{
    type: "individual" | "company";
    // Individual fields
    salutation?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string;
    // Company fields
    companyName?: string;
    // Common
    phone: string;
    email: string;
    mailingAddress?: AddressValue;   // Only if "different mailing address" checked
  }>;
  propertyAddress: AddressValue;
  dateOfLoss: string;
  lossType: string;
  insuranceCompany: string;
  policyNumber: string;
  claimNumber: string;
  adjuster: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    licenseNumber: string;
  };
  additionalDetails?: string;
}
```

The variable mapping logic is updated to handle individual vs. company insureds and mailing addresses.

#### 3.8.3 Template Variable Mapping (Updated)

Variables are still mapped to snake_case but now include additional fields:

```typescript
// For individual insureds
insured_first_name, insured_last_name, insured_middle_name, insured_email, insured_phone
insured_salutation, insured_suffix

// For company insureds
insured_company_name, insured_email, insured_phone

// Mailing address (when different from property)
insured_mailing_address, insured_mailing_city, insured_mailing_state, insured_mailing_zip

// Suffixed for additional insureds: _2, _3, etc.
```

---

### 3.9 UI/UX Requirements

- **Responsive**: Works on desktop and tablet.
- **Accessible**: Proper labels, aria attributes, keyboard navigation.
- **Loading states**: Spinner or skeleton during API calls (template fetch, submission).
- **Error states**: Inline field validation + banner errors.
- **Empty state**: First step (address) is the initial empty view.
- **Step persistence**: Navigating back preserves all entered data.
- **Animations**: Smooth transitions between steps, add/remove insureds.

---

### 3.10 Coding Standards

| Rule | Standard |
|------|----------|
| All existing conventions | Per AGENTS.md (double quotes, semicolons, no `any`, functional components, etc.) |
| Form state management | `useReducer` or multiple `useState` — no external form library |
| Shared components | `AddressInput` as reusable address component |
| No code duplication | Any repeated field pattern (address, name fields, phone/email) extracted into components |
| Types | Exported from `types.ts` in both client and server; shared via documentation (no shared package) |
| Client API layer | Update `client/src/api/claim.ts` with new types and endpoints |
| Template fields | Client renders fields dynamically based on server response — not hardcoded beyond the baseline |

---

## 4. Component Tree (Client, New Structure)

```
App
└── ClaimForm (multi-step container, manages step index + all form state)
    ├── StepIndicator (shows steps 1-5)
    ├── Step1_LossAddress
    │   └── AddressInput (autocomplete + manual toggle)
    ├── Step2_InsuredParties
    │   ├── InsuredEntry (per insured)
    │   │   ├── InsuredTypeSelect (individual/company)
    │   │   ├── IndividualNameFields (salutation, first, middle, last, suffix)
    │   │   │   └── NameField (single text input with label — reusable)
    │   │   ├── CompanyNameField (text input)
    │   │   ├── ContactFields (phone + email — reusable)
    │   │   ├── MailingAddressToggle (checkbox)
    │   │   └── AddressInput (if toggled)
    │   ├── AddInsuredButton (+ button)
    │   └── RemoveInsuredButton (− button, per entry)
    ├── Step3_LossDetails
    │   └── Dynamic fields based on template response
    ├── Step4_AdjusterInfo
    │   └── ContactFields (reused) + license number
    ├── Step5_Review
    └── NavigationButtons (Back / Next / Submit)
```

---

## 5. Service Layer (Server, New)

```
server/src/services/
├── docuseal.ts          # Existing: init, resolveTemplateId, createSubmission
│                        # New: getTemplateFields(templateId) → field[]
├── routes/
│   ├── claim.ts         # Updated: POST /api/claims with expanded body
│   └── template.ts      # New: POST /api/template-fields
└── config.ts            # Unchanged
```

---

## 6. Deployment

No changes to existing Docker/deployment setup. Single container serving client static files and API on port 3000.

---

## 7. Future Considerations

- Google Places API or similar for address autocomplete (placeholder for now — accept free-text with state extraction).
- More than 2 insureds (insured count is already dynamic on server; client add limit can be increased).
- File uploads (loss photos, documents).
- Additional state/template mapping entries added to `template-mapping.json`.
