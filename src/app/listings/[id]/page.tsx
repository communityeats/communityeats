// src/app/listings/[id]/page.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import ListingDetailClient from './ListingDetailClient'
import { initAdmin, getFirestore, getStorage } from '@/lib/firebase/admin'
import type { ListingDoc, ListingLocation } from '@/lib/types/listing'
import { formatPublicLocationLabel, toPublicLocation } from '@/lib/types/listing'

initAdmin()

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  // If you may use it later, include this too:
  // searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const buildBaseUrl = async () => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (envUrl) return envUrl.replace(/\/$/, '')

  const hdrs = await headers()
  const host = hdrs.get('host')
  if (!host) return ''
  const proto = hdrs.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

const truncateText = (value: string, maxLength = 200) => {
  if (value.length <= maxLength) return value
  const shortened = value.slice(0, maxLength - 3)
  const boundary = shortened.lastIndexOf(' ')
  const trimmed = boundary > 0 ? shortened.slice(0, boundary) : shortened
  return `${trimmed}...`
}

const buildDescription = (data: ListingDoc, locationLabel: string | null) => {
  const base = typeof data.description === 'string' ? data.description.trim() : ''
  const category =
    typeof data.category === 'string' && data.category.trim() ? data.category.trim() : null
  const exchange =
    data.exchange_type === 'gift' ? 'Gift' : data.exchange_type === 'swap' ? 'Swap' : null
  const detailParts = [
    category ? `Category: ${category}` : null,
    exchange ? `Exchange: ${exchange}` : null,
    locationLabel ? `Location: ${locationLabel}` : null,
  ].filter(Boolean)

  const combined = [base, detailParts.join(' | ')].filter(Boolean).join(' | ')
  if (combined) return truncateText(combined)
  return 'CommunityEats listing details.'
}

const generateImageUrl = async (imageId: string) => {
  const filePath = `listings/${imageId}`
  const [url] = await getStorage().bucket().file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  })
  return url
}

const fetchListing = async (idOrSlug: string) => {
  const firestore = getFirestore()
  let docSnap = await firestore.collection('listings').doc(idOrSlug).get()
  if (!docSnap.exists) {
    const slugSnap = await firestore
      .collection('listings')
      .where('public_slug', '==', idOrSlug)
      .limit(1)
      .get()
    if (slugSnap.empty) return null
    docSnap = slugSnap.docs[0]
  }
  const data = docSnap.data() as ListingDoc
  return { data, id: docSnap.id }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const listing = await fetchListing(id)
  if (!listing) {
    return {
      title: 'Listing not found | CommunityEats',
      description: 'This listing is no longer available.',
    }
  }

  const { data, id: listingId } = listing
  const title =
    typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : 'CommunityEats listing'
  const publicLocation = toPublicLocation({
    location: (data as { location?: Partial<ListingLocation> | null }).location ?? null,
    country: data.country,
    state: data.state,
    suburb: data.suburb,
  })
  const locationLabel = formatPublicLocationLabel(publicLocation)
  const description = buildDescription(data, locationLabel)

  const slug =
    typeof data.public_slug === 'string' && data.public_slug.trim()
      ? data.public_slug.trim()
      : listingId
  const baseUrl = await buildBaseUrl()
  const canonicalUrl = baseUrl ? `${baseUrl}/listings/${slug}` : `/listings/${slug}`

  let ogImageUrl: string | undefined
  const imageId =
    typeof data.thumbnail_id === 'string' && data.thumbnail_id.trim()
      ? data.thumbnail_id.trim()
      : Array.isArray(data.image_ids) && typeof data.image_ids[0] === 'string'
        ? data.image_ids[0]
        : null
  if (imageId) {
    try {
      ogImageUrl = await generateImageUrl(imageId)
    } catch {
      ogImageUrl = undefined
    }
  }

  const ogTitle = `${title} | CommunityEats`
  const imageAlt = locationLabel ? `${title} in ${locationLabel}` : title

  return {
    title: ogTitle,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      type: 'article',
      siteName: 'CommunityEats',
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                width: 1200,
                height: 630,
                alt: imageAlt,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: ogImageUrl ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  }
}

export default async function ListingDetail({ params }: Props) {
  const { id } = await params

  return <ListingDetailClient slug={id} />
}
