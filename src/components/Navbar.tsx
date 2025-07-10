"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
        active
          ? "text-green-800 bg-green-100"
          : "text-gray-700 hover:text-green-800 hover:bg-green-50"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  return (
    <header className="border-b bg-white shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto flex flex-wrap items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-green-700">
          CommunityEats
        </Link>
        <div className="flex space-x-2 mt-2 sm:mt-0">
          <NavLink href="/" label="Home" />
          <NavLink href="/listings" label="Listings" />
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/login" label="Login" />
        </div>
      </nav>
    </header>
  );
}