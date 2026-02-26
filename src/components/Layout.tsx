import { Outlet, Link, useLocation } from "react-router-dom";
import { Brain, Calendar, LayoutDashboard, MessageSquareHeart } from "lucide-react";
import { cn } from "../lib/utils";

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Brain },
    { path: "/triage", label: "AI Triage", icon: MessageSquareHeart },
    { path: "/therapists", label: "Therapists", icon: Calendar },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

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
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
