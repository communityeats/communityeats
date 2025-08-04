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
    console.log('Claiming listing with ID:', await params.id)
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAuth().verifyIdToken(idToken)
    const userId = decodedToken.uid

    params = await params // Ensure params are awaited
    const listingId = await params.id
    const firestore = getFirestore()
    const listingRef = firestore.collection('listings').doc(listingId)

    await firestore.runTransaction(async (tx) => {
      const docSnap = await tx.get(listingRef)
      if (!docSnap.exists) {
        throw new Error('Listing not found')
      }

      const data = docSnap.data()
      const interestedUsers = Array.isArray(data?.interested_users_uids)
        ? data!.interested_users_uids
        : []

      if (interestedUsers.includes(userId)) {
        // Already claimed/interested
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
    const status = err.message === 'Listing not found' ? 404 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}