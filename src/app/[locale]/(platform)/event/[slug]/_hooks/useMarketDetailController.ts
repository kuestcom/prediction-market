import { useCallback, useState } from 'react'

export type MarketDetailTab = 'orderBook' | 'graph' | 'resolution' | 'history' | 'positions' | 'openOrders'

const DEFAULT_TAB: MarketDetailTab = 'orderBook'

interface MarketDetailControllerState {
  eventId: string
  expandedMarketId: string | null
  orderBookPollingEnabled: boolean
  marketDetailTabById: Record<string, MarketDetailTab>
}

function createDefaultControllerState(eventId: string): MarketDetailControllerState {
  return {
    eventId,
    expandedMarketId: null,
    orderBookPollingEnabled: false,
    marketDetailTabById: {},
  }
}

function resolveControllerStateForEvent(
  state: MarketDetailControllerState,
  eventId: string,
): MarketDetailControllerState {
  if (state.eventId === eventId) {
    return state
  }

  return createDefaultControllerState(eventId)
}

function withDefaultTab(
  state: MarketDetailControllerState,
  marketId: string,
): MarketDetailControllerState {
  if (state.marketDetailTabById[marketId]) {
    return state
  }

  return {
    ...state,
    marketDetailTabById: {
      ...state.marketDetailTabById,
      [marketId]: DEFAULT_TAB,
    },
  }
}

export interface MarketDetailController {
  expandedMarketId: string | null
  orderBookPollingEnabled: boolean
  toggleMarket: (marketId: string) => void
  expandMarket: (marketId: string) => void
  collapseMarket: () => void
  selectDetailTab: (marketId: string, tab: MarketDetailTab) => void
  getSelectedDetailTab: (marketId: string) => MarketDetailTab
}

export function useMarketDetailController(eventId: string): MarketDetailController {
  const [controllerState, setControllerState] = useState<MarketDetailControllerState>(() => createDefaultControllerState(eventId))
  const currentState = resolveControllerStateForEvent(controllerState, eventId)

  const expandMarket = useCallback((marketId: string) => {
    setControllerState((previousState) => {
      const eventState = resolveControllerStateForEvent(previousState, eventId)
      const withTab = withDefaultTab(eventState, marketId)
      return {
        ...withTab,
        expandedMarketId: marketId,
        orderBookPollingEnabled: true,
      }
    })
  }, [eventId])

  const collapseMarket = useCallback(() => {
    setControllerState((previousState) => {
      const eventState = resolveControllerStateForEvent(previousState, eventId)
      return {
        ...eventState,
        expandedMarketId: null,
        orderBookPollingEnabled: false,
      }
    })
  }, [eventId])

  const toggleMarket = useCallback((marketId: string) => {
    setControllerState((previousState) => {
      const eventState = resolveControllerStateForEvent(previousState, eventId)
      if (eventState.expandedMarketId === marketId) {
        return {
          ...eventState,
          expandedMarketId: null,
          orderBookPollingEnabled: false,
        }
      }

      const withTab = withDefaultTab(eventState, marketId)
      return {
        ...withTab,
        expandedMarketId: marketId,
        orderBookPollingEnabled: true,
      }
    })
  }, [eventId])

  const selectDetailTab = useCallback((marketId: string, tab: MarketDetailTab) => {
    setControllerState((previousState) => {
      const eventState = resolveControllerStateForEvent(previousState, eventId)
      return {
        ...eventState,
        marketDetailTabById: {
          ...eventState.marketDetailTabById,
          [marketId]: tab,
        },
      }
    })
  }, [eventId])

  const getSelectedDetailTab = useCallback(
    (marketId: string) => currentState.marketDetailTabById[marketId] ?? DEFAULT_TAB,
    [currentState.marketDetailTabById],
  )

  return {
    expandedMarketId: currentState.expandedMarketId,
    orderBookPollingEnabled: currentState.orderBookPollingEnabled,
    toggleMarket,
    expandMarket,
    collapseMarket,
    selectDetailTab,
    getSelectedDetailTab,
  }
}
