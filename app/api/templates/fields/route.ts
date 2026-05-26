import { NextRequest, NextResponse } from "next/server";
import { resolveTemplateId, getTemplateFields, getTemplateSubmitters } from "@/lib/docuseal";
import { verifyRequest, unauthorizedResponse } from "@/lib/auth";
import { templatesFieldsSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth.authenticated) {
    return unauthorizedResponse();
  }

  try {
    const body: { state: string; insuredCount: number } = await request.json();

    const parsed = templatesFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { state, insuredCount } = parsed.data;

    const templateId = await resolveTemplateId(state, insuredCount);
    const [fields, submitters] = await Promise.all([
      getTemplateFields(templateId),
      getTemplateSubmitters(templateId),
    ]);

    return NextResponse.json({
      success: true,
      templateId,
      fields,
      submitters,
    });
  } catch (error) {
    console.error("Error fetching template fields:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An internal error occurred",
      },
      { status: 500 }
    );
  }
}
