import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'

initAdmin()

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params
    console.log('Claiming listing with ID:', listingId)

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAuth().verifyIdToken(idToken)
    const userId = decodedToken.uid

    const firestore = getFirestore()
    const listingRef = firestore.collection('listings').doc(listingId)
    const userRef = firestore.collection('users').doc(userId)

    await firestore.runTransaction(async (tx) => {
      // 1) Validate listing & owner
      const listingSnap = await tx.get(listingRef)
      if (!listingSnap.exists) {
        throw new Error('Listing not found')
      }

      const data = listingSnap.data() as Record<string, any> | undefined
      const ownerId: string | undefined = data?.user_id
      const interestedUsers: string[] = Array.isArray(data?.interested_users_uids)
        ? data!.interested_users_uids
        : []

      if (ownerId && ownerId === userId) {
        throw new Error('Cannot register interest in own listing')
      }

      const alreadyInterested = interestedUsers.includes(userId)

      // Read user doc BEFORE any write
      const userSnap = await tx.get(userRef)

      // 2) Update listing (only if not already interested)
      if (!alreadyInterested) {
        tx.update(listingRef, {
          interested_users_uids: [...interestedUsers, userId],
          updated_at: new Date().toISOString(),
        })
      }

      // 3) Upsert into users/{userId}.interested_listings
      if (!userSnap.exists) {
        // Create with defaults + interested_listings containing listingId
        tx.set(userRef, {
          name: '',
          interested_listings: [listingId],
        })
      } else {
        // Append idempotently
        tx.update(userRef, {
          interested_listings: FieldValue.arrayUnion(listingId),
        })
      }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error('Error claiming listing:', err)
    const message = String(err?.message || 'Internal error')
    const status =
      message === 'Listing not found'
        ? 404
        : message === 'Cannot register interest in own listing'
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}