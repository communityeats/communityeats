export const metadata = { title: 'Privacy Policy | CommunityEats' }

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="text-gray-700 text-sm">
          This boilerplate outlines how CommunityEats could handle data. Replace with your finalized policy to
          reflect your actual practices.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Information we collect</h2>
        <p className="text-gray-700 text-sm">
          We collect the details you provide for listings and account creation, such as contact information,
          location labels, and messages exchanged with other users.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">How we use information</h2>
        <p className="text-gray-700 text-sm">
          Data is used to display listings, facilitate communication between users, improve the product, and keep the
          platform safe. We do not sell user data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Storage and retention</h2>
        <p className="text-gray-700 text-sm">
          Information is retained only as long as needed to operate the service and comply with legal requirements.
          You may request removal of your data as policies allow.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Your choices</h2>
        <p className="text-gray-700 text-sm">
          You can edit or remove your listings, request account deletion, and control what contact information you
          share in your posts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Updates</h2>
        <p className="text-gray-700 text-sm">
          We will revise this policy as features evolve. Continued use after updates indicates acceptance of the
          latest version.
        </p>
      </section>
    </div>
  )
}
