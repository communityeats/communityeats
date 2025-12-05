import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getFirestore } from '@/lib/firebase/admin'
import { toPublicLocation, formatPublicLocationLabel, type ListingLocation } from '@/lib/types/listing'
import { buildImageUrlFromId } from '@/lib/utils'

initAdmin()

type Coordinates = { latitude: number; longitude: number }
type CoordinatesOrNull = { latitude: number | null; longitude: number | null }

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
        const uid = (data as { user_id?: string }).user_id
        const thumbId = (data as { thumbnail_id?: string }).thumbnail_id
        const rawLocation =
          (data as { location?: Partial<ListingLocation> | null }).location ?? null

        const publicLocation = toPublicLocation({
          location: rawLocation,
          country: (data as { country?: unknown }).country,
          state: (data as { state?: unknown }).state,
          suburb: (data as { suburb?: unknown }).suburb,
        })
        const location_label = formatPublicLocationLabel(publicLocation)

        let thumbnail_url = null
        try {
          if (uid && thumbId) {
            thumbnail_url = await buildImageUrlFromId(thumbId)
          }
        } catch (err) {
          console.warn(`Image missing for listing ${doc.id}`, err)
        }

        const coords: CoordinatesOrNull =
          rawLocation && typeof rawLocation === 'object'
            ? {
                latitude:
                  typeof rawLocation.latitude === 'number' && Number.isFinite(rawLocation.latitude)
                    ? rawLocation.latitude
                    : null,
                longitude:
                  typeof rawLocation.longitude === 'number' &&
                  Number.isFinite(rawLocation.longitude)
                    ? rawLocation.longitude
                    : null,
              }
            : { latitude: null, longitude: null }

        const {
          location: _location,
          location_place_id: _locationPlaceId,
          location_label: _deprecatedLocationLabel,
          postcode: _deprecatedPostcode,
          ...rest
        } = data

        return {
          id: doc.id,
          ...rest,
          country: publicLocation.country,
          state: publicLocation.state,
          suburb: publicLocation.suburb,
          location: publicLocation,
          location_label,
          thumbnail_url,
          _coords: coords,
        }
      })
    )

    const stripCoords = (listing: { _coords?: CoordinatesOrNull | null }) => {
      const { _coords, ...rest } = listing
      return rest
    }

    if (!shouldSortByNearest) {
      return NextResponse.json(listingsWithImages.map(stripCoords))
    }

    const userCoords = { latitude, longitude }
    const withDistance = listingsWithImages.map((listing) => {
      const coords = listing._coords
      const distanceKm =
        coords && coords.latitude !== null && coords.longitude !== null
          ? calculateDistanceKm(userCoords, {
              latitude: coords.latitude,
              longitude: coords.longitude,
            })
          : Number.POSITIVE_INFINITY

      const { _coords, ...rest } = listing
      return { ...rest, distanceKm: Number.isFinite(distanceKm) ? distanceKm : null }
    })

    withDistance.sort((a, b) => {
      const aDistance = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY
      const bDistance = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY
      return aDistance - bDistance
    })

    const start = (page - 1) * limitCount
    const sliced = withDistance.slice(start, start + limitCount)

    return NextResponse.json(sliced)
  } catch (err) {
    console.error('Error retrieving listings:', err)
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}
