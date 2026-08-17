# DSH With SkillHub

`dsh-withskillhub` adds SkillHub marketplace and skill-management pages to the DeepSeek Harness Web profile's Settings sidebar. The marketplace starts with skills ordered by download count, supports category and keyword filters, links to SkillHub, shows the published `SKILL.md` overview in a slide-in detail drawer, and installs the selected version into a managed shared directory. API-key-required skills include a direct link to their SkillHub page. Skill management lists every managed installation, controls its model visibility, removes it locally, and checks its upstream version.

## Installation

From the Harness checkout, add this local bundle to the Web profile:

```powershell
pnpm dsh plugin --profile web add ..\dsh-withskillhub
```

The bundle adds three rows without editing `packages/`:

- `dsh-withskillhub` provides `ctx.skillHub`.
- `dsh-withskillhub-filesystem` watches `$DSH_HOME/skillhub/skills` only.
- `dsh-withskillhub-web` exposes same-origin browser routes for the marketplace settings page.

The bundle also enables the existing `dsh-tool-skill` row in the Web profile. This is limited to installed skills from the managed provider; the marketplace catalogue itself is never added to a model request.

The existing `dsh-tool-skill` consumer sees the installed skills through the filesystem provider. An installed skill enters the model-visible catalogue on the next request boundary; the marketplace never adds the full remote SkillHub catalogue to a model prompt.

## Installation Semantics

Each install fetches the SkillHub detail and file manifest, rejects invalid paths, enforces the configured file and byte limits, verifies every declared SHA-256 hash, then atomically replaces one managed directory. The bundle records successful installs in `$DSH_HOME/skillhub/skills/.dsh-withskillhub.json`.

SkillHub `SKILL.md` files are given a DSH-valid, namespaced local name such as `skillhub-tencent-adm-tencent-docs`. The instruction body and auxiliary files remain local to that skill directory. The wrapper frontmatter records the downloaded namespace, slug, and version, and prevents upstream frontmatter from overriding DSH invocation policy.

Disabling a managed skill temporarily renames its `SKILL.md` entry point, so the filesystem provider excludes it from the next model request while retaining the downloaded files. Re-enabling restores that entry point. Update checks install a newer SkillHub version immediately, report when the installed version is current, and retain the local copy while reporting a 404 as an upstream removal.

The default root is exclusive to this bundle. User-authored skills under `$DSH_HOME/skills` retain their existing provider and precedence.

## Configuration

The bundle patch declares the following `dsh-withskillhub` config fields. A profile-level patch may override them.

| Field | Default | Meaning |
| --- | --- | --- |
| `apiBaseUrl` | `https://api.skillhub.cn` | SkillHub public API origin. |
| `skillsRoot` | `$DSH_HOME/skillhub/skills` | Shared directory owned by this bundle. |
| `maxFiles` | `200` | Maximum files accepted from one skill version. |
| `maxPackageBytes` | `26214400` | Maximum aggregate uncompressed bytes accepted from one skill version. |
| `requestTimeoutMs` | `15000` | Timeout for each SkillHub API request. |
| `maxOverviewBytes` | `262144` | Maximum `SKILL.md` bytes read for a marketplace overview. |
| `maxOverviewCharacters` | `20000` | Maximum overview characters rendered in the browser. |

If `skillsRoot` changes, patch the `dsh-withskillhub-filesystem` row's `customSkillDirs` in the same profile to match it.

## Local Development and HMR

Install local development dependencies, then link the bundle once as above:

```powershell
cd D:\harness-lh-int8\dsh-withskillhub
npm install
npm run dev
```

Keep the normal Harness Web process running from `D:\harness-lh-int8\deepseek-harness-master`. Rebuilding `lib/client.js` through `npm run dev` is detected by the Web profile's existing client-HMR receiver and reloads the marketplace UI without a browser refresh. The plugin's Host code, Cordis patch, and package manifest use the profile update command, followed by a Web process restart:

```powershell
cd D:\harness-lh-int8\deepseek-harness-master
pnpm dsh plugin --profile web update dsh-withskillhub
```

Run the focused plugin checks with `npm run validate`.
