import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getFirestore, getStorage } from '@/lib/firebase/admin'

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
    params = await params // Ensure params are awaited
    const id = await params.id // Ensure id is awaited
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
      user_id, // remove
      interested_user_ids, // remove
      ...publicData
    } = data

    return NextResponse.json({
      id: docSnap.id,
      ...publicData,
      image_urls: image_urls.filter(Boolean),
      interested_user_count: interestedUserIds.length,
    })
  } catch (err) {
    console.error('Error fetching listing detail:', err)
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 })
  }
}