import { useLayoutEffect, useState } from 'react'

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(
    () => typeof document !== 'undefined'
      && document.documentElement.classList.contains('dark'),
  )

  useLayoutEffect(function observeDarkModeChanges() {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement

    function updateTheme() {
      setIsDarkMode(root.classList.contains('dark'))
    }

    const observer = new MutationObserver(updateTheme)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return function disconnectObserver() {
      observer.disconnect()
    }
  }, [])

  return isDarkMode
}
