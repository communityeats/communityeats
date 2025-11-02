'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import type { ExchangeType, ListingLocation, ListingStatus } from '@/lib/types/listing'
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
  status?: ListingStatus
  created_at?: string
  has_registered?: boolean // <-- Add this line
  user_id?: string // <-- Add this line
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
    status,
    created_at,
    user_id,
  } = listing

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Hero Section */}
      <div className="w-full bg-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{title}</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white py-8">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column */}
          <div className="flex flex-col space-y-8 lg:col-span-2">
            {image_urls?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {image_urls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Image ${i + 1}`}
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                ))}
              </div>
            )}

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">Description</h2>
              <p className="text-gray-700 whitespace-pre-line">{description}</p>
            </section>
          </div>

          {/* Right Column */}
          <aside className="space-y-6">
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-800">Details</h2>
              {category && <p><strong>Category:</strong> {category}</p>}
              {exchange_type && <p><strong>Type:</strong> {exchange_type}</p>}
              {status && <p><strong>Status:</strong> {status}</p>}
              {created_at && <p><strong>Posted:</strong> {new Date(created_at).toLocaleDateString()}</p>}
            </section>

            {location && (
              <section className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">Location</h2>
                {location.suburb && <p><strong>Suburb:</strong> {location.suburb}</p>}
                {location.state && <p><strong>State:</strong> {location.state}</p>}
                {location.country && <p><strong>Country:</strong> {location.country}</p>}
                {location.postcode !== undefined && <p><strong>Postcode:</strong> {location.postcode}</p>}
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-800">Interested</h2>
              <p>{interested_user_count} user{interested_user_count !== 1 && 's'} interested</p>
            </section>

            {user_id === currentUid ? (
              <button
                onClick={() => router.push(`/dashboard/listings/${id}`)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Manage Listing
              </button>
            ) : hasRegistered ? (
              <>
                <button
                  onClick={handleMessageOwnerClick}
                  disabled={openingConversation}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-60"
                >
                  {openingConversation
                    ? 'Opening chat…'
                    : conversationId
                      ? 'Open Messages'
                      : 'Message Owner'}
                </button>
                {successMessage && <p className="text-green-600 text-sm mt-2">{successMessage}</p>}
                {conversationError && (
                  <p className="text-red-600 text-sm mt-2">{conversationError}</p>
                )}
              </>
            ) : (
              <button
                onClick={claimListing}
                disabled={claiming}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {claiming ? 'Registering Interest...' : 'Register Interest'}
              </button>
            )}
          </aside>
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
