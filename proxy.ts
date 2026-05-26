import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSessionJWT } from "@/lib/auth";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits: Map<string, RateLimitEntry> = new Map();

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now >= entry.resetAt) {
      rateLimits.delete(key);
    }
  }
}

const CLAIMS_LIMIT = 10;
const CLAIMS_WINDOW_MS = 60 * 60 * 1000;

const TEMPLATES_LIMIT = 100;
const TEMPLATES_WINDOW_MS = 60 * 60 * 1000;

const DEFAULT_API_LIMIT = 200;
const DEFAULT_WINDOW_MS = 60 * 1000;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    cleanupRateLimits();

    let maxRequests: number;
    let windowMs: number;

    if (pathname === "/api/claims" && request.method === "POST") {
      maxRequests = CLAIMS_LIMIT;
      windowMs = CLAIMS_WINDOW_MS;
    } else if (request.method !== "GET") {
      maxRequests = TEMPLATES_LIMIT;
      windowMs = TEMPLATES_WINDOW_MS;
    } else {
      maxRequests = DEFAULT_API_LIMIT;
      windowMs = DEFAULT_WINDOW_MS;
    }

    const key = getRateLimitKey(request);
    const now = Date.now();
    const entry = rateLimits.get(key);

    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > maxRequests) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) },
          }
        );
      }
    } else {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    }
  }

  try {
    if (!request.cookies.has("session")) {
      const token = await createSessionJWT();
      const response = NextResponse.next();
      response.cookies.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
      return response;
    }
  } catch (err) {
    console.error("Session creation failed:", err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
