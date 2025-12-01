'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export type CarouselListing = {
  id: string
  title?: string | null
  thumbnail_url?: string | null
  description?: string | null
  created_at?: string | null
  location_label?: string | null
}

type ListingCarouselProps = {
  listings: CarouselListing[]
}

const fallbackImages = [
  'linear-gradient(135deg,#f8fbf7,#d9f5d4)',
  'linear-gradient(135deg,#f0f7ff,#d6e8ff)',
  'linear-gradient(135deg,#fff7f0,#ffe3cc)',
]

export default function ListingCarousel({ listings }: ListingCarouselProps) {
  const items = useMemo(
    () =>
      listings
        .filter((item): item is CarouselListing & { id: string } => typeof item.id === 'string' && item.id.length > 0)
        .slice(0, 10),
    [listings]
  )
  const [index, setIndex] = useState(0)
  const [renderedIndex, setRenderedIndex] = useState(0)
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'fade-out' | 'fade-in'>('idle')
  const count = items.length

  useEffect(() => {
    if (!count) return
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count)
    }, 2500) // faster auto-advance
    return () => window.clearInterval(timer)
  }, [count])

  useEffect(() => {
    if (index >= count && count > 0) {
      setIndex(0)
    }
    if (renderedIndex >= count && count > 0) {
      setRenderedIndex(0)
    }
  }, [count, index, renderedIndex])

  useEffect(() => {
    if (index === renderedIndex) return
    setTransitionPhase('fade-out')
    const fadeOut = window.setTimeout(() => {
      setRenderedIndex(index)
      setTransitionPhase('fade-in')
    }, 120)
    const settle = window.setTimeout(() => {
      setTransitionPhase('idle')
    }, 380)
    return () => {
      window.clearTimeout(fadeOut)
      window.clearTimeout(settle)
    }
  }, [index, renderedIndex])

  if (!count) {
    return (
      <div className="border rounded-xl p-6 bg-white shadow-sm text-center text-gray-600">
        Fresh listings will appear here as they’re posted.
      </div>
    )
  }

  const current = items[renderedIndex]
  const heroImage = current.thumbnail_url
  const fallback = fallbackImages[renderedIndex % fallbackImages.length]
  const slideMotion =
    transitionPhase === 'fade-out'
      ? 'opacity-0 translate-y-1'
      : transitionPhase === 'fade-in'
        ? 'opacity-100 translate-y-0'
        : 'opacity-100 translate-y-0'

  return (
    <div className="relative overflow-hidden border rounded-2xl bg-white shadow-sm">
      <div
        className={`grid lg:grid-cols-2 gap-0 transition-all duration-500 ease-out ${slideMotion}`}
      >
        <div className="relative w-full bg-gray-100 overflow-hidden aspect-[16/10] lg:aspect-[4/3] lg:min-h-[260px]">
          {heroImage ? (
            <img
              src={heroImage}
              alt={current.title || 'Listing image'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundImage: fallback }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-3 left-3 text-white text-xs px-2 py-1 rounded bg-black/40 backdrop-blur-sm">
            New this week
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Recent listing</p>
            <h3 className="text-xl font-semibold text-gray-900">{current.title || 'Untitled item'}</h3>
            <p className="text-sm text-gray-600 line-clamp-3">
              {current.description || 'A neighbor just shared something fresh. Tap through to learn more.'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Available now
            </span>
            {current.location_label ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                {current.location_label}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev - 1 + count) % count)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full border text-gray-700 hover:bg-gray-50"
                aria-label="Previous listing"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev + 1) % count)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full border text-gray-700 hover:bg-gray-50"
                aria-label="Next listing"
              >
                →
              </button>
            </div>
            <Link
              href={`/listings/${current.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              View listing
            </Link>
          </div>

          <div className="flex gap-1 mt-1">
            {items.map((item, dotIndex) => (
              <button
                key={`${item.id}-${dotIndex}`}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-1.5 rounded-full transition-all ${
                  dotIndex === index ? 'w-6 bg-emerald-600' : 'w-2 bg-gray-300'
                }`}
                aria-label={`Go to slide ${dotIndex + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
