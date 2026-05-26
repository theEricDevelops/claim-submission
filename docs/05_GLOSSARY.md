# Glossary

## Domain Terms

| Term | Definition | Used In |
|------|------------|---------|
| **Claim** | An insurance claim for property damage or loss submitted by a policyholder. The primary entity the system manages. | Job, Lead, Contract |
| **Lead** | An initial inquiry or potential claim before it becomes an active Job. Has status lifecycle: NEW → CONTACTED → QUALIFIED → CONVERTED/LOST/CLOSED. | Lead model |
| **Job** | An active claim after a Lead is converted. Represents ongoing work from assessment through settlement. Has status lifecycle: DRAFT → PENDING → ACTIVE → CLOSED. | Job model |
| **Policy** | The insurance policy under which a claim is filed. Contains policy number, carrier, coverage limits, deductible, and effective dates. | Policy model |
| **Named Insured** | The person(s) or entity listed on the insurance policy as the insured party. A policy can have 1 or 2 named insureds in the current flow. | NamedInsured in Zod schema, AssignmentContact with role `NAMED_INSURED` |
| **Carrier** | The insurance company that issued the policy. Also called the insurer. | Company model (via `CarrierOnPolicies`) |
| **Lender** | A mortgagee / lienholder listed on the policy (e.g., a bank). | Company model (via `LenderOnPolicies`) |
| **Public Adjuster** | A licensed professional who represents the policyholder in preparing, presenting, and negotiating an insurance claim. The primary user of this system. | Member model, Contract provider |
| **Carrier Adjuster** | An adjuster employed by the insurance company to evaluate and settle the claim. | AssignmentContact with role `CARRIER_ADJUSTER` |
| **PA Agreement** | Public Adjuster Agreement — the contract between the public adjuster (as provider) and the named insured (as client). Generated via DocuSeal. | Contract with type `PA_AGREEMENT` |
| **Contract** | A legal agreement between a provider (Member) and one or more clients (Contact). Types: PA Agreement, Contractor Agreement, Attorney Engagement, Appraisal Agreement, Umpire Engagement. | Contract model |
| **Submission** | A DocuSeal submission — a document sent for e-signature with pre-filled field values. | `submissionId` on Contract |
| **Template** | A DocuSeal document template with named fields, signing roles, and workflow configuration. Resolved by state + insured count prefix. | DocuSeal integration |
| **Template Field** | A named, typed field within a DocuSeal template (e.g., "Date of Loss", "Type of Loss"). Mapped from form data to document fields. | TemplateField type |
| **Submitter** | A signing role in a DocuSeal submission (e.g., "First Insured", "Public Adjuster"). Each has an email and assigned fields. | DocuSeal submitters |
| **Loss Address** | The physical address where the insured property damage or loss occurred. Entered in Step 0 of the form. | Address model (referenced by Job/Lead as `lossAddress`) |
| **Loss Details** | Information about the claim: date of loss, type of loss, policy number, claim number, description, insurance carrier. Entered in Step 2 via dynamic template fields. | `fieldValues` on ClaimFormData |
| **Date of Loss** | The date on which the insured damage or loss occurred. | Policy.dateOfLoss |
| **Type of Loss** | The category of damage (Fire, Water, Wind, Hail, Theft, Vandalism, Smoke, Mold, Lightning, Explosion, Vehicle, Other). | Policy.typeOfLoss |

---

## Entity Roles (JobRole enum)

| Role | Description |
|------|-------------|
| `NAMED_INSURED` | The policyholder / insured party |
| `CARRIER_ADJUSTER` | Adjuster employed by the insurance carrier |
| `PUBLIC_ADJUSTER` | Adjuster representing the insured |
| `ATTORNEY` | Legal representative for any party |
| `APPRAISER` | Independent property damage appraiser |
| `UMPIRE` | Neutral third party for appraisal disputes |

---

## Status Lifecycles

### Job (Claim Status)

```
DRAFT ──→ PENDING ──→ ACTIVE ──→ CLOSED
```

### Lead (Sales/Screening)

```
NEW ──→ CONTACTED ──→ QUALIFIED ──→ CONVERTED
                                        LOST
                                        CLOSED
```

### Contract (Agreement Lifecycle)

```
DRAFT ──→ SENT ──→ SIGNED ──→ ACTIVE ──→ COMPLETED
                                          TERMINATED
```

### Assignment (Contact Assignment)

```
ACTIVE ──→ COMPLETED
         ──→ REMOVED
```

---

## Contract Types (ContractType enum)

| Type | Description |
|------|-------------|
| `PA_AGREEMENT` | Public Adjuster Agreement — PA to represent insured |
| `CONTRACTOR_AGREEMENT` | Contractor engagement for repairs |
| `ATTORNEY_ENGAGEMENT` | Attorney retained for legal representation |
| `APPRAISAL_AGREEMENT` | Appraisal clause invoked |
| `UMPIRE_ENGAGEMENT` | Umpire selected for appraisal |

---

## Fee Types (FeeType enum)

| Type | Description |
|------|-------------|
| `PERCENTAGE` | Fee as a percentage of the claim settlement |
| `FLAT_FEE` | Fixed fee amount |
| `HOURLY` | Fee based on time worked |

---

## Document Categories (DocumentCategory enum)

| Category | Description |
|----------|-------------|
| `PHOTO` | Photos of property damage |
| `ESTIMATE` | Damage estimate / repair quote |
| `POLICY` | Insurance policy documents |
| `REPORT` | Adjuster reports, expert reports |
| `CORRESPONDENCE` | Letters, emails, communications |
| `INVOICE` | Billing invoices |
| `OTHER` | Other uncategorized documents |

---

## Polymorphic Entity Types

### NoteableType (what a Note can attach to)

`JOB`, `LEAD`, `CONTACT`, `PERSON`, `COMPANY`, `DOCUMENT`, `CONTRACT`

### ActivityType (what kind of activity was logged)

`EMAIL`, `PHONE`, `TEXT`, `MEETING`, `RECORD`

### ActivityAction (what action was performed)

`CREATED`, `EDITED`, `DELETED`, `COMPLETED`, `DESTROYED`

### EmailTarget (what entity an EmailMessage targets)

`JOB`, `LEAD`, `CONTACT`

---

## Contact Types

| Type | Description |
|------|-------------|
| `PERSON` | A natural person with name components (via Person model) |
| `COMPANY` | A business entity (via Company model) |

The `Contact` model is a universal record that can represent either. The `type` field discriminates, and the optional `personId` / `companyId` FKs link to detailed records.

---

## Template Naming Convention

DocuSeal templates must follow this naming convention for auto-resolution:

```
{STATE}_{count} - {description}

Examples:
  TN_1 - TN Public Adjuster Agreement Package (Single Insured)
  TN_2 - TN Public Adjuster Agreement Package (Two Insured)
  IL_1 - IL Public Adjuster Agreement
```

---

## Acronyms

| Acronym | Stands For |
|---------|------------|
| PA | Public Adjuster |
| PA (agreement) | Public Adjuster (Agreement) |
| CSP | Content Security Policy |
| JWT | JSON Web Token |
| FK | Foreign Key |
| PK | Primary Key |
| M:M | Many-to-Many relationship |
| 1:M | One-to-Many relationship |
| 1:1 | One-to-One relationship |
