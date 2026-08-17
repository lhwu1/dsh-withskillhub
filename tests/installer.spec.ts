import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SkillHubHttpError, skillOverviewFromMarkdown } from '../src/host/catalog.ts'
import { dshSkillName, normalizeSkillMarkdown, safeRelativePath, SkillInstaller } from '../src/host/installer.ts'
import type { SkillHubClient } from '../src/host/catalog.ts'

describe('SkillHub installer helpers', () => {
  it('rejects file paths that leave a managed skill directory', () => {
    expect(() => safeRelativePath('../SKILL.md')).toThrow('escapes')
    expect(() => safeRelativePath('references/../../SKILL.md')).toThrow('escapes')
    expect(() => safeRelativePath('/SKILL.md')).toThrow('invalid')
    expect(safeRelativePath('references/guide.md')).toContain('references')
  })

  it('creates a stable DSH-compatible name for a namespaced skill', () => {
    expect(dshSkillName('Code Review', 'ClawHub_DeepSeek')).toBe('skillhub-clawhub-deepseek-code-review')
  })

  it('replaces untrusted frontmatter while retaining the instruction body', () => {
    const markdown = normalizeSkillMarkdown('---\nname: upstream\ndescription: old\n---\n\n# Instructions\n', 'skillhub-team-review', 'Review code.', { slug: 'review', namespace: 'team', version: '1.0.0' })
    expect(markdown).toContain('name: skillhub-team-review')
    expect(markdown).toContain('description: "Review code."')
    expect(markdown).toContain('# Instructions')
    expect(markdown).not.toContain('name: upstream')
  })

  it('shows the full SKILL.md body without its frontmatter within the configured display limit', () => {
    expect(skillOverviewFromMarkdown('---\nname: upstream\n---\n# Overview\n\nUse this skill.\n', 100)).toEqual({ content: '# Overview\n\nUse this skill.', truncated: false })
    expect(skillOverviewFromMarkdown('# Overview\n\nDetailed instructions', 12)).toEqual({ content: '# Overview', truncated: true })
  })

  it('hides a disabled skill from the filesystem provider entry point', async () => {
    const root = join(tmpdir(), `dsh-withskillhub-${Date.now()}`)
    const directory = 'skillhub-team-example'
    const record = { directory, enabled: true, installedAt: new Date().toISOString(), skillName: directory, slug: 'example', namespace: 'team', version: '1.0.0' }
    await mkdir(join(root, directory), { recursive: true })
    await writeFile(join(root, directory, 'SKILL.md'), '---\nname: example\ndescription: Example\n---\n', 'utf8')
    await writeFile(join(root, '.dsh-withskillhub.json'), `${JSON.stringify({ version: 1, skills: [record] })}\n`, 'utf8')
    const client = {} as SkillHubClient
    const installer = new SkillInstaller(client, root, 10, 1_000_000)
    try {
      await installer.setEnabled(directory, false)
      await expect(access(join(root, directory, 'SKILL.md'))).rejects.toMatchObject({ code: 'ENOENT' })
      await access(join(root, directory, '.dsh-withskillhub-disabled.md'))
      await installer.setEnabled(directory, true)
      await access(join(root, directory, 'SKILL.md'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fills display metadata for an installation record created by an older plugin version', async () => {
    const root = join(tmpdir(), `dsh-withskillhub-${Date.now()}-metadata`)
    const directory = 'skillhub-team-example'
    const record = { directory, enabled: true, installedAt: new Date().toISOString(), skillName: directory, slug: 'example', namespace: 'team', version: '1.0.0' }
    await mkdir(root, { recursive: true })
    await writeFile(join(root, '.dsh-withskillhub.json'), `${JSON.stringify({ version: 1, skills: [record] })}\n`, 'utf8')
    const client = {
      detail: async () => ({ skill: { displayName: 'Example Skill', slug: 'example', summary_zh: 'Explains the example workflow.' } }),
    } as unknown as SkillHubClient
    const installer = new SkillInstaller(client, root, 10, 1_000_000)
    try {
      await expect(installer.installedWithMetadata()).resolves.toEqual([{ ...record, displayName: 'Example Skill', description: 'Explains the example workflow.' }])
      await expect(installer.installed()).resolves.toEqual([{ ...record, displayName: 'Example Skill', description: 'Explains the example workflow.' }])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps a local skill when SkillHub reports that it was removed', async () => {
    const root = join(tmpdir(), `dsh-withskillhub-${Date.now()}-removed`)
    const directory = 'skillhub-team-removed'
    const record = { directory, enabled: true, installedAt: new Date().toISOString(), skillName: directory, slug: 'removed', namespace: 'team', version: '1.0.0' }
    await mkdir(join(root, directory), { recursive: true })
    await writeFile(join(root, '.dsh-withskillhub.json'), `${JSON.stringify({ version: 1, skills: [record] })}\n`, 'utf8')
    const client = {
      detail: async () => { throw new SkillHubHttpError(404, '/api/v1/skills/removed') },
    } as unknown as SkillHubClient
    const installer = new SkillInstaller(client, root, 10, 1_000_000)
    try {
      await expect(installer.checkUpdate(directory)).resolves.toMatchObject({ status: 'removed', record })
      await access(join(root, directory))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
