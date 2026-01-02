// src/components/ListingCard.tsx
type Listing = {
  id: string
  title: string
  imageURL?: string
  distanceKm?: number | null
  locationText?: string | null
  createdAt?: string | null
}

const formatDistance = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm)) return null
  if (distanceKm < 1) {
    const metres = Math.round(distanceKm * 1000)
    return `${metres} m away`
  }
  return `${distanceKm.toFixed(1)} km away`
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.valueOf())) return null
  return date.toLocaleDateString()
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const distanceLabel =
    typeof listing.distanceKm === 'number' ? formatDistance(listing.distanceKm) : null
  const dateLabel = formatDate(listing.createdAt)

  return (
    <a
      href={`/listings/${listing.id}`}
      className="block border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white"
    >
      <div className="w-full aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={listing.imageURL ?? "/placeholder.png"}
          alt={listing.title || 'Listing'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3 space-y-3">
        <h3 className="font-medium text-gray-900 leading-snug line-clamp-2">{listing.title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
          {listing.locationText ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 border border-gray-200">
              {listing.locationText}
            </span>
          ) : null}
          {distanceLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full text-green-700 bg-green-50 border border-green-100 px-2 py-1 whitespace-nowrap">
              {distanceLabel}
            </span>
          ) : null}
          {dateLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-1 whitespace-nowrap">
              {dateLabel}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}
