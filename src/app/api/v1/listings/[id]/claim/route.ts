import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'

initAdmin()

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = params.id
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

    await firestore.runTransaction(async (tx) => {
      const docSnap = await tx.get(listingRef)
      if (!docSnap.exists) {
        throw new Error('Listing not found')
      }

      const data = docSnap.data() as Record<string, any> | undefined
      const ownerId: string | undefined = data?.user_id
      const interestedUsers: string[] = Array.isArray(data?.interested_users_uids)
        ? data!.interested_users_uids
        : []

      // Prevent a user from being interested in their own listing
      if (ownerId && ownerId === userId) {
        throw new Error('Cannot register interest in own listing')
      }

      // If already marked interested, no-op
      if (interestedUsers.includes(userId)) {
        return
      }

      tx.update(listingRef, {
        interested_users_uids: [...interestedUsers, userId],
        updated_at: new Date().toISOString(),
      })
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