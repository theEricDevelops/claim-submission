import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('EmailMessage targeting', () => {
  // Helper: create a minimal job
  async function createJob(tx: any, rid: string) {
    const carrier = await tx.company.create({ data: { name: `EMJobCarrier ${rid}` } })
    const policy = await tx.policy.create({
      data: { policyNumber: `EMJ-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
    })
    const addr = await tx.address.create({
      data: { street: `${rid} Email Ln`, city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
    })
    return tx.job.create({
      data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
    })
  }

  // Helper: create a minimal lead
  async function createLead(tx: any, rid: string) {
    const carrier = await tx.company.create({ data: { name: `EMLeadCarrier ${rid}` } })
    const policy = await tx.policy.create({
      data: { policyNumber: `EML-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
    })
    const addr = await tx.address.create({
      data: { street: `${rid} Lead Ave`, city: 'Memphis', state: 'TN', zip: '38101', type: 'loss' },
    })
    return tx.lead.create({
      data: { status: 'NEW', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
    })
  }

  // Helper: create a minimal contact
  async function createContact(tx: any, rid: string) {
    const person = await tx.person.create({
      data: { salutation: 'Mr.', firstName: `EMContact-${rid}`, lastName: `Person-${rid}` },
    })
    return tx.contact.create({
      data: { type: 'PERSON', name: `EM Contact ${rid}`, person: { connect: { id: person.id } } },
    })
  }

  it('targets a job with multiple recipients', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const job = await createJob(tx, rid)

      const email = await tx.emailMessage.create({
        data: {
          from: 'system@plpas.com',
          to: ['insured@test.com', 'adjuster@test.com'],
          cc: ['manager@test.com'],
          bcc: ['archive@test.com'],
          subject: 'Claim Filed',
          body: `Claim ${rid} has been filed.`,
          targetId: job.id,
          targetType: 'JOB',
        },
      })

      expect(email.from).toBe('system@plpas.com')
      expect(email.to).toHaveLength(2)
      expect(email.to).toContain('insured@test.com')
      expect(email.to).toContain('adjuster@test.com')
      expect(email.cc).toEqual(['manager@test.com'])
      expect(email.bcc).toEqual(['archive@test.com'])
      expect(email.subject).toBe('Claim Filed')
      expect(email.targetType).toBe('JOB')
      expect(email.targetId).toBe(job.id)
    })
  })

  it('targets a lead', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const lead = await createLead(tx, rid)

      const email = await tx.emailMessage.create({
        data: {
          from: 'leads@plpas.com',
          to: ['prospect@test.com'],
          cc: [],
          bcc: [],
          subject: 'Lead Follow-Up',
          body: `Lead ${rid} needs follow-up.`,
          targetId: lead.id,
          targetType: 'LEAD',
        },
      })

      expect(email.targetType).toBe('LEAD')
      expect(email.targetId).toBe(lead.id)
      expect(email.to).toEqual(['prospect@test.com'])
    })
  })

  it('targets a contact', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const contact = await createContact(tx, rid)

      const email = await tx.emailMessage.create({
        data: {
          from: 'notifications@plpas.com',
          to: [rid + '@test.com'],
          cc: [],
          bcc: [],
          subject: 'Welcome',
          body: `Welcome ${rid}!`,
          targetId: contact.id,
          targetType: 'CONTACT',
        },
      })

      expect(email.targetType).toBe('CONTACT')
      expect(email.targetId).toBe(contact.id)
    })
  })

  it('sends email with empty cc and bcc', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const job = await createJob(tx, rid)

      const email = await tx.emailMessage.create({
        data: {
          from: 'no-reply@plpas.com',
          to: ['single@test.com'],
          cc: [],
          bcc: [],
          subject: 'Simple',
          body: 'Minimal email.',
          targetId: job.id,
          targetType: 'JOB',
        },
      })

      expect(email.cc).toEqual([])
      expect(email.bcc).toEqual([])
      expect(email.to).toHaveLength(1)
    })
  })

  it('finds emails by target type and id (composite index)', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const job = await createJob(tx, rid)

      await tx.emailMessage.createMany({
        data: [
          { from: 'a@test.com', to: ['t1@test.com'], cc: [], bcc: [], subject: 'S1', body: 'B1', targetId: job.id, targetType: 'JOB' },
          { from: 'b@test.com', to: ['t2@test.com'], cc: [], bcc: [], subject: 'S2', body: 'B2', targetId: job.id, targetType: 'JOB' },
        ],
      })

      const emails = await tx.emailMessage.findMany({
        where: { targetType: 'JOB', targetId: job.id },
        orderBy: { from: 'asc' },
      })

      expect(emails).toHaveLength(2)
      expect(emails[0].subject).toBe('S1')
      expect(emails[1].subject).toBe('S2')
    })
  })

  it('stores long body text', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const job = await createJob(tx, rid)
      const longBody = 'A'.repeat(5000)

      const email = await tx.emailMessage.create({
        data: {
          from: 'long@test.com',
          to: ['r@test.com'],
          cc: [],
          bcc: [],
          subject: 'Long Body',
          body: longBody,
          targetId: job.id,
          targetType: 'JOB',
        },
      })

      expect(email.body.length).toBe(5000)
    })
  })
})
