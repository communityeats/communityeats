import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import { AdminAuthError, verifyAdminToken } from '@/lib/admin/auth'
import {
  LISTING_STATUSES,
  formatPublicLocationLabel,
  toPublicLocation,
  type ListingStatus,
} from '@/lib/types/listing'

initAdmin()

const statusOptions = new Set<ListingStatus | 'all'>(['all', ...LISTING_STATUSES])

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req.headers.get('authorization'))

    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') ?? 'all') as ListingStatus | 'all'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)

    const db = getFirestore()
    let query = db.collection('listings').orderBy('created_at', 'desc')

    if (statusOptions.has(status) && status !== 'all') {
      query = query.where('status', '==', status)
    }

    const snapshot = await query.limit(limit).get()

    const listings = snapshot.docs.map((doc) => {
      const data = doc.data()
      const publicLocation = toPublicLocation({
        location: (data as { location?: { suburb?: unknown; state?: unknown; country?: unknown } }).location,
        country: (data as { country?: unknown }).country,
        state: (data as { state?: unknown }).state,
        suburb: (data as { suburb?: unknown }).suburb,
      })
      const location = formatPublicLocationLabel(publicLocation)

      const interested = Array.isArray((data as { interested_users_uids?: unknown }).interested_users_uids)
        ? ((data as { interested_users_uids: unknown[] }).interested_users_uids.length ?? 0)
        : 0

      return {
        id: doc.id,
        title: (data as { title?: string }).title ?? '',
        status: (data as { status?: string }).status ?? '',
        exchange_type: (data as { exchange_type?: string }).exchange_type ?? null,
        user_id: (data as { user_id?: string }).user_id ?? null,
        created_at: (data as { created_at?: string }).created_at ?? null,
        location_label: location,
        interested_count: interested,
      }
    })

    return NextResponse.json({ listings }, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }

    console.error('Admin listings fetch failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
