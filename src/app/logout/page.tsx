"use client";

import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const doLogout = async () => {
      try {
        await signOut(auth);
        router.push("/");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    };

    doLogout();
  }, [router]);

  return <p className="p-4 text-center">Logging out...</p>;
}