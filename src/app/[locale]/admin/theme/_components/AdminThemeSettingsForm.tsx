'use client'

import { useMemo } from 'react'

import type { AdminThemeSettingsFormProps } from '@/app/[locale]/admin/theme/_components/admin-theme-utils'

import AdminThemeSettingsFormInner from '@/app/[locale]/admin/theme/_components/AdminThemeSettingsFormInner'

function useThemeFormResetKey({
  presetOptions,
  initialThemeSettings,
  initialThemeSiteSettings,
}: {
  presetOptions: AdminThemeSettingsFormProps['presetOptions']
  initialThemeSettings: AdminThemeSettingsFormProps['initialThemeSettings']
  initialThemeSiteSettings: AdminThemeSettingsFormProps['initialThemeSiteSettings']
}) {
  return useMemo(
    () =>
      JSON.stringify({
        presetOptions,
        initialThemeSettings,
        initialThemeSiteSettings,
      }),
    [presetOptions, initialThemeSettings, initialThemeSiteSettings],
  )
}

export default function AdminThemeSettingsForm(props: AdminThemeSettingsFormProps) {
  const formResetKey = useThemeFormResetKey(props)

  return <AdminThemeSettingsFormInner key={formResetKey} {...props} />
}
