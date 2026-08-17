import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SkillHubManagement } from './SkillHubManagement.tsx'
import { SkillHubMarket } from './SkillHubMarket.tsx'
import { en, NS, zh, type SkillHubLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { skillhub: SkillHubLocaleKey }
}

/** Dependencies needed to register the SkillHub settings page. */
export const inject = ['slots', 'locale']

/** Mount the marketplace in the Settings sidebar. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-withskillhub: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'skillhub-market', order: 25, label: () => t('view'), locale: NS,
  }, SkillHubMarket))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'skillhub-management', order: 26, label: () => t('managementView'), locale: NS,
  }, SkillHubManagement))
}
