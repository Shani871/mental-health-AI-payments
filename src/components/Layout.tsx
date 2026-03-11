import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Brain, BrainCircuit, Calendar, LayoutDashboard, MessageSquareHeart, ShieldCheck, Stethoscope, Wallet } from "lucide-react";
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
        { path: "/predict", label: "Predict Risk", icon: BrainCircuit },
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
    <div className="min-h-screen flex flex-col relative">
      <header className="sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="shell-card rounded-3xl px-4 py-3 md:px-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <Link to="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-700 text-teal-50 flex items-center justify-center shadow-sm">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="display-font text-lg md:text-xl font-bold tracking-tight text-slate-900">MindTriage</span>
                    <p className="text-[11px] text-slate-500 leading-none">AI + human care platform</p>
                  </div>
                </Link>
                {authUser ? (
                  <button
                    onClick={logout}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-red-700 bg-red-50 border border-red-100 hover:bg-red-100"
                  >
                    Logout
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="outline-button px-3 py-2 rounded-xl text-sm font-semibold">Login</Link>
                    <Link to="/signup" className="brand-button px-3 py-2 rounded-xl text-sm font-semibold">Sign Up</Link>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <nav className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors",
                          isActive
                            ? "bg-teal-100 text-teal-800 border border-teal-200"
                            : "bg-white/80 text-slate-700 border border-slate-200 hover:border-teal-200 hover:text-teal-800"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  {!authUser && (
                    <Link to="/therapist-signup" className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-800 whitespace-nowrap">
                      Therapist Sign Up
                    </Link>
                  )}
                </nav>

                {authUser && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setNotificationsOpen((prev) => !prev)}
                      className="relative p-2 rounded-xl text-slate-700 border border-slate-200 bg-white hover:border-teal-200"
                      aria-label="Notifications"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] leading-5 text-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                    {notificationsOpen && (
                      <div className="absolute right-0 mt-2 w-80 shell-card rounded-2xl p-2 z-30">
                        <div className="px-2 py-1 text-xs font-semibold text-slate-700">Notifications</div>
                        {notifications.length === 0 ? (
                          <div className="px-2 py-4 text-xs text-slate-500">No notifications.</div>
                        ) : (
                          <div className="max-h-80 overflow-auto space-y-1">
                            {notifications.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => markNotificationRead(item.id)}
                                className={cn(
                                  "w-full text-left px-2 py-2 rounded-lg border transition-colors",
                                  item.read
                                    ? "bg-white border-slate-200 text-slate-600"
                                    : "bg-teal-50 border-teal-100 text-slate-800"
                                )}
                              >
                                <div className="text-xs font-semibold">{item.message}</div>
                                <div className="text-[11px] mt-1 opacity-70">{new Date(item.createdAt).toLocaleString()}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {authUser && (
          <div className="mb-6 shell-card rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                {profileInitials}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{authUser.name}</div>
                <div className="text-xs text-slate-600">{authUser.email}</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-100">
              {authUser.role}
            </span>
          </div>
        )}
        <Outlet />
      </main>

      <footer className="py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="shell-card rounded-2xl px-4 py-5 text-center text-slate-600 text-sm">
            <p className="font-semibold">© 2026 MindTriage SaaS</p>
            <p className="mt-1 text-xs">
              AI triage supports decisions but does not replace professional diagnosis or treatment.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
