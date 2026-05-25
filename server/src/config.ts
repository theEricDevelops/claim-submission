import path from "path";
import fs from "fs";

function loadTemplateMapping(): Record<string, number> {
  const searchPaths = [
    process.env.TEMPLATE_MAPPING_PATH,
    path.join(__dirname, "../../../template-mapping.json"),
    path.join(__dirname, "../../template-mapping.json"),
    "/app/template-mapping.json",
  ];

  for (const p of searchPaths) {
    if (!p) continue;
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      continue;
    }
  }

  console.warn("Template mapping file not found — using empty mapping");
  return {};
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  docuseal: {
    apiKey: process.env.DOCUSEAL_API_KEY || "",
    apiUrl: process.env.DOCUSEAL_API_URL || "https://api.docuseal.com",
    templateMapping: loadTemplateMapping(),
  },
};
