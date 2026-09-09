"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { expectedSessionToken, passwordMatches, SESSION_COOKIE } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    redirect("/login?error=1");
  }
  const token = await expectedSessionToken();
  if (!token) redirect("/login?error=1");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  redirect("/");
}
