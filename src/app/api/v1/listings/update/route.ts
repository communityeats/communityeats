import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import type { ListingDoc } from '@/lib/types/listing'
import {
  LISTING_CATEGORIES,
  isExchangeType,
  isListingStatus,
  normalizeListingLocation,
  type ListingLocationInput,
} from '@/lib/types/listing'

initAdmin()

type PatchPayload = {
  id: string
  title?: string
  description?: string
  category?: string
  exchange_type?: string
  status?: string
  location?: {
    country?: string
    state?: string
    suburb?: string
    postcode?: number | string
  }
  country?: string
  state?: string
  suburb?: string
  postcode?: number | string
}

export async function POST(req: Request) {
  try {
    // ---- Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const idToken = authHeader.split('Bearer ')[1]
    const decoded = await getAuth().verifyIdToken(idToken)
    const userId = decoded.uid

    // ---- Parse
    const data = (await req.json()) as PatchPayload
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { id } = data
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "id"' }, { status: 400 })
    }

    const firestore = getFirestore()
    const docRef = firestore.collection('listings').doc(id)
    const snap = await docRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const existing = snap.data() as ListingDoc | undefined
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: not the owner' }, { status: 403 })
    }

    // ---- Prepare update payloads
    // Firestore update() accepts dot-notation. Use a free-form record for that.
    const updatePaths: Record<string, unknown> = {}
    const errors: string[] = []

    const maybeSetString = (key: string, val?: unknown, toLower = true) => {
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if (trimmed) {
          updatePaths[key] = toLower ? trimmed.toLowerCase() : trimmed
        }
      }
    }

    // title / description
    maybeSetString('title', data.title)           // if you really want lowercasing, keep toLower=true
    maybeSetString('description', data.description)

    // category
    if (typeof data.category === 'string' && data.category.trim()) {
      const c = data.category.trim()
      if (!LISTING_CATEGORIES.includes(c)) {
        errors.push('Invalid category')
      } else {
        updatePaths['category'] = c
      }
    }

    // exchange_type
    if (typeof data.exchange_type === 'string' && data.exchange_type.trim()) {
      const e = data.exchange_type.trim()
      if (!isExchangeType(e)) {
        errors.push('Invalid exchange type')
      } else {
        updatePaths['exchange_type'] = e
      }
    }

    // status
    if (typeof data.status === 'string' && data.status.trim()) {
      const s = data.status.trim()
      if (!isListingStatus(s)) {
        errors.push('Invalid status')
      } else {
        updatePaths['status'] = s
      }
    }

    // location (dot-notation only; avoids keyof ListingDoc issues)
    if (data.location && typeof data.location === 'object') {
      const loc = data.location as ListingLocationInput
      const normalized = normalizeListingLocation(loc)

      if ('country' in loc) {
        if (!normalized.country) {
          errors.push('Invalid location.country')
        } else {
          updatePaths['location.country'] = normalized.country
          updatePaths['country'] = normalized.country
        }
      }

      if ('state' in loc) {
        if (!normalized.state) {
          errors.push('Invalid location.state')
        } else {
          updatePaths['location.state'] = normalized.state
          updatePaths['state'] = normalized.state
        }
      }

      if ('suburb' in loc) {
        if (!normalized.suburb) {
          errors.push('Invalid location.suburb')
        } else {
          updatePaths['location.suburb'] = normalized.suburb
          updatePaths['suburb'] = normalized.suburb
        }
      }

      if ('postcode' in loc) {
        if (normalized.postcode <= 0) {
          errors.push('Invalid location.postcode')
        } else {
          updatePaths['location.postcode'] = normalized.postcode
          updatePaths['postcode'] = normalized.postcode
        }
      }

      if (Object.prototype.hasOwnProperty.call(loc, 'place_id')) {
        if (normalized.place_id) {
          updatePaths['location.place_id'] = normalized.place_id
          updatePaths['location_place_id'] = normalized.place_id
        } else {
          updatePaths['location.place_id'] = null
          updatePaths['location_place_id'] = null
        }
      }

      if (Object.prototype.hasOwnProperty.call(loc, 'label')) {
        if (normalized.label) {
          updatePaths['location.label'] = normalized.label
          updatePaths['location_label'] = normalized.label
        } else {
          updatePaths['location.label'] = null
          updatePaths['location_label'] = null
        }
      }

      if (Object.prototype.hasOwnProperty.call(loc, 'latitude')) {
        if (typeof normalized.latitude === 'number') {
          updatePaths['location.latitude'] = normalized.latitude
        } else {
          updatePaths['location.latitude'] = null
        }
      }

      if (Object.prototype.hasOwnProperty.call(loc, 'longitude')) {
        if (typeof normalized.longitude === 'number') {
          updatePaths['location.longitude'] = normalized.longitude
        } else {
          updatePaths['location.longitude'] = null
        }
      }
    }

    if (errors.length) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
    }

    // Always bump updated_at
    updatePaths['updated_at'] = new Date().toISOString()

    // Bail if nothing to update (only updated_at present and unchanged)
    const keysToWrite = Object.keys(updatePaths)
    if (keysToWrite.length === 1 && keysToWrite[0] === 'updated_at') {
      return NextResponse.json({ success: true, id, updated: existing }, { status: 200 })
    }

    // Write (partial)
    await docRef.update(updatePaths)

    // Return merged view
    const updatedSnap = await docRef.get()
    const updatedDoc = { id: updatedSnap.id, ...(updatedSnap.data() as object) }

    return NextResponse.json({ success: true, id, updated: updatedDoc }, { status: 200 })
  } catch (err: unknown) {
    console.error('Error updating listing:', err)
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
