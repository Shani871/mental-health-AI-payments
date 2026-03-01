import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithTimeout, safeParseJson } from "../lib/http";
import { defaultRouteForRole, saveAuthUser } from "../lib/auth";

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

      saveAuthUser(payload.data);
      navigate(defaultRouteForRole(payload.data.role as "USER" | "THERAPIST" | "ADMIN"));
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
    <div className="max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900">Login</h1>
        <p className="text-sm text-slate-600 mt-1">Sign in to continue.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600 space-y-1">
          <div>
            New user? <Link to="/signup" className="text-indigo-700 font-medium hover:underline">Create account</Link>
          </div>
          <div>
            Therapist? <Link to="/therapist-signup" className="text-indigo-700 font-medium hover:underline">Register as therapist</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
