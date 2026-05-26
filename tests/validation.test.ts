import { describe, it, expect } from 'vitest'
import { claimSchema, templatesFieldsSchema, addressSchema } from '@/lib/validation'

describe('templatesFieldsSchema', () => {
  it('accepts valid state and insured count', () => {
    const result = templatesFieldsSchema.safeParse({ state: 'TN', insuredCount: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.state).toBe('TN')
      expect(result.data.insuredCount).toBe(1)
    }
  })

  it('uppercases lowercase state', () => {
    const result = templatesFieldsSchema.safeParse({ state: 'tn', insuredCount: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.state).toBe('TN')
    }
  })

  it('rejects invalid state code', () => {
    const result = templatesFieldsSchema.safeParse({ state: 'XX', insuredCount: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects insured count less than 1', () => {
    const result = templatesFieldsSchema.safeParse({ state: 'TN', insuredCount: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects insured count greater than 10', () => {
    const result = templatesFieldsSchema.safeParse({ state: 'TN', insuredCount: 11 })
    expect(result.success).toBe(false)
  })
})

describe('addressSchema', () => {
  it('provides defaults for empty input', () => {
    const result = addressSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.formatted).toBe('')
      expect(result.data.street).toBe('')
      expect(result.data.street2).toBe('')
      expect(result.data.city).toBe('')
      expect(result.data.state).toBe('')
      expect(result.data.zip).toBe('')
    }
  })

  it('accepts a full address', () => {
    const addr = {
      formatted: '123 Main St, Nashville, TN 37201',
      street: '123 Main St',
      street2: 'Apt 4',
      city: 'Nashville',
      state: 'TN',
      zip: '37201',
    }
    const result = addressSchema.safeParse(addr)
    expect(result.success).toBe(true)
  })

  it('rejects street exceeding 200 characters', () => {
    const result = addressSchema.safeParse({ street: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })
})

describe('claimSchema', () => {
  const validClaim = {
    state: 'TN',
    namedInsureds: [
      {
        type: 'individual',
        salutation: 'Mr.',
        firstName: 'John',
        lastName: 'Doe',
        phone: '(615) 555-0100',
        email: 'john@example.com',
      },
    ],
    propertyAddress: {
      formatted: '123 Main St, Nashville, TN 37201',
      street: '123 Main St',
      city: 'Nashville',
      state: 'TN',
      zip: '37201',
    },
    adjuster: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@adjuster.com',
      phone: '(615) 555-0200',
      licenseNumber: 'LIC-12345',
    },
  }

  it('accepts a valid claim', () => {
    const result = claimSchema.safeParse(validClaim)
    expect(result.success).toBe(true)
  })

  it('rejects claim without named insureds', () => {
    const result = claimSchema.safeParse({ ...validClaim, namedInsureds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects claim with state XX', () => {
    const result = claimSchema.safeParse({ ...validClaim, state: 'XX' })
    expect(result.success).toBe(false)
  })

  it('accepts claim with multiple insureds', () => {
    const result = claimSchema.safeParse({
      ...validClaim,
      namedInsureds: [
        validClaim.namedInsureds[0],
        {
          type: 'company',
          companyName: 'Acme Corp',
          phone: '(615) 555-0300',
          email: 'acme@example.com',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts claim with fieldValues', () => {
    const result = claimSchema.safeParse({
      ...validClaim,
      fieldValues: { 'Type of Loss': 'Fire', 'Claim Number': 'CL-2024-001' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects claim with missing adjuster fields', () => {
    const result = claimSchema.safeParse({
      ...validClaim,
      adjuster: { firstName: 'Jane' },
    })
    expect(result.success).toBe(false)
  })
})
