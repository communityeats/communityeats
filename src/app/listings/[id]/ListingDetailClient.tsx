// ListingDetailClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Listing = {
  id: string
  title: string
  description: string
  image_urls: string[]
  interested_user_count: number
  category?: string
  exchange_type?: string
  location?: {
    country?: string
    state?: string
    suburb?: string
    postcode?: number
  }
  status?: string
  created_at?: string
}

export default function ListingDetailClient({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await fetch(`/api/v1/listings/${id}`)
        const data = await res.json()
        if (res.ok) setListing(data)
        else setError(data.error || 'Failed to load listing')
      } catch {
        setError('Failed to fetch listing')
      } finally {
        setLoading(false)
      }
    }
    fetchListing()
  }, [id])

  const claimListing = async () => {
    setClaiming(true)
    setError(null)

    try {
      const res = await fetch(`/api/listings/${id}/claim`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Failed to claim listing')
      else router.refresh()
    } catch {
      setError('Failed to send claim request')
    } finally {
      setClaiming(false)
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
    status,
    created_at,
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

          {/* Left Column: Images + Description */}
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

          {/* Right Column: Metadata & Action */}
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

            <button
              onClick={claimListing}
              disabled={claiming}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {claiming ? 'Registering Interest...' : 'Register Interest'}
            </button>
          </aside>

        </div>
      </div>
    </div>
  )
}