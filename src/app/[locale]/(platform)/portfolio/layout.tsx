export default async function PortfolioLayout({ children }: LayoutProps<'/[locale]/portfolio'>) {
  return (
    <main className="container py-8">
      <div className="mx-auto grid max-w-5xl gap-6">{children}</div>
    </main>
  )
}
