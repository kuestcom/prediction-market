import type { NonDefaultLocale } from '@/i18n/locales'

import { LOCALE_LABELS } from '@/i18n/locales'
import { requestOpenRouterCompletion } from '@/lib/ai/openrouter'
import { assertTranslationUsesExpectedScript } from '@/lib/translations/batch'

const MAX_ADDITIONAL_CONTEXT_TRANSLATION_TOKENS = 8_000

function normalizeTranslatedText(value: string) {
  return value
    .trim()
    .replace(/^```(?:text|plain)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^['"`“”‘’\s]+/, '')
    .replace(/['"`“”‘’\s]+$/, '')
    .trim()
}

export async function translateEventAdditionalContext(
  sourceText: string,
  locale: NonDefaultLocale,
  options: { apiKey: string; model?: string; timeoutMs?: number },
) {
  const targetLocaleLabel = LOCALE_LABELS[locale]
  const translatedText = await requestOpenRouterCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a translation engine for prediction-market event context.',
          `Translate the text into ${targetLocaleLabel} (${locale}).`,
          'Return only the translated text, with no explanation, notes, markdown, or quotation marks.',
          'Preserve names, acronyms, tickers, numbers, dates, URLs, line breaks, and paragraph structure when appropriate.',
        ].join(' '),
      },
      {
        role: 'user',
        content: sourceText,
      },
    ],
    {
      apiKey: options.apiKey,
      model: options.model,
      temperature: 0,
      maxTokens: Math.min(MAX_ADDITIONAL_CONTEXT_TRANSLATION_TOKENS, Math.max(250, Math.ceil(sourceText.length * 2))),
      timeoutMs: options.timeoutMs,
    },
  )

  const normalizedText = normalizeTranslatedText(translatedText)
  if (!normalizedText) {
    throw new Error(`OpenRouter returned an empty translation for locale ${locale}.`)
  }

  assertTranslationUsesExpectedScript({
    locale,
    sourceText,
    translatedText: normalizedText,
  })

  return normalizedText
}
