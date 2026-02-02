'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { AlertCircleIcon, CalendarIcon, CheckCircle2Icon, ImageIcon, Loader2Icon, PlusIcon, TagIcon, Trash2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { OUTCOME_INDEX } from '@/lib/constants'
import { RESOLVED_BY_ADDRESS } from '@/lib/contracts'

interface EventTag {
  label: string
  slug: string
}

interface MarketOutcome {
  outcome: string
  token_id?: string
}

interface Market {
  question: string
  description: string
  icon: string
  market_slug: string
  outcomes: MarketOutcome[]
}

interface EventForm {
  event_id: string
  slug: string
  title: string
  description: string
  start_date_iso: string
  end_date_iso: string
  icon: string
  tags: EventTag[]
  show_market_icons: boolean
  resolution_source?: string
  markets: Market[]
}

function createEmptyMarket(): Market {
  return {
    question: '',
    description: '',
    icon: '',
    market_slug: '',
    outcomes: [
      { outcome: '' },
      { outcome: '' },
    ],
  }
}

function createInitialForm(): EventForm {
  return {
    event_id: '',
    slug: '',
    title: '',
    description: '',
    start_date_iso: '',
    end_date_iso: '',
    icon: '',
    tags: [{ label: '', slug: '' }],
    show_market_icons: true,
    resolution_source: '',
    markets: [createEmptyMarket()],
  }
}

