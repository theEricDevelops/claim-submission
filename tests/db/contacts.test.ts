import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Person + Contact', () => {
  it('creates a person contact with phone, email, and address', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const person = await tx.person.create({
        data: {
          salutation: 'Mr.',
          firstName: `John-${rid}`,
          lastName: `Doe-${rid}`,
          middleName: 'M',
          suffix: 'Jr.',
        },
      })
      expect(person.id).toBeDefined()
      expect(person.firstName).toBe(`John-${rid}`)

      const contact = await tx.contact.create({
        data: {
          type: 'PERSON',
          name: `John Doe ${rid}`,
          person: { connect: { id: person.id } },
          phones: {
            create: { country: 'USA', number: '6155550100', type: 'cell' },
          },
          emails: {
            create: { text: `john-${rid}@test.com`, type: 'work' },
          },
          addresses: {
            create: {
              street: '123 Main St',
              city: 'Nashville',
              state: 'TN',
              zip: '37201',
              type: 'home',
            },
          },
        },
        include: { phones: true, emails: true, addresses: true, person: true },
      })

      expect(contact.name).toBe(`John Doe ${rid}`)
      expect(contact.person!.firstName).toBe(`John-${rid}`)
      expect(contact.phones).toHaveLength(1)
      expect(contact.phones[0].number).toBe('6155550100')
      expect(contact.emails).toHaveLength(1)
      expect(contact.emails[0].text).toBe(`john-${rid}@test.com`)
      expect(contact.addresses).toHaveLength(1)
      expect(contact.addresses[0].city).toBe('Nashville')
    })
  })

  it('creates a company contact', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const company = await tx.company.create({
        data: { name: `Acme Corp ${rid}` },
      })

      const contact = await tx.contact.create({
        data: {
          type: 'COMPANY',
          name: `Acme Corp ${rid}`,
          company: { connect: { id: company.id } },
        },
        include: { company: true },
      })

      expect(contact.type).toBe('COMPANY')
      expect(contact.company!.name).toBe(`Acme Corp ${rid}`)
    })
  })
})

describe('Phone / Email / Address CRUD', () => {
  it('adds multiple phones and emails to a contact', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const person = await tx.person.create({
        data: { salutation: 'Ms.', firstName: `Jane-${rid}`, lastName: `Smith-${rid}` },
      })
      const contact = await tx.contact.create({
        data: {
          type: 'PERSON',
          name: `Jane Smith ${rid}`,
          person: { connect: { id: person.id } },
        },
      })

      await tx.phone.createMany({
        data: [
          { phoneContactId: contact.id, country: 'USA', number: '6155550101', type: 'cell' },
          { phoneContactId: contact.id, country: 'USA', number: '6155550102', type: 'work' },
        ],
      })

      await tx.email.create({
        data: { emailContactId: contact.id, text: `jane-${rid}@test.com`, type: 'work' },
      })

      const phones = await tx.phone.findMany({ where: { phoneContactId: contact.id } })
      expect(phones).toHaveLength(2)

      const email = await tx.email.findUnique({
        where: { text: `jane-${rid}@test.com` },
      })
      expect(email).not.toBeNull()
    })
  })
})

describe('Company + CompanyContact', () => {
  it('links a person to a company as an employee', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const company = await tx.company.create({ data: { name: `MegaCorp ${rid}` } })
      const person = await tx.person.create({
        data: { salutation: 'Dr.', firstName: `Alice-${rid}`, lastName: `Jones-${rid}` },
      })

      const employment = await tx.companyContact.create({
        data: {
          company: { connect: { id: company.id } },
          contact: { connect: { id: person.id } },
          jobTitle: 'CEO',
        },
        include: { company: true, contact: true },
      })

      expect(employment.jobTitle).toBe('CEO')
      expect(employment.company.name).toBe(`MegaCorp ${rid}`)
      expect(employment.contact.firstName).toBe(`Alice-${rid}`)
    })
  })

  it('finds all employees of a company', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const company = await tx.company.create({ data: { name: `TeamCo ${rid}` } })

      for (const name of ['Bob', 'Carol', 'Dave']) {
        const person = await tx.person.create({
          data: { salutation: 'Mr.', firstName: `${name}-${rid}`, lastName: `Employee-${rid}` },
        })
        await tx.companyContact.create({
          data: {
            company: { connect: { id: company.id } },
            contact: { connect: { id: person.id } },
          },
        })
      }

      const employees = await tx.companyContact.findMany({
        where: { companyId: company.id },
        include: { contact: true },
      })

      expect(employees).toHaveLength(3)
    })
  })
})
