import { useEffect, useState } from 'react'
import type { ListingDoc } from '@/lib/types/listing'
import { fetchListingDetail } from '@/lib/api/listings'

interface Params {
  listingId: string | undefined
  idToken: string | null
  authError: string | null
  userUid: string | null
}

export function useListingDetail({ listingId, idToken, authError, userUid }: Params) {
  const [listing, setListing] = useState<ListingDoc | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!listingId) {
        setListing(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        if (!idToken) {
          if (authError) {
            throw new Error(authError)
          }
          return
        }

        const detail = await fetchListingDetail(listingId, idToken)
        if (!mounted) return

        if (detail?.user_id && userUid && detail.user_id !== userUid) {
          setError('You do not have permission to manage this listing.')
          setListing(null)
          setLoading(false)
          return
        }

        setListing(detail)
      } catch (err: unknown) {
        if (mounted) {
          setError((err as { message?: string })?.message || 'Failed to load listing')
          setListing(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [listingId, idToken, authError, userUid])

  return { listing, setListing, loading, error, setError }
}

export type UseListingDetailReturn = ReturnType<typeof useListingDetail>
