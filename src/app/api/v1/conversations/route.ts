import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from '@/lib/firebase/admin'
import type { ListingDoc } from '@/lib/types/listing'
import type { ConversationDoc } from '@/lib/types/chat'
import { buildConversationPairKey } from '@/lib/chat/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

initAdmin()

type CreateConversationBody = {
  listing_id?: unknown
  target_user_uid?: unknown
}

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

const mapConversation = (
  id: string,
  data: FirebaseFirestore.DocumentData
): ConversationDoc => ({
  id,
  listing_id: typeof data?.listing_id === 'string' ? data.listing_id : '',
  listing_owner_uid: typeof data?.listing_owner_uid === 'string' ? data.listing_owner_uid : '',
  listing_title: typeof data?.listing_title === 'string' ? data.listing_title : null,
  participant_uids: sanitizeStringArray(data?.participant_uids),
  participant_profiles: mapParticipantProfiles(data?.participant_profiles),
  participant_pair_key: typeof data?.participant_pair_key === 'string' ? data.participant_pair_key : '',
  created_at: toIso(data?.created_at),
  updated_at: toIso(data?.updated_at),
  last_message_preview:
    typeof data?.last_message_preview === 'string' ? data.last_message_preview : null,
  last_message_at: toIso(data?.last_message_at),
  last_message_author_uid:
    typeof data?.last_message_author_uid === 'string' ? data.last_message_author_uid : null,
})

const fetchParticipantProfiles = async (
  uids: string[]
): Promise<Record<string, string | null>> => {
  const auth = getAuth()
  const uniqueUids = Array.from(
    new Set(uids.filter((uid): uid is string => typeof uid === 'string' && uid.trim().length > 0))
  )

  const entries = await Promise.all(
    uniqueUids.map(async (uid) => {
      try {
        const record = await auth.getUser(uid)
        const trimmed = record.displayName?.trim()
        return [uid, trimmed && trimmed.length ? trimmed : null] as const
      } catch {
        return [uid, null] as const
      }
    })
  )

  return entries.reduce<Record<string, string | null>>((acc, [uid, name]) => {
    acc[uid] = name
    return acc
  }, {})
}

