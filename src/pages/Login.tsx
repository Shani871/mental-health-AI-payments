import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithTimeout, safeParseJson } from "../lib/http";
import { defaultRouteForRole, saveAuthUser, type UserRole } from "../lib/auth";

type AuthResponse = {
  success: boolean;
  message: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

function normalizeRole(role: string): UserRole {
  const upper = role.toUpperCase();
  if (upper === "ADMIN" || upper === "THERAPIST" || upper === "USER") {
    return upper;
  }
  return "USER";
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetchWithTimeout("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await safeParseJson(response)) as AuthResponse;
      if (!response.ok || !payload?.data?.accessToken) {
        throw new Error(payload?.message || "Login failed.");
      }

      const authUser = { ...payload.data, role: normalizeRole(payload.data.role) };
      saveAuthUser(authUser);
      navigate(defaultRouteForRole(authUser.role));
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError"
        ? "Login request timed out. Make sure backend is running on port 8080."
        : (err instanceof Error ? err.message : "Unable to login.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <aside className="auth-aside">
          <h2 className="display-font text-2xl font-bold">Welcome back</h2>
          <p className="mt-3 text-sm text-teal-50/90">
            Continue your mental health journey. Your sessions, payments, and triage history are available after sign in.
          </p>
          <div className="mt-6 space-y-2 text-sm">
            <p>• Role-based dashboard routing</p>
            <p>• Secure token-based access</p>
            <p>• Booking and notification sync</p>
          </div>
        </aside>

        <div className="auth-main">
          <h1 className="display-font text-2xl font-bold text-slate-900">Login</h1>
          <p className="text-sm text-slate-600 mt-1">Sign in to continue.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="field-input"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="field-input"
            />
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="brand-button w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600 space-y-1">
            <div>
              New user? <Link to="/signup" className="text-teal-700 font-semibold hover:underline">Create account</Link>
            </div>
            <div>
              Therapist? <Link to="/therapist-signup" className="text-teal-700 font-semibold hover:underline">Register as therapist</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
