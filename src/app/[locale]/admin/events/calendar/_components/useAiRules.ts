import type { Dispatch, SetStateAction } from 'react'
import type { FormState } from './admin-create-event-form-types'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchAdminApi,
  isAiRulesResponse,
  readApiError,
} from './admin-create-event-form-utils'

export function useAiRules({
  buildAiPayload,
  setForm,
  setRulesGeneratorDialogOpen,
}: {
  buildAiPayload: () => unknown
  setForm: Dispatch<SetStateAction<FormState>>
  setRulesGeneratorDialogOpen: Dispatch<SetStateAction<boolean>>
}) {
  const t = useExtracted()
  const [isGeneratingRules, setIsGeneratingRules] = useState(false)

  const generateRulesWithAi = useCallback(async () => {
    setIsGeneratingRules(true)
    try {
      const response = await fetchAdminApi('/event-creations/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'generate_rules',
          data: buildAiPayload(),
        }),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !isAiRulesResponse(payload)) {
        throw new Error(apiError || t('Rules generation failed ({status})', { status: String(response.status) }))
      }

      setForm(prev => ({
        ...prev,
        resolutionRules: payload.rules,
      }))
      setRulesGeneratorDialogOpen(false)
      toast.success(t('Rules generated from {samplesUsed} samples.', { samplesUsed: String(payload.samplesUsed) }))
    }
    catch (error) {
      console.error('Error generating rules:', error)
      const message = error instanceof Error ? error.message : t('Could not generate rules with AI right now.')
      toast.error(message)
    }
    finally {
      setIsGeneratingRules(false)
    }
  }, [buildAiPayload, setForm, setRulesGeneratorDialogOpen, t])

  return {
    isGeneratingRules,
    generateRulesWithAi,
  }
}
