import { LIST_ROW_COLUMNS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi'
import { cn } from '@/lib/utils'

export const LEADERBOARD_LAYOUT_CLASS_NAME = cn(`
  grid w-full gap-8
  lg:grid-cols-[minmax(0,1fr)_380px]
  xl:grid-cols-[minmax(0,54.5rem)_23.75rem] xl:justify-between xl:gap-6
`)

export const LEADERBOARD_ROW_CLASS_NAME = cn(`
  group relative z-0 grid w-full ${LIST_ROW_COLUMNS}
  min-h-[82px] items-center gap-4 py-5 pr-2 pl-3 text-sm
  before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-lg
  before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 before:content-['']
  hover:before:opacity-100
  dark:before:bg-white/5
`)
