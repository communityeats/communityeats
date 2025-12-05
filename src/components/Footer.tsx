// src/components/Footer.tsx
import Link from 'next/link'

const footerLinks = [
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'T&C' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/feedback', label: 'Give Feedback' },
]

export default function Footer() {
  return (
    <footer className="border-t px-4 py-4 text-sm text-gray-500">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} CommunityEats
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-gray-600">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
