'use client'

import type { User } from '@/types'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { startTransition, useOptimistic, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateNotificationSettingsAction } from '@/app/[locale]/(platform)/settings/_actions/update-notification-settings'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface NotificationSettings {
  email_resolutions: boolean
  inapp_order_fills: boolean
  inapp_hide_small_fills: boolean
  inapp_resolutions: boolean
}

export default function SettingsNotificationsContent({ user }: { user: User }) {
  const t = useExtracted()
  const [status, setStatus] = useState<{ error: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const initialSettings = user.settings?.notifications ?? {
    email_resolutions: false,
    inapp_order_fills: false,
    inapp_hide_small_fills: false,
    inapp_resolutions: false,
  }

  const [optimisticSettings, updateOptimisticSettings] = useOptimistic<
    NotificationSettings,
    Partial<NotificationSettings>
  >(
    initialSettings as NotificationSettings,
    (state, newSettings) => ({
      ...state,
      ...newSettings,
    }),
  )

  function handleSwitchChange(field: keyof NotificationSettings, checked: boolean) {
    const prev = optimisticSettings

    startTransition(() => {
      updateOptimisticSettings({ [field]: checked })
    })

    queueMicrotask(async () => {
      const result = await updateNotificationSettingsAction(
        new FormData(formRef.current!),
      )

      if (result?.error) {
        startTransition(() => {
          updateOptimisticSettings(prev)
        })
        setStatus(result)
      }
      else {
        toast.success(t('Notification settings updated.'))
        setStatus(null)
      }
    })
  }

  return (
    <div className="grid gap-8">
      {status?.error && <InputError message={status.error} />}

      <Form ref={formRef} action={() => {}} className="grid gap-6">
        <input
          type="hidden"
          name="email_resolutions"
          value={optimisticSettings?.email_resolutions ? 'on' : 'off'}
        />
        <input
          type="hidden"
          name="inapp_order_fills"
          value={optimisticSettings?.inapp_order_fills ? 'on' : 'off'}
        />
        <input
          type="hidden"
          name="inapp_hide_small_fills"
          value={optimisticSettings?.inapp_hide_small_fills ? 'on' : 'off'}
        />
        <input
          type="hidden"
          name="inapp_resolutions"
          value={optimisticSettings?.inapp_resolutions ? 'on' : 'off'}
        />

        <div className="rounded-lg border p-6">
          <div className="grid gap-4">
            <h3 className="text-lg font-semibold">{t('Email')}</h3>

            <div className="flex items-center justify-between">
              <div className="grid gap-1">
                <Label htmlFor="email-resolutions" className="text-sm font-medium">
                  {t('Resolutions')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('Get notified when markets are resolved')}
                </p>
              </div>
              <Switch
                id="email-resolutions"
                checked={optimisticSettings?.email_resolutions}
                onCheckedChange={checked => handleSwitchChange('email_resolutions', checked)}
                disabled
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <div className="grid gap-4">
            <h3 className="text-lg font-semibold">{t('In-app')}</h3>

            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <Label htmlFor="inapp-order-fills" className="text-sm font-medium">
                    {t('Order Fills')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Get notified when your orders are filled')}
                  </p>
                </div>
                <Switch
                  id="inapp-order-fills"
                  checked={optimisticSettings?.inapp_order_fills}
                  onCheckedChange={checked => handleSwitchChange('inapp_order_fills', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <Label htmlFor="inapp-hide-small" className="text-sm font-medium">
                    {t('Hide small fills (<1 share)')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Don\'t notify for fills smaller than 1 share')}
                  </p>
                </div>
                <Switch
                  id="inapp-hide-small"
                  checked={optimisticSettings?.inapp_hide_small_fills}
                  onCheckedChange={checked => handleSwitchChange('inapp_hide_small_fills', checked)}
                  disabled
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <Label htmlFor="inapp-resolutions" className="text-sm font-medium">
                    {t('Resolutions')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Get notified when markets are resolved')}
                  </p>
                </div>
                <Switch
                  id="inapp-resolutions"
                  checked={optimisticSettings?.inapp_resolutions}
                  onCheckedChange={checked => handleSwitchChange('inapp_resolutions', checked)}
                  disabled
                />
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}
