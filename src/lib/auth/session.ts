// Session auth for the internal app. Edge- and Node-compatible (Web Crypto only),
// because verification runs in Next middleware.
// Model: one shared APP_PASSWORD (Rameel + Jamal); the session cookie carries an
// HMAC derived from AUTH_SECRET, so rotating either env var invalidates all sessions.
// Customer-facing routes (/p/*) and token-guarded webhooks (/api/visitor) stay outside.

export const SESSION_COOKIE = "gos_session";
const SESSION_PAYLOAD = "growth-os-session-v1";

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function expectedSessionToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return hmacHex(secret, SESSION_PAYLOAD);
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await expectedSessionToken();
  if (!expected) return false;
  // Constant-time-ish compare
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
