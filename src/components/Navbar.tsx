/* src/components/Navbar.tsx */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";   // highlight active link if desired

/** Simple helper to apply bold style to the current route */
function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href); // catch /listings/123 etc.

  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm ${
        active ? "font-semibold text-green-700" : "text-gray-700"
      } hover:text-green-800`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  return (
    <header className="border-b w-full">
      <nav className="container mx-auto flex items-center justify-between px-4 py-2">
        <Link href="/" className="text-lg font-bold">
          CommunityEats
        </Link>
        <div className="flex items-center space-x-1">
          <NavLink href="/" label="Home" />
          <NavLink href="/listings" label="Listings" />
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/login" label="Login" />
        </div>
      </nav>
    </header>
  );
}