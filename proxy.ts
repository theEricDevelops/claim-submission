import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSessionJWT } from '@/lib/auth'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimits: Map<string, RateLimitEntry> = new Map()

function getRateLimitKey(request: NextRequest, category: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `${ip}:${category}`
}

function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, entry] of rateLimits) {
    if (now >= entry.resetAt) {
      rateLimits.delete(key)
    }
  }
}

const CLAIMS_LIMIT = 10
const CLAIMS_WINDOW_MS = 60 * 60 * 1000

const TEMPLATES_LIMIT = 100
const TEMPLATES_WINDOW_MS = 60 * 60 * 1000

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/') && request.method !== 'GET') {
    cleanupRateLimits()

    const isClaims = pathname === '/api/claims' && request.method === 'POST'
    const maxRequests = isClaims ? CLAIMS_LIMIT : TEMPLATES_LIMIT
    const windowMs = isClaims ? CLAIMS_WINDOW_MS : TEMPLATES_WINDOW_MS
    const category = isClaims ? 'claims' : 'templates'

    const key = getRateLimitKey(request, category)
    const now = Date.now()
    const entry = rateLimits.get(key)

    if (entry && now < entry.resetAt) {
      entry.count++
      if (entry.count > maxRequests) {
        return NextResponse.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) },
          }
        )
      }
    } else {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs })
    }
  }

  try {
    if (!request.cookies.has('session')) {
      const token = await createSessionJWT()
      const response = NextResponse.next()
      response.cookies.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
      return response
    }
  } catch (_err) {}

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/api/:path*'],
}
