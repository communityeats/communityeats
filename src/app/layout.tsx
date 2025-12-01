// src/app/layout.tsx
import './globals.css';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "CommunityEats" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white overflow-x-hidden">
        <Navbar />
        <main className="flex-1 w-full">
          <div className="max-w-6xl w-full mx-auto px-4">{children}</div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