async function resolveAuthUid(req: NextRequest): Promise<string | null> {
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

export async function POST(req: NextRequest) {
  try {
    const requesterUid = await resolveAuthUid(req)
    if (!requesterUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as CreateConversationBody
    const listingId = typeof body.listing_id === 'string' ? body.listing_id.trim() : ''
    const targetUserUid =
      typeof body.target_user_uid === 'string' ? body.target_user_uid.trim() : ''

    if (!listingId) {
      return NextResponse.json({ error: 'listing_id is required' }, { status: 400 })
    }

    const firestore = getFirestore()
    const listingSnap = await firestore.collection('listings').doc(listingId).get()
    if (!listingSnap.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const listing = listingSnap.data() as ListingDoc | undefined
    const ownerUid = listing?.user_id
    if (!ownerUid) {
      return NextResponse.json({ error: 'Listing missing owner' }, { status: 422 })
    }

    const interestedIds = sanitizeStringArray(listing?.interested_users_uids)

    const requesterIsOwner = requesterUid === ownerUid
    let otherParticipant: string

    if (requesterIsOwner) {
      if (!targetUserUid) {
        return NextResponse.json(
          { error: 'target_user_uid is required for listing owners' },
          { status: 400 }
        )
      }
      if (!interestedIds.includes(targetUserUid)) {
        return NextResponse.json(
          { error: 'Cannot message a user who has not registered interest' },
          { status: 403 }
        )
      }
      otherParticipant = targetUserUid
    } else {
      if (ownerUid === requesterUid) {
        // Should not happen but guard anyway.
        return NextResponse.json({ error: 'Invalid participants' }, { status: 400 })
      }
      if (!interestedIds.includes(requesterUid)) {
        return NextResponse.json(
          { error: 'You must register interest before messaging this owner' },
          { status: 403 }
        )
      }
      otherParticipant = requesterUid
    }

    const participantUids = Array.from(new Set([ownerUid, otherParticipant]))
    const participantProfiles = await fetchParticipantProfiles(participantUids)
    const pairKey = buildConversationPairKey(ownerUid, otherParticipant)
    const conversationsCol = firestore.collection('conversations')

    const nowIso = new Date().toISOString()

    const conversation = await firestore.runTransaction(async (tx) => {
      const query = conversationsCol
        .where('listing_id', '==', listingId)
        .where('participant_pair_key', '==', pairKey)
        .limit(1)

      const existingSnap = await tx.get(query)
      if (!existingSnap.empty) {
        const doc = existingSnap.docs[0]
        const data = doc.data()
        const currentParticipants = sanitizeStringArray(data?.participant_uids)
        const ensuredParticipants = Array.from(
          new Set([...currentParticipants, ...participantUids])
        )
        const currentSet = new Set(currentParticipants)
        const needsUpdate =
          ensuredParticipants.length !== currentParticipants.length ||
          ensuredParticipants.some((uid) => !currentSet.has(uid))
        const existingProfiles = mapParticipantProfiles(data?.participant_profiles)

        const mergedProfiles = ensuredParticipants.reduce<Record<string, string | null>>(
          (acc, uid) => {
            const fetched = participantProfiles[uid]
            const existing = existingProfiles[uid]
            acc[uid] = typeof fetched === 'string' || fetched === null ? fetched : existing ?? null
            return acc
          },
          {}
        )

        const needsProfileUpdate = ensuredParticipants.some(
          (uid) => (existingProfiles[uid] ?? null) !== (mergedProfiles[uid] ?? null)
        ) || Object.keys(existingProfiles).length !== ensuredParticipants.length

        if (needsUpdate || needsProfileUpdate) {
          const payload: FirebaseFirestore.UpdateData<{
            participant_uids?: string[]
            participant_profiles?: Record<string, string | null>
          }> = {}
          if (needsUpdate) payload.participant_uids = ensuredParticipants
          if (needsProfileUpdate) payload.participant_profiles = mergedProfiles
          tx.update(doc.ref, payload)
        }
        data.participant_uids = ensuredParticipants
        data.participant_profiles = mergedProfiles

        return { id: doc.id, data }
      }

      const docRef = conversationsCol.doc()
      const initialProfiles = participantUids.reduce<Record<string, string | null>>((acc, uid) => {
        acc[uid] = participantProfiles[uid] ?? null
        return acc
      }, {})

      tx.set(docRef, {
        listing_id: listingId,
        listing_owner_uid: ownerUid,
        listing_title: listing?.title ?? null,
        participant_uids: participantUids,
        participant_profiles: initialProfiles,
        participant_pair_key: pairKey,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        last_message_preview: null,
        last_message_at: null,
        last_message_author_uid: null,
      })

      return {
        id: docRef.id,
        data: {
          listing_id: listingId,
          listing_owner_uid: ownerUid,
          listing_title: listing?.title ?? null,
          participant_uids: participantUids,
          participant_profiles: initialProfiles,
          participant_pair_key: pairKey,
          created_at: nowIso,
          updated_at: nowIso,
          last_message_preview: null,
          last_message_at: null,
          last_message_author_uid: null,
        },
      }
    })

    return NextResponse.json(mapConversation(conversation.id, conversation.data))
  } catch (err) {
    console.error('[conversations] POST error', err)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const requesterUid = await resolveAuthUid(req)
    if (!requesterUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const limitParam = Number(url.searchParams.get('limit') ?? '20')
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
      : 20

    const firestore = getFirestore()
    const col = firestore.collection('conversations')

    const snapshot = await col
      .where('participant_uids', 'array-contains', requesterUid)
      .orderBy('updated_at', 'desc')
      .limit(limit)
      .get()

    const rawConversations = snapshot.docs.map((doc) => mapConversation(doc.id, doc.data()))
    const allParticipantUids = rawConversations.flatMap((conversation) => conversation.participant_uids)
    const fetchedProfiles = await fetchParticipantProfiles(allParticipantUids)

    const conversations = rawConversations.map((conversation, index) => {
      const normalizedProfiles = conversation.participant_uids.reduce<Record<string, string | null>>(
        (acc, uid) => {
          const existing = conversation.participant_profiles?.[uid]
          acc[uid] = existing ?? fetchedProfiles[uid] ?? null
          return acc
        },
        {}
      )

      const needsUpdate = conversation.participant_uids.some(
        (uid) => (conversation.participant_profiles?.[uid] ?? null) !== (normalizedProfiles[uid] ?? null)
      ) || (conversation.participant_profiles ? Object.keys(conversation.participant_profiles).length : 0) !== conversation.participant_uids.length

      if (needsUpdate) {
        const docRef = snapshot.docs[index].ref
        void docRef.update({ participant_profiles: normalizedProfiles }).catch(() => undefined)
      }

      return { ...conversation, participant_profiles: normalizedProfiles }
    })

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[conversations] GET error', err)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
