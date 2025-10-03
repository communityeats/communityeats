'use client'

import { useEffect, useState, useCallback, FormEvent } from 'react'

interface Message {
  id: string
  author_uid: string
  body: string
  created_at: string | null
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
            return
          }
          try {
            const token = await user.getIdToken()
            if (!cancelled) setIdToken(token)
          } catch {
            try {
              const fresh = await user.getIdToken(true)
              if (!cancelled) setIdToken(fresh)
            } catch (err: unknown) {
              console.error('[MessageThread] failed to refresh token', err)
              if (!cancelled) setIdToken(null)
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
        setMessages(Array.isArray(payload.messages) ? payload.messages : [])
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
    if (!conversationId || !idToken) return
    void fetchMessages(idToken)
  }, [conversationId, idToken, fetchMessages])

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
      const message: Message = payload
      setMessages((prev) => [...prev, message])
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
