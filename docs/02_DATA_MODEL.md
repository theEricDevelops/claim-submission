# Data Model

This document describes every model and relationship in the claim-submission Prisma schema
(`prisma/models/`). All models use UUID primary keys by convention.

---

## Enums

| Enum | Values |
|------|--------|
| `JobStatus` | `DRAFT`, `PENDING`, `ACTIVE`, `CLOSED` |
| `LeadStatus` | `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `LOST`, `CLOSED` |
| `ContactType` | `PERSON`, `COMPANY` |
| `JobRole` | `NAMED_INSURED`, `CARRIER_ADJUSTER`, `PUBLIC_ADJUSTER`, `ATTORNEY`, `APPRAISER`, `UMPIRE` |
| `ContractType` | `PA_AGREEMENT`, `CONTRACTOR_AGREEMENT`, `ATTORNEY_ENGAGEMENT`, `APPRAISAL_AGREEMENT`, `UMPIRE_ENGAGEMENT` |
| `FeeType` | `PERCENTAGE`, `FLAT_FEE`, `HOURLY` |
| `ContractStatus` | `DRAFT`, `SENT`, `SIGNED`, `ACTIVE`, `COMPLETED`, `TERMINATED` |
| `AssignmentStatus` | `ACTIVE`, `COMPLETED`, `REMOVED` |
| `NoteableType` | `JOB`, `LEAD`, `CONTACT`, `PERSON`, `COMPANY`, `DOCUMENT`, `CONTRACT` |
| `DocumentCategory` | `PHOTO`, `ESTIMATE`, `POLICY`, `REPORT`, `CORRESPONDENCE`, `INVOICE`, `OTHER` |
| `ActivityType` | `EMAIL`, `PHONE`, `TEXT`, `MEETING`, `RECORD` |
| `ActivityAction` | `CREATED`, `EDITED`, `DELETED`, `COMPLETED`, `DESTROYED` |
| `EmailTarget` | `JOB`, `LEAD`, `CONTACT` |

---

## Entity Relationship Diagram (Text)

```
Tenant ──1:M──> Member (via TenantMembers)
Tenant ──1:M──> Member (via TenantAdmins)
Tenant ──1:M──> User   (via TenantUsers)
Tenant ──1:1──> TenantConfig
Tenant ──1:M──> TenantRole
Tenant ──1:M──> TenantInvite

User ──1:1──> Person
User ──M:M──> Tenant (via TenantUsers)
User ──1:M──> TenantRole

Member ──1:1──> Person
Member ──M:M──> Tenant (via TenantMembers / TenantAdmins)
Member ──M:M──> TenantRole
Member ──1:M──> Contract (as provider)

Person ──1:1──> Contact?
Person ──1:1──> Member?
Person ──1:1──> User?
Person ──1:M──> CompanyContact
Person ──1:M──> Note (as author)
Person ──1:M──> Activity (as actor)

Company ──1:1──> Contact?
Company ──1:M──> CompanyContact
Company ──1:M──> Policy (as carrier)
Company ──M:M──> Policy (as lender)   [implicit, via LenderOnPolicies]

CompanyContact ──M:1──> Company
CompanyContact ──M:1──> Person

Contact ──1:1──> Person?   (if type = PERSON)
Contact ──1:1──> Company?  (if type = COMPANY)
Contact ──1:M──> Phone
Contact ──1:M──> Email (email addresses)
Contact ──1:M──> Address
Contact ──1:M──> Document (as uploader)
Contact ──1:M──> AssignmentContact
Contact ──M:M──> Contract (as client)

Policy ──M:1──> Company (as carrier)
Policy ──M:M──> Company (as lender)
Policy ──1:M──> Job
Policy ──1:M──> Lead

Job ──M:1──> Policy
Job ──1:1──> Address (loss address)
Job ──1:M──> AssignmentContact
Job ──1:M──> Contract
Job ──1:M──> Document

Lead ──M:1──> Policy
Lead ──1:1──> Address (loss address)
Lead ──1:M──> AssignmentContact
Lead ──1:M──> Contract
Lead ──1:M──> Document

