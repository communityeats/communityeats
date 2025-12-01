import type { ConversationDoc } from '@/lib/types/chat'

const jsonOrEmpty = async (res: Response) => {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function ensureConversation({
  token,
  listingId,
  targetUserUid,
}: {
  token: string
  listingId: string
  targetUserUid?: string
}): Promise<ConversationDoc> {
  const payload: Record<string, unknown> = { listing_id: listingId }
  if (targetUserUid) payload.target_user_uid = targetUserUid

  const res = await fetch('/api/v1/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await jsonOrEmpty(res)
    throw new Error((body.error as string | undefined) || 'Failed to initialize conversation')
  }

  return (await res.json()) as ConversationDoc
}

export async function listConversations(token: string, limit?: number) {
  const params = new URLSearchParams()
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50)
    params.set('limit', String(safeLimit))
  }

  const res = await fetch(`/api/v1/conversations${params.toString() ? `?${params.toString()}` : ''}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await jsonOrEmpty(res)
    throw new Error((body.error as string | undefined) || 'Failed to load conversations')
  }

  const body = (await res.json()) as { conversations?: ConversationDoc[] }
  return Array.isArray(body.conversations) ? body.conversations : []
}
