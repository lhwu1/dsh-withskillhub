import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SkillHubClient } from './catalog.ts'
import { SkillHubHttpError } from './catalog.ts'
import type { InstalledManifest, InstalledSkill, SkillHubDetail, SkillHubFile, SkillUpdateResult } from './types.ts'

const MANIFEST_FILE = '.dsh-withskillhub.json'
const DISABLED_ENTRY_FILE = '.dsh-withskillhub-disabled.md'

/** Validate a SkillHub-relative file name before it reaches the local filesystem. */
export function safeRelativePath(path: string): string {
  if (path.length === 0 || path.includes('\0') || isAbsolute(path)) throw new Error(`SkillHub file path is invalid: ${JSON.stringify(path)}`)
  const normalized = path.replaceAll('\\', '/')
  const segments = normalized.split('/')
  if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error(`SkillHub file path escapes its skill directory: ${JSON.stringify(path)}`)
  }
  return segments.join(sep)
}

/** Derive one DSH-valid skill identifier for a namespaced marketplace entry. */
export function dshSkillName(slug: string, namespace?: string): string {
  const normalizedNamespace = (namespace ?? 'skillhub').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
  const normalizedSlug = slug.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
  if (normalizedNamespace.length === 0 || normalizedSlug.length === 0) throw new Error('SkillHub skill identity cannot be converted to a DSH skill name')
  return `skillhub-${normalizedNamespace}-${normalizedSlug}`
}

/** Replace upstream frontmatter with DSH's required identifiers while retaining the instruction body. */
export function normalizeSkillMarkdown(content: string, name: string, description: string, source: { slug: string, namespace?: string, version?: string }): string {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const quotedDescription = JSON.stringify(description.trim().length > 0 ? description.trim() : `SkillHub skill ${source.slug}.`)
  const metadata = JSON.stringify({ skillhub: source })
  return [
    '---',
    `name: ${name}`,
    `description: ${quotedDescription}`,
    `metadata: ${metadata}`,
    '---',
    '',
    body.trimEnd(),
    '',
  ].join('\n')
}

/** Downloads one selected skill into a managed root and publishes it atomically. */
export class SkillInstaller {
  constructor(
    private readonly client: SkillHubClient,
    private readonly skillsRoot: string,
    private readonly maxFiles: number,
    private readonly maxPackageBytes: number,
  ) {}

  /** Install or update the selected skill. */
  async install(slug: string, namespace?: string, requestedVersion?: string): Promise<InstalledSkill> {
    const detail = await this.client.detail(slug, namespace)
    const resolvedNamespace = namespace ?? detail.namespace?.handle
    const version = requestedVersion ?? detail.latestVersion?.version
    const files = await this.client.files(slug, resolvedNamespace, version)
    this.validatePackage(files)
    const directory = dshSkillName(slug, resolvedNamespace)
    const root = resolve(this.skillsRoot)
    const target = resolve(root, directory)
    const previous = (await this.installed()).find(item => item.directory === directory)
    this.assertInside(root, target)
    const temporary = resolve(root, `.${directory}.install-${randomUUID()}`)
    this.assertInside(root, temporary)
    await mkdir(temporary, { recursive: true })
    try {
      await this.downloadFiles(temporary, slug, resolvedNamespace, version, detail, files)
      const record: InstalledSkill = {
        directory,
        enabled: previous?.enabled !== false,
        installedAt: new Date().toISOString(),
        ...(resolvedNamespace === undefined ? {} : { namespace: resolvedNamespace }),
        skillName: directory,
        slug,
        ...(version === undefined ? {} : { version }),
      }
      await this.replaceDirectory(root, temporary, target)
      if (record.enabled === false) await this.setDirectoryEnabled(target, false)
      await this.saveManifest(root, [...(await this.installed()).filter(item => item.directory !== record.directory), record])
      return record
    } catch (error) {
      await rm(temporary, { recursive: true, force: true })
      throw error
    }
  }

