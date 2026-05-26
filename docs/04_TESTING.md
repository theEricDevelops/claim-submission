# Testing Strategy

## Overview

No test runner is currently configured. This document defines the testing strategy and conventions to follow when adding tests.

**Recommended stack:** Vitest (unit/integration) + Playwright (e2e)

---

## Test Categories

| Layer | Tool | Scope | What to Test |
|-------|------|-------|-------------|
| Unit | Vitest | Pure functions | Validation schemas, type helpers, config parsing |
| Integration | Vitest | API routes | Request/response shapes, auth failures, template resolution |
| Integration | Vitest | Services | DocuSeal wrapper, auth token verification |
| E2E | Playwright | Browser flow | Multi-step form, address autocomplete, submission |
| E2E | Playwright | Visual | Dark mode toggle, responsive layout |

---

## Unit Testing

### What to test

- **`lib/validation.ts`**: Zod schema edge cases — invalid states, missing fields, boundary values
- **`types/index.ts`**: `isValidPhone`, `isValidEmail`, `formatPhone`, `emptyAddress`, `emptyInsured`
- **`lib/config.ts`**: Config object shape with various env var combinations

### File naming convention

```
lib/__tests__/validation.test.ts
types/__tests__/helpers.test.ts
```

### Example test pattern

```ts
import { describe, it, expect } from 'vitest'
import { isValidPhone, isValidEmail } from '@/types'

describe('isValidPhone', () => {
  it('accepts 10-digit phone', () => {
    expect(isValidPhone('(555) 123-4567')).toBe(true)
  })

  it('rejects short number', () => {
    expect(isValidPhone('555-1234')).toBe(false)
  })
})
```

---

## Integration Testing

### What to test

- **`POST /api/claims`**: Full submission flow, validation errors, template not found, auth failures
- **`POST /api/templates/fields`**: State validation, insured count validation, template resolution
- **`GET /api/geoapify`**: Endpoint validation, proxy behavior, auth
- **`GET /api/config`**: Public access, response shape
- **`lib/auth.ts`**: Session JWT creation and verification, API key matching
- **`lib/docuseal.ts`**: Template resolution with mocked DocuSeal API

### File naming convention

```
app/api/__tests__/claims.test.ts
lib/__tests__/auth.test.ts
lib/__tests__/docuseal.test.ts
```

### Mocking strategy

#### External APIs

```ts
// Mock DocuSeal API responses
import docuseal from '@docuseal/api'
vi.mock('@docuseal/api')

// Mock Geoapify fetch
const mockFetch = vi.fn()
global.fetch = mockFetch
```

#### Prisma

```ts
// Use a test database or mock
vi.mock('@/lib/db', () => ({
  prisma: {
    claim: { create: vi.fn(), findMany: vi.fn() },
    // ...
  }
}))
```

#### NextRequest

Use `NextRequest` directly or create mock request objects:

```ts
const request = new NextRequest('http://localhost:3000/api/claims', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(validPayload),
})
```

### Testing authenticated routes

```ts
// Set up session cookie
const request = new NextRequest('http://localhost:3000/api/claims', {
  method: 'POST',
  headers: { cookie: `session=${validJwt}` },
  body: JSON.stringify(validPayload),
})
```

Or use `x-api-key`:

```ts
const request = new NextRequest('http://localhost:3000/api/claims', {
  method: 'POST',
  headers: { 'x-api-key': process.env.API_SHARED_SECRET! },
  body: JSON.stringify(validPayload),
})
```

---

## E2E Testing

### What to test (with Playwright)

- **Full form flow**: Step 0 → Step 4 submission
- **Address autocomplete**: Interaction with Geoapify (may need to mock)
- **Validation**: Error messages on blur, Next button blocking
- **Insured add/remove**: Adding second insured, removing one
- **Dark mode**: Toggle and persistence
- **Responsive**: Mobile layout

### File naming convention

```
e2e/claim-form.spec.ts
e2e/theme.spec.ts
```

### Example structure

```ts
import { test, expect } from '@playwright/test'

test('completes full form flow', async ({ page }) => {
  await page.goto('/')
  // Step 0: Enter address
  // Step 1: Enter insured info
  // Step 2: Fill template fields
  // Step 3: Enter adjuster info
  // Step 4: Review and submit
  await expect(page.getByText('Success')).toBeVisible()
})
```

---

## Vitest Configuration

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

### Setup file (`vitest.setup.ts`)

```ts
import { loadEnvConfig } from '@next/env'
import { beforeAll } from 'vitest'

beforeAll(() => {
  loadEnvConfig(process.cwd())
})
```

---

## Test Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## Coverage Goals

| Area | Target |
|------|--------|
| `lib/validation.ts` | 100% (pure logic, no deps) |
| `types/index.ts` | 100% (helpers, constants) |
| `lib/auth.ts` | 90% (JWT, API key verification) |
| `lib/config.ts` | 100% (env var loading) |
| `app/api/*/route.ts` | 80% (happy path + error cases) |
| `lib/docuseal.ts` | 80% (with mocked SDK) |
| `components/*.tsx` | 70% (renders + interactions) |

---

## CI Integration

Recommended GitHub Actions workflow:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 'lts/*' }
      - run: pnpm install
      - run: pnpm prisma generate
      - run: pnpm test
```
