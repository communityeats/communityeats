"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login attempt:", { email, password });
    // TODO: replace with real auth
    router.push("/dashboard");
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          className="input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn w-full">
          Login
        </button>
      </form>
      <p className="text-sm text-center">
        Don’t have an account?{" "}
        <Link href="/register" className="underline text-blue-600">
          Register
        </Link>
      </p>
    </div>
  );
}