import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Brain, Calendar, LayoutDashboard, MessageSquareHeart, ShieldCheck, Stethoscope, Wallet } from "lucide-react";
import { cn } from "../lib/utils";
import { clearAuthUser, getAuthUser, type AuthUser } from "../lib/auth";
import { apiFetch } from "../lib/api";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    setAuthUser(getAuthUser());
  }, [location.pathname]);

  useEffect(() => {
    let timer: number | undefined;
    const loadNotifications = async () => {
      if (!authUser) return;
      try {
        const [countRes, rows] = await Promise.all([
          apiFetch<{ count: number }>("/api/notifications/unread-count"),
          apiFetch<NotificationItem[]>("/api/notifications/my"),
        ]);
        setUnreadCount(Number(countRes.count || 0));
        setNotifications(rows.slice(0, 8));
      } catch {
        // ignore notification errors in shell layout
      }
    };
    loadNotifications();
    if (authUser) {
      timer = window.setInterval(loadNotifications, 30000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [authUser, location.pathname]);

  const navItems = (() => {
    const common = [{ path: "/", label: "Home", icon: Brain }];
    if (!authUser) {
      return common;
    }

    if (authUser.role === "USER") {
      return [
        ...common,
        { path: "/triage", label: "AI Triage", icon: MessageSquareHeart },
        { path: "/therapists", label: "Therapists", icon: Calendar },
        { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/payments", label: "Payments", icon: Wallet },
      ];
    }

    if (authUser.role === "THERAPIST") {
      return [...common, { path: "/therapist", label: "Therapist Panel", icon: Stethoscope }];
    }

    return [...common, { path: "/admin", label: "Admin Panel", icon: ShieldCheck }];
  })();

  const logout = () => {
    clearAuthUser();
    setAuthUser(null);
    navigate("/login");
  };

  const markNotificationRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // keep UX resilient
    }
  };

  const profileInitials = authUser?.name
    ? authUser.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "U";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 tracking-tight">MindTriage</span>
              </Link>
            </div>
            <nav className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
              {authUser && (
                <div className="relative ml-1">
                  <button
                    onClick={() => setNotificationsOpen((prev) => !prev)}
                    className="relative p-2 rounded-md text-slate-600 hover:bg-slate-100"
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 text-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-20">
                      <div className="px-2 py-1 text-xs font-semibold text-slate-600">Notifications</div>
                      {notifications.length === 0 ? (
                        <div className="px-2 py-4 text-xs text-slate-500">No notifications.</div>
                      ) : (
                        <div className="max-h-80 overflow-auto space-y-1">
                          {notifications.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => markNotificationRead(item.id)}
                              className={cn(
                                "w-full text-left px-2 py-2 rounded-lg border",
                                item.read
                                  ? "bg-white border-slate-200 text-slate-600"
                                  : "bg-indigo-50 border-indigo-100 text-slate-800"
                              )}
                            >
                              <div className="text-xs font-medium">{item.message}</div>
                              <div className="text-[11px] mt-1 opacity-70">{new Date(item.createdAt).toLocaleString()}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {authUser ? (
                <button
                  onClick={logout}
                  className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Logout
                </button>
              ) : (
                <>
                  <Link to="/login" className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Login
                  </Link>
                  <Link to="/signup" className="px-3 py-2 rounded-md text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                    Sign Up
                  </Link>
                  <Link to="/therapist-signup" className="px-3 py-2 rounded-md text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                    Therapist Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {authUser && (
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                {profileInitials}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{authUser.name}</div>
                <div className="text-xs text-slate-600">{authUser.email}</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {authUser.role}
            </span>
          </div>
        )}
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <p>© 2026 MindTriage SaaS. This is a demonstration platform.</p>
          <p className="mt-2 text-xs">
            Disclaimer: The AI triage is not a substitute for professional medical advice, diagnosis, or treatment.
          </p>
        </div>
      </footer>
    </div>
  );
}
