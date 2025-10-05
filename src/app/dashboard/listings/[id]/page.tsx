'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  EXCHANGE_TYPES,
  LISTING_STATUSES,
  normalizeListingLocation,
} from '@/lib/types/listing'
import type {
  ListingDoc,
  ListingLocation,
} from '@/lib/types/listing'
import {
  deleteListing as deleteListingRequest,
  updateListing,
  type InterestedUser,
  type ListingPatchPayload,
} from '@/lib/api/listings'
import { useListingAuth } from '@/hooks/useListingAuth'
import { useListingDetail } from '@/hooks/useListingDetail'
import { useInterestedUsers } from '@/hooks/useInterestedUsers'
import ListingSummaryCard from '@/components/dashboard/listings/ListingSummaryCard'
import ListingEditForm from '@/components/dashboard/listings/ListingEditForm'
import InterestedUsersPanel from '@/components/dashboard/listings/InterestedUsersPanel'
import type { EditFormState } from '@/components/dashboard/listings/types'

const EMPTY_EDIT_FORM: EditFormState = {
  title: '',
  description: '',
  exchange_type: '',
  status: '',
  location: { country: '', state: '', suburb: '', postcode: '' },
}

function mapListingToEditForm(detail: ListingDoc): EditFormState {
  return {
    title: detail.title || '',
    description: detail.description || '',
    exchange_type: (detail.exchange_type ?? '') as EditFormState['exchange_type'],
    status: (detail.status ?? '') as EditFormState['status'],
    location: {
      country: detail.location?.country || '',
      state: detail.location?.state || '',
      suburb: detail.location?.suburb || '',
      postcode:
        typeof detail.location?.postcode === 'number'
          ? String(detail.location.postcode)
          : '',
    },
  }
}

export default function ManageListingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const listingId = params?.id

  const { idToken, userUid, error: authError } = useListingAuth()
  const { listing, setListing, loading, error: detailError, setError: setDetailError } =
    useListingDetail({ listingId, idToken, authError, userUid })
  const {
    users: interestedUsers,
    loading: interestedUsersLoading,
    error: interestedUsersError,
  } = useInterestedUsers({ listingId, idToken, authError })

  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(detailError)
  }, [detailError])

  useEffect(() => {
    if (listing) {
      setEditForm(mapListingToEditForm(listing))
    } else {
      setEditForm(EMPTY_EDIT_FORM)
    }
  }, [listing])

  const thumbnailUrl = useMemo(() => {
    if (!listing?.thumbnail_id) return null
    return null
  }, [listing])

  const handleEditChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target
    if (name.startsWith('location.')) {
      const key = name.split('.')[1] as keyof ListingLocation
      setEditForm((prev) => ({
        ...prev,
        location: { ...prev.location, [key]: value } as EditFormState['location'],
      }))
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  const saveEdits = async () => {
    if (!listing || !listingId) return
    if (!idToken) {
      setError('You must be signed in to edit a listing.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const postcodeNum =
        editForm.location.postcode.trim() !== '' ? Number(editForm.location.postcode) : undefined
      if (
        postcodeNum !== undefined &&
        (Number.isNaN(postcodeNum) || !Number.isFinite(postcodeNum))
      ) {
        throw new Error('Postcode must be a number.')
      }

      const rawLocation = {
        country: editForm.location.country,
        state: editForm.location.state,
        suburb: editForm.location.suburb,
        postcode: editForm.location.postcode,
      }

      const hasLocationInput = Object.values(rawLocation).some((val) => val.trim() !== '')

      const normalizedLocation = hasLocationInput
        ? (() => {
            const normalized = normalizeListingLocation({
              ...rawLocation,
              postcode:
                postcodeNum ??
                (typeof listing.location?.postcode === 'number'
                  ? listing.location.postcode
                  : null),
            })

            if (
              !normalized.country ||
              !normalized.state ||
              !normalized.suburb ||
              normalized.postcode <= 0
            ) {
              throw new Error('Location requires country, state, suburb, and a positive postcode.')
            }

            return normalized
          })()
        : undefined

      const payload: ListingPatchPayload = {
        title: (editForm.title || '').toLowerCase(),
        description: (editForm.description || '').toLowerCase(),
        exchange_type: editForm.exchange_type || undefined,
        status: editForm.status || undefined,
        country: normalizedLocation?.country,
        location: normalizedLocation,
      }

      await updateListing(idToken, listingId, payload)

      setListing((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
              location: payload.location ? payload.location : prev.location,
              country: payload.country ?? prev.country,
            }
          : prev
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save changes'
      setError(message)
      setDetailError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!listingId) return

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Are you sure you want to delete this listing? This cannot be undone.')
      if (!confirmed) return
    }

    if (!idToken) {
      setError('You must be signed in to delete a listing.')
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteListingRequest(idToken, listingId)
      router.push('/dashboard?deleted=1')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete listing'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  const fallbackInterestedIds: string[] =
    listing && Array.isArray(listing.interested_users_uids) ? listing.interested_users_uids : []

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manage Listing</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-700 border px-3 py-1.5 rounded hover:bg-gray-50"
        >
          Back to My Listings
        </button>
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="mt-6 bg-red-100 text-red-800 p-3 rounded">{error}</div>
      ) : !listing ? (
        <div className="mt-6 text-sm text-gray-600">Listing not found.</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <ListingSummaryCard listing={listing} thumbnailUrl={thumbnailUrl} />
            <ListingEditForm
              editForm={editForm}
              onChange={handleEditChange}
              onSave={saveEdits}
              onDelete={handleDelete}
              onCancel={() => router.push('/dashboard')}
              saving={saving}
              deleting={deleting}
              exchangeTypes={EXCHANGE_TYPES}
              statuses={LISTING_STATUSES}
            />
          </div>

          <InterestedUsersPanel
            interestedUsers={interestedUsers as InterestedUser[] | null}
            fallbackInterestedIds={fallbackInterestedIds}
            loading={interestedUsersLoading}
            error={interestedUsersError}
          />
        </div>
      )}
    </div>
  )
}
