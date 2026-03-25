export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

export function detectIos() {
  const userAgent = window.navigator.userAgent
  const hasTouchOnMac = /Macintosh/.test(userAgent) && window.navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/.test(userAgent) || hasTouchOnMac
}

export function detectStandaloneMode() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }

  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}
