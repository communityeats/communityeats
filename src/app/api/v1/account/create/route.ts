import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import { normalizeUsername } from '@/lib/listingSlug'

initAdmin()

type Body = {
  name?: string
  email?: string
  username?: string
  acceptedTerms?: unknown
  acceptedPrivacy?: unknown
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decoded = await getAuth().verifyIdToken(idToken)
    const uid = decoded.uid
    const tokenEmail = decoded.email ?? null

    const body: Body = await req.json().catch(() => ({}))
    const rawName = typeof body.name === 'string' ? body.name : ''
    const rawEmail = typeof body.email === 'string' ? body.email : ''
    const rawUsername = typeof body.username === 'string' ? body.username : ''
    const acceptedTerms = body.acceptedTerms === true
    const acceptedPrivacy = body.acceptedPrivacy === true

    const name = rawName.trim()
    const email = rawEmail.trim()
    const username = normalizeUsername(rawUsername)

    // Basic validation
    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: 'Invalid name. Provide a non-empty name up to 100 characters.' },
        { status: 400 }
      )
    }

    if (!username) {
      return NextResponse.json(
        {
          error:
            'Invalid username. Use 3-30 characters with letters, numbers, or hyphens.',
        },
        { status: 400 }
      )
    }

    if (!acceptedTerms || !acceptedPrivacy) {
      return NextResponse.json(
        { error: 'You must accept the Terms & Conditions and Privacy Policy to create an account.' },
        { status: 400 }
      )
    }

    // If the token has an email, require it to match to prevent spoofing.
    if (tokenEmail && email && email.toLowerCase() !== tokenEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email mismatch between provided value and authenticated user.' },
        { status: 400 }
      )
    }

    const finalEmail = (tokenEmail ?? email).trim()
    if (!finalEmail) {
      return NextResponse.json(
        { error: 'Email is required (either in the token or the request body).' },
        { status: 400 }
      )
    }

    const db = getFirestore()
    const userRef = db.collection('users').doc(uid)

    const usernameSnap = await db
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get()
    if (!usernameSnap.empty && usernameSnap.docs[0].id !== uid) {
      return NextResponse.json({ error: 'Username is already taken.' }, { status: 400 })
    }

    // Decide 200 vs 201 by checking existence
    const existing = await userRef.get()
    const existingTermsAt = existing.exists ? existing.get('accepted_terms_at') ?? null : null
    const existingPrivacyAt = existing.exists ? existing.get('accepted_privacy_at') ?? null : null
    await userRef.set(
      {
        name,
        username,
        email: finalEmail,
        email_verified: !!decoded.email_verified,
        accepted_terms: true,
        accepted_privacy: true,
        accepted_terms_at: existingTermsAt ?? FieldValue.serverTimestamp(),
        accepted_privacy_at: existingPrivacyAt ?? FieldValue.serverTimestamp(),
        // server timestamps for consistent ordering
        updated_at: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    )

    return NextResponse.json(
      {
        success: true,
        userId: uid,
        message: existing.exists ? 'User updated' : 'User created',
      },
      { status: existing.exists ? 200 : 201 }
    )
  } catch (err: unknown) {
    console.error('Error creating/updating user:', err)

    let message = 'Internal error'
    if (err instanceof Error) {
      message = err.message
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
