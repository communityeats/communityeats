'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import ListingCard from '@/components/ListingCard'

type Listing = {
  id: string
  title: string
  thumbnail_url?: string | null
  created_at?: string
  location?: {
    latitude?: number | null
    longitude?: number | null
  }
}

type SortOption = 'recent' | 'nearest'

type Coordinates = { latitude: number; longitude: number }

type ListingWithDistance = Listing & { distanceKm?: number | null }

const EARTH_RADIUS_KM = 6371
const GEOLOCATION_PERMISSION_DENIED = 1

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const calculateDistanceKm = (from: Coordinates, to: Coordinates) => {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const PAGE_LIMIT = 9

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const fetchListings = useCallback(
    async (pageToFetch: number, isLoadMore: boolean) => {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }
      try {
        const res = await fetch(`/api/v1/listings?limit=${PAGE_LIMIT}&page=${pageToFetch}`)
        if (!res.ok) throw new Error('Failed to fetch listings')
        const data: Listing[] = await res.json()
        setListings((prev) => (pageToFetch === 1 ? data : [...prev, ...data]))
        setHasMore(data.length === PAGE_LIMIT)
        setPage(pageToFetch)
      } catch (err: unknown) {
        console.error(err)
        setError((err as Error).message || 'Something went wrong')
      } finally {
        if (isLoadMore) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    fetchListings(1, false)
  }, [fetchListings])

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    fetchListings(nextPage, true)
  }

  const ensureLocation = useCallback(() => {
    if (userCoords) return Promise.resolve(true)

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported in this browser.')
      return Promise.resolve(false)
    }

    setLocationError(null)
    setLocationLoading(true)

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserCoords({ latitude, longitude })
          setLocationLoading(false)
          resolve(true)
        },
        (geoError) => {
          const fallbackMessage =
            geoError.code === GEOLOCATION_PERMISSION_DENIED
              ? 'Location access was denied. Please enable it to sort by nearest.'
              : 'Unable to determine your location.'
          setLocationError(geoError.message || fallbackMessage)
          setLocationLoading(false)
          resolve(false)
        },
        { enableHighAccuracy: false, timeout: 10000 }
      )
    })
  }, [userCoords])

  const handleSortChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as SortOption
      setSortOption(value)

      if (value === 'nearest') {
        await ensureLocation()
      }
    },
    [ensureLocation]
  )

  const displayListings: ListingWithDistance[] = useMemo(() => {
    if (sortOption === 'nearest' && userCoords) {
      return listings
        .map((listing) => {
          const latitude = toFiniteNumber(listing.location?.latitude)
          const longitude = toFiniteNumber(listing.location?.longitude)
          const distanceKm =
            latitude !== null && longitude !== null
              ? calculateDistanceKm(userCoords, { latitude, longitude })
              : null

          return { ...listing, distanceKm }
        })
        .sort((a, b) => {
          const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY
          const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY

          if (aDistance !== bDistance) {
            return aDistance - bDistance
          }

          const aCreated = a.created_at ? Date.parse(a.created_at) : 0
          const bCreated = b.created_at ? Date.parse(b.created_at) : 0
          return bCreated - aCreated
        })
    }

    return listings.map((listing) => ({ ...listing, distanceKm: null }))
  }, [listings, sortOption, userCoords])

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Food Listings</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Sort by</span>
            <select
              id="listing-sort"
              value={sortOption}
              onChange={handleSortChange}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="recent">Most recent</option>
              <option value="nearest">Nearest to me</option>
            </select>
          </label>
          <Link
            href="/listings/new"
            className="inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            + New Listing
          </Link>
        </div>
      </header>

      {sortOption === 'nearest' && (
        <div className="space-y-1">
          {locationLoading && (
            <p className="text-sm text-gray-500">Locating you…</p>
          )}
          {locationError && !locationLoading && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p className="text-red-600">{locationError}</p>
              <button
                type="button"
                onClick={() => {
                  setLocationError(null)
                  void ensureLocation()
                }}
                className="rounded-md border border-green-600 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

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
        <>
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

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-60"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
