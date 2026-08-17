import type { SkillHubResponse } from './types.ts'

interface CacheEntry {
  refreshedAt: string
  storedAt: number
  value: unknown
}

/** Bounded in-memory cache that serves a recent entry when SkillHub is unavailable. */
export class SkillHubCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly pending = new Map<string, Promise<unknown>>()

  constructor(private readonly ttlMs: number, private readonly staleTtlMs: number) {}

  /** Return one cached or refreshed public SkillHub resource. */
  async get<T>(key: string, load: () => Promise<T>): Promise<SkillHubResponse<T>> {
    const existing = this.entries.get(key)
    const now = Date.now()
    if (existing !== undefined && now - existing.storedAt <= this.ttlMs) return this.result(existing, 'cached')
    try {
      const value = await this.load(key, load)
      const entry: CacheEntry = { refreshedAt: new Date().toISOString(), storedAt: Date.now(), value }
      this.entries.set(key, entry)
      return this.result(entry, 'live')
    } catch (error) {
      if (existing !== undefined && now - existing.storedAt <= this.ttlMs + this.staleTtlMs) return this.result(existing, 'stale')
      throw error
    }
  }

  private async load<T>(key: string, load: () => Promise<T>): Promise<T> {
    const active = this.pending.get(key) as Promise<T> | undefined
    if (active !== undefined) return active
    const pending = load()
    this.pending.set(key, pending)
    try {
      return await pending
    } finally {
      this.pending.delete(key)
    }
  }

  private result<T>(entry: CacheEntry, state: SkillHubResponse<T>['cache']['state']): SkillHubResponse<T> {
    return { cache: { refreshedAt: entry.refreshedAt, state }, data: entry.value as T }
  }
}