  /** Return the current managed installation records. */
  async installed(): Promise<readonly InstalledSkill[]> {
    try {
      const raw = await readFile(resolve(this.skillsRoot, MANIFEST_FILE), 'utf8')
      const parsed = JSON.parse(raw) as Partial<InstalledManifest>
      return parsed.version === 1 && Array.isArray(parsed.skills) ? parsed.skills : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  /** Enable or hide one installed skill from DSH's filesystem provider. */
  async setEnabled(directory: string, enabled: boolean): Promise<InstalledSkill> {
    const root = resolve(this.skillsRoot)
    const records = await this.installed()
    const record = records.find(item => item.directory === directory)
    if (record === undefined) throw new Error(`SkillHub skill is not installed: ${directory}`)
    if ((record.enabled !== false) === enabled) {
      if (record.enabled === enabled) return record
      const normalized = { ...record, enabled }
      await this.saveManifest(root, records.map(item => item.directory === directory ? normalized : item))
      return normalized
    }
    const target = resolve(root, record.directory)
    this.assertInside(root, target)
    await this.setDirectoryEnabled(target, enabled)
    const updated = { ...record, enabled }
    await this.saveManifest(root, records.map(item => item.directory === directory ? updated : item))
    return updated
  }

  /** Remove one managed skill and its installation record. */
  async remove(directory: string): Promise<void> {
    const root = resolve(this.skillsRoot)
    const records = await this.installed()
    const record = records.find(item => item.directory === directory)
    if (record === undefined) throw new Error(`SkillHub skill is not installed: ${directory}`)
    const target = resolve(root, record.directory)
    this.assertInside(root, target)
    await rm(target, { recursive: true, force: true })
    await this.saveManifest(root, records.filter(item => item.directory !== directory))
  }

  /** Install the latest release when the SkillHub record is newer. */
  async checkUpdate(directory: string): Promise<SkillUpdateResult> {
    const record = (await this.installed()).find(item => item.directory === directory)
    if (record === undefined) throw new Error(`SkillHub skill is not installed: ${directory}`)
    let detail: SkillHubDetail
    try {
      detail = await this.client.detail(record.slug, record.namespace)
    } catch (error) {
      if (error instanceof SkillHubHttpError && error.status === 404) return { record, status: 'removed' }
      throw error
    }
    const version = detail.latestVersion?.version
    if (version === undefined || version === record.version) return { record, status: 'up-to-date' }
    return { record: await this.install(record.slug, record.namespace, version), status: 'updated' }
  }

  private validatePackage(files: readonly SkillHubFile[]): void {
    if (files.length === 0) throw new Error('SkillHub returned no files for this skill')
    if (files.length > this.maxFiles) throw new Error(`SkillHub skill exceeds the configured ${this.maxFiles}-file limit`)
    let total = 0
    let hasSkill = false
    for (const file of files) {
      safeRelativePath(file.path)
      if (!/^[a-f0-9]{64}$/i.test(file.sha256)) throw new Error(`SkillHub file has an invalid SHA-256 value: ${file.path}`)
      if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error(`SkillHub file has an invalid size: ${file.path}`)
      total += file.size
      if (total > this.maxPackageBytes) throw new Error(`SkillHub skill exceeds the configured ${this.maxPackageBytes}-byte limit`)
      hasSkill ||= file.path === 'SKILL.md'
    }
    if (!hasSkill) throw new Error('SkillHub skill has no SKILL.md entry point')
  }

  private async downloadFiles(
    target: string,
    slug: string,
    namespace: string | undefined,
    version: string | undefined,
    detail: SkillHubDetail,
    files: readonly SkillHubFile[],
  ): Promise<void> {
    for (const file of files) {
      const relativePath = safeRelativePath(file.path)
      const destination = resolve(target, relativePath)
      this.assertInside(target, destination)
      const bytes = await this.client.file(slug, file.path, namespace, version)
      if (bytes.byteLength !== file.size) throw new Error(`SkillHub file size changed during download: ${file.path}`)
      const actualHash = createHash('sha256').update(bytes).digest('hex')
      if (actualHash !== file.sha256.toLowerCase()) throw new Error(`SkillHub file hash changed during download: ${file.path}`)
      await mkdir(dirname(destination), { recursive: true })
      if (file.path === 'SKILL.md') {
        const description = detail.skill.summary_zh ?? detail.skill.summary ?? ''
        const markdown = normalizeSkillMarkdown(new TextDecoder().decode(bytes), dshSkillName(slug, namespace), description, { slug, namespace, version })
        await writeFile(destination, markdown, 'utf8')
      } else {
        await writeFile(destination, bytes)
      }
    }
  }

  private async replaceDirectory(root: string, temporary: string, target: string): Promise<void> {
    await mkdir(root, { recursive: true })
    const backup = resolve(root, `.${target.split(sep).at(-1)}.backup-${randomUUID()}`)
    this.assertInside(root, backup)
    let movedExisting = false
    try {
      await rename(target, backup)
      movedExisting = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    try {
      await rename(temporary, target)
    } catch (error) {
      if (movedExisting) await rename(backup, target)
      throw error
    }
    if (movedExisting) await rm(backup, { recursive: true, force: true })
  }

  private async saveManifest(root: string, records: readonly InstalledSkill[]): Promise<void> {
    const skills = [...records].sort((left, right) => left.skillName.localeCompare(right.skillName))
    const manifest: InstalledManifest = { version: 1, skills }
    const destination = resolve(root, MANIFEST_FILE)
    const temporary = resolve(root, `.${MANIFEST_FILE}.${randomUUID()}`)
    this.assertInside(root, destination)
    this.assertInside(root, temporary)
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await rename(temporary, destination)
  }

  private async setDirectoryEnabled(target: string, enabled: boolean): Promise<void> {
    const active = join(target, 'SKILL.md')
    const disabled = join(target, DISABLED_ENTRY_FILE)
    if (enabled) {
      await rename(disabled, active)
    } else {
      await rename(active, disabled)
    }
  }

  private assertInside(root: string, target: string): void {
    const path = relative(root, target)
    if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new Error('SkillHub installation target escapes the managed skill root')
  }
}
