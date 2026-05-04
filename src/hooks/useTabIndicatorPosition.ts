'use client'

import { useCallback, useRef, useSyncExternalStore } from 'react'

interface UseTabIndicatorPositionOptions<T extends { id: string }> {
  tabs: T[]
  activeTab: string
}

interface TabIndicatorStyle {
  left: number
  width: number
}

interface TabIndicatorSnapshot {
  indicatorStyle: TabIndicatorStyle
  isInitialized: boolean
}

const INITIAL_TAB_INDICATOR_STYLE: TabIndicatorStyle = { left: 0, width: 0 }
const INITIAL_TAB_INDICATOR_SNAPSHOT: TabIndicatorSnapshot = {
  indicatorStyle: INITIAL_TAB_INDICATOR_STYLE,
  isInitialized: false,
}

function getTabIndicatorServerSnapshot() {
  return INITIAL_TAB_INDICATOR_SNAPSHOT
}

export function useTabIndicatorPosition<T extends { id: string }>({
  tabs,
  activeTab,
}: UseTabIndicatorPositionOptions<T>) {
  const tabRef = useRef<(HTMLButtonElement | null)[]>([])
  const tabIndicatorSnapshotRef = useRef<TabIndicatorSnapshot>(INITIAL_TAB_INDICATOR_SNAPSHOT)

  const getActiveTabElement = useCallback(() => {
    const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab)
    if (activeTabIndex < 0) {
      return null
    }
    return tabRef.current[activeTabIndex] ?? null
  }, [activeTab, tabs])

  const subscribeToTabIndicator = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
      return function noopTabIndicatorSubscription() {}
    }

    const activeTabElement = getActiveTabElement()

    function notifyTabIndicatorChange() {
      onStoreChange()
    }

    const frameId = window.requestAnimationFrame(notifyTabIndicatorChange)
    window.addEventListener('resize', notifyTabIndicatorChange)

    if (typeof ResizeObserver === 'undefined' || !activeTabElement) {
      return function unsubscribeTabIndicatorWithoutObserver() {
        window.cancelAnimationFrame(frameId)
        window.removeEventListener('resize', notifyTabIndicatorChange)
      }
    }

    const resizeObserver = new ResizeObserver(notifyTabIndicatorChange)
    resizeObserver.observe(activeTabElement)

    return function unsubscribeTabIndicator() {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', notifyTabIndicatorChange)
      resizeObserver.disconnect()
    }
  }, [getActiveTabElement])

  const getTabIndicatorClientSnapshot = useCallback(() => {
    const activeTabElement = getActiveTabElement()
    if (!activeTabElement) {
      return tabIndicatorSnapshotRef.current
    }

    const nextIndicatorStyle: TabIndicatorStyle = {
      left: activeTabElement.offsetLeft,
      width: activeTabElement.offsetWidth,
    }
    const currentSnapshot = tabIndicatorSnapshotRef.current
    if (
      currentSnapshot.isInitialized
      && currentSnapshot.indicatorStyle.left === nextIndicatorStyle.left
      && currentSnapshot.indicatorStyle.width === nextIndicatorStyle.width
    ) {
      return currentSnapshot
    }

    const nextSnapshot: TabIndicatorSnapshot = {
      indicatorStyle: nextIndicatorStyle,
      isInitialized: true,
    }

    tabIndicatorSnapshotRef.current = nextSnapshot
    return nextSnapshot
  }, [getActiveTabElement])

  const { indicatorStyle, isInitialized } = useSyncExternalStore(
    subscribeToTabIndicator,
    getTabIndicatorClientSnapshot,
    getTabIndicatorServerSnapshot,
  )

  return { tabRef, indicatorStyle, isInitialized }
}
