import { Router, Request, Response } from "express";
import { resolveTemplateId, getTemplateFields } from "../services/docuseal";

export const templateRouter = Router();

interface TemplateFieldsRequest {
  state: string;
  insuredCount: number;
}

templateRouter.post("/fields", async (req: Request, res: Response) => {
  try {
    const body = req.body as TemplateFieldsRequest;

    if (!body.state || !body.insuredCount) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: state, insuredCount",
      });
      return;
    }

    const templateId = resolveTemplateId(body.state, body.insuredCount);
    const fields = await getTemplateFields(templateId);

    res.json({
      success: true,
      templateId,
      fields,
    });
  } catch (error) {
    console.error("Error fetching template fields:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
