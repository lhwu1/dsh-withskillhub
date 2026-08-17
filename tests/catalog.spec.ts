import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillHubCache } from '../src/host/cache.ts'
import { SkillHubClient, SkillHubPayloadError, SkillHubTimeoutError } from '../src/host/catalog.ts'

const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

describe('SkillHub catalogue boundary', () => {
  it('rejects a malformed marketplace response instead of treating it as typed data', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ code: 0, data: { skills: [{ slug: 42 }], total: 1 } })))
    const client = new SkillHubClient('https://api.skillhub.cn', 1_000)
    await expect(client.list({ page: 1, pageSize: 24 })).rejects.toBeInstanceOf(SkillHubPayloadError)
  })

  it('reports an aborted request as a timeout', async () => {
    globalThis.fetch = vi.fn(async () => { throw new DOMException('Timed out', 'TimeoutError') })
    const client = new SkillHubClient('https://api.skillhub.cn', 1_000)
    await expect(client.categories()).rejects.toBeInstanceOf(SkillHubTimeoutError)
  })

  it('serves an expired cache entry when refreshing SkillHub fails', async () => {
    const cache = new SkillHubCache(-1, 60_000)
    await expect(cache.get('catalogue', async () => 'first')).resolves.toMatchObject({ data: 'first', cache: { state: 'live' } })
    await expect(cache.get('catalogue', async () => { throw new Error('offline') })).resolves.toMatchObject({ data: 'first', cache: { state: 'stale' } })
  })
})
