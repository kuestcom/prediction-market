import { CalendarIcon, ImageUp, PlusIcon, SquarePenIcon, Trash2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'

import type { AdminSportsFormState } from '@/lib/admin-sports-create'

import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAdminSportsMarketTypeDefaultOutcomes, resolveAdminSportsMarketTypeOption } from '@/lib/admin-sports-create'
import { cn } from '@/lib/utils'

import type { useAdminCreateEventForm } from './useAdminCreateEventForm'

import { OutcomeStateDot } from './admin-create-event-form-indicators'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>

export function AdminCreateEventStepMarketStructure({ state }: { state: AdminCreateEventFormState }) {
  const t = useExtracted()
  const sportsLabels = useMemo<Record<string, string>>(
    () => ({
      Moneyline: t('Moneyline'),
      'Core Game Lines': t('Core Game Lines'),
      'Map / Game Winner': t('Map / Game Winner'),
      Spreads: t('Spreads'),
      Totals: t('Totals'),
      'Team Totals': t('Team Totals'),
      'Both Teams To Score': t('Both Teams To Score'),
      '1H Moneyline': t('1H Moneyline'),
      '1H Spreads': t('1H Spreads'),
      '1H Totals': t('1H Totals'),
      'Exact Score Selection': t('Exact Score Selection'),
      'Soccer Specials': t('Soccer Specials'),
      'Halftime Result Selection': t('Halftime Result Selection'),
      'Match Totals': t('Match Totals'),
      Tennis: t('Tennis'),
      'First Set Totals': t('First Set Totals'),
      'Set Totals': t('Set Totals'),
      'First Set Winner': t('First Set Winner'),
      'Set Handicap': t('Set Handicap'),
      'Go The Distance': t('Go The Distance'),
      'Combat Sports': t('Combat Sports'),
      'Method Of Victory Selection': t('Method Of Victory Selection'),
      'Toss Winner': t('Toss Winner'),
      Cricket: t('Cricket'),
      'Completed Match': t('Completed Match'),
      'Match To Go Till Selection': t('Match To Go Till Selection'),
      'Most Sixes Selection': t('Most Sixes Selection'),
      'Team Top Batter Selection': t('Team Top Batter Selection'),
      'Toss Match Double Selection': t('Toss Match Double Selection'),
      'Game Kill O/U': t('Game Kill O/U'),
      'Esports Game / Map': t('Esports Game / Map'),
      'Map Handicap': t('Map Handicap'),
      'Odd / Even Total Kills': t('Odd / Even Total Kills'),
      'Odd / Even Total Rounds': t('Odd / Even Total Rounds'),
      'LoL Odd / Even Total Kills': t('LoL Odd / Even Total Kills'),
      'First Blood': t('First Blood'),
      'Both Teams Slay Dragon': t('Both Teams Slay Dragon'),
      'Both Teams Slay Baron': t('Both Teams Slay Baron'),
      'Both Teams Destroy Inhibitors': t('Both Teams Destroy Inhibitors'),
      'Any Player Quadra Kill': t('Any Player Quadra Kill'),
      'Any Player Penta Kill': t('Any Player Penta Kill'),
      'Game Ends In Daytime': t('Game Ends In Daytime'),
      'Both Teams Destroy Barracks': t('Both Teams Destroy Barracks'),
      'Both Teams Beat Roshan': t('Both Teams Beat Roshan'),
      'Any Player Rampage': t('Any Player Rampage'),
      'Any Player Ultra Kill': t('Any Player Ultra Kill'),
      'Series Kill Handicap': t('Series Kill Handicap'),
      'Esports Series': t('Esports Series'),
      'Series Most Kills': t('Series Most Kills'),
      'Series Most Drakes': t('Series Most Drakes'),
      'Series Most Nashors': t('Series Most Nashors'),
      'Series Most Towers': t('Series Most Towers'),
      'Series Most Inhibitors': t('Series Most Inhibitors'),
      'Series Drake Handicap': t('Series Drake Handicap'),
      'Series Tower Handicap': t('Series Tower Handicap'),
      'Series Inhibitor Handicap': t('Series Inhibitor Handicap'),
      'Points O/U': t('Points O/U'),
      Props: t('Props'),
      'Rebounds O/U': t('Rebounds O/U'),
      'Assists O/U': t('Assists O/U'),
      'Receiving Yards O/U': t('Receiving Yards O/U'),
      'Rushing Yards O/U': t('Rushing Yards O/U'),
      'Anytime Touchdown Selection': t('Anytime Touchdown Selection'),
      'First Touchdown Selection': t('First Touchdown Selection'),
      '2+ Touchdowns Selection': t('2+ Touchdowns Selection'),
    }),
    [t],
  )
  function translateSportsLabel(label: string) {
    return sportsLabels[label] ?? label
  }
  const {
    addOption,
    addSportsCustomMarket,
    addSportsProp,
    areMultiOutcomesEditable,
    form,
    handleFieldChange,
    handleOptionChange,
    handleOptionImageUpload,
    handleSportsCustomMarketChange,
    handleSportsFieldChange,
    handleSportsPropChange,
    isBinaryOutcomesEditable,
    isSportsEvent,
    optionImagePreviewUrls,
    optionNamePlaceholder,
    optionQuestionPlaceholder,
    optionShortNamePlaceholder,
    removeOption,
    removeSportsCustomMarket,
    removeSportsProp,
    setAreMultiOutcomesEditable,
    setIsBinaryOutcomesEditable,
    sportsForm,
    sportsMarketTypeGroups,
  } = state

  return (
    <Card className="bg-background">
      <CardHeader className="pt-8 pb-6">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="size-5" />
          {t('Market structure')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pb-8">
        {isSportsEvent ? (
          <>
            {sportsForm.section && (
              <div className="space-y-2">
                <Label htmlFor="sports-event-variant">{t('Sports template')}</Label>
                <Select
                  items={
                    sportsForm.section === 'games'
                      ? {
                          standard: t('Standard game lines'),
                          more_markets: t('Soccer More Markets'),
                          exact_score: t('Exact Score'),
                          halftime_result: t('Halftime Result'),
                          custom: t('Custom sports market types'),
                        }
                      : {
                          standard: t('Player props'),
                          custom: t('Custom sports market types'),
                        }
                  }
                  value={sportsForm.eventVariant || undefined}
                  onValueChange={(value) =>
                    value !== null &&
                    handleSportsFieldChange('eventVariant', value as AdminSportsFormState['eventVariant'])
                  }
                >
                  <SelectTrigger id="sports-event-variant" className="w-full md:max-w-md">
                    <SelectValue placeholder={t('Select a sports template')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sportsForm.section === 'games' ? (
                      <>
                        <SelectItem value="standard">{t('Standard game lines')}</SelectItem>
                        <SelectItem value="more_markets">{t('Soccer More Markets')}</SelectItem>
                        <SelectItem value="exact_score">{t('Exact Score')}</SelectItem>
                        <SelectItem value="halftime_result">{t('Halftime Result')}</SelectItem>
                        <SelectItem value="custom">{t('Custom sports market types')}</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="standard">{t('Player props')}</SelectItem>
                        <SelectItem value="custom">{t('Custom sports market types')}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sportsForm.section === 'games' && sportsForm.eventVariant && (
              <div className="space-y-3 rounded-md border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {sportsForm.eventVariant === 'standard' ? t('Standard game lines') : t('Moneyline base markets')}
                  </p>
                  {sportsForm.eventVariant !== 'standard' && (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'The base game market is always created for sports games. Use this toggle to decide whether the base moneyline should include home / draw / away or only home / away.',
                      )}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded-sm border"
                    checked={sportsForm.includeDraw}
                    onChange={(event) => handleSportsFieldChange('includeDraw', event.target.checked)}
                  />
                  {t('Include draw market in addition to home and away.')}
                </label>
              </div>
            )}

            {sportsForm.section === 'games' && sportsForm.eventVariant === 'more_markets' && (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">{t('More Markets packs')}</p>
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded-sm border"
                    checked={sportsForm.includeBothTeamsToScore}
                    onChange={(event) => handleSportsFieldChange('includeBothTeamsToScore', event.target.checked)}
                  />
                  {t('Both Teams to Score')}
                </label>
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded-sm border"
                    checked={sportsForm.includeTotals}
                    onChange={(event) => handleSportsFieldChange('includeTotals', event.target.checked)}
                  />
                  {t('Totals pack with fixed ladder 1.5 / 2.5 / 3.5 / 4.5')}
                </label>
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded-sm border"
                    checked={sportsForm.includeSpreads}
                    onChange={(event) => handleSportsFieldChange('includeSpreads', event.target.checked)}
                  />
                  {t('Spreads pack with fixed ladder -1.5 for home and away')}
                </label>
              </div>
            )}

            {sportsForm.section === 'games' &&
              (sportsForm.eventVariant === 'exact_score' || sportsForm.eventVariant === 'halftime_result') && (
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'This pack is generated automatically from the selected teams and start time, and always includes the mandatory moneyline base markets using the draw selection above.',
                    )}
                  </p>
                </div>
              )}

            {sportsForm.eventVariant === 'custom' && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('Custom sports markets')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Choose any market type. Moneyline base markets are added automatically using the draw selection above, and row order is sent as the market group threshold automatically.',
                    )}
                  </p>
                </div>

                {sportsForm.customMarkets.map((market, index) => {
                  const marketTypeOption = resolveAdminSportsMarketTypeOption(market.sportsMarketType)
                  const defaultOutcomes = getAdminSportsMarketTypeDefaultOutcomes(market.sportsMarketType, {
                    homeTeamName: sportsForm.teams[0]?.name ?? '',
                    awayTeamName: sportsForm.teams[1]?.name ?? '',
                  })

                  return (
                    <div key={market.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor={`sports-custom-market-type-${market.id}`}>
                            {t('Market')} {index + 1}
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSportsCustomMarket(market.id)}
                          >
                            <Trash2Icon className="mr-2 size-4" />
                            {t('Remove')}
                          </Button>
                        </div>
                        <Select
                          items={sportsMarketTypeGroups.map((group) => ({
                            label: translateSportsLabel(group.label),
                            items: group.options.map((option) => ({
                              label: translateSportsLabel(option.label),
                              value: option.value,
                            })),
                          }))}
                          value={market.sportsMarketType || undefined}
                          onValueChange={(value) =>
                            value !== null && handleSportsCustomMarketChange(market.id, 'sportsMarketType', value)
                          }
                        >
                          <SelectTrigger id={`sports-custom-market-type-${market.id}`} className="w-full">
                            <SelectValue placeholder={t('Select a sports market type')} />
                          </SelectTrigger>
                          <SelectContent>
                            {sportsMarketTypeGroups.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel>{translateSportsLabel(group.label)}</SelectLabel>
                                {group.options.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {translateSportsLabel(option.label)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Question')}</Label>
                        <Input
                          value={market.question}
                          onChange={(event) =>
                            handleSportsCustomMarketChange(market.id, 'question', event.target.value)
                          }
                          placeholder={
                            marketTypeOption?.label
                              ? t('Example: {marketType}', { marketType: translateSportsLabel(marketTypeOption.label) })
                              : t('Example: 1H Moneyline')
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Title')}</Label>
                        <Input
                          value={market.title}
                          onChange={(event) => handleSportsCustomMarketChange(market.id, 'title', event.target.value)}
                          placeholder={
                            marketTypeOption?.label
                              ? translateSportsLabel(marketTypeOption.label)
                              : t('Example: 1H Moneyline')
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Short name')}</Label>
                        <Input
                          value={market.shortName}
                          onChange={(event) =>
                            handleSportsCustomMarketChange(market.id, 'shortName', event.target.value)
                          }
                          placeholder={
                            marketTypeOption?.label ? translateSportsLabel(marketTypeOption.label) : t('Example: 1H ML')
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Slug override (optional)')}</Label>
                        <Input
                          value={market.slug}
                          onChange={(event) => handleSportsCustomMarketChange(market.id, 'slug', event.target.value)}
                          placeholder={t('Leave blank to generate automatically')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Outcome 1')}</Label>
                        <Input
                          value={market.outcomeOne}
                          onChange={(event) =>
                            handleSportsCustomMarketChange(market.id, 'outcomeOne', event.target.value)
                          }
                          placeholder={defaultOutcomes?.[0] || t('Example: Over')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Outcome 2')}</Label>
                        <Input
                          value={market.outcomeTwo}
                          onChange={(event) =>
                            handleSportsCustomMarketChange(market.id, 'outcomeTwo', event.target.value)
                          }
                          placeholder={defaultOutcomes?.[1] || t('Example: Under')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          {t('Line')}
                          {!marketTypeOption?.requiresLine && <> {t('(optional)')}</>}
                        </Label>
                        <Input
                          value={market.line}
                          onChange={(event) => handleSportsCustomMarketChange(market.id, 'line', event.target.value)}
                          placeholder={marketTypeOption?.requiresLine ? t('Example: 110.5 or -1.5') : t('Optional')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Group title (optional)')}</Label>
                        <Input
                          value={market.groupItemTitle}
                          onChange={(event) =>
                            handleSportsCustomMarketChange(market.id, 'groupItemTitle', event.target.value)
                          }
                          placeholder={t('Defaults to the title sent to metadata')}
                        />
                      </div>

                      {sportsForm.section === 'games' && (
                        <div className="space-y-2 md:col-span-2">
                          <Label>{t('Icon')}</Label>
                          <Select
                            items={{
                              none: t('No team icon'),
                              home: `${sportsForm.teams[0]?.name || t('Home team')} ${t('icon')}`,
                              away: `${sportsForm.teams[1]?.name || t('Away team')} ${t('icon')}`,
                            }}
                            value={market.iconAssetKey || undefined}
                            onValueChange={(value) =>
                              value !== null && handleSportsCustomMarketChange(market.id, 'iconAssetKey', value)
                            }
                          >
                            <SelectTrigger className="w-full md:max-w-xs">
                              <SelectValue placeholder={t('No team icon')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('No team icon')}</SelectItem>
                              <SelectItem value="home">
                                {sportsForm.teams[0]?.name || t('Home team')} {t('icon')}
                              </SelectItem>
                              <SelectItem value="away">
                                {sportsForm.teams[1]?.name || t('Away team')} {t('icon')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )
                })}

                <Button type="button" variant="outline" onClick={addSportsCustomMarket}>
                  <PlusIcon className="mr-2 size-4" />
                  {t('Add custom market')}
                </Button>
              </div>
            )}

            {sportsForm.section === 'props' && sportsForm.eventVariant !== 'custom' && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('Player props')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('Each row becomes one generated market with Over and Under outcomes.')}
                  </p>
                </div>

                {sportsForm.props.map((prop, index) => (
                  <div key={prop.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`sports-prop-player-${prop.id}`}>
                          {t('Prop')} {index + 1}
                        </Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => removeSportsProp(prop.id)}>
                          <Trash2Icon className="mr-2 size-4" />
                          {t('Remove')}
                        </Button>
                      </div>
                      <Input
                        id={`sports-prop-player-${prop.id}`}
                        value={prop.playerName}
                        onChange={(event) => handleSportsPropChange(prop.id, 'playerName', event.target.value)}
                        placeholder={t('Example: Jamal Murray')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('Stat type')}</Label>
                      <Select
                        items={{
                          points: t('Points'),
                          rebounds: t('Rebounds'),
                          assists: t('Assists'),
                          receiving_yards: t('Receiving Yards'),
                          rushing_yards: t('Rushing Yards'),
                        }}
                        value={prop.statType || undefined}
                        onValueChange={(value) => value !== null && handleSportsPropChange(prop.id, 'statType', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('Select stat type')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="points">{t('Points')}</SelectItem>
                          <SelectItem value="rebounds">{t('Rebounds')}</SelectItem>
                          <SelectItem value="assists">{t('Assists')}</SelectItem>
                          <SelectItem value="receiving_yards">{t('Receiving Yards')}</SelectItem>
                          <SelectItem value="rushing_yards">{t('Rushing Yards')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('Line')}</Label>
                      <Input
                        value={prop.line}
                        onChange={(event) => handleSportsPropChange(prop.id, 'line', event.target.value)}
                        placeholder={t('Example: 29.5')}
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addSportsProp}>
                  <PlusIcon className="mr-2 size-4" />
                  {t('Add prop')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-3">
              <Label>{t('Select Event type')}</Label>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <label
                  className={cn(
                    'cursor-pointer rounded-md border p-3 transition',
                    form.marketMode === 'binary'
                      ? 'border-primary bg-primary/5 text-primary'
                      : `hover:border-primary/40`,
                  )}
                >
                  <input
                    type="radio"
                    name="market-mode"
                    className="sr-only"
                    checked={form.marketMode === 'binary'}
                    onChange={() => handleFieldChange('marketMode', 'binary')}
                  />
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        'inline-flex size-4 items-center justify-center rounded-full border',
                        form.marketMode === 'binary' ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                      )}
                    >
                      {form.marketMode === 'binary' && <span className="size-1.5 rounded-full bg-background" />}
                    </span>
                    {t('Binary market')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Eg. Will BTC close above $110k on Mar 31, 2028?')}
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('Yes')}</span>
                      <OutcomeStateDot value />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('No')}</span>
                      <OutcomeStateDot value={false} />
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'cursor-pointer rounded-md border p-3 transition',
                    form.marketMode === 'multi_multiple'
                      ? 'border-primary bg-primary/5 text-primary'
                      : `hover:border-primary/40`,
                  )}
                >
                  <input
                    type="radio"
                    name="market-mode"
                    className="sr-only"
                    checked={form.marketMode === 'multi_multiple'}
                    onChange={() => handleFieldChange('marketMode', 'multi_multiple')}
                  />
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        'inline-flex size-4 items-center justify-center rounded-full border',
                        form.marketMode === 'multi_multiple'
                          ? 'border-primary bg-primary'
                          : `border-muted-foreground/50`,
                      )}
                    >
                      {form.marketMode === 'multi_multiple' && <span className="size-1.5 rounded-full bg-background" />}
                    </span>
                    {t('Multi-market (multiple true outcomes)')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Eg. Which BTC milestones will be reached by Dec 31, 2028?')}
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('BTC above $100k (short: 100k)')}</span>
                      <OutcomeStateDot value />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('BTC above $110k (short: 110k)')}</span>
                      <OutcomeStateDot value />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('BTC above $120k (short: 120k)')}</span>
                      <OutcomeStateDot value={false} />
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'cursor-pointer rounded-md border p-3 transition',
                    form.marketMode === 'multi_unique'
                      ? 'border-primary bg-primary/5 text-primary'
                      : `hover:border-primary/40`,
                  )}
                >
                  <input
                    type="radio"
                    name="market-mode"
                    className="sr-only"
                    checked={form.marketMode === 'multi_unique'}
                    onChange={() => handleFieldChange('marketMode', 'multi_unique')}
                  />
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        'inline-flex size-4 items-center justify-center rounded-full border',
                        form.marketMode === 'multi_unique' ? 'border-primary bg-primary' : `border-muted-foreground/50`,
                      )}
                    >
                      {form.marketMode === 'multi_unique' && <span className="size-1.5 rounded-full bg-background" />}
                    </span>
                    {t('Multi-market (single true outcome)')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Eg. Who will win the 2028 U.S. presidential election?')}
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('Gavin Newsom (short: Newsom)')}</span>
                      <OutcomeStateDot value />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('Nikki Haley (short: Haley)')}</span>
                      <OutcomeStateDot value={false} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                      <span>{t('Donald Trump (short: Trump)')}</span>
                      <OutcomeStateDot value={false} />
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {form.marketMode === 'binary' && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-2">
                  <Label htmlFor="binary-question">{t('Question')}</Label>
                  <Input id="binary-question" value={form.title} disabled readOnly />
                </div>

                <div className="space-y-2">
                  <Label>{t('Outcomes')}</Label>
                  <div
                    className={cn(
                      `grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]`,
                    )}
                  >
                    <Input
                      id="binary-outcome-yes"
                      value={form.binaryOutcomeYes}
                      onChange={(event) => handleFieldChange('binaryOutcomeYes', event.target.value)}
                      placeholder={t('Yes')}
                      disabled={!isBinaryOutcomesEditable}
                    />
                    <Input
                      id="binary-outcome-no"
                      value={form.binaryOutcomeNo}
                      onChange={(event) => handleFieldChange('binaryOutcomeNo', event.target.value)}
                      placeholder={t('No')}
                      disabled={!isBinaryOutcomesEditable}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10 rounded-md"
                      onClick={() => setIsBinaryOutcomesEditable((previous) => !previous)}
                      aria-label={isBinaryOutcomesEditable ? t('Lock outcomes') : t('Edit outcomes')}
                    >
                      <SquarePenIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {(form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') && (
              <div className="space-y-4 rounded-md border p-4">
                <p className="text-sm text-muted-foreground">{t('Each option creates one child market.')}</p>

                <div className="space-y-4">
                  {form.options.map((option, index) => (
                    <div key={option.id} className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {t('Option')} {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                          disabled={form.options.length <= 2}
                        >
                          <Trash2Icon className="mr-2 size-4" />
                          {t('Remove')}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>{t('Market question')}</Label>
                          <Input
                            value={option.question}
                            onChange={(event) => handleOptionChange(option.id, 'question', event.target.value)}
                            placeholder={optionQuestionPlaceholder}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('Option name')}</Label>
                          <Input
                            value={option.title}
                            onChange={(event) => handleOptionChange(option.id, 'title', event.target.value)}
                            placeholder={optionNamePlaceholder}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('Short name')}</Label>
                          <Input
                            value={option.shortName}
                            onChange={(event) => handleOptionChange(option.id, 'shortName', event.target.value)}
                            placeholder={optionShortNamePlaceholder}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('Slug')}</Label>
                          <Input value={option.slug} readOnly />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>{t('Outcomes')}</Label>
                          <div
                            className={cn(
                              `grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]`,
                            )}
                          >
                            <Input
                              value={option.outcomeYes}
                              onChange={(event) => handleOptionChange(option.id, 'outcomeYes', event.target.value)}
                              placeholder={t('Yes')}
                              disabled={!areMultiOutcomesEditable}
                            />
                            <Input
                              value={option.outcomeNo}
                              onChange={(event) => handleOptionChange(option.id, 'outcomeNo', event.target.value)}
                              placeholder={t('No')}
                              disabled={!areMultiOutcomesEditable}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-10 rounded-md"
                              onClick={() => setAreMultiOutcomesEditable((previous) => !previous)}
                              aria-label={areMultiOutcomesEditable ? t('Lock outcomes') : t('Edit outcomes')}
                            >
                              <SquarePenIcon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('Option image (optional)')}</Label>
                        <Input
                          id={`option-image-${option.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleOptionImageUpload(option.id, event)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`option-image-${option.id}`}
                          className={cn(
                            `group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground transition hover:border-primary/60`,
                          )}
                        >
                          <span
                            className={cn(
                              `pointer-events-none absolute inset-0 bg-foreground/0 transition group-hover:bg-foreground/5`,
                            )}
                          />
                          {optionImagePreviewUrls[option.id] ? (
                            <EventIconImage
                              src={optionImagePreviewUrls[option.id]}
                              alt={`Option ${index + 1} image preview`}
                              sizes="256px"
                              unoptimized
                              containerClassName="size-full"
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground">{t('No image')}</div>
                          )}
                          <ImageUp
                            className={cn(
                              `pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2 text-foreground/70 opacity-0 transition group-hover:opacity-100`,
                            )}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" onClick={addOption}>
                  <PlusIcon className="mr-2 size-4" />
                  {t('Add option')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
