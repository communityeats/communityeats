'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/location/loadGoogleMaps'
import type { ListingLocation } from '@/lib/types/listing'

export type LocationSelection = {
  label: string
  placeId: string | null
  location: ListingLocation
}

type Props = {
  apiKey: string
  value: LocationSelection | null
  onChange: (selection: LocationSelection | null) => void
  onError?: (message: string | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string | null
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

type Autocomplete = google.maps.places.Autocomplete

type PlaceResult = google.maps.places.PlaceResult

type AddressComponent = google.maps.GeocoderAddressComponent

const SUBURB_TYPES: string[] = [
  'locality',
  'postal_town',
  'sublocality',
  'sublocality_level_1',
  'administrative_area_level_3',
]

function extractComponent(components: AddressComponent[] = [], types: string[]): string {
  for (const type of types) {
    const component = components.find((item) => item.types.includes(type))
    if (component) {
      return (component.long_name || component.short_name || '').trim()
    }
  }
  return ''
}

function parsePlace(place: PlaceResult): LocationSelection | null {
  if (!place.address_components?.length) return null

  const country = extractComponent(place.address_components, ['country'])
  const state = extractComponent(place.address_components, [
    'administrative_area_level_1',
    'administrative_area_level_2',
  ])
  const suburb = extractComponent(place.address_components, SUBURB_TYPES)
  const rawPostcode = extractComponent(place.address_components, ['postal_code'])

  const digits = rawPostcode.replace(/\D+/g, '')
  const postcode = digits ? Number(digits) : Number.NaN

  if (!country || !state || !suburb || !Number.isFinite(postcode) || postcode <= 0) {
    return null
  }

  const label = (place.formatted_address || place.name || '').trim()
  const geometry = place.geometry?.location ?? null
  const lat = geometry ? geometry.lat() : null
  const lng = geometry ? geometry.lng() : null

  const placeId = place.place_id ?? null

  const location: ListingLocation = {
    country,
    state,
    suburb,
    postcode,
    place_id: placeId,
    label,
    latitude: lat,
    longitude: lng,
  }

  return {
    label,
    placeId,
    location,
  }
}

export function LocationAutocomplete({
  apiKey,
  value,
  onChange,
  onError,
  placeholder = 'Search for an address',
  disabled = false,
  error,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autocompleteRef = useRef<Autocomplete | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [internalError, setInternalError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!inputRef.current) return

    let mounted = true
    let googleInstance: typeof window.google | null = null

    setStatus('loading')
    loadGoogleMaps(apiKey)
      .then((google) => {
        if (!mounted || !inputRef.current) return
        googleInstance = google
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
          types: ['geocode'],
        })
        autocompleteRef.current = autocomplete

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const parsed = place ? parsePlace(place) : null
          if (!parsed) {
            const message = 'Please select an address with a suburb and postcode.'
            setInternalError(message)
            onError?.(message)
            onChange(null)
            if (inputRef.current && place?.formatted_address) {
              inputRef.current.value = place.formatted_address
            }
            return
          }
          setInternalError(null)
          onError?.(null)
          onChange(parsed)
          if (inputRef.current) {
            inputRef.current.value = parsed.label
          }
        })

        setStatus('ready')
      })
      .catch((err: Error) => {
        if (!mounted) return
        setStatus('error')
        setInternalError(err.message)
        onError?.(err.message)
      })

    return () => {
      mounted = false
      if (autocompleteRef.current && googleInstance?.maps?.event) {
        googleInstance.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      autocompleteRef.current = null
    }
  }, [apiKey, onChange, onError])

  useEffect(() => {
    if (!inputRef.current) return
    if (value?.label) {
      inputRef.current.value = value.label
    } else if (!value) {
      inputRef.current.value = ''
    }
  }, [value?.label, value])

  const loading = status === 'loading'
  const resolvedError = error || internalError

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">Location</label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="flex-1 p-2 border rounded"
          autoComplete="off"
          disabled={disabled || loading}
        />
        {value ? (
          <button
            type="button"
            className="text-sm text-gray-600 underline"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = ''
              }
              setInternalError(null)
              onError?.(null)
              onChange(null)
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="text-xs text-gray-500">Powered by Google Places</p>
      {loading ? (
        <p className="text-xs text-gray-500">Loading location suggestions…</p>
      ) : null}
      {resolvedError ? (
        <p className="text-xs text-red-600">{resolvedError}</p>
      ) : null}
    </div>
  )
}

export default LocationAutocomplete
