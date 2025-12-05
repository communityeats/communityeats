export const metadata = { title: 'Terms & Conditions | CommunityEats' }

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Terms & Conditions</h1>
        <p className="text-gray-700 text-sm">
          Replace this boilerplate with your finalized terms. It is a starting point to outline how CommunityEats
          should be used and what users can expect.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Using CommunityEats</h2>
        <p className="text-gray-700 text-sm">
          CommunityEats is intended for sharing surplus food within your community. Users agree to post accurate
          information, respect local laws, and follow any pickup guidelines set by posters.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">User responsibilities</h2>
        <p className="text-gray-700 text-sm">
          You are responsible for the items you list or claim, ensuring food safety, and communicating clearly with
          other users. Do not share sensitive personal information through the platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Liability</h2>
        <p className="text-gray-700 text-sm">
          This app is provided “as is” without warranties. By using CommunityEats you agree that the team is not
          liable for issues arising from exchanges arranged through the app.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Changes</h2>
        <p className="text-gray-700 text-sm">
          These terms may be updated as features change. Continued use of CommunityEats means you accept any
          updated terms posted here.
        </p>
      </section>
    </div>
  )
}
