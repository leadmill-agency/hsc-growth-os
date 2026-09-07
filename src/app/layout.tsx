import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HSC Growth OS",
  description: "Houston Sign Crafters — internal revenue operating system",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/accounts", label: "Accounts" },
  { href: "/ploybooks", label: "Ploybooks" },
  { href: "/approvals", label: "Approvals" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="flex min-h-screen">
          <aside className="w-52 shrink-0 border-r border-zinc-200 bg-white px-4 py-6">
            <div className="mb-8 px-2">
              <div className="text-sm font-bold tracking-tight">HSC Growth OS</div>
              <div className="text-xs text-zinc-500">Houston Sign Crafters</div>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 px-8 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
