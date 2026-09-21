import { requestOpenRouterDecisions } from '@/lib/ai/openrouter'

export interface EventCreationDecisionWarning {
  code: 'rules'
  reason: string
  step: 3
}

export async function reviewEventCreationWithDecisionModel(options: {
  apiKey: string
  model: string
  input: Record<string, unknown>
  timeoutMs?: number
}): Promise<EventCreationDecisionWarning[]> {
  const response = await requestOpenRouterDecisions(
    {
      model: options.model,
      state: options.input,
      questions: {
        single_outcome: {
          type: 'noul',
          instructions:
            'Does this event describe one clear, answerable outcome, with question, outcomes, dates, and context that agree with each other?',
          criteria: {
            true: 'The event has one clear and coherent outcome.',
            false: 'The event is ambiguous, internally inconsistent, or combines multiple outcomes.',
          },
        },
        deterministic_rules: {
          type: 'noul',
          instructions:
            'Could an independent reviewer resolve this event from the supplied resolution rules and source without using personal judgment?',
          criteria: {
            true: 'The resolution rules are objective and reproducible.',
            false: 'The resolution rules are ambiguous, subjective, or incomplete.',
          },
        },
      },
    },
    { apiKey: options.apiKey, timeoutMs: options.timeoutMs ?? 8_000 },
  )

  const warnings: EventCreationDecisionWarning[] = []
  const singleOutcome = response.answers.single_outcome?.noul
  const deterministicRules = response.answers.deterministic_rules?.noul

  if (typeof singleOutcome === 'number' && singleOutcome < 0.65) {
    warnings.push({
      code: 'rules',
      reason: 'The decision model recommends reviewing the event framing because the outcome may be ambiguous.',
      step: 3,
    })
  }

  if (typeof deterministicRules === 'number' && deterministicRules < 0.65) {
    warnings.push({
      code: 'rules',
      reason:
        'The decision model recommends reviewing the resolution rules because they may require subjective judgment.',
      step: 3,
    })
  }

  return warnings
}
