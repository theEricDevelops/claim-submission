import { jwtVerify, SignJWT } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { config } from './config'

const SESSION_COOKIE = 'session'
const SESSION_DURATION_SECONDS = 60 * 60 * 24

function getSecret(): Uint8Array {
  if (!config.sessionSecret) {
    throw new Error('SESSION_SECRET not configured')
  }
  return new TextEncoder().encode(config.sessionSecret)
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export async function createSessionJWT(): Promise<string> {
  return new SignJWT({ sub: generateId() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret())
}

interface SessionPayload {
  sub: string
  iat: number
  exp: number
}

async function verifySessionJWT(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export interface AuthResult {
  authenticated: boolean
  method: 'session' | 'api-key' | null
}

export async function verifyRequest(request: NextRequest): Promise<AuthResult> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)
  if (sessionCookie) {
    const payload = await verifySessionJWT(sessionCookie.value)
    if (payload) return { authenticated: true, method: 'session' }
  }

  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (apiKey && apiKey === config.sharedApiKey) {
    return { authenticated: true, method: 'api-key' }
  }

  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader && apiKeyHeader === config.sharedApiKey) {
    return { authenticated: true, method: 'api-key' }
  }

  return { authenticated: false, method: null }
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}
