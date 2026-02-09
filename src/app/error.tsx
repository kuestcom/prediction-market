'use client'

export default function Error() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Temporarily unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">We are getting things ready.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please check back in a few minutes.
        </p>
      </div>
    </div>
  )
}
