"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update the Firebase Auth profile with the display name
      await updateProfile(userCredential.user, { displayName: name });

      // Get an ID token for the authenticated user
      const idToken = await userCredential.user.getIdToken();

      // Call our API to upsert the user document (name + email)
      const res = await fetch('/api/v1/account/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name, email }),
      });

      if (!res.ok) {
        // Try to surface a friendly error from the API
        let message = 'Failed to save user profile';
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {}
        throw new Error(message);
      }

      // Success — proceed to the intended page
      router.push(redirect);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  };

  return (
    <main className="min-h-screen bg-white px-4 pt-16 pb-10 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="bg-white sm:rounded-xl sm:shadow-md p-0 sm:p-8">
          <h1 className="text-xl sm:text-lg md:text-xl font-bold text-green-700 mb-6 text-center">
            Create an Account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 text-base sm:text-sm md:text-base">
            <div>
              <label htmlFor="name" className="block font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Jane Doe"
              />
            </div>

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
              disabled={loading}
              className="w-full py-3 px-4 bg-green-600 text-white rounded-md text-base sm:text-sm md:text-base hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Register'}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-600">
            Already have an account?{" "}
            <a
              href={`/login?redirect=${encodeURIComponent(redirect)}`}
              className="text-green-600 hover:underline"
            >
              Login
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}