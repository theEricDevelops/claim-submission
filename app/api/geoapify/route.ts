import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { verifyRequest, unauthorizedResponse } from "@/lib/auth";

const VALID_ENDPOINTS = new Set(["autocomplete", "search"]);

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const endpoint = searchParams.get("endpoint");

  if (!endpoint || !VALID_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { success: false, error: "Invalid endpoint" },
      { status: 400 }
    );
  }

  const geoapifyUrl = new URL(`https://api.geoapify.com/v1/geocode/${endpoint}`);

  for (const [key, value] of searchParams.entries()) {
    if (key !== "endpoint") {
      geoapifyUrl.searchParams.set(key, value);
    }
  }

  geoapifyUrl.searchParams.set("apiKey", config.geoapifyApiKey);

  try {
    const response = await fetch(geoapifyUrl.toString());
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: "Geocoding service unavailable" },
      { status: 502 }
    );
  }
}
