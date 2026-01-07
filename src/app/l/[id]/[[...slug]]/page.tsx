import { redirect } from 'next/navigation'

type Params = { id: string; slug?: string[] }

export default async function ShortListingRedirect({
  params,
}: {
  params: Promise<Params>
}) {
  const resolvedParams = await params
  const target = `/listings/${resolvedParams.id}`
  redirect(target)
}
