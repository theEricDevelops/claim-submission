import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Note (polymorphic)', () => {
  it('creates a note on a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const author = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `Author-${rid}`, lastName: `Note-${rid}` },
      })
      const carrier = await tx.company.create({ data: { name: `NoteCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `NOTE-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '700 Note St', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      const note = await tx.note.create({
        data: {
          noteableType: 'JOB',
          noteableId: job.id,
          author: { connect: { id: author.id } },
          body: 'Initial inspection completed. Water damage in basement.',
        },
        include: { author: true },
      })

      expect(note.noteableType).toBe('JOB')
      expect(note.noteableId).toBe(job.id)
      expect(note.body).toContain('Water damage')
      expect(note.author.firstName).toBe(`Author-${rid}`)
    })
  })

  it('finds notes by polymorphic target', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const author = await tx.person.create({
        data: { salutation: 'Ms.', firstName: `MultiNote-${rid}`, lastName: `Author-${rid}` },
      })
      const carrier = await tx.company.create({ data: { name: `MultiNote ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `MN-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '8 Multi Ln', city: 'Memphis', state: 'TN', zip: '38101', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      await tx.note.createMany({
        data: [
          { noteableType: 'JOB', noteableId: job.id, authorId: author.id, body: 'Note 1' },
          { noteableType: 'JOB', noteableId: job.id, authorId: author.id, body: 'Note 2' },
        ],
      })

      const notes = await tx.note.findMany({
        where: { noteableType: 'JOB', noteableId: job.id },
        orderBy: { createdAt: 'asc' },
      })

      expect(notes).toHaveLength(2)
      expect(notes[0].body).toBe('Note 1')
      expect(notes[1].body).toBe('Note 2')
    })
  })
})

describe('Activity', () => {
  it('records activity on a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const actor = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `Actor-${rid}`, lastName: `Act-${rid}` },
      })
      const carrier = await tx.company.create({ data: { name: `ActCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `ACT-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '9 Activity Blvd', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'DRAFT', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      const activity = await tx.activity.create({
        data: {
          activityType: 'RECORD',
          activityId: job.id,
          actionType: 'CREATED',
          actor: { connect: { id: actor.id } },
        },
        include: { actor: true },
      })

      expect(activity.activityType).toBe('RECORD')
      expect(activity.actionType).toBe('CREATED')
      expect(activity.activityId).toBe(job.id)
      expect(activity.actor.firstName).toBe(`Actor-${rid}`)
    })
  })
})


