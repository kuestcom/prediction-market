'use client'

import { create } from 'zustand'

interface SportsLivestreamState {
  streamUrl: string | null
  streamTitle: string | null
  openStream: (payload: { url: string, title?: string | null }) => void
  closeStream: () => void
}

function normalizeStreamUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  }
  catch {
    return null
  }
}

export const useSportsLivestream = create<SportsLivestreamState>()(set => ({
  streamUrl: null,
  streamTitle: null,
  openStream: ({ url, title }) => {
    const normalizedUrl = normalizeStreamUrl(url)
    if (!normalizedUrl) {
      return
    }

    set({
      streamUrl: normalizedUrl,
      streamTitle: title?.trim() || null,
    })
  },
  closeStream: () => {
    set({
      streamUrl: null,
      streamTitle: null,
    })
  },
}))
