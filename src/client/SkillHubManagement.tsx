import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InstalledSkill, InstalledSkillDetail, SkillUpdateResult } from '../host/types.ts'
import { errorMessage, requestJson } from './api.ts'
import { ensureSkillHubStyles } from './styles.ts'

type Props = PropsRuntime<'settings.section'> & PropsLocale<'skillhub'>
type PendingAction = 'check-update' | 'delete' | 'set-enabled'

/** Settings page for managed SkillHub installations. */
export function SkillHubManagement({ t }: Props): JSX.Element {
  const [skills, setSkills] = useState<readonly InstalledSkill[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<{ directory: string, action: PendingAction } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<InstalledSkillDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const detailRequest = useRef(0)

  const refresh = useCallback(async () => {
    setSkills(await requestJson<readonly InstalledSkill[]>('/dsh-withskillhub/installed.json'))
  }, [])

  useEffect(() => {
    ensureSkillHubStyles()
    void refresh().catch(error => setNotice(errorMessage(error)))
  }, [refresh])

  const openDetail = useCallback((skill: InstalledSkill) => {
    const request = detailRequest.current + 1
    detailRequest.current = request
    setSelected(skill.directory)
    setDetail(null)
    setLoadingDetail(true)
    void requestJson<InstalledSkillDetail>(`/dsh-withskillhub/installed-detail.json?${new URLSearchParams({ directory: skill.directory })}`)
      .then(value => { if (detailRequest.current === request) setDetail(value) })
      .catch(error => { if (detailRequest.current === request) setNotice(errorMessage(error)) })
      .finally(() => { if (detailRequest.current === request) setLoadingDetail(false) })
  }, [])

  const closeDetail = useCallback(() => {
    detailRequest.current += 1
    setSelected(null)
    setDetail(null)
    setLoadingDetail(false)
  }, [])

  const setEnabled = useCallback((skill: InstalledSkill, enabled: boolean) => {
    setPending({ directory: skill.directory, action: 'set-enabled' })
    setNotice(null)
    void requestJson<InstalledSkill>('/dsh-withskillhub/manage.json', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'set-enabled', directory: skill.directory, enabled }),
    })
      .then(updated => setSkills(current => current.map(item => item.directory === updated.directory ? updated : item)))
      .catch(error => setNotice(errorMessage(error)))
      .finally(() => setPending(null))
  }, [])

  const remove = useCallback((skill: InstalledSkill) => {
    setPending({ directory: skill.directory, action: 'delete' })
    setNotice(null)
    void requestJson<{ status: 'deleted' }>('/dsh-withskillhub/manage.json', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', directory: skill.directory }),
    })
      .then(() => {
        setSkills(current => current.filter(item => item.directory !== skill.directory))
        if (selected === skill.directory) closeDetail()
        setNotice(t('deletedMessage'))
      })
      .catch(error => setNotice(errorMessage(error)))
      .finally(() => setPending(null))
  }, [closeDetail, selected, t])

  const checkUpdate = useCallback((skill: InstalledSkill) => {
    setPending({ directory: skill.directory, action: 'check-update' })
    setNotice(null)
    void requestJson<SkillUpdateResult>('/dsh-withskillhub/manage.json', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'check-update', directory: skill.directory }),
    })
      .then(async result => {
        if (result.status === 'updated') await refresh()
        switch (result.status) {
          case 'updated': setNotice(t('updatedMessage')); return
          case 'up-to-date': setNotice(t('upToDateMessage')); return
          case 'removed': setNotice(t('removedMessage'))
        }
      })
      .catch(error => setNotice(errorMessage(error)))
      .finally(() => setPending(null))
  }, [refresh, t])

  return <section className="skillhubManagement" aria-label={t('managementTitle')}>
    <header className="skillhubManagementHeader">
      <h2 className="skillhubTitle">{t('managementTitle')}</h2>
      <p className="skillhubState">{t('managementDescription')}</p>
    </header>
    {notice !== null && <div className="skillhubToast" role="status">{notice}</div>}
    {skills.length === 0
      ? <p className="skillhubState">{t('noInstalled')}</p>
      : <ul className="skillhubManagedList">
        {skills.map(skill => {
          const enabled = skill.enabled !== false
          const isPending = pending?.directory === skill.directory
          return <li className="skillhubManagedRow" key={skill.directory} data-disabled={!enabled}>
            <button className="skillhubManagedOpen" type="button" onClick={() => openDetail(skill)} aria-label={`${t('viewDetails')}: ${skill.displayName ?? skill.slug}`}>
              <span className="skillhubManagedIdentity">
                <strong>{skill.displayName ?? skill.slug}</strong>
                {skill.description !== undefined && skill.description.length > 0 && <span className="skillhubManagedDescription">{skill.description}</span>}
                <span className="skillhubManagedSource">{skill.namespace === undefined ? skill.slug : `${skill.namespace}/${skill.slug}`}</span>
                <span>{t('version')} {skill.version ?? t('notProvided')}</span>
              </span>
            </button>
            <label className="skillhubSwitch" title={enabled ? t('enabled') : t('disabled')}>
              <input type="checkbox" checked={enabled} disabled={isPending} aria-label={t('enableSkill')} onChange={event => setEnabled(skill, event.target.checked)} />
              <span aria-hidden="true" />
            </label>
            <div className="skillhubManagedActions">
              <button className="skillhubButton" type="button" disabled={isPending} onClick={() => checkUpdate(skill)}>{isPending && pending.action === 'check-update' ? t('checkingUpdate') : t('checkUpdate')}</button>
              <button className="skillhubButton skillhubDanger" type="button" disabled={isPending} onClick={() => remove(skill)}>{isPending && pending.action === 'delete' ? t('deleting') : t('delete')}</button>
            </div>
          </li>
        })}
      </ul>}
    {selected !== null && <aside className="skillhubDrawer" aria-label={t('details')}>
      <header className="skillhubDrawerHeader">
        <h3 className="skillhubSidebarTitle">{t('details')}</h3>
        <button className="skillhubClose" type="button" aria-label={t('close')} onClick={closeDetail}>x</button>
      </header>
      {loadingDetail && <p className="skillhubState">{t('details')}...</p>}
      {detail !== null && <>
        <h4 className="skillhubDetailName">{detail.record.displayName ?? detail.record.slug}</h4>
        <section className="skillhubOverview">
          <h5>{t('overview')}</h5>
          {detail.overview?.content === undefined
            ? <p>{t('noOverview')}</p>
            : <div className="skillhubOverviewContent">{detail.overview.content}</div>}
          {detail.overview?.truncated === true && <p className="skillhubOverviewNotice">{t('overviewTruncated')}</p>}
        </section>
        <dl className="skillhubDetailMeta">
          <div><dt>{t('version')}</dt><dd>{detail.record.version ?? t('notProvided')}</dd></div>
          <div><dt>{t('latestVersion')}</dt><dd>{detail.latestVersion ?? t('notProvided')}</dd></div>
          <div><dt>{t('source')}</dt><dd><a className="skillhubMarketLink" href={detail.sourceUrl} target="_blank" rel="noreferrer">{t('openSkillHub')}</a></dd></div>
        </dl>
        <section className="skillhubDetailSection">
          <h5>{t('changeLog')}</h5>
          <div className="skillhubOverviewContent">{detail.changelog ?? t('noChangeLog')}</div>
        </section>
        <section className="skillhubDetailSection">
          <h5>{t('files')}</h5>
          <ul className="skillhubFileList">{detail.files.map(file => <li key={file}>{file}</li>)}</ul>
        </section>
      </>}
    </aside>}
  </section>
}
