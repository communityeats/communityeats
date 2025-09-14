'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ListingCard from '@/components/ListingCard'

type Listing = {
  id: string
  title: string
  thumbnail_url?: string
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch('/api/v1/listings')
        if (!res.ok) throw new Error('Failed to fetch listings')
        const data = await res.json()
        setListings(data)
      } catch (err: unknown) {
        console.error(err)
        setError((err as Error).message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchListings()
  }, [])

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Food Listings</h1>
        <Link
          href="/listings/new"
          className="inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          + New Listing
        </Link>
      </header>

      {loading ? (
        <p className="text-center text-gray-500">Loading listings...</p>
      ) : error ? (
        <p className="text-center text-red-600">{error}</p>
      ) : listings.length === 0 ? (
        <p className="text-center text-gray-600">
          No listings yet. Be the first to{' '}
          <Link href="/listings/new" className="underline text-blue-600">
            create one
          </Link>
          !
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={{
                ...listing,
                imageURL: listing.thumbnail_url || '/placeholder.png',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}