export default function AdminCreateEventForm() {
  const t = useExtracted()
  const [isLoading, setIsLoading] = useState(false)
  const [availableTags, setAvailableTags] = useState<EventTag[]>([])
  const [eventIconFile, setEventIconFile] = useState<File | null>(null)
  const [marketIconFiles, setMarketIconFiles] = useState<Record<number, File | null>>({})
  const eventTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tagSlugTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const marketSlugTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const slugAvailabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestSlugRef = useRef<string>('')
  const [slugValidationState, setSlugValidationState] = useState<'idle' | 'checking' | 'unique' | 'duplicate' | 'error'>('idle')
  const [form, setForm] = useState<EventForm>(() => createInitialForm())

  useEffect(() => {
    return () => {
      if (eventTitleTimeoutRef.current) {
        clearTimeout(eventTitleTimeoutRef.current)
      }
      if (slugAvailabilityTimeoutRef.current) {
        clearTimeout(slugAvailabilityTimeoutRef.current)
      }
      if (tagSlugTimeoutRef.current) {
        clearTimeout(tagSlugTimeoutRef.current)
      }
      if (marketSlugTimeoutRef.current) {
        clearTimeout(marketSlugTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    latestSlugRef.current = form.slug.trim().toLowerCase()
  }, [form.slug])

  useEffect(() => {
    async function loadTags() {
      try {
        const response = await fetch('/admin/api/main-tags')
        if (!response.ok) {
          throw new Error(`Failed to load tags (${response.status})`)
        }

        const payload: { tags: { name: string, slug: string }[] } = await response.json()
        setAvailableTags(payload.tags.map(tag => ({
          label: tag.name,
          slug: tag.slug,
        })))
      }
      catch (error) {
        console.error('Error loading tags:', error)
        toast.error('Unable to load tags. Try again later.')
      }
    }

    void loadTags()
  }, [])

  const generateSlug = useCallback((text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }, [])

  const handleEventFieldChange = useCallback((field: keyof EventForm, value: EventForm[keyof EventForm]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  useEffect(() => {
    if (eventTitleTimeoutRef.current) {
      clearTimeout(eventTitleTimeoutRef.current)
    }

    eventTitleTimeoutRef.current = setTimeout(() => {
      if (form.title.trim()) {
        const slug = generateSlug(form.title)
        setForm(prev => ({
          ...prev,
          slug,
          event_id: slug,
        }))
      }
    }, 500)

    return () => {
      if (eventTitleTimeoutRef.current) {
        clearTimeout(eventTitleTimeoutRef.current)
      }
    }
  }, [form.title, generateSlug])

  const handleTagChange = useCallback((index: number, field: keyof EventTag, value: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.map((tag, tagIndex) =>
        tagIndex === index ? { ...tag, [field]: value } : tag,
      ),
    }))
  }, [])

  useEffect(() => {
    if (slugAvailabilityTimeoutRef.current) {
      clearTimeout(slugAvailabilityTimeoutRef.current)
      slugAvailabilityTimeoutRef.current = null
    }

    const slug = form.slug.trim().toLowerCase()
    if (!slug) {
      setSlugValidationState('idle')
      return
    }

    setSlugValidationState('checking')

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/admin/api/events/check-slug?slug=${encodeURIComponent(slug)}`)

        if (!response.ok) {
          throw new Error(`Failed to validate slug (${response.status})`)
        }

        const payload: { exists: boolean } = await response.json()
        if (latestSlugRef.current !== slug) {
          return
        }

        setSlugValidationState(payload.exists ? 'duplicate' : 'unique')
      }
      catch (error) {
        console.error('Error checking slug availability:', error)
        if (latestSlugRef.current === slug) {
          setSlugValidationState('error')
        }
      }
    }, 400)

    slugAvailabilityTimeoutRef.current = timeoutId

    return () => {
      clearTimeout(timeoutId)
    }
  }, [form.slug])

  useEffect(() => {
    if (tagSlugTimeoutRef.current) {
      clearTimeout(tagSlugTimeoutRef.current)
      tagSlugTimeoutRef.current = null
    }

    if (!form.tags.some(tag => tag.label.trim())) {
      return
    }

    tagSlugTimeoutRef.current = setTimeout(() => {
      setForm((prev) => {
        let hasChanges = false

        const nextTags = prev.tags.map((tag) => {
          if (!tag.label.trim()) {
            return tag
          }

          const nextSlug = generateSlug(tag.label)
          if (tag.slug === nextSlug) {
            return tag
          }

          hasChanges = true
          return { ...tag, slug: nextSlug }
        })

        if (!hasChanges) {
          return prev
        }

        return {
          ...prev,
          tags: nextTags,
        }
      })
    }, 300)

    return () => {
      if (tagSlugTimeoutRef.current) {
        clearTimeout(tagSlugTimeoutRef.current)
        tagSlugTimeoutRef.current = null
      }
    }
  }, [form.tags, generateSlug])

  const addTag = useCallback(() => {
    setForm(prev => ({
      ...prev,
      tags: [...prev.tags, { label: '', slug: '' }],
    }))
  }, [])

  const addTagFromList = useCallback((tag: EventTag) => {
    const exists = form.tags.some(existingTag => existingTag.slug === tag.slug)
    if (!exists) {
      setForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
    }
  }, [form.tags])

  const removeTag = useCallback((index: number) => {
    if (form.tags.length > 1) {
      setForm(prev => ({
        ...prev,
        tags: prev.tags.filter((_, tagIndex) => tagIndex !== index),
      }))
    }
  }, [form.tags.length])

  const handleEventIconUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setEventIconFile(file)
      setForm(prev => ({
        ...prev,
        icon: file.name,
      }))
    }
  }, [])

  const handleMarketIconUpload = useCallback((marketIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMarketIconFiles(prev => ({
        ...prev,
        [marketIndex]: file,
      }))

      setForm(prev => ({
        ...prev,
        markets: prev.markets.map((market, index) =>
          index === marketIndex ? { ...market, icon: file.name } : market,
        ),
      }))
    }
  }, [])

  const handleMarketChange = useCallback((marketIndex: number, field: keyof Market, value: Market[keyof Market]) => {
    setForm(prev => ({
      ...prev,
      markets: prev.markets.map((market, index) =>
        index === marketIndex ? { ...market, [field]: value } : market,
      ),
    }))
  }, [])

  useEffect(() => {
    if (marketSlugTimeoutRef.current) {
      clearTimeout(marketSlugTimeoutRef.current)
      marketSlugTimeoutRef.current = null
    }

    if (!form.markets.some(market => market.question.trim())) {
      return
    }

    marketSlugTimeoutRef.current = setTimeout(() => {
      setForm((prev) => {
        let hasChanges = false

        const nextMarkets = prev.markets.map((market) => {
          if (!market.question.trim()) {
            return market
          }

          const nextSlug = generateSlug(market.question)
          if (market.market_slug === nextSlug) {
            return market
          }

          hasChanges = true
          return { ...market, market_slug: nextSlug }
        })

        if (!hasChanges) {
          return prev
        }

        return {
          ...prev,
          markets: nextMarkets,
        }
      })
    }, 300)

    return () => {
      if (marketSlugTimeoutRef.current) {
        clearTimeout(marketSlugTimeoutRef.current)
        marketSlugTimeoutRef.current = null
      }
    }
  }, [form.markets, generateSlug])

  const handleOutcomeChange = useCallback((marketIndex: number, outcomeIndex: number, value: string) => {
    setForm(prev => ({
      ...prev,
      markets: prev.markets.map((market, index) =>
        index === marketIndex
          ? {
              ...market,
              outcomes: market.outcomes.map((outcome, outcomeIdx) =>
                outcomeIdx === outcomeIndex ? { ...outcome, outcome: value } : outcome,
              ),
            }
          : market,
      ),
    }))
  }, [])

  const addMarket = useCallback(() => {
    setForm(prev => ({
      ...prev,
      markets: [...prev.markets, createEmptyMarket()],
    }))
  }, [])

  const removeMarket = useCallback((index: number) => {
    if (form.markets.length > 1) {
      setForm(prev => ({
        ...prev,
        markets: prev.markets.filter((_, marketIndex) => marketIndex !== index),
      }))
    }
  }, [form.markets.length])

  const validateForm = useCallback(() => {
    const errors: string[] = []

    if (!form.title.trim()) {
      errors.push('Event title is required')
    }

    if (!form.description.trim()) {
      errors.push('Event description is required')
    }

    if (!form.slug.trim()) {
      errors.push('Event slug is required')
    }
    else if (slugValidationState === 'checking') {
      errors.push('Please wait for the slug availability check to finish')
    }
    else if (slugValidationState === 'duplicate') {
      errors.push('Event slug is already in use. Choose another one')
    }
    else if (slugValidationState === 'error') {
      errors.push('Unable to verify slug availability. Try again')
    }

    if (!form.start_date_iso) {
      errors.push('Start date is required')
    }

    if (!form.end_date_iso) {
      errors.push('End date is required')
    }

    if (!eventIconFile) {
      errors.push('Event icon is required')
    }

    if (form.start_date_iso && form.end_date_iso) {
      if (new Date(form.start_date_iso) >= new Date(form.end_date_iso)) {
        errors.push('End date must be after start date')
      }
    }

    const validTags = form.tags.filter(tag => tag.label.trim())
    if (validTags.length === 0) {
      errors.push('At least one tag is required')
    }

    form.markets.forEach((market, index) => {
      if (!market.question.trim()) {
        errors.push(`Market ${index + 1}: Question is required`)
      }

      if (!market.description.trim()) {
        errors.push(`Market ${index + 1}: Description is required`)
      }

      if (!marketIconFiles[index]) {
        errors.push(`Market ${index + 1}: Icon is required`)
      }

      const validOutcomes = market.outcomes.filter(outcome => outcome.outcome.trim())
      if (validOutcomes.length < 2) {
        errors.push(`Market ${index + 1}: At least 2 outcomes are required`)
      }
    })

    return errors
  }, [eventIconFile, form, marketIconFiles, slugValidationState])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const errors = validateForm()
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
      return
    }

    setIsLoading(true)

    try {
      const eventData = {
        ...form,
        tags: form.tags.filter(tag => tag.label.trim()),
        markets: form.markets.map(market => ({
          ...market,
          outcomes: market.outcomes.filter(outcome => outcome.outcome.trim()),
          oracle_type: 'native',
          resolved_by: RESOLVED_BY_ADDRESS,
        })),
      }

      console.log('Event data prepared (validation only):', eventData)

      await new Promise(resolve => setTimeout(resolve, 1000))

      toast.success('Event validated successfully! 🎉')
      toast.info('Ready for implementation - data not saved yet')

      setForm(createInitialForm())
      setEventIconFile(null)
      setMarketIconFiles({})
      setSlugValidationState('idle')
    }
    catch (error) {
      console.error('Error validating event:', error)
      toast.error('Error validating event. Please try again.')
    }
    finally {
      setIsLoading(false)
    }
  }, [form, validateForm])

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="bg-background">
        <CardHeader className="pt-8 pb-6">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5" />
            Event Information
          </CardTitle>
          <CardDescription>
            Configure the event core details before publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-event-title">Event Title *</Label>
              <Input
                id="admin-event-title"
                value={form.title}
                onChange={e => handleEventFieldChange('title', e.target.value)}
                placeholder="Ex: 2024 Presidential Election"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-slug">Slug (auto)</Label>
              <Input
                id="admin-event-slug"
                value={form.slug}
                onChange={e => handleEventFieldChange('slug', e.target.value)}
                placeholder="2024-presidential-election"
              />
              {slugValidationState === 'checking' && (
                <p className="text-sm text-muted-foreground">Checking availability...</p>
              )}
              {slugValidationState === 'duplicate' && (
                <p className="text-sm text-destructive">Slug already in use. Choose another one.</p>
              )}
              {slugValidationState === 'error' && (
                <p className="text-sm text-destructive">Unable to verify slug availability. Try again.</p>
              )}
              {slugValidationState === 'unique' && form.slug.trim() && (
                <p className="text-sm text-muted-foreground">Slug available.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-event-description">Event Description *</Label>
            <Textarea
              id="admin-event-description"
              value={form.description}
              onChange={e => handleEventFieldChange('description', e.target.value)}
              placeholder="Describe the event and its resolution rules..."
              className="min-h-24"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-event-start-date">Start Date *</Label>
              <Input
                id="admin-event-start-date"
                type="datetime-local"
                value={form.start_date_iso}
                onChange={e => handleEventFieldChange('start_date_iso', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-end-date">End Date *</Label>
              <Input
                id="admin-event-end-date"
                type="datetime-local"
                value={form.end_date_iso}
                onChange={e => handleEventFieldChange('end_date_iso', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-event-icon">Event Icon *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="admin-event-icon"
                  type="file"
                  accept="image/*"
                  onChange={handleEventIconUpload}
                  className={`
                    file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm
                    file:text-primary-foreground
                  `}
                />
                {eventIconFile && (
                  <span className="truncate text-sm text-muted-foreground">
                    {eventIconFile.name}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-event-resolution-source">Resolution Source</Label>
              <Input
                id="admin-event-resolution-source"
                value={form.resolution_source}
                onChange={e => handleEventFieldChange('resolution_source', e.target.value)}
                placeholder="Ex: https://wikipedia.org/..."
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="admin-event-show-market-icons"
              checked={form.show_market_icons}
              onCheckedChange={checked => handleEventFieldChange('show_market_icons', checked)}
            />
            <Label htmlFor="admin-event-show-market-icons">Show market icons</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="pt-8 pb-6">
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="size-5" />
            Event Tags
          </CardTitle>
          <CardDescription>
            Categorize the event to improve discoverability.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="space-y-4">
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <Label>Available Tags (click to add)</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <Button
                      key={tag.slug}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTagFromList(tag)}
                      disabled={form.tags.some(existingTag => existingTag.slug === tag.slug)}
                      className="text-xs"
                    >
                      {tag.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Selected Tags *</Label>
              {form.tags.map((tag, index) => (
                <div key={`admin-event-tag-${index}`} className="flex items-center gap-4">
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <Input
                      value={tag.label}
                      onChange={e => handleTagChange(index, 'label', e.target.value)}
                      placeholder="Tag name"
                    />
                    <Input
                      value={tag.slug}
                      onChange={e => handleTagChange(index, 'slug', e.target.value)}
                      placeholder="tag-slug"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeTag(index)}
                    disabled={form.tags.length <= 1}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addTag}>
                <PlusIcon className="mr-2 size-4" />
                Add Custom Tag
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="pt-8 pb-6">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            Prediction Markets
          </CardTitle>
          <CardDescription>
            Configure the markets that belong to this event.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="space-y-8">
            {form.markets.map((market, marketIndex) => (
              <div
                key={`admin-event-market-${marketIndex}-${market.market_slug || 'empty'}`}
                className="space-y-4 rounded-lg border bg-background p-8"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">
                    Market
                    {' '}
                    {marketIndex + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeMarket(marketIndex)}
                    disabled={form.markets.length <= 1}
                  >
                    <Trash2Icon className="mr-2 size-4" />
                    Remove
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Market Question *</Label>
                    <Input
                      value={market.question}
                      onChange={e => handleMarketChange(marketIndex, 'question', e.target.value)}
                      placeholder="Ex: Who will be elected president?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Slug (auto)</Label>
                    <Input
                      value={market.market_slug}
                      onChange={e => handleMarketChange(marketIndex, 'market_slug', e.target.value)}
                      placeholder="who-will-be-elected-president"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Textarea
                      value={market.description}
                      onChange={e => handleMarketChange(marketIndex, 'description', e.target.value)}
                      placeholder="Describe the resolution rules for this market..."
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Market Icon *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={e => handleMarketIconUpload(marketIndex, e)}
                        className={`
                          file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm
                          file:text-primary-foreground
                        `}
                      />
                      {marketIconFiles[marketIndex] && (
                        <span className="truncate text-sm text-muted-foreground">
                          {marketIconFiles[marketIndex]?.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Response Options *</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {market.outcomes.map((outcome, outcomeIndex) => (
                        <Input
                          key={`admin-event-market-outcome-${marketIndex}-${outcomeIndex}`}
                          value={outcome.outcome}
                          onChange={e => handleOutcomeChange(marketIndex, outcomeIndex, e.target.value)}
                          placeholder={outcomeIndex === OUTCOME_INDEX.YES ? t('Yes') : t('No')}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addMarket}>
              <PlusIcon className="mr-2 size-4" />
              Add Market
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="bg-background">
        <CardContent className="py-8">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="mt-0.5 size-5 text-no" />
            <div className="space-y-2">
              <h4 className="font-semibold">Development Status - Not Ready for Production</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  • ❌
                  {' '}
                  <strong>Database integration not implemented</strong>
                  {' '}
                  - events are not saved
                </li>
                <li>
                  • ❌
                  {' '}
                  <strong>Blockchain deployment not implemented</strong>
                  {' '}
                  - no smart contract interaction
                </li>
                <li>
                  • ❌
                  {' '}
                  <strong>Image upload not implemented</strong>
                  {' '}
                  - files are not stored anywhere
                </li>
                <li>
                  • ❌
                  {' '}
                  <strong>UMA oracle integration pending</strong>
                  {' '}
                  - no resolution mechanism
                </li>
                <li>• ⚠️ This form only validates data and shows preview in console</li>
                <li>• ⚠️ All backend functionality needs to be implemented</li>
                <li>• ✅ UI and validation logic are complete</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isLoading}>
          {isLoading
            ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Validating...
                </>
              )
            : (
                <>
                  <CheckCircle2Icon className="mr-2 size-4" />
                  Validate Event Data
                </>
              )}
        </Button>
      </div>
    </form>
  )
}
