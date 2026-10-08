import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import { markAuthenticatedSession, resetAuthSessionTracking } from "@/lib/auth-session";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (user) {
      markAuthenticatedSession();
    }
  }, [user]);

  /** Ends session and always sends user to login (sidebar + header both use this). */
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      resetAuthSessionTracking();
      queryClient.setQueryData(["/api/auth/user"], null);
      void queryClient.cancelQueries();
      window.location.replace("/login");
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
