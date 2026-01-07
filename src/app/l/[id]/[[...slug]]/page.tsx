import { redirect } from 'next/navigation'

type Params = { id: string; slug?: string[] }

export default function ShortListingRedirect({ params }: { params: Params }) {
  const target = `/listings/${params.id}`
  redirect(target)
}
