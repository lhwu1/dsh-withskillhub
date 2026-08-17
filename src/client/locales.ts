/** Locale keys owned by the SkillHub marketplace view. */
export type SkillHubLocaleKey =
  | 'view'
  | 'title'
  | 'search'
  | 'allCategories'
  | 'popular'
  | 'latest'
  | 'downloads'
  | 'installed'
  | 'install'
  | 'update'
  | 'installing'
  | 'details'
  | 'noSelection'
  | 'requiresKey'
  | 'loadMore'
  | 'empty'
  | 'marketError'
  | 'installedMessage'
  | 'version'
  | 'author'
  | 'category'
  | 'notProvided'
  | 'uncategorized'
  | 'managementView'
  | 'managementTitle'
  | 'managementDescription'
  | 'noInstalled'
  | 'overview'
  | 'overviewTruncated'
  | 'openMarketplace'
  | 'openSkillHub'
  | 'apiKeyConfiguration'
  | 'close'
  | 'favorites'
  | 'enableSkill'
  | 'enabled'
  | 'disabled'
  | 'checkUpdate'
  | 'checkingUpdate'
  | 'delete'
  | 'deleting'
  | 'deletedMessage'
  | 'updatedMessage'
  | 'upToDateMessage'
  | 'removedMessage'

/** Locale namespace for the marketplace view. */
export const NS = 'skillhub'

/** Chinese marketplace strings. */
export const zh: Record<SkillHubLocaleKey, string> = {
  view: '技能市场',
  title: 'SkillHub 技能市场',
  search: '搜索技能',
  allCategories: '全部分类',
  popular: '下载量高',
  latest: '最近上新',
  downloads: '下载',
  installed: '已装配',
  install: '一键装配',
  update: '更新装配',
  installing: '正在装配',
  details: '技能详情',
  noSelection: '选择一个技能查看详情。',
  requiresKey: '需要 API Key',
  loadMore: '加载更多',
  empty: '没有符合条件的技能。',
  marketError: '技能市场暂时不可用。',
  installedMessage: '已装配，下一轮对话会出现在可用技能列表中。',
  version: '版本',
  author: '作者',
  category: '分类',
  notProvided: '未提供',
  uncategorized: '未分类',
  managementView: '技能管理',
  managementTitle: '已装配技能',
  managementDescription: '关闭技能后，下一轮对话不会向 AI 提供它。',
  noInstalled: '还没有已装配的 SkillHub 技能。',
  overview: '概述',
  overviewTruncated: '概述内容较长，仅显示前面部分。',
  openMarketplace: '前往 SkillHub',
  openSkillHub: '在 SkillHub 查看',
  apiKeyConfiguration: '前往 SkillHub 获取 API 配置',
  close: '关闭',
  favorites: '收藏',
  enableSkill: '启用技能',
  enabled: '已启用',
  disabled: '已关闭',
  checkUpdate: '检测更新',
  checkingUpdate: '正在检测',
  delete: '删除',
  deleting: '正在删除',
  deletedMessage: '已从本地技能目录删除。',
  updatedMessage: '已下载并装配最新版本。',
  upToDateMessage: '已是最新版本。',
  removedMessage: 'SkillHub 上已找不到这个技能，可能已下架。',
}

/** English marketplace strings. */
export const en: Record<SkillHubLocaleKey, string> = {
  view: 'Skill Market',
  title: 'SkillHub Market',
  search: 'Search skills',
  allCategories: 'All categories',
  popular: 'Most downloaded',
  latest: 'Recently added',
  downloads: 'downloads',
  installed: 'Installed',
  install: 'Install',
  update: 'Update',
  installing: 'Installing',
  details: 'Skill details',
  noSelection: 'Select a skill to view its details.',
  requiresKey: 'Requires API key',
  loadMore: 'Load more',
  empty: 'No skills match these filters.',
  marketError: 'The skill market is unavailable.',
  installedMessage: 'Installed. It will appear in the available skill list on the next turn.',
  version: 'Version',
  author: 'Author',
  category: 'Category',
  notProvided: 'Not provided',
  uncategorized: 'Uncategorized',
  managementView: 'Skill management',
  managementTitle: 'Installed skills',
  managementDescription: 'Disabled skills are not provided to the AI on the next turn.',
  noInstalled: 'No SkillHub skills are installed.',
  overview: 'Overview',
  overviewTruncated: 'This overview is long, so only the beginning is shown.',
  openMarketplace: 'Open SkillHub',
  openSkillHub: 'View on SkillHub',
  apiKeyConfiguration: 'Get API configuration on SkillHub',
  close: 'Close',
  favorites: 'favorites',
  enableSkill: 'Enable skill',
  enabled: 'Enabled',
  disabled: 'Disabled',
  checkUpdate: 'Check for updates',
  checkingUpdate: 'Checking',
  delete: 'Delete',
  deleting: 'Deleting',
  deletedMessage: 'Removed from the local skill directory.',
  updatedMessage: 'Downloaded and installed the latest version.',
  upToDateMessage: 'Already up to date.',
  removedMessage: 'This skill is no longer available on SkillHub.',
}
