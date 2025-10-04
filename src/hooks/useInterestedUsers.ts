import { useEffect, useState } from 'react'
import type { InterestedUser } from '@/lib/api/listings'
import { fetchInterestedUsers } from '@/lib/api/listings'

interface Params {
  listingId: string | undefined
  idToken: string | null
  authError: string | null
}

export function useInterestedUsers({ listingId, idToken, authError }: Params) {
  const [users, setUsers] = useState<InterestedUser[] | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!listingId) return
      if (!idToken) {
        if (authError && !cancelled) {
          setError(authError)
          setUsers(null)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setLoading(true)
        setError(null)
        setUsers(null)
      }

      try {
        const list = await fetchInterestedUsers(listingId, idToken)
        if (!cancelled) setUsers(list)
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as { message?: string })?.message || 'Failed to load interested users')
          setUsers(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [listingId, idToken, authError])

  return { users, loading, error, setUsers, setError }
}

export type UseInterestedUsersReturn = ReturnType<typeof useInterestedUsers>
