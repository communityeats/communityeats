// app/api/v1/listings/user/interested/route.ts
import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import {
  FieldPath,
  getFirestore,
  Timestamp,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

export const runtime = 'nodejs'          // firebase-admin requires Node.js runtime
export const dynamic = 'force-dynamic'   // avoid static caching of 404s, etc.

initAdmin()

const generateImageURL = async (imageId: string) => {
  const filePath = `listings/${imageId}`
  const [url] = await getStorage().bucket().file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })
  return url
}

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
    const limitParam = Number(url.searchParams.get('limit') || '20')
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitParam) ? limitParam : 20))

    const cursorCreatedAtIso = url.searchParams.get('cursor_created_at') // ISO string expected
    const cursorId = url.searchParams.get('cursor_id') || undefined

    const parseIsoToMillis = (s?: string | null): number | null => {
      if (!s) return null
      const d = new Date(s)
      return isNaN(d.getTime()) ? null : d.getTime()
    }
    const cursorMillis = parseIsoToMillis(cursorCreatedAtIso)

    // ---- Firestore
    const db = getFirestore()

    // 1) Read user profile to get interested listing IDs
    const userRef = db.collection('users').doc(userId)
    const userSnap = await userRef.get()
    const interestedIds: string[] = Array.isArray(userSnap.get('interested_listings'))
      ? (userSnap.get('interested_listings') as string[])
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

    const listingsDocs: QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] = []
    // Prefer 'in' query for efficiency; fallback to individual gets if needed
    for (const ids of chunks) {
      if (ids.length === 1) {
        const doc = await db.collection('listings').doc(ids[0]).get()
        if (doc.exists) {
          // Construct a faux QueryDocumentSnapshot-like object is unnecessary; we can push the DocumentSnapshot
          // but we'll normalize below using .data()/.id, so accept both types
          // To keep types simple, cast when mapping.
          // @ts-ignore
          listingsDocs.push(doc)
        }
      } else {
        const snap = await db
          .collection('listings')
          .where(FieldPath.documentId(), 'in', ids)
          .get()
        listingsDocs.push(...(snap.docs as any))
      }
    }

    type AnyDoc = QueryDocumentSnapshot<FirebaseFirestore.DocumentData>

    const asIso = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Timestamp) return v.toDate().toISOString()
      if (v instanceof Date) return v.toISOString()
      if (typeof v === 'string') {
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d.toISOString()
      }
      // @ts-ignore
      if (typeof v === 'object' && typeof v?.toDate === 'function') {
        try {
          // @ts-ignore
          return v.toDate().toISOString()
        } catch {}
      }
      return null
    }

    const toMillis = (v: unknown): number => {
      if (!v) return 0
      if (v instanceof Timestamp) return v.toMillis()
      if (v instanceof Date) return v.getTime()
      if (typeof v === 'string') {
        const d = new Date(v)
        return isNaN(d.getTime()) ? 0 : d.getTime()
      }
      // @ts-ignore
      if (typeof v === 'object' && typeof v?.toDate === 'function') {
        try {
          // @ts-ignore
          const d = v.toDate()
          return d instanceof Date ? d.getTime() : 0
        } catch {}
      }
      return 0
    }

    // 3) Map and sort in-memory by created_at desc then id desc
    let rows = listingsDocs
      .filter((d) => !!d && d.exists)
      .map((d: AnyDoc) => {
        const data = d.data() as any
        const created = data.created_at ?? data.updated_at ?? null
        const interestedUserIds: string[] = Array.isArray(data.interested_users_uids)
          ? data.interested_users_uids
          : []
        const ownerUserId = data.user_id ?? null
        const interested_user_count = interestedUserIds.filter(
          (uid: string) => uid !== ownerUserId
        ).length
        return {
          id: d.id,
          title: data.title ?? '',
          description: data.description ?? '',
          category: data.category ?? '',
          exchange_type: data.exchange_type ?? '',
          status: data.status ?? 'available',
          created_at: created,
          created_at_iso: asIso(created),
          image_ids: data.image_ids ?? [],
          thumbnail_id: data.thumbnail_id ?? null,
          user_id: data.user_id ?? null,
          location: data.location ?? {},
          interested_user_count,
          has_registered_interest: true,
        }
      })

    rows.sort((a, b) => {
      const am = toMillis(a.created_at)
      const bm = toMillis(b.created_at)
      if (am !== bm) return bm - am // desc
      // tie-breaker: id desc (to keep stable ordering)
      return b.id.localeCompare(a.id)
    })

    // 4) Apply cursor (created_at ISO + id) in-memory
    if (cursorMillis != null && cursorId) {
      rows = rows.filter((r) => {
        const rm = toMillis(r.created_at)
        if (rm === cursorMillis) {
          return r.id.localeCompare(cursorId) < 0 // id desc pagination
        }
        return rm < cursorMillis
      })
    }

    const page = rows.slice(0, limit)
    const enrichedPage = await Promise.all(
      page.map(async (r) => ({
        ...r,
        image_urls: Array.isArray(r.image_ids)
          ? await Promise.all(r.image_ids.map(generateImageURL))
          : [],
      }))
    )
    const hasMore = rows.length > page.length

    const last = page[page.length - 1]
    const nextCursor = hasMore && last
      ? {
          cursor_created_at: last.created_at_iso,
          cursor_id: last.id,
        }
      : null

    return NextResponse.json(
      { success: true, listings: enrichedPage, next_cursor: nextCursor },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('[interested] error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}