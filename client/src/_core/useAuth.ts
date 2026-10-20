import { trpc } from "./trpc";

export function useAuth() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000, retry: false });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.invalidate() });
  const user = me.data ?? null;
  return {
    user, loading: me.isLoading, isStaff: !!user, isAdmin: user?.role === "admin",
    refresh: () => utils.invalidate(), logout: () => logout.mutate(),
  };
}
