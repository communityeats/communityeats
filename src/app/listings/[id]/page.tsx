// ListingDetailPage.tsx

import ListingDetailClient from './ListingDetailClient'

export const dynamic = 'force-dynamic'

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  return <ListingDetailClient id={id} />
}
