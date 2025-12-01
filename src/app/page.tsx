import { headers } from 'next/headers'
import Link from 'next/link'
import ListingCarousel, { type CarouselListing } from '@/components/ListingCarousel'

// Keep the home page dynamic so the carousel shows fresh listings.
export const revalidate = 0

const featurePoints = [
  {
    title: 'Neighbors helping neighbors',
    copy: 'We make it easy to post surplus food so it reaches someone nearby before it goes to waste.',
  },
  {
    title: 'Safe, simple exchanges',
    copy: 'Private messaging, clear statuses, and quick confirmations keep pickups smooth.',
  },
  {
    title: 'Built for speed',
    copy: 'Mobile-friendly, snappy loading, and listings that refresh often so you see what’s new.',
  },
]

const steps = [
  { label: 'List what you have', detail: 'Snap a photo, add a quick note, and set it to available.' },
  { label: 'Connect instantly', detail: 'Interested neighbors can message you directly to arrange pickup.' },
  { label: 'Mark it claimed', detail: 'Keep everything tidy and celebrate one less thing going to waste.' },
]

async function getRecentListings(): Promise<CarouselListing[]> {
  try {
    const buildBaseUrl = async () => {
      const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
      if (envUrl) return envUrl.replace(/\/$/, '')

      const hdrs = await headers()
      const host = hdrs.get('host')
      if (!host) return ''
      const proto = hdrs.get('x-forwarded-proto') ?? 'https'
      return `${proto}://${host}`
    }

    const baseUrl = await buildBaseUrl()
    const res = await fetch(
      `${baseUrl}/api/v1/listings?status=available&sort=recent&limit=10`,
      {
        cache: 'no-store',
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data
      .map((raw) => {
        const item = raw as {
          id?: unknown
          title?: unknown
          thumbnail_url?: unknown
          description?: unknown
          created_at?: unknown
          location?: { label?: unknown }
          location_label?: unknown
        }
        const nestedLabel =
          item.location && typeof item.location === 'object'
            ? (item.location as { label?: unknown }).label
            : null

        return {
          id: typeof item.id === 'string' ? item.id : '',
          title: typeof item.title === 'string' ? item.title : null,
          thumbnail_url: typeof item.thumbnail_url === 'string' ? item.thumbnail_url : null,
          description: typeof item.description === 'string' ? item.description : null,
          created_at: typeof item.created_at === 'string' ? item.created_at : null,
          location_label:
            typeof nestedLabel === 'string'
              ? nestedLabel
              : typeof item.location_label === 'string'
                ? item.location_label
                : null,
        }
      })
      .filter((item) => item.id)
  } catch {
    return []
  }
}

export default async function Home() {
  const recentListings = await getRecentListings()

  return (
    <main className="full-bleed relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#bbf7d0,transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,#dbeafe,transparent_25%)]" />
      </div>

      <div className="relative">
        <section className="max-w-6xl mx-auto px-4 pb-10 pt-12">
          <div className="space-y-6 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border text-xs font-medium text-emerald-700 shadow-sm mx-auto lg:mx-0">
              Community Eats · Reduce waste together
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Share surplus food. <span className="text-emerald-700">Help your neighbors.</span>
            </h1>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto lg:mx-0">
              Post extra meals, produce, or pantry items in seconds. Local families can claim what they need,
              and you keep good food out of landfills. Edit this copy anytime to match your mission.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:justify-start sm:items-center items-stretch">
              <Link
                href="/listings"
                className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-emerald-600 text-white font-medium shadow hover:bg-emerald-700 transition-colors w-full sm:w-auto"
              >
                Browse listings
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-5 py-3 rounded-md border border-emerald-200 text-emerald-700 font-medium bg-white hover:bg-emerald-50 transition-colors w-full sm:w-auto"
              >
                Offer food
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {featurePoints.map((feature) => (
                <div key={feature.title} className="rounded-xl border bg-white/80 p-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{feature.title}</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{feature.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-12 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                Fresh from the community
              </p>
              <h2 className="text-2xl font-bold text-gray-900">Recent listings</h2>
              <p className="text-sm text-gray-600">A quick peek at what neighbors are sharing right now.</p>
            </div>
            <Link
              href="/listings"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 justify-center"
            >
              See all listings →
            </Link>
          </div>

          <ListingCarousel listings={recentListings} />
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-16">
          <div className="bg-white/85 backdrop-blur-sm border rounded-2xl shadow-lg p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700 mb-2 text-center">How it works</p>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={step.label} className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                    <p className="text-sm text-gray-600">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 text-xs text-gray-500 text-center">
              Need different messaging? Swap these blurbs in <code className="font-mono">src/app/page.tsx</code>.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
