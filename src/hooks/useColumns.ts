import { useEffect, useState } from 'react'

export function useColumns(maxColumns = Number.POSITIVE_INFINITY) {
  const [columns, setColumns] = useState(Math.min(4, maxColumns))

  useEffect(() => {
    function updateColumns() {
      const width = window.innerWidth

      queueMicrotask(() => {
        const nextColumns = width >= 1280
          ? 4
          : width >= 1024
            ? 3
            : width >= 768
              ? 2
              : 1

        setColumns(Math.min(nextColumns, maxColumns))
      })
    }

    updateColumns()

    const mediaQueries = [
      window.matchMedia('(min-width: 1280px)'),
      window.matchMedia('(min-width: 1024px)'),
      window.matchMedia('(min-width: 768px)'),
    ]

    mediaQueries.forEach(mq => mq.addEventListener('change', updateColumns))

    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', updateColumns))
    }
  }, [maxColumns])

  return columns
}
