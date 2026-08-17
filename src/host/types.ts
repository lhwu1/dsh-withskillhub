/** JSON records received from SkillHub's public catalogue API. */
export interface SkillHubNamespace {
  canonicalName?: string
  displayName?: string
  handle?: string
  publicSlug?: string
}

/** One marketplace row returned by the public catalogue API. */
export interface SkillHubSkill {
  category?: string
  description?: string
  description_zh?: string
  downloads?: number
  iconUrl?: string
  labels?: { requires_api_key?: string }
  name?: string
  namespace?: SkillHubNamespace
  ownerName?: string
  slug: string
  source?: string
  stars?: number
  subCategories?: readonly { key: string, name: string }[]
  updated_at?: number
  verified?: boolean
  version?: string
}

/** One page of marketplace rows. */
export interface SkillHubPage {
  skills: readonly SkillHubSkill[]
  total: number
}

/** A top-level SkillHub category. */
export interface SkillHubCategory {
  key: string
  name: string
  nameEn?: string
  sortOrder: number
}

/** Detail data needed by the marketplace view and installer. */
export interface SkillHubDetail {
  latestVersion?: { changelog?: string, version?: string }
  namespace?: SkillHubNamespace
  owner?: { displayName?: string, handle?: string }
  publisher?: { name?: string, verified?: boolean }
  securityReports?: Record<string, { status?: string, statusText?: string }>
  skill: {
    category?: string
    displayName?: string
    iconUrl?: string
    labels?: { requires_api_key?: string }
    slug: string
    source?: string
    stats?: { downloads?: number, installs?: number, stars?: number, versions?: number }
    subCategories?: readonly { key: string, name: string }[]
    summary?: string
    summary_zh?: string
    updatedAt?: number
  }
  slug: string
}

/** A file and its content hash in a SkillHub skill version. */
export interface SkillHubFile {
  path: string
  sha256: string
  size: number
}

/** Detailed, display-safe overview extracted from a skill's SKILL.md file. */
export interface SkillHubOverview {
  content?: string
  truncated: boolean
}

/** On-disk record for a successfully installed marketplace skill. */
export interface InstalledSkill {
  directory: string
  enabled?: boolean
  installedAt: string
  namespace?: string
  skillName: string
  slug: string
  version?: string
}

/** Result of comparing one installed skill against its current SkillHub record. */
export interface SkillUpdateResult {
  record: InstalledSkill
  status: 'removed' | 'updated' | 'up-to-date'
}

/** JSON payload persisted inside the managed skill root. */
export interface InstalledManifest {
  skills: readonly InstalledSkill[]
  version: 1
}
