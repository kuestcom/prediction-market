import { useEffect, useState } from 'react'

interface WindowSize {
  width: number
  height: number
}

export function useWindowSize() {
  const [size, setSize] = useState<WindowSize>(() => {
    if (typeof window === 'undefined') {
      return { width: 0, height: 0 }
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  })

  useEffect(() => {
    function updateSize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', updateSize)

    return function () {
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  return size
}
