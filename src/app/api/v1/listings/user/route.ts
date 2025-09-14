// src/app/api/v1/listings/user/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getFirestore } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import {ListingDoc} from '@/lib/types/listing'
import { buildImageUrlFromId } from '@/lib/utils'

initAdmin()

export async function GET(req: NextRequest) {
  try {
    // --- Auth (current user) ---
    const authHeader =
      req.headers.get('authorization') ?? req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    }

    let uid: string
    try {
      const decoded = await getAuth().verifyIdToken(token)
      uid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // --- Query user-owned listings ---
    const firestore = getFirestore()
    const col = firestore.collection('listings')

    // Owner field assumed to be `user_id` (based on your detail route).
    // If you use a different field (e.g., `owner_uid`), change it here.
    const snap = await col.where('user_id', '==', uid).get()

    // --- Shape response per listing (mirror your detail route semantics) ---
    const listings = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() || {}

        const imageIds: string[] = Array.isArray(data.image_ids)
          ? data.image_ids
          : []

        const interestedUserIds: string[] = Array.isArray(
          data.interested_users_uids
        )
          ? data.interested_users_uids
          : []

        const image_urls = (
          await Promise.all(
            imageIds.map(async (imageId: string) => {
              try {
                return await buildImageUrlFromId(imageId)
              } catch (err) {
                console.warn(`Failed to generate URL for image ${imageId}`, err)
                return null
              }
            })
          )
        ).filter(Boolean) as string[]

        const privatizedData = data as ListingDoc

        // Remove sensitive fields before sending to client
        const { interested_users_uids: _unused1, user_id: _unused2, ...publicData } = privatizedData;

        return {
          ...publicData,
          image_urls,
          interested_user_count: interestedUserIds.length,
          has_registered_interest: interestedUserIds.includes(uid),
        }
      })
    )

    return NextResponse.json({ listings })
  } catch (err) {
    console.error('Error fetching user listings:', err)
    return NextResponse.json(
      { error: 'Failed to fetch user listings' },
      { status: 500 }
    )
  }
}