import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Lead lifecycle', () => {
  it('creates a lead with policy and loss address', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const carrier = await tx.company.create({ data: { name: `LeadCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `L-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const lossAddress = await tx.address.create({
        data: { street: '100 Lead Ln', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })

      const lead = await tx.lead.create({
        data: {
          status: 'NEW',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: lossAddress.id } },
        },
        include: { policy: true, lossAddress: true },
      })

      expect(lead.status).toBe('NEW')
      expect(lead.policy.policyNumber).toBe(`L-POL-${rid}`)
      expect(lead.lossAddress.city).toBe('Nashville')
    })
  })

  it('transitions lead status', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const carrier = await tx.company.create({ data: { name: `StatusCo ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `STATUS-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '200 Status Ave', city: 'Memphis', state: 'TN', zip: '38101', type: 'loss' },
      })

      const lead = await tx.lead.create({
        data: { status: 'NEW', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })
      expect(lead.status).toBe('NEW')

      const converted = await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'CONVERTED' },
      })
      expect(converted.status).toBe('CONVERTED')
    })
  })

  it('assigns contacts to a lead', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const carrier = await tx.company.create({ data: { name: `AssignLeadCo ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `LA-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '300 Assign Dr', city: 'Knoxville', state: 'TN', zip: '37901', type: 'loss' },
      })
      const lead = await tx.lead.create({
        data: { status: 'QUALIFIED', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      const person = await tx.person.create({
        data: { salutation: 'Ms.', firstName: `LeadContact-${rid}`, lastName: `Test-${rid}` },
      })
      const contact = await tx.contact.create({
        data: { type: 'PERSON', name: `Lead Contact ${rid}`, person: { connect: { id: person.id } } },
      })

      const assignment = await tx.assignmentContact.create({
        data: {
          lead: { connect: { id: lead.id } },
          contact: { connect: { id: contact.id } },
          role: 'NAMED_INSURED',
          status: 'ACTIVE',
        },
        include: { lead: true, contact: true },
      })

      expect(assignment.role).toBe('NAMED_INSURED')
      expect(assignment.contact.name).toBe(`Lead Contact ${rid}`)

      const found = await tx.lead.findUnique({
        where: { id: lead.id },
        include: { assignmentContacts: true },
      })
      expect(found!.assignmentContacts).toHaveLength(1)
    })
  })
})
