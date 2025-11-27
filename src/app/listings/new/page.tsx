'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import {
  EXCHANGE_TYPES,
  normalizeListingLocation,
  thumbnailInImageIds,
  type ExchangeType,
} from '@/lib/types/listing'
import LocationAutocomplete, {
  type LocationSelection,
} from '@/components/LocationAutocomplete'

type FormState = {
  title: string
  description: string
  exchange_type: ExchangeType | ''
  contact_info: string
  anonymous: boolean
}

export default function NewListingPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormState>({
    title: '',
    description: '',
    exchange_type: '',
    contact_info: '',
    anonymous: false,
  })
  const [images, setImages] = useState<File[]>([])
  const [thumbnailId, setThumbnailId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const fileArray = Array.from(files)
    setImages(fileArray)
    setThumbnailId(fileArray[0]?.name ?? null) // use original filename for now
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    const checked =
      e.target instanceof HTMLInputElement ? e.target.checked : undefined;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title || !formData.description || !formData.exchange_type) {
      setError('Please fill in all required fields.')
      return
    }

    if (!googleMapsApiKey) {
      setError('Location search requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to be configured.')
      return
    }

    if (!locationSelection) {
      setError('Please choose a location from the search field.')
      return
    }

    if (locationError) {
      setError(locationError)
      return
    }

    if (!thumbnailId || !images.some((img) => img.name === thumbnailId)) {
      setError('Thumbnail must match one of the selected images.')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setError('You must be signed in to create a listing.')
      return
    }

    const token = await user.getIdToken()
    const uploaded: { id: string; url: string; originalName: string }[] = []

    for (const file of images) {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/v1/listings/upload-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || 'Image upload failed.')
        return
      }

      const data = await res.json()
      uploaded.push({
        id: data.id,
        url: data.url,
        originalName: file.name,
      })
    }

    const thumbnailEntry = uploaded.find((img) => img.originalName === thumbnailId)
    if (!thumbnailEntry) {
      setError('Thumbnail image not found among uploads.')
      return
    }

    if (!thumbnailInImageIds(
      uploaded.map((img) => img.id),
      thumbnailEntry.id
    )) {
      setError('Thumbnail must be one of the uploaded image IDs.')
      return
    }

    const location = normalizeListingLocation({
      ...locationSelection.location,
      latitude: locationSelection.location.latitude ?? undefined,
      longitude: locationSelection.location.longitude ?? undefined,
    })

    const payload = {
      title: formData.title.toLowerCase(),
      description: formData.description.toLowerCase(),
      country: location.country,
      state: location.state,
      suburb: location.suburb,
      postcode: location.postcode,
      category: null,
      exchange_type: formData.exchange_type,
      contact_info: formData.contact_info || null,
      anonymous: formData.anonymous,
      image_ids: uploaded.map((img) => img.id),
      image_urls: uploaded.map((img) => img.url),
      thumbnail_id: thumbnailEntry.id,
      location,
      location_place_id: location.place_id ?? null,
      location_label: location.label ?? null,
      user_id: user.uid,
    }

    const listingRes = await fetch('/api/v1/listings/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!listingRes.ok) {
      const result = await listingRes.json()
      setError(result.error || 'Failed to create listing.')
    } else {
      router.push('/listings')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Create New Listing</h1>
      {error && <div className="bg-red-100 text-red-800 p-2 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">

        <input name="title" placeholder="Title" className="w-full p-2 border rounded" onChange={handleChange} required />
        <textarea name="description" placeholder="Description" className="w-full p-2 border rounded" onChange={handleChange} required />

        <LocationAutocomplete
          apiKey={googleMapsApiKey}
          value={locationSelection}
          onChange={(selection) => {
            setLocationSelection(selection)
            setLocationError(null)
          }}
          onError={(message) => {
            setLocationError(message)
            if (message) setError(message)
          }}
          error={locationError}
          disabled={!googleMapsApiKey}
          placeholder="Start typing an address"
        />
        {!googleMapsApiKey ? (
          <p className="text-sm text-red-600">
            Configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in your environment to enable location search.
          </p>
        ) : null}

        <select name="exchange_type" className="w-full p-2 border rounded" onChange={handleChange} required>
          <option value="">Select Exchange Type</option>
          {EXCHANGE_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <input name="contact_info" placeholder="Contact Info (optional)" className="w-full p-2 border rounded" onChange={handleChange} />
        
        <div>
          <label className="block mb-1">Upload Images</label>
          <input type="file" multiple accept="image/*" onChange={handleImageUpload} />
        </div>

        {images.length > 0 && (
          <div>
            <label className="block mt-4 mb-1">Select Thumbnail</label>
            <select value={thumbnailId ?? ''} onChange={(e) => setThumbnailId(e.target.value)} className="w-full p-2 border rounded">
              {images.map(file => (
                <option key={file.name} value={file.name}>{file.name}</option>
              ))}
            </select>
          </div>
        )}

        <label className="inline-flex items-center">
          <input type="checkbox" name="anonymous" className="mr-2" onChange={handleChange} />
          Post anonymously
        </label>
        <br/>

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create Listing</button>
      </form>
    </div>
  )
}
