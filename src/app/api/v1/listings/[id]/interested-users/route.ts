import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import {
  FieldPath,
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  getFirestore,
} from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import type { ListingDoc } from '@/lib/types/listing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

initAdmin()

type InterestedUser = {
  uid: string
  name: string | null
  email: string | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.slice('Bearer '.length).trim()
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let requesterUid: string
    try {
      const decoded = await getAuth().verifyIdToken(idToken)
      requesterUid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const firestore = getFirestore()
    const listingSnap = await firestore.collection('listings').doc(listingId).get()
    if (!listingSnap.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const listing = listingSnap.data() as ListingDoc | undefined
    const ownerUid = listing?.user_id
    if (!ownerUid || ownerUid !== requesterUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rawInterested = listing?.interested_users_uids
    const interestedIds = Array.isArray(rawInterested)
      ? rawInterested
          .map((uid) => (typeof uid === 'string' ? uid.trim() : null))
          .filter((uid): uid is string => !!uid && uid !== ownerUid)
      : []

    if (interestedIds.length === 0) {
      return NextResponse.json({ interested_users: [] as InterestedUser[] }, { status: 200 })
    }

    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    const userDocs: Array<DocumentSnapshot<DocumentData>> = []
    const userCollection = firestore.collection('users')
    for (const ids of chunk([...new Set(interestedIds)], 10)) {
      if (ids.length === 1) {
        const snap = await userCollection.doc(ids[0]).get()
        if (snap.exists) userDocs.push(snap)
        continue
      }

      const querySnap = await userCollection
        .where(FieldPath.documentId(), 'in', ids)
        .get()
      userDocs.push(...(querySnap.docs as QueryDocumentSnapshot<DocumentData>[]))
    }

    const interestedUsers: InterestedUser[] = userDocs.map((doc) => {
      const data = doc.data() ?? {}
      const name = typeof data.name === 'string' ? data.name.trim() : ''
      const email = typeof data.email === 'string' ? data.email.trim() : ''

      return {
        uid: doc.id,
        name: name || null,
        email: email || null,
      }
    })

    // Preserve the order from the listing document
    interestedUsers.sort((a, b) => {
      const aIndex = interestedIds.indexOf(a.uid)
      const bIndex = interestedIds.indexOf(b.uid)
      return aIndex - bIndex
    })

    return NextResponse.json({ interested_users: interestedUsers }, { status: 200 })
  } catch (err) {
    console.error('[listings/interested-users] error', err)
    return NextResponse.json({ error: 'Failed to load interested users' }, { status: 500 })
  }
}
