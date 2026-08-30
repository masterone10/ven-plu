import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { getMyPointsBalance } from "@/lib/points.functions";

/**
 * Hook to retrieve the authenticated user's authoritative points balance.
 * Returns null if the user is anonymous/unauthenticated.
 */
export function usePointsBalance() {
  const { session, loading: sessionLoading } = useSession();
  const fetchPoints = useServerFn(getMyPointsBalance);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["user-points-balance", session?.user?.id],
    queryFn: () => fetchPoints(),
    enabled: Boolean(session?.user?.id),
    staleTime: 10_000,
  });

  return {
    balance: session ? (data?.balance ?? 0) : null,
    isLoading: sessionLoading || (Boolean(session) && isLoading),
    refetch,
  };
}
