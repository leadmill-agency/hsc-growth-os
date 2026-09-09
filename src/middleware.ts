import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth/session";

// Auth gate for the internal app. Public by design:
//   /login            — the gate itself
//   /p/*              — customer-facing ABM pages (private by unguessable token)
//   /api/visitor      — RB2B webhook (guarded by X-Intake-Token)
// Everything else requires a valid session cookie.
// If AUTH_SECRET/APP_PASSWORD are unset (fresh local dev), the gate stays open.

export async function middleware(request: NextRequest) {
  if (!process.env.AUTH_SECRET || !process.env.APP_PASSWORD) {
    return NextResponse.next();
  }
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSession(cookie)) {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|p/|d/|api/visitor|api/rb2b|_next/|favicon\\.ico|.*\\.(?:png|jpg|svg|ico|css|js)$).*)"],
};
