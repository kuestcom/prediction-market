export function resolveCampaignLookupId({
  dismissedLinkedCampaignId,
  linkedCampaignId,
  lookupId,
}: {
  dismissedLinkedCampaignId: string | null
  linkedCampaignId: string | null
  lookupId: string | null
}) {
  if (lookupId) {
    return lookupId
  }

  return linkedCampaignId === dismissedLinkedCampaignId ? null : linkedCampaignId
}

export function resolveCampaignsInstanceKey(linkedCampaignId: string | null) {
  return linkedCampaignId ? `linked-campaign:${linkedCampaignId}` : 'campaigns'
}
