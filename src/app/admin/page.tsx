'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { LISTING_STATUSES, type ListingStatus } from '@/lib/types/listing'

type AdminListing = {
  id: string
  title: string
  status: ListingStatus | string
  exchange_type: string | null
  user_id: string | null
  created_at: string | null
  location_label: string | null
  interested_count: number
}

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

const prettyStatus: Record<ListingStatus, string> = {
  available: 'Available',
  claimed: 'Claimed',
  removed: 'Removed',
}

export default function AdminBoard() {
  const router = useRouter()
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [listings, setListings] = useState<AdminListing[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchListings = useCallback(
    async (token: string) => {
      setTableLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/v1/admin/listings?limit=100', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        const body = (await res.json().catch(() => ({}))) as { listings?: AdminListing[]; error?: string }
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to load listings')
        }

        const rows = Array.isArray(body.listings) ? body.listings : []
        setListings(rows)
      } catch (err: unknown) {
        setListings([])
        setError((err as { message?: string })?.message || 'Unable to load listings')
      } finally {
        setTableLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    let cancelled = false

    const unsub = onAuthStateChanged(auth, (user) => {
      if (cancelled) return

      if (!user) {
        setIdToken(null)
        setAdminEmail(null)
        setListings([])
        setLoadingAuth(false)
        router.replace('/admin/login')
        return
      }

      ;(async () => {
        setLoadingAuth(true)
        try {
          const token = await user.getIdToken()
          const res = await fetch('/api/v1/admin/verify', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const body = (await res.json().catch(() => ({}))) as { email?: string; error?: string }

          if (!res.ok) {
            throw new Error(body?.error || 'Not authorized')
          }

          if (cancelled) return
          setIdToken(token)
          setAdminEmail(body.email ?? user.email ?? null)
          await fetchListings(token)
        } catch (err: unknown) {
          if (cancelled) return
          setError((err as { message?: string })?.message || 'Not authorized')
          await signOut(auth).catch(() => null)
          router.replace('/admin/login?error=unauthorized')
        } finally {
          if (!cancelled) setLoadingAuth(false)
        }
      })()
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [fetchListings, router])

  const handleRefresh = () => {
    if (idToken) {
      void fetchListings(idToken)
    }
  }

  const handleStatusChange = async (listingId: string, nextStatus: ListingStatus) => {
    if (!idToken) return

    setSavingId(listingId)
    setError(null)

    try {
      const res = await fetch('/api/v1/admin/listings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ id: listingId, status: nextStatus }),
      })

      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to update listing')
      }

      setListings((prev) =>
        prev.map((item) => (item.id === listingId ? { ...item, status: nextStatus } : item))
      )
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Unable to update listing')
    } finally {
      setSavingId(null)
    }
  }

  const statusTotals = useMemo(() => {
    const totals: Record<ListingStatus, number> = { available: 0, claimed: 0, removed: 0 }
    for (const item of listings) {
      if (LISTING_STATUSES.includes(item.status as ListingStatus)) {
        totals[item.status as ListingStatus] += 1
      }
    }
    return totals
  }, [listings])

  if (loadingAuth) {
    return (
      <div className="py-12 text-center text-gray-700">
        <p className="text-sm">Checking admin access…</p>
      </div>
    )
  }

  return (
    <section className="py-10 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Admin board</p>
          <h1 className="text-2xl font-bold text-gray-900">Listings overview</h1>
          {adminEmail && <p className="text-sm text-gray-600">Signed in as {adminEmail}</p>}
          <p className="text-xs text-gray-500">
            Hidden from public navigation. Share this link only with trusted admins.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={!idToken || tableLoading}
            className="px-4 py-2 rounded-md border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {tableLoading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => {
              void signOut(auth)
              router.replace('/admin/login')
            }}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(LISTING_STATUSES as ListingStatus[]).map((status) => (
          <div
            key={status}
            className="border border-emerald-100 bg-white rounded-lg p-4 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                {prettyStatus[status]}
              </p>
              <p className="text-lg font-semibold text-gray-900">{statusTotals[status]}</p>
            </div>
            <span className="text-sm text-gray-500">{status}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent listings</h2>
          <p className="text-sm text-gray-500">{listings.length} loaded</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Title</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Location</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Interested</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Created</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 capitalize">
                        {item.title || 'Untitled'}
                      </span>
                      <span className="text-xs text-gray-500">{item.exchange_type || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={LISTING_STATUSES.includes(item.status as ListingStatus) ? item.status : 'available'}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as ListingStatus)}
                      disabled={savingId === item.id || tableLoading}
                      className="border rounded-md px-2 py-1 text-sm focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60"
                    >
                      {(LISTING_STATUSES as ListingStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {prettyStatus[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.location_label || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.interested_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3 text-gray-700">{item.user_id || '—'}</td>
                </tr>
              ))}

              {!tableLoading && listings.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500 text-sm" colSpan={6}>
                    No listings found.
                  </td>
                </tr>
              )}

              {tableLoading && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500 text-sm" colSpan={6}>
                    Loading listings…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
