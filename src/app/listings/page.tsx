// src/app/listings/page.tsx
import Link from "next/link";
import ListingCard from "@/components/ListingCard";

const dummyListings = [
  { id: "1", title: "Fresh Apples", imageURL: "/placeholder.png" },
  { id: "2", title: "Bread Loaves", imageURL: "/placeholder.png" },
  { id: "3", title: "Canned Beans", imageURL: "/placeholder.png" },
];

export default function ListingsPage() {
  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Food Listings</h1>
        <Link
          href="/listings/new"
          className="btn bg-blue-600 hover:bg-blue-700 text-white"
        >
          + New Listing
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dummyListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {dummyListings.length === 0 && (
        <p className="text-center text-gray-600">
          No listings yet. Be the first to{" "}
          <Link href="/listings/new" className="underline text-blue-600">
            create one
          </Link>
          !
        </p>
      )}
    </section>
  );
}