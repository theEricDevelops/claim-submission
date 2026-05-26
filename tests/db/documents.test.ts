import { describe, it, expect } from 'vitest'
import { withRollback, testId } from './setup'

describe('Document on a Job', () => {
  it('uploads a document to a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      // Uploader contact
      const person = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `Uploader-${rid}`, lastName: `User-${rid}` },
      })
      const uploader = await tx.contact.create({
        data: { type: 'PERSON', name: `Uploader ${rid}`, person: { connect: { id: person.id } } },
      })

      // Job
      const carrier = await tx.company.create({ data: { name: `DocCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `D-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '500 Doc Dr', city: 'Nashville', state: 'TN', zip: '37201', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      const doc = await tx.document.create({
        data: {
          job: { connect: { id: job.id } },
          uploadedBy: { connect: { id: uploader.id } },
          fileName: 'estimate.pdf',
          mimeType: 'application/pdf',
          fileSize: 102400,
          storageKey: `uploads/${rid}/estimate.pdf`,
          category: 'ESTIMATE',
        },
        include: { job: true, uploadedBy: true },
      })

      expect(doc.fileName).toBe('estimate.pdf')
      expect(doc.mimeType).toBe('application/pdf')
      expect(doc.fileSize).toBe(102400)
      expect(doc.category).toBe('ESTIMATE')
      expect(doc.uploadedBy.name).toBe(`Uploader ${rid}`)
    })
  })

  it('finds documents by category on a job', async () => {
    await withRollback(async (tx) => {
      const rid = testId()

      const person = await tx.person.create({
        data: { salutation: 'Mr.', firstName: `CatUploader-${rid}`, lastName: `User-${rid}` },
      })
      const uploader = await tx.contact.create({
        data: { type: 'PERSON', name: `CatUploader ${rid}`, person: { connect: { id: person.id } } },
      })
      const carrier = await tx.company.create({ data: { name: `CatCarrier ${rid}` } })
      const policy = await tx.policy.create({
        data: { policyNumber: `CAT-POL-${rid}`, carrier: { connect: { id: carrier.id } } },
      })
      const addr = await tx.address.create({
        data: { street: '600 Cat Ct', city: 'Memphis', state: 'TN', zip: '38101', type: 'loss' },
      })
      const job = await tx.job.create({
        data: { status: 'ACTIVE', policy: { connect: { id: policy.id } }, lossAddress: { connect: { id: addr.id } } },
      })

      await tx.document.createMany({
        data: [
          { jobId: job.id, uploadedById: uploader.id, fileName: 'photo1.jpg', storageKey: `k-${rid}-1`, category: 'PHOTO' },
          { jobId: job.id, uploadedById: uploader.id, fileName: 'photo2.jpg', storageKey: `k-${rid}-2`, category: 'PHOTO' },
          { jobId: job.id, uploadedById: uploader.id, fileName: 'report.pdf', storageKey: `k-${rid}-3`, category: 'REPORT' },
        ],
      })

      const photos = await tx.document.findMany({
        where: { jobId: job.id, category: 'PHOTO' },
      })
      expect(photos).toHaveLength(2)

      const reports = await tx.document.findMany({
        where: { jobId: job.id, category: 'REPORT' },
      })
      expect(reports).toHaveLength(1)
    })
  })
})
