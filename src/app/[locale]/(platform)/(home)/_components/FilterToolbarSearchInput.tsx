'use client'

import { SearchIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface FilterToolbarSearchInputProps {
  search: string
  onSearchChange: (search: string) => void
}

export default function FilterToolbarSearchInput({ search, onSearchChange }: FilterToolbarSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState(search)
  const isFirstRenderRef = useRef(true)
  const prevSearchRef = useRef(search)
  const t = useExtracted()

  useEffect(() => {
    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search
      setSearchQuery(search)
    }
  }, [search])

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    const handler = setTimeout(() => {
      onSearchChange(searchQuery)
    }, 150)

    return () => clearTimeout(handler)
  }, [searchQuery, onSearchChange])

  const iconClasses = 'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'

  return (
    <div className="relative w-full md:w-44 lg:w-52 xl:w-56">
      <SearchIcon className={iconClasses} />
      <Input
        type="text"
        data-testid="filter-search-input"
        placeholder={t('Search')}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className={`
          border-transparent bg-input pl-10 shadow-none transition-colors
          hover:bg-(--input-hover)
          focus-visible:border-border focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0
        `}
      />
    </div>
  )
}
