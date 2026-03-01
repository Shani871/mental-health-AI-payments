export type UserRole = "USER" | "THERAPIST" | "ADMIN";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessToken: string;
  refreshToken?: string;
};

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.role || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("accessToken")) || Boolean(getAuthUser());
}

export function saveAuthUser(auth: AuthUser): void {
  localStorage.setItem("accessToken", auth.accessToken);
  if (auth.refreshToken) {
    localStorage.setItem("refreshToken", auth.refreshToken);
  }
  localStorage.setItem("auth", JSON.stringify(auth));
}

export function clearAuthUser(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("token");
  localStorage.removeItem("jwt");
  localStorage.removeItem("auth");
}

export function defaultRouteForRole(role: UserRole): string {
  if (role === "ADMIN") return "/admin";
  if (role === "THERAPIST") return "/therapist";
  return "/dashboard";
}
