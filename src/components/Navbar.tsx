"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`md:px-4 px-10 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
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
        <div className="flex space-x-2 mt-2 sm:mt-0">
          <NavLink href="/" label="Home" />
          <NavLink href="/listings" label="Listings" />
          {user ? (
            <>
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/messages" label="Messages" />
            </>
          ) : (
            <NavLink href="/login" label="Login" />
          )}
        </div>
      </nav>
    </header>
  );
}
