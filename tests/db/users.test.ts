import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('User creation', () => {
  it('creates a user linked to a person', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const person = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `User-${rid}`, lastName: `Person-${rid}` },
      })

      const user = await tx.user.create({
        data: {
          name: `username-${rid}`,
          passwordHash: 'bcrypt-hash-value',
          email: `user-${rid}@plpas.com`,
          person: { connect: { id: person.id } },
        },
        include: { person: true },
      })

      expect(user.name).toBe(`username-${rid}`)
      expect(user.email).toBe(`user-${rid}@plpas.com`)
      expect(user.person.firstName).toBe(`User-${rid}`)
    })
  })

  it('assigns user to a tenant with roles', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const person = await tx.person.create({
        data: { salutation: 'Ms.', firstName: `TenantUser-${rid}`, lastName: `Role-${rid}` },
      })

      const tenant = await tx.tenant.create({
        data: {
          name: `UserTenant ${rid}`,
          subdomain: `usertenant-${rid}`,
          secretKey: `sk-ut-${rid}`,
        },
      })

      const role = await tx.tenantRole.create({
        data: {
          name: 'Staff',
          slug: 'staff',
          privileges: ['read', 'write'],
          tenant: { connect: { id: tenant.id } },
        },
      })

      const user = await tx.user.create({
        data: {
          name: `tuser-${rid}`,
          passwordHash: 'hash',
          email: `tuser-${rid}@plpas.com`,
          person: { connect: { id: person.id } },
          tenants: { connect: [{ id: tenant.id }] },
          roles: { connect: [{ id: role.id }] },
        },
        include: { tenants: true, roles: true, person: true },
      })

      expect(user.tenants).toHaveLength(1)
      expect(user.tenants[0].name).toBe(`UserTenant ${rid}`)
      expect(user.roles).toHaveLength(1)
      expect(user.roles[0].slug).toBe('staff')
    })
  })
})
