import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { userById } from "../db";
import { COOKIE_NAME, verifySession } from "../internalAuth";

export async function getSessionUser(req: Request): Promise<User | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const session = await verifySession(token);
  const user = session ? userById(session.userId) : undefined;
  return user?.active ? user : null;
}
