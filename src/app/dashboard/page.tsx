import AuthGuard from "@/components/AuthGuard";

export default function Dashboard() {
  return (
    <AuthGuard>
      <section>
        <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
        <p>You’ll see your listings and claims here.</p>
      </section>
    </AuthGuard>
  );
}