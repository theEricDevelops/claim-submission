import type {
  ClaimFormData,
  TemplateFieldsResponse,
} from "../types";

export interface ClaimResponse {
  success: boolean;
  submission?: unknown;
  error?: string;
}

export async function fetchTemplateFields(
  state: string,
  insuredCount: number
): Promise<TemplateFieldsResponse> {
  const res = await fetch("/api/templates/fields", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, insuredCount }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.error || `Server error: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

export async function submitClaim(
  data: ClaimFormData
): Promise<ClaimResponse> {
  const res = await fetch("/api/claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.error || `Server error: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}
