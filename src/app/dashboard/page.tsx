import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";

export default function Dashboard() {
  return (
    <AuthGuard>
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 py-4 px-4">
        {/* Header Text */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            You’ll see your listings and claims here.
          </p>
        </div>

        {/* Logout Button */}
        <Link
          href="/logout"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow hover:bg-green-700 transition-colors"
        >
          Logout
        </Link>
      </section>
    </AuthGuard>
  );
}