const STYLE_ID = 'dsh-withskillhub-styles'

const stylesheet = `
.skillhubMarket{position:relative;min-height:0;height:100%;overflow:hidden;background:var(--dsh-surface,#fff);color:var(--dsh-foreground,#16181d)}
.skillhubCatalogue{height:100%;min-width:0;overflow:auto;padding:24px 28px 32px;box-sizing:border-box}
.skillhubTitleRow{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.skillhubTitle{margin:0;font-size:20px;line-height:28px;font-weight:650;letter-spacing:0}
.skillhubMarketLink{color:var(--dsh-accent,#1376d3);font-size:12px;line-height:20px;text-decoration:none;white-space:nowrap}
.skillhubMarketLink:hover{text-decoration:underline}
.skillhubToolbar{display:grid;grid-template-columns:minmax(180px,1fr) 180px 132px auto;gap:8px;margin:16px 0}
.skillhubInput,.skillhubSelect{height:34px;min-width:0;box-sizing:border-box;border:1px solid var(--dsh-border,#d1d5db);border-radius:5px;background:var(--dsh-surface,#fff);color:inherit;padding:0 10px;font:inherit}
.skillhubButton{height:34px;border:1px solid var(--dsh-border-strong,#aeb5c0);border-radius:5px;background:var(--dsh-surface,#fff);color:inherit;padding:0 12px;font:inherit;cursor:pointer}
.skillhubButton:hover{background:var(--dsh-surface-hover,#eef2f7)}
.skillhubButton:disabled{cursor:wait;opacity:.6}
.skillhubPrimary{margin-top:20px;border-color:var(--dsh-accent,#1376d3);background:var(--dsh-accent,#1376d3);color:#fff}
.skillhubPrimary:hover{background:var(--dsh-accent-strong,#075da9)}
.skillhubDanger{border-color:#d5a3a0;color:#a32920}
.skillhubDanger:hover{background:#fff1f0}
.skillhubList{display:grid;border-top:1px solid var(--dsh-border,#e5e7eb)}
.skillhubRow{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(165px,auto);gap:12px;align-items:start;width:100%;box-sizing:border-box;padding:14px 4px;border:0;border-bottom:1px solid var(--dsh-border,#e5e7eb);background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
.skillhubRow:hover,.skillhubRow[data-selected=true]{background:var(--dsh-surface-hover,#f3f6f9)}
.skillhubRowContent{min-width:0}
.skillhubIcon{width:36px;height:36px;object-fit:cover;border-radius:5px;background:#e5e7eb}
.skillhubIconFallback{display:grid;place-items:center;width:36px;height:36px;border-radius:5px;background:#d8e7f5;color:#165b90;font-weight:700}
.skillhubName{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650}
.skillhubDescription{display:-webkit-box;overflow:hidden;margin:4px 0 0;color:var(--dsh-muted,#5e6673);font-size:13px;line-height:19px;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.skillhubMeta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:7px;color:var(--dsh-muted,#5e6673);font-size:12px}
.skillhubMetrics{display:grid;grid-template-columns:repeat(3,max-content);gap:10px;justify-content:end;padding-top:3px;color:var(--dsh-muted,#5e6673);font-size:12px;white-space:nowrap}
.skillhubBadge{display:inline-flex;align-items:center;min-height:20px;border:1px solid #b7cfdf;border-radius:4px;padding:0 6px;background:#edf7ff;color:#245b7d;font-size:12px;white-space:nowrap}
.skillhubBadgeKey{border-color:#e0c48a;background:#fff8e5;color:#805e13}
.skillhubPager{display:flex;justify-content:center;margin-top:16px}
.skillhubDrawer{position:absolute;inset:0 0 0 auto;width:min(420px,46vw);box-sizing:border-box;overflow:auto;border-left:1px solid var(--dsh-border,#e5e7eb);padding:24px 26px 32px;background:var(--dsh-surface,#fff);box-shadow:-14px 0 30px rgb(15 23 42 / .12);animation:skillhubDrawerIn .2s ease-out}
.skillhubDrawerHeader{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.skillhubSidebarTitle{margin:0;font-size:15px;line-height:22px}
.skillhubClose{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:4px;background:transparent;color:var(--dsh-muted,#5e6673);font-size:18px;line-height:1;cursor:pointer}
.skillhubClose:hover{background:var(--dsh-surface-hover,#eef2f7);color:inherit}
.skillhubDetailName{margin:0;font-size:20px;line-height:28px}
.skillhubOverview{margin-top:22px;border-top:1px solid var(--dsh-border,#e5e7eb);padding-top:16px}
.skillhubOverview h5{margin:0;font-size:13px;line-height:20px}
.skillhubOverview p{margin:8px 0 0;white-space:pre-wrap;color:var(--dsh-muted,#5e6673);font-size:14px;line-height:22px}
.skillhubOverviewContent{max-height:420px;overflow:auto;margin-top:8px;white-space:pre-wrap;color:var(--dsh-muted,#5e6673);font-size:14px;line-height:22px;overflow-wrap:anywhere}
.skillhubOverviewNotice{font-size:12px!important;line-height:18px!important}
.skillhubApiKeyNotice{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px}
.skillhubDetailMeta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px;margin:24px 0;color:var(--dsh-muted,#5e6673);font-size:13px}
.skillhubDetailMeta div{min-width:0}.skillhubDetailMeta dt{margin:0 0 3px;color:var(--dsh-foreground,#16181d);font-size:12px;font-weight:650}.skillhubDetailMeta dd{margin:0;overflow-wrap:anywhere}
.skillhubDetailSection{margin-top:24px;border-top:1px solid var(--dsh-border,#e5e7eb);padding-top:16px}.skillhubDetailSection h5{margin:0;font-size:13px;line-height:20px}
.skillhubFileList{max-height:220px;overflow:auto;margin:8px 0 0;padding-left:20px;color:var(--dsh-muted,#5e6673);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:20px;overflow-wrap:anywhere}
.skillhubState{margin:12px 0;color:var(--dsh-muted,#5e6673);font-size:13px;line-height:20px}
.skillhubError{color:#b42318}
.skillhubManagement{position:relative;min-height:0;height:100%;overflow:auto;padding:24px 28px 32px;box-sizing:border-box;background:var(--dsh-surface,#fff);color:var(--dsh-foreground,#16181d)}
.skillhubManagementHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid var(--dsh-border,#e5e7eb)}
.skillhubManagedList{display:grid;gap:8px;margin:20px 0 0;padding:0;list-style:none}
.skillhubManagedRow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:16px;align-items:center;border:1px solid var(--dsh-border,#e5e7eb);border-radius:6px;padding:14px 16px;background:var(--dsh-surface,#fff)}
.skillhubManagedRow[data-disabled=true]{opacity:.65}
.skillhubManagedOpen{min-width:0;border:0;background:transparent;color:inherit;padding:0;text-align:left;font:inherit;cursor:pointer}.skillhubManagedOpen:hover strong{text-decoration:underline}.skillhubManagedOpen:focus-visible{outline:2px solid var(--dsh-accent,#1376d3);outline-offset:3px}
.skillhubManagedIdentity{display:grid;gap:3px;min-width:0}.skillhubManagedIdentity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.skillhubManagedIdentity span{overflow:hidden;color:var(--dsh-muted,#5e6673);font-size:12px;text-overflow:ellipsis;white-space:nowrap}
.skillhubManagedIdentity .skillhubManagedDescription{display:-webkit-box;overflow:hidden;color:var(--dsh-muted,#5e6673);font-size:13px;line-height:19px;text-overflow:clip;white-space:normal;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.skillhubManagedIdentity .skillhubManagedSource{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.skillhubManagedActions{display:flex;gap:8px}
.skillhubSwitch{position:relative;display:inline-flex;width:38px;height:22px;cursor:pointer}.skillhubSwitch input{position:absolute;width:1px;height:1px;opacity:0}.skillhubSwitch span{width:100%;height:100%;border-radius:11px;background:#aab1bb;transition:background .15s}.skillhubSwitch span::after{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / .2);content:'';transition:transform .15s}.skillhubSwitch input:checked + span{background:var(--dsh-accent,#1376d3)}.skillhubSwitch input:checked + span::after{transform:translateX(16px)}.skillhubSwitch input:focus-visible + span{outline:2px solid var(--dsh-accent,#1376d3);outline-offset:2px}.skillhubSwitch input:disabled + span{cursor:wait}
.skillhubToast{position:sticky;top:0;z-index:2;margin-top:16px;border:1px solid #a9c7e1;border-radius:5px;padding:10px 12px;background:#edf7ff;color:#245b7d;font-size:13px;line-height:20px;box-shadow:0 6px 18px rgb(15 23 42 / .08)}
@keyframes skillhubDrawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@media (max-width:760px){.skillhubCatalogue,.skillhubManagement{padding:20px 16px 24px}.skillhubToolbar{grid-template-columns:1fr}.skillhubRow{grid-template-columns:36px minmax(0,1fr)}.skillhubMetrics{grid-column:2;justify-content:start;padding-top:0}.skillhubDrawer{width:100%;max-width:none}.skillhubManagedRow{grid-template-columns:minmax(0,1fr) auto}.skillhubManagedActions{grid-column:1 / -1}.skillhubManagementHeader{display:block}.skillhubDetailMeta{grid-template-columns:1fr}}
`

/** Insert the marketplace stylesheet once for the browser bundle lifetime. */
export function ensureSkillHubStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = stylesheet
  document.head.append(style)
}
