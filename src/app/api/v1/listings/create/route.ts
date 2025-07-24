import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'

initAdmin() // Ensure initialized once

const categories = ['home', 'share', 'coop']
const exchangeTypes = ['swap', 'gift', 'pay']

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decoded = await getAuth().verifyIdToken(idToken)
    const userId = decoded.uid

    const data = await req.json()

    console.log('Received data:', data)
    if (!data || typeof data !== 'object') {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Validate required fields
    const requiredFields = ['title', 'description', 'category', 'exchange_type', 'thumbnail_id', 'image_ids']
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
      }
    }

    if (!categories.includes(data.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    if (!exchangeTypes.includes(data.exchange_type)) {
      return NextResponse.json({ error: 'Invalid exchange type' }, { status: 400 })
    }

    if (!Array.isArray(data.image_ids) || !data.image_ids.includes(data.thumbnail_id)) {
      return NextResponse.json({ error: 'Thumbnail must be one of the image IDs' }, { status: 400 })
    }

    const firestore = getFirestore()

    const listingDoc = {
      user_id: userId,
      title: data.title.toLowerCase(),
      description: data.description.toLowerCase(),
      location: {
        country: data.country?.toLowerCase() ?? '',
        state: data.state?.toLowerCase() ?? '',
        suburb: data.suburb?.toLowerCase() ?? '',
        postcode: Number(data.postcode ?? 0),
      },
      country: data.country?.toLowerCase() ?? '',
      state: data.state?.toLowerCase() ?? '',
      suburb: data.suburb?.toLowerCase() ?? '',
      postcode: Number(data.postcode ?? 0),
      category: data.category,
      exchange_type: data.exchange_type,
      contact_info: data.contact_info ?? null,
      image_ids: data.image_ids,
      thumbnail_id: data.thumbnail_id,
      anonymous: Boolean(data.anonymous),
      created_at: new Date().toISOString()
    }

    const docRef = await firestore.collection('listings').add(listingDoc)
    

    return NextResponse.json({ success: true, id: docRef.id }, { status: 201 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}