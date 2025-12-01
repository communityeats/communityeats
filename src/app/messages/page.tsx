'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { listConversations } from '@/lib/api/chat'
import type { ConversationDoc } from '@/lib/types/chat'
import MessageThread from '@/components/MessageThread'
import type { ListingStatus } from '@/lib/types/listing'

type ConversationListItemProps = {
  conversation: ConversationDoc
  isActive: boolean
  onSelect: (id: string) => void
  currentUid: string | null
}

function ConversationListItem({ conversation, isActive, onSelect, currentUid }: ConversationListItemProps) {
  const otherParticipant = useMemo(() => {
    if (!currentUid) return null
    return conversation.participant_uids.find((uid) => uid !== currentUid) ?? null
  }, [conversation.participant_uids, currentUid])

  const participantNames = conversation.participant_profiles ?? {}
  const otherParticipantName = otherParticipant ? participantNames[otherParticipant] ?? otherParticipant : null
  const lastAuthorUid = conversation.last_message_author_uid
  const lastAuthorLabel = lastAuthorUid
    ? lastAuthorUid === currentUid
      ? 'You'
      : participantNames[lastAuthorUid] ?? lastAuthorUid
    : null

  const lastMessageTime = conversation.last_message_at
    ? new Date(conversation.last_message_at)
    : conversation.updated_at
      ? new Date(conversation.updated_at)
      : null

  const formattedTime = lastMessageTime && !Number.isNaN(lastMessageTime.valueOf())
    ? lastMessageTime.toLocaleString()
    : '—'
  const statusLabel =
    conversation.listing_status === 'claimed'
      ? 'Claimed'
      : conversation.listing_status === 'removed'
        ? 'Archived'
        : null

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full text-left border rounded p-3 transition ${
        isActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-800 truncate">
            {conversation.listing_title || 'Listing'}
          </h3>
          <p className="text-xs text-gray-500 truncate break-words">
            {conversation.last_message_preview
              ? lastAuthorLabel
                ? `${lastAuthorLabel}: ${conversation.last_message_preview}`
                : conversation.last_message_preview
              : 'No messages yet'}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {otherParticipantName ? `With ${otherParticipantName}` : 'Conversation'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {statusLabel ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              {statusLabel}
            </span>
          ) : null}
          <span className="text-[11px] text-gray-500 whitespace-nowrap">{formattedTime}</span>
        </div>
      </div>
    </button>
  )
}

function MessagesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [idToken, setIdToken] = useState<string | null>(null)
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  const [conversations, setConversations] = useState<ConversationDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [claimingListing, setClaimingListing] = useState(false)
  const [claimNotice, setClaimNotice] = useState<string | null>(null)
  const [claimIsError, setClaimIsError] = useState(false)
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [listingStatusMap, setListingStatusMap] = useState<Record<string, ListingStatus | null>>({})
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')
  const [visibleCounts, setVisibleCounts] = useState<{ active: number; archived: number }>({
    active: 5,
    archived: 5,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingAuth(false)
      if (!user) {
        setIdToken(null)
        setCurrentUid(null)
        setConversations([])
        setSelectedConversationId(null)
        return
      }
      try {
        const token = await user.getIdToken()
        setIdToken(token)
        setCurrentUid(user.uid)
      } catch {
        try {
          const fresh = await user.getIdToken(true)
          setIdToken(fresh)
          setCurrentUid(user.uid)
        } catch {
          setIdToken(null)
          setCurrentUid(null)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchListingStatuses = useCallback(
    async (token: string, listingIds: string[]) => {
      const uniqueIds = Array.from(
        new Set(
          listingIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter((id) => id.length && !(id in listingStatusMap))
        )
      )
      if (!uniqueIds.length) return {} as Record<string, ListingStatus | null>

      setLoadingStatuses(true)
      try {
        const entries = await Promise.all(
          uniqueIds.map(async (listingId) => {
            try {
              const res = await fetch(`/api/v1/listings/${listingId}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
              })
              if (res.status === 404) {
                return [listingId, 'removed' as ListingStatus]
              }
              const payload = (await res.json().catch(() => ({}))) as { status?: unknown }
              const status =
                typeof payload.status === 'string' &&
                ['available', 'claimed', 'removed'].includes(payload.status)
                  ? (payload.status as ListingStatus)
                  : null
              return [listingId, status] as const
            } catch {
              return [listingId, null] as const
            }
          })
        )
        const statusMap = entries.reduce<Record<string, ListingStatus | null>>((acc, [id, status]) => {
          acc[id] = status
          return acc
        }, {})
        const idSet = new Set(uniqueIds)
        setListingStatusMap((prev) => ({ ...prev, ...statusMap }))
        setConversations((prev) =>
          prev.map((conversation) =>
            idSet.has(conversation.listing_id)
              ? { ...conversation, listing_status: statusMap[conversation.listing_id] ?? null }
              : conversation
          )
        )
        return statusMap
      } finally {
        setLoadingStatuses(false)
      }
    },
    [listingStatusMap]
  )

  const fetchConversations = async (token: string) => {
    setLoading(true)
    setError(null)
    setListingStatusMap({})
    setVisibleCounts({ active: 5, archived: 5 })
    try {
      const list = await listConversations(token, 50)
      const listWithStatus = list.map((c) => ({
        ...c,
        listing_status: c.listing_status ?? null,
      }))
      setConversations(listWithStatus)

      const pickInitial = () => {
        const firstActive = listWithStatus.find(
          (c) => c.listing_status !== 'claimed' && c.listing_status !== 'removed'
        )
        const firstArchived = listWithStatus.find(
          (c) => c.listing_status === 'claimed' || c.listing_status === 'removed'
        )
        if (selectedConversationId && listWithStatus.some((c) => c.id === selectedConversationId)) {
          return selectedConversationId
        }
        return firstActive?.id ?? firstArchived?.id ?? null
      }
      const nextSelected = pickInitial()
      setSelectedConversationId(nextSelected)
      if (!nextSelected) {
        setActiveTab('active')
      } else {
        const selected = listWithStatus.find((c) => c.id === nextSelected)
        const isArchived =
          selected?.listing_status === 'claimed' || selected?.listing_status === 'removed'
        setActiveTab(isArchived ? 'archived' : 'active')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
      setConversations([])
      setSelectedConversationId(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!idToken) return
    void fetchConversations(idToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken])

  useEffect(() => {
    const paramId = searchParams.get('conversation')
    if (!paramId) return
    setSelectedConversationId((prev) => (prev === paramId ? prev : paramId))
    setClaimNotice(null)
  }, [searchParams])

  useEffect(() => {
    const selected = conversations.find((c) => c.id === selectedConversationId)
    if (!selected) return
    const isArchived =
      selected.listing_status === 'claimed' || selected.listing_status === 'removed'
    setActiveTab(isArchived ? 'archived' : 'active')
  }, [conversations, selectedConversationId])

  const isArchivedConversation = (conversation: ConversationDoc) =>
    conversation.listing_status === 'claimed' || conversation.listing_status === 'removed'

  const activeConversations = conversations.filter((c) => !isArchivedConversation(c))
  const archivedConversations = conversations.filter(isArchivedConversation)
  const visibleActive = activeConversations.slice(0, visibleCounts.active)
  const visibleArchived = archivedConversations.slice(0, visibleCounts.archived)
  const displayedConversations = activeTab === 'active' ? visibleActive : visibleArchived

  const conversationSortKey = useCallback((conversation: ConversationDoc) => {
    const candidate = conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at
    const ts = candidate ? Date.parse(candidate) : 0
    return Number.isNaN(ts) ? 0 : ts
  }, [])

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    const convo = conversations.find((c) => c.id === conversationId)
    if (convo) {
      const archived = isArchivedConversation(convo)
      setActiveTab(archived ? 'archived' : 'active')
    }
    const params = new URLSearchParams(searchParams)
    params.set('conversation', conversationId)
    router.push(`/messages?${params.toString()}`, { scroll: false })
  }

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null
  const selectedConversationNames = selectedConversation
    ? selectedConversation.participant_uids
        .filter((uid) => uid !== currentUid)
        .map((uid) => {
          const nameMap = selectedConversation.participant_profiles ?? {}
          const label = nameMap[uid]
          return label && label.trim() ? label : uid
        })
        .join(', ')
    : ''

  useEffect(() => {
    const activeIndex = activeConversations.findIndex((c) => c.id === selectedConversationId)
    if (activeIndex >= visibleCounts.active) {
      setVisibleCounts((prev) => ({ ...prev, active: activeIndex + 1 }))
    }
    const archivedIndex = archivedConversations.findIndex((c) => c.id === selectedConversationId)
    if (archivedIndex >= visibleCounts.archived) {
      setVisibleCounts((prev) => ({ ...prev, archived: archivedIndex + 1 }))
    }
  }, [
    activeConversations,
    archivedConversations,
    selectedConversationId,
    visibleCounts.active,
    visibleCounts.archived,
  ])

  useEffect(() => {
    if (!idToken || !conversations.length) return

    const listForTab = activeTab === 'active' ? activeConversations : archivedConversations
    const targetCount = Math.min(listForTab.length, visibleCounts[activeTab] + 5)
    const idsToFetch = listForTab
      .slice(0, targetCount)
      .map((conversation) => conversation.listing_id.trim())
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && !(id in listingStatusMap))

    if (idsToFetch.length) {
      void fetchListingStatuses(idToken, idsToFetch)
    }
  }, [
    activeTab,
    activeConversations,
    archivedConversations,
    conversations.length,
    fetchListingStatuses,
    idToken,
    listingStatusMap,
    visibleCounts,
  ])

  const handleConversationActivity = useCallback(
    ({
      conversationId,
      lastMessageAt,
      lastMessagePreview,
      lastMessageAuthorUid,
    }: {
      conversationId: string
      lastMessageAt: string | null
      lastMessagePreview: string
      lastMessageAuthorUid: string | null
    }) => {
      const fallbackTime = lastMessageAt ?? new Date().toISOString()
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conversationId)
        if (!existing) return prev

        const nextConversation: ConversationDoc = {
          ...existing,
          last_message_preview: lastMessagePreview || existing.last_message_preview || null,
          last_message_at: lastMessageAt ?? existing.last_message_at ?? null,
          last_message_author_uid: lastMessageAuthorUid ?? existing.last_message_author_uid ?? null,
          updated_at: fallbackTime,
        }

        const others = prev.filter((c) => c.id !== conversationId)
        return [nextConversation, ...others].sort(
          (a, b) => conversationSortKey(b) - conversationSortKey(a)
        )
      })
    },
    [conversationSortKey]
  )

  const handleConfirmClaim = async () => {
    if (!selectedConversation || !idToken) return
    if (selectedConversation.listing_owner_uid !== currentUid) return

    setClaimingListing(true)
    setClaimNotice(null)
    setClaimIsError(false)

    try {
      const res = await fetch('/api/v1/listings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ id: selectedConversation.listing_id, status: 'claimed' }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean }
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed with ${res.status}`)
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.listing_id === selectedConversation.listing_id
            ? { ...c, listing_status: 'claimed' }
            : c
        )
      )
      setActiveTab('archived')
      setClaimNotice('Marked listing as claimed.')
      setClaimIsError(false)
    } catch (err: unknown) {
      setClaimNotice(err instanceof Error ? err.message : 'Failed to mark listing as claimed')
      setClaimIsError(true)
    } finally {
      setClaimingListing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
          <p className="text-sm text-gray-500 mt-1">
            Chat with listing owners and interested participants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 underline hover:text-gray-800"
          >
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => idToken && fetchConversations(idToken)}
            disabled={loading}
            className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loadingAuth ? (
        <div className="text-sm text-gray-600">Checking authentication…</div>
      ) : !idToken ? (
        <div className="text-sm text-gray-600">Sign in to view your messages.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <aside className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Conversations</h2>
              {error ? (
                <span className="text-xs text-red-600">{error}</span>
              ) : loadingStatuses ? (
                <span className="text-xs text-gray-500">Updating statuses…</span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`flex-1 text-xs font-medium rounded border px-2 py-1 ${
                  activeTab === 'active'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('archived')}
                className={`flex-1 text-xs font-medium rounded border px-2 py-1 ${
                  activeTab === 'archived'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                }`}
              >
                Archived
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading conversations…</div>
            ) : displayedConversations.length ? (
              <div className="space-y-2">
                {displayedConversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === selectedConversationId}
                    onSelect={handleSelectConversation}
                    currentUid={currentUid}
                  />
                ))}
                {activeTab === 'active' && activeConversations.length > visibleCounts.active ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCounts((prev) => ({
                        ...prev,
                        active: prev.active + 5,
                      }))
                    }
                    className="w-full text-xs text-indigo-700 border border-indigo-200 rounded py-1 hover:bg-indigo-50"
                  >
                    Load 5 more
                  </button>
                ) : null}
                {activeTab === 'archived' && archivedConversations.length > visibleCounts.archived ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCounts((prev) => ({
                        ...prev,
                        archived: prev.archived + 5,
                      }))
                    }
                    className="w-full text-xs text-indigo-700 border border-indigo-200 rounded py-1 hover:bg-indigo-50"
                  >
                    Load 5 more
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-gray-600 border rounded p-3">
                {activeTab === 'active'
                  ? 'No active conversations.'
                  : 'No archived conversations.'}
              </div>
            )}
          </aside>

          <section className="lg:col-span-2 border rounded h-[500px] flex flex-col">
            {selectedConversation ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700">
                      {selectedConversation.listing_title || 'Listing'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Conversation with {selectedConversationNames || 'participant'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConversation.listing_owner_uid === currentUid ? (
                      <button
                        type="button"
                        onClick={handleConfirmClaim}
                        disabled={claimingListing}
                        className="px-3 py-1 rounded text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
                      >
                        {claimingListing ? 'Marking…' : 'Confirm claimed'}
                      </button>
                    ) : null}
                    <Link
                      href={`/listings/${selectedConversation.listing_id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      View listing
                    </Link>
                  </div>
                </div>
                {claimNotice ? (
                  <div
                    className={`px-4 py-2 text-xs ${
                      claimIsError ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {claimNotice}
                  </div>
                ) : null}
                <div className="flex-1">
                  <MessageThread
                    conversationId={selectedConversation.id}
                    onActivity={handleConversationActivity}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                Select a conversation to view messages.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-600">Loading messages…</div>}>
      <MessagesPageContent />
    </Suspense>
  )
}
