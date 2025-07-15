// src/app/layout.tsx
import './globals.css';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "CommunityEats" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 bg-white">
            <div className="container mx-auto p-4  min-h-screen">
              {children}
            </div>
        </main>
        <Footer />
      </body>
    </html>
  );
}