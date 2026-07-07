import type { RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

interface HorizontalScrollMaskParams {
  showLeftShadow: boolean
  showRightShadow: boolean
}

interface HorizontalScrollShadowsParams<TContainer extends HTMLElement> {
  containerRef: RefObject<TContainer | null>
  onResize?: () => void
  onScroll?: () => void
}

interface ScrollActiveItemParams<TContainer extends HTMLElement, TItem extends HTMLElement> {
  activeIndex: number
  containerRef: RefObject<TContainer | null>
  itemRef: RefObject<(TItem | null)[]>
  delay?: number
  dependencyKey?: string | number
}

export function resolveHorizontalScrollMaskClass({
  showLeftShadow,
  showRightShadow,
}: HorizontalScrollMaskParams) {
  if (showLeftShadow && showRightShadow) {
    return `
      mask-[linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]
      [-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]
    `
  }

  if (showLeftShadow) {
    return `
      mask-[linear-gradient(to_right,transparent,black_32px,black)]
      [-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black)]
    `
  }

  if (showRightShadow) {
    return `
      mask-[linear-gradient(to_right,black,black_calc(100%-32px),transparent)]
      [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-32px),transparent)]
    `
  }

  return ''
}

export function useHorizontalScrollShadows<TContainer extends HTMLElement>({
  containerRef,
  onResize,
  onScroll,
}: HorizontalScrollShadowsParams<TContainer>) {
  const [showLeftShadow, setShowLeftShadow] = useState(false)
  const [showRightShadow, setShowRightShadow] = useState(false)

  const updateScrollShadows = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      setShowLeftShadow(false)
      setShowRightShadow(false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScrollLeft = scrollWidth - clientWidth

    setShowLeftShadow(scrollLeft > 4)
    setShowRightShadow(scrollLeft < maxScrollLeft - 4)
  }, [containerRef])

  useLayoutEffect(function updateInitialHorizontalScrollShadows() {
    const rafId = requestAnimationFrame(() => {
      updateScrollShadows()
    })

    return function cancelInitialHorizontalScrollShadowFrame() {
      cancelAnimationFrame(rafId)
    }
  }, [updateScrollShadows])

  useEffect(function bindHorizontalScrollListeners() {
    const container = containerRef.current
    if (!container) {
      return
    }

    let resizeTimeout: ReturnType<typeof setTimeout>

    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        updateScrollShadows()
        onResize?.()
      }, 16)
    }

    function handleScroll() {
      updateScrollShadows()
      onScroll?.()
    }

    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return function unbindHorizontalScrollListeners() {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [containerRef, onResize, onScroll, updateScrollShadows])

  return { showLeftShadow, showRightShadow, updateScrollShadows }
}

export function scrollElementIntoHorizontalView(
  container: HTMLElement,
  item: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
) {
  const containerRect = container.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const currentLeft = itemRect.left - containerRect.left + container.scrollLeft
  const targetLeft = currentLeft - (containerRect.width / 2) + (itemRect.width / 2)
  const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth)
  const clampedLeft = Math.min(Math.max(0, targetLeft), maxLeft)

  container.scrollTo({ left: clampedLeft, behavior })
}

export function useScrollActiveItemIntoView<TContainer extends HTMLElement, TItem extends HTMLElement>({
  activeIndex,
  containerRef,
  itemRef,
  delay = 100,
  dependencyKey,
}: ScrollActiveItemParams<TContainer, TItem>) {
  useEffect(function scrollActiveItemIntoHorizontalView() {
    if (activeIndex < 0) {
      return
    }

    const timeoutId = setTimeout(() => {
      const container = containerRef.current
      const activeItem = itemRef.current[activeIndex]
      if (!container || !activeItem) {
        return
      }

      scrollElementIntoHorizontalView(container, activeItem)
    }, delay)

    return function cancelScrollActiveItemIntoHorizontalView() {
      clearTimeout(timeoutId)
    }
  }, [activeIndex, containerRef, delay, dependencyKey, itemRef])
}
