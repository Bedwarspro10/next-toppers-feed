import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, isAdmin, loading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!loading) {
      if (!user) {
        setLocation("/login");
      } else if (requireAdmin && !isAdmin) {
        setLocation("/dashboard");
      }
    }
  }, [user, isAdmin, loading, setLocation, requireAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || (requireAdmin && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
}
