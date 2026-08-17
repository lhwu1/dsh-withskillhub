import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { SkillHubHttpError, SkillHubNetworkError, SkillHubPayloadError, SkillHubTimeoutError } from './catalog.ts'
import type {} from './index.ts'

export const name = 'dsh-withskillhub-web'
export const inject = ['webServer', 'skillHub']

const MAX_BODY_BYTES = 16 * 1024
const MAX_PAGE_SIZE = 48

/** Expose the marketplace service over same-origin routes for the browser plugin. */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const catalog = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/catalog.json',
      async handler(request, response) {
        try {
          const query = new URL(request.url ?? '/', 'http://localhost').searchParams
          const page = integerQuery(query.get('page'), 1, 1, 100_000)
          const pageSize = integerQuery(query.get('pageSize'), 24, 1, MAX_PAGE_SIZE)
          const sortBy = query.get('sortBy')
          if (sortBy !== null && sortBy !== 'downloads' && sortBy !== 'score' && sortBy !== 'updated_at') throw new TypeError('Unsupported SkillHub sort order')
          sendJson(response, 200, await ctx.skillHub.list({
            category: optionalQuery(query.get('category')),
            keyword: optionalQuery(query.get('keyword')),
            page,
            pageSize,
            source: optionalQuery(query.get('source')),
            ...(sortBy === null ? {} : { sortBy }),
          }))
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const categories = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/categories.json',
      async handler(_request, response) {
        try {
          sendJson(response, 200, await ctx.skillHub.categories())
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const detail = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/detail.json',
      async handler(request, response) {
        try {
          const query = new URL(request.url ?? '/', 'http://localhost').searchParams
          sendJson(response, 200, await ctx.skillHub.detail(requiredQuery(query.get('slug'), 'slug'), optionalQuery(query.get('namespace'))))
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const overview = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/overview.json',
      async handler(request, response) {
        try {
          const query = new URL(request.url ?? '/', 'http://localhost').searchParams
          sendJson(response, 200, await ctx.skillHub.overview(
            requiredQuery(query.get('slug'), 'slug'),
            optionalQuery(query.get('namespace')),
            optionalQuery(query.get('version')),
          ))
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const installed = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/installed.json',
      async handler(_request, response) {
        try {
          sendJson(response, 200, await ctx.skillHub.installed())
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const installedDetail = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/installed-detail.json',
      async handler(request, response) {
        try {
          const query = new URL(request.url ?? '/', 'http://localhost').searchParams
          sendJson(response, 200, await ctx.skillHub.installedDetail(requiredQuery(query.get('directory'), 'directory')))
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const install = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/install.json',
      async handler(request, response) {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        try {
          const input = await readJson(request)
          if (!isInstallRequest(input)) throw new TypeError('SkillHub installation request is invalid')
          sendJson(response, 201, await ctx.skillHub.install(input.slug, input.namespace, input.version))
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    const manage = ctx.webServer.register({
      kind: 'exact', path: '/dsh-withskillhub/manage.json',
      async handler(request, response) {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        try {
          const input = await readJson(request)
          if (!isManageRequest(input)) throw new TypeError('SkillHub management request is invalid')
          switch (input.action) {
            case 'delete':
              await ctx.skillHub.remove(input.directory)
              sendJson(response, 200, { status: 'deleted' })
              return
            case 'set-enabled':
              sendJson(response, 200, await ctx.skillHub.setEnabled(input.directory, input.enabled))
              return
            case 'check-update':
              sendJson(response, 200, await ctx.skillHub.checkUpdate(input.directory))
              return
          }
        } catch (error) {
          sendError(response, error)
        }
      },
    })
    return () => { catalog(); categories(); detail(); overview(); installed(); installedDetail(); install(); manage() }
  }, 'dsh-withskillhub: marketplace routes')
}

/** Parse a bounded JSON body from a same-origin browser request. */
async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.byteLength
    if (size > MAX_BODY_BYTES) throw new RangeError('SkillHub request body exceeds 16 KiB')
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Restrict the write route to its intentionally small input object. */
function isInstallRequest(input: unknown): input is { slug: string, namespace?: string, version?: string } {
  if (typeof input !== 'object' || input === null) return false
  const value = input as Record<string, unknown>
  return typeof value.slug === 'string'
    && (value.namespace === undefined || typeof value.namespace === 'string')
    && (value.version === undefined || typeof value.version === 'string')
}

/** Restrict management operations to known local directory identifiers. */
function isManageRequest(input: unknown): input is
  | { action: 'check-update' | 'delete', directory: string }
  | { action: 'set-enabled', directory: string, enabled: boolean } {
  if (typeof input !== 'object' || input === null) return false
  const value = input as Record<string, unknown>
  if (typeof value.directory !== 'string' || value.directory.length === 0) return false
  switch (value.action) {
    case 'check-update':
    case 'delete':
      return true
    case 'set-enabled':
      return typeof value.enabled === 'boolean'
    default:
      return false
  }
}

/** Return JSON without allowing intermediary caches to retain marketplace state. */
function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

/** Convert service and request failures into an actionable same-origin response. */
function sendError(response: ServerResponse, error: unknown): void {
  if (error instanceof SkillHubTimeoutError) return sendJson(response, 504, { error: '连接 SkillHub 超时，请稍后重试。' })
  if (error instanceof SkillHubNetworkError) return sendJson(response, 503, { error: '暂时无法连接 SkillHub，请检查网络后重试。' })
  if (error instanceof SkillHubPayloadError) return sendJson(response, 502, { error: 'SkillHub 暂时不可用，请稍后重试。' })
  if (error instanceof SkillHubHttpError && error.status === 404) return sendJson(response, 404, { error: 'SkillHub 未找到该技能，它可能已下架。' })
  if (error instanceof SkillHubHttpError) return sendJson(response, 502, { error: 'SkillHub 暂时无法处理请求，请稍后重试。' })
  const message = error instanceof Error ? error.message : String(error)
  sendJson(response, 400, { error: message })
}

/** Parse an integer query parameter within its permitted operational range. */
function integerQuery(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new TypeError(`Query value must be an integer from ${minimum} to ${maximum}`)
  return parsed
}

/** Omit blank filters rather than forwarding them to SkillHub. */
function optionalQuery(value: string | null): string | undefined {
  return value === null || value.trim().length === 0 ? undefined : value.trim()
}

/** Require one non-empty identity parameter. */
function requiredQuery(value: string | null, name: string): string {
  const result = optionalQuery(value)
  if (result === undefined) throw new TypeError(`Missing SkillHub ${name}`)
  return result
}
