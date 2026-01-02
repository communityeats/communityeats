"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";

type NavItem = { href: string; label: string; icon: ReactNode };

function NavLink({ href, label, icon }: NavItem) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 md:px-4 px-2 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 border ${
        active
          ? "text-green-800 bg-green-50 border-green-100 shadow-sm"
          : "text-gray-700 bg-white border-transparent hover:text-green-800 hover:bg-green-50"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  return (
    <header className="border-b bg-white/95 shadow-sm sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3">
          <Link href="/" className="text-lg sm:text-xl font-bold text-green-700">
            CommunityEats
          </Link>
          <Link
            href="/listings/new"
            className="sm:hidden inline-flex items-center rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-green-700"
          >
            + New listing
          </Link>
        </div>
        <nav className="flex flex-wrap items-stretch gap-2 pb-3 sm:items-center sm:gap-3 sm:pb-4">
          <NavLink href="/" label="Home" icon={<HomeIcon />} />
          <NavLink href="/listings" label="Listings" icon={<PinIcon />} />
          {user ? (
            <>
              <NavLink href="/dashboard" label="Dashboard" icon={<DashboardIcon />} />
              <NavLink href="/messages" label="Messages" icon={<MessageIcon />} />
            </>
          ) : (
            <NavLink href="/login" label="Login" icon={<LoginIcon />} />
          )}
        </nav>
      </div>
    </header>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <rect x="3" y="3" width="8" height="7" rx="1" />
      <rect x="13" y="3" width="8" height="4" rx="1" />
      <rect x="13" y="9" width="8" height="12" rx="1" />
      <rect x="3" y="14" width="8" height="7" rx="1" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}
