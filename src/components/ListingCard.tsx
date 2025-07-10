// src/components/ListingCard.tsx
type Listing = { id: string; title: string; imageURL?: string };

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <a href={`/listings/${listing.id}`} className="block border rounded-lg overflow-hidden shadow-sm">
      <img src={listing.imageURL ?? "/placeholder.png"} alt="" className="h-40 w-full object-cover" />
      <div className="p-3">
        <h3 className="font-medium">{listing.title}</h3>
      </div>
    </a>
  );
}