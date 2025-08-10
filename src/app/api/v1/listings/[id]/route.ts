import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getFirestore, getStorage } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'

initAdmin()

const generateImageURL = async (imageId: string) => {
  const filePath = `listings/${imageId}`
  const [url] = await getStorage().bucket().file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })
  return url
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id

    const authHeader = _req.headers.get('authorization')
    const token = authHeader?.split('Bearer ')[1]

    let userId: string | null = null

    if (token) {
      try {
        const decodedToken = await getAuth().verifyIdToken(token)
        userId = decodedToken.uid
      } catch (err) {
        console.warn('Failed to verify token:', err)
      }
    }

    console.log('Fetching listing detail for ID:', id)
    const firestore = getFirestore()
    const docRef = firestore.collection('listings').doc(id)
    const docSnap = await docRef.get()
    console.log('Document snapshot:', docSnap.exists, docSnap.id)

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const data = docSnap.data()
    if (!data) {
      return NextResponse.json({ error: 'No data for listing' }, { status: 500 })
    }

    const imageIds = Array.isArray(data.image_ids) ? data.image_ids : []
    const interestedUserIds = Array.isArray(data.interested_users_uids)
      ? data.interested_users_uids
      : []

    const image_urls = await Promise.all(
      imageIds.map(async (imageId: string) => {
        try {
          return await generateImageURL(imageId)
        } catch (err) {
          console.warn(`Failed to generate URL for image ${imageId}`, err)
          return null
        }
      })
    )

    const {
      interested_user_ids, // legacy remove
      ...publicData
    } = data

    const ownerUserId = data.user_id as string | undefined
    const isOwner = ownerUserId && userId === ownerUserId
    const interested_user_count = interestedUserIds.filter((uid: string) => uid !== ownerUserId).length
    const has_registered_interest = userId ? (interestedUserIds.includes(userId) && !isOwner) : false

    console.log("owner_user_id:", ownerUserId, "interested_users_uids:", interestedUserIds)

    return NextResponse.json({
      id: docSnap.id,
      ...publicData,
      user_id: ownerUserId,
      image_urls: image_urls.filter(Boolean),
      interested_user_count,
      has_registered_interest,
    })
  } catch (err) {
    console.error('Error fetching listing detail:', err)
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 })
  }
}