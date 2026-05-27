# ClaimForge Platform — Specification

## 1. Platform Vision

ClaimForge is a multi-tenant public adjuster claims management platform. Each **Tenant** is an independent organization (a public adjusting firm, contractor, or attorney's office). A Tenant has **Members** (employees — adjusters, admins, support staff, freelancers) and **Users** (clients — the named insureds filing claims). Members and Users are both **Persons** — a unified identity model.

**Key principles:**

- Every data record carries a `tenantId` — no record exists outside a tenant context.
- Every data record carries a full audit trail: `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `deletedBy`, `deletedAt`, `destroyedBy`, `destroyedAt`.
- Every data record has an **owner** (Person) — the responsible party, distinct from the creator. Ownership is reassignable.
- A Person can be a **Member** of multiple tenants simultaneously, with a different role in each.
- Members see all records within their tenant. Users (clients) see only records they are linked to via AssignmentContact.
- The root tenant, **ClaimForge**, is the platform operator. ClaimForge ADMINs can act across all tenants.

---

## 2. Identity Model

### 2.1 Person (Global Identity)

A **Person** is a real-world individual. Every Member, User, and Service Account is backed by a Person record.

**Person is global** — no `tenantId`. It exists outside any tenant so that a single Person can be a Member of multiple tenants and a User in another, all under one login.

```prisma
model Person {
  id         String @id @default(uuid()) @db.Uuid
  salutation String @db.VarChar(25)
  firstName  String @db.VarChar(65)
  middleName String? @db.VarChar(65)
  lastName   String @db.VarChar(65)
  suffix     String? @db.VarChar(25)

  isServiceAccount Boolean @default(false)

  member      Member?               // employee of one or more tenants
  user        User?                 // client of a tenant
  contacts    Contact[]             // per-tenant representations
  memberships TenantMembership[]

  authoredNotes Note[]
  activities    Activity[]
}
```

A Person may have **zero** identity records (service account), **one** (pure Member or pure User), or **both** (someone who is both an employee of one tenant and a client of another).

**No `primaryEmail` on Person.** The canonical login identifier lives on Member.email or User.email. Per-tenant visible email lives on the tenant's Contact record.

### 2.2 Member (Employee / Freelancer)

A **Member** is a Person who works for one or more Tenants.

```prisma
model Member {
  id           String @id @default(uuid()) @db.Uuid
  person       Person @relation(fields: [personId], references: [id], onDelete: Cascade)
  personId     String @unique @db.Uuid

  email        String @unique       // login identifier, unique across ClaimForge
  passwordHash String

  memberships  TenantMembership[]   // tenant memberships with roles
  contracts    Contract[]
  apiKeys      ApiKey[]
}
```

A Member authenticates with their **email**. The email is unique across the entire ClaimForge platform — no two Persons can share the same email.

#### Multi-Tenant Membership

A Member belongs to a Tenant through a **TenantMembership** join record. Each membership carries a role scoped to that tenant.

```prisma
model TenantMembership {
  id        String @id @default(uuid()) @db.Uuid
  member    Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId  String @db.Uuid
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId  String @db.Uuid
  role      TenantRole @relation(fields: [roleId], references: [id])
  roleId    String @db.Uuid
  isAdmin   Boolean @default(false)  // shortcut for TenantRole slug = "admin"

  @@unique([memberId, tenantId])
  @@index([tenantId])
}
```

This design allows a freelance estimator to work for multiple PA firms:

| Person | Member Email | Tenant | Role |
|---|---|---|---|
| Jane Estimator | jane@example.com | PolicyLogic | MEMBER |
| Jane Estimator | jane@example.com | ContractorCo | MEMBER |
| Jane Estimator | jane@example.com | AttyFirm | MEMBER |

The same Person logs in once and switches between tenant contexts. Their JWT carries all active memberships.

### 2.3 User (Client)

A **User** is a client who logs into the Client Portal.

```prisma
model User {
  id           String @id @default(uuid()) @db.Uuid
  person       Person @relation(fields: [personId], references: [id], onDelete: Cascade)
  personId     String @unique @db.Uuid

  email        String @unique       // login identifier
  passwordHash String

  tenantUsers TenantUser[]
  apiKeys     ApiKey[]
  documents   Document[]
}
```

A User authenticates with their email. Users are linked to claims through `Person → Contact → AssignmentContact → Job/Lead`.

Users can also own unlinked documents such as profile photos or signature images, stored via the `documents` relation.

#### Tenant-User Join

```prisma
model TenantUser {
  id       String @id @default(uuid()) @db.Uuid
  userId   String @db.Uuid
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roleId   String @db.Uuid
  role     TenantRole @relation(fields: [roleId], references: [id])

  @@unique([userId, tenantId])
  @@index([tenantId])
}
```

### 2.4 Service Accounts

A **Service Account** is a Person with `isServiceAccount = true` and no Member or User link. Service accounts are used for automated processes (cron jobs, webhook handlers, system migrations, email routing).

Each tenant can have one or more service accounts. The seed script creates one per tenant (e.g., "PolicyLogic System").

```prisma
model ServiceToken {
  id        String @id @default(uuid()) @db.Uuid
  person    Person @relation(fields: [personId], references: [id], onDelete: Cascade)
  personId  String @unique @db.Uuid
  name      String                    // e.g. "Email Router - PolicyLogic"
  tokenHash String
  expiresAt DateTime?
  createdAt DateTime @default(now())
}
```

Service accounts appear in Activity logs as the actor, just like any other Person. Tenant admins can see service account activity in their audit trail.

### 2.5 Email Masking Across Tenants

Each tenant sees a different "face" of the same Person through their per-tenant **Contact** record:

| Login Person | Tenant | Visible Email | Visible Phone |
|---|---|---|---|
| John (j@smith.org) | PolicyLogic | john@hotworks.co | (555) 111-2222 |
| John (j@smith.org) | HotWorks | john@hotworks.co | (555) 111-2222 |
| John (j@smith.org) | SomeOtherCo | j@consulting.org | (555) 333-4444 |

- John logs in with `j@smith.org` (his Member.email).
- PolicyLogic sees `john@hotworks.co` because that's what Contact.Email says for that tenant.
- SomeOtherCo sees `j@consulting.org`.
- Tenants never see each other's emails.

---

## 3. Tenants

### 3.1 Tenant Model

```prisma
model Tenant {
  id        String @id @default(uuid()) @db.Uuid
  name      String @unique
  subdomain String @unique
  secretKey String @unique    // per-tenant secret for local secrets

  config    TenantConfig?

  memberships TenantMembership[]
  tenantUsers TenantUser[]
  roles       TenantRole[]
  invites     TenantInvite[]
}
```

**`tenant.secretKey`** — a per-tenant secret used for any tenant-local hashing (e.g., password reset tokens, invite links). Limits blast radius if one tenant's secrets are compromised.

### 3.2 Tenant Config

```prisma
model TenantConfig {
  tenantId String @unique @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  primaryColor   String
  secondaryColor String

  phoneTypes   String[] @default(["home", "work", "cell", "fax", "other"])
  emailTypes   String[] @default(["home", "work", "other"])
  addressTypes String[] @default(["home", "work", "mailing", "other"])

  allowedDomains String[] // whitelist for self-joining members
  maxMemberSeats Int      @default(10) // 0 = unlimited
}
```

**Domain whitelist:** If `allowedDomains` is non-empty, anyone with a verified email at one of those domains can self-join as a Member via a magic-link flow, up to `maxMemberSeats`. Otherwise, all membership is invite-only.

### 3.3 Tenant Roles

```prisma
model TenantRole {
  id        String           @id @default(uuid()) @db.Uuid
  tenantId  String           @db.Uuid
  tenant    Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String
  slug      String
  privileges String[]

  @@unique([tenantId, slug])

  memberships TenantMembership[]
  tenantUsers TenantUser[]
}
```

### 3.4 Tenant Invite

```prisma
model TenantInvite {
  id       String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  email  String // invited email
  roleId String @db.Uuid
  role   TenantRole @relation(fields: [roleId], references: [id])

  @@index([tenantId])
  @@index([email])
}
```

### 3.5 ContractType (Per-Tenant Configurable)

`ContractType` defines the kinds of contracts a tenant uses. Replaces the global `ContractType` enum. Each tenant defines their own types based on their business:

- A PA firm: PA Agreement, Appraisal Agreement, Estimating Contract
- A construction company: New Construction, Mitigation, Remediation, Refinish

```prisma
model ContractType {
  id       String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name     String
  slug     String

  @@unique([tenantId, slug])
}
```

Default seeded types per tenant: `PA Agreement`, `Contractor Agreement`, `Attorney Engagement`, `Appraisal Agreement`, `Umpire Engagement`.

### 3.6 JobRole (Per-Tenant Configurable)

`JobRole` defines roles that can be assigned to Persons on Jobs/Leads via AssignmentContact. Replaces the global `JobRole` enum.

```prisma
model JobRole {
  id       String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name     String
  slug     String

  @@unique([tenantId, slug])
}
```

Default seeded roles per tenant: `Admin`, `Director`, `Manager`, `Supervisor`, `Employee`, `Named Insured`, `Carrier Adjuster`, `Public Adjuster`, `Attorney`, `Appraiser`, `Umpire`.

---

## 4. Contacts & Companies

### 4.1 Contact (Per-Tenant Identity)

A **Contact** is the per-tenant representation of a Person or Company. It carries the phone, email, and address visible within that tenant.

Contacts serve two roles:
1. **Per-tenant identity** — what a tenant sees for a Person (masked email/phone from §2.5).
2. **Assigned party** — linked to Jobs/Leads via AssignmentContact.

```prisma
model Contact {
  id   String @id @default(uuid()) @db.Uuid
  type ContactType @default(PERSON)

  name String  // display name: company name or composite of Person's name

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  personId String? @unique @db.Uuid
  person   Person? @relation(fields: [personId], references: [id], onDelete: SetNull)

  companyId String?  @unique @db.Uuid
  company   Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  // Audit + owner
  createdBy   Person @relation("ContactCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("ContactUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("ContactDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("ContactDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("ContactOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  uploadedDocs Document[]
  assignmentContacts AssignmentContact[]
  contracts          Contract[]
  phones    Phone[]
  emails    Email[]
  addresses Address[]
}
```

- **With Person:** A Contact linked to a Person represents that Person within the tenant.
- **Without Person (company-only):** A Contact can represent an entity like "State Farm" without a linked Person. This is used for companies that participate in claims (carriers) but don't have ClaimForge accounts.

### 4.2 Phone, Email, Address

These carry their own audit fields (no tenantId — inherited from parent Contact):

```prisma
model Phone {
  id String @id @default(uuid()) @db.Uuid
  phoneContactId String @db.Uuid
  phoneContact   Contact @relation(fields: [phoneContactId], references: [id], onDelete: Cascade)
  country String @db.VarChar(3)
  number  String @db.VarChar(10)
  type    String @db.VarChar(25)

  createdBy   Person @relation("PhoneCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("PhoneUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("PhoneDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("PhoneDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?

  @@index([phoneContactId])
}
```

Same pattern for `Email` and `Address`. Their audit fields track when a phone number was added, updated, or by whom — critical support use cases.

### 4.3 Company

Companies are per-tenant (carrier, lender, contractor). Any Member can create one within their tenant.

```prisma
enum CompanyType {
  CARRIER
  LENDER
  CONTRACTOR
  ADJUSTING_FIRM
  ATTORNEY
  OTHER
}

model Company {
  id   String      @id @default(uuid()) @db.Uuid
  type CompanyType @default(OTHER)

  name String

  @@unique([tenantId, name])

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  // Audit + owner
  createdBy   Person @relation("CompanyCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("CompanyUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("CompanyDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("CompanyDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("CompanyOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  contacts          CompanyContact[]
  contact           Contact?
  carrierOnPolicies Policy[]         @relation("CarrierOnPolicies")
  lenderOnPolicies  Policy[]         @relation("LenderOnPolicies")
}
```

### 4.4 CompanyContact

Joins a Company to a Person who is an employee or representative of that company (e.g., John is the claims contact at State Farm). This is distinct from `Contact.companyId` (see §4.1), which represents a Contact that **is** a company (type=COMPANY). CompanyContact tracks who works at a company. Contact.companyId tracks a Contact record that represents the company itself.

```prisma
model CompanyContact {
  id String @id @default(uuid()) @db.Uuid
  companyId String @db.Uuid
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  personId  String @db.Uuid
  person    Person @relation(fields: [personId], references: [id], onDelete: Cascade)
  jobTitle  String?

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  // Audit fields
  createdBy   Person @relation("CompanyContactCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("CompanyContactUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("CompanyContactDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("CompanyContactDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?

  @@index([companyId])
  @@index([personId])
}
```

---

## 5. Core Business Models

### 5.1 Policy

An insurance policy covering a loss event. Every Policy belongs to a carrier Company (`type: CARRIER`) and optionally has lender Companies (`type: LENDER`).

```prisma
model Policy {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  policyNumber String
  claimNumber  String?

  dateOfLoss DateTime?
  typeOfLoss String?  // e.g. "Wind", "Fire", "Water", "Theft", "Liability"

  // Deductible — per-peril amounts stored as JSON
  // Example:
  // [
  //   { "peril": "All Perils", "type": "PERCENTAGE", "value": 1.0 },
  //   { "peril": "Wind/Hail",  "type": "DOLLAR",     "value": 2500 },
  //   { "peril": "Hurricane",  "type": "PERCENTAGE", "value": 5.0 },
  //   { "peril": "Other",      "type": "DOLLAR",     "value": 1000, "description": "Theft" }
  // ]
  deductibles Json?

  // Coverages — stored as JSON array of objects
  // Example:
  // [
  //   { "name": "Dwelling (Coverage A)",        "type": "DOLLAR",      "limit": 350000 },
  //   { "name": "Other Structures (Coverage B)", "type": "PERCENTAGE", "limit": 10 },
  //   { "name": "Mold Limit",                    "type": "DOLLAR",      "limit": 10000 },
  //   { "name": "Increased Cost of Compliance",  "type": "PERCENTAGE", "limit": 25, "appliesTo": "Coverage A" },
  //   { "name": "Loss of Use (Coverage D)",      "type": "AS_INCURRED", "description": "As incurred for 12 months", "timeLimit": "P12M" },
  //   { "name": "Ordinance or Law",              "type": "PERCENTAGE", "limit": 25, "appliesTo": "Coverage A" }
  // ]
  coverages Json?

  // Forms / Endorsements — stored as JSON array
  // [
  //   { "formNumber": "HO 04 54",  "formName": "Increased Cost of Compliance",    "type": "INCREASES_COVERAGE" },
  //   { "formNumber": "HO 04 77",  "formName": "Mold Limit",                      "type": "SUB_LIMIT" },
  //   { "formNumber": "HO 05 20",  "formName": "Ordinance or Law",                "type": "INCREASES_COVERAGE" },
  //   { "formNumber": "HO 04 11",  "formName": "Earthquake",                      "type": "EXCLUSION" }
  // ]
  endorsements Json?

  // Carrier (single) and Lender(s)
  carrier   Company @relation("CarrierOnPolicies", fields: [carrierId], references: [id])
  carrierId String  @db.Uuid
  lenders   Company @relation("LenderOnPolicies")

  policyEffectiveDate  DateTime?
  policyExpirationDate DateTime?

  jobs  Job[]
  leads Lead[]

  // Full audit fields (8-field pattern)
  createdBy   Person @relation("PolicyCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("PolicyUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("PolicyDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("PolicyDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("PolicyOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  @@index([tenantId])
  @@index([policyNumber])
  @@index([claimNumber])
  @@index([carrierId])
}
```

**Deductible types:** `DOLLAR` (fixed amount), `PERCENTAGE` (percentage of Coverage A).

**Coverage types:** `DOLLAR` (fixed limit), `PERCENTAGE` (percentage of Coverage A), `AS_INCURRED` (unlimited, optionally with a time limit).

**Endorsement types:** `INCREASES_COVERAGE` (increases a base coverage limit by percentage), `SUB_LIMIT` (separate sub-limit, not a percentage), `EXCLUSION` (removes coverage), `MODIFICATION` (alters terms without changing limits).

### 5.2 Document

Files uploaded to claims. Storage is handled by a connector abstraction (§12).

```prisma
model Document {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  jobId  String? @db.Uuid
  job    Job?    @relation(fields: [jobId], references: [id], onDelete: Cascade)
  leadId String? @db.Uuid
  lead   Lead?   @relation(fields: [leadId], references: [id], onDelete: Cascade)

  uploadedBy   Contact @relation(fields: [uploadedById], references: [id], onDelete: Restrict)
  uploadedById String  @db.Uuid

  fileName   String
  mimeType   String?
  fileSize   Int?
  storageKey String
  storageType String @default("local")

  category DocumentCategory // PHOTO, ESTIMATE, POLICY, REPORT, CORRESPONDENCE, INVOICE, OTHER

  // Full audit fields (8-field pattern)
  createdBy   Person @relation("DocumentCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("DocumentUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("DocumentDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("DocumentDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("DocumentOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  @@index([tenantId])
  @@index([jobId])
  @@index([leadId])
  @@index([uploadedById])
  @@index([category])
  @@index([createdAt])
}
```

### 5.3 Lead → Job Conversion

When a Lead's status changes to `CONVERTED`, a Job is automatically created:

1. All Lead fields are copied to the new Job (policy, loss address, assignment contacts, contracts, documents).
2. The owner of the Job is set to the Person who approved the conversion.
3. An Activity entry is created for both the Lead (`actionType: COMPLETED`) and the new Job (`actionType: CREATED`).
4. The original Lead retains its ID and history — it is not deleted or replaced.

**Opt-out:** `TenantConfig` may include `autoCreateJob: Boolean @default(true)` to disable this behavior, allowing manual lead-to-job conversion.

### 5.4 Supporting Enums

The following enums are global (not per-tenant configurable):

| Enum | Values |
|---|---|
| `JobStatus` | `DRAFT`, `PENDING`, `ACTIVE`, `CLOSED` |
| `LeadStatus` | `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `LOST`, `CLOSED` |
| `ContactType` | `PERSON`, `COMPANY` |
| `FeeType` | `PERCENTAGE`, `FLAT_FEE`, `HOURLY` |
| `ContractStatus` | `DRAFT`, `SENT`, `SIGNED`, `ACTIVE`, `COMPLETED`, `TERMINATED` |
| `AssignmentStatus` | `ACTIVE`, `COMPLETED`, `REMOVED` |
| `DocumentCategory` | `PHOTO`, `ESTIMATE`, `POLICY`, `REPORT`, `CORRESPONDENCE`, `INVOICE`, `OTHER` |
| `TaskStatus` | `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `ActivityType` | `EMAIL`, `PHONE`, `TEXT`, `MEETING`, `RECORD`, `TASK` |
| `ActivityAction` | `CREATED`, `EDITED`, `DELETED`, `COMPLETED`, `DESTROYED`, `ASSIGNED`, `STATUS_CHANGED` |
| `NoteableType` | `JOB`, `LEAD`, `CONTACT`, `PERSON`, `COMPANY`, `DOCUMENT`, `CONTRACT`, `TASK` |
| `EmailTarget` | `JOB`, `LEAD`, `CONTACT` |
| `CompanyType` | `CARRIER`, `LENDER`, `CONTRACTOR`, `ADJUSTING_FIRM`, `ATTORNEY`, `OTHER` |

`JobRole` and `ContractType` were removed from the global enums — they are now per-tenant configurable models (see §3.6 and §3.5).

---

## 6. Tenancy

### 6.1 tenantId on Data Models

Every data-bearing model carries a `tenantId`, set at creation time and immutable.

| Model | Has tenantId | Notes |
|---|---|---|
| Policy | Yes | |
| Job | Yes | |
| Lead | Yes | |
| Contact | Yes | Per-tenant representation |
| Company | Yes | Per-tenant company |
| CompanyContact | Yes | |
| Phone | Yes | Own field (not inherited) |
| Email (contact) | Yes | Own field |
| Address | Yes | Own field |
| Document | Yes | |
| Note | Yes | |
| Contract | Yes | |
| AssignmentContact | Yes | |
| Activity | Yes | |
| Task | Yes | |
| EmailMessage | Yes | |

**Models without tenantId:**

| Model | Reason |
|---|---|
| Person | Global identity — one login across tenants |
| Tenant | The tenant itself |
| TenantRole | Scoped by FK |
| TenantMembership | Scoped by FK |
| TenantUser | Scoped by FK |
| Member | Global — Person may join multiple tenants |
| User | May become multi-tenant |
| ServiceToken | Scoped by FK to Person |
| TenantInvite | Scoped by FK to Tenant |
| TenantConfig | Scoped by FK to Tenant |
| ApiKey | Scoped by FK to TenantMembership or User |

### 6.2 Tenant Context

- When a Person authenticates, they select an **active tenant** (if they belong to multiple).
- All API requests are scoped to the active tenant from the JWT.
- Queries always include `WHERE tenantId = :activeTenantId` (enforced server-side).
- Moving between tenants requires `POST /api/auth/switch-tenant`.

---

## 7. Authentication

### 7.1 Login

```
POST /api/auth/login
{ "email": "jane@example.com", "password": "..." }
```

1. Look up Person by email (check Member.email, then User.email).
2. Verify password hash (argon2id).
3. Fetch all active memberships/tenant-users for the Person.
4. Issue JWT.

### 7.2 JWT Structure

```json
{
  "sub": "<personId>",
  "email": "jane@example.com",
  "type": "member",
  "isServiceAccount": false,
  "memberships": [
    {
      "tenantId": "<uuid>",
      "tenantSubdomain": "policylogic",
      "tenantName": "PolicyLogic",
      "role": "admin",
      "privileges": ["*"]
    },
    {
      "tenantId": "<uuid>",
      "tenantSubdomain": "contractorco",
      "tenantName": "ContractorCo",
      "role": "member",
      "privileges": ["claims:read", "claims:write"]
    }
  ],
  "activeTenantId": "<uuid>",
  "actorId": "<personId>",
  "actingAs": null,
  "iat": <timestamp>,
  "exp": <timestamp>
}
```

**type** — `"member"`, `"user"`, or `"service"`.

**memberships** — all tenants accessible by the Person, with per-tenant role and privileges.

**activeTenantId** — current tenant context. Determines `type`: if the active tenant's membership is via TenantMembership → `"member"`; if via TenantUser → `"user"`.

**actorId** — always the authenticated Person. During impersonation, `sub` becomes the target, `actorId` remains the original.

**actingAs** — set during impersonation.

### 7.3 Tenant Switching

```
POST /api/auth/switch-tenant
Authorization: Bearer <jwt>
{ "tenantId": "<uuid>" }
```

Returns a new JWT with `activeTenantId` set to the requested tenant. The Person's role type (member/user) is determined by which membership they use in that tenant.

### 7.4 Session Management

| Event | Action |
|---|---|
| Login | JWT issued, 24h expiry, stored in httpOnly cookie |
| API call | `verifyRequest()` decodes JWT, enforces tenant context |
| Tenant switch | New JWT with different `activeTenantId` |
| Logout | Cookie cleared |
| Impersonate | New JWT with `actingAs` set |

### 7.5 User Registration

**Users (clients):** Invite-only. A Tenant ADMIN sends an invite via `TenantInvite` specifying `roleId`. The invited person receives a magic-link email to set their password.

**Members (employees):** Two paths:
1. **Invite:** Same flow — ADMIN sends invite.
2. **Self-join (domain whitelist):** If the tenant has `allowedDomains` set and the person's email domain matches, they can self-join via magic-link verification. Enforces `maxMemberSeats`.

### 7.6 Password Reset

```
POST /api/auth/forgot-password  → magic-link email
GET  /api/auth/reset/:token     → validates token, shows reset form
POST /api/auth/reset/:token     → new password, sends confirmation email (system email outside the platform — not logged in EmailMessage)
```

---

## 8. Authorization & Access Control

### 8.1 Privilege Model

Privileges are stored as a `String[]` on `TenantRole`. The wildcard `"*"` grants all privileges.

### 8.2 Initial Privilege Set

| Privilege | Scope | Description |
|---|---|---|
| `claims:read` | Tenant | View all claims in tenant |
| `claims:read:own` | Self | View only assigned/owned claims |
| `claims:write` | Tenant | Create and edit claims |
| `claims:delete` | Tenant | Soft-delete claims |
| `documents:read` | Tenant | View all documents |
| `documents:read:own` | Self | View own documents |
| `documents:upload` | Self | Upload documents to assigned claims |
| `documents:delete` | Tenant | Delete documents |
| `emails:read` | Tenant | View email history |
| `emails:send` | Tenant | Send emails from claim |
| `contacts:read` | Tenant | View all contacts |
| `contacts:write` | Tenant | Create and edit contacts |
| `tasks:read` | Tenant | View all tasks |
| `tasks:read:own` | Self | View own assigned tasks |
| `tasks:write` | Self | Create and update own tasks |
| `tasks:assign` | Tenant | Assign tasks to anyone |
| `notes:read` | Tenant | View all notes |
| `notes:write` | Self | Create notes |
| `contracts:read` | Tenant | View all contracts |
| `contracts:sign` | Self | Sign contracts |
| `emails:send` | Tenant | Send emails from claim |
| `admin:users` | Tenant | Manage User accounts |
| `admin:members` | Tenant | Manage Member accounts and memberships |
| `admin:roles` | Tenant | Create and edit roles |
| `admin:settings` | Tenant | Edit tenant configuration |
| `impersonate:member` | Tenant | Impersonate any Member |
| `impersonate:user` | Tenant | Impersonate any User |
| `audit:read` | Tenant | View Activity log |

The `:own` suffix resolves as: `ownerId = currentPersonId` OR the Person is assigned to the record via AssignmentContact.

### 8.3 Default Roles

| Role | Privileges |
|---|---|
| ADMIN | `["*"]` |
| MEMBER | `["claims:read", "claims:write", "documents:read", "documents:upload", "emails:read", "emails:send", "contacts:read", "contacts:write", "tasks:read", "tasks:write", "tasks:assign", "notes:read", "notes:write", "contracts:read", "contracts:sign"]` |
| USER | `["claims:read:own", "documents:read:own", "documents:upload", "emails:read", "notes:read", "contracts:read"]` |

### 8.4 Access Decision Matrix

| Actor | Scope | Can See | Can Modify |
|---|---|---|---|
| ClaimForge ADMIN | Global (`*`) | Everything | Everything |
| Tenant ADMIN | Their tenant (`*`) | Everything in tenant | Everything in tenant |
| Tenant MEMBER | Their tenant (privilege-set) | Per assigned privileges | Per assigned privileges |
| Tenant USER | Their tenant | Only own assigned claims | Documents, notes (read-mostly) |

### 8.5 Enforcement — Two Layers

**Layer 1 — Middleware**

```typescript
verifyRequest(req) → {
  person,           // Person record
  type,             // "member" | "user" | "service"
  activeTenantId,   // UUID
  role,             // TenantRole slug
  privileges,       // string[]
  memberships,      // all tenant memberships (for tenant switcher)
  actorId,          // original Person (during impersonation)
  actingAs          // target Person (during impersonation)
}
```

**Layer 2 — Query scoping**

Member queries (tenant scope):
```sql
WHERE tenantId = :activeTenantId AND deletedAt IS NULL
```

User queries (assignment scope):
```sql
WHERE tenantId = :activeTenantId AND deletedAt IS NULL
  AND id IN (
    SELECT jobId FROM AssignmentContact ac
    JOIN Contact c ON ac.contactId = c.id
    WHERE c.personId = :personId
  )
```

### 8.6 Impersonation

```
POST /api/auth/impersonate
Authorization: Bearer <admin-jwt>
{ "targetPersonId": "<uuid>", "tenantId": "<uuid>" }
```

| Impersonator | Can Impersonate |
|---|---|
| ClaimForge ADMIN (`*`) | Any Person in any tenant |
| Tenant ADMIN (`*`, scoped) | Any Person within their tenant |
| `impersonate:member` | Members within their tenant |
| `impersonate:user` | Users within their tenant |

Impersonation JWT (1h expiry):

```json
{
  "sub": "<targetPersonId>",
  "email": "<targetEmail>",
  "type": "<targetType>",
  "memberships": [...],
  "activeTenantId": "<uuid>",
  "actorId": "<originalPersonId>",
  "actingAs": "<targetPersonId>"
}
```

---

## 9. Ownership & Assignment

### 9.1 Owner

Every data record (Policy, Job, Lead, Document, Note, Contract, EmailMessage, Task, Activity, Contact, Company) has an **owner** — the Person responsible for it.

- **`createdBy`** is immutable — set at creation time.
- **`owner`** is mutable — reassignable when someone leaves or responsibilities shift.
- If an owner is deactivated, their records must be reassigned by an admin. The API provides a `REASSIGN OWNED BY` equivalent.
- For system-created records (email auto-routing, scheduled jobs), the owner is the tenant's system service account Person.

```prisma
model Job {
  owner   Person @relation("JobOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid
  // ...
}
```

### 9.2 Assignment (Person via AssignmentContact)

`AssignmentContact` links Persons (via their per-tenant Contact) to Jobs/Leads with a role:

```prisma
model AssignmentContact {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  jobId  String? @db.Uuid
  job    Job?    @relation(fields: [jobId], references: [id], onDelete: Cascade)
  leadId String? @db.Uuid
  lead   Lead?   @relation(fields: [leadId], references: [id], onDelete: Cascade)

  contact   Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  contactId String  @db.Uuid

  role   JobRole     // per-tenant configurable (see §3.6)
  status AssignmentStatus @default(ACTIVE)

  assignedAt DateTime  @default(now())
  removedAt  DateTime?

  // Full audit fields (8-field pattern)
  createdBy   Person @relation("AssignmentCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("AssignmentUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("AssignmentDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("AssignmentDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("AssignmentOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  @@index([tenantId])
  @@index([jobId])
  @@index([leadId])
  @@index([contactId])
  @@index([status])
}
```

The owner of a Job should have a corresponding AssignmentContact with role appropriate to their relationship (e.g., `Named Insured`, `Public Adjuster`, or a custom role per §3.6).

### 9.3 Task Entity

```prisma
enum TaskStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Task {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  jobId  String? @db.Uuid
  job    Job?    @relation(fields: [jobId], references: [id], onDelete: Cascade)
  leadId String? @db.Uuid
  lead   Lead?   @relation(fields: [leadId], references: [id], onDelete: Cascade)

  title       String
  description String?
  status      TaskStatus @default(OPEN)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?

  assignedTo   Person @relation("TaskAssignee", fields: [assignedToId], references: [id])
  assignedToId String @db.Uuid

  // Audit fields (8-field pattern)
  createdBy   Person @relation("TaskCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("TaskUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("TaskDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("TaskDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("TaskOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid
}
```

A Task always belongs to either a Job or a Lead. Task lifecycle events emit Activity entries (see §10).

### 9.4 Contract

A legal agreement (contract) between a provider (Member of the tenant) and one or more clients (Contacts). Contract types are per-tenant configurable (see §3.5).

```prisma
model Contract {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  jobId  String? @db.Uuid
  job    Job?    @relation(fields: [jobId], references: [id], onDelete: Restrict)
  leadId String? @db.Uuid
  lead   Lead?   @relation(fields: [leadId], references: [id], onDelete: Restrict)

  // Provider (the Member/tenant offering services) and clients (the counterparties)
  provider   Member  @relation(fields: [providerId], references: [id], onDelete: Restrict)
  providerId String  @db.Uuid
  clients    Contact[]

  // Contract type — per-tenant model (§3.5)
  contractType   ContractType @relation(fields: [contractTypeId], references: [id])
  contractTypeId String       @db.Uuid

  feeType  FeeType  // PERCENTAGE, FLAT_FEE, HOURLY
  feeValue Float

  status ContractStatus @default(DRAFT) // DRAFT, SENT, SIGNED, ACTIVE, COMPLETED, TERMINATED

  // DocuSeal submission tracking
  submissionId String?

  // Key dates
  signedAt     DateTime?
  effectiveAt  DateTime?
  terminatedAt DateTime?

  // Full audit fields (8-field pattern)
  createdBy   Person @relation("ContractCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("ContractUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("ContractDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("ContractDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?
  owner   Person @relation("ContractOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  @@index([tenantId])
  @@index([providerId])
  @@index([status])
}
```

**Sent-to tracking:** DocuSeal lifecycle events (sent to recipient, viewed, signed, downloaded) are tracked via Activity entries (`activityType: RECORD`, `actionType: CREATED/COMPLETED`, linked to Contract). Each event records the recipient email, timestamp, and event type.

---

## 10. Audit Fields

### 10.1 Record-Level Audit (Every Table)

Every data-bearing model has these eight fields:

| Field | Type | Purpose |
|---|---|---|
| `createdBy` | Person (required) | Who created the record |
| `createdAt` | DateTime (`@default(now())`) | When created |
| `updatedBy` | Person (required) | Who last updated the record |
| `updatedAt` | DateTime (`@updatedAt`) | When last updated |
| `deletedBy` | Person? (nullable) | Who soft-deleted the record |
| `deletedAt` | DateTime? (nullable) | Soft-delete timestamp |
| `destroyedBy` | Person? (nullable) | Who authorized permanent deletion |
| `destroyedAt` | DateTime? (nullable) | Permanent deletion timestamp |

**deleted vs destroyed:**

- **`deletedAt` / `deletedBy`**: Soft delete. Record is hidden from standard queries (default filter: `WHERE deletedAt IS NULL`). Can be restored by an admin.
- **`destroyedAt` / `destroyedBy`**: Permanent deletion. Record is queued for hard deletion by a ClaimForge-wide scheduled cleanup job. Hidden from tenant completely (no visibility).
- **Cascade**: Soft-deleting a parent (Job) cascades `deletedAt`/`deletedBy` to its children (Documents, Notes, Tasks, AssignmentContacts, Activity entries). The cleanup job does the same for `destroyedAt`.

### 10.2 Activity Model (Event-Level Audit)

The Activity model is **append-only** — it tracks every action chronologically.

```prisma
enum ActivityType {
  EMAIL
  PHONE
  TEXT
  MEETING
  RECORD
  TASK       // added
}

enum ActivityAction {
  CREATED
  EDITED
  DELETED
  COMPLETED
  DESTROYED
  ASSIGNED
  STATUS_CHANGED
}

model Activity {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  activityType ActivityType
  activityId   String       @db.Uuid  // polymorphic FK (Job, Lead, Document, Task, etc.)

  actionType ActivityAction

  actor   Person @relation(fields: [actorId], references: [id])
  actorId String @db.Uuid

  createdAt DateTime @default(now())
  deletedBy   Person? @relation("ActivityDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
}
```

- **No `updatedBy`/`updatedAt`** — Activity is append-only, never updated.
- **No `destroyedBy`/`destroyedAt`** — Activity is never hard-deleted by user action.
- **`deletedAt`/`deletedBy`** — implements UI-level hiding (user "destroys" an activity entry → it's hidden, not removed).

#### Retention Policy

| State | Action | Timeline |
|---|---|---|
| Active (`deletedAt IS NULL`) | Visible in Activity tab | Indefinite |
| Soft-deleted (`deletedAt IS NOT NULL`) | Hidden from UI | Up to 10 years |
| Purge | Hard-deleted by ClaimForge system job | After 10 years from `deletedAt` |

The cleanup job runs as a ClaimForge service account Person. Activity records with `deletedAt < now() - 10 years` are hard-deleted.

#### Activity Tab UI

In a Job, Lead, Document, or other entity detail view, all Activity records where `activityId = :entityId AND deletedAt IS NULL` are displayed chronologically.

---

## 11. API Keys

API keys provide programmatic access scoped to a specific TenantMembership or User.

```prisma
model ApiKey {
  id        String   @id @default(uuid()) @db.Uuid
  name      String                          // e.g. "CI Pipeline - PolicyLogic"
  keyHash   String                          // bcrypt of the raw key
  lastUsedAt DateTime?
  createdAt  DateTime @default(now())
  expiresAt  DateTime?

  membershipId String? @db.Uuid
  membership   TenantMembership? @relation(fields: [membershipId], references: [id], onDelete: Cascade)

  userId String? @db.Uuid
  user   User?   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Full audit fields
  createdBy   Person @relation("ApiKeyCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  updatedBy   Person @relation("ApiKeyUpdatedBy", fields: [updatedById], references: [id])
  updatedById String @db.Uuid
  updatedAt   DateTime @updatedAt
  deletedBy   Person? @relation("ApiKeyDeletedBy", fields: [deletedById], references: [id])
  deletedById String? @db.Uuid
  deletedAt   DateTime?
  destroyedBy   Person? @relation("ApiKeyDestroyedBy", fields: [destroyedById], references: [id])
  destroyedById String? @db.Uuid
  destroyedAt   DateTime?

  @@index([keyHash])
}
```

- Member API keys inherit the permission set of their TenantMembership's role.
- User API keys inherit the permission set of their TenantUser's role.
- The raw key is returned once at creation (never stored). Only `keyHash` is persisted.
- API keys use `Authorization: Bearer <key>` or `x-api-key` header.

---

## 12. Document Storage

```prisma
model Document {
  // ... fields ...
  storageKey  String  // opaque key
  storageType String  @default("local") // "local", "s3", "gcs", "minio", etc.
}
```

**Phase 1 — Local filesystem:** Documents stored under `/data/documents/{tenantId}/{documentId}`. Use Docker volume for persistence.

**Phase 2 — Connector abstraction:** A storage connector interface allows each tenant's admin to choose their backend:
- S3-compatible (AWS S3, MinIO, DigitalOcean Spaces)
- Google Cloud Storage
- Azure Blob Storage
- Local filesystem (single-server deployments)

The `storageType` field determines which connector reads/writes the document. Connectors are configured at the tenant level or globally.

---

## 13. Email Routing

Each claim will eventually have a unique email address (`claim-<uuid>@claims.plpas.com`). For Phase 1, a shared inbox (`claims@plpas.com`) routes incoming emails:

1. Incoming email arrives at shared inbox.
2. EmailMessage created with `targetType: JOB` or `LEAD`, `targetId` resolved by matching sender email to Contact → Person → AssignmentContact → Job/Lead.
3. Attachments are uploaded as Documents via the Document connector, linked to the same target.
4. Activity entry is created (`activityType: EMAIL, actionType: CREATED`).

```prisma
model EmailMessage {
  id String @id @default(uuid()) @db.Uuid

  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  from    String
  to      String[]
  cc      String[]
  bcc     String[]
  subject String
  body    String

  targetId   String      @db.Uuid
  targetType EmailTarget // JOB | LEAD | CONTACT

  // Full audit fields (8-field pattern)
  createdBy   Person @relation("EmailCreatedBy", fields: [createdById], references: [id])
  createdById String @db.Uuid
  createdAt   DateTime @default(now())
  // ... updatedBy/At, deletedBy/At, destroyedBy/At ...

  owner   Person @relation("EmailOwner", fields: [ownerId], references: [id])
  ownerId String @db.Uuid

  @@index([targetType, targetId])
}
```

---

## 14. User Interfaces

### 14.1 Admin Dashboard (For Members)

The primary workspace for tenant employees. Key surfaces:

| Surface | Description |
|---|---|
| **Claim List** | Table of all Jobs/Leads in the tenant, filtered by status, priority, owner, date. Each row shows claim number, insured name, loss date, status, assigned to. |
| **Claim Detail** | Full claim view: loss info, policy details, document list, task list, email history, activity feed, related contacts. Supports editing fields, uploading documents, assigning tasks. |
| **Task Board** | Kanban or list view of all tasks in the tenant, filtered by assignee, status, priority, due date. |
| **Calendar** | All due dates, meetings, and deadlines linked to claims and tasks. |
| **Inbox** | Email messages linked to claims. Compose, reply, forward from within the platform. |
| **Contacts** | Directory of all Contacts in the tenant (Persons + Companies). |
| **Documents** | Central document repository with claim-scoped filtering. |
| **Audit Log** | Read-only Activity feed, filterable by entity, actor, date range, action type. |
| **Tenant Settings** | Branding, domain whitelist, max seats, allowed email/phone types. |
| **Member Management** | Add/remove Members, assign roles, manage memberships. |
| **User Management** | View Users, send invites, track login activity. |
| **Role Builder** | ADMIN creates/modifies roles by selecting privilege checkboxes. |

### 14.2 Client Portal (For Users)

A read-mostly interface for named insureds to track their claims:

| Surface | Description |
|---|---|
| **Claim List** | All claims where the User's Contact is an AssignmentContact. Shows claim number, status, loss date. |
| **Claim Detail** | Read-only: loss info, policy details, contract status. |
| **Documents** | Upload documents to their claims. View documents attached to their claims. |
| **Inbox** | Email history related to their claims. |
| **Settings** | Update their profile (visible only to this tenant). |

### 14.3 ClaimForge Console (For Platform ADMIN)

The root tenant has additional surfaces:

| Surface | Description |
|---|---|
| **Tenant Directory** | All tenants, their seat usage, storage consumption. |
| **Cross-Tenant Audits** | Activity log across all tenants for compliance. |
| **Global Impersonation** | Impersonate any Person in any tenant. |
| **System Health** | Service account activity, storage utilization, email routing stats. |

---

## 15. Seed Data

### 15.1 Tenants

| Tenant Name | Subdomain | Purpose |
|---|---|---|
| ClaimForge | `claimforge` | Platform operator — global ADMIN access |
| PolicyLogic | `policylogic` | Example public adjusting firm |

### 15.2 Roles (seeded per tenant)

| Role Name | Slug | Privileges |
|---|---|---|
| ADMIN | `admin` | `["*"]` |
| Member | `member` | member privileges per §8.3 |
| User | `user` | user privileges per §8.3 |

### 15.3 ClaimForge Members

| Email | Role | Display Name |
|---|---|---|
| `admin@claimforge.dev` | ADMIN | System Administrator |
| `support@claimforge.dev` | MEMBER | Support Agent |

### 15.4 PolicyLogic Members

| Email | Role | Display Name |
|---|---|---|
| `admin@policylogic.com` | ADMIN | Tenant Administrator |
| `jadams@policylogic.com` | MEMBER | John Adams (Senior Adjuster) |
| `scoleman@policylogic.com` | MEMBER | Sarah Coleman (Adjuster) |

### 15.5 PolicyLogic Users (Clients)

| Email | Display Name |
|---|---|
| `jane.doe@example.com` | Jane Doe |
| `bob.smith@example.com` | Bob Smith |

### 15.6 Service Accounts

| Tenant | Name | Person Name |
|---|---|---|
| ClaimForge | System | ClaimForge System |
| PolicyLogic | System | PolicyLogic System |

### 15.7 Seed Script

Single `prisma/seed.ts`, idempotent (upsert-based):

```bash
pnpm prisma db seed
```

Order: Tenants → Roles → Persons → Members → Service Accounts → Users → Contacts (with phones/emails) → TenantMemberships → TenantUsers → TenantConfig → ApiKeys.

Default password for all seeded accounts: `password123` (must change on first login).

---

## 16. API Design

### 16.1 Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | None | Authenticate, return JWT |
| POST | `/api/auth/logout` | JWT | Clear session |
| POST | `/api/auth/forgot-password` | None | Send reset magic link |
| POST | `/api/auth/reset/:token` | None | Reset password |
| POST | `/api/auth/switch-tenant` | JWT | Switch active tenant |
| POST | `/api/auth/impersonate` | ADMIN | Start impersonation |
| POST | `/api/auth/impersonate/stop` | ADMIN | End impersonation |
| GET | `/api/auth/me` | JWT | Current user + permissions |
| GET | `/api/tenants` | JWT | List user's tenant memberships |

### 16.2 Tenant Scoping Convention

- All tenant-scoped endpoints derive `activeTenantId` from JWT.
- Responses include `x-tenant-id` header.
- Cross-tenant access requires impersonation.

---

## 17. Security Considerations

### 17.1 Password Storage

- Algorithm: **argon2id**
- Min params: memory 64 MiB, iterations 3, parallelism 4, salt 16 bytes, hash 32 bytes

### 17.2 JWT

- Algorithm: HS256 (symmetric, `SESSION_SECRET`)
- Expiry: 24h (standard), 1h (impersonation)
- Storage: httpOnly cookie + `Authorization: Bearer` header

### 17.3 Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/auth/login` | 10 attempts | 15 minutes per IP |
| `POST /api/auth/forgot-password` | 3 requests | 1 hour per email |
| `POST /api/auth/impersonate` | 20 requests | 1 hour per ADMIN |
| All other non-GET | 100 requests | 1 hour per IP |

### 17.4 Tenant Isolation

- `tenantId` is set server-side at creation, never accepted from client.
- Queries always include `WHERE tenantId = :activeTenantId`.
- ClaimForge ADMIN (`*`) can bypass tenant filter.
- Cross-tenant access requires impersonation (logged in Activity).

---

## 18. Future Considerations

| Feature | Approach |
|---|---|
| OAuth / SSO | Add provider table — login redirect issues JWT |
| Webhook notifications | Event bus on Activity creation |
| Role builder UI | ADMIN creates roles via privilege checklist |
| MFA | TOTP as second factor |
| Per-claim email | `claim-<uuid>@claims.plpas.com` with auto-attachment |
| Client portal messaging | Threaded messages on claims |
| Cross-tenant company registry | Shared directory of carriers, lenders |
| Bulk operations | ADMIN can act as any member |
| Data export | Tenant admin exports all tenant data |
| Usage metering | Track records/storage per tenant for billing tiers |
| Subscription tiers | Hardcoded seat limits now → plan-based limits later |
