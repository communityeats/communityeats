// ListingDetailPage.tsx

import ListingDetailClient from './ListingDetailClient'

export const dynamic = 'force-dynamic'

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  return <ListingDetailClient id={id} />
}
