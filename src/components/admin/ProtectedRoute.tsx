import { Navigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allowed roles – if empty, any authenticated user can access. */
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({
  children,
  allowedRoles = [],
}: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (
    allowedRoles.length > 0 &&
    profile &&
    !allowedRoles.includes(profile.role)
  ) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground max-w-md">
          Your current role (<span className="font-semibold">{profile.role}</span>) does not have
          permission to view this page. Contact an admin to request elevated
          access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
