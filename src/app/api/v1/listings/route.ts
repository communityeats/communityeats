import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getFirestore } from '@/lib/firebase/admin'
import { buildImageUrlFromId } from '@/lib/utils'

initAdmin()

export async function GET(req: NextRequest) {
  try {
    const firestore = getFirestore()
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status') ?? 'available'
    const limitCount = parseInt(searchParams.get('limit') || '20', 10)

    const snapshot = await firestore
      .collection('listings')
      .where('status', '==', status)
      .orderBy('created_at', 'desc')
      .limit(limitCount)
      .get()

    const listingsWithImages = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data()
        const uid = data.user_id
        const thumbId = data.thumbnail_id

        let thumbnail_url = null
        try {
          if (uid && thumbId) {
            thumbnail_url = await buildImageUrlFromId(thumbId)
          }
        } catch (err) {
          console.warn(`Image missing for listing ${doc.id}`, err)
        }

        return {
          id: doc.id,
          ...data,
          thumbnail_url,
        }
      })
    )

    return NextResponse.json(listingsWithImages)
  } catch (err) {
    console.error('Error retrieving listings:', err)
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}