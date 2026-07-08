import type { TeamLogoFileMap } from './admin-create-event-form-types'
import type { EventCreationAssetPayload } from '@/lib/event-creation'
import { useEffect, useMemo, useState } from 'react'
import { normalizeEventCreationAssetPayload } from '@/lib/event-creation'

type TeamLogoPreviewUrlMap = Record<keyof TeamLogoFileMap, string | null>

export function useEventAssets(serverAssetPayload: EventCreationAssetPayload | null) {
  const [eventImageFile, setEventImageFile] = useState<File | null>(null)
  const [teamLogoFiles, setTeamLogoFiles] = useState<TeamLogoFileMap>({
    home: null,
    away: null,
  })
  const [optionImageFiles, setOptionImageFiles] = useState<Record<string, File | null>>({})
  const [storedAssets, setStoredAssets] = useState<EventCreationAssetPayload>(() => normalizeEventCreationAssetPayload(serverAssetPayload))
  const [eventImageObjectUrl, setEventImageObjectUrl] = useState<string | null>(null)
  const [optionImageObjectUrls, setOptionImageObjectUrls] = useState<Record<string, string>>({})
  const [teamLogoObjectUrls, setTeamLogoObjectUrls] = useState<TeamLogoPreviewUrlMap>({
    home: null,
    away: null,
  })

  const eventImagePreviewUrl = useMemo(
    () => eventImageObjectUrl || storedAssets.eventImage?.publicUrl || null,
    [eventImageObjectUrl, storedAssets.eventImage?.publicUrl],
  )
  const optionImagePreviewUrls = useMemo(() => {
    const previewUrls: Record<string, string> = Object.fromEntries(
      Object.entries(storedAssets.optionImages).map(([optionId, asset]) => [optionId, asset.publicUrl]),
    )
    Object.assign(previewUrls, optionImageObjectUrls)
    return previewUrls
  }, [optionImageObjectUrls, storedAssets.optionImages])
  const teamLogoPreviewUrls = useMemo(() => ({
    home: teamLogoObjectUrls.home || storedAssets.teamLogos.home?.publicUrl || null,
    away: teamLogoObjectUrls.away || storedAssets.teamLogos.away?.publicUrl || null,
  }), [
    storedAssets.teamLogos.away?.publicUrl,
    storedAssets.teamLogos.home?.publicUrl,
    teamLogoObjectUrls.away,
    teamLogoObjectUrls.home,
  ])
  const hasEventImage = Boolean(eventImageFile || storedAssets.eventImage?.publicUrl)
  const hasTeamLogoByHostStatus = useMemo(() => ({
    home: Boolean(teamLogoFiles.home || storedAssets.teamLogos.home?.publicUrl),
    away: Boolean(teamLogoFiles.away || storedAssets.teamLogos.away?.publicUrl),
  }), [storedAssets.teamLogos.away?.publicUrl, storedAssets.teamLogos.home?.publicUrl, teamLogoFiles.away, teamLogoFiles.home])

  useEffect(function createEventImagePreviewObjectUrl() {
    if (!eventImageFile) {
      setEventImageObjectUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(eventImageFile)
    setEventImageObjectUrl(objectUrl)

    return function cleanupEventImagePreviewObjectUrl() {
      URL.revokeObjectURL(objectUrl)
    }
  }, [eventImageFile])

  useEffect(function createOptionImagePreviewObjectUrls() {
    const objectUrls: Record<string, string> = {}
    Object.entries(optionImageFiles).forEach(([optionId, file]) => {
      if (file) {
        objectUrls[optionId] = URL.createObjectURL(file)
      }
    })
    setOptionImageObjectUrls(objectUrls)

    return function cleanupOptionImagePreviewObjectUrls() {
      Object.values(objectUrls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [optionImageFiles])

  useEffect(function createTeamLogoPreviewObjectUrls() {
    const objectUrls: TeamLogoPreviewUrlMap = {
      home: teamLogoFiles.home ? URL.createObjectURL(teamLogoFiles.home) : null,
      away: teamLogoFiles.away ? URL.createObjectURL(teamLogoFiles.away) : null,
    }
    setTeamLogoObjectUrls(objectUrls)

    return function cleanupTeamLogoPreviewObjectUrls() {
      Object.values(objectUrls).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [teamLogoFiles.away, teamLogoFiles.home])

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
