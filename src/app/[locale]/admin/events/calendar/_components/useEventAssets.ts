import type { TeamLogoFileMap } from './admin-create-event-form-types'
import type { EventCreationAssetPayload } from '@/lib/event-creation'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { normalizeEventCreationAssetPayload } from '@/lib/event-creation'

type TeamLogoPreviewUrlMap = Record<keyof TeamLogoFileMap, string | null>

const EMPTY_OPTION_IMAGE_OBJECT_URLS: Record<string, string> = {}
const EMPTY_TEAM_LOGO_OBJECT_URLS: TeamLogoPreviewUrlMap = {
  home: null,
  away: null,
}

function createObjectUrlStore(file: File | null) {
  let objectUrl: string | null = null

  return {
    getSnapshot: () => objectUrl,
    getServerSnapshot: () => null,
    subscribe: (onStoreChange: () => void) => {
      if (file) {
        objectUrl = URL.createObjectURL(file)
        onStoreChange()
      }

      return function cleanupObjectUrl() {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = null
        }
      }
    },
  }
}

function createOptionImageObjectUrlStore(optionImageFiles: Record<string, File | null>) {
  let objectUrls = EMPTY_OPTION_IMAGE_OBJECT_URLS

  return {
    getSnapshot: () => objectUrls,
    getServerSnapshot: () => EMPTY_OPTION_IMAGE_OBJECT_URLS,
    subscribe: (onStoreChange: () => void) => {
      const nextObjectUrls: Record<string, string> = {}
      Object.entries(optionImageFiles).forEach(([optionId, file]) => {
        if (file) {
          nextObjectUrls[optionId] = URL.createObjectURL(file)
        }
      })

      objectUrls = Object.keys(nextObjectUrls).length > 0 ? nextObjectUrls : EMPTY_OPTION_IMAGE_OBJECT_URLS
      if (objectUrls !== EMPTY_OPTION_IMAGE_OBJECT_URLS) {
        onStoreChange()
      }

      return function cleanupOptionImageObjectUrls() {
        Object.values(nextObjectUrls).forEach(url => URL.revokeObjectURL(url))
        objectUrls = EMPTY_OPTION_IMAGE_OBJECT_URLS
      }
    },
  }
}

function createTeamLogoObjectUrlStore(teamLogoFiles: TeamLogoFileMap) {
  let objectUrls = EMPTY_TEAM_LOGO_OBJECT_URLS

  return {
    getSnapshot: () => objectUrls,
    getServerSnapshot: () => EMPTY_TEAM_LOGO_OBJECT_URLS,
    subscribe: (onStoreChange: () => void) => {
      const nextObjectUrls: TeamLogoPreviewUrlMap = {
        home: teamLogoFiles.home ? URL.createObjectURL(teamLogoFiles.home) : null,
        away: teamLogoFiles.away ? URL.createObjectURL(teamLogoFiles.away) : null,
      }
      const hasObjectUrl = Boolean(nextObjectUrls.home || nextObjectUrls.away)

      objectUrls = hasObjectUrl ? nextObjectUrls : EMPTY_TEAM_LOGO_OBJECT_URLS
      if (hasObjectUrl) {
        onStoreChange()
      }

      return function cleanupTeamLogoObjectUrls() {
        Object.values(nextObjectUrls).forEach((url) => {
          if (url) {
            URL.revokeObjectURL(url)
          }
        })
        objectUrls = EMPTY_TEAM_LOGO_OBJECT_URLS
      }
    },
  }
}

function useObjectUrl(file: File | null) {
  const store = useMemo(() => createObjectUrlStore(file), [file])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

function useOptionImageObjectUrls(optionImageFiles: Record<string, File | null>) {
  const store = useMemo(() => createOptionImageObjectUrlStore(optionImageFiles), [optionImageFiles])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

function useTeamLogoObjectUrls(teamLogoFiles: TeamLogoFileMap) {
  const store = useMemo(() => createTeamLogoObjectUrlStore(teamLogoFiles), [teamLogoFiles])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

export function useEventAssets(serverAssetPayload: EventCreationAssetPayload | null) {
  const [eventImageFile, setEventImageFile] = useState<File | null>(null)
  const [teamLogoFiles, setTeamLogoFiles] = useState<TeamLogoFileMap>({
    home: null,
    away: null,
  })
  const [optionImageFiles, setOptionImageFiles] = useState<Record<string, File | null>>({})
  const [storedAssets, setStoredAssets] = useState<EventCreationAssetPayload>(() => normalizeEventCreationAssetPayload(serverAssetPayload))
  const eventImageObjectUrl = useObjectUrl(eventImageFile)
  const optionImageObjectUrls = useOptionImageObjectUrls(optionImageFiles)
  const teamLogoObjectUrls = useTeamLogoObjectUrls(teamLogoFiles)

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
