'use client'

export default function PublicActivityEmpty() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="px-8 py-16 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <svg
              className="size-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">
              No trading activity yet
            </h3>

            <p className="text-sm/relaxed text-muted-foreground">
              This user hasn't made any trades yet. Activity will appear here once they start trading on markets.
            </p>

            <div className="mt-6 rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                Trading activity includes buying and selling shares in prediction markets.
                When this user makes trades, they'll appear here with details about the markets,
                amounts, and outcomes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
