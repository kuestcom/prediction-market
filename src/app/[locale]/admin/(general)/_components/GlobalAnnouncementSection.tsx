'use client'

import type { CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import { Megaphone } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import SettingsAccordionSection from './SettingsAccordionSection'

const MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH = 220
const MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH = 2048

interface DisablePageOption {
  value: CustomJavascriptCodeDisablePage
  label: string
}

interface GlobalAnnouncementSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  globalAnnouncementMessage: string
  onGlobalAnnouncementMessageChange: (value: string) => void
  globalAnnouncementLinkUrl: string
  onGlobalAnnouncementLinkUrlChange: (value: string) => void
  globalAnnouncementDisabledOn: CustomJavascriptCodeDisablePage[]
  onToggleGlobalAnnouncementDisableOn: (value: CustomJavascriptCodeDisablePage, checked: boolean) => void
  globalAnnouncementDisableFaucetBanner: boolean
  onGlobalAnnouncementDisableFaucetBannerChange: (value: boolean) => void
  customJavascriptCodeDisablePageOptions: DisablePageOption[]
}

function GlobalAnnouncementSection({
  isPending,
  openSections,
  onToggleSection,
  globalAnnouncementMessage,
  onGlobalAnnouncementMessageChange,
  globalAnnouncementLinkUrl,
  onGlobalAnnouncementLinkUrlChange,
  globalAnnouncementDisabledOn,
  onToggleGlobalAnnouncementDisableOn,
  globalAnnouncementDisableFaucetBanner,
  onGlobalAnnouncementDisableFaucetBannerChange,
  customJavascriptCodeDisablePageOptions,
}: GlobalAnnouncementSectionProps) {
  const t = useExtracted()

  return (
    <SettingsAccordionSection
      value="global-announcement"
      isOpen={openSections.includes('global-announcement')}
      onToggle={onToggleSection}
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <Megaphone className="size-4 text-muted-foreground" />
          {t('Global announcement banner')}
        </h3>
      )}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="global-announcement-message">{t('Message')}</Label>
          <Input
            id="global-announcement-message"
            name="global_announcement_message"
            maxLength={MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH}
            value={globalAnnouncementMessage}
            onChange={event => onGlobalAnnouncementMessageChange(event.target.value)}
            disabled={isPending}
            placeholder={t('e.g. Refer friends and earn rewards this week')}
          />
          <p className="text-xs text-muted-foreground">
            {t('Displayed in the website header. Leave empty to hide.')}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="global-announcement-link-url">{t('URL (optional)')}</Label>
          <Input
            id="global-announcement-link-url"
            name="global_announcement_link_url"
            maxLength={MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH}
            value={globalAnnouncementLinkUrl}
            onChange={event => onGlobalAnnouncementLinkUrlChange(event.target.value)}
            disabled={isPending}
            placeholder={t('https://example.com/campaign')}
          />
        </div>

        <div className="grid gap-2">
          <Label>{t('Disable on')}</Label>
          <div className="flex flex-wrap gap-3">
            {customJavascriptCodeDisablePageOptions.map((option) => {
              const fieldId = `global-announcement-disable-${option.value}`
              return (
                <label
                  key={option.value}
                  htmlFor={fieldId}
                  className={cn(
                    `
                      flex min-w-32 cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2
                      text-sm transition-colors
                      hover:bg-muted/40
                    `,
                    globalAnnouncementDisabledOn.includes(option.value) && 'border-primary/50 bg-primary/5',
                  )}
                >
                  <Checkbox
                    id={fieldId}
                    checked={globalAnnouncementDisabledOn.includes(option.value)}
                    disabled={isPending}
                    onCheckedChange={checked => onToggleGlobalAnnouncementDisableOn(option.value, checked === true)}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2.5">
          <div className="grid gap-1">
            <Label htmlFor="global-announcement-disable-faucet-banner">
              {t('Disable Faucet Banner')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('Hide the test-mode faucet banner for everyone.')}
            </p>
          </div>
          <Switch
            id="global-announcement-disable-faucet-banner"
            checked={globalAnnouncementDisableFaucetBanner}
            disabled={isPending}
            onCheckedChange={onGlobalAnnouncementDisableFaucetBannerChange}
          />
        </div>
      </div>
    </SettingsAccordionSection>
  )
}

export default GlobalAnnouncementSection
