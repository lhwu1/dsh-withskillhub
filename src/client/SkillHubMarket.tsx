import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InstalledSkill, SkillHubCategory, SkillHubDetail, SkillHubOverview, SkillHubPage, SkillHubResponse, SkillHubSkill } from '../host/types.ts'
import { errorMessage, formatCount, requestJson } from './api.ts'
import { ensureSkillHubStyles } from './styles.ts'

type Props = PropsRuntime<'settings.section'> & PropsLocale<'skillhub'>

const PAGE_SIZE = 24
const SKILLHUB_MARKET_URL = 'https://skillhub.cn/skills'

/** Build the public SkillHub page URL for a namespaced marketplace skill. */
function skillHubPageUrl(slug: string, namespace?: string): string {
  if (namespace === undefined) return SKILLHUB_MARKET_URL
  return `${SKILLHUB_MARKET_URL}/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}`
}

/** Marketplace settings page backed by the bundle's same-origin routes. */
export function SkillHubMarket({ t }: Props): JSX.Element {
  const [categories, setCategories] = useState<readonly SkillHubCategory[]>([])
  const [catalogue, setCatalogue] = useState<SkillHubPage>({ skills: [], total: 0 })
  const [installed, setInstalled] = useState<readonly InstalledSkill[]>([])
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [sortBy, setSortBy] = useState<'downloads' | 'updated_at'>('downloads')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<{ slug: string, namespace?: string } | null>(null)
  const [detail, setDetail] = useState<SkillHubDetail | null>(null)
  const [overview, setOverview] = useState<SkillHubOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const detailRequest = useRef(0)

  const refreshInstalled = useCallback(async () => {
    setInstalled(await requestJson<readonly InstalledSkill[]>('/dsh-withskillhub/installed.json'))
  }, [])

  useEffect(() => { ensureSkillHubStyles() }, [])
  useEffect(() => {
    void requestJson<SkillHubResponse<readonly SkillHubCategory[]>>('/dsh-withskillhub/categories.json')
      .then(response => setCategories(response.data))
      .catch(() => setMessage(t('marketError')))
    void refreshInstalled().catch(() => setMessage(t('marketError')))
  }, [refreshInstalled])
  useEffect(() => {
    let live = true
    setLoading(true)
    setMessage(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy })
    if (category.length > 0) params.set('category', category)
    if (submittedKeyword.length > 0) params.set('keyword', submittedKeyword)
    void requestJson<SkillHubResponse<SkillHubPage>>(`/dsh-withskillhub/catalog.json?${params}`)
      .then(response => {
        if (!live) return
        setCatalogue(response.data)
        if (response.cache.state === 'stale') setMessage(t('staleMarket'))
      })
      .catch(() => { if (live) setMessage(t('marketError')) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [category, page, sortBy, submittedKeyword, t])

  const installedKeys = useMemo(() => new Set(installed.map(item => `${item.namespace ?? ''}/${item.slug}`)), [installed])
  const selectedInstalled = detail === null ? false : installedKeys.has(`${detail.namespace?.handle ?? ''}/${detail.slug}`)

  const openDetail = useCallback((skill: SkillHubSkill) => {
    const request = detailRequest.current + 1
    detailRequest.current = request
    const namespace = skill.namespace?.handle
    setSelected({ slug: skill.slug, ...(namespace === undefined ? {} : { namespace }) })
    setDetail(null)
    setOverview(null)
    setLoadingDetail(true)
    setLoadingOverview(true)
    setMessage(null)
    const params = new URLSearchParams({ slug: skill.slug })
    if (namespace !== undefined) params.set('namespace', namespace)
    void requestJson<SkillHubResponse<SkillHubDetail>>(`/dsh-withskillhub/detail.json?${params}`)
      .then(response => {
        if (detailRequest.current !== request) return
        setDetail(response.data)
        if (response.cache.state === 'stale') setMessage(t('staleMarket'))
      })
      .catch(() => { if (detailRequest.current === request) setMessage(t('marketError')) })
      .finally(() => { if (detailRequest.current === request) setLoadingDetail(false) })
    void requestJson<SkillHubResponse<SkillHubOverview>>(`/dsh-withskillhub/overview.json?${params}`)
      .then(response => { if (detailRequest.current === request) setOverview(response.data) })
      .catch(() => undefined)
      .finally(() => { if (detailRequest.current === request) setLoadingOverview(false) })
  }, [t])

  const closeDetail = useCallback(() => {
    detailRequest.current += 1
    setSelected(null)
    setDetail(null)
    setOverview(null)
    setLoadingDetail(false)
    setLoadingOverview(false)
  }, [])

  const install = useCallback(() => {
    if (detail === null || installing) return
    setInstalling(true)
    setMessage(null)
    void requestJson<InstalledSkill>('/dsh-withskillhub/install.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: detail.slug,
        namespace: detail.namespace?.handle,
        version: detail.latestVersion?.version,
      }),
    })
      .then(async () => {
        await refreshInstalled()
        setMessage(t('installedMessage'))
      })
      .catch(error => setMessage(errorMessage(error)))
      .finally(() => setInstalling(false))
  }, [detail, installing, refreshInstalled, t])

  const submitSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setPage(1)
    setSubmittedKeyword(keyword.trim())
  }

  const overviewContent = overview?.content?.trim() || detail?.skill.summary_zh || detail?.skill.summary || ''

  return <section className="skillhubMarket" aria-label={t('title')}>
    <main className="skillhubCatalogue">
      <header className="skillhubTitleRow">
        <h2 className="skillhubTitle">{t('title')}</h2>
        <a className="skillhubMarketLink" href={SKILLHUB_MARKET_URL} target="_blank" rel="noreferrer">{t('openMarketplace')}</a>
      </header>
      <form className="skillhubToolbar" onSubmit={submitSearch}>
        <input className="skillhubInput" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder={t('search')} aria-label={t('search')} />
        <select className="skillhubSelect" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }} aria-label={t('allCategories')}>
          <option value="">{t('allCategories')}</option>
          {categories.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
        <select className="skillhubSelect" value={sortBy} onChange={event => { setSortBy(event.target.value as 'downloads' | 'updated_at'); setPage(1) }} aria-label={t('popular')}>
          <option value="downloads">{t('popular')}</option>
          <option value="updated_at">{t('latest')}</option>
        </select>
        <button className="skillhubButton" type="submit">{t('search')}</button>
      </form>
      {message !== null && <p className={message === t('installedMessage') ? 'skillhubState' : 'skillhubState skillhubError'}>{message}</p>}
      <div className="skillhubList" aria-busy={loading}>
        {catalogue.skills.map(skill => {
          const namespace = skill.namespace?.handle
          const key = `${namespace ?? ''}/${skill.slug}`
          const isSelected = selected?.slug === skill.slug && selected.namespace === namespace
          return <button key={key} className="skillhubRow" type="button" data-selected={isSelected} onClick={() => openDetail(skill)}>
            {skill.iconUrl === undefined
              ? <span className="skillhubIconFallback" aria-hidden="true">{(skill.name ?? skill.slug).slice(0, 1).toUpperCase()}</span>
              : <img className="skillhubIcon" src={skill.iconUrl} alt="" />}
            <span className="skillhubRowContent">
              <span className="skillhubName">{skill.name ?? skill.slug}</span>
              <span className="skillhubDescription">{skill.description_zh ?? skill.description ?? ''}</span>
              <span className="skillhubMeta">
                <span>{skill.category ?? t('allCategories')}</span>
                {skill.labels?.requires_api_key === 'true' && <span className="skillhubBadge skillhubBadgeKey">{t('requiresKey')}</span>}
                {installedKeys.has(key) && <span className="skillhubBadge">{t('installed')}</span>}
              </span>
            </span>
            <span className="skillhubMetrics">
              <span title={String(skill.downloads ?? 0)}>{formatCount(skill.downloads)} {t('downloads')}</span>
              <span title={String(skill.stars ?? 0)}>{formatCount(skill.stars)} {t('favorites')}</span>
              <span>{skill.version ?? t('notProvided')}</span>
            </span>
          </button>
        })}
      </div>
      {!loading && catalogue.skills.length === 0 && <p className="skillhubState">{t('empty')}</p>}
      {catalogue.total > page * PAGE_SIZE && <div className="skillhubPager"><button className="skillhubButton" type="button" onClick={() => setPage(current => current + 1)}>{t('loadMore')}</button></div>}
    </main>
    {selected !== null && <aside className="skillhubDrawer" aria-label={t('details')}>
      <header className="skillhubDrawerHeader">
        <h3 className="skillhubSidebarTitle">{t('details')}</h3>
        <button className="skillhubClose" type="button" aria-label={t('close')} onClick={closeDetail}>x</button>
      </header>
      {loadingDetail && <p className="skillhubState">{t('details')}...</p>}
      {detail !== null && <>
        <h4 className="skillhubDetailName">{detail.skill.displayName ?? detail.slug}</h4>
        <section className="skillhubOverview">
          <h5>{t('overview')}</h5>
          {loadingOverview
            ? <p>{t('overview')}...</p>
            : <div className="skillhubOverviewContent">{overviewContent}</div>}
          {overview?.truncated === true && <p className="skillhubOverviewNotice">{t('overviewTruncated')}</p>}
        </section>
        <dl className="skillhubDetailMeta">
          <div><dt>{t('downloads')}</dt><dd>{formatCount(detail.skill.stats?.downloads)}</dd></div>
          <div><dt>{t('favorites')}</dt><dd>{formatCount(detail.skill.stats?.stars)}</dd></div>
          <div><dt>{t('version')}</dt><dd>{detail.latestVersion?.version ?? t('notProvided')}</dd></div>
          <div><dt>{t('author')}</dt><dd>{detail.publisher?.name ?? detail.owner?.displayName ?? detail.owner?.handle ?? t('notProvided')}</dd></div>
          <div><dt>{t('category')}</dt><dd>{detail.skill.subCategories?.map(item => item.name).join(' / ') ?? detail.skill.category ?? t('uncategorized')}</dd></div>
        </dl>
        {detail.skill.labels?.requires_api_key === 'true' && <div className="skillhubApiKeyNotice">
          <span className="skillhubBadge skillhubBadgeKey">{t('requiresKey')}</span>
          <a className="skillhubMarketLink" href={skillHubPageUrl(detail.slug, detail.namespace?.handle)} target="_blank" rel="noreferrer">{t('apiKeyConfiguration')}</a>
        </div>}
        <button className="skillhubButton skillhubPrimary" type="button" disabled={installing} onClick={install}>
          {installing ? t('installing') : selectedInstalled ? t('update') : t('install')}
        </button>
      </>}
    </aside>}
  </section>
}
