export const metadata = { title: 'Terms & Conditions | CommunityEats' }

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900">Terms & Conditions</h1>
        <p className="text-gray-700 text-sm">
          CommunityEats is intended for sharing surplus food within your community. By using this app you agree
          to these terms.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Respect, courtesy &amp; kindness</h2>
        <ul className="list-disc pl-5 text-gray-700 text-sm space-y-2">
          <li>We&apos;re all in this together to create a welcoming environment. Let&apos;s treat everyone with respect.</li>
          <li>Treat others how you would like them to treat you.</li>
          <li>Behave like adults, settle any disputes maturely, and reach out if you need help doing so.</li>
          <li>Respect each other&apos;s time. If you commit to picking something up, show up or let the giver know if plans change.</li>
          <li>Do not share sensitive personal information through the platform.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">First come, first served</h2>
        <ul className="list-disc pl-5 text-gray-700 text-sm space-y-2">
          <li>If multiple people request the same item, the giver decides who gets it. The goal is to pass food on easily and safely.</li>
          <li>Give away food quickly and easily.</li>
          <li>Maximise food safety.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Communicate honestly and accurately</h2>
        <p className="text-gray-700 text-sm">
          Describe items you&apos;re offering accurately and store items properly while awaiting pickup.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">All care but no responsibility</h2>
        <ul className="list-disc pl-5 text-gray-700 text-sm space-y-2">
          <li>All transactions are at your own risk and the team has no responsibility for food shared.</li>
          <li>The team has no liability for issues arising from exchanges arranged through the app.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">It is a gift</h2>
        <p className="text-gray-700 text-sm">
          It&apos;s okay to trade if agreed beforehand, and be prepared to give it away for free - the main aim of this app.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Changes</h2>
        <p className="text-gray-700 text-sm">
          The team may update these terms as features change.
        </p>
      </section>
    </div>
  )
}
