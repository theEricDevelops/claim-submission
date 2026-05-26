import docuseal from "@docuseal/api";
import { config } from "./config";

docuseal.configure({
  key: config.docuseal.apiKey,
  url: config.docuseal.apiUrl,
});

let cachedPrefixMap: Record<string, number> | null = null;

async function buildPrefixMap(): Promise<Record<string, number>> {
  if (cachedPrefixMap) return cachedPrefixMap;

  const response = await docuseal.listTemplates();
  const templates: Array<{ id: number; name: string }> = response?.data ?? [];
  const map: Record<string, number> = {};

  for (const t of templates) {
    const prefix = t.name.split(" - ")[0].trim();
    if (prefix) {
      map[prefix] = t.id;
    }
  }

  cachedPrefixMap = map;
  return map;
}

export function clearTemplateCache(): void {
  cachedPrefixMap = null;
}

export async function resolveTemplateId(
  state: string,
  namedInsuredsCount: number
): Promise<number> {
  const key = `${state.toUpperCase()}_${namedInsuredsCount}`;
  const map = await buildPrefixMap();
  const id = map[key];

  if (!id) {
    throw new Error(
      `No DocuSeal template configured for "${state}" with ${namedInsuredsCount} named insured(s). ` +
        `Create a template with name starting with "${state.toUpperCase()}_${namedInsuredsCount} -"`
    );
  }
  return id;
}

export async function getTemplateFields(
  templateId: number
): Promise<Array<{ name: string; type: string; required: boolean; submitter_uuid: string }>> {
  try {
    const response = await docuseal.getTemplate(templateId);
    const fields: Array<{ name: string; type: string; required: boolean; submitter_uuid: string }> = [];
    if (response?.fields && Array.isArray(response.fields)) {
      for (const f of response.fields) {
        fields.push({
          name: f.name || "",
          type: f.type || "text",
          required: f.required || false,
          submitter_uuid: f.submitter_uuid || "",
        });
      }
    }
    return fields;
  } catch {
    return [];
  }
}

export async function getTemplateSubmitters(
  templateId: number
): Promise<Array<{ name: string; uuid: string }>> {
  try {
    const response = await docuseal.getTemplate(templateId);
    return response?.submitters ?? [];
  } catch {
    return [];
  }
}

export async function createClaimSubmission(params: {
  templateId: number;
  submitters: Array<{ email: string; role: string; values?: Record<string, string> }>;
  sendEmail?: boolean;
}) {
  return docuseal.createSubmission({
    template_id: params.templateId,
    send_email: params.sendEmail ?? true,
    submitters: params.submitters,
  });
}
