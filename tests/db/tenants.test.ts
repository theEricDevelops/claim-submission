import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Tenant + Config', () => {
  it('creates a tenant with config', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const tenant = await tx.tenant.create({
        data: {
          name: `AdjusterPro ${rid}`,
          subdomain: `adjusterpro-${rid}`,
          secretKey: `sk-${rid}`,
          config: {
            create: {
              primaryColor: '#1a73e8',
              secondaryColor: '#34a853',
            },
          },
        },
        include: { config: true },
      })

      expect(tenant.name).toBe(`AdjusterPro ${rid}`)
      expect(tenant.subdomain).toBe(`adjusterpro-${rid}`)
      expect(tenant.config).not.toBeNull()
      expect(tenant.config!.primaryColor).toBe('#1a73e8')
      expect(tenant.config!.phoneTypes).toContain('cell')
    })
  })
})

describe('TenantRole + Member', () => {
  it('creates a member with roles on a tenant', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const tenant = await tx.tenant.create({
        data: {
          name: `RoleTenant ${rid}`,
          subdomain: `roletenant-${rid}`,
          secretKey: `sk-role-${rid}`,
        },
      })

      const role = await tx.tenantRole.create({
        data: {
          name: 'Admin',
          slug: 'admin',
          privileges: ['read', 'write', 'delete'],
          tenant: { connect: { id: tenant.id } },
        },
      })

      const person = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `Member-${rid}`, lastName: `User-${rid}` },
      })

      const member = await tx.member.create({
        data: {
          person: { connect: { id: person.id } },
          memberUserName: `member-${rid}`,
          passwordHash: 'hashed-password',
          roles: { connect: [{ id: role.id }] },
          memberOnTenants: { connect: [{ id: tenant.id }] },
        },
        include: { roles: true, memberOnTenants: true },
      })

      expect(member.memberUserName).toBe(`member-${rid}`)
      expect(member.roles).toHaveLength(1)
      expect(member.roles[0].slug).toBe('admin')
    })
  })

  it('creates invites for a tenant', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const tenant = await tx.tenant.create({
        data: {
          name: `InviteTenant ${rid}`,
          subdomain: `invitetenant-${rid}`,
          secretKey: `sk-invite-${rid}`,
        },
      })

      await tx.tenantInvite.createMany({
        data: [
          { tenantId: tenant.id, email: `invite1-${rid}@test.com` },
          { tenantId: tenant.id, email: `invite2-${rid}@test.com` },
        ],
      })

      const invites = await tx.tenantInvite.findMany({
        where: { tenantId: tenant.id },
      })

      expect(invites).toHaveLength(2)
      expect(invites.map((i) => i.email).sort()).toEqual([
        `invite1-${rid}@test.com`,
        `invite2-${rid}@test.com`,
      ])
    })
  })
})
