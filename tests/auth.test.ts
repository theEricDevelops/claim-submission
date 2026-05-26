import { describe, it, expect, vi } from 'vitest'
import { createSessionJWT } from '@/lib/auth'

async function verifyRequest(
  overrides: { cookies?: Record<string, string>; bearerToken?: string; apiKeyHeader?: string },
) {
  const { verifyRequest: original } = await import('@/lib/auth')

  const headers = new Map<string, string>()
  if (overrides.bearerToken) headers.set('authorization', `Bearer ${overrides.bearerToken}`)
  if (overrides.apiKeyHeader) headers.set('x-api-key', overrides.apiKeyHeader)

  const mockRequest = {
    cookies: {
      get: (name: string) => {
        const val = overrides.cookies?.[name]
        return val ? { name, value: val } : undefined
      },
    },
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
  }

  return original(mockRequest as never)
}

describe('createSessionJWT', () => {
  it('returns a valid JWT string', async () => {
    const token = await createSessionJWT()
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)
  })
})

describe('verifyRequest with API key', () => {
  it('accepts Bearer token with correct API key', async () => {
    const result = await verifyRequest({ bearerToken: process.env.API_SHARED_SECRET! })
    expect(result.authenticated).toBe(true)
    expect(result.method).toBe('api-key')
  })

  it('rejects Bearer token with wrong API key', async () => {
    const result = await verifyRequest({ bearerToken: 'wrong-key' })
    expect(result.authenticated).toBe(false)
  })

  it('accepts x-api-key header with correct key', async () => {
    const result = await verifyRequest({ apiKeyHeader: process.env.API_SHARED_SECRET! })
    expect(result.authenticated).toBe(true)
    expect(result.method).toBe('api-key')
  })

  it('returns unauthorized for no credentials', async () => {
    const result = await verifyRequest({})
    expect(result.authenticated).toBe(false)
    expect(result.method).toBe(null)
  })
})

describe('verifyRequest with session JWT', () => {
  it('accepts a valid session JWT', async () => {
    const token = await createSessionJWT()
    const result = await verifyRequest({ cookies: { session: token } })
    expect(result.authenticated).toBe(true)
    expect(result.method).toBe('session')
  })

  it('rejects an invalid token', async () => {
    const result = await verifyRequest({ cookies: { session: 'not-a-valid-jwt' } })
    expect(result.authenticated).toBe(false)
  })
})
