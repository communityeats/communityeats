// src/app/listings/[id]/page.tsx
import ListingDetailClient from './ListingDetailClient'
export const dynamic = 'force-dynamic'
type Props = {
  params: Promise<{ id: string }>;
  // If you may use it later, include this too:
  // searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingDetail({ params }: Props) {
  const { id } = await params;

  return <ListingDetailClient id={id} />
}
