import type { ListingDoc } from '@/lib/types/listing'

type Props = {
  listing: ListingDoc
  thumbnailUrl: string | null
}

export function ListingSummaryCard({ listing, thumbnailUrl }: Props) {
  return (
    <div className="border rounded p-4">
      <h2 className="text-lg font-semibold mb-3">Details</h2>

      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={listing.title}
          className="w-full h-48 object-cover rounded mb-3"
        />
      ) : null}

      <div className="text-sm text-gray-600">
        <div>
          <span className="font-medium text-gray-800">Listing ID:</span> {listing.id}
        </div>
        {listing.location ? (
          <div className="mt-1">
            <span className="font-medium text-gray-800">Location:</span>{' '}
            {[listing.location.suburb, listing.location.state, listing.location.country]
              .filter(Boolean)
              .join(', ')}
            {typeof listing.location.postcode === 'number' ? ` ${listing.location.postcode}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ListingSummaryCard
