import { redirect } from 'next/navigation'
import { initAdmin, getFirestore } from '@/lib/firebase/admin'

initAdmin()

type Params = { id: string; slug?: string[] }

export default async function ShortListingRedirect({
  params,
}: {
  params: Promise<Params>
}) {
  const resolvedParams = await params
  let target = `/listings/${resolvedParams.id}`

  try {
    const doc = await getFirestore().collection('listings').doc(resolvedParams.id).get()
    if (doc.exists) {
      const data = doc.data() as { public_slug?: unknown } | undefined
      if (typeof data?.public_slug === 'string' && data.public_slug.trim()) {
        target = `/listings/${data.public_slug}`
      }
    }
  } catch {
    // Fall back to the legacy id-based URL.
  }
  redirect(target)
}
