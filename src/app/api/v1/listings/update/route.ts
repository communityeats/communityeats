import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'

initAdmin() // Ensure initialized once

const categories = ['home', 'share', 'coop'] as const
const exchangeTypes = ['swap', 'gift', 'pay'] as const
const statuses = ['available', 'claimed', 'closed'] as const

type Category = (typeof categories)[number]
type ExchangeType = (typeof exchangeTypes)[number]
type Status = (typeof statuses)[number]

type PatchPayload = {
  id: string
  title?: string
  description?: string
  category?: Category | string
  exchange_type?: ExchangeType | string
  status?: Status | string
  location?: {
    country?: string
    state?: string
    suburb?: string
    postcode?: number | string
  }
}

/**
 * POST /api/v1/listings/update
 * Body: { id, title?, description?, category?, exchange_type?, status?, location? }
 * Auth: Bearer <idToken>
 */
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

    const existing = snap.data() || {}
    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: not the owner' }, { status: 403 })
    }

    // ---- Prepare partial update
    const update: Record<string, any> = {}
    const errors: string[] = []

    // Normalize helper: only set field if value is a non-empty string
    const maybeSetString = (key: string, val?: unknown, toLower = true) => {
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if (trimmed.length > 0) {
          update[key] = toLower ? trimmed.toLowerCase() : trimmed
        }
      }
    }

    // title / description (lowercased like your create route)
    maybeSetString('title', data.title)
    maybeSetString('description', data.description)

    // category
    if (typeof data.category === 'string' && data.category.trim()) {
      const c = data.category.trim()
      if (!categories.includes(c as Category)) {
        errors.push('Invalid category')
      } else {
        update.category = c
      }
    }

    // exchange_type
    if (typeof data.exchange_type === 'string' && data.exchange_type.trim()) {
      const e = data.exchange_type.trim()
      if (!exchangeTypes.includes(e as ExchangeType)) {
        errors.push('Invalid exchange type')
      } else {
        update.exchange_type = e
      }
    }

    // status
    if (typeof data.status === 'string' && data.status.trim()) {
      const s = data.status.trim()
      if (!statuses.includes(s as Status)) {
        errors.push('Invalid status')
      } else {
        update.status = s
      }
    }

    // location (merge semantics)
    if (data.location && typeof data.location === 'object') {
      const locUpdate: Record<string, any> = {}
      if (typeof data.location.country === 'string') {
        maybeSetString('location.country', data.location.country)
        if ('location.country' in update) locUpdate.country = update['location.country']
      }
      if (typeof data.location.state === 'string') {
        maybeSetString('location.state', data.location.state)
        if ('location.state' in update) locUpdate.state = update['location.state']
      }
      if (typeof data.location.suburb === 'string') {
        maybeSetString('location.suburb', data.location.suburb)
        if ('location.suburb' in update) locUpdate.suburb = update['location.suburb']
      }
      if (
        typeof data.location.postcode === 'string' ||
        typeof data.location.postcode === 'number'
      ) {
        const n = Number(data.location.postcode)
        if (Number.isFinite(n) && n >= 0) {
          update['location.postcode'] = n
          locUpdate.postcode = n
        } else {
          errors.push('Invalid postcode')
        }
      }

      // For convenience, also reflect top-level synonyms if you keep them in your create route
      // (country/state/suburb/postcode duplicated at top level)
      if (locUpdate.country) update.country = locUpdate.country
      if (locUpdate.state) update.state = locUpdate.state
      if (locUpdate.suburb) update.suburb = locUpdate.suburb
      if (typeof locUpdate.postcode === 'number') update.postcode = locUpdate.postcode
    }

    if (errors.length) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
    }

    // Always bump updated_at
    update.updated_at = new Date().toISOString()

    // Bail if nothing to update
    const keysToWrite = Object.keys(update)
    if (keysToWrite.length === 1 && keysToWrite[0] === 'updated_at') {
      return NextResponse.json({ success: true, id, updated: existing }, { status: 200 })
    }

    // Write (partial)
    await docRef.update(update)

    // Return merged view (existing + update)
    const updatedSnap = await docRef.get()
    const updatedDoc = { id: updatedSnap.id, ...updatedSnap.data() }

    return NextResponse.json({ success: true, id, updated: updatedDoc }, { status: 200 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}