import docuseal from "@docuseal/api";
import { config } from "../config";

export function initDocuseal(): void {
  docuseal.configure({
    key: config.docuseal.apiKey,
    url: config.docuseal.apiUrl,
  });
}

export function getTemplateKey(
  state: string,
  namedInsuredsCount: number
): string {
  return `${state.toUpperCase()}_${namedInsuredsCount}`;
}

export function resolveTemplateId(
  state: string,
  namedInsuredsCount: number
): number {
  const key = getTemplateKey(state, namedInsuredsCount);
  const id = config.docuseal.templateMapping[key];
  if (!id) {
    throw new Error(
      `No DocuSeal template configured for "${key}". ` +
        `Add an entry to template-mapping.json like "${key}": <template_id>`
    );
  }
  return id;
}

export async function getTemplateFields(
  templateId: number
): Promise<Array<{ name: string; type: string; required: boolean }>> {
  try {
    const response = await docuseal.getTemplate(templateId);
    const fields: Array<{ name: string; type: string; required: boolean }> = [];
    if (response?.fields && Array.isArray(response.fields)) {
      for (const f of response.fields) {
        fields.push({
          name: f.name || "",
          type: f.type || "text",
          required: f.required || false,
        });
      }
    }
    return fields;
  } catch {
    return [];
  }
}

export async function createClaimSubmission(params: {
  templateId: number;
  submitters: Array<{ email: string; role: string }>;
  variables: Record<string, string>;
  sendEmail?: boolean;
}) {
  return docuseal.createSubmission({
    template_id: params.templateId,
    send_email: params.sendEmail ?? true,
    submitters: params.submitters,
    variables: params.variables,
  });
}
