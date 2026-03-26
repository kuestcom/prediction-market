export function shouldHideMobileBottomNav(pathname: string) {
  return pathname.startsWith('/event/') || pathname.startsWith('/sports/')
}
