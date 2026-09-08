import Link from "next/link";

// Internal Growth OS shell — sidebar navigation. Customer-facing routes (/p/*)
// live outside this group and render without it.

const nav = [
  { href: "/", label: "Home" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/accounts", label: "Accounts" },
  { href: "/ploybooks", label: "Ploybooks" },
  { href: "/approvals", label: "Approvals" },
];

export default function GrowthLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
