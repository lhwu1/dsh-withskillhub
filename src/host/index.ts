import { fileURLToPath } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { SkillHubCache } from './cache.ts'
import { SkillHubClient, type CatalogueQuery } from './catalog.ts'
import { SkillInstaller } from './installer.ts'
import type { InstalledSkill, InstalledSkillDetail, SkillHubCategory, SkillHubDetail, SkillHubOverview, SkillHubPage, SkillHubResponse, SkillUpdateResult } from './types.ts'

/** Deployment configuration for the SkillHub marketplace service. */
export interface Config {
  /** Public SkillHub API origin. */
  apiBaseUrl?: string
  /** Directory exclusively managed by this bundle and scanned for installed skills. */
  skillsRoot?: string
  /** Largest number of files accepted in one marketplace skill. */
  maxFiles?: number
  /** Largest aggregate uncompressed skill size accepted from SkillHub. */
  maxPackageBytes?: number
  /** Timeout for each SkillHub API request. */
  requestTimeoutMs?: number
  /** Largest SKILL.md file read to render an overview in the browser. */
  maxOverviewBytes?: number
  /** Largest rendered overview length after frontmatter is removed. */
  maxOverviewCharacters?: number
  /** How long a successful SkillHub response is reused before refreshing it. */
  cacheTtlMs?: number
  /** How long an expired response may be shown after a refresh failure. */
  staleCacheTtlMs?: number
}

type ResolvedConfig = Required<Config>

/** Service that owns SkillHub discovery and managed local installation. */
export class SkillHubService extends Service {
  static Config: z<Config> = z.object({
    apiBaseUrl: z.string().default('https://api.skillhub.cn'),
    skillsRoot: z.string().default(dshHomePath('skillhub', 'skills')),
    maxFiles: z.number().step(1).min(1).default(200),
    maxPackageBytes: z.number().step(1).min(1).default(25 * 1024 * 1024),
    requestTimeoutMs: z.number().step(1).min(1).default(15_000),
    maxOverviewBytes: z.number().step(1).min(1).default(256 * 1024),
    maxOverviewCharacters: z.number().step(1).min(1).default(20_000),
    cacheTtlMs: z.number().step(1).min(0).default(5 * 60_000),
    staleCacheTtlMs: z.number().step(1).min(0).default(24 * 60 * 60_000),
  })

  /** Resolved local installation directory used by the filesystem provider. */
  readonly skillsRoot: string
  /** Package directory watched by the HMR row supplied by this bundle. */
  readonly packageRoot: string
  private readonly client: SkillHubClient
  private readonly installer: SkillInstaller
  private readonly cache: SkillHubCache
  private readonly maxOverviewBytes: number
  private readonly maxOverviewCharacters: number

  constructor(ctx: Context, config: Config) {
    super(ctx, 'skillHub')
    const resolved = config as ResolvedConfig
    this.skillsRoot = resolved.skillsRoot
    this.packageRoot = fileURLToPath(new URL('../../', import.meta.url))
    this.client = new SkillHubClient(resolved.apiBaseUrl.replace(/\/+$/, ''), resolved.requestTimeoutMs)
    this.installer = new SkillInstaller(this.client, resolved.skillsRoot, resolved.maxFiles, resolved.maxPackageBytes)
    this.cache = new SkillHubCache(resolved.cacheTtlMs, resolved.staleCacheTtlMs)
    this.maxOverviewBytes = resolved.maxOverviewBytes
    this.maxOverviewCharacters = resolved.maxOverviewCharacters
  }

  /** Fetch one market page. */
  list(query: CatalogueQuery): Promise<SkillHubResponse<SkillHubPage>> {
    return this.cache.get(`catalogue:${JSON.stringify(query)}`, () => this.client.list(query))
  }

  /** Fetch current marketplace categories. */
  categories(): Promise<SkillHubResponse<readonly SkillHubCategory[]>> {
    return this.cache.get('categories', () => this.client.categories())
  }

  /** Fetch one skill's detail record. */
  detail(slug: string, namespace?: string): Promise<SkillHubResponse<SkillHubDetail>> {
    return this.cache.get(`detail:${namespace ?? ''}/${slug}`, () => this.client.detail(slug, namespace))
  }

  /** Fetch the full published SKILL.md body for a selected marketplace entry. */
  overview(slug: string, namespace?: string, version?: string): Promise<SkillHubResponse<SkillHubOverview>> {
    return this.cache.get(`overview:${namespace ?? ''}/${slug}/${version ?? ''}`, () => this.client.overview(slug, namespace, version, this.maxOverviewBytes, this.maxOverviewCharacters))
  }

  /** Atomically install or update one selected skill. */
  install(slug: string, namespace?: string, version?: string): Promise<InstalledSkill> {
    return this.installer.install(slug, namespace, version)
  }

  /** List skills installed through this bundle. */
  installed(): Promise<readonly InstalledSkill[]> {
    return this.installer.installedWithMetadata()
  }

  /** Read local installation details and the latest release metadata when available. */
  async installedDetail(directory: string): Promise<InstalledSkillDetail> {
    const local = await this.installer.localDetail(directory, this.maxOverviewBytes, this.maxOverviewCharacters)
    const sourceUrl = skillHubUrl(local.record.slug, local.record.namespace)
    try {
      const remote = await this.detail(local.record.slug, local.record.namespace)
      return {
        ...local,
        changelog: remote.data.latestVersion?.changelog,
        latestVersion: remote.data.latestVersion?.version,
        sourceUrl,
      }
    } catch {
      return { ...local, sourceUrl }
    }
  }

  /** Change whether one managed skill is visible to the model. */
  setEnabled(directory: string, enabled: boolean): Promise<InstalledSkill> {
    return this.installer.setEnabled(directory, enabled)
  }

  /** Delete one managed skill from its dedicated local root. */
  remove(directory: string): Promise<void> {
    return this.installer.remove(directory)
  }

  /** Check SkillHub and install a newer release when one exists. */
  checkUpdate(directory: string): Promise<SkillUpdateResult> {
    return this.installer.checkUpdate(directory)
  }
}

/** Build the public SkillHub marketplace URL for one installed skill. */
function skillHubUrl(slug: string, namespace?: string): string {
  const base = 'https://skillhub.cn/skills'
  return namespace === undefined ? base : `${base}/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}`
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    skillHub: SkillHubService
  }
}

export default SkillHubService
