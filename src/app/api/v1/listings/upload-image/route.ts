// app/api/v1/listings/upload-image/route.ts

import { NextResponse } from 'next/server'
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage'
import { getAuth, initAdmin } from '@/lib/firebase/admin'
import { v4 as uuidv4 } from 'uuid'

const admin = initAdmin() // Ensure initialized once

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
  const buffer = new Uint8Array(bytes)

  const uniqueId = uuidv4()
  const filename = `${uniqueId}_${file.name}`
  const storage = getStorage();
  const storageRef = ref(storage, `listings/${uid}/${filename}`)

  try {
    await uploadBytes(storageRef, buffer)
    const url = await getDownloadURL(storageRef)
    return NextResponse.json({ id: filename, url })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}