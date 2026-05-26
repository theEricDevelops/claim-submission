import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Cross-model data flows', () => {
  it('reuses the same policy across a lead and a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // Shared entities
      const carrier = await tx.company.create({ data: { name: `SharedCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: {
          policyNumber: `SHARED-POL-${rid}`,
          claimNumber: `SHARED-CLM-${rid}`,
          dateOfLoss: new Date('2025-06-15'),
          typeOfLoss: 'Fire',
          carrier: { connect: { id: carrier.id } },
        },
      })

      // Loss address — shared between lead and job
      const lossAddress = await tx.address.create({
        data: { street: '500 Shared Blvd', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })

      // 1. Create a Lead from this policy
      const lead = await tx.lead.create({
        data: {
          status: 'QUALIFIED',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: lossAddress.id } },
        },
      })
      expect(lead.policyId).toBe(policy.id)

      // 2. Convert lead → job: reuse the same policy and address
      const job = await tx.job.create({
        data: {
          status: 'ACTIVE',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: lossAddress.id } },
        },
      })
      expect(job.policyId).toBe(policy.id)
      expect(job.lossAddressId).toBe(lossAddress.id)

      // 3. Verify both reference the same policy
      const loaded = await tx.policy.findFirst({
        where: { id: policy.id },
        include: { jobs: true, leads: true },
      })
      expect(loaded!.jobs).toHaveLength(1)
      expect(loaded!.leads).toHaveLength(1)
      expect(loaded!.jobs[0].id).toBe(job.id)
      expect(loaded!.leads[0].id).toBe(lead.id)
    })
  })

  it('assigns the same contact to a lead then a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const carrier = await tx.company.create({ data: { name: `SameContactCo ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `SC-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '600 Same St', city: 'Memphis', state: 'TN', zip: '38101', type: 'loss' },
      })

      // Contact that appears in both lead and job
      const person = await tx.person.create({
        data: { salutation: 'Mrs.', firstName: `Both-${rid}`, lastName: `Assignee-${rid}` },
      })
      const contact = await tx.contact.create({
        data: { type: 'PERSON', name: `Both Assignee ${rid}`, person: { connect: { id: person.id } } },
      })

      // Lead with this contact
      const lead = await tx.lead.create({
        data: { status: 'NEW', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })
      await tx.assignmentContact.create({
        data: { lead: { connect: { id: lead.id } }, contact: { connect: { id: contact.id } }, role: 'NAMED_INSURED', status: 'ACTIVE' },
      })

      // Job with the same contact
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })
      await tx.assignmentContact.create({
        data: { job: { connect: { id: job.id } }, contact: { connect: { id: contact.id } }, role: 'NAMED_INSURED', status: 'ACTIVE' },
      })

      // Verify contact is assigned to both
      const assignments = await tx.assignmentContact.findMany({
        where: { contactId: contact.id },
        include: { lead: true, job: true },
      })

      expect(assignments).toHaveLength(2)
      const leadAssignment = assignments.find((a) => a.leadId === lead.id)
      const jobAssignment = assignments.find((a) => a.jobId === job.id)
      expect(leadAssignment).toBeDefined()
      expect(jobAssignment).toBeDefined()
    })
  })

  it('attaches documents to the same job through a lead conversion', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const carrier = await tx.company.create({ data: { name: `DocFlowCo ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `DF-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '700 Flow Dr', city: 'Chattanooga', state: 'TN', zip: '37401', type: 'loss' },
      })
      const uploader = await tx.contact.create({
        data: {
          type: 'PERSON',
          name: `DocUploader ${rid}`,
          person: { create: { salutation: 'Mr.', firstName: `Upload-${rid}`, lastName: `Doc-${rid}` } },
        },
      })

      // Lead with a document
      const lead = await tx.lead.create({
        data: { status: 'CONVERTED', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })
      const leadDoc = await tx.document.create({
        data: {
          lead: { connect: { id: lead.id } },
          uploadedBy: { connect: { id: uploader.id } },
          fileName: 'lead-photo.jpg',
          storageKey: `ld-${rid}`,
          category: 'PHOTO',
        },
      })

      // Converted to job — attach a new document
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })
      const jobDoc = await tx.document.create({
        data: {
          job: { connect: { id: job.id } },
          uploadedBy: { connect: { id: uploader.id } },
          fileName: 'estimate.pdf',
          storageKey: `je-${rid}`,
          category: 'ESTIMATE',
        },
      })

      // Lead doc stays on the lead
      expect(leadDoc.leadId).toBe(lead.id)
      expect(leadDoc.jobId).toBeNull()

      // Job doc is on the job
      expect(jobDoc.jobId).toBe(job.id)
      expect(jobDoc.leadId).toBeNull()

      // Same uploader for both
      expect(leadDoc.uploadedById).toBe(uploader.id)
      expect(jobDoc.uploadedById).toBe(uploader.id)
    })
  })

  it('creates a contract referencing a job and its lead-originated policy', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // Provider (the PA firm)
      const paPerson = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `PA-${rid}`, lastName: `Provider-${rid}` },
      })
      const tenant = await tx.tenant.create({
        data: { name: `CrossTenant ${rid}`, subdomain: `cross-${rid}`, secretKey: `sk-cross-${rid}` },
      })
      const provider = await tx.member.create({
        data: {
          person: { connect: { id: paPerson.id } },
          memberUserName: `cross-provider-${rid}`,
          passwordHash: 'hash',
          memberOnTenants: { connect: [{ id: tenant.id }] },
        },
      })

      // Client contact
      const clientPerson = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `CrossClient-${rid}`, lastName: `Insured-${rid}` },
      })
      const client = await tx.contact.create({
        data: { type: 'PERSON', name: `Cross Client ${rid}`, person: { connect: { id: clientPerson.id } } },
      })

      // Policy + Job
      const carrier = await tx.company.create({ data: { name: `CrossCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `CROSS-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '800 Cross Blvd', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      // Contract links job, provider, and client
      const contract = await tx.contract.create({
        data: {
          job: { connect: { id: job.id } },
          provider: { connect: { id: provider.id } },
          clients: { connect: [{ id: client.id }] },
          type: 'PA_AGREEMENT',
          feeType: 'PERCENTAGE',
          feeValue: 12.5,
          status: 'SIGNED',
          signedAt: new Date('2025-07-01'),
        },
        include: {
          job: { include: { policy: true } },
          provider: { include: { person: true } },
          clients: true,
        },
      })

      // Traverse: contract → job → policy → carrier
      expect(contract.job!.policy.carrierId).toBe(carrier.id)
      expect(contract.clients[0].name).toBe(`Cross Client ${rid}`)
      expect(contract.provider.person.firstName).toBe(`PA-${rid}`)

      // Count all contracts on this job
      const count = await tx.contract.count({ where: { jobId: job.id } })
      expect(count).toBe(1)
    })
  })

  it('tracks a person as both a user and a member across tenants', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // Single person who is both an internal user and a PA member
      const person = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `Dual-${rid}`, lastName: `Role-${rid}` },
      })

      // Two different tenants
      const tenantA = await tx.tenant.create({
        data: { name: `DualTenantA ${rid}`, subdomain: `duala-${rid}`, secretKey: `sk-da-${rid}` },
      })
      const tenantB = await tx.tenant.create({
        data: { name: `DualTenantB ${rid}`, subdomain: `dualb-${rid}`, secretKey: `sk-db-${rid}` },
      })

      // This person is a User in Tenant A
      const user = await tx.user.create({
        data: {
          name: `dualuser-${rid}`,
          passwordHash: 'hash',
          email: `dualuser-${rid}@plpas.com`,
          person: { connect: { id: person.id } },
          tenants: { connect: [{ id: tenantA.id }] },
        },
      })

      // And the same person is a Member (PA) in Tenant B
      const member = await tx.member.create({
        data: {
          person: { connect: { id: person.id } },
          memberUserName: `dualmember-${rid}`,
          passwordHash: 'hash',
          memberOnTenants: { connect: [{ id: tenantB.id }] },
        },
      })

      expect(user.personId).toBe(person.id)
      expect(member.personId).toBe(person.id)

      // Verify from the person side
      const loaded = await tx.person.findUnique({
        where: { id: person.id },
        include: { user: true, member: true },
      })
      expect(loaded!.user).not.toBeNull()
      expect(loaded!.member).not.toBeNull()
    })
  })
})
