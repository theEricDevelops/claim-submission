import { describe, it, expect } from 'vitest'
import {
  isValidPhone,
  formatPhone,
  isValidEmail,
  emptyAddress,
  emptyInsured,
  AUTO_POPULATED_FIELDS,
  SKIP_FIELD_TYPES,
  CHECKBOX_FIELDS,
} from '@/types'

describe('isValidPhone', () => {
  it('accepts 10-digit number', () => {
    expect(isValidPhone('6155550100')).toBe(true)
  })

  it('accepts formatted number', () => {
    expect(isValidPhone('(615) 555-0100')).toBe(true)
  })

  it('accepts number with leading 1', () => {
    expect(isValidPhone('16155550100')).toBe(true)
  })

  it('rejects short number', () => {
    expect(isValidPhone('12345')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('formats 10 digits', () => {
    expect(formatPhone('6155550100')).toBe('(615) 555-0100')
  })

  it('passes through invalid input', () => {
    expect(formatPhone('123')).toBe('123')
  })
})

describe('isValidEmail', () => {
  it('accepts valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('rejects missing @', () => {
    expect(isValidEmail('notanemail')).toBe(false)
  })
})

describe('emptyAddress', () => {
  it('returns default values', () => {
    const addr = emptyAddress()
    expect(addr.formatted).toBe('')
    expect(addr.street).toBe('')
    expect(addr.city).toBe('')
  })
})

describe('emptyInsured', () => {
  it('returns default values with key', () => {
    const insured = emptyInsured(5)
    expect(insured.type).toBe('individual')
    expect(insured._key).toBe(5)
    expect(insured.typeChosen).toBe(false)
  })
})

describe('constants', () => {
  it('AUTO_POPULATED_FIELDS contains expected fields', () => {
    expect(AUTO_POPULATED_FIELDS.has('Loss Address')).toBe(true)
    expect(AUTO_POPULATED_FIELDS.has('First Insured Name')).toBe(true)
    expect(AUTO_POPULATED_FIELDS.has('Public Adjuster Name')).toBe(true)
    expect(AUTO_POPULATED_FIELDS.has('Nonexistent')).toBe(false)
  })

  it('SKIP_FIELD_TYPES contains signature and initials', () => {
    expect(SKIP_FIELD_TYPES.has('signature')).toBe(true)
    expect(SKIP_FIELD_TYPES.has('initials')).toBe(true)
  })

  it('CHECKBOX_FIELDS contains expected fields', () => {
    expect(CHECKBOX_FIELDS.has('Emergency Claim')).toBe(true)
    expect(CHECKBOX_FIELDS.has('Non-Emergency Claim')).toBe(true)
  })
})
