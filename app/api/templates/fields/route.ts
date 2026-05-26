import { NextRequest, NextResponse } from "next/server";
import { resolveTemplateId, getTemplateFields, getTemplateSubmitters } from "@/lib/docuseal";

export async function POST(request: NextRequest) {
  try {
    const body: { state: string; insuredCount: number } = await request.json();

    if (!body.state || !body.insuredCount) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: state, insuredCount",
        },
        { status: 400 }
      );
    }

    const templateId = await resolveTemplateId(body.state, body.insuredCount);
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
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
