'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  EXCHANGE_TYPES,
  LISTING_CATEGORIES,
  LISTING_STATUSES,
  normalizeListingLocation,
} from '@/lib/types/listing'
import type {
  ListingDoc,
  ListingLocation,
  ListingCategory,
  ExchangeType,
  ListingStatus,
} from '@/lib/types/listing'

// ---------- Local edit-form state (UI-friendly)
type EditFormState = {
  title: string
  description: string
  category: ListingCategory | ''          // allow empty while editing
  exchange_type: ExchangeType | ''
  status: ListingStatus | ''              // allow empty while editing
  location: {
    country: string
    state: string
    suburb: string
    postcode: string                      // keep as string in inputs
  }
}

type PatchPayload = Partial<
  Pick<
    ListingDoc,
    | 'title'
    | 'description'
    | 'category'
    | 'exchange_type'
    | 'status'
    | 'country'
    | 'location'
  >
>

// ---- API helpers
async function fetchListingDetail(id: string, token: string): Promise<ListingDoc> {
  const res = await fetch(`/api/v1/listings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Failed to fetch listing ${id}`)
  }
  return res.json()
}

type InterestedUser = {
  uid: string
  name: string | null
  email: string | null
}

async function fetchInterestedUsers(listingId: string, token: string): Promise<InterestedUser[]> {
  const res = await fetch(`/api/v1/listings/${listingId}/interested-users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Failed to load interested users')
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
      return { uid, name, email } as InterestedUser
    })
    .filter(Boolean) as InterestedUser[]
}

async function updateListing(token: string, id: string, payload: PatchPayload) {
  // NOTE: endpoint to be implemented server-side
  const res = await fetch(`/api/v1/listings/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, ...payload }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Failed to update listing.')
  }
  return res.json()
}

