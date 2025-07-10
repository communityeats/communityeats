// src/app/listings/[id]/page.tsx
type Props = { params: { id: string } };

export default function ListingDetail({ params }: Props) {
  return (
    <article>
      <h2 className="text-xl font-semibold mb-2">Listing #{params.id}</h2>
      <p>Description, image, and claim button will go here.</p>
    </article>
  );
}