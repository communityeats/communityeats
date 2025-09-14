"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LoginForm({ redirect }: { redirect: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push(redirect);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  return (
    <main className="min-h-screen bg-white px-4 pt-16 pb-10 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="bg-white sm:rounded-xl sm:shadow-md p-0 sm:p-8">
          <h1 className="text-xl sm:text-lg md:text-xl font-bold text-green-700 mb-6 text-center">
            Login to CommunityEats
          </h1>

          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6 text-base sm:text-sm md:text-base">
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
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-green-500 focus:border-green-500"
                placeholder="you@example.com"
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
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-green-500 focus:border-green-500"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full py-3 px-4 bg-green-600 text-white rounded-md text-base sm:text-sm md:text-base hover:bg-green-700 transition"
            >
              Sign In
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-600">
            Don&apos;t have an account?{" "}
            <a
              href={`/register?redirect=${encodeURIComponent(redirect)}`}
              className="text-green-600 hover:underline"
            >
              Register
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}