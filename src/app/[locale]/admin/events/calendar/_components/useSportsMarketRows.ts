import type { Dispatch, SetStateAction } from 'react'
import type {
  AdminSportsCustomMarketState,
  AdminSportsFormState,
  AdminSportsPropState,
} from '@/lib/admin-sports-create'
import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  createAdminSportsCustomMarket,
  createAdminSportsProp,
  getAdminSportsMarketTypeDefaultOutcomes,
  resolveAdminSportsMarketTypeOption,
} from '@/lib/admin-sports-create'

export function useSportsMarketRows({
  setSportsForm,
}: {
  setSportsForm: Dispatch<SetStateAction<AdminSportsFormState>>
}) {
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
    setSportsForm((prev) => {
      if (prev.props.length <= 1) {
        toast.error('At least 1 prop is required.')
        return prev
      }

      return {
        ...prev,
        props: prev.props.filter(prop => prop.id !== propId),
      }
    })
  }, [setSportsForm])

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
    setSportsForm((prev) => {
      if (prev.customMarkets.length <= 1) {
        toast.error('At least 1 custom sports market row is required.')
        return prev
      }

      return {
        ...prev,
        customMarkets: prev.customMarkets.filter(market => market.id !== marketId),
      }
    })
  }, [setSportsForm])

  return {
    handleSportsPropChange,
    addSportsProp,
    removeSportsProp,
    handleSportsCustomMarketChange,
    addSportsCustomMarket,
    removeSportsCustomMarket,
  }
}
