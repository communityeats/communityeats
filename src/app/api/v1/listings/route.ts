import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getFirestore } from '@/lib/firebase/admin'
import { buildImageUrlFromId } from '@/lib/utils'

initAdmin()

type Coordinates = { latitude: number; longitude: number }

const EARTH_RADIUS_KM = 6371

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

export async function GET(req: NextRequest) {
  try {
    const firestore = getFirestore()
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status') ?? 'available'
    const sort = searchParams.get('sort') ?? 'recent'
    const latitude = Number.parseFloat(searchParams.get('lat') ?? '')
    const longitude = Number.parseFloat(searchParams.get('lon') ?? '')
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)
    const limitCount = parseInt(searchParams.get('limit') || '20', 10)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)

    const baseQuery = firestore.collection('listings').where('status', '==', status)

    // When sorting by nearest, scan a larger window of recent listings and then
    // sort them server-side by distance. Firestore does not support geo distance
    // ordering out of the box without an external index/geohash.
    const shouldSortByNearest = sort === 'nearest' && hasCoords
    const scanCount = shouldSortByNearest ? limitCount * page * 3 : limitCount

    const snapshot = await baseQuery
      .orderBy('created_at', 'desc')
      .offset(shouldSortByNearest ? 0 : (page - 1) * limitCount)
      .limit(scanCount)
      .get()

    const listingsWithImages = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data()
        const uid = data.user_id
        const thumbId = data.thumbnail_id

        let thumbnail_url = null
        try {
          if (uid && thumbId) {
            thumbnail_url = await buildImageUrlFromId(thumbId)
          }
        } catch (err) {
          console.warn(`Image missing for listing ${doc.id}`, err)
        }

        return {
          id: doc.id,
          ...data,
          thumbnail_url,
        }
      })
    )

    if (!shouldSortByNearest) {
      return NextResponse.json(listingsWithImages)
    }

    const userCoords = { latitude, longitude }
    const withDistance = listingsWithImages.map((listing) => {
      const loc = (listing as { location?: { latitude?: number; longitude?: number } }).location
      const lat = Number.isFinite(loc?.latitude) ? Number(loc?.latitude) : null
      const lon = Number.isFinite(loc?.longitude) ? Number(loc?.longitude) : null

      const distanceKm =
        lat !== null && lon !== null
          ? calculateDistanceKm(userCoords, { latitude: lat, longitude: lon })
          : Number.POSITIVE_INFINITY

      return { ...listing, distanceKm }
    })

    withDistance.sort((a, b) => a.distanceKm - b.distanceKm)

    const start = (page - 1) * limitCount
    const sliced = withDistance.slice(start, start + limitCount)

    return NextResponse.json(sliced)
  } catch (err) {
    console.error('Error retrieving listings:', err)
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}
