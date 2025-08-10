"use client";

import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState } from "react";
// Note: dynamic import of firebase/auth is intentional for SSR safety and bundle splitting.

// Minimal shape expected from GET /api/v1/listings/user
// Adjust fields as your API evolves.
type Listing = {
  id: string;
  title?: string;
  description?: string;
  image_urls?: string[];
  interested_user_count?: number;
  has_registered_interest?: boolean;
  [key: string]: any;
};

export default function Dashboard() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false

    const init = async () => {
      try {
        const mod = await import('firebase/auth').catch(() => null)
        if (!mod) {
          // Fallback: try localStorage token only
          const idToken = typeof window !== 'undefined' ? (localStorage.getItem('idToken') || localStorage.getItem('token')) : null
          if (!idToken) {
            if (!cancelled) {
              setLoading(false)
              setError('Missing token')
              setListings([])
            }
            return
          }
          await fetchWithToken(idToken)
          return
        }

        const { getAuth, onAuthStateChanged } = mod
        const auth = getAuth()

        unsub = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return
          if (!user) {
            // AuthGuard likely handles redirect/visibility; just stop loading here
            setLoading(false)
            setError('Not authenticated')
            setListings([])
            return
          }
          try {
            const idToken = await user.getIdToken()
            await fetchWithToken(idToken)
          } catch (e) {
            // Retry with forced refresh if first attempt fails
            try {
              const fresh = await user.getIdToken(true)
              await fetchWithToken(fresh)
            } catch (err) {
              if (!cancelled) {
                setLoading(false)
                setError((err as any)?.message || 'Failed to load listings')
                setListings([])
              }
            }
          }
        })
      } catch (err: any) {
        if (!cancelled) {
          setLoading(false)
          setError(err?.message || 'Initialization error')
          setListings([])
        }
      }
    }

    const fetchWithToken = async (token: string) => {
      const res = await fetch('/api/v1/listings/user', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (res.status === 401) {
        throw new Error('Unauthorized')
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Request failed with ${res.status}`)
      }

      const data = await res.json()
      if (!cancelled) {
        setListings(Array.isArray(data?.listings) ? data.listings : [])
        setError(null)
        setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [])

  return (
    <AuthGuard>
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 py-4 px-4">
        {/* Header Text */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            You’ll see your listings and claims here.
          </p>
        </div>

        {/* Logout Button */}
        <Link
          href="/logout"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow hover:bg-green-700 transition-colors"
        >
          Logout
        </Link>
      </section>

      {/* Your Listings */}
      <section className="px-4 pb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Your listings</h3>

        {loading ? (
          <div className="text-sm text-gray-600">Loading your listings…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : listings && listings.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <li key={l.id} className="border rounded-md overflow-hidden bg-white shadow-sm">
                {Array.isArray(l.image_urls) && l.image_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image_urls[0]} alt={l.title || l.id} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    No image
                  </div>
                )}
                <div className="p-3 space-y-1">
                  <div className="font-medium text-gray-900 truncate">{l.title || `Listing ${l.id}`}</div>
                  {l.description ? (
                    <p className="text-sm text-gray-600 line-clamp-2">{l.description}</p>
                  ) : null}
                  <div className="flex items-center gap-3 text-xs text-gray-600 pt-1">
                    {(() => {
                      const raw = l.interested_user_count ?? 0;
                      const adjusted = Math.max(0, raw - (l.has_registered_interest ? 1 : 0));
                      return <span>Interested: {adjusted}</span>;
                    })()}
                  </div>
                </div>
                <div className="p-3 pt-0 border-t bg-gray-50 flex items-center gap-2">
                  <Link
                    href={`/listings/${l.id}`}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/listings/${l.id}`}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                  >
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-600">You have no listings yet.</div>
        )}
      </section>

      {/* Subscribed / Interested Listings - Placeholder */}
      <section className="px-4 pb-12">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Subscribed / Interested</h3>
        <div className="border border-dashed rounded-md p-4 bg-gray-50 text-sm text-gray-700">
          Placeholder: we’ll show listings you’ve registered interest in here.
          <div className="mt-2 text-xs text-gray-500">
            Implementation hint: add an endpoint like <code>/api/v1/listings/interested</code>
            (or a query to <code>listings</code> where <code>interested_users_uids</code> contains current uid),
            then render them similarly to the grid above.
          </div>
        </div>
      </section>
    </AuthGuard>
  );
}