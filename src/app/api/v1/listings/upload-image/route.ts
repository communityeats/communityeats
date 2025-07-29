// app/api/v1/listings/upload-image/route.ts

import { NextResponse } from 'next/server'
import { getAuth, getStorage, initAdmin } from '@/lib/firebase/admin'
import { v4 as uuidv4 } from 'uuid'

initAdmin() // Ensure initialized once

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.split('Bearer ')[1]
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  let uid = ''
  try {
    const decoded = await getAuth().verifyIdToken(token)
    uid = decoded.uid
  } catch (err) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filename = `${uuidv4()}_${file.name}`
  const filePath = `listings/${filename}`

  const bucket = getStorage().bucket()
  const fileRef = bucket.file(filePath)

  try {
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    })

    // Optional: make public or generate signed URL
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })

    return NextResponse.json({ id: filename, url })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}