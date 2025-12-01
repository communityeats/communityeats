'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { ensureConversation } from '@/lib/api/chat';
import type { ListingDoc } from '@/lib/types/listing';

type ListingUserResponse = ListingDoc & {
  image_urls: string[];
  interested_user_count: number;
};

type InterestedResponse = {
  success: boolean;
  listings: ListingUserResponse[];
  next_cursor: null | {
    cursor_created_at: string | null;
    cursor_id: string;
  };
};

export default function Dashboard() {
  const ITEMS_PER_PAGE = 6;
  const router = useRouter();
  const [activeListings, setActiveListings] = useState<ListingDoc[] | null>(null);
  const [activeLoading, setActiveLoading] = useState<boolean>(true);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activeVisibleCount, setActiveVisibleCount] = useState<number>(ITEMS_PER_PAGE);

  const [claimedListings, setClaimedListings] = useState<ListingDoc[] | null>(null);
  const [claimedLoading, setClaimedLoading] = useState<boolean>(false);
  const [claimedError, setClaimedError] = useState<string | null>(null);
  const [claimedVisibleCount, setClaimedVisibleCount] = useState<number>(ITEMS_PER_PAGE);

  // ---- Interested state
  const [interested, setInterested] = useState<ListingDoc[] | null>(null);
  const [interestedLoading, setInterestedLoading] = useState<boolean>(true);
  const [interestedError, setInterestedError] = useState<string | null>(null);
  const [interestedNextCursor, setInterestedNextCursor] =
    useState<InterestedResponse['next_cursor']>(null);

  // Track current user UID to compute “others interested”
  const [userUid, setUserUid] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messagingListingId, setMessagingListingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);
  const [claimFeedbackIsError, setClaimFeedbackIsError] = useState(false);
  const [showActiveListings, setShowActiveListings] = useState(true);
  const [showSubscribedListings, setShowSubscribedListings] = useState(true);
  const [showClaimedListings, setShowClaimedListings] = useState(false);
  const cancelledRef = useRef(false);

  const fetchUserListings = useCallback(
    async (token: string, status: 'available' | 'claimed') => {
      if (status === 'available') {
        setActiveLoading(true);
        setActiveError(null);
      } else {
        setClaimedLoading(true);
        setClaimedError(null);
      }

    const params = new URLSearchParams();
    params.set('status', status);

    try {
      const res = await fetch(`/api/v1/listings/user?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (res.status === 401) throw new Error('Unauthorized');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || `Request failed with ${res.status}`);
      }

      const data = await res.json();
      if (!cancelledRef.current) {
        const items = Array.isArray(data?.listings) ? (data.listings as ListingDoc[]) : [];
        if (status === 'available') {
          setActiveListings(items);
          setActiveVisibleCount(ITEMS_PER_PAGE);
          setActiveError(null);
          setActiveLoading(false);
        } else {
          setClaimedListings(items);
          setClaimedVisibleCount(ITEMS_PER_PAGE);
          setClaimedError(null);
          setClaimedLoading(false);
        }
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Failed to load listings';
      if (!cancelledRef.current) {
        if (status === 'available') {
          setActiveError(message);
          setActiveListings([]);
          setActiveLoading(false);
        } else {
          setClaimedError(message);
          setClaimedListings([]);
          setClaimedLoading(false);
        }
      }
    }
  },
  []
);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    cancelledRef.current = false;

    const init = async () => {
      try {
        const mod = await import('firebase/auth').catch(() => null);
        if (!mod) {
          const idToken =
            typeof window !== 'undefined'
              ? localStorage.getItem('idToken') || localStorage.getItem('token')
              : null;
          if (!idToken) {
            if (!cancelledRef.current) {
              setActiveLoading(false);
              setActiveError('Missing token');
              setActiveListings([]);
              setClaimedLoading(false);
              setClaimedError('Missing token');
              setClaimedListings([]);
              setInterestedLoading(false);
              setInterestedError('Missing token');
              setInterested([]);
            }
            return;
          }
          setIdToken(idToken);
          await Promise.all([fetchUserListings(idToken, 'available'), fetchInterested(idToken)]);
          return;
        }

        const { getAuth, onAuthStateChanged } = mod;
        const auth = getAuth();

          unsub = onAuthStateChanged(auth, async (user) => {
            if (cancelledRef.current) return;
            if (!user) {
              setUserUid(null);
              setIdToken(null);
              setActiveLoading(false);
              setActiveError('Not authenticated');
              setActiveListings([]);
              setClaimedLoading(false);
              setClaimedError('Not authenticated');
              setClaimedListings([]);
              setInterestedLoading(false);
              setInterestedError('Not authenticated');
              setInterested([]);
              return;
            }
            try {
              const idToken = await user.getIdToken();
              setUserUid(user.uid);
              setIdToken(idToken);
              await Promise.all([fetchUserListings(idToken, 'available'), fetchInterested(idToken)]);
            } catch {
              try {
                const fresh = await user.getIdToken(true);
                setUserUid(user.uid);
                setIdToken(fresh);
                await Promise.all([
                  fetchUserListings(fresh, 'available'),
                  fetchInterested(fresh),
                ]);
              } catch (err) {
                if (!cancelledRef.current) {
                  const msg = (err as { message?: string })?.message || 'Failed to initialize';
                  setActiveLoading(false);
                  setActiveError(msg);
                  setActiveListings([]);
                  setClaimedLoading(false);
                  setClaimedError(msg);
                  setClaimedListings([]);
                  setInterestedLoading(false);
                  setInterestedError(msg);
                  setInterested([]);
                }
              }
            }
          });
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          const message = (err as { message?: string })?.message || 'Initialization error';
          setActiveLoading(false);
          setActiveError(message);
          setActiveListings([]);
          setClaimedLoading(false);
          setClaimedError(message);
          setClaimedListings([]);
          setInterestedLoading(false);
          setInterestedError(message);
          setInterested([]);
        }
      }
    };

    // ---- Helpers
    const fetchInterested = async (
      token: string,
      cursor?: InterestedResponse['next_cursor']
    ) => {
      setInterestedLoading(true);

      const params = new URLSearchParams();
      params.set('limit', ITEMS_PER_PAGE.toString());
      if (cursor?.cursor_created_at) params.set('cursor_created_at', cursor.cursor_created_at);
      if (cursor?.cursor_id) params.set('cursor_id', cursor.cursor_id);

      const res = await fetch(
        `/api/v1/listings/user/interested?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );

      if (res.status === 401) throw new Error('Unauthorized');
      const body = (await res.json().catch(() => ({}))) as Partial<InterestedResponse>;

      if (!res.ok || body?.success === false) {
        throw new Error((body as { error?: string })?.error || `Request failed with ${res.status}`);
      }

      const page = body as InterestedResponse;
      if (!cancelledRef.current) {
        const activeListings = (page.listings ?? []).filter((item) => item.status === 'available');
        setInterested((prev) => [...(prev ?? []), ...activeListings]);
        setInterestedNextCursor(page.next_cursor ?? null);
        setInterestedError(null);
        setInterestedLoading(false);
      }
    };

    void init();

    return () => {
      cancelledRef.current = true;
      if (unsub) unsub();
    };
  }, [fetchUserListings]);

  useEffect(() => {
    if (!showClaimedListings || claimedListings !== null || !idToken || claimedLoading) return;
    void fetchUserListings(idToken, 'claimed');
  }, [claimedListings, claimedLoading, fetchUserListings, idToken, showClaimedListings]);

  const startConversationForListing = async (listingId: string) => {
    if (!idToken) {
      router.push(`/login?redirect=/dashboard`);
      return;
    }

    setMessagingListingId(listingId);
    setMessageError(null);
    try {
      const conversation = await ensureConversation({ token: idToken, listingId });
      router.push(`/messages?conversation=${conversation.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open conversation';
      setMessageError(message);
    } finally {
      setMessagingListingId(null);
    }
  };

  const markListingClaimed = async (listingId: string) => {
    if (!idToken) {
      router.push(`/login?redirect=/dashboard`);
      return;
    }

    setClaimingId(listingId);
    setClaimFeedback(null);
    setClaimFeedbackIsError(false);

    try {
      const res = await fetch('/api/v1/listings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ id: listingId, status: 'claimed' }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed with ${res.status}`);
      }

      const movedListing =
        activeListings?.find((l) => l.id === listingId) ??
        claimedListings?.find((l) => l.id === listingId) ??
        null;

      setActiveListings((prev) =>
        prev?.filter((l) => l.id !== listingId) ?? prev
      );
      setClaimedListings((prev) => {
        const base = prev ?? [];
        const existingIndex = base.findIndex((l) => l.id === listingId);
        const updated = movedListing ? ({ ...movedListing, status: 'claimed' } as ListingDoc) : null;
        if (!updated) return base;
        if (existingIndex >= 0) {
          const next = [...base];
          next[existingIndex] = updated;
          return next;
        }
        return [updated, ...base];
      });
      setClaimedVisibleCount((prev) => Math.max(prev, ITEMS_PER_PAGE));
      setClaimFeedback('Marked listing as claimed.');
      setClaimFeedbackIsError(false);
    } catch (err: unknown) {
      setClaimFeedback(err instanceof Error ? err.message : 'Failed to mark listing as claimed');
      setClaimFeedbackIsError(true);
    } finally {
      setClaimingId(null);
    }
  };

  // ---- Render helpers
  // ---- Render helpers (SYNC)
