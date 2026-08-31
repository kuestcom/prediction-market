import type { SupportedLocale } from '@/i18n/locales'

import { resolveSupportedLocale } from '@/i18n/locales'

const GLOBAL_ANNOUNCEMENT_TRANSLATIONS: Record<string, Record<SupportedLocale, string>> = {
  'last call to move to mainnet': {
    en: 'Last call to move to Mainnet',
    de: 'Letzte Aufforderung zum Wechsel ins Mainnet',
    es: 'Último aviso para migrar a la red principal',
    pt: 'Último aviso para migrar para a rede principal',
    fr: 'Dernier rappel pour passer au réseau principal',
    zh: '迁移至主网的最后提醒',
    ja: 'メインネット移行の最終案内',
    ar: 'التنبيه الأخير للانتقال إلى الشبكة الرئيسية',
    ru: 'Последнее напоминание о переходе в основную сеть',
    it: 'Ultimo avviso per passare alla rete principale',
    pl: 'Ostatnie przypomnienie o przejściu do sieci głównej',
    ko: '메인넷 전환 최종 안내',
  },
}

export function localizeGlobalAnnouncementMessage(locale: string, message: string) {
  const normalizedMessage = message.trim()
  if (!normalizedMessage) {
    return normalizedMessage
  }

  const translation =
    GLOBAL_ANNOUNCEMENT_TRANSLATIONS[normalizedMessage.toLowerCase()]?.[resolveSupportedLocale(locale)]
  return translation ?? normalizedMessage
}
