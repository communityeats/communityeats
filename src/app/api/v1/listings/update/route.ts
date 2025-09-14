import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import type { ListingDoc } from '@/lib/types/listing'

initAdmin()

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
      if (!categories.includes(c as Category)) {
        errors.push('Invalid category')
      } else {
        updatePaths['category'] = c
      }
    }

    // exchange_type
    if (typeof data.exchange_type === 'string' && data.exchange_type.trim()) {
      const e = data.exchange_type.trim()
      if (!exchangeTypes.includes(e as ExchangeType)) {
        errors.push('Invalid exchange type')
      } else {
        updatePaths['exchange_type'] = e
      }
    }

    // status
    if (typeof data.status === 'string' && data.status.trim()) {
      const s = data.status.trim()
      if (!statuses.includes(s as Status)) {
        errors.push('Invalid status')
      } else {
        updatePaths['status'] = s
      }
    }

    // location (dot-notation only; avoids keyof ListingDoc issues)
    if (data.location && typeof data.location === 'object') {
      if (typeof data.location.country === 'string' && data.location.country.trim()) {
        updatePaths['location.country'] = data.location.country.trim().toLowerCase()
      }
      if (typeof data.location.state === 'string' && data.location.state.trim()) {
        updatePaths['location.state'] = data.location.state.trim().toLowerCase()
      }
      if (typeof data.location.suburb === 'string' && data.location.suburb.trim()) {
        updatePaths['location.suburb'] = data.location.suburb.trim().toLowerCase()
      }
      if (
        typeof data.location.postcode === 'string' ||
        typeof data.location.postcode === 'number'
      ) {
        const n = Number(data.location.postcode)
        if (Number.isFinite(n) && n >= 0) {
          updatePaths['location.postcode'] = n
        } else {
          errors.push('Invalid postcode')
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