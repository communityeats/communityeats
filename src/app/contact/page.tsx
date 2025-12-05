import { CONTACT_FORM_URL } from '@/lib/siteLinks'

export const metadata = { title: 'Contact | CommunityEats' }

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Contact us</h1>
        <p className="text-gray-700">
          Need to reach the CommunityEats team? Use the form below to ask a question, report an issue,
          or suggest improvements. We keep replies quick.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Send us a message</p>
          <p className="text-sm text-gray-700">
            The form opens in a new tab so you can come right back to CommunityEats when you are done.
          </p>
        </div>
        <a
          href={CONTACT_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
        >
          Open contact form
        </a>
      </div>
    </div>
  )
}
