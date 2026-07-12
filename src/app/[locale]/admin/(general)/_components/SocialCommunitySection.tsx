'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Users } from 'lucide-react'
import { useExtracted } from 'next-intl'
import SocialIcon from '@/components/SocialIcon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SettingsAccordionSection from './SettingsAccordionSection'

interface SocialCommunitySectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  discordLink: string
  setDiscordLink: Dispatch<SetStateAction<string>>
  twitterLink: string
  setTwitterLink: Dispatch<SetStateAction<string>>
  facebookLink: string
  setFacebookLink: Dispatch<SetStateAction<string>>
  instagramLink: string
  setInstagramLink: Dispatch<SetStateAction<string>>
  tiktokLink: string
  setTiktokLink: Dispatch<SetStateAction<string>>
  linkedinLink: string
  setLinkedinLink: Dispatch<SetStateAction<string>>
  youtubeLink: string
  setYoutubeLink: Dispatch<SetStateAction<string>>
  supportUrl: string
  setSupportUrl: Dispatch<SetStateAction<string>>
}

function SocialCommunitySection({
  isPending,
  openSections,
  onToggleSection,
  discordLink,
  setDiscordLink,
  twitterLink,
  setTwitterLink,
  facebookLink,
  setFacebookLink,
  instagramLink,
  setInstagramLink,
  tiktokLink,
  setTiktokLink,
  linkedinLink,
  setLinkedinLink,
  youtubeLink,
  setYoutubeLink,
  supportUrl,
  setSupportUrl,
}: SocialCommunitySectionProps) {
  const t = useExtracted()

  return (
    <SettingsAccordionSection
      value="community-analytics"
      isOpen={openSections.includes('community-analytics')}
      onToggle={onToggleSection}
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <Users className="size-4 text-muted-foreground" />
          {t('Social & Community')}
        </h3>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="theme-discord-link" className="flex items-center gap-2">
            <SocialIcon social="discord" className="size-4" />
            {t('Discord community link')}
          </Label>
          <Input
            id="theme-discord-link"
            name="discord_link"
            maxLength={2048}
            value={discordLink}
            onChange={event => setDiscordLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://discord.gg/invite-url (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-twitter-link" className="flex items-center gap-2">
            <SocialIcon social="x" className="size-4" />
            {t('X / Twitter link')}
          </Label>
          <Input
            id="theme-twitter-link"
            name="twitter_link"
            maxLength={2048}
            value={twitterLink}
            onChange={event => setTwitterLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://x.com/your-handle (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-facebook-link" className="flex items-center gap-2">
            <SocialIcon social="facebook" className="size-4" />
            {t('Facebook link')}
          </Label>
          <Input
            id="theme-facebook-link"
            name="facebook_link"
            maxLength={2048}
            value={facebookLink}
            onChange={event => setFacebookLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://facebook.com/your-page (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-instagram-link" className="flex items-center gap-2">
            <SocialIcon social="instagram" className="size-4" />
            {t('Instagram link')}
          </Label>
          <Input
            id="theme-instagram-link"
            name="instagram_link"
            maxLength={2048}
            value={instagramLink}
            onChange={event => setInstagramLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://instagram.com/your-handle (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-tiktok-link" className="flex items-center gap-2">
            <SocialIcon social="tiktok" className="size-4" />
            {t('TikTok link')}
          </Label>
          <Input
            id="theme-tiktok-link"
            name="tiktok_link"
            maxLength={2048}
            value={tiktokLink}
            onChange={event => setTiktokLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://tiktok.com/@your-handle (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-linkedin-link" className="flex items-center gap-2">
            <SocialIcon social="linkedin" className="size-4" />
            {t('LinkedIn link')}
          </Label>
          <Input
            id="theme-linkedin-link"
            name="linkedin_link"
            maxLength={2048}
            value={linkedinLink}
            onChange={event => setLinkedinLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://linkedin.com/company/your-company (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-youtube-link" className="flex items-center gap-2">
            <SocialIcon social="youtube" className="size-4" />
            {t('YouTube link')}
          </Label>
          <Input
            id="theme-youtube-link"
            name="youtube_link"
            maxLength={2048}
            value={youtubeLink}
            onChange={event => setYoutubeLink(event.target.value)}
            disabled={isPending}
            placeholder={t('https://youtube.com/@your-channel (optional)')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="theme-support-link" className="flex items-center gap-2">
            <SocialIcon social="email" className="size-4" />
            {t('Support link')}
          </Label>
          <Input
            id="theme-support-link"
            name="support_url"
            maxLength={2048}
            value={supportUrl}
            onChange={event => setSupportUrl(event.target.value)}
            disabled={isPending}
            placeholder={t('Discord, Telegram, WhatsApp link, or support email (optional)')}
          />
        </div>
      </div>
    </SettingsAccordionSection>
  )
}

export default SocialCommunitySection
