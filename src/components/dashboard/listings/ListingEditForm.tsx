import type { ChangeEvent } from 'react'
import type { EditFormState } from './types'

type Props = {
  editForm: EditFormState
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onSave: () => void
  onDelete: () => void
  onCancel: () => void
  saving: boolean
  deleting: boolean
  categories: readonly string[]
  exchangeTypes: readonly string[]
  statuses: readonly string[]
}

export function ListingEditForm({
  editForm,
  onChange,
  onSave,
  onDelete,
  onCancel,
  saving,
  deleting,
  categories,
  exchangeTypes,
  statuses,
}: Props) {
  return (
    <div className="border rounded p-4">
      <h2 className="text-lg font-semibold mb-3">Edit listing</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            name="title"
            value={editForm.title}
            onChange={onChange}
            className="w-full p-2 border rounded"
            placeholder="Title"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={editForm.description}
            onChange={onChange}
            className="w-full p-2 border rounded"
            rows={4}
            placeholder="Describe your item/offer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            name="category"
            value={editForm.category}
            onChange={onChange}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Exchange Type</label>
          <select
            name="exchange_type"
            value={editForm.exchange_type}
            onChange={onChange}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Exchange Type</option>
            {exchangeTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status"
            value={editForm.status || 'available'}
            onChange={onChange}
            className="w-full p-2 border rounded"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <p className="text-sm font-medium mb-2">Location (optional)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              name="location.country"
              value={editForm.location.country}
              onChange={onChange}
              className="p-2 border rounded"
              placeholder="Country"
            />
            <input
              name="location.state"
              value={editForm.location.state}
              onChange={onChange}
              className="p-2 border rounded"
              placeholder="State"
            />
            <input
              name="location.suburb"
              value={editForm.location.suburb}
              onChange={onChange}
              className="p-2 border rounded"
              placeholder="Suburb"
            />
            <input
              name="location.postcode"
              value={editForm.location.postcode}
              onChange={onChange}
              className="p-2 border rounded"
              placeholder="Postcode"
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        <button onClick={onCancel} className="px-4 py-2 rounded border">
          Cancel
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="px-4 py-2 rounded border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? 'Deleting…' : 'Delete Listing'}
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

export default ListingEditForm
