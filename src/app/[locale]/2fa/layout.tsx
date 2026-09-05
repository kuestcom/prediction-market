export default async function TwoFactorLayout({ children }: LayoutProps<'/[locale]/2fa'>) {
  return <main className="flex min-h-screen items-center justify-center px-4 py-12">{children}</main>
}
