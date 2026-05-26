import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyRequest } from '@/lib/auth'
import { getTemplateFields, getTemplateSubmitters, resolveTemplateId } from '@/lib/docuseal'
import { templatesFieldsSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request)
  if (!auth.authenticated) {
    return unauthorizedResponse()
  }

  try {
    const body: { state: string; insuredCount: number } = await request.json()

    const parsed = templatesFieldsSchema.safeParse(body)
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

    const { state, insuredCount } = parsed.data

    let templateId: number
    try {
      templateId = await resolveTemplateId(state, insuredCount)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `No DocuSeal template configured for "${state}_${insuredCount}". Create a template with name starting with "${state}_${insuredCount}"`,
        },
        { status: 400 }
      )
    }

    const [fields, submitters] = await Promise.all([
      getTemplateFields(templateId),
      getTemplateSubmitters(templateId),
    ])

    return NextResponse.json({
      success: true,
      templateId,
      fields,
      submitters,
    })
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
