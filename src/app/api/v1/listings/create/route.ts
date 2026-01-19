import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import {
  normalizeListingLocation,
  thumbnailInImageIds,
  isExchangeType,
} from '@/lib/types/listing'
import {
  buildListingSlug,
  ensureUniqueListingSlug,
} from '@/lib/listingSlug'
import { v4 as uuidv4 } from 'uuid'

initAdmin() // Ensure initialized once

const REQUIRED_FIELDS = [
  'title',
  'description',
  'exchange_type',
  'thumbnail_id',
  'image_ids',
  'terms_acknowledged',
] as const

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decoded = await getAuth().verifyIdToken(idToken)
    const userId = decoded.uid

    const data = await req.json()

    console.log('Received data:', data)
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in data)) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
      }
    }

    if (typeof data.title !== 'string' || !data.title.trim()) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
    }

    if (typeof data.description !== 'string' || !data.description.trim()) {
      return NextResponse.json({ error: 'Invalid description' }, { status: 400 })
    }

    if (!isExchangeType(data.exchange_type)) {
      return NextResponse.json({ error: 'Invalid exchange type' }, { status: 400 })
    }

    if (data.terms_acknowledged !== true) {
      return NextResponse.json({ error: 'You must accept the terms before posting.' }, { status: 400 })
    }

    if (typeof data.thumbnail_id !== 'string') {
      return NextResponse.json({ error: 'Invalid thumbnail id' }, { status: 400 })
    }

    if (!thumbnailInImageIds(data.image_ids, data.thumbnail_id)) {
      return NextResponse.json({ error: 'Thumbnail must be one of the image IDs' }, { status: 400 })
    }

    const imageIds = (data.image_ids as string[]).filter((id): id is string => typeof id === 'string')

    const location = normalizeListingLocation({
      country: data.location?.country ?? data.country,
      state: data.location?.state ?? data.state,
      suburb: data.location?.suburb ?? data.suburb,
      postcode: data.location?.postcode ?? data.postcode,
      latitude: data.location?.latitude ?? data.latitude,
      longitude: data.location?.longitude ?? data.longitude,
      place_id: data.location?.place_id ?? data.location_place_id ?? data.place_id,
      label: data.location?.label ?? data.location_label ?? data.label,
    })

    if (!location.country || !location.state || !location.suburb || location.postcode <= 0) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
    }

    const docId = uuidv4()

    const firestore = getFirestore()
    const createdAt = new Date()
    const baseSlug = buildListingSlug(data.title, createdAt)
    const publicSlug = await ensureUniqueListingSlug(firestore, baseSlug)

    const listingDoc = {
      id: docId,
      user_id: userId,
      title: data.title.trim().toLowerCase(),
      description: data.description.trim().toLowerCase(),
      public_slug: publicSlug,
      location,
      country: location.country,
      state: location.state,
      suburb: location.suburb,
      postcode: location.postcode,
      location_place_id: location.place_id ?? null,
      location_label: location.label ?? null,
      category: typeof data.category === 'string' ? data.category : null,
      exchange_type: data.exchange_type,
      contact_info: data.contact_info ?? null,
      image_ids: imageIds,
      thumbnail_id: data.thumbnail_id,
      anonymous: Boolean(data.anonymous),
      terms_acknowledged: true,
      interested_users_uids: [],
      status: 'available',
      updated_at: createdAt.toISOString(),
      created_at: createdAt.toISOString(),
    }

   const docRef = firestore.collection('listings').doc(docId);
    await docRef.set(listingDoc);
    

    return NextResponse.json({ success: true, id: docRef.id }, { status: 201 })
  } catch (err: unknown) {
    console.error('Error creating listing:', err)

    let message = 'Internal error'
    if (err instanceof Error) {
      message = err.message
    } else if (typeof err === 'string') {
      message = err
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
