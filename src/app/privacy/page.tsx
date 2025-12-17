export const metadata = { title: 'Privacy Policy | CommunityEats' }

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="text-gray-700 text-sm">
          CommunityEats is committed to providing quality services to you and this policy outlines our ongoing
          obligations to you in respect of how we manage your Personal Information.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Australian Privacy Principles</h2>
        <div className="text-gray-700 text-sm space-y-2">
          <p>
            We have adopted the Australian Privacy Principles (APPs) contained in the Privacy Act 1988 (Cth). The
            APPs govern the way in which we collect, use, disclose, store, secure, and dispose of your Personal
            Information.
          </p>
          <p>
            A copy of the Australian Privacy Principles may be obtained from the Office of the Australian Information
            Commissioner at{' '}
            <a className="text-blue-600 underline" href="https://www.oaic.gov.au/" target="_blank" rel="noreferrer">
              https://www.oaic.gov.au/
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">What is Personal Information and why do we collect it?</h2>
        <div className="text-gray-700 text-sm space-y-2">
          <p>
            Personal Information is information or an opinion that identifies an individual. Examples of Personal
            Information we collect include names, addresses, email addresses, phone and facsimile numbers.
          </p>
          <p>
            This Personal Information is obtained in many ways including by email, via our website www.communityeats.app,
            from cookies, and from third parties. We do not guarantee website links or the policy of authorised third
            parties.
          </p>
          <p>
            We collect your Personal Information for the primary purpose of providing our services to you, providing
            information to our clients, and marketing. We may also use your Personal Information for secondary purposes
            closely related to the primary purpose, in circumstances where you would reasonably expect such use or
            disclosure. You may unsubscribe from our mailing or marketing lists at any time by contacting us in writing.
          </p>
          <p>
            When we collect Personal Information we will, where appropriate and where possible, explain to you why we are
            collecting the information and how we plan to use it.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Sensitive Information</h2>
        <p className="text-gray-700 text-sm">
          Sensitive information is defined in the Privacy Act to include information or opinion about such things as an
          individual&apos;s racial or ethnic origin, political opinions, membership of a political association, religious
          or philosophical beliefs, membership of a trade union or other professional body, criminal record, or health
          information.
        </p>
        <p className="text-gray-700 text-sm">Sensitive information will be used by us only:</p>
        <ul className="list-disc pl-5 text-gray-700 text-sm space-y-2">
          <li>For the primary purpose for which it was obtained.</li>
          <li>For a secondary purpose that is directly related to the primary purpose.</li>
          <li>With your consent; or where required or authorised by law.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Third Parties</h2>
        <p className="text-gray-700 text-sm">
          Where reasonable and practicable to do so, we will collect your Personal Information only from you. However,
          in some circumstances we may be provided with information by third parties. In such a case we will take
          reasonable steps to ensure that you are made aware of the information provided to us by the third party.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Disclosure of Personal Information</h2>
        <p className="text-gray-700 text-sm">Your Personal Information may be disclosed in a number of circumstances including:</p>
        <ul className="list-disc pl-5 text-gray-700 text-sm space-y-2">
          <li>Third parties where you consent to the use or disclosure; and</li>
          <li>Where required or authorised by law.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Security of Personal Information</h2>
        <div className="text-gray-700 text-sm space-y-2">
          <p>
            Your Personal Information is stored in a manner that reasonably protects it from misuse and loss and from
            unauthorized access, modification, or disclosure.
          </p>
          <p>
            When your Personal Information is no longer needed for the purpose for which it was obtained, we will take
            reasonable steps to destroy or permanently de-identify your Personal Information. However, most of the
            Personal Information is or will be stored in client files which will be kept by us for a minimum of 7 years.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Access to your Personal Information</h2>
        <div className="text-gray-700 text-sm space-y-2">
          <p>
            You may access the Personal Information we hold about you and update and/or correct it, subject to certain
            exceptions. If you wish to access your Personal Information, please contact us in writing.
          </p>
          <p>CommunityEats will not charge any fee for your access request, but may charge an administrative fee for providing a copy of your Personal Information.</p>
          <p>In order to protect your Personal Information we may require identification from you before releasing the requested information.</p>
        </div>
      </section>
    </div>
  )
}
