// src/app/layout.tsx
import "../styles/tailwind.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "CommunityEats" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto p-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}