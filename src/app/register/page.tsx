"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Register attempt:", { name, email, password });
    // TODO: replace with real registration logic
    router.push("/dashboard");
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-4">
      <h1 className="text-2xl font-bold">Register</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          className="input"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          Register
        </button>
      </form>
      <p className="text-sm text-center">
        Already have an account?{" "}
        <Link href="/login" className="underline text-blue-600">
          Login
        </Link>
      </p>
    </div>
  );
}