import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "movealong-dev-secret-change-in-prod-32chars";
const COOKIE_NAME = "movealong_token";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}
export function signToken(payload: { id: string; email: string; name: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}
export function verifyToken(token: string): { id: string; email: string; name: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}
export function clearAuthCookie() {
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
export function getAuthFromCookie(): { id: string; email: string; name: string } | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function authFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/movealong_token=([^;]+)/);
  if (!m) return null;
  return verifyToken(decodeURIComponent(m[1]));
}
