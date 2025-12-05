// app/api/v1/listings/user/interested/route.ts
import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import {
  FieldPath,
  getFirestore,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  DocumentData,
} from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import { buildImageUrlFromId } from '@/lib/utils'
import { formatPublicLocationLabel, toPublicLocation } from '@/lib/types/listing'

export const runtime = 'nodejs'          // firebase-admin requires Node.js runtime
export const dynamic = 'force-dynamic'   // avoid static caching of 404s, etc.

initAdmin()

export async function GET(req: Request) {
  try {
    // ---- Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const idToken = authHeader.slice('Bearer '.length)
    const decoded = await getAuth().verifyIdToken(idToken)
    const userId = decoded.uid

    // ---- Query params
    const url = new URL(req.url)
    const limitParam = Number(url.searchParams.get('limit') ?? '20')
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitParam) ? limitParam : 20))

    const cursorCreatedAtIso = url.searchParams.get('cursor_created_at') // ISO string expected
    const cursorId = url.searchParams.get('cursor_id') ?? undefined

    const parseIsoToMillis = (s?: string | null): number | null => {
      if (!s) return null
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d.getTime()
    }
    const cursorMillis = parseIsoToMillis(cursorCreatedAtIso)

    // ---- Firestore
    const db = getFirestore()

    // 1) Read user profile to get interested listing IDs
    const userRef = db.collection('users').doc(userId)
    const userSnap = await userRef.get()
    const interestedField = userSnap.get('interested_listings')
    const interestedIds: string[] = Array.isArray(interestedField)
      ? (interestedField.filter((x): x is string => typeof x === 'string'))
      : []

    if (interestedIds.length === 0) {
      return NextResponse.json(
        { success: true, listings: [], next_cursor: null },
        { status: 200 }
      )
    }

    // 2) Fetch listings for those IDs without composite indexes
    // Firestore 'in' queries support up to 10 IDs per query; chunk if needed.
    const chunkSize = 10
    const chunks: string[][] = []
    for (let i = 0; i < interestedIds.length; i += chunkSize) {
      chunks.push(interestedIds.slice(i, i + chunkSize))
    }

    // Use the base type that both single gets and query docs conform to
    const listingsDocs: Array<DocumentSnapshot<DocumentData>> = []

    for (const ids of chunks) {
      if (ids.length === 1) {
        const doc = await db.collection('listings').doc(ids[0]).get()
        if (doc.exists) listingsDocs.push(doc)
      } else {
        const snap = await db
          .collection('listings')
          .where(FieldPath.documentId(), 'in', ids)
          .get()
        // QueryDocumentSnapshot is a subtype of DocumentSnapshot, spread is fine
        listingsDocs.push(...(snap.docs as QueryDocumentSnapshot<DocumentData>[]))
      }
    }

    const toIso = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Timestamp) return v.toDate().toISOString()
      if (v instanceof Date) return v.toISOString()
      if (typeof v === 'string') {
        const d = new Date(v)
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      if (typeof v === 'object' && v !== null && 'toDate' in v) {
        const maybe = v as { toDate: () => Date }
        try {
          return maybe.toDate().toISOString()
        } catch {
          return null
        }
      }
      return null
    }

    const toMillis = (v: unknown): number => {
      if (!v) return 0
      if (v instanceof Timestamp) return v.toMillis()
      if (v instanceof Date) return v.getTime()
      if (typeof v === 'string') {
        const d = new Date(v)
        return Number.isNaN(d.getTime()) ? 0 : d.getTime()
      }
      if (typeof v === 'object' && v !== null && 'toDate' in v) {
        const maybe = v as { toDate: () => Date }
        try {
          const d = maybe.toDate()
          return d instanceof Date ? d.getTime() : 0
        } catch {
          return 0
        }
      }
      return 0
    }

    // 3) Map and sort in-memory by created_at desc then id desc
    // Use let so we can reassign when applying cursor filtering
    let listings = listingsDocs
      .filter((d) => d && d.exists)
      .map((d) => {
        const data = d.data() as DocumentData | undefined
        const created = data?.created_at ?? data?.updated_at ?? null

        const rawInterested = data?.interested_users_uids
        const interestedUserIds: string[] = Array.isArray(rawInterested)
          ? rawInterested.filter((x: unknown): x is string => typeof x === 'string')
          : []

        const ownerUserId = typeof data?.user_id === 'string' ? data.user_id : null
        const interested_user_count = interestedUserIds.filter(
          (uid) => uid !== ownerUserId
        ).length

        const publicLocation = toPublicLocation({
          location: (data?.location as { suburb?: unknown; state?: unknown; country?: unknown } | null) ?? null,
          country: data?.country,
          state: data?.state,
          suburb: data?.suburb,
        })
        const location_label = formatPublicLocationLabel(publicLocation)

        return {
          id: d.id,
          title: typeof data?.title === 'string' ? data.title : '',
          description: typeof data?.description === 'string' ? data.description : '',
          category: typeof data?.category === 'string' ? data.category : '',
          exchange_type: typeof data?.exchange_type === 'string' ? data.exchange_type : '',
          status: typeof data?.status === 'string' ? data.status : 'available',
          created_at: created,
          created_at_iso: toIso(created),
          image_ids: Array.isArray(data?.image_ids)
            ? data!.image_ids.filter((x: unknown): x is string => typeof x === 'string')
            : [],
          thumbnail_id: typeof data?.thumbnail_id === 'string' ? data.thumbnail_id : null,
          user_id: ownerUserId,
          location: publicLocation,
          location_label,
          interested_user_count,
          has_registered_interest: true,
        }
      })

    listings.sort((a, b) => {
      const am = toMillis(a.created_at)
      const bm = toMillis(b.created_at)
      if (am !== bm) return bm - am // desc
      // tie-breaker: id desc (to keep stable ordering)
      return b.id.localeCompare(a.id)
    })

    // 4) Apply cursor (created_at ISO + id) in-memory
    if (cursorMillis != null && cursorId) {
      listings = listings.filter((r) => {
        const rm = toMillis(r.created_at)
        if (rm === cursorMillis) {
          return r.id.localeCompare(cursorId) < 0 // id desc pagination
        }
        return rm < cursorMillis
      })
    }

    const page = listings.slice(0, limit)
    const enrichedPage = await Promise.all(
      page.map(async (r) => ({
        ...r,
        image_urls: Array.isArray(r.image_ids)
          ? await Promise.all(r.image_ids.map(buildImageUrlFromId))
          : [],
      }))
    )
    const hasMore = listings.length > page.length

    const last = page[page.length - 1]
    const nextCursor =
      hasMore && last
        ? {
            cursor_created_at: last.created_at_iso,
            cursor_id: last.id,
          }
        : null

    return NextResponse.json(
      { success: true, listings: enrichedPage, next_cursor: nextCursor },
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error('[interested] error:', err)
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
