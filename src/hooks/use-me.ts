import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/auth.functions";

export function useMe() {
  const fn = useServerFn(getMe);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fn(),
    retry: false,
    staleTime: 60_000,
  });
}