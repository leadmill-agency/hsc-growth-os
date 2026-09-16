"use client";

import { useFormStatus } from "react-dom";

// Every action button in the app (per Rameel 2026-09-15: "it's unclear if an
// action is happening when a button is pressed"). The instant you click, the
// button disables and shows a spinner until the server action completes.
export function SubmitButton({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`${className ?? ""} ${pending ? "pointer-events-none opacity-60" : ""}`}
      disabled={pending}
      aria-busy={pending}
      title={title}
    >
      <span className="inline-flex items-center gap-1.5">
        {pending && (
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </span>
    </button>
  );
}
