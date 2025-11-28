'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { listConversations } from '@/lib/api/chat'
import type { ConversationDoc } from '@/lib/types/chat'
import MessageThread from '@/components/MessageThread'

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
        <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">{formattedTime}</span>
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

  const fetchConversations = async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const list = await listConversations(token)
      setConversations(list)
      if (list.length && !selectedConversationId) {
        setSelectedConversationId(list[0].id)
      } else if (selectedConversationId && !list.some((c) => c.id === selectedConversationId)) {
        setSelectedConversationId(list[0]?.id ?? null)
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

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
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
              ) : null}
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading conversations…</div>
            ) : conversations.length ? (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === selectedConversationId}
                    onSelect={handleSelectConversation}
                    currentUid={currentUid}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600 border rounded p-3">
                No conversations yet. Register interest in a listing or message an interested user to start chatting.
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
                  <MessageThread conversationId={selectedConversation.id} />
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
