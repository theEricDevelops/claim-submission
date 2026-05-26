import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Policy', () => {
  it('creates a policy with a carrier company', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const carrier = await tx.company.create({
        data: { name: `CarrierCo ${rid}` },
      })

      const policy = await tx.policy.create({
        data: {
          policyNumber: `POL-${rid}`,
          claimNumber: `CLM-${rid}`,
          dateOfLoss: new Date('2025-01-15'),
          typeOfLoss: 'Fire',
          deductible: 2500,
          carrier: { connect: { id: carrier.id } },
        },
        include: { carrier: true },
      })

      expect(policy.policyNumber).toBe(`POL-${rid}`)
      expect(policy.claimNumber).toBe(`CLM-${rid}`)
      expect(policy.typeOfLoss).toBe('Fire')
      expect(policy.deductible).toBe(2500)
      expect(policy.carrier.name).toBe(`CarrierCo ${rid}`)
    })
  })

  it('finds policy by policy number', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const carrier = await tx.company.create({ data: { name: `FinderCo ${rid}` } })

      await tx.policy.create({
        data: {
          policyNumber: `FIND-${rid}`,
          carrier: { connect: { id: carrier.id } },
        },
      })

      const found = await tx.policy.findFirst({
        where: { policyNumber: `FIND-${rid}` },
      })
      expect(found).not.toBeNull()
      expect(found!.policyNumber).toBe(`FIND-${rid}`)
    })
  })
})

describe('Job with full graph', () => {
  it('creates a job with policy, loss address, and contacts', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // 1. Carrier company
      const carrier = await tx.company.create({ data: { name: `InsureCo ${rid}` } })

      // 2. Loss address
      const lossAddress = await tx.address.create({
        data: {
          street: '456 Oak Ave',
          city: 'Memphis',
          state: 'TN',
          zip: '38101',
          type: 'loss',
        },
      })

      // 3. Policy
      const policy = await tx.policy.create({
        data: {
          policyNumber: `JOB-POL-${rid}`,
          dateOfLoss: new Date('2025-03-20'),
          typeOfLoss: 'Water',
          carrier: { connect: { id: carrier.id } },
        },
      })

      // 4. Job
      const job = await tx.job.create({
        data: {
          status: 'DRAFT',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: lossAddress.id } },
        },
        include: { policy: true, lossAddress: true },
      })

      expect(job.status).toBe('DRAFT')
      expect(job.policy.policyNumber).toBe(`JOB-POL-${rid}`)
      expect(job.lossAddress.city).toBe('Memphis')
    })
  })

  it('assigns contacts to a job with roles', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // 1. Carrier
      const carrier = await tx.company.create({ data: { name: `AssignCo ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `ASSIGN-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const lossAddress = await tx.address.create({
        data: { street: '789 Pine St', city: 'Knoxville', state: 'TN', zip: '37901', type: 'loss' },
      })
      const job = await tx.job.create({
        data: {
          status: 'PENDING',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: lossAddress.id } },
        },
      })

      // 2. Create people + contacts + assign to job
      const roles = [
        { firstName: 'Named', role: 'NAMED_INSURED' as const, email: `ni-${rid}@test.com` },
        { firstName: 'Public', role: 'PUBLIC_ADJUSTER' as const, email: `pa-${rid}@test.com` },
      ]

      for (const r of roles) {
        const person = await tx.person.create({
          data: { salutation: 'Mr.', firstName: `${r.firstName}-${rid}`, lastName: `Role-${rid}` },
        })
        const contact = await tx.contact.create({
          data: {
            type: 'PERSON',
            name: `${r.firstName} Role ${rid}`,
            person: { connect: { id: person.id } },
            emails: { create: { text: r.email, type: 'work' } },
          },
        })
        await tx.assignmentContact.create({
          data: {
            job: { connect: { id: job.id } },
            contact: { connect: { id: contact.id } },
            role: r.role,
            status: 'ACTIVE',
          },
        })
      }

      // 3. Verify assignments
      const assignments = await tx.assignmentContact.findMany({
        where: { jobId: job.id },
        include: { contact: { include: { emails: true } } },
      })

      expect(assignments).toHaveLength(2)
      expect(assignments.map((a) => a.role).sort()).toEqual(['NAMED_INSURED', 'PUBLIC_ADJUSTER'])

      const insured = assignments.find((a) => a.role === 'NAMED_INSURED')
      expect(insured!.contact.emails[0].text).toBe(`ni-${rid}@test.com`)
    })
  })
})

describe('Job lifecycle', () => {
  it('transitions job status', async () => {
    await withRollback(async (tx) => {
      const rid = testId()
      const carrier = await tx.company.create({ data: { name: `LifecycleCo ${rid}` } })
      const lossAddress = await tx.address.create({
        data: { street: '1 Transition St', city: 'Chattanooga', state: 'TN', zip: '37401', type: 'loss' },
      })
      const policy = await tx.policy.create({
        data: { policyNumber: `LIFE-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })

      const job = await tx.job.create({
        data: {
          status: 'DRAFT',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: lossAddress.id } },
        },
      })
      expect(job.status).toBe('DRAFT')

      const updated = await tx.job.update({
        where: { id: job.id },
        data: { status: 'ACTIVE' },
      })
      expect(updated.status).toBe('ACTIVE')
    })
  })
})
