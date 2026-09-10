import Link from "next/link";

// Internal Growth OS shell — HSC-branded: ink sidebar, signal-blue accent,
// Oswald wordmark. Customer-facing routes (/p/*) render outside this group.

const nav = [
  { href: "/", label: "Home" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/accounts", label: "Accounts" },
  { href: "/bids", label: "Bids" },
  { href: "/ploybooks", label: "Ploybooks" },
  { href: "/approvals", label: "Approvals" },
  { href: "/guide", label: "Guide" },
  { href: "/history", label: "History" },
];

export default function GrowthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-ink px-4 py-6 text-white">
        <div className="mb-8 px-2">
          <div className="font-display text-lg font-bold uppercase leading-tight tracking-wide">
            Houston
            <br />
            Sign Crafters
          </div>
          <div className="mt-1 inline-block bg-signal px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-widest text-white">
            Growth OS
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-ink-700 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-3 text-[11px] leading-relaxed text-white/40">
          UL-certified · Built in Houston
          <br />
          5-year warranty
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
