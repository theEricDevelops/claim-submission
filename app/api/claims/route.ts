import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyRequest } from '@/lib/auth'
import {
  createClaimSubmission,
  getTemplateFields,
  getTemplateSubmitters,
  resolveTemplateId,
} from '@/lib/docuseal'
import { claimSchema } from '@/lib/validation'

interface AddressValue {
  formatted: string
  street: string
  street2: string
  city: string
  state: string
  zip: string
}

interface NamedInsuredInput {
  type: 'individual' | 'company'
  salutation?: string
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  companyName?: string
  phone: string
  email: string
  mailingAddress?: AddressValue
}

interface ClaimRequestBody {
  state: string
  namedInsureds: NamedInsuredInput[]
  propertyAddress: AddressValue
  adjuster: {
    firstName: string
    lastName: string
    email: string
    phone: string
    licenseNumber: string
    mailingAddress?: AddressValue
  }
  fieldValues?: Record<string, string>
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request)
  if (!auth.authenticated) {
    return unauthorizedResponse()
  }

  try {
    const body: ClaimRequestBody = await request.json()

    const parsed = claimSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      )
    }

    const validated = parsed.data

    let templateId: number
    try {
      templateId = await resolveTemplateId(validated.state, validated.namedInsureds.length)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `No DocuSeal template configured for "${validated.state}_${validated.namedInsureds.length}". Create a template with name starting with "${validated.state}_${validated.namedInsureds.length} -".`,
        },
        { status: 400 }
      )
    }

    const [templateSubmitters, templateFields] = await Promise.all([
      getTemplateSubmitters(templateId),
      getTemplateFields(templateId),
    ])

    const uuidToRole: Record<string, string> = {}
    for (const s of templateSubmitters) {
      uuidToRole[s.uuid] = s.name
    }

    const roleToFields: Record<string, Record<string, string>> = {}
    const extraValues: Record<string, string> = {}

    for (const f of templateFields) {
      const val = body.fieldValues?.[f.name]
      if (val === undefined || val === '') continue
      const role = uuidToRole[f.submitter_uuid]
      if (role) {
        if (!roleToFields[role]) roleToFields[role] = {}
        roleToFields[role][f.name] = val
      } else {
        extraValues[f.name] = val
      }
    }

    const submitters: Array<{ email: string; role: string; values?: Record<string, string> }> = []

    validated.namedInsureds.forEach((ni, i) => {
      const role =
        i === 0 ? 'First Insured' : i === 1 ? 'Second Insured' : `Additional Insured ${i}`
      submitters.push({
        email: ni.email,
        role,
        values: roleToFields[role] || undefined,
      })
    })

    submitters.push({
      email: validated.adjuster.email,
      role: 'Public Adjuster',
      values: roleToFields['Public Adjuster'] || undefined,
    })

    if (Object.keys(extraValues).length > 0 && submitters.length > 0) {
      submitters[0].values = { ...(submitters[0].values || {}), ...extraValues }
    }

    const submission = await createClaimSubmission({
      templateId,
      submitters,
      sendEmail: true,
    })

    return NextResponse.json({ success: true, submission })
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
      },
      { status: 500 }
    )
  }
}
