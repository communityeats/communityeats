// src/components/ListingCard.tsx
type Listing = {
  id: string
  title: string
  imageURL?: string
  distanceKm?: number | null
}

const formatDistance = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm)) return null
  if (distanceKm < 1) {
    const metres = Math.round(distanceKm * 1000)
    return `${metres} m away`
  }
  return `${distanceKm.toFixed(1)} km away`
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const distanceLabel =
    typeof listing.distanceKm === 'number' ? formatDistance(listing.distanceKm) : null

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
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900 leading-snug line-clamp-2">{listing.title}</h3>
          {distanceLabel ? (
            <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-full whitespace-nowrap">
              {distanceLabel}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}
