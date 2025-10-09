'use client'

import { useEffect, useState, useCallback, FormEvent } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/client'

interface Message {
  id: string
  author_uid: string
  body: string
  created_at: string | null
  created_at_ms: number | null
}

type MessageThreadProps = {
  conversationId: string
}

export default function MessageThread({ conversationId }: MessageThreadProps) {
  const [idToken, setIdToken] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<boolean>(false)
  const [input, setInput] = useState<string>('')
  const [allowRealtime, setAllowRealtime] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    const init = async () => {
      try {
        const mod = await import('firebase/auth').catch(() => null)
        if (!mod) {
          const local =
            typeof window !== 'undefined'
              ? localStorage.getItem('idToken') || localStorage.getItem('token')
              : null
          if (!cancelled) setIdToken(local)
          return
        }

        const { getAuth, onAuthStateChanged } = mod
        const auth = getAuth()

        unsub = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return
          if (!user) {
            setIdToken(null)
            setAllowRealtime(true)
            return
          }
          try {
            const token = await user.getIdToken()
            if (!cancelled) setIdToken(token)
            setAllowRealtime(true)
          } catch {
            try {
              const fresh = await user.getIdToken(true)
              if (!cancelled) setIdToken(fresh)
              setAllowRealtime(true)
            } catch (err: unknown) {
              console.error('[MessageThread] failed to refresh token', err)
              if (!cancelled) setIdToken(null)
              setAllowRealtime(true)
            }
          }
        })
      } catch (err) {
        console.error('[MessageThread] auth init error', err)
        if (!cancelled) setIdToken(null)
      }
    }

    void init()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [])

  const fetchMessages = useCallback(
    async (token: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/conversations/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string
          messages?: Message[]
        }
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to load messages')
        }
        const mapped = Array.isArray(payload.messages)
          ? payload.messages.map((m) => ({
              ...m,
              created_at_ms: typeof (m as { created_at_ms?: unknown }).created_at_ms === 'number'
                ? (m as { created_at_ms?: number }).created_at_ms ?? null
                : null,
            }))
          : []
        setMessages(mapped)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
        setMessages([])
      } finally {
        setLoading(false)
      }
    },
    [conversationId]
  )

  useEffect(() => {
    if (!conversationId || !idToken || allowRealtime) return
    void fetchMessages(idToken)
  }, [allowRealtime, conversationId, idToken, fetchMessages])

  useEffect(() => {
    if (!allowRealtime || !conversationId || !idToken) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages')
    const q = query(messagesRef, orderBy('created_at_ms', 'asc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (cancelled) return
        const mapped = snapshot.docs.map((doc) => {
          const data = doc.data()
          const createdAtRaw = data?.created_at
          const createdAtMs = typeof data?.created_at_ms === 'number' ? data.created_at_ms : null

          let createdAt: string | null = null
          if (typeof createdAtRaw === 'string' && createdAtRaw.trim()) {
            createdAt = createdAtRaw
          } else if (createdAtMs !== null) {
            createdAt = new Date(createdAtMs).toISOString()
          } else if (createdAtRaw && typeof createdAtRaw.toDate === 'function') {
            try {
              const maybeDate = createdAtRaw.toDate()
              createdAt = maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime())
                ? maybeDate.toISOString()
                : null
            } catch {
              createdAt = null
            }
          }

          return {
            id: doc.id,
            author_uid: typeof data?.author_uid === 'string' ? data.author_uid : '',
            body: typeof data?.body === 'string' ? data.body : '',
            created_at: createdAt,
            created_at_ms: createdAtMs,
          }
        })

        setMessages(mapped)
        setLoading(false)
      },
      (snapshotError) => {
        if (cancelled) return
        console.error('[MessageThread] realtime error', snapshotError)
        setError(snapshotError instanceof Error ? snapshotError.message : 'Failed to load messages')
        setMessages([])
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [allowRealtime, conversationId, idToken])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!conversationId || !idToken) return
    const trimmed = input.trim()
    if (!trimmed) return

    setSending(true)
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ body: trimmed }),
      })
      const payload = (await res.json().catch(() => ({}))) as Message & { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to send message')
      }
      if (!allowRealtime) {
        await fetchMessages(idToken)
      }
      setInput('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  if (!conversationId) {
    return <div className="text-sm text-gray-600">Conversation id missing.</div>
  }

  if (!idToken) {
    return <div className="text-sm text-gray-600">Sign in to view messages.</div>
  }

  return (
    <div className="flex flex-col h-full border rounded">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {loading ? (
          <div className="text-sm text-gray-600">Loading messages…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : messages.length ? (
          messages.map((m) => (
            <div key={m.id} className="bg-white border rounded p-2">
              <div className="text-xs text-gray-500 mb-1">
                <span className="font-medium">{m.author_uid}</span>{' '}
                <span>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-line">{m.body}</p>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-600">No messages yet.</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-3 space-y-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full border rounded p-2 text-sm"
          rows={3}
          placeholder="Write a message…"
          disabled={sending}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-1.5 rounded bg-green-600 text-white text-sm disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
