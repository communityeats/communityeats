
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Minimal listing shape returned by GET /api/v1/listing/[id]
type Listing = {
  id: string
  title: string
  description: string
  category: string
  exchange_type: string
  status?: 'available' | 'claimed' | 'closed'
  created_at?: string | number | Date
  image_urls?: string[]
  thumbnail_url?: string | null
  user_id?: string
  location?: {
    country?: string
    state?: string
    suburb?: string
    postcode?: number | string
  }
  interested_user_count?: number
  has_registered_interest?: boolean
  interested_user_ids?: string[] // (owner-only when backend exposes)
}

type PatchPayload = Partial<Pick<
  Listing,
  'title' | 'description' | 'category' | 'exchange_type' | 'status'
>> & {
  location?: Listing['location']
}

// ---- API helpers
async function fetchListingDetail(id: string, token: string) {
  const res = await fetch(`/api/v1/listings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to fetch listing ${id}`)
  }
  return res.json()
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
    throw new Error(body.error || 'Failed to update listing.')
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
  const [listing, setListing] = useState<Listing | null>(null)

  // Edit form
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<PatchPayload>({
    title: '',
    description: '',
    category: '',
    exchange_type: '',
    status: 'available',
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
          const local = typeof window !== 'undefined'
            ? (localStorage.getItem('idToken') || localStorage.getItem('token'))
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
            } catch (err: any) {
              setAuthInitError(err?.message || 'Failed to init auth')
              setIdToken(null)
              setUserUid(null)
            }
          }
        })
      } catch (err: any) {
        if (!cancelled) {
          setAuthInitError(err?.message || 'Initialization error')
          setIdToken(null)
          setUserUid(null)
        }
      }
    }

    init()
    return () => { cancelled = true; if (unsub) unsub() }
  }, [])

  // Load listing detail once we have a token
  useEffect(() => {
    let mounted = true
    ;(async () => {
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
          category: detail.category || '',
          exchange_type: detail.exchange_type || '',
          status: (detail.status as any) || 'available',
          location: {
            country: detail.location?.country || '',
            state: detail.location?.state || '',
            suburb: detail.location?.suburb || '',
            postcode: detail.location?.postcode?.toString?.() || '',
          },
        })
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load listing')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [listingId, idToken, authInitError, userUid])

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    if (name.startsWith('location.')) {
      const key = name.split('.')[1] as keyof NonNullable<PatchPayload['location']>
      setEditForm(prev => ({ ...prev, location: { ...(prev.location || {}), [key]: value } }))
    } else {
      setEditForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const saveEdits = async () => {
    if (!listing || !listingId) return
    setSaving(true)
    setError(null)
    try {
      if (!idToken) throw new Error('You must be signed in to edit a listing.')

      const payload: PatchPayload = {
        title: (editForm.title || '').toLowerCase(),
        description: (editForm.description || '').toLowerCase(),
        category: editForm.category || '',
        exchange_type: editForm.exchange_type || '',
        status: (editForm.status as any) || 'available',
        location: {
          country: (editForm.location?.country || '').toLowerCase(),
          state: (editForm.location?.state || '').toLowerCase(),
          suburb: (editForm.location?.suburb || '').toLowerCase(),
          postcode: editForm.location?.postcode ? Number(editForm.location.postcode) : undefined,
        },
      }

      await updateListing(idToken, listingId, payload)

      // Optimistic update locally
      setListing(prev => prev ? {
        ...prev,
        ...payload,
        location: { ...prev.location, ...payload.location },
      } : prev)
    } catch (e: any) {
      setError(e?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const interestedCount = listing?.interested_user_count ?? 0
  const interestedIds = listing?.interested_user_ids || []

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
              {listing.image_urls?.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.image_urls[0] as string}
                  alt={listing.title}
                  className="w-full h-48 object-cover rounded mb-3"
                />
              ) : null}
              <div className="text-sm text-gray-600">
                <div><span className="font-medium text-gray-800">Listing ID:</span> {listing.id}</div>
                {listing.location ? (
                  <div className="mt-1">
                    <span className="font-medium text-gray-800">Location:</span>{' '}
                    {[listing.location.suburb, listing.location.state, listing.location.country]
                      .filter(Boolean)
                      .join(', ')}
                    {listing.location.postcode ? ` ${listing.location.postcode}` : ''}
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
                    value={editForm.title || ''}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                    placeholder="Title"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    value={editForm.description || ''}
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
                    value={editForm.category || ''}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select Category</option>
                    <option value="home">home</option>
                    <option value="share">share</option>
                    <option value="coop">coop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Exchange Type</label>
                  <select
                    name="exchange_type"
                    value={editForm.exchange_type || ''}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select Exchange Type</option>
                    <option value="swap">swap</option>
                    <option value="gift">gift</option>
                    <option value="pay">pay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    name="status"
                    value={(editForm.status as string) || 'available'}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="available">available</option>
                    <option value="claimed">claimed</option>
                    <option value="closed">closed</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm font-medium mb-2">Location (optional)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input
                      name="location.country"
                      value={editForm.location?.country || ''}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="Country"
                    />
                    <input
                      name="location.state"
                      value={editForm.location?.state || ''}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="State"
                    />
                    <input
                      name="location.suburb"
                      value={editForm.location?.suburb || ''}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="Suburb"
                    />
                    <input
                      name="location.postcode"
                      value={editForm.location?.postcode?.toString() || ''}
                      onChange={handleEditChange}
                      className="p-2 border rounded"
                      placeholder="Postcode"
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

              {interestedIds.length ? (
                <div className="mt-3 space-y-2">
                  {interestedIds.map(uid => (
                    <div key={uid} className="flex items-center justify-between bg-white border rounded p-2 text-sm">
                      <div className="font-medium">{uid}</div>
                      <div className="text-xs text-gray-500">interested</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-500">
                  {interestedCount > 0
                    ? 'Your API currently returns a count but not the list of users. Once the server exposes interested_users_uids for owners, they’ll appear here.'
                    : 'No interest yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
