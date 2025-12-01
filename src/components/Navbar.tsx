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
      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 md:px-4 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
        active
          ? "text-green-800 bg-green-100"
          : "text-gray-700 hover:text-green-800 hover:bg-green-50"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
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
    <header className="border-b bg-white shadow-sm sticky top-0 z-50">
      <nav className="w-full flex flex-col sm:flex-row items-center sm:justify-between px-0 sm:px-8 py-3 space-y-2 sm:space-y-0">
        <Link href="/" className="hidden sm:block text-xl font-bold text-green-700">
          CommunityEats
        </Link>
        <div className="w-full sm:w-auto flex justify-evenly sm:justify-start gap-2 px-4 sm:px-0 mt-2 sm:mt-0">
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
        </div>
      </nav>
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