export default function ManageListingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const listingId = params?.id

  // Auth bootstrap (dynamic import + localStorage fallback)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [userUid, setUserUid] = useState<string | null>(null)
  const [authInitError, setAuthInitError] = useState<string | null>(null)

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [listing, setListing] = useState<ListingDoc | null>(null)

  const [interestedUsers, setInterestedUsers] = useState<InterestedUser[] | null>(null)
  const [interestedUsersLoading, setInterestedUsersLoading] = useState<boolean>(false)
  const [interestedUsersError, setInterestedUsersError] = useState<string | null>(null)

  // Edit form
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '',
    description: '',
    category: '',
    exchange_type: '',
    status: '',
    location: { country: '', state: '', suburb: '', postcode: '' },
  })

  // --- Auth init
  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false

    const init = async () => {
      try {
        const mod = await import('firebase/auth').catch(() => null)
        if (!mod) {
          // fallback storage token only
          const local =
            typeof window !== 'undefined'
              ? localStorage.getItem('idToken') || localStorage.getItem('token')
              : null
          if (!cancelled) {
            setIdToken(local)
            setAuthInitError(local ? null : 'Missing token')
          }
          return
        }
        const { getAuth, onAuthStateChanged } = mod
        const auth = getAuth()
        unsub = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return
          if (!user) {
            setIdToken(null)
            setUserUid(null)
            setAuthInitError('Not authenticated')
            return
          }
          try {
            const t = await user.getIdToken()
            setIdToken(t)
            setUserUid(user.uid)
            setAuthInitError(null)
          } catch {
            try {
              const fresh = await user.getIdToken(true)
              setIdToken(fresh)
              setUserUid(user.uid)
              setAuthInitError(null)
            } catch (err: unknown) {
              setAuthInitError((err as { message?: string })?.message || 'Failed to init auth')
              setIdToken(null)
              setUserUid(null)
            }
          }
        })
      } catch (err: unknown) {
        if (!cancelled) {
          setAuthInitError((err as { message?: string })?.message || 'Initialization error')
          setIdToken(null)
          setUserUid(null)
        }
      }
    }

    void init()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [])

  // Prepare a possibly resolvable image URL if you have a known scheme.
  const thumbnailUrl = useMemo(() => {
    if (!listing?.thumbnail_id) return null
    // If your backend serves files by id, replace below with the correct path.
    // return `/api/v1/files/${listing.thumbnail_id}`
    return null
  }, [listing])

  // Load listing detail once we have a token
  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!listingId) return
      setLoading(true)
      setError(null)
      try {
        if (!idToken) {
          if (authInitError) throw new Error(authInitError)
          // wait for auth
          return
        }
        const detail = await fetchListingDetail(listingId, idToken)
        if (!mounted) return

        // Ownership check (client-side guard; server should also enforce)
        if (detail?.user_id && userUid && detail.user_id !== userUid) {
          setError('You do not have permission to manage this listing.')
          setListing(null)
          setLoading(false)
          return
        }

        setListing(detail)
        setEditForm({
          title: detail.title || '',
          description: detail.description || '',
          category: (detail.category ?? '') as ListingCategory | '',
          exchange_type: (detail.exchange_type ?? '') as ExchangeType | '',
          status: (detail.status ?? '') as ListingStatus | '',
          location: {
            country: detail.location?.country || '',
            state: detail.location?.state || '',
            suburb: detail.location?.suburb || '',
            postcode:
              typeof detail.location?.postcode === 'number'
                ? String(detail.location.postcode)
                : '',
          },
        })
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load listing')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [listingId, idToken, authInitError, userUid])

  useEffect(() => {
    let cancelled = false

    const loadInterestedUsers = async () => {
      if (!listingId) return
      if (!idToken) {
        if (authInitError && !cancelled) {
          setInterestedUsersError(authInitError)
          setInterestedUsers(null)
          setInterestedUsersLoading(false)
        }
        return
      }

      if (!cancelled) {
        setInterestedUsersLoading(true)
        setInterestedUsersError(null)
        setInterestedUsers(null)
      }

      try {
        const users = await fetchInterestedUsers(listingId, idToken)
        if (!cancelled) setInterestedUsers(users)
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load interested users'
          setInterestedUsersError(message)
          setInterestedUsers(null)
        }
      } finally {
        if (!cancelled) setInterestedUsersLoading(false)
      }
    }

    void loadInterestedUsers()
    return () => {
      cancelled = true
    }
  }, [listingId, idToken, authInitError])

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    if (name.startsWith('location.')) {
      const key = name.split('.')[1] as keyof ListingLocation
      setEditForm((prev) => ({
        ...prev,
        location: { ...prev.location, [key]: value } as EditFormState['location'],
      }))
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  const saveEdits = async () => {
    if (!listing || !listingId) return
    setSaving(true)
    setError(null)
    try {
      if (!idToken) throw new Error('You must be signed in to edit a listing.')

      // Coerce postcode to number iff present and numeric
      const postcodeNum =
        editForm.location.postcode.trim() !== '' ? Number(editForm.location.postcode) : undefined
      if (
        postcodeNum !== undefined &&
        (Number.isNaN(postcodeNum) || !Number.isFinite(postcodeNum))
      ) {
        throw new Error('Postcode must be a number.')
      }

      const rawLocation = {
        country: editForm.location.country,
        state: editForm.location.state,
        suburb: editForm.location.suburb,
        postcode: editForm.location.postcode,
      }

      const hasLocationInput = Object.values(rawLocation).some((val) => val.trim() !== '')

      const normalizedLocation: ListingLocation | undefined = hasLocationInput
        ? (() => {
            const normalized = normalizeListingLocation({
              ...rawLocation,
              postcode:
                postcodeNum ??
                (typeof listing.location?.postcode === 'number'
                  ? listing.location.postcode
                  : null),
            })

            if (
              !normalized.country ||
              !normalized.state ||
              !normalized.suburb ||
              normalized.postcode <= 0
            ) {
              throw new Error('Location requires country, state, suburb, and a positive postcode.')
            }

            return normalized
          })()
        : undefined

      const payload: PatchPayload = {
        title: (editForm.title || '').toLowerCase(),
        description: (editForm.description || '').toLowerCase(),
        category: editForm.category || undefined,
        exchange_type: editForm.exchange_type || undefined,
        status: editForm.status || undefined,
        country: normalizedLocation?.country,
        location: normalizedLocation,
      }

      await updateListing(idToken, listingId, payload)

      // Optimistic update locally
      setListing((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
              location: payload.location ? payload.location : prev.location,
              country: payload.country ?? prev.country,
            }
          : prev
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const fallbackInterestedIds: string[] =
    listing && Array.isArray(listing.interested_users_uids) ? listing.interested_users_uids : []
  const interestedCount = interestedUsers?.length ?? fallbackInterestedIds.length

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manage Listing</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-700 border px-3 py-1.5 rounded hover:bg-gray-50"
        >
          Back to My Listings
        </button>
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="mt-6 bg-red-100 text-red-800 p-3 rounded">{error}</div>
      ) : !listing ? (
        <div className="mt-6 text-sm text-gray-600">Listing not found.</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details & Edit */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border rounded p-4">
              <h2 className="text-lg font-semibold mb-3">Details</h2>

              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt={listing.title}
                  className="w-full h-48 object-cover rounded mb-3"
                />
              ) : null}

              <div className="text-sm text-gray-600">
                <div>
                  <span className="font-medium text-gray-800">Listing ID:</span> {listing.id}
                </div>
                {listing.location ? (
                  <div className="mt-1">
                    <span className="font-medium text-gray-800">Location:</span>{' '}
                    {[listing.location.suburb, listing.location.state, listing.location.country]
                      .filter(Boolean)
                      .join(', ')}
                    {typeof listing.location.postcode === 'number'
                      ? ` ${listing.location.postcode}`
                      : ''}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border rounded p-4">
              <h2 className="text-lg font-semibold mb-3">Edit listing</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    name="title"
                    value={editForm.title}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                    placeholder="Title"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    value={editForm.description}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                    rows={4}
                    placeholder="Describe your item/offer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    name="category"
                    value={editForm.category}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select Category</option>
                    {LISTING_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Exchange Type</label>
                  <select
                    name="exchange_type"
                    value={editForm.exchange_type}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select Exchange Type</option>
                    {EXCHANGE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    name="status"
                    value={editForm.status || 'available'}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  >
                    {LISTING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm font-medium mb-2">Location (optional)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input
                      name="location.country"
                      value={editForm.location.country}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="Country"
                    />
                    <input
                      name="location.state"
                      value={editForm.location.state}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="State"
                    />
                    <input
                      name="location.suburb"
                      value={editForm.location.suburb}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="Suburb"
                    />
                    <input
                      name="location.postcode"
                      value={editForm.location.postcode}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="Postcode"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => router.push('/dashboard/listings')}
                  className="px-4 py-2 rounded border"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdits}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Interest */}
          <div className="space-y-4">
            <div className="border rounded p-4">
              <h2 className="text-lg font-semibold">Interest</h2>
              <p className="text-sm text-gray-700 mt-1">
                Interested users: <span className="font-medium">{interestedCount}</span>
              </p>

              {interestedUsersLoading ? (
                <div className="mt-3 text-xs text-gray-500">Loading interested users…</div>
              ) : interestedUsersError ? (
                <div className="mt-3 text-xs text-red-600">{interestedUsersError}</div>
              ) : interestedUsers && interestedUsers.length ? (
                <div className="mt-3 space-y-2">
                  {interestedUsers.map(({ uid, name, email }) => (
                    <div
                      key={uid}
                      className="flex items-center justify-between bg-white border rounded p-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{name || 'Unnamed user'}</div>
                        <div className="text-xs text-gray-500">{email || `UID: ${uid}`}</div>
                      </div>
                      <div className="text-xs text-gray-500">interested</div>
                    </div>
                  ))}
                </div>
              ) : fallbackInterestedIds.length ? (
                <div className="mt-3 space-y-2">
                  {fallbackInterestedIds.map((uid) => (
                    <div
                      key={uid}
                      className="flex items-center justify-between bg-white border rounded p-2 text-sm"
                    >
                      <div className="font-medium">{uid}</div>
                      <div className="text-xs text-gray-500">interested</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-500">No interest yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
