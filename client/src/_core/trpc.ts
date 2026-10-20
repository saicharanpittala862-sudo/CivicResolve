import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();
export type Out = inferRouterOutputs<AppRouter>;
export type PublicCase = Out["portal"]["detail"];
export type StaffCase = Out["officer"]["case"];
export type BoardRow = Out["public"]["board"][number];
export type Catalog = Out["public"]["catalog"];

export function errorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "Something went wrong";
  // zod issues arrive as a JSON array of {message}; show the first one in plain words.
  if (m.startsWith("[")) {
    try { return (JSON.parse(m) as { message: string }[])[0]?.message ?? "Please check the fields and try again."; } catch { /* fall through */ }
  }
  return m;
}
