"use client";

import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState } from "react";

// Minimal shape expected from GET /api/v1/listings/user and /api/v1/listings/interested
type Listing = {
  id: string;
  title?: string;
  description?: string;
  image_urls?: string[];
  // interested route may return these instead of image_urls
  image_ids?: string[];
  thumbnail_id?: string | null;
  interested_user_count?: number;
  has_registered_interest?: boolean;
  [key: string]: any;
};

type InterestedResponse = {
  success: boolean;
  listings: Listing[];
  next_cursor: null | {
    cursor_created_at: string | null;
    cursor_id: string;
  };
};

export default function Dashboard() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Interested state
  const [interested, setInterested] = useState<Listing[] | null>(null);
  const [interestedLoading, setInterestedLoading] = useState<boolean>(true);
  const [interestedError, setInterestedError] = useState<string | null>(null);
  const [interestedNextCursor, setInterestedNextCursor] = useState<InterestedResponse["next_cursor"]>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const mod = await import("firebase/auth").catch(() => null);
        if (!mod) {
          const idToken =
            typeof window !== "undefined"
              ? localStorage.getItem("idToken") || localStorage.getItem("token")
              : null;
          if (!idToken) {
            if (!cancelled) {
              setLoading(false);
              setError("Missing token");
              setListings([]);
              setInterestedLoading(false);
              setInterestedError("Missing token");
              setInterested([]);
            }
            return;
          }
          await Promise.all([fetchUserListings(idToken), fetchInterested(idToken)]);
          return;
        }

        const { getAuth, onAuthStateChanged } = mod;
        const auth = getAuth();

        unsub = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return;
          if (!user) {
            setLoading(false);
            setError("Not authenticated");
            setListings([]);
            setInterestedLoading(false);
            setInterestedError("Not authenticated");
            setInterested([]);
            return;
          }
          try {
            const idToken = await user.getIdToken();
            await Promise.all([fetchUserListings(idToken), fetchInterested(idToken)]);
          } catch {
            try {
              const fresh = await user.getIdToken(true);
              await Promise.all([fetchUserListings(fresh), fetchInterested(fresh)]);
            } catch (err) {
              if (!cancelled) {
                const msg = (err as any)?.message || "Failed to initialize";
                setLoading(false);
                setError(msg);
                setListings([]);
                setInterestedLoading(false);
                setInterestedError(msg);
                setInterested([]);
              }
            }
          }
        });
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || "Initialization error";
          setLoading(false);
          setError(msg);
          setListings([]);
          setInterestedLoading(false);
          setInterestedError(msg);
          setInterested([]);
        }
      }
    };

    // ---- Helpers
    const fetchUserListings = async (token: string) => {
      const res = await fetch("/api/v1/listings/user", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed with ${res.status}`);
      }

      const data = await res.json();
      if (!cancelled) {
        setListings(Array.isArray(data?.listings) ? data.listings : []);
        setError(null);
        setLoading(false);
      }
    };

    const fetchInterested = async (
      token: string,
      cursor?: InterestedResponse["next_cursor"]
    ) => {
      setInterestedLoading(true);

      const params = new URLSearchParams();
      params.set("limit", "20");
      if (cursor?.cursor_created_at) params.set("cursor_created_at", cursor.cursor_created_at);
      if (cursor?.cursor_id) params.set("cursor_id", cursor.cursor_id);

      const res = await fetch(`/api/v1/listings/user/interested?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.status === 401) throw new Error("Unauthorized");
      const body = (await res.json().catch(() => ({}))) as Partial<InterestedResponse>;

      if (!res.ok || body?.success === false) {
        throw new Error((body as any)?.error || `Request failed with ${res.status}`);
      }

      const page = body as InterestedResponse;
      if (!cancelled) {
        setInterested((prev) => ([...(prev ?? []), ...(page.listings ?? [])]));
        setInterestedNextCursor(page.next_cursor ?? null);
        setInterestedError(null);
        setInterestedLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  // ---- Render helpers
  const renderListingCardOwned = (l: Listing) => {
    // Prefer image_urls[0]; otherwise fallback to "No image".
    const img = Array.isArray(l.image_urls) && l.image_urls[0] ? l.image_urls[0] : null;

    const interestedRaw = l.interested_user_count ?? 0;
    const interestedAdjusted = Math.max(0, interestedRaw - (l.has_registered_interest ? 1 : 0));

    return (
      <li key={l.id} className="border rounded-md overflow-hidden bg-white shadow-sm">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={l.title || l.id} className="w-full h-40 object-cover" />
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
            <span>Interested: {interestedAdjusted}</span>
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
    );
  };

  const renderListingCardSubscribed = (l: Listing) => {
    // Prefer image_urls[0]; otherwise fallback to "No image".
    const img = Array.isArray(l.image_urls) && l.image_urls[0] ? l.image_urls[0] : null;

    const interestedRaw = l.interested_user_count ?? 0;
    const interestedAdjusted = Math.max(0, interestedRaw - (l.has_registered_interest ? 1 : 0));

    return (
      <li key={l.id} className="border rounded-md overflow-hidden bg-white shadow-sm">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={l.title || l.id} className="w-full h-40 object-cover" />
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
            <span>Others Interested: {interestedAdjusted}</span>
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
            href={`/messages/${l.id}`}
            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            Message Owner
          </Link>
        </div>
      </li>
    );
  };

  return (
    <AuthGuard>
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 py-4 px-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            You’ll see your listings and claims here.
          </p>
        </div>

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
            {listings.map((l) => renderListingCardOwned(l))}
          </ul>
        ) : (
          <div className="text-sm text-gray-600">You have no listings yet.</div>
        )}
      </section>

      {/* Subscribed / Interested Listings */}
      <section className="px-4 pb-12">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Subscribed / Interested</h3>

        {interestedLoading && (interested ?? []).length === 0 ? (
          <div className="text-sm text-gray-600">Loading interested listings…</div>
        ) : interestedError ? (
          <div className="text-sm text-red-600">{interestedError}</div>
        ) : interested && interested.length > 0 ? (
          <>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {interested.map((l) => renderListingCardSubscribed(l))}
            </ul>

            {/* Pagination */}
            <div className="mt-4">
              {interestedNextCursor ? (
                <LoadMoreInterested onClick={async () => {
                  try {
                    // Acquire a fresh token via firebase/auth if present; else use localStorage.
                    const mod = await import("firebase/auth").catch(() => null);
                    let token: string | null = null;
                    if (mod) {
                      const { getAuth } = mod;
                      const auth = getAuth();
                      token = auth.currentUser
                        ? await auth.currentUser.getIdToken().catch(() => null)
                        : null;
                    }
                    if (!token && typeof window !== "undefined") {
                      token = localStorage.getItem("idToken") || localStorage.getItem("token");
                    }
                    if (!token) {
                      throw new Error("Missing token");
                    }

                    // Fire the same endpoint with cursor.
                    const params = new URLSearchParams();
                    params.set("limit", "20");
                    if (interestedNextCursor?.cursor_created_at)
                      params.set("cursor_created_at", interestedNextCursor.cursor_created_at);
                    if (interestedNextCursor?.cursor_id)
                      params.set("cursor_id", interestedNextCursor.cursor_id);

                    const res = await fetch(`/api/v1/listings/interested?${params.toString()}`, {
                      headers: { Authorization: `Bearer ${token}` },
                      cache: "no-store",
                    });

                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      throw new Error(body?.error || `Request failed with ${res.status}`);
                    }

                    const page = (await res.json()) as InterestedResponse;
                    setInterested((prev) => ([...(prev ?? []), ...(page.listings ?? [])]));
                    setInterestedNextCursor(page.next_cursor ?? null);
                    setInterestedError(null);
                  } catch (err: any) {
                    setInterestedError(err?.message || "Failed to load more");
                  }
                }} loading={interestedLoading} />
              ) : null}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-600">You haven’t registered interest in any listings yet.</div>
        )}
      </section>
    </AuthGuard>
  );
}

// Simple “Load more” button component to keep JSX tidy.
function LoadMoreInterested({
  onClick,
  loading,
}: {
  onClick: () => void | Promise<void>;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors disabled:opacity-60"
    >
      {loading ? "Loading…" : "Load more"}
    </button>
  );
}