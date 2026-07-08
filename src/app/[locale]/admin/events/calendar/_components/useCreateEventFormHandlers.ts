import type { Dispatch, SetStateAction } from 'react'
import type {
  CategoryItem,
  CategorySuggestion,
  FormState,
} from './admin-create-event-form-types'
import type { SportsMatchCandidate } from './useSportsMatchSearch'
import type {
  AdminSportsFormState,
  AdminSportsSlugCatalog,
  AdminSportsTeamHostStatus,
} from '@/lib/admin-sports-create'
import { useExtracted } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { isSportsMainCategory } from '@/lib/admin-sports-create'
import { formatDateTimeLocalValue, normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import {
  slugifyEventCreationValue as slugify,
} from '@/lib/event-creation'
import { CUSTOM_SPORTS_SLUG_SELECT_VALUE } from './admin-create-event-form-constants'
import { createInitialForm, createOption } from './admin-create-event-form-utils'

export function useCreateEventFormHandlers({
  categoryQuery,
  filteredCategorySuggestions,
  form,
  normalizedLeagueSlug,
  setCategoryQuery,
  setForm,
  setIsCustomLeagueSlug,
  setIsCustomSportSlug,
  setOptionImageFiles,
  setSelectedSportsMatch,
  setSportsForm,
  sportsSlugCatalog,
}: {
  categoryQuery: string
  filteredCategorySuggestions: CategorySuggestion[]
  form: FormState
  normalizedLeagueSlug: string
  setCategoryQuery: Dispatch<SetStateAction<string>>
  setForm: Dispatch<SetStateAction<FormState>>
  setIsCustomLeagueSlug: Dispatch<SetStateAction<boolean>>
  setIsCustomSportSlug: Dispatch<SetStateAction<boolean>>
  setOptionImageFiles: Dispatch<SetStateAction<Record<string, File | null>>>
  setSelectedSportsMatch: Dispatch<SetStateAction<SportsMatchCandidate | null>>
  setSportsForm: Dispatch<SetStateAction<AdminSportsFormState>>
  sportsSlugCatalog: AdminSportsSlugCatalog
}) {
  const t = useExtracted()

  const handleSportsFieldChange = useCallback(
    <K extends keyof AdminSportsFormState>(field: K, value: AdminSportsFormState[K]) => {
      setSportsForm((prev) => {
        if (field === 'startTime') {
          return {
            ...prev,
            startTime: normalizeDateTimeLocalValue(typeof value === 'string' ? value : ''),
          }
        }

        if (field === 'section') {
          if (value === 'props') {
            return {
              ...prev,
              section: value,
              eventVariant: 'standard',
            }
          }

          if (value === 'games') {
            return {
              ...prev,
              section: value,
              eventVariant: '',
            }
          }
        }

        return {
          ...prev,
          [field]: value,
        }
      })
    },
    [setSportsForm],
  )

  const handleSportsTeamChange = useCallback((
    hostStatus: AdminSportsTeamHostStatus,
    field: 'name' | 'abbreviation',
    value: string,
  ) => {
    setSportsForm(prev => ({
      ...prev,
      teams: prev.teams.map(team => team.hostStatus === hostStatus
        ? {
            ...team,
            [field]: value,
          }
        : team) as AdminSportsFormState['teams'],
    }))
  }, [setSportsForm])

  const applySportsMatchCandidate = useCallback((candidate: SportsMatchCandidate) => {
    setSelectedSportsMatch(candidate)
    setSportsForm((prev) => {
      const nextStartTime = candidate.startTime
        ? formatDateTimeLocalValue(new Date(candidate.startTime))
        : prev.startTime

      return {
        ...prev,
        section: prev.section || 'games',
        sportSlug: candidate.sportSlug || prev.sportSlug,
        leagueSlug: candidate.leagueSlug || prev.leagueSlug,
        startTime: nextStartTime,
        sourceProvider: candidate.provider,
        sourceEventId: candidate.eventId,
        sourceGameId: candidate.gameId ?? '',
        sourceLeagueId: candidate.leagueId ?? '',
        sourceLeagueLabel: candidate.leagueName ?? '',
        sourceMatchConfidence: String(candidate.confidence ?? ''),
        livestreamUrl: candidate.livestreamUrl ?? prev.livestreamUrl,
        teams: [
          {
            ...prev.teams[0],
            name: candidate.homeTeam?.name || prev.teams[0].name,
            abbreviation: candidate.homeTeam?.abbreviation || prev.teams[0].abbreviation,
          },
          {
            ...prev.teams[1],
            name: candidate.awayTeam?.name || prev.teams[1].name,
            abbreviation: candidate.awayTeam?.abbreviation || prev.teams[1].abbreviation,
          },
        ],
      }
    })
  }, [setSelectedSportsMatch, setSportsForm])

  const clearSportsMatchCandidate = useCallback(() => {
    setSelectedSportsMatch(null)
    setSportsForm(prev => ({
      ...prev,
      sourceProvider: '',
      sourceEventId: '',
      sourceGameId: '',
      sourceLeagueId: '',
      sourceLeagueLabel: '',
      sourceMatchConfidence: '',
      livestreamUrl: '',
    }))
  }, [setSelectedSportsMatch, setSportsForm])

  const handleSportSlugSelectChange = useCallback((value: string) => {
    if (value === CUSTOM_SPORTS_SLUG_SELECT_VALUE) {
      setIsCustomSportSlug(true)
      handleSportsFieldChange('sportSlug', '')
      return
    }

    const nextLeagueOptions = sportsSlugCatalog.leagueOptionsBySport[value] ?? []
    setIsCustomSportSlug(false)
    handleSportsFieldChange('sportSlug', value)

    if (
      nextLeagueOptions.length > 0
      && normalizedLeagueSlug
      && !nextLeagueOptions.some(option => option.value === normalizedLeagueSlug)
    ) {
      setIsCustomLeagueSlug(false)
      handleSportsFieldChange('leagueSlug', '')
    }
  }, [
    handleSportsFieldChange,
    normalizedLeagueSlug,
    setIsCustomLeagueSlug,
    setIsCustomSportSlug,
    sportsSlugCatalog.leagueOptionsBySport,
  ])

  const handleLeagueSlugSelectChange = useCallback((value: string) => {
    if (value === CUSTOM_SPORTS_SLUG_SELECT_VALUE) {
      setIsCustomLeagueSlug(true)
      handleSportsFieldChange('leagueSlug', '')
      return
    }

    setIsCustomLeagueSlug(false)
    handleSportsFieldChange('leagueSlug', value)
  }, [handleSportsFieldChange, setIsCustomLeagueSlug])

  const handleFieldChange = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      if (field === 'endDateIso') {
        setForm(prev => ({
          ...prev,
          endDateIso: normalizeDateTimeLocalValue(typeof value === 'string' ? value : ''),
        }))
        return
      }

      if (field === 'mainCategorySlug') {
        const nextMainCategorySlug = typeof value === 'string' ? value : ''
        setForm((prev) => {
          if (isSportsMainCategory(nextMainCategorySlug)) {
            return {
              ...prev,
              mainCategorySlug: nextMainCategorySlug,
              marketMode: 'multi_multiple',
              categories: [],
              options: [],
            }
          }

          if (isSportsMainCategory(prev.mainCategorySlug)) {
            const fallback = createInitialForm()
            return {
              ...prev,
              mainCategorySlug: nextMainCategorySlug,
              categories: [],
              marketMode: null,
              options: fallback.options,
              binaryQuestion: fallback.binaryQuestion,
              binaryOutcomeYes: fallback.binaryOutcomeYes,
              binaryOutcomeNo: fallback.binaryOutcomeNo,
            }
          }

          return {
            ...prev,
            mainCategorySlug: nextMainCategorySlug,
          }
        })
        return
      }

      setForm(prev => ({ ...prev, [field]: value }))
    },
    [setForm],
  )

  const handleEndDateInputValueChange = useCallback((value: string) => {
    handleFieldChange('endDateIso', value)
  }, [handleFieldChange])

  const handleSportsStartTimeInputValueChange = useCallback((value: string) => {
    handleSportsFieldChange('startTime', value)
  }, [handleSportsFieldChange])

  const addCategory = useCallback((category: CategorySuggestion | CategoryItem) => {
    const nextLabel = ('name' in category ? category.name : category.label).trim()
    const nextSlug = slugify(category.slug || nextLabel)

    if (!nextSlug || !nextLabel) {
      return
    }

    setForm((prev) => {
      const alreadyExists = prev.categories.some(item => item.slug === nextSlug)
      if (alreadyExists) {
        return prev
      }

      return {
        ...prev,
        categories: [
          ...prev.categories,
          {
            label: nextLabel,
            slug: nextSlug,
          },
        ],
      }
    })

    setCategoryQuery('')
  }, [setCategoryQuery, setForm])

  const addCategoryFromInput = useCallback(() => {
    const text = categoryQuery.trim()
    if (!text) {
      return
    }

    const querySlug = slugify(text)
    const exactMatch = filteredCategorySuggestions.find(item => item.slug === querySlug)

    if (exactMatch) {
      addCategory(exactMatch)
      return
    }

    addCategory({
      label: text,
      slug: querySlug,
    })
  }, [addCategory, categoryQuery, filteredCategorySuggestions])

  const removeCategory = useCallback((slug: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.filter(item => item.slug !== slug),
    }))
  }, [setForm])

  const handleOptionChange = useCallback((optionId: string, field: 'question' | 'title' | 'shortName' | 'outcomeYes' | 'outcomeNo', value: string) => {
    setForm((prev) => {
      const options = prev.options.map((option) => {
        if (option.id !== optionId) {
          return option
        }

        if (field === 'question') {
          return {
            ...option,
            question: value,
          }
        }

        if (field === 'title') {
          return {
            ...option,
            title: value,
            slug: slugify(value),
          }
        }

        if (field === 'outcomeYes') {
          return {
            ...option,
            outcomeYes: value,
          }
        }

        if (field === 'outcomeNo') {
          return {
            ...option,
            outcomeNo: value,
          }
        }

        return {
          ...option,
          shortName: value,
        }
      })

      return { ...prev, options }
    })
  }, [setForm])

  const addOption = useCallback(() => {
    setForm((prev) => {
      const existingIds = new Set(prev.options.map(option => option.id))
      let nextIndex = prev.options.length + 1
      let nextId = `opt-${nextIndex}`
      while (existingIds.has(nextId)) {
        nextIndex += 1
        nextId = `opt-${nextIndex}`
      }

      return {
        ...prev,
        options: [...prev.options, createOption(nextId)],
      }
    })
  }, [setForm])

  const removeOption = useCallback((optionId: string) => {
    if (form.options.length <= 2) {
      toast.error(t('At least 2 options are required.'))
      return
    }

    if (!form.options.some(option => option.id === optionId)) {
      return
    }

    setForm((prev) => {
      return {
        ...prev,
        options: prev.options.filter(option => option.id !== optionId),
      }
    })

    setOptionImageFiles((prev) => {
      const { [optionId]: _removed, ...rest } = prev
      return rest
    })
  }, [form.options, setForm, setOptionImageFiles, t])

  return {
    handleSportsFieldChange,
    handleSportsTeamChange,
    applySportsMatchCandidate,
    clearSportsMatchCandidate,
    handleSportSlugSelectChange,
    handleLeagueSlugSelectChange,
    handleFieldChange,
    handleEndDateInputValueChange,
    handleSportsStartTimeInputValueChange,
    addCategory,
    addCategoryFromInput,
    removeCategory,
    handleOptionChange,
    addOption,
    removeOption,
  }
}
