// src/app/listings/[id]/page.tsx
type Props = {
  params: Promise<{ id: string }>;
  // If you may use it later, include this too:
  // searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingDetail({ params }: Props) {
  const { id } = await params;

  return (
    <article>
      <h2 className="text-xl font-semibold mb-2">Listing #{id}</h2>
      <p>Description, image, and claim button will go here.</p>
    </article>
  );
}