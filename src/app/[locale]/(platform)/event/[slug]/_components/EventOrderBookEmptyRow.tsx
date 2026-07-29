interface EventOrderBookEmptyRowProps {
  label: string
}

export default function EventOrderBookEmptyRow({ label }: EventOrderBookEmptyRowProps) {
  return (
    <div className="grid h-9 grid-cols-[40%_20%_20%_20%] items-center px-4">
      <span className="col-span-4 text-center text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}
