import { NextResponse } from 'next/server'
import { initAdmin, getFirestore, getStorage } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import type { ListingDoc, ListingLocation } from '@/lib/types/listing'
import { formatPublicLocationLabel, toPublicLocation } from '@/lib/types/listing'

initAdmin()

const generateImageURL = async (imageId: string) => {
  const filePath = `listings/${imageId}`
  const [url] = await getStorage().bucket().file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  })
  return url
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }   // <- NOTE: Promise
) {
  const { id } = await params                         // <- await it

  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.split('Bearer ')[1]

    let userId: string | null = null
    if (token) {
      try {
        const decodedToken = await getAuth().verifyIdToken(token)
        userId = decodedToken.uid
      } catch (err) {
        console.warn('Failed to verify token:', err)
      }
    }

    const firestore = getFirestore()
    let docSnap = await firestore.collection('listings').doc(id).get()
    if (!docSnap.exists) {
      const slugSnap = await firestore
        .collection('listings')
        .where('public_slug', '==', id)
        .limit(1)
        .get()
      if (slugSnap.empty) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      }
      docSnap = slugSnap.docs[0]
    }

    const data = docSnap.data() as ListingDoc
    const imageIds = Array.isArray(data.image_ids) ? data.image_ids : []
    const interestedUserIds = Array.isArray(data.interested_users_uids)
      ? data.interested_users_uids
      : []

    const image_urls = (
      await Promise.all(
        imageIds.map(async (imageId) => {
          try { return await generateImageURL(imageId) }
          catch (err) { console.warn(`URL gen failed for ${imageId}`, err); return null }
        })
      )
    ).filter(Boolean) as string[]

    const ownerUserId = data.user_id as string | undefined
    const isOwner = ownerUserId && userId === ownerUserId
    const interested_user_count = interestedUserIds.filter((u) => u !== ownerUserId).length
    const has_registered_interest = !!userId && interestedUserIds.includes(userId) && !isOwner

    const publicLocation = toPublicLocation({
      location: (data as { location?: Partial<ListingLocation> | null }).location ?? null,
      country: data.country,
      state: data.state,
      suburb: data.suburb,
    })
    const ownerLocation = isOwner
      ? {
          ...publicLocation,
          ...(typeof data.location?.postcode === 'number' ? { postcode: data.location.postcode } : {}),
          ...(typeof data.location?.latitude === 'number' ? { latitude: data.location.latitude } : {}),
          ...(typeof data.location?.longitude === 'number' ? { longitude: data.location.longitude } : {}),
        }
      : publicLocation
    const location_label = formatPublicLocationLabel(publicLocation)

    const {
      interested_users_uids,
      user_id,
      location: _location,
      location_place_id: _locationPlaceId,
      location_label: _deprecatedLocationLabel,
      postcode: _deprecatedPostcode,
      ...rest
    } = data
    void interested_users_uids
    void user_id

    const public_slug =
      typeof data.public_slug === 'string' && data.public_slug.trim()
        ? data.public_slug
        : docSnap.id

    return NextResponse.json({
      ...rest,
      id: docSnap.id,
      public_slug,
      country: publicLocation.country,
      state: publicLocation.state,
      suburb: publicLocation.suburb,
      location: ownerLocation,
      location_label,
      user_id: ownerUserId,
      image_urls,
      interested_user_count,
      has_registered_interest,
    })
  } catch (err) {
    console.error('Error fetching listing detail:', err)
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    let decodedUid: string
    try {
      const decoded = await getAuth().verifyIdToken(token)
      decodedUid = decoded.uid
    } catch (err) {
      console.warn('Failed to verify token during delete:', err)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const firestore = getFirestore()
    const docRef = firestore.collection('listings').doc(id)
    const snapshot = await docRef.get()

    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const data = snapshot.data() as ListingDoc
    if (!data || data.user_id !== decodedUid) {
      return NextResponse.json({ error: 'Forbidden: not the owner' }, { status: 403 })
    }

    const imageIds = Array.isArray(data.image_ids) ? data.image_ids : []

    await docRef.delete()

    if (imageIds.length) {
      const bucket = getStorage().bucket()
      await Promise.all(
        imageIds.map(async (imageId) => {
          if (typeof imageId !== 'string' || !imageId.trim()) return
          const filePath = `listings/${imageId}`
          try {
            await bucket.file(filePath).delete({ ignoreNotFound: true })
          } catch (err) {
            console.warn(`Failed to delete file ${filePath}:`, err)
          }
        })
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting listing:', err)
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
  }
}
