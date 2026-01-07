'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import {
  formatLocationPartsForDisplay,
  type ExchangeType,
  type ListingLocation,
  type ListingStatus,
} from '@/lib/types/listing'
import { ensureConversation } from '@/lib/api/chat'
import type { ConversationDoc } from '@/lib/types/chat'

type Listing = {
  id: string
  title: string
  description: string
  image_urls: string[]
  interested_user_count: number
  category?: string
  exchange_type?: ExchangeType
  location?: Partial<ListingLocation>
  location_label?: string | null
  status?: ListingStatus
  created_at?: string
  has_registered?: boolean
  user_id?: string
}

export default function ListingDetailClient({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [hasRegistered, setHasRegistered] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [userToken, setUserToken] = useState<string | null>(null)
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [openingConversation, setOpeningConversation] = useState(false)
  const [pendingConversation, setPendingConversation] = useState<ConversationDoc | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateMessage, setTemplateMessage] = useState('')
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [sendingTemplate, setSendingTemplate] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken()
        setUserToken(token)
        setCurrentUid(user.uid)
      } else {
        setUserToken(null)
        setCurrentUid(null)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await fetch(`/api/v1/listings/${id}`,
          {
            headers: {
              Authorization: userToken ? `Bearer ${userToken}` : '',
            },
          }
        )
        const data = await res.json()
        if (res.ok) {
          setListing(data)
          if (data.has_registered_interest) {
            setHasRegistered(true)
          }
        }
        else setError(data.error || 'Failed to load listing')
      } catch {
        setError('Failed to fetch listing')
      } finally {
        setLoading(false)
      }
    }
    fetchListing()
  }, [id, userToken])

  const claimListing = async () => {
    setError(null)

    if (!userToken) {
      router.push(`/login?redirect=/listings/${id}`)
      return
    }

    if (listing?.status && listing.status !== 'available') {
      setError('This listing is no longer available.')
      return
    }
    
    setClaiming(true)

    try {
      const res = await fetch(`/api/v1/listings/${id}/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to claim listing')
      } else {
        setHasRegistered(true)
        setSuccessMessage('Successfully registered interest')
      }
    } catch {
      setError('Failed to send claim request')
    } finally {
      setClaiming(false)
    }
  }

  const buildTemplateMessage = () => {
    const title = listing?.title?.trim()
    const listingSegment = title && title.length ? ` "${title}"` : ''
    return `Hi there, I came across your listing${listingSegment} and I'd love to arrange a pickup if it's still available. Let me know what time works best for you, or if you have any questions for me first. Thanks so much!`
  }

  const handleMessageOwnerClick = async () => {
    if (!userToken) {
      router.push(`/login?redirect=/listings/${id}`)
      return
    }

    setConversationError(null)

    if (conversationId) {
      router.push(`/messages?conversation=${conversationId}`, { scroll: false })
      return
    }

    setOpeningConversation(true)

    try {
      const conversation = await ensureConversation({ token: userToken, listingId: id })
      if (conversation.last_message_at || conversation.last_message_preview) {
        setConversationId(conversation.id)
        router.push(`/messages?conversation=${conversation.id}`, { scroll: false })
        return
      }

      setPendingConversation(conversation)
      setTemplateMessage(buildTemplateMessage())
      setTemplateError(null)
      setShowTemplateModal(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open conversation'
      setConversationError(message)
    } finally {
      setOpeningConversation(false)
    }
  }

  const handleSendTemplateMessage = async () => {
    if (!pendingConversation || !userToken) return
    const trimmed = templateMessage.trim()
    if (!trimmed) {
      setTemplateError('Please enter a message before sending.')
      return
    }

    setSendingTemplate(true)
    setTemplateError(null)

    try {
      const res = await fetch(`/api/v1/conversations/${pendingConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ body: trimmed }),
      })

      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to send message')
      }

      setShowTemplateModal(false)
      setPendingConversation(null)
      setTemplateMessage('')
      setConversationId(pendingConversation.id)
      router.push(`/messages?conversation=${pendingConversation.id}`, { scroll: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message'
      setTemplateError(message)
    } finally {
      setSendingTemplate(false)
    }
  }

  const handleCancelTemplate = () => {
    setShowTemplateModal(false)
    setPendingConversation(null)
    setTemplateMessage('')
    setTemplateError(null)
  }

  const showCopiedFeedback = () => {
    setCopiedLink(true)
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current)
    }
    copyResetRef.current = setTimeout(() => setCopiedLink(false), 1500)
  }

  const handleShare = async () => {
    const shareUrl =
      typeof window === 'undefined'
        ? `/listings/${id}`
        : new URL(`/listings/${id}`, window.location.origin).toString()

    try {
      if (navigator.share) {
        await navigator.share({ title: listing?.title || 'CommunityEats listing', url: shareUrl })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        showCopiedFeedback()
        return
      }

      window.prompt('Copy this link', shareUrl)
      showCopiedFeedback()
    } catch {
      setCopiedLink(false)
    }
  }

  if (loading) return <div className="flex-grow flex items-center justify-center">Loading...</div>
  if (error) return <div className="flex-grow flex items-center justify-center text-red-600">Error: {error}</div>
  if (!listing) return <div className="flex-grow flex items-center justify-center">Listing not found.</div>

  const {
    title,
    description,
    image_urls,
    interested_user_count,
    category,
    exchange_type,
    location,
    location_label,
    status,
    created_at,
    user_id,
  } = listing

  const isOwner = user_id === currentUid
  const isAvailable = !status || status === 'available'
  const postedLabel = created_at ? new Date(created_at).toLocaleDateString() : null
  const normalizeLocationLabel = (value?: string | null) =>
    typeof value === 'string' && value.trim()
      ? formatLocationPartsForDisplay(value.split(','))
      : null

  const locationLabel =
    normalizeLocationLabel(location_label) ??
    normalizeLocationLabel(location?.label ?? null) ??
    formatLocationPartsForDisplay([location?.suburb, location?.state, location?.country])
  const formattedSuburb = formatLocationPartsForDisplay([location?.suburb])
  const formattedState = formatLocationPartsForDisplay([location?.state])
  const formattedCountry = formatLocationPartsForDisplay([location?.country])
  const interestedLabel =
    interested_user_count === 1
      ? '1 person interested'
      : `${interested_user_count} people interested`

  const renderPrimaryAction = (variant: 'full' | 'floating') => {
    const sizing =
      variant === 'floating'
        ? 'h-11 px-4 text-sm font-semibold rounded-full'
        : 'w-full py-3 text-base font-semibold rounded-lg'

    if (isOwner) {
      return (
        <button
          type="button"
          onClick={() => router.push(`/dashboard/listings/${id}`)}
          className={`${sizing} bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60 w-full`}
        >
          Manage Listing
        </button>
      )
    }

    if (hasRegistered) {
      const label = openingConversation
        ? 'Opening chat…'
        : conversationId
          ? 'Open Messages'
          : 'Message Owner'
      return (
        <button
          type="button"
          onClick={handleMessageOwnerClick}
          disabled={openingConversation}
          className={`${sizing} bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-60 w-full`}
        >
          {label}
        </button>
      )
    }

    const label = !isAvailable
      ? 'No longer available'
      : claiming
        ? 'Registering…'
        : 'Register Interest'

    return (
      <button
        type="button"
        onClick={!isAvailable ? undefined : claimListing}
        disabled={claiming || !isAvailable}
        className={`${sizing} bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50 w-full ${
          !isAvailable ? 'cursor-not-allowed opacity-60 hover:bg-blue-600' : ''
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-white pb-28 lg:pb-0">
      {/* Hero Section */}
      <div className="w-full bg-gray-100 border-b py-10 sm:py-12">
        <div className="max-w-5xl mx-auto px-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">{title}</h1>
            <button
              type="button"
              onClick={handleShare}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              aria-label="Share listing link"
            >
              <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-700">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${
                isAvailable
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Available'}
            </span>
            {locationLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-white text-gray-800 shadow-sm">
                {locationLabel}
              </span>
            ) : null}
            {postedLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-white text-gray-700">
                Posted {postedLabel}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-white text-gray-700">
              {interestedLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-8 lg:py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column */}
          <div className="flex flex-col space-y-8 lg:col-span-2">
            {image_urls?.length > 0 ? (
              <>
                <div className="sm:hidden -mx-4">
                  <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
                    {image_urls.map((url, i) => (
                      <div key={i} className="snap-start shrink-0 w-[76vw] max-w-xs">
                        <img
                          src={url}
                          alt={`Image ${i + 1}`}
                          className="w-full h-52 object-cover rounded-xl border"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {image_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Image ${i + 1}`}
                      className="w-full h-64 object-cover rounded-xl border"
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed bg-gray-50 text-sm text-gray-500">
                No photos uploaded yet.
              </div>
            )}

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">Description</h2>
              <p className="text-gray-700 whitespace-pre-line">{description}</p>
            </section>
          </div>

          {/* Right Column */}
          <aside className="space-y-6">
            <section className="space-y-3 rounded-xl border bg-gray-50/80 p-4">
              <h2 className="text-xl font-semibold text-gray-800">Details</h2>
              <div className="space-y-1 text-sm text-gray-700">
                {category && <p><strong>Category:</strong> {category}</p>}
                {exchange_type && <p><strong>Type:</strong> {exchange_type}</p>}
                {status && <p><strong>Status:</strong> {status}</p>}
                {postedLabel && <p><strong>Posted:</strong> {postedLabel}</p>}
              </div>
            </section>

            {location ? (
              <section className="space-y-2 rounded-xl border p-4">
                <h2 className="text-xl font-semibold text-gray-800">Location</h2>
                {formattedSuburb ? (
                  <p className="text-sm text-gray-700"><strong>Suburb:</strong> {formattedSuburb}</p>
                ) : null}
                {formattedState ? (
                  <p className="text-sm text-gray-700"><strong>State:</strong> {formattedState}</p>
                ) : null}
                {formattedCountry ? (
                  <p className="text-sm text-gray-700"><strong>Country:</strong> {formattedCountry}</p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Interested</h2>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
                  {interested_user_count} {interested_user_count === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div className="space-y-2">
                {renderPrimaryAction('full')}
                {isOwner ? null : hasRegistered ? (
                  <>
                    {successMessage ? (
                      <p className="text-green-600 text-sm">{successMessage}</p>
                    ) : null}
                    {conversationError ? (
                      <p className="text-red-600 text-sm">{conversationError}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-gray-600">
                    By registering interest you acknowledge all food is offered in good faith and you accept responsibility for your own safety.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden pointer-events-none">
        <div className="pointer-events-auto border-t bg-white/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
          <div
            className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{title}</p>
              <div className="flex flex-wrap gap-1 text-[11px] text-gray-500">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                    isAvailable ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-100 text-gray-700'
                  }`}
                >
                  {status ? status : 'available'}
                </span>
                {locationLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5">
                    {locationLabel}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5">
                  {interestedLabel}
                </span>
              </div>
            </div>
            <div className="w-40 shrink-0">
              {renderPrimaryAction('floating')}
            </div>
          </div>
        </div>
      </div>
      {showTemplateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Start the conversation</h2>
              <p className="mt-1 text-sm text-gray-500">
                Send a friendly first message to the listing owner. You can edit it before sending.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <textarea
                value={templateMessage}
                onChange={(event) => {
                  setTemplateMessage(event.target.value)
                  setTemplateError(null)
                }}
                rows={5}
                className="w-full border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {templateError ? <p className="text-sm text-red-600">{templateError}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3 bg-gray-50">
              <button
                type="button"
                onClick={handleCancelTemplate}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTemplateMessage}
                disabled={sendingTemplate}
                className="px-4 py-2 text-sm font-semibold text-white rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-60"
              >
                {sendingTemplate ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ShareIcon(props: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? 'w-4 h-4'}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-3.4M15.3 16.7l-6.6-3.4" />
    </svg>
  )
}
