import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Contract on a Job', () => {
  it('creates a PA agreement contract on a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // Provider (Member) — needs a Person + Tenant
      const providerPerson = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `Provider-${rid}`, lastName: `Adj-${rid}` },
      })
      const tenant = await tx.tenant.create({
        data: { name: `ContractTenant ${rid}`, subdomain: `ctenant-${rid}`, secretKey: `sk-ct-${rid}` },
      })
      const provider = await tx.member.create({
        data: {
          person: { connect: { id: providerPerson.id } },
          memberUserName: `provider-${rid}`,
          passwordHash: 'hashed',
          memberOnTenants: { connect: [{ id: tenant.id }] },
        },
      })

      // Client contact
      const clientPerson = await tx.person.create({
        data: { salutation: 'Mrs.', firstName: `Client-${rid}`, lastName: `Insured-${rid}` },
      })
      const clientContact = await tx.contact.create({
        data: { type: 'PERSON', name: `Client ${rid}`, person: { connect: { id: clientPerson.id } } },
      })

      // Job (requires Carrier, Policy, Address)
      const carrier = await tx.company.create({ data: { name: `ContractCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `C-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '400 Contract Ct', city: 'Chattanooga', state: 'TN', zip: '37401', type: 'loss' },
      })
      const job = await tx.job.create({
        data: {
          status: 'ACTIVE',
          policy: { connect: { id: policy.id } },
          lossAddress: { connect: { id: addr.id } },
        },
      })

      // Contract
      const contract = await tx.contract.create({
        data: {
          job: { connect: { id: job.id } },
          provider: { connect: { id: provider.id } },
          type: 'PA_AGREEMENT',
          feeType: 'PERCENTAGE',
          feeValue: 10.0,
          status: 'DRAFT',
          clients: { connect: [{ id: clientContact.id }] },
        },
        include: { job: true, provider: true, clients: true },
      })

      expect(contract.type).toBe('PA_AGREEMENT')
      expect(contract.feeType).toBe('PERCENTAGE')
      expect(contract.feeValue).toBe(10.0)
      expect(contract.status).toBe('DRAFT')
      expect(contract.clients).toHaveLength(1)
      expect(contract.clients[0].name).toBe(`Client ${rid}`)
    })
  })

  it('transitions contract through statuses and records dates', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const pp = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `StatusProv-${rid}`, lastName: `Adj-${rid}` },
      })
      const t = await tx.tenant.create({
        data: { name: `StatusTenant ${rid}`, subdomain: `stenant-${rid}`, secretKey: `sk-st-${rid}` },
      })
      const member = await tx.member.create({
        data: {
          person: { connect: { id: pp.id } },
          memberUserName: `sprovider-${rid}`,
          passwordHash: 'hashed',
          memberOnTenants: { connect: [{ id: t.id }] },
        },
      })
      const carrier = await tx.company.create({ data: { name: `StatusCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `ST-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '1 Status St', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      const contract = await tx.contract.create({
        data: {
          job: { connect: { id: job.id } },
          provider: { connect: { id: member.id } },
          type: 'PA_AGREEMENT',
          feeType: 'FLAT_FEE',
          feeValue: 5000,
          status: 'DRAFT',
        },
      })
      expect(contract.status).toBe('DRAFT')
      expect(contract.signedAt).toBeNull()

      const sent = await tx.contract.update({
        where: { id: contract.id },
        data: { status: 'SENT' },
      })
      expect(sent.status).toBe('SENT')

      const signed = await tx.contract.update({
        where: { id: contract.id },
        data: { status: 'SIGNED', signedAt: new Date('2025-06-01') },
      })
      expect(signed.status).toBe('SIGNED')
      expect(signed.signedAt).toEqual(new Date('2025-06-01'))
    })
  })
})
