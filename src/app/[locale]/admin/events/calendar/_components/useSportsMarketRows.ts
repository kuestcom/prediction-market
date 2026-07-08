import type { Dispatch, SetStateAction } from 'react'
import type {
  AdminSportsCustomMarketState,
  AdminSportsFormState,
  AdminSportsPropState,
} from '@/lib/admin-sports-create'
import { useExtracted } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  createAdminSportsCustomMarket,
  createAdminSportsProp,
  getAdminSportsMarketTypeDefaultOutcomes,
  resolveAdminSportsMarketTypeOption,
} from '@/lib/admin-sports-create'

export function useSportsMarketRows({
  sportsForm,
  setSportsForm,
}: {
  sportsForm: AdminSportsFormState
  setSportsForm: Dispatch<SetStateAction<AdminSportsFormState>>
}) {
  const t = useExtracted()

  const handleSportsPropChange = useCallback((
    propId: string,
    field: keyof AdminSportsPropState,
    value: string,
  ) => {
    setSportsForm(prev => ({
      ...prev,
      props: prev.props.map(prop => prop.id === propId
        ? {
            ...prop,
            [field]: value,
          }
        : prop),
    }))
  }, [setSportsForm])

  const addSportsProp = useCallback(() => {
    setSportsForm((prev) => {
      const existingIds = new Set(prev.props.map(prop => prop.id))
      let nextIndex = prev.props.length + 1
      let nextId = `prop-${nextIndex}`
      while (existingIds.has(nextId)) {
        nextIndex += 1
        nextId = `prop-${nextIndex}`
      }

      return {
        ...prev,
        props: [...prev.props, createAdminSportsProp(nextId)],
      }
    })
  }, [setSportsForm])

  const removeSportsProp = useCallback((propId: string) => {
    if (sportsForm.props.length <= 1) {
      toast.error(t('At least 1 prop is required.'))
      return
    }

    if (!sportsForm.props.some(prop => prop.id === propId)) {
      return
    }

    setSportsForm((prev) => {
      return {
        ...prev,
        props: prev.props.filter(prop => prop.id !== propId),
      }
    })
  }, [setSportsForm, sportsForm.props, t])

  const handleSportsCustomMarketChange = useCallback((
    marketId: string,
    field: keyof AdminSportsCustomMarketState,
    value: string,
  ) => {
    setSportsForm((prev) => {
      const homeTeamName = prev.teams.find(team => team.hostStatus === 'home')?.name ?? ''
      const awayTeamName = prev.teams.find(team => team.hostStatus === 'away')?.name ?? ''

      return {
        ...prev,
        customMarkets: prev.customMarkets.map((market) => {
          if (market.id !== marketId) {
            return market
          }

          if (field !== 'sportsMarketType') {
            return {
              ...market,
              [field]: field === 'iconAssetKey' && value === 'none' ? '' : value,
            }
          }

          const typeOption = resolveAdminSportsMarketTypeOption(value)
          const defaultOutcomes = getAdminSportsMarketTypeDefaultOutcomes(value, {
            homeTeamName,
            awayTeamName,
          })

          return {
            ...market,
            sportsMarketType: value,
            title: market.title || typeOption?.label || '',
            shortName: market.shortName || typeOption?.label || '',
            groupItemTitle: market.groupItemTitle || typeOption?.label || '',
            outcomeOne: market.outcomeOne || defaultOutcomes?.[0] || '',
            outcomeTwo: market.outcomeTwo || defaultOutcomes?.[1] || '',
            iconAssetKey: market.iconAssetKey,
          }
        }),
      }
    })
  }, [setSportsForm])

  const addSportsCustomMarket = useCallback(() => {
    setSportsForm((prev) => {
      const existingIds = new Set(prev.customMarkets.map(market => market.id))
      let nextIndex = prev.customMarkets.length + 1
      let nextId = `market-${nextIndex}`
      while (existingIds.has(nextId)) {
        nextIndex += 1
        nextId = `market-${nextIndex}`
      }

      return {
        ...prev,
        customMarkets: [...prev.customMarkets, createAdminSportsCustomMarket(nextId)],
      }
    })
  }, [setSportsForm])

  const removeSportsCustomMarket = useCallback((marketId: string) => {
    if (sportsForm.customMarkets.length <= 1) {
      toast.error(t('At least 1 custom sports market row is required.'))
      return
    }

    if (!sportsForm.customMarkets.some(market => market.id === marketId)) {
      return
    }

    setSportsForm((prev) => {
      return {
        ...prev,
        customMarkets: prev.customMarkets.filter(market => market.id !== marketId),
      }
    })
  }, [setSportsForm, sportsForm.customMarkets, t])

  return {
    handleSportsPropChange,
    addSportsProp,
    removeSportsProp,
    handleSportsCustomMarketChange,
    addSportsCustomMarket,
    removeSportsCustomMarket,
  }
}
