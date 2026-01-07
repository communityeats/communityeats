'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type MouseEvent } from 'react'

// src/components/ListingCard.tsx
type Listing = {
  id: string
  title: string
  imageURL?: string
  distanceKm?: number | null
  locationText?: string | null
  createdAt?: string | null
}

const formatDistance = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm)) return null
  if (distanceKm < 1) {
    const metres = Math.round(distanceKm * 1000)
    return `${metres} m away`
  }
  return `${distanceKm.toFixed(1)} km away`
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.valueOf())) return null
  return date.toLocaleDateString()
}

const slugifyTitle = (title?: string | null) => {
  if (!title) return 'listing'
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
  return slug || 'listing'
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const [copied, setCopied] = useState(false)
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const distanceLabel =
    typeof listing.distanceKm === 'number' ? formatDistance(listing.distanceKm) : null
  const dateLabel = formatDate(listing.createdAt)
  const listingHref = `/listings/${listing.id}`
  const sharePath = `/l/${listing.id}/${slugifyTitle(listing.title)}`

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current)
      }
    }
  }, [])

  const showCopiedFeedback = () => {
    setCopied(true)
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current)
    }
    copyResetRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const handleShareClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const shareUrl =
      typeof window === 'undefined'
        ? sharePath
        : new URL(sharePath, window.location.origin).toString()

    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title || 'CommunityEats listing', url: shareUrl })
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
      setCopied(false)
    }
  }

  return (
    <article className="relative border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
      <button
        type="button"
        onClick={handleShareClick}
        aria-label={`Copy link to ${listing.title || 'listing'}`}
        className="absolute right-3 top-3 z-10 inline-flex items-center justify-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        <ShareIcon className="w-5 h-5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
      </button>

      <Link
        href={listingHref}
        className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <div className="w-full aspect-[4/3] overflow-hidden bg-gray-100">
          <img
            src={listing.imageURL ?? '/placeholder.png'}
            alt={listing.title || 'Listing'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="p-3 space-y-3">
          <h3 className="font-medium text-gray-900 leading-snug line-clamp-2">{listing.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
            {listing.locationText ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 border border-gray-200">
                {listing.locationText}
              </span>
            ) : null}
            {distanceLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full text-green-700 bg-green-50 border border-green-100 px-2 py-1 whitespace-nowrap">
                {distanceLabel}
              </span>
            ) : null}
            {dateLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-1 whitespace-nowrap">
                {dateLabel}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
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
