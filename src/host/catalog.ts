import type { SkillHubCategory, SkillHubDetail, SkillHubFile, SkillHubOverview, SkillHubPage, SkillHubSkill } from './types.ts'

/** Failed SkillHub HTTP response with its original status code. */
export class SkillHubHttpError extends Error {
  constructor(readonly status: number, path: string) {
    super(`SkillHub request failed with HTTP ${status}: ${path}`)
  }
}

/** Query controls accepted by the SkillHub public catalogue API. */
export interface CatalogueQuery {
  category?: string
  keyword?: string
  page: number
  pageSize: number
  source?: string
  sortBy?: 'downloads' | 'score' | 'updated_at'
}

/** HTTP adapter for SkillHub's publicly readable API. */
export class SkillHubClient {
  constructor(private readonly apiBaseUrl: string, private readonly requestTimeoutMs: number) {}

  /** List marketplace entries using a bounded page request. */
  async list(query: CatalogueQuery): Promise<SkillHubPage> {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
    if (query.sortBy !== undefined) params.set('sortBy', query.sortBy)
    if (query.keyword?.trim()) params.set('keyword', query.keyword.trim())
    if (query.category !== undefined) params.set('category', query.category)
    if (query.source !== undefined && query.source !== 'all') params.set('source', query.source)
    const payload = await this.json<{ code?: number, data?: { skills?: SkillHubSkill[], total?: number }, message?: string }>(`/api/skills?${params}`)
    if (payload.code !== 0) throw new Error(`SkillHub catalogue request failed: ${payload.message ?? 'unknown response'}`)
    return { skills: payload.data?.skills ?? [], total: payload.data?.total ?? 0 }
  }

  /** List active top-level categories in display order. */
  async categories(): Promise<readonly SkillHubCategory[]> {
    const payload = await this.json<{ items?: Array<SkillHubCategory & { active?: boolean }> }>('/api/v1/categories')
    return (payload.items ?? []).filter(item => item.active !== false).sort((left, right) => left.sortOrder - right.sortOrder)
  }

  /** Get a detail record for one namespaced skill. */
  async detail(slug: string, namespace?: string): Promise<SkillHubDetail> {
    return this.json<SkillHubDetail>(`/api/v1/skills/${encodeURIComponent(slug)}${queryString({ namespace })}`)
  }

  /** List every file belonging to one selected version. */
  async files(slug: string, namespace: string | undefined, version: string | undefined): Promise<readonly SkillHubFile[]> {
    const payload = await this.json<{ files?: SkillHubFile[] }>(`/api/v1/skills/${encodeURIComponent(slug)}/files${queryString({ namespace, version })}`)
    return payload.files ?? []
  }

  /** Read one file without interpreting its bytes. */
  async file(slug: string, path: string, namespace: string | undefined, version: string | undefined): Promise<Uint8Array> {
    const response = await this.request(`/api/v1/skills/${encodeURIComponent(slug)}/file${queryString({ path, namespace, version })}`)
    return new Uint8Array(await response.arrayBuffer())
  }

  /** Read the published skill instructions for the detailed marketplace overview. */
  async overview(slug: string, namespace: string | undefined, version: string | undefined, maxBytes: number, maxCharacters: number): Promise<SkillHubOverview> {
    const entry = (await this.files(slug, namespace, version)).find(file => file.path === 'SKILL.md')
    if (entry === undefined) return { truncated: false }
    if (entry.size > maxBytes) return { truncated: true }
    const bytes = await this.file(slug, entry.path, namespace, version)
    if (bytes.byteLength > maxBytes) throw new Error('SkillHub overview exceeds the configured byte limit')
    return skillOverviewFromMarkdown(new TextDecoder('utf-8', { fatal: true }).decode(bytes), maxCharacters)
  }

  private async json<T>(path: string): Promise<T> {
    const response = await this.request(path)
    return response.json() as Promise<T>
  }

  private async request(path: string): Promise<Response> {
    const signal = AbortSignal.timeout(this.requestTimeoutMs)
    const response = await fetch(`${this.apiBaseUrl}${path}`, { signal })
    if (!response.ok) throw new SkillHubHttpError(response.status, path)
    return response
  }
}

/** Remove frontmatter and bound the published Markdown shown in the browser. */
export function skillOverviewFromMarkdown(markdown: string, maxCharacters: number): SkillHubOverview {
  const content = markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
  if (content.length <= maxCharacters) return { content, truncated: false }
  return { content: content.slice(0, maxCharacters).trimEnd(), truncated: true }
}

/** Serialize only defined query fields. */
function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value.length > 0) params.set(key, value)
  }
  const encoded = params.toString()
  return encoded.length === 0 ? '' : `?${encoded}`
}
