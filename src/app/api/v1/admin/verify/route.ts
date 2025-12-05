import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { AdminAuthError, verifyAdminToken } from '@/lib/admin/auth'

initAdmin()

export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyAdminToken(req.headers.get('authorization'))

    return NextResponse.json(
      {
        ok: true,
        uid: decoded.uid,
        email: decoded.email ?? null,
        claims: {
          admin: decoded.admin === true,
          role: (decoded as Record<string, unknown>)?.role ?? null,
        },
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }

    console.error('Admin verify failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
