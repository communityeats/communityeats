import { useEffect, useState } from 'react'

export function useListingAuth() {
  const [idToken, setIdToken] = useState<string | null>(null)
  const [userUid, setUserUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false

    const init = async () => {
      try {
        const mod = await import('firebase/auth').catch(() => null)
        if (!mod) {
          const local =
            typeof window !== 'undefined'
              ? localStorage.getItem('idToken') || localStorage.getItem('token')
              : null
          if (!cancelled) {
            setIdToken(local)
            setError(local ? null : 'Missing token')
          }
          return
        }

        const { getAuth, onAuthStateChanged } = mod
        const auth = getAuth()
        unsub = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return

          if (!user) {
            setIdToken(null)
            setUserUid(null)
            setError('Not authenticated')
            return
          }

          try {
            const token = await user.getIdToken()
            setIdToken(token)
            setUserUid(user.uid)
            setError(null)
          } catch {
            try {
              const refreshed = await user.getIdToken(true)
              setIdToken(refreshed)
              setUserUid(user.uid)
              setError(null)
            } catch (err: unknown) {
              setError((err as { message?: string })?.message || 'Failed to init auth')
              setIdToken(null)
              setUserUid(null)
            }
          }
        })
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as { message?: string })?.message || 'Initialization error')
          setIdToken(null)
          setUserUid(null)
        }
      }
    }

    void init()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [])

  return { idToken, userUid, error }
}

export type UseListingAuthReturn = ReturnType<typeof useListingAuth>