AssignmentContact ──M:1──> Job?
AssignmentContact ──M:1──> Lead?
AssignmentContact ──M:1──> Contact

Contract ──M:1──> Job?
Contract ──M:1──> Lead?
Contract ──M:M──> Contact (as clients)
Contract ──M:1──> Member (as provider)

Document ──M:1──> Job?
Document ──M:1──> Lead?
Document ──M:1──> Contact (uploader)

Note (polymorphic on noteableType + noteableId)
  ──M:1──> Person (author)

Activity (polymorphic on activityType + activityId)
  ──M:1──> Person (actor)

EmailMessage (polymorphic on targetType + targetId)
```

---

## Models

---

### Tenant (Multi-Tenant Root)

The top-level organizational boundary. Everything in the system belongs to a tenant.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| name | `string` (unique) | Company / org name |
| subdomain | `string` (unique) | Subdomain for tenant routing |
| secretKey | `string` (unique) | API secret for the tenant |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `members` | **1 → M** | `Member` (TenantMembers) | People who are members of this tenant |
| `admins` | **1 → M** | `Member` (TenantAdmins) | People who are admins of this tenant |
| `users` | **1 → M** | `User` (TenantUsers) | Login accounts scoped to this tenant |
| `config` | **1 → 1** | `TenantConfig` | Tenant branding / config settings |
| `tenantRoles` | **1 → M** | `TenantRole` | Custom roles defined in this tenant |
| `invites` | **1 → M** | `TenantInvite` | Pending invitations for this tenant |

---

### TenantConfig

One-to-one configuration record for a tenant.

| Field | Type | Notes |
|-------|------|-------|
| tenantId | `uuid` (PK, FK → Tenant) | Cascading delete |
| primaryColor | `string` | Brand color |
| secondaryColor | `string` | Brand color |
| phoneTypes | `string[]` | Default: `["home","work","cell","fax","other"]` |
| emailTypes | `string[]` | Default: `["home","work","other"]` |
| addressTypes | `string[]` | Default: `["home","work","mailing","other"]` |

---

### TenantRole

A role within a tenant (e.g., "Admin", "Adjuster", "Viewer").

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| tenantId | `uuid` (FK → Tenant) | Cascading delete |
| name | `string` | Display name |
| slug | `string` | Machine-readable identifier |
| privileges | `string[]` | Permission keys |

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `tenant` | **M → 1** `Tenant` | Owning tenant |
| `members` | **1 → M** `Member` | Members assigned this role |
| `users` | **1 → M** `User` | Users assigned this role |

---

### TenantInvite

A pending invitation for someone to join a tenant.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| tenantId | `uuid` (FK → Tenant) | |
| email | `string` | Not unique — same email can be invited by multiple tenants |

---

### User

A login account. Tied to a Person (1:1). Can belong to multiple Tenants.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| name | `string` (unique) | Username |
| passwordHasdh | `string` | Hashed password (note: typo in schema) |
| email | `string` (unique) | |
| personId | `uuid` (FK → Person, unique) | Cascading delete |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `person` | **1 → 1** | `Person` | The person this user account represents |
| `tenants` | **M → M** | `Tenant[]` (TenantUsers) | Tenants the user belongs to |
| `roles` | **1 → M** | `TenantRole[]` | Roles assigned to this user |

---

### Member

A person who acts as a provider/employee within a tenant (e.g., a public adjuster).

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| personId | `uuid` (FK → Person, unique) | Cascading delete |
| memberUserName | `string` (unique) | Login username for member portal |
| passwordHash | `string` | Hashed password |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `person` | **1 → 1** | `Person` | The person record |
| `memberOnTenants` | **M → M** | `Tenant[]` (TenantMembers) | Tenants this member belongs to |
| `adminOnTenants` | **M → M** | `Tenant[]` (TenantAdmins) | Tenants this member administers |
| `roles` | **M → M** | `TenantRole[]` | Roles assigned to this member |
| `contracts` | **1 → M** | `Contract[]` | Contracts where this member is the provider |

---

### Person

A natural person with a name. Can optionally be linked to a Contact, Member, and/or User.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| salutation | `string` (VARCHAR(25)) | Mr., Mrs., Dr., etc. |
| firstName | `string` (VARCHAR(65)) | |
| middleName | `string?` (VARCHAR(65)) | |
| lastName | `string` (VARCHAR(65)) | |
| suffix | `string?` (VARCHAR(25)) | Jr., III, etc. |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `contact` | **1 → 1?** | `Contact` | Universal contact record (if this person is a known contact) |
| `member` | **1 → 1?** | `Member` | Member account (if this person is a provider) |
| `user` | **1 → 1?** | `User` | User login (if this person has a login) |
| `companyContacts` | **1 → M** | `CompanyContact[]` | Jobs/positions at companies |
| `authoredNotes` | **1 → M** | `Note[]` | Notes written by this person |
| `activities` | **1 → M** | `Activity[]` | Activities logged by this person |

---

### Company

An organization (e.g., an insurance carrier, a lender, or a vendor).

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| name | `string` (unique) | Company name |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `contact` | **1 → 1?** | `Contact` | Universal contact record |
| `contacts` | **1 → M** | `CompanyContact[]` | People employed at / associated with this company |
| `carrierOnPolicies` | **1 → M** | `Policy[]` (CarrierOnPolicies) | Policies where this company is the carrier |
| `lenderOnPolicies` | **M → M** | `Policy[]` (LenderOnPolicies) | Policies where this company is a lender |

---

### CompanyContact

Join table linking a Person to a Company (employment / affiliation).

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| companyId | `uuid` (FK → Company) | Cascading delete |
| contactId | `uuid` (FK → Person) | Cascading delete |
| jobTitle | `string?` | Role at the company |

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `company` | **M → 1** `Company` | The company |
| `contact` | **M → 1** `Person` | The person |

---

### Contact

A universal contact record that can represent either a **Person** or a **Company** (discriminated by `type`).

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| type | `ContactType` | `PERSON` or `COMPANY` |
| name | `string` | Display name (company name or person name composite) |
| personId | `uuid?` (unique, FK → Person) | Set when `type = PERSON`. SetNull on delete |
| companyId | `uuid?` (unique, FK → Company) | Set when `type = COMPANY`. SetNull on delete |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `person` | **1 → 1?** | `Person` | Detailed person record |
| `company` | **1 → 1?** | `Company` | Detailed company record |
| `phones` | **1 → M** | `Phone[]` | Phone numbers |
| `emails` | **1 → M** | `Email[]` | Email addresses |
| `addresses` | **1 → M** | `Address[]` | Physical addresses |
| `uploadedDocs` | **1 → M** | `Document[]` | Documents uploaded by this contact |
| `assignmentContacts` | **1 → M** | `AssignmentContact[]` | Job/Lead assignments |
| `contracts` | **M → M** | `Contract[]` | Contracts where this contact is a client |

---

### Phone

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| phoneContactId | `uuid` (FK → Contact) | Cascading delete |
| country | `string` (VARCHAR(3)) | Country code |
| number | `string` (VARCHAR(10)) | Phone number |
| type | `string` (VARCHAR(25)) | home, work, cell, etc. |

---

### Email

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| emailContactId | `uuid` (FK → Contact) | Cascading delete |
| text | `string` (unique) | The email address |
| type | `string` (VARCHAR(25)) | home, work, etc. |

---

### Address

Used both as a contact address (via `contactId`) and as a loss address (referenced by Job and Lead).

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| contactId | `uuid?` (FK → Contact) | Cascading delete; null when used purely as a loss address |
| street | `string` | |
| street2 | `string?` | |
| city | `string` | |
| state | `string` | |
| zip | `string` (VARCHAR(5)) | |
| plus4 | `string?` (VARCHAR(4)) | ZIP+4 extension |
| type | `string` (VARCHAR(25)) | home, work, mailing, loss, etc. |

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `contact` | **M → 1?** `Contact` | The contact this address belongs to (optional) |
| `jobs` | **1 → M** `Job[]` | Jobs using this as their loss address |
| `leads` | **1 → M** `Lead[]` | Leads using this as their loss address |

---

### Policy

An insurance policy associated with a claim.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| policyNumber | `string` | |
| claimNumber | `string?` | |
| dateOfLoss | `DateTime?` | |
| typeOfLoss | `string?` | |
| deductible | `float?` | |
| coverageLimits | `Json?` | Flexible coverage limit structure |
| carrierId | `uuid` (FK → Company) | Carrier company |
| policyEffectiveDate | `DateTime?` | |
| policyExpirationDate | `DateTime?` | |
| createdAt | `DateTime` | Auto |
| updatedAt | `DateTime` | Auto |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `carrier` | **M → 1** | `Company` (CarrierOnPolicies) | The insurance carrier |
| `lender` | **M → M** | `Company[]` (LenderOnPolicies) | Mortgagee / lender companies |
| `jobs` | **1 → M** | `Job[]` | Jobs under this policy |
| `leads` | **1 → M** | `Lead[]` | Leads under this policy |

---

### Job

An active claim/job. Created when a Lead is converted, or created directly.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| status | `JobStatus` | Default: `DRAFT` |
| policyId | `uuid` (FK → Policy) | Restrict on delete |
| lossAddressId | `uuid` (unique, FK → Address) | Loss location; unique because each job has exactly one loss address |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `policy` | **M → 1** | `Policy` | The related insurance policy |
| `lossAddress` | **1 → 1** | `Address` | Loss location address |
| `assignmentContacts` | **1 → M** | `AssignmentContact[]` | Contacts assigned to this job with roles |
| `contracts` | **1 → M** | `Contract[]` | Contracts for this job |
| `documents` | **1 → M** | `Document[]` | Documents for this job |

---

### Lead

A sales lead / potential claim.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| status | `LeadStatus` | Default: `NEW` |
| policyId | `uuid` (FK → Policy) | Restrict on delete |
| lossAddressId | `uuid` (unique, FK → Address) | Loss location |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `policy` | **M → 1** | `Policy` | The related insurance policy |
| `lossAddress` | **1 → 1** | `Address` | Loss location address |
| `assignmentContacts` | **1 → M** | `AssignmentContact[]` | Contacts assigned to this lead with roles |
| `contracts` | **1 → M** | `Contract[]` | Contracts for this lead |
| `documents` | **1 → M** | `Document[]` | Documents for this lead |

---

### AssignmentContact

A polymorphic join table that assigns a **Contact** to either a **Job** or a **Lead** with a specific **role** and **status**.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| jobId | `uuid?` (FK → Job) | Nullable — set when assigned to a Job |
| leadId | `uuid?` (FK → Lead) | Nullable — set when assigned to a Lead |
| contactId | `uuid` (FK → Contact) | The contact being assigned |
| role | `JobRole` | `NAMED_INSURED`, `CARRIER_ADJUSTER`, etc. |
| status | `AssignmentStatus` | `ACTIVE`, `COMPLETED`, `REMOVED` |
| assignedAt | `DateTime` | Default: `now()` |
| removedAt | `DateTime?` | When the assignment was removed |

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `job` | **M → 1?** `Job` | The job this assignment belongs to |
| `lead` | **M → 1?** `Lead` | The lead this assignment belongs to |
| `contact` | **M → 1** `Contact` | The contact being assigned |

---

### Contract

An agreement (e.g., Public Adjuster Agreement) between a provider (`Member`) and one or more clients (`Contact[]`). Can belong to either a Job or a Lead.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| jobId | `uuid?` (FK → Job) | Nullable |
| leadId | `uuid?` (FK → Lead) | Nullable |
| providerId | `uuid` (FK → Member) | The provider (e.g., public adjuster) |
| type | `ContractType` | `PA_AGREEMENT`, `CONTRACTOR_AGREEMENT`, etc. |
| feeType | `FeeType` | `PERCENTAGE`, `FLAT_FEE`, `HOURLY` |
| feeValue | `float` | The fee amount / percentage |
| status | `ContractStatus` | Default: `DRAFT` |
| submissionId | `string?` | External DocuSeal submission ID |
| signedAt | `DateTime?` | |
| effectiveAt | `DateTime?` | |
| terminatedAt | `DateTime?` | |
| createdAt | `DateTime` | Auto |
| updatedAt | `DateTime` | Auto |

**Relationships**

| Relation | Type | Via | Description |
|----------|------|-----|-------------|
| `job` | **M → 1?** `Job` | The job this contract belongs to |
| `lead` | **M → 1?** `Lead` | The lead this contract belongs to |
| `clients` | **M → M** | `Contact[]` | The client(s) signing the contract |
| `provider` | **M → 1** | `Member` | The provider (firm member) executing the contract |

---

### Document

A file uploaded and associated with a Job or Lead.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| jobId | `uuid?` (FK → Job) | Cascading delete |
| leadId | `uuid?` (FK → Lead) | Cascading delete |
| uploadedById | `uuid` (FK → Contact) | Who uploaded it. Restrict on delete |
| fileName | `string` | Original filename |
| mimeType | `string?` | MIME type |
| fileSize | `int?` | Size in bytes |
| storageKey | `string` | Key in object storage |
| category | `DocumentCategory` | `PHOTO`, `ESTIMATE`, `POLICY`, etc. |
| createdAt | `DateTime` | Auto |

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `job` | **M → 1?** `Job` | The job this document belongs to |
| `lead` | **M → 1?** `Lead` | The lead this document belongs to |
| `uploadedBy` | **M → 1** `Contact` | The contact who uploaded the document |

---

### Note (Polymorphic)

A note attached to any of several entity types (`NoteableType`).

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| noteableType | `NoteableType` | `JOB`, `LEAD`, `CONTACT`, `PERSON`, `COMPANY`, `DOCUMENT`, `CONTRACT` |
| noteableId | `uuid` | ID of the entity this note belongs to |
| authorId | `uuid` (FK → Person) | The person who wrote the note |
| body | `string` | Note content |
| createdAt | `DateTime` | Auto |
| updatedAt | `DateTime` | Auto |

**Index:** `(noteableType, noteableId)` for efficient polymorphic lookups.

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `author` | **M → 1** `Person` | The person who authored the note |

---

### Activity (Polymorphic)

A log entry recording an action performed by a Person on some entity.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| activityType | `ActivityType` | `EMAIL`, `PHONE`, `TEXT`, `MEETING`, `RECORD` |
| activityId | `uuid` | ID of the entity the activity is about |
| actionType | `ActivityAction` | `CREATED`, `EDITED`, `DELETED`, `COMPLETED`, `DESTROYED` |
| actorId | `uuid` (FK → Person) | The person who performed the action |

**Index:** `(activityType, activityId)` for efficient polymorphic lookups.

**Relationships**

| Relation | Type | Description |
|----------|------|-------------|
| `actor` | **M → 1** `Person` | The person who performed the activity |

---

### EmailMessage (Polymorphic)

A record of an email sent to or from an entity.

| Field | Type | Notes |
|-------|------|-------|
| id | `uuid` (PK) | |
| from | `string` | Sender email |
| to | `string[]` | Recipients |
| cc | `string[]` | CC recipients |
| bcc | `string[]` | BCC recipients |
| subject | `string` | |
| body | `string` | |
| targetId | `uuid` | ID of the target entity |
| targetType | `EmailTarget` | `JOB`, `LEAD`, `CONTACT` |

---

## Relationship Summary

| # | Model A | Relationship | Model B | Notes |
|---|---------|-------------|---------|-------|
| 1 | `Tenant` | 1 → M | `Member` | Via `TenantMembers` |
| 2 | `Tenant` | 1 → M | `Member` | Via `TenantAdmins` |
| 3 | `Tenant` | 1 → M | `User` | Via `TenantUsers` |
| 4 | `Tenant` | 1 → 1 | `TenantConfig` | |
| 5 | `Tenant` | 1 → M | `TenantRole` | |
| 6 | `Tenant` | 1 → M | `TenantInvite` | |
| 7 | `User` | 1 → 1 | `Person` | Unique FK |
| 8 | `User` | M → M | `Tenant` | Via `TenantUsers` |
| 9 | `User` | 1 → M | `TenantRole` | |
| 10 | `Member` | 1 → 1 | `Person` | Unique FK |
| 11 | `Member` | M → M | `Tenant` | Via `TenantMembers` / `TenantAdmins` |
| 12 | `Member` | M → M | `TenantRole` | |
| 13 | `Member` | 1 → M | `Contract` | As provider |
| 14 | `Person` | 1 → 1? | `Contact` | Optional |
| 15 | `Person` | 1 → 1? | `Member` | Optional |
| 16 | `Person` | 1 → 1? | `User` | Optional |
| 17 | `Person` | 1 → M | `CompanyContact` | |
| 18 | `Person` | 1 → M | `Note` | As author |
| 19 | `Person` | 1 → M | `Activity` | As actor |
| 20 | `Company` | 1 → 1? | `Contact` | Optional |
| 21 | `Company` | 1 → M | `CompanyContact` | |
| 22 | `Company` | 1 → M | `Policy` | As carrier |
| 23 | `Company` | M → M | `Policy` | As lender |
| 24 | `CompanyContact` | M → 1 | `Company` | |
| 25 | `CompanyContact` | M → 1 | `Person` | |
| 26 | `Contact` | 1 → 1? | `Person` | If type = PERSON |
| 27 | `Contact` | 1 → 1? | `Company` | If type = COMPANY |
| 28 | `Contact` | 1 → M | `Phone` | |
| 29 | `Contact` | 1 → M | `Email` | |
| 30 | `Contact` | 1 → M | `Address` | |
| 31 | `Contact` | 1 → M | `Document` | As uploader |
| 32 | `Contact` | 1 → M | `AssignmentContact` | |
| 33 | `Contact` | M → M | `Contract` | As client |
| 34 | `Policy` | M → 1 | `Company` | As carrier |
| 35 | `Policy` | M → M | `Company` | As lender |
| 36 | `Policy` | 1 → M | `Job` | |
| 37 | `Policy` | 1 → M | `Lead` | |
| 38 | `Job` | M → 1 | `Policy` | |
| 39 | `Job` | 1 → 1 | `Address` | Loss address (unique) |
| 40 | `Job` | 1 → M | `AssignmentContact` | |
| 41 | `Job` | 1 → M | `Contract` | |
| 42 | `Job` | 1 → M | `Document` | |
| 43 | `Lead` | M → 1 | `Policy` | |
| 44 | `Lead` | 1 → 1 | `Address` | Loss address (unique) |
| 45 | `Lead` | 1 → M | `AssignmentContact` | |
| 46 | `Lead` | 1 → M | `Contract` | |
| 47 | `Lead` | 1 → M | `Document` | |
| 48 | `AssignmentContact` | M → 1? | `Job` | |
| 49 | `AssignmentContact` | M → 1? | `Lead` | |
| 50 | `AssignmentContact` | M → 1 | `Contact` | |
| 51 | `Contract` | M → 1? | `Job` | |
| 52 | `Contract` | M → 1? | `Lead` | |
| 53 | `Contract` | M → M | `Contact` | As clients |
| 54 | `Contract` | M → 1 | `Member` | As provider |
| 55 | `Document` | M → 1? | `Job` | |
| 56 | `Document` | M → 1? | `Lead` | |
| 57 | `Document` | M → 1 | `Contact` | As uploader |
| 58 | `Note` | M → 1 | `Person` | As author; polymorphic target |
| 59 | `Activity` | M → 1 | `Person` | As actor; polymorphic target |
| 60 | `EmailMessage` | polymorphic | Job / Lead / Contact | Via targetType + targetId |
