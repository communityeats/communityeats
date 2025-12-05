import { FEEDBACK_FORM_URL } from '@/lib/siteLinks'

export const metadata = { title: 'Give Feedback | CommunityEats' }

export default function FeedbackPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Give feedback</h1>
        <p className="text-gray-700 text-sm">
          Tell us what is working well and what could be better. Your notes help shape the next releases of
          CommunityEats.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Quick form</h2>
        <p className="text-gray-700 text-sm">
          Use the form to share bugs, feature requests, or general thoughts. Screenshots and steps to reproduce
          issues are especially helpful.
        </p>
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
        >
          Open feedback form
        </a>
        <p className="text-xs text-gray-500">Opens in a new tab so you can return to CommunityEats.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">What to share</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
          <li>What you were trying to do when you noticed an issue.</li>
          <li>Which device/browser you were using.</li>
          <li>Any ideas that would make CommunityEats more useful for your community.</li>
        </ul>
      </section>
    </div>
  )
}
