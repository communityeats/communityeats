import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import type { MessageDoc } from '@/lib/types/chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

initAdmin()

const MAX_MESSAGE_LENGTH = 2000

const toIso = (input: unknown): string | null => {
  if (!input) return null
  if (typeof input === 'string') {
    const d = new Date(input)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof input === 'number') {
    const d = new Date(input)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof input === 'object' && input !== null && 'toDate' in input) {
    try {
      const maybe = (input as { toDate: () => Date }).toDate()
      return maybe instanceof Date && !Number.isNaN(maybe.getTime()) ? maybe.toISOString() : null
    } catch {
      return null
    }
  }
  return null
}

const resolveAuthUid = async (req: NextRequest): Promise<string | null> => {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is string => item.length > 0)
}

const mapParticipantProfiles = (value: unknown): Record<string, string | null> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([uid, raw]) => {
      if (typeof uid !== 'string' || !uid.trim()) return null
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        return [uid, trimmed.length ? trimmed : null] as const
      }
      return [uid, null] as const
    })
    .filter((item): item is readonly [string, string | null] => item !== null)

  return Object.fromEntries(entries)
}

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const mapMessage = (
  id: string,
  conversationId: string,
  data: FirebaseFirestore.DocumentData
): MessageDoc => ({
  id,
  conversation_id: conversationId,
  author_uid: typeof data?.author_uid === 'string' ? data.author_uid : '',
  body: typeof data?.body === 'string' ? data.body : '',
  created_at: toIso(data?.created_at) ?? toIso(data?.created_at_ms),
  created_at_ms: typeof data?.created_at_ms === 'number' ? data.created_at_ms : null,
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const conversationId = (await params).conversationId
    const requesterUid = await resolveAuthUid(req)
    if (!requesterUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const limitParam = Number(url.searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), 100)
      : 50

    const cursorMsParam = url.searchParams.get('cursor_created_at_ms')
    const cursorMs = cursorMsParam ? Number(cursorMsParam) : null

    const firestore = getFirestore()
    const conversationRef = firestore.collection('conversations').doc(conversationId)
    const conversationSnap = await conversationRef.get()
    if (!conversationSnap.exists) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const participants = sanitizeStringArray(conversationSnap.get('participant_uids'))
    if (!participants.includes(requesterUid)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = conversationRef
      .collection('messages')
      .orderBy('created_at_ms', 'desc')

    if (cursorMs && Number.isFinite(cursorMs)) {
      query = query.where('created_at_ms', '<', cursorMs)
    }

    query = query.limit(limit)

    const snapshot = await query.get()

    const messagesDesc = snapshot.docs.map((doc) => mapMessage(doc.id, conversationId, doc.data()))
    const messages = messagesDesc.slice().reverse()

    const hasMore = snapshot.size === limit
    const oldest = messagesDesc[messagesDesc.length - 1]
    const nextCursor = hasMore && oldest?.created_at_ms
      ? { cursor_created_at_ms: oldest.created_at_ms }
      : null

    const participantProfiles = mapParticipantProfiles(conversationSnap.get('participant_profiles'))
    const listingTitle = sanitizeString(conversationSnap.get('listing_title'))
    const listingOwnerUid = sanitizeString(conversationSnap.get('listing_owner_uid'))

    return NextResponse.json({
      messages,
      next_cursor: nextCursor,
      participant_profiles: participantProfiles,
      listing_title: listingTitle,
      listing_owner_uid: listingOwnerUid,
    })
  } catch (err) {
    console.error('[conversation messages] GET error', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const conversationId = (await params).conversationId
    const requesterUid = await resolveAuthUid(req)
    if (!requesterUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bodyJson = await req.json().catch(() => ({}))
    const rawBody = typeof bodyJson?.body === 'string' ? bodyJson.body : ''
    const messageBody = rawBody.trim()

    if (!messageBody) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    if (messageBody.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      )
    }

    const firestore = getFirestore()
    const conversationRef = firestore.collection('conversations').doc(conversationId)
    const messageRef = conversationRef.collection('messages').doc()

    const now = new Date()
    const nowIso = now.toISOString()
    const nowMs = now.getTime()

    const result = await firestore.runTransaction(async (tx) => {
      const conversationSnap = await tx.get(conversationRef)
      if (!conversationSnap.exists) {
        throw new Error('Conversation not found')
      }

      const participants = sanitizeStringArray(conversationSnap.get('participant_uids'))
      if (!participants.includes(requesterUid)) {
        throw new Error('Forbidden')
      }

      tx.set(messageRef, {
        author_uid: requesterUid,
        body: messageBody,
        created_at: nowIso,
        created_at_ms: nowMs,
      })

      tx.update(conversationRef, {
        updated_at: FieldValue.serverTimestamp(),
        last_message_preview: messageBody.slice(0, 200),
        last_message_at: nowIso,
        last_message_author_uid: requesterUid,
      })

      return {
        id: messageRef.id,
        data: {
          author_uid: requesterUid,
          body: messageBody,
          created_at: nowIso,
          created_at_ms: nowMs,
        },
      }
    })

    return NextResponse.json(mapMessage(result.id, conversationId, result.data))
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Conversation not found') {
        return NextResponse.json({ error: err.message }, { status: 404 })
      }
      if (err.message === 'Forbidden') {
        return NextResponse.json({ error: err.message }, { status: 403 })
      }
    }
    console.error('[conversation messages] POST error', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
