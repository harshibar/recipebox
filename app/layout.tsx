import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "recipeBox",
  description: "Store messy recipes, get real macros.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-black/10 bg-white/60 backdrop-blur">
          <nav className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              🍝 recipeBox
            </Link>
            <div className="ml-auto flex items-center gap-4 text-sm">
              <Link href="/" className="hover:text-crust">
                Recipes
              </Link>
              <Link
                href="/import"
                className="rounded-full bg-crust px-3 py-1.5 font-medium text-white hover:bg-crust/90"
              >
                Add recipe
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
