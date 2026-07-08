import type { useAdminCreateEventForm } from './useAdminCreateEventForm'
import type { AdminSportsFormState } from '@/lib/admin-sports-create'
import { CalendarIcon, ImageUp, PlusIcon, SquarePenIcon, Trash2Icon } from 'lucide-react'
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
import {
  getAdminSportsMarketTypeDefaultOutcomes,
  resolveAdminSportsMarketTypeOption,
} from '@/lib/admin-sports-create'
import { cn } from '@/lib/utils'
import { OutcomeStateDot } from './admin-create-event-form-indicators'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>

export function AdminCreateEventStepMarketStructure({
  state,
}: {
  state: AdminCreateEventFormState
}) {
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
          Market structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pb-8">
        {isSportsEvent
          ? (
              <>
                {sportsForm.section && (
                  <div className="space-y-2">
                    <Label htmlFor="sports-event-variant">Sports template</Label>
                    <Select
                      value={sportsForm.eventVariant || undefined}
                      onValueChange={value => handleSportsFieldChange('eventVariant', value as AdminSportsFormState['eventVariant'])}
                    >
                      <SelectTrigger id="sports-event-variant" className="w-full md:max-w-md">
                        <SelectValue placeholder="Select a sports template" />
                      </SelectTrigger>
                      <SelectContent>
                        {sportsForm.section === 'games'
                          ? (
                              <>
                                <SelectItem value="standard">Standard game lines</SelectItem>
                                <SelectItem value="more_markets">Soccer More Markets</SelectItem>
                                <SelectItem value="exact_score">Exact Score</SelectItem>
                                <SelectItem value="halftime_result">Halftime Result</SelectItem>
                                <SelectItem value="custom">Custom sports market types</SelectItem>
                              </>
                            )
                          : (
                              <>
                                <SelectItem value="standard">Player props</SelectItem>
                                <SelectItem value="custom">Custom sports market types</SelectItem>
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
                        {sportsForm.eventVariant === 'standard' ? 'Standard game lines' : 'Moneyline base markets'}
                      </p>
                      {sportsForm.eventVariant !== 'standard' && (
                        <p className="text-sm text-muted-foreground">
                          The base game market is always created for sports games. Use this toggle to decide whether the base moneyline should include home / draw / away or only home / away.
                        </p>
                      )}
                    </div>
                    <label className="flex items-center gap-3 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border"
                        checked={sportsForm.includeDraw}
                        onChange={event => handleSportsFieldChange('includeDraw', event.target.checked)}
                      />
                      Include draw market in addition to home and away.
                    </label>
                  </div>
                )}

                {sportsForm.section === 'games' && sportsForm.eventVariant === 'more_markets' && (
                  <div className="space-y-3 rounded-md border p-4">
                    <p className="text-sm font-medium">More Markets packs</p>
                    <label className="flex items-center gap-3 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border"
                        checked={sportsForm.includeBothTeamsToScore}
                        onChange={event => handleSportsFieldChange('includeBothTeamsToScore', event.target.checked)}
                      />
                      Both Teams to Score
                    </label>
                    <label className="flex items-center gap-3 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border"
                        checked={sportsForm.includeTotals}
                        onChange={event => handleSportsFieldChange('includeTotals', event.target.checked)}
                      />
                      Totals pack with fixed ladder 1.5 / 2.5 / 3.5 / 4.5
                    </label>
                    <label className="flex items-center gap-3 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border"
                        checked={sportsForm.includeSpreads}
                        onChange={event => handleSportsFieldChange('includeSpreads', event.target.checked)}
                      />
                      Spreads pack with fixed ladder -1.5 for home and away
                    </label>
                  </div>
                )}

                {sportsForm.section === 'games' && (sportsForm.eventVariant === 'exact_score' || sportsForm.eventVariant === 'halftime_result') && (
                  <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">
                      This pack is generated automatically from the selected teams and start time, and always includes the mandatory moneyline base markets using the draw selection above.
                    </p>
                  </div>
                )}

                {sportsForm.eventVariant === 'custom' && (
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Custom sports markets</p>
                      <p className="text-sm text-muted-foreground">
                        Choose any market type. Moneyline base markets are added automatically using the draw selection above, and row order is sent as the market group threshold automatically.
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
                                Market
                                {' '}
                                {index + 1}
                              </Label>
                              <Button type="button" variant="outline" size="sm" onClick={() => removeSportsCustomMarket(market.id)}>
                                <Trash2Icon className="mr-2 size-4" />
                                Remove
                              </Button>
                            </div>
                            <Select
                              value={market.sportsMarketType || undefined}
                              onValueChange={value => handleSportsCustomMarketChange(market.id, 'sportsMarketType', value)}
                            >
                              <SelectTrigger id={`sports-custom-market-type-${market.id}`} className="w-full">
                                <SelectValue placeholder="Select a sports market type" />
                              </SelectTrigger>
                              <SelectContent>
                                {sportsMarketTypeGroups.map(group => (
                                  <SelectGroup key={group.label}>
                                    <SelectLabel>{group.label}</SelectLabel>
                                    {group.options.map(option => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Question</Label>
                            <Input
                              value={market.question}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'question', event.target.value)}
                              placeholder={marketTypeOption?.label
                                ? `Example: ${marketTypeOption.label}`
                                : 'Example: 1H Moneyline'}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              value={market.title}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'title', event.target.value)}
                              placeholder={marketTypeOption?.label || 'Example: 1H Moneyline'}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Short name</Label>
                            <Input
                              value={market.shortName}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'shortName', event.target.value)}
                              placeholder={marketTypeOption?.label || 'Example: 1H ML'}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Slug override (optional)</Label>
                            <Input
                              value={market.slug}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'slug', event.target.value)}
                              placeholder="Leave blank to generate automatically"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Outcome 1</Label>
                            <Input
                              value={market.outcomeOne}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'outcomeOne', event.target.value)}
                              placeholder={defaultOutcomes?.[0] || 'Example: Over'}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Outcome 2</Label>
                            <Input
                              value={market.outcomeTwo}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'outcomeTwo', event.target.value)}
                              placeholder={defaultOutcomes?.[1] || 'Example: Under'}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>
                              Line
                              {marketTypeOption?.requiresLine ? '' : ' (optional)'}
                            </Label>
                            <Input
                              value={market.line}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'line', event.target.value)}
                              placeholder={marketTypeOption?.requiresLine ? 'Example: 110.5 or -1.5' : 'Optional'}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Group title (optional)</Label>
                            <Input
                              value={market.groupItemTitle}
                              onChange={event => handleSportsCustomMarketChange(market.id, 'groupItemTitle', event.target.value)}
                              placeholder="Defaults to the title sent to metadata"
                            />
                          </div>

                          {sportsForm.section === 'games' && (
                            <div className="space-y-2 md:col-span-2">
                              <Label>Icon</Label>
                              <Select
                                value={market.iconAssetKey || undefined}
                                onValueChange={value => handleSportsCustomMarketChange(market.id, 'iconAssetKey', value)}
                              >
                                <SelectTrigger className="w-full md:max-w-xs">
                                  <SelectValue placeholder="No team icon" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No team icon</SelectItem>
                                  <SelectItem value="home">
                                    {sportsForm.teams[0]?.name || 'Home team'}
                                    {' '}
                                    icon
                                  </SelectItem>
                                  <SelectItem value="away">
                                    {sportsForm.teams[1]?.name || 'Away team'}
                                    {' '}
                                    icon
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
                      Add custom market
                    </Button>
                  </div>
                )}

                {sportsForm.section === 'props' && sportsForm.eventVariant !== 'custom' && (
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Player props</p>
                      <p className="text-sm text-muted-foreground">
                        Each row becomes one generated market with Over and Under outcomes.
                      </p>
                    </div>

                    {sportsForm.props.map((prop, index) => (
                      <div key={prop.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label htmlFor={`sports-prop-player-${prop.id}`}>
                              Prop
                              {' '}
                              {index + 1}
                            </Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => removeSportsProp(prop.id)}>
                              <Trash2Icon className="mr-2 size-4" />
                              Remove
                            </Button>
                          </div>
                          <Input
                            id={`sports-prop-player-${prop.id}`}
                            value={prop.playerName}
                            onChange={event => handleSportsPropChange(prop.id, 'playerName', event.target.value)}
                            placeholder="Example: Jamal Murray"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Stat type</Label>
                          <Select
                            value={prop.statType || undefined}
                            onValueChange={value => handleSportsPropChange(prop.id, 'statType', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select stat type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="points">Points</SelectItem>
                              <SelectItem value="rebounds">Rebounds</SelectItem>
                              <SelectItem value="assists">Assists</SelectItem>
                              <SelectItem value="receiving_yards">Receiving Yards</SelectItem>
                              <SelectItem value="rushing_yards">Rushing Yards</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Line</Label>
                          <Input
                            value={prop.line}
                            onChange={event => handleSportsPropChange(prop.id, 'line', event.target.value)}
                            placeholder="Example: 29.5"
                          />
                        </div>

                      </div>
                    ))}

                    <Button type="button" variant="outline" onClick={addSportsProp}>
                      <PlusIcon className="mr-2 size-4" />
                      Add prop
                    </Button>
                  </div>
                )}
              </>
            )
          : (
              <>
                <div className="space-y-3">
                  <Label>Select Event type</Label>
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
                        <span className={cn(
                          'inline-flex size-4 items-center justify-center rounded-full border',
                          form.marketMode === 'binary' ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                        )}
                        >
                          {form.marketMode === 'binary' && <span className="size-1.5 rounded-full bg-background" />}
                        </span>
                        Binary market
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Eg. Will BTC close above $110k on Mar 31, 2028?
                      </p>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>Yes</span>
                          <OutcomeStateDot value />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>No</span>
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
                        <span className={cn(
                          'inline-flex size-4 items-center justify-center rounded-full border',
                          form.marketMode === 'multi_multiple'
                            ? 'border-primary bg-primary'
                            : `border-muted-foreground/50`,
                        )}
                        >
                          {form.marketMode === 'multi_multiple' && (
                            <span className="size-1.5 rounded-full bg-background" />
                          )}
                        </span>
                        Multi-market (multiple true outcomes)
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Eg. Which BTC milestones will be reached by Dec 31, 2028?
                      </p>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>BTC above $100k (short: 100k)</span>
                          <OutcomeStateDot value />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>BTC above $110k (short: 110k)</span>
                          <OutcomeStateDot value />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>BTC above $120k (short: 120k)</span>
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
                        <span className={cn(
                          'inline-flex size-4 items-center justify-center rounded-full border',
                          form.marketMode === 'multi_unique'
                            ? 'border-primary bg-primary'
                            : `border-muted-foreground/50`,
                        )}
                        >
                          {form.marketMode === 'multi_unique' && (
                            <span className="size-1.5 rounded-full bg-background" />
                          )}
                        </span>
                        Multi-market (single true outcome)
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Eg. Who will win the 2028 U.S. presidential election?
                      </p>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>Gavin Newsom (short: Newsom)</span>
                          <OutcomeStateDot value />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>Nikki Haley (short: Haley)</span>
                          <OutcomeStateDot value={false} />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                          <span>Donald Trump (short: Trump)</span>
                          <OutcomeStateDot value={false} />
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {form.marketMode === 'binary' && (
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="space-y-2">
                      <Label htmlFor="binary-question">Question</Label>
                      <Input
                        id="binary-question"
                        value={form.title}
                        disabled
                        readOnly
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Outcomes</Label>
                      <div className={cn(`
                        grid grid-cols-1 items-center gap-2
                        md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]
                      `)}
                      >
                        <Input
                          id="binary-outcome-yes"
                          value={form.binaryOutcomeYes}
                          onChange={event => handleFieldChange('binaryOutcomeYes', event.target.value)}
                          placeholder="Yes"
                          disabled={!isBinaryOutcomesEditable}
                        />
                        <Input
                          id="binary-outcome-no"
                          value={form.binaryOutcomeNo}
                          onChange={event => handleFieldChange('binaryOutcomeNo', event.target.value)}
                          placeholder="No"
                          disabled={!isBinaryOutcomesEditable}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-10 rounded-md"
                          onClick={() => setIsBinaryOutcomesEditable(previous => !previous)}
                          aria-label={isBinaryOutcomesEditable ? 'Lock outcomes' : 'Edit outcomes'}
                        >
                          <SquarePenIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {(form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') && (
                  <div className="space-y-4 rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">Each option creates one child market.</p>

                    <div className="space-y-4">
                      {form.options.map((option, index) => (
                        <div key={option.id} className="space-y-3 rounded-md border p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              Option
                              {' '}
                              {index + 1}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeOption(option.id)}
                              disabled={form.options.length <= 2}
                            >
                              <Trash2Icon className="mr-2 size-4" />
                              Remove
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                              <Label>Market question</Label>
                              <Input
                                value={option.question}
                                onChange={event => handleOptionChange(option.id, 'question', event.target.value)}
                                placeholder={optionQuestionPlaceholder}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Option name</Label>
                              <Input
                                value={option.title}
                                onChange={event => handleOptionChange(option.id, 'title', event.target.value)}
                                placeholder={optionNamePlaceholder}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Short name</Label>
                              <Input
                                value={option.shortName}
                                onChange={event => handleOptionChange(option.id, 'shortName', event.target.value)}
                                placeholder={optionShortNamePlaceholder}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Slug</Label>
                              <Input value={option.slug} readOnly />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Outcomes</Label>
                              <div className={cn(`
                                grid grid-cols-1 items-center gap-2
                                md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]
                              `)}
                              >
                                <Input
                                  value={option.outcomeYes}
                                  onChange={event => handleOptionChange(option.id, 'outcomeYes', event.target.value)}
                                  placeholder="Yes"
                                  disabled={!areMultiOutcomesEditable}
                                />
                                <Input
                                  value={option.outcomeNo}
                                  onChange={event => handleOptionChange(option.id, 'outcomeNo', event.target.value)}
                                  placeholder="No"
                                  disabled={!areMultiOutcomesEditable}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-10 rounded-md"
                                  onClick={() => setAreMultiOutcomesEditable(previous => !previous)}
                                  aria-label={areMultiOutcomesEditable ? 'Lock outcomes' : 'Edit outcomes'}
                                >
                                  <SquarePenIcon className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Option image (optional)</Label>
                            <Input
                              id={`option-image-${option.id}`}
                              type="file"
                              accept="image/*"
                              onChange={event => handleOptionImageUpload(option.id, event)}
                              className="sr-only"
                            />
                            <label
                              htmlFor={`option-image-${option.id}`}
                              className={cn(`
                                group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden
                                rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground
                                transition
                                hover:border-primary/60
                              `)}
                            >
                              <span className={cn(`
                                pointer-events-none absolute inset-0 bg-foreground/0 transition
                                group-hover:bg-foreground/5
                              `)}
                              />
                              {optionImagePreviewUrls[option.id]
                                ? (
                                    <EventIconImage
                                      src={optionImagePreviewUrls[option.id]}
                                      alt={`Option ${index + 1} image preview`}
                                      sizes="256px"
                                      unoptimized
                                      containerClassName="size-full"
                                    />
                                  )
                                : (
                                    <div className="text-xs text-muted-foreground">No image</div>
                                  )}
                              <ImageUp
                                className={cn(`
                                  pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2
                                  text-foreground/70 opacity-0 transition
                                  group-hover:opacity-100
                                `)}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button type="button" variant="outline" onClick={addOption}>
                      <PlusIcon className="mr-2 size-4" />
                      Add option
                    </Button>
                  </div>
                )}
              </>
            )}
      </CardContent>
    </Card>
  )
}
