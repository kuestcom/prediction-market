import type { TeamLogoFileMap } from './admin-create-event-form-types'
import type { EventCreationAssetPayload } from '@/lib/event-creation'
import { useEffect, useMemo, useState } from 'react'
import { normalizeEventCreationAssetPayload } from '@/lib/event-creation'

export function useEventAssets(serverAssetPayload: EventCreationAssetPayload | null) {
  const [eventImageFile, setEventImageFile] = useState<File | null>(null)
  const [teamLogoFiles, setTeamLogoFiles] = useState<TeamLogoFileMap>({
    home: null,
    away: null,
  })
  const [optionImageFiles, setOptionImageFiles] = useState<Record<string, File | null>>({})
  const [storedAssets, setStoredAssets] = useState<EventCreationAssetPayload>(() => normalizeEventCreationAssetPayload(serverAssetPayload))

  const eventImagePreviewUrl = useMemo(
    () => (eventImageFile ? URL.createObjectURL(eventImageFile) : (storedAssets.eventImage?.publicUrl || null)),
    [eventImageFile, storedAssets.eventImage?.publicUrl],
  )
  const optionImagePreviewUrls = useMemo(() => {
    const previewUrls: Record<string, string> = Object.fromEntries(
      Object.entries(storedAssets.optionImages).map(([optionId, asset]) => [optionId, asset.publicUrl]),
    )
    Object.entries(optionImageFiles).forEach(([optionId, file]) => {
      if (file) {
        previewUrls[optionId] = URL.createObjectURL(file)
      }
    })
    return previewUrls
  }, [optionImageFiles, storedAssets.optionImages])
  const teamLogoPreviewUrls = useMemo(() => ({
    home: teamLogoFiles.home ? URL.createObjectURL(teamLogoFiles.home) : (storedAssets.teamLogos.home?.publicUrl || null),
    away: teamLogoFiles.away ? URL.createObjectURL(teamLogoFiles.away) : (storedAssets.teamLogos.away?.publicUrl || null),
  }), [storedAssets.teamLogos.away?.publicUrl, storedAssets.teamLogos.home?.publicUrl, teamLogoFiles])
  const hasEventImage = Boolean(eventImageFile || storedAssets.eventImage?.publicUrl)
  const hasTeamLogoByHostStatus = useMemo(() => ({
    home: Boolean(teamLogoFiles.home || storedAssets.teamLogos.home?.publicUrl),
    away: Boolean(teamLogoFiles.away || storedAssets.teamLogos.away?.publicUrl),
  }), [storedAssets.teamLogos.away?.publicUrl, storedAssets.teamLogos.home?.publicUrl, teamLogoFiles.away, teamLogoFiles.home])

  useEffect(function revokeEventImagePreviewObjectUrl() {
    if (!eventImagePreviewUrl || !eventImagePreviewUrl.startsWith('blob:')) {
      return
    }

    return function cleanupEventImagePreviewObjectUrl() {
      URL.revokeObjectURL(eventImagePreviewUrl)
    }
  }, [eventImagePreviewUrl])

  useEffect(function revokeOptionImagePreviewObjectUrls() {
    return function cleanupOptionImagePreviewObjectUrls() {
      Object.values(optionImagePreviewUrls).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [optionImagePreviewUrls])

  useEffect(function revokeTeamLogoPreviewObjectUrls() {
    return function cleanupTeamLogoPreviewObjectUrls() {
      Object.values(teamLogoPreviewUrls).forEach((url) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [teamLogoPreviewUrls])

  return {
    eventImageFile,
    setEventImageFile,
    teamLogoFiles,
    setTeamLogoFiles,
    optionImageFiles,
    setOptionImageFiles,
    storedAssets,
    setStoredAssets,
    eventImagePreviewUrl,
    optionImagePreviewUrls,
    teamLogoPreviewUrls,
    hasEventImage,
    hasTeamLogoByHostStatus,
  }
}
