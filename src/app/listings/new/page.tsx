'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { v4 as uuidv4 } from 'uuid'

const categories = ['home', 'share', 'coop']
const exchangeTypes = ['swap', 'gift', 'pay']

export default function NewListingPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    country: '',
    state: '',
    suburb: '',
    postcode: '',
    category: '',
    exchange_type: '',
    contact_info: '',
    anonymous: false,
  })
  const [images, setImages] = useState<File[]>([])
  const [thumbnailId, setThumbnailId] = useState<string | null>(null)
  const [error, setError] = useState('')
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

    if (!formData.title || !formData.description || !formData.category || !formData.exchange_type) {
      setError('Please fill in all required fields.')
      return
    }

    if (!thumbnailId || !images.some(img => img.name === thumbnailId)) {
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

    const thumbnailEntry = uploaded.find(img => img.originalName === thumbnailId)
    if (!thumbnailEntry) {
      setError('Thumbnail image not found among uploads.')
      return
    }

    const payload = {
      title: formData.title.toLowerCase(),
      description: formData.description.toLowerCase(),
      country: formData.country.toLowerCase(),
      state: formData.state.toLowerCase(),
      suburb: formData.suburb.toLowerCase(),
      postcode: Number(formData.postcode),
      category: formData.category,
      exchange_type: formData.exchange_type,
      contact_info: formData.contact_info || null,
      anonymous: formData.anonymous,
      image_ids: uploaded.map(img => img.id),
      image_urls: uploaded.map(img => img.url),
      thumbnail_id: thumbnailEntry.id,
      location: {
        country: formData.country.toLowerCase(),
        state: formData.state.toLowerCase(),
        suburb: formData.suburb.toLowerCase(),
        postcode: Number(formData.postcode),
      },
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

        <div className="grid grid-cols-2 gap-4">
          <input name="country" placeholder="Country" className="p-2 border rounded" onChange={handleChange} />
          <input name="state" placeholder="State" className="p-2 border rounded" onChange={handleChange} />
          <input name="suburb" placeholder="Suburb" className="p-2 border rounded" onChange={handleChange} />
          <input name="postcode" placeholder="Postcode" className="p-2 border rounded" onChange={handleChange} />
        </div>

        <select name="category" className="w-full p-2 border rounded" onChange={handleChange} required>
          <option value="">Select Category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select name="exchange_type" className="w-full p-2 border rounded" onChange={handleChange} required>
          <option value="">Select Exchange Type</option>
          {exchangeTypes.map(e => <option key={e} value={e}>{e}</option>)}
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