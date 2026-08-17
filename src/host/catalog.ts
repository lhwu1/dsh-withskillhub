import type { SkillHubCategory, SkillHubDetail, SkillHubFile, SkillHubOverview, SkillHubPage, SkillHubSkill } from './types.ts'

/** Failed SkillHub HTTP response with its original status code. */
export class SkillHubHttpError extends Error {
  constructor(readonly status: number, path: string) { super(`SkillHub request failed with HTTP ${status}: ${path}`) }
}

/** SkillHub did not respond before the configured request deadline. */
export class SkillHubTimeoutError extends Error { constructor() { super('SkillHub request timed out') } }

/** The SkillHub endpoint could not be reached. */
export class SkillHubNetworkError extends Error { constructor() { super('SkillHub could not be reached') } }

/** A SkillHub JSON response did not match the public API fields this plugin consumes. */
export class SkillHubPayloadError extends Error { constructor(path: string) { super(`SkillHub returned an invalid response: ${path}`) } }

/** Query controls accepted by the SkillHub public catalogue API. */
export interface CatalogueQuery {
  category?: string
  keyword?: string
  page: number
  pageSize: number
  source?: string
  sortBy?: 'downloads' | 'score' | 'updated_at'
}

type Parser<T> = (value: unknown, path: string) => T

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
    const payload = await this.json('/api/skills?' + params, parseCatalogue)
    if (payload.code !== 0) throw new Error(`SkillHub catalogue request failed: ${payload.message ?? 'unknown response'}`)
    return { skills: payload.data.skills, total: payload.data.total }
  }

  /** List active top-level categories in display order. */
  async categories(): Promise<readonly SkillHubCategory[]> {
    const payload = await this.json('/api/v1/categories', parseCategories)
    return payload.items.filter(item => item.active !== false).sort((left, right) => left.sortOrder - right.sortOrder)
  }

  /** Get a detail record for one namespaced skill. */
  detail(slug: string, namespace?: string): Promise<SkillHubDetail> {
    return this.json(`/api/v1/skills/${encodeURIComponent(slug)}${queryString({ namespace })}`, parseDetail)
  }

  /** List every file belonging to one selected version. */
  async files(slug: string, namespace: string | undefined, version: string | undefined): Promise<readonly SkillHubFile[]> {
    return (await this.json(`/api/v1/skills/${encodeURIComponent(slug)}/files${queryString({ namespace, version })}`, parseFiles)).files
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

  private async json<T>(path: string, parse: Parser<T>): Promise<T> {
    const response = await this.request(path)
    try {
      return parse(await response.json(), path)
    } catch (error) {
      if (error instanceof SkillHubPayloadError) throw error
      throw new SkillHubPayloadError(path)
    }
  }

  private async request(path: string): Promise<Response> {
    let response: Response
    try {
      response = await fetch(`${this.apiBaseUrl}${path}`, { signal: AbortSignal.timeout(this.requestTimeoutMs) })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') throw new SkillHubTimeoutError()
      throw new SkillHubNetworkError()
    }
    if (!response.ok) throw new SkillHubHttpError(response.status, path)
    return response
  }
}

/** Parse the SkillHub catalogue response before it reaches the marketplace UI. */
function parseCatalogue(value: unknown, path: string): { code: number, data: { skills: SkillHubSkill[], total: number }, message?: string } {
  const record = object(value, path)
  const data = object(required(record, 'data', path), `${path}.data`)
  return { code: number(required(record, 'code', path), `${path}.code`), data: { skills: array(required(data, 'skills', path), `${path}.data.skills`, parseSkill), total: number(required(data, 'total', path), `${path}.data.total`) }, ...optionalString(record, 'message', path) }
}

/** Parse the active category list from SkillHub. */
function parseCategories(value: unknown, path: string): { items: Array<SkillHubCategory & { active?: boolean }> } {
  const record = object(value, path)
  return { items: array(required(record, 'items', path), `${path}.items`, parseCategory) }
}

/** Parse SkillHub detail fields consumed by the installer and detail views. */
function parseDetail(value: unknown, path: string): SkillHubDetail {
  const record = object(value, path)
  const skill = object(required(record, 'skill', path), `${path}.skill`)
  return {
    ...optionalObject(record, 'latestVersion', path, parseVersion),
    ...optionalObject(record, 'namespace', path, parseNamespace),
    ...optionalObject(record, 'owner', path, parseOwner),
    ...optionalObject(record, 'publisher', path, parsePublisher),
    skill: {
      ...optionalString(skill, 'category', path), ...optionalString(skill, 'displayName', path), ...optionalString(skill, 'iconUrl', path),
      ...optionalObject(skill, 'labels', path, parseLabels), slug: string(required(skill, 'slug', path), `${path}.skill.slug`),
      ...optionalString(skill, 'source', path), ...optionalObject(skill, 'stats', path, parseStats),
      ...optionalArray(skill, 'subCategories', path, parseSubCategory), ...optionalString(skill, 'summary', path), ...optionalString(skill, 'summary_zh', path), ...optionalNumber(skill, 'updatedAt', path),
    },
    slug: string(required(record, 'slug', path), `${path}.slug`),
  }
}

/** Parse the file manifest used before downloading a skill. */
function parseFiles(value: unknown, path: string): { files: SkillHubFile[] } {
  const record = object(value, path)
  return { files: array(required(record, 'files', path), `${path}.files`, parseFile) }
}

