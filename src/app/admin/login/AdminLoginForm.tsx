"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function AdminLoginForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/v1/admin/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          router.replace("/admin");
        }
      } catch {
        // ignore auto-redirect errors
      }
    });

    return () => unsub();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();

      const res = await fetch("/api/v1/admin/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || "You do not have admin access.");
      }

      router.push("/admin");
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || "Unable to log in as admin.";
      setError(message);
      await signOut(auth).catch(() => null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-14 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
              Admin only
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Admin Sign In</h1>
            <p className="text-sm text-gray-600 mt-2">
              Use your administrator credentials to manage CommunityEats.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 text-sm">
            <div>
              <label htmlFor="email" className="block font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-xs text-center text-gray-500">
            This area is intentionally hidden from public navigation.
          </p>
        </div>
      </div>
    </main>
  );
}
