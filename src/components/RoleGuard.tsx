import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { defaultRouteForRole, getAuthUser, type UserRole } from "../lib/auth";

type RoleGuardProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const location = useLocation();
  const authUser = getAuthUser();

  if (!authUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(authUser.role)) {
    return <Navigate to={defaultRouteForRole(authUser.role)} replace />;
  }

  return <>{children}</>;
}
