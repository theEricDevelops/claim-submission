# API Reference

## Authentication

All protected endpoints accept three authentication methods, checked in order:

| Method | Mechanism | How To |
| -------- | ----------- | -------- |
| Session cookie | httpOnly JWT cookie named `session` | Auto-provisioned by `proxy.ts` on first page load |
| Bearer token | `Authorization: Bearer <API_SHARED_SECRET>` header | Programmatic / non-browser clients |
| API key | `x-api-key: <API_SHARED_SECRET>` header | Alternative for programmatic clients |

The session JWT is signed with HS256 using `SESSION_SECRET`. Cookie `maxAge` is 24 hours.
All protected endpoints return `401` with `{ "success": false, "error": "Unauthorized" }` when unauthenticated.

---

## `POST /api/claims`

Submit a claim and create a DocuSeal signing submission.

**Auth:** Required
**Rate limit:** 10 requests/hour/IP

### Request Body

```json
{
  "state": "TN",
  "namedInsureds": [
    {
      "type": "individual",
      "salutation": "Mr.",
      "firstName": "John",
      "middleName": "",
      "lastName": "Doe",
      "suffix": "",
      "companyName": "",
      "phone": "(555) 123-4567",
      "email": "john@example.com",
      "differentMailingAddress": false,
      "mailingAddress": {
        "formatted": "",
        "street": "",
        "street2": "",
        "city": "",
        "state": "",
        "zip": ""
      },
      "typeChosen": true
    }
  ],
  "propertyAddress": {
    "formatted": "123 Main St, Nashville, TN 37201",
    "street": "123 Main St",
    "street2": "",
    "city": "Nashville",
    "state": "TN",
    "zip": "37201"
  },
  "adjuster": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@pa-firm.com",
    "phone": "(555) 987-6543",
    "licenseNumber": "PA-12345",
    "mailingAddress": {
      "formatted": "456 Oak Ave, Suite 200, Nashville, TN 37203",
      "street": "456 Oak Ave",
      "street2": "Suite 200",
      "city": "Nashville",
      "state": "TN",
      "zip": "37203"
    }
  },
  "fieldValues": {
    "Date of Loss": "2025-01-15",
    "Type of Loss": "Water",
    "Insurance Carrier": "State Farm",
    "Policy Number": "POL-98765",
    "Claim Number": "CLM-12345",
    "Description of Loss": "Pipe burst in kitchen"
  }
}
```

### Field Reference

| Field | Type | Required | Notes |
| ------- | ------ | ---------- | ------- |
| `state` | string (2 chars) | Yes | US state code, uppercased automatically. Validated against 50 states + DC. |
| `namedInsureds` | array | Yes | 1–10 insured parties |
| `namedInsureds[].type` | `"individual"` \| `"company"` | Yes | |
| `namedInsureds[].salutation` | string (max 20) | No | |
| `namedInsureds[].firstName` | string (max 100) | No | |
| `namedInsureds[].middleName` | string (max 100) | No | |
| `namedInsureds[].lastName` | string (max 100) | No | |
| `namedInsureds[].suffix` | string (max 10) | No | |
| `namedInsureds[].companyName` | string (max 200) | No | |
| `namedInsureds[].phone` | string (max 30) | Yes | |
| `namedInsureds[].email` | string (max 254) | Yes | |
| `namedInsureds[].differentMailingAddress` | boolean | No | Default `false` |
| `namedInsureds[].mailingAddress` | AddressValue | No | Only used if `differentMailingAddress` is true |
| `propertyAddress` | AddressValue | Yes | Loss property address |
| `adjuster.firstName` | string (1–100) | Yes | |
| `adjuster.lastName` | string (1–100) | Yes | |
| `adjuster.email` | string (1–254) | Yes | |
| `adjuster.phone` | string (1–30) | Yes | |
| `adjuster.licenseNumber` | string (1–50) | Yes | |
| `adjuster.mailingAddress` | AddressValue | No | |
| `fieldValues` | `Record<string, string>` | No | Dynamic template field values |

**AddressValue shape:**

```json
{
  "formatted": "string (max 500)",
  "street": "string (max 200)",
  "street2": "string (max 200)",
  "city": "string (max 100)",
  "state": "string (max 2)",
  "zip": "string (max 10)"
}
```

### Submitter Role Mapping

| Index | Role Name | Email Source |
| ------- | ----------- | ------------- |
| 0 | `First Insured` | `namedInsureds[0].email` |
| 1 | `Second Insured` | `namedInsureds[1].email` |
| — | `Public Adjuster` | `adjuster.email` |

Template fields are distributed to submitters by matching `submitter_uuid` to the role name. Fields without a matching role are attached to the first submitter as `extraValues`.

