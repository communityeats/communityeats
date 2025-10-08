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
      className="block border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <img src={listing.imageURL ?? "/placeholder.png"} alt="" className="h-40 w-full object-cover" />
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900">{listing.title}</h3>
          {distanceLabel ? (
            <span className="text-xs font-medium text-green-600 whitespace-nowrap">
              {distanceLabel}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}