function parseSkill(value: unknown, path: string): SkillHubSkill {
  const record = object(value, path)
  return {
    ...optionalString(record, 'category', path), ...optionalString(record, 'description', path), ...optionalString(record, 'description_zh', path), ...optionalNumber(record, 'downloads', path), ...optionalString(record, 'iconUrl', path), ...optionalObject(record, 'labels', path, parseLabels), ...optionalString(record, 'name', path), ...optionalObject(record, 'namespace', path, parseNamespace), ...optionalString(record, 'ownerName', path), slug: string(required(record, 'slug', path), `${path}.slug`), ...optionalString(record, 'source', path), ...optionalNumber(record, 'stars', path), ...optionalArray(record, 'subCategories', path, parseSubCategory), ...optionalNumber(record, 'updated_at', path), ...optionalBoolean(record, 'verified', path), ...optionalString(record, 'version', path),
  }
}

function parseCategory(value: unknown, path: string): SkillHubCategory & { active?: boolean } {
  const record = object(value, path)
  return { key: string(required(record, 'key', path), `${path}.key`), name: string(required(record, 'name', path), `${path}.name`), sortOrder: number(required(record, 'sortOrder', path), `${path}.sortOrder`), ...optionalString(record, 'nameEn', path), ...optionalBoolean(record, 'active', path) }
}

function parseNamespace(value: unknown, path: string) { const record = object(value, path); return { ...optionalString(record, 'canonicalName', path), ...optionalString(record, 'displayName', path), ...optionalString(record, 'handle', path), ...optionalString(record, 'publicSlug', path) } }
function parseLabels(value: unknown, path: string) { const record = object(value, path); return optionalString(record, 'requires_api_key', path) }
function parseSubCategory(value: unknown, path: string) { const record = object(value, path); return { key: string(required(record, 'key', path), `${path}.key`), name: string(required(record, 'name', path), `${path}.name`) } }
function parseVersion(value: unknown, path: string) { const record = object(value, path); return { ...optionalString(record, 'changelog', path), ...optionalString(record, 'version', path) } }
function parseOwner(value: unknown, path: string) { const record = object(value, path); return { ...optionalString(record, 'displayName', path), ...optionalString(record, 'handle', path) } }
function parsePublisher(value: unknown, path: string) { const record = object(value, path); return { ...optionalString(record, 'name', path), ...optionalBoolean(record, 'verified', path) } }
function parseStats(value: unknown, path: string) { const record = object(value, path); return { ...optionalNumber(record, 'downloads', path), ...optionalNumber(record, 'installs', path), ...optionalNumber(record, 'stars', path), ...optionalNumber(record, 'versions', path) } }
function parseFile(value: unknown, path: string): SkillHubFile { const record = object(value, path); return { path: string(required(record, 'path', path), `${path}.path`), sha256: string(required(record, 'sha256', path), `${path}.sha256`), size: number(required(record, 'size', path), `${path}.size`) } }

function object(value: unknown, path: string): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SkillHubPayloadError(path); return value as Record<string, unknown> }
function required(record: Record<string, unknown>, key: string, path: string): unknown { if (!(key in record)) throw new SkillHubPayloadError(`${path}.${key}`); return record[key] }
function string(value: unknown, path: string): string { if (typeof value !== 'string') throw new SkillHubPayloadError(path); return value }
function number(value: unknown, path: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new SkillHubPayloadError(path); return value }
function boolean(value: unknown, path: string): boolean { if (typeof value !== 'boolean') throw new SkillHubPayloadError(path); return value }
function array<T>(value: unknown, path: string, parse: Parser<T>): T[] { if (!Array.isArray(value)) throw new SkillHubPayloadError(path); return value.map((item, index) => parse(item, `${path}[${index}]`)) }
function optionalString(record: Record<string, unknown>, key: string, _path: string): { [key: string]: string } | {} { return typeof record[key] === 'string' ? { [key]: record[key] } : {} }
function optionalNumber(record: Record<string, unknown>, key: string, _path: string): { [key: string]: number } | {} { return typeof record[key] === 'number' && Number.isFinite(record[key]) ? { [key]: record[key] } : {} }
function optionalBoolean(record: Record<string, unknown>, key: string, _path: string): { [key: string]: boolean } | {} { return typeof record[key] === 'boolean' ? { [key]: record[key] } : {} }
function optionalObject<T>(record: Record<string, unknown>, key: string, path: string, parse: Parser<T>): { [key: string]: T } | {} { return typeof record[key] === 'object' && record[key] !== null && !Array.isArray(record[key]) ? { [key]: parse(record[key], `${path}.${key}`) } : {} }
function optionalArray<T>(record: Record<string, unknown>, key: string, path: string, parse: Parser<T>): { [key: string]: T[] } | {} { return Array.isArray(record[key]) ? { [key]: array(record[key], `${path}.${key}`, parse) } : {} }

/** Remove frontmatter and bound the published Markdown shown in the browser. */
export function skillOverviewFromMarkdown(markdown: string, maxCharacters: number): SkillHubOverview {
  const content = markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
  if (content.length <= maxCharacters) return { content, truncated: false }
  return { content: content.slice(0, maxCharacters).trimEnd(), truncated: true }
}

/** Serialize only defined query fields. */
function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value.length > 0) params.set(key, value)
  const encoded = params.toString()
  return encoded.length === 0 ? '' : `?${encoded}`
}