### Success Response (200)

```json
{
  "success": true,
  "submission": {
    "id": 6,
    "submitters": [...]
  }
}
```

### Validation Error (400)

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "path": "state", "message": "Invalid US state code" }
  ]
}
```

### Template Not Found (400)

```json
{
  "success": false,
  "error": "No DocuSeal template configured for \"TN_1\". Create a template with name starting with \"TN_1 -\"."
}
```

### Internal Error (500)

```json
{
  "success": false,
  "error": "An internal error occurred"
}
```

---

## `POST /api/templates/fields`

Fetch DocuSeal template fields and submitters for a given state and insured count. Called by the client on step transitions (0→1 and 1→2) to validate template availability and render dynamic fields.

**Auth:** Required
**Rate limit:** 100 requests/hour/IP

### Template Fields Request Body

```json
{
  "state": "TN",
  "insuredCount": 1
}
```

### Validation Rules

| Field | Type | Rule |
| ------- | ------ | ------ |
| `state` | string | 2 chars, valid US state code, uppercased automatically |
| `insuredCount` | integer | 1–10 |

### Template Fields Success Response (200)

```json
{
  "success": true,
  "templateId": 2,
  "fields": [
    {
      "name": "Date of Loss",
      "type": "date",
      "required": true,
      "submitter_uuid": ""
    },
    {
      "name": "Type of Loss",
      "type": "text",
      "required": true,
      "submitter_uuid": ""
    }
  ],
  "submitters": [
    { "name": "First Insured", "uuid": "abc-123" },
    { "name": "Public Adjuster", "uuid": "def-456" }
  ]
}
```

### Error Responses

Same structure as `/api/claims`: `400` for validation or template not found, `500` for internal errors.

---

## `GET /api/geoapify`

Server-side proxy for the Geoapify Geocoding API. Keeps the API key server-side.

**Auth:** Required
**Rate limit:** None (GET request)

### Query Parameters

| Parameter | Required | Description |
| ----------- | ---------- | ------------- |
| `endpoint` | Yes | `autocomplete` or `search` |
| `text` | Yes* | Address search text (*required by Geoapify) |
| Any other param | No | Forwarded directly to Geoapify API |

### Example

```plain
GET /api/geoapify?endpoint=autocomplete&text=123%20Main%20St%20Nashville&limit=5
```

### Success Response

Returns the raw Geoapify API response (JSON).

### Error (400)

```json
{ "success": false, "error": "Invalid endpoint" }
```

### Error (502)

```json
{ "success": false, "error": "Geocoding service unavailable" }
```

The server injects `apiKey` automatically — do not include it in the client request.

---

## `GET /api/config`

Public configuration endpoint. Currently returns an empty object.

**Auth:** None
**Rate limit:** None

### Response (200)

```json
{}
```

---

## Rate Limiting

Applied in `proxy.ts` middleware for all non-GET API routes:

| Endpoint | Limit | Window |
| ---------- | ------- | -------- |
| `POST /api/claims` | 10 requests | 1 hour |
| `POST /api/templates/fields` | 100 requests | 1 hour |
| GET requests | Not rate limited | — |

Rate limiting is per-IP (uses `x-forwarded-for` or `x-real-ip` or `unknown`). When exceeded, returns `429` with a `Retry-After` header (seconds until reset) and body:

```json
{
  "success": false,
  "error": "Too many requests. Please try again later."
}
```

The rate limit map is in-memory (not persisted). Server restart clears all counters.

---

## DocuSeal Integration

### Template Resolution

Template IDs are resolved by name prefix matching:

```plain
Key format: {STATE}_{count}
Example:    TN_1 → matches template named "TN_1 - TN Public Adjuster Agreement Package (Single Insured)"
```

The prefix-to-ID mapping is fetched from DocuSeal's `listTemplates` endpoint on first call and cached in memory (`cachedPrefixMap`). Call `clearTemplateCache()` to force refresh.

### DocuSeal API Client

Configured in `lib/docuseal.ts` using `@docuseal/api`:

```ts
docuseal.configure({
  key: config.docuseal.apiKey,
  url: config.docuseal.apiUrl,  // default: https://sign.plpas.com/api
})
```

### Functions

| Function | Purpose |
| ---------- | --------- |
| `resolveTemplateId(state, count)` | Returns template ID for a state + insured count |
| `getTemplateFields(templateId)` | Returns array of `{ name, type, required, submitter_uuid }` |
| `getTemplateSubmitters(templateId)` | Returns array of `{ name, uuid }` |
| `createClaimSubmission({ templateId, submitters, sendEmail })` | Creates a DocuSeal submission |
| `clearTemplateCache()` | Clears the in-memory prefix map |
