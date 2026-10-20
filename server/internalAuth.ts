import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const COOKIE_NAME = "cr_session";
const TTL_HOURS = 12;

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET ?? "";
  if (process.env.NODE_ENV === "production" && s.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  }
  return new TextEncoder().encode(s || "dev-only-secret-change-me-dev-only-secret");
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(pw, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const signSession = (userId: number, role: string) =>
  new SignJWT({ role }).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId))
    .setIssuedAt().setExpirationTime(`${TTL_HOURS}h`).sign(secret());

export async function verifySession(token: string): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ? { userId: Number(payload.sub) } : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = () => ({
  httpOnly: true, sameSite: "lax" as const, path: "/",
  secure: process.env.COOKIE_SECURE === "true", maxAge: TTL_HOURS * 3600 * 1000,
});
