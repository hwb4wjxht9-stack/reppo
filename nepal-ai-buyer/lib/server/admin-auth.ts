import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Very simple admin login: one shared password from ADMIN_PASSWORD.
// The cookie holds a signature of the password, not the password itself.

const COOKIE = "admin_session";

function token(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 8) return null;
  return createHmac("sha256", pw).update("nepal-ai-buyer-admin").digest("hex");
}

export function adminPasswordSet(): boolean {
  return token() !== null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = token();
  const got = (await cookies()).get(COOKIE)?.value;
  if (!expected || !got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function logIn(password: string): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  const expected = token();
  if (!pw || !expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(pw);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}

export async function logOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
