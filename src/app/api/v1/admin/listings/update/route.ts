import { NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import { AdminAuthError, verifyAdminToken } from '@/lib/admin/auth'
import { isListingStatus } from '@/lib/types/listing'

initAdmin()

type Body = {
  id?: string
  status?: string
}

export async function POST(req: Request) {
  try {
    await verifyAdminToken(req.headers.get('authorization'))

    const body = (await req.json().catch(() => ({}))) as Body
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const status = typeof body.status === 'string' ? body.status.trim() : ''

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
    }

    if (!isListingStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const db = getFirestore()
    const docRef = db.collection('listings').doc(id)
    const existing = await docRef.get()

    if (!existing.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    await docRef.update({
      status,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, id, status }, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }

    console.error('Admin update listing failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
