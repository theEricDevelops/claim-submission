import { describe, it, expect, vi, beforeEach } from 'vitest'
import docuseal from '@docuseal/api'

vi.mock('@docuseal/api', () => ({
  default: {
    configure: vi.fn(),
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    createSubmission: vi.fn(),
  },
}))

const mockDocuseal = vi.mocked(docuseal)

describe('resolveTemplateId', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { clearTemplateCache } = await import('@/lib/docuseal')
    clearTemplateCache()
    mockDocuseal.listTemplates.mockResolvedValue({
      data: [
        { id: 1, name: 'TN_1 - TN Public Adjuster Agreement (Single)' },
        { id: 2, name: 'TN_2 - TN Public Adjuster Agreement (Two Insured)' },
        { id: 3, name: 'IL_1 - IL Public Adjuster Agreement' },
      ],
    })
  })

  it('resolves template ID for state and count', async () => {
    const { resolveTemplateId } = await import('@/lib/docuseal')
    const id = await resolveTemplateId('TN', 1)
    expect(id).toBe(1)
  })

  it('resolves template ID for two insured', async () => {
    const { resolveTemplateId } = await import('@/lib/docuseal')
    const id = await resolveTemplateId('TN', 2)
    expect(id).toBe(2)
  })

  it('throws for missing template', async () => {
    const { resolveTemplateId } = await import('@/lib/docuseal')
    await expect(resolveTemplateId('CA', 1)).rejects.toThrow(
      'No DocuSeal template configured for "CA" with 1 named insured(s)',
    )
  })

  it('caches prefix map on first call', async () => {
    const { resolveTemplateId } = await import('@/lib/docuseal')
    await resolveTemplateId('TN', 1)
    await resolveTemplateId('IL', 1)
    expect(mockDocuseal.listTemplates).toHaveBeenCalledTimes(1)
  })
})

describe('getTemplateFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns fields from template', async () => {
    mockDocuseal.getTemplate.mockResolvedValue({
      fields: [
        { name: 'Type of Loss', type: 'text', required: true, submitter_uuid: 'uuid-1' },
        { name: 'Claim Number', type: 'text', required: false, submitter_uuid: 'uuid-1' },
      ],
      submitters: [],
    })

    const { getTemplateFields } = await import('@/lib/docuseal')
    const fields = await getTemplateFields(1)
    expect(fields).toHaveLength(2)
    expect(fields[0].name).toBe('Type of Loss')
    expect(fields[1].name).toBe('Claim Number')
  })

  it('returns empty array on error', async () => {
    mockDocuseal.getTemplate.mockRejectedValue(new Error('API error'))
    const { getTemplateFields } = await import('@/lib/docuseal')
    const fields = await getTemplateFields(1)
    expect(fields).toEqual([])
  })
})

describe('getTemplateSubmitters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns submitters from template', async () => {
    mockDocuseal.getTemplate.mockResolvedValue({
      fields: [],
      submitters: [
        { name: 'Insured', uuid: 'uuid-1' },
        { name: 'Public Adjuster', uuid: 'uuid-2' },
      ],
    })

    const { getTemplateSubmitters } = await import('@/lib/docuseal')
    const submitters = await getTemplateSubmitters(1)
    expect(submitters).toHaveLength(2)
    expect(submitters[0].name).toBe('Insured')
  })

  it('returns empty array on error', async () => {
    mockDocuseal.getTemplate.mockRejectedValue(new Error('API error'))
    const { getTemplateSubmitters } = await import('@/lib/docuseal')
    const submitters = await getTemplateSubmitters(1)
    expect(submitters).toEqual([])
  })
})

describe('createClaimSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls docuseal.createSubmission with correct params', async () => {
    mockDocuseal.createSubmission.mockResolvedValue({ id: 42 })

    const { createClaimSubmission } = await import('@/lib/docuseal')
    const result = await createClaimSubmission({
      templateId: 1,
      submitters: [{ email: 'test@example.com', role: 'Insured' }],
      sendEmail: false,
    })

    expect(mockDocuseal.createSubmission).toHaveBeenCalledWith({
      template_id: 1,
      send_email: false,
      submitters: [{ email: 'test@example.com', role: 'Insured' }],
    })
    expect(result).toEqual({ id: 42 })
  })
})
