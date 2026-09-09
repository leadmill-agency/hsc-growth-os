import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        action={loginAction}
        className="w-80 space-y-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div>
          <div className="text-lg font-bold tracking-tight">HSC Growth OS</div>
          <div className="text-xs text-zinc-500">Houston Sign Crafters — internal</div>
        </div>
        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="Team password"
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        {params.error && (
          <p className="text-xs text-red-600">Wrong password. Try again.</p>
        )}
        <button className="w-full rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
          Sign in
        </button>
      </form>
    </div>
  );
}