const renderListingCardOwned = (l: ListingUserResponse) => {
  const firstImageId = Array.isArray(l.image_urls) && l.image_urls[0] ? l.image_urls[0] : null;
  const img = firstImageId;

  const interestedCount = Array.isArray(l.interested_users_uids)
    ? l.interested_users_uids.length
    : 0;
  const isClaimed = l.status === 'claimed';

  return (
    <li key={l.id} className="border rounded-md overflow-hidden bg-white shadow-sm">
      {img ? (
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
          <span>Interested: {interestedCount}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              isClaimed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isClaimed ? 'Claimed' : 'Available'}
          </span>
        </div>
      </div>
      <div className="p-3 pt-0 border-t bg-gray-50 flex items-center gap-2">
        <Link href={`/listings/${l.id}`} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors">
          View
        </Link>
        <Link href={`/dashboard/listings/${l.id}`} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors">
          Manage
        </Link>
        <button
          type="button"
          onClick={() => void markListingClaimed(l.id)}
          disabled={isClaimed || claimingId === l.id}
          className={`inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isClaimed
              ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60'
          }`}
        >
          {isClaimed ? 'Claimed' : claimingId === l.id ? 'Marking…' : 'Confirm claimed'}
        </button>
      </div>
    </li>
  );
};

const renderListingCardSubscribed = (l: ListingUserResponse) => {
  const firstImageId = Array.isArray(l.image_urls) && l.image_urls[0] ? l.image_urls[0] : null;
  const img = firstImageId;

  const rawCount = l.interested_user_count;
  const hasSelf = !!userUid && Array.isArray(l.interested_users_uids)
    ? l.interested_users_uids.includes(userUid)
    : false;
  const othersInterested = Math.max(0, rawCount - (hasSelf ? 1 : 0));

  return (
    <li key={l.id} className="border rounded-md overflow-hidden bg-white shadow-sm">
      {img ? (
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
          <span>Others Interested: {othersInterested}</span>
        </div>
      </div>
      <div className="p-3 pt-0 border-t bg-gray-50 flex items-center gap-2">
        <Link href={`/listings/${l.id}`} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors">
          View
        </Link>
        <button
          type="button"
          onClick={() => void startConversationForListing(l.id)}
          disabled={messagingListingId === l.id}
          className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {messagingListingId === l.id ? 'Opening…' : 'Message Owner'}
        </button>
      </div>
    </li>
  );
};

const SectionToggle = ({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
  >
    <span>{open ? 'Hide' : 'Show'}</span>
    <span aria-hidden="true">{open ? '▾' : '▸'}</span>
    <span className="sr-only">{label}</span>
  </button>
);

  return (
    <AuthGuard>
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 py-4 px-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">You’ll see your listings and claims here.</p>
        </div>

        <Link
          href="/logout"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow hover:bg-green-700 transition-colors"
        >
          Logout
        </Link>
      </section>

      {/* Your Active Listings */}
      <section className="px-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Your Active Listings</h3>
          <SectionToggle
            label="Toggle active listings"
            open={showActiveListings}
            onToggle={() => setShowActiveListings((prev) => !prev)}
          />
        </div>

        {showActiveListings ? (
          activeLoading ? (
            <div className="text-sm text-gray-600">Loading your listings…</div>
          ) : activeError ? (
            <div className="text-sm text-red-600">{activeError}</div>
          ) : activeListings && activeListings.length > 0 ? (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeListings
                  .slice(0, activeVisibleCount)
                  .map((l) => renderListingCardOwned(l as ListingUserResponse))}
              </ul>
              {activeListings.length > activeVisibleCount ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setActiveVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Load {ITEMS_PER_PAGE} more
                  </button>
                </div>
              ) : null}
              {claimFeedback ? (
                <div
                  className={`mt-3 text-sm ${
                    claimFeedbackIsError ? 'text-red-600' : 'text-green-700'
                  }`}
                >
                  {claimFeedback}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-gray-600">You have no active listings.</div>
          )
        ) : null}
      </section>

      {/* Subscribed / Interested Listings */}
      <section className="px-4 pb-12">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Subscribed Listings</h3>
          <SectionToggle
            label="Toggle subscribed listings"
            open={showSubscribedListings}
            onToggle={() => setShowSubscribedListings((prev) => !prev)}
          />
        </div>

        {showSubscribedListings ? (
          interestedLoading && (interested ?? []).length === 0 ? (
            <div className="text-sm text-gray-600">Loading interested listings…</div>
          ) : interestedError ? (
            <div className="text-sm text-red-600">{interestedError}</div>
          ) : interested && interested.length > 0 ? (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {interested.map((l) => renderListingCardSubscribed(l as ListingUserResponse))}
              </ul>
              {messageError ? (
                <div className="mt-3 text-sm text-red-600">{messageError}</div>
              ) : null}

              {/* Pagination */}
              <div className="mt-4">
                {interestedNextCursor ? (
                  <LoadMoreInterested
                    pageSize={ITEMS_PER_PAGE}
                    onClick={async () => {
                      try {
                        setInterestedLoading(true);
                        // Acquire a fresh token via firebase/auth if present; else use localStorage.
                        const mod = await import('firebase/auth').catch(() => null);
                        let token: string | null = null;
                        if (mod) {
                          const { getAuth } = mod;
                          const auth = getAuth();
                          token = auth.currentUser
                            ? await auth.currentUser.getIdToken().catch(() => null)
                            : null;
                          // Keep UID in sync if available
                          setUserUid(auth.currentUser?.uid ?? null);
                        }
                        if (!token && typeof window !== 'undefined') {
                          token = localStorage.getItem('idToken') || localStorage.getItem('token');
                        }
                        if (!token) {
                          throw new Error('Missing token');
                        }

                        // Fire the same endpoint with cursor.
                        const params = new URLSearchParams();
                        params.set('limit', ITEMS_PER_PAGE.toString());
                        if (interestedNextCursor?.cursor_created_at)
                          params.set('cursor_created_at', interestedNextCursor.cursor_created_at);
                        if (interestedNextCursor?.cursor_id)
                          params.set('cursor_id', interestedNextCursor.cursor_id);

                        const res = await fetch(
                          `/api/v1/listings/user/interested?${params.toString()}`,
                          {
                            headers: { Authorization: `Bearer ${token}` },
                            cache: 'no-store',
                          }
                        );

                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(
                            (body as { error?: string })?.error || `Request failed with ${res.status}`
                          );
                        }

                      const page = (await res.json()) as InterestedResponse;
                      const activeListings = (page.listings ?? []).filter(
                        (item) => item.status === 'available'
                      );
                      setInterested((prev) => [...(prev ?? []), ...activeListings]);
                      setInterestedNextCursor(page.next_cursor ?? null);
                      setInterestedError(null);
                      } catch (err: unknown) {
                        setInterestedError(
                          (err as { message?: string })?.message || 'Failed to load more'
                        );
                      } finally {
                        setInterestedLoading(false);
                      }
                    }}
                    loading={interestedLoading}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-600">
              You haven’t registered interest in any listings yet.
            </div>
          )
        ) : null}
      </section>

      {/* Your Claimed Listings */}
      <section className="px-4 pb-12">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Your Claimed Listings</h3>
          <SectionToggle
            label="Toggle claimed listings"
            open={showClaimedListings}
            onToggle={() =>
              setShowClaimedListings((prev) => {
                const next = !prev;
                if (next && !claimedLoading && (claimedListings === null || claimedError)) {
                  if (!idToken) {
                    setClaimedError('Missing token');
                    setClaimedListings(null);
                    setClaimedLoading(false);
                  } else {
                    void fetchUserListings(idToken, 'claimed');
                  }
                }
                return next;
              })
            }
          />
        </div>

        {showClaimedListings ? (
          claimedLoading ? (
            <div className="text-sm text-gray-600">Loading your listings…</div>
          ) : claimedError ? (
            <div className="text-sm text-red-600">{claimedError}</div>
          ) : claimedListings && claimedListings.length > 0 ? (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {claimedListings
                  .slice(0, claimedVisibleCount)
                  .map((l) => renderListingCardOwned(l as ListingUserResponse))}
              </ul>
              {claimedListings.length > claimedVisibleCount ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setClaimedVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Load {ITEMS_PER_PAGE} more
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-gray-600">No claimed listings yet.</div>
          )
        ) : null}
      </section>
    </AuthGuard>
  );
}

// Simple “Load more” button component to keep JSX tidy.
function LoadMoreInterested({
  onClick,
  loading,
  pageSize = 6,
}: {
  onClick: () => void | Promise<void>;
  loading?: boolean;
  pageSize?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 transition-colors disabled:opacity-60"
    >
      {loading ? 'Loading…' : `Load ${pageSize} more`}
    </button>
  );
}
