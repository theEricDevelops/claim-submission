import { NextRequest, NextResponse } from "next/server";
import { resolveTemplateId, getTemplateFields, getTemplateSubmitters, createClaimSubmission } from "@/lib/docuseal";

interface AddressValue {
  formatted: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
}

interface NamedInsuredInput {
  type: "individual" | "company";
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  companyName?: string;
  phone: string;
  email: string;
  mailingAddress?: AddressValue;
}

interface ClaimRequestBody {
  state: string;
  namedInsureds: NamedInsuredInput[];
  propertyAddress: AddressValue;
  adjuster: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    licenseNumber: string;
    mailingAddress?: AddressValue;
  };
  fieldValues?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ClaimRequestBody = await request.json();

    if (!body.state || !body.namedInsureds?.length || !body.adjuster?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: state, namedInsureds, adjuster.email",
        },
        { status: 400 }
      );
    }

    let templateId: number;
    try {
      templateId = await resolveTemplateId(body.state, body.namedInsureds.length);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `No DocuSeal template configured for "${body.state}_${body.namedInsureds.length}". Create a template with name starting with "${body.state}_${body.namedInsureds.length} -".`,
        },
        { status: 400 }
      );
    }

    const [templateSubmitters, templateFields] = await Promise.all([
      getTemplateSubmitters(templateId),
      getTemplateFields(templateId),
    ]);

    const uuidToRole: Record<string, string> = {};
    for (const s of templateSubmitters) {
      uuidToRole[s.uuid] = s.name;
    }

    const roleToFields: Record<string, Record<string, string>> = {};
    const extraValues: Record<string, string> = {};

    for (const f of templateFields) {
      const val = (body.fieldValues || {})[f.name];
      if (val === undefined || val === "") continue;
      const role = uuidToRole[f.submitter_uuid];
      if (role) {
        if (!roleToFields[role]) roleToFields[role] = {};
        roleToFields[role][f.name] = val;
      } else {
        extraValues[f.name] = val;
      }
    }

    const submitters: Array<{ email: string; role: string; values?: Record<string, string> }> = [];

    body.namedInsureds.forEach((ni, i) => {
      const role =
        i === 0 ? "First Insured" :
        i === 1 ? "Second Insured" :
        `Additional Insured ${i}`;
      submitters.push({
        email: ni.email,
        role,
        values: roleToFields[role] || undefined,
      });
    });

    submitters.push({
      email: body.adjuster.email,
      role: "Public Adjuster",
      values: roleToFields["Public Adjuster"] || undefined,
    });

    if (Object.keys(extraValues).length > 0 && submitters.length > 0) {
      submitters[0].values = { ...(submitters[0].values || {}), ...extraValues };
    }

    const submission = await createClaimSubmission({
      templateId,
      submitters,
      sendEmail: true,
    });

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error("Error creating claim submission:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
