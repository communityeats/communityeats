// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="border-t px-4 py-2 text-sm text-center text-gray-500">
      © {new Date().getFullYear()} CommunityEats
    </footer>
  );
}