import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * Unique prefix per test run to enable targeted cleanup.
 */
export function testId(): string {
  return `test-${randomUUID().slice(0, 8)}`
}

export { prisma }

/**
 * Run test logic inside a Prisma transaction, then always roll back.
 *
 * If `fn` throws (e.g. from an `expect` failure), the transaction is
 * aborted and the original error propagates — vitest marks it as failed.
 *
 * If `fn` succeeds, we force-rollback so no test data persists.
 *
 * NOTE: Do NOT use this helper when you expect a Prisma error inside
 * `fn` (e.g. `.rejects.toThrow()` on a constraint violation). A
 * failed query aborts the transaction and poisons the connection for
 * subsequent tests. Use `prisma` directly instead.
 */
export async function withRollback(
  fn: (tx: typeof prisma) => Promise<void>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await fn(tx as unknown as typeof prisma)
    throw new Error('__ROLLBACK__')
  }).catch((e) => {
    if (e instanceof Error && e.message === '__ROLLBACK__') return
    throw e
  })
}
