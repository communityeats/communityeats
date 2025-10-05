import type { ListingDoc } from '@/lib/types/listing'

export type InterestedUser = {
  uid: string
  name: string | null
  email: string | null
}

const jsonOrEmpty = async (res: Response) => {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function fetchListingDetail(id: string, token: string): Promise<ListingDoc> {
  const res = await fetch(`/api/v1/listings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await jsonOrEmpty(res)
    throw new Error((body.error as string | undefined) || `Failed to fetch listing ${id}`)
  }
  return (await res.json()) as ListingDoc
}

export async function fetchInterestedUsers(listingId: string, token: string): Promise<InterestedUser[]> {
  const res = await fetch(`/api/v1/listings/${listingId}/interested-users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await jsonOrEmpty(res)
    throw new Error((body.error as string | undefined) || 'Failed to load interested users')
  }
  const body = (await res.json().catch(() => ({}))) as { interested_users?: unknown }
  const raw = Array.isArray(body.interested_users) ? body.interested_users : []

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as { uid?: unknown; name?: unknown; email?: unknown }
      const uid = typeof record.uid === 'string' ? record.uid : null
      if (!uid) return null
      const name = typeof record.name === 'string' ? record.name : null
      const email = typeof record.email === 'string' ? record.email : null
      return { uid, name, email }
    })
    .filter(Boolean) as InterestedUser[]
}

export type ListingPatchPayload = Partial<
  Pick<
    ListingDoc,
    'title' | 'description' | 'exchange_type' | 'status' | 'country' | 'location'
  >
>

export async function updateListing(token: string, id: string, payload: ListingPatchPayload) {
  const res = await fetch(`/api/v1/listings/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, ...payload }),
  })
  if (!res.ok) {
    const body = await jsonOrEmpty(res)
    throw new Error((body.error as string | undefined) || 'Failed to update listing.')
  }
  return res.json()
}

export async function deleteListing(token: string, id: string) {
  const res = await fetch(`/api/v1/listings/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await jsonOrEmpty(res)
    throw new Error((body.error as string | undefined) || 'Failed to delete listing.')
  }
  return res.json()
}
