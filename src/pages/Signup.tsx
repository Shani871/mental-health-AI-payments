import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithTimeout, safeParseJson } from "../lib/http";

type ApiResponse = {
  success: boolean;
  message: string;
};

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithTimeout("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await safeParseJson(response)) as ApiResponse;
      if (!response.ok) {
        throw new Error(payload?.message || "Signup failed.");
      }

      setSuccess(payload?.message || "Signup successful. Please login.");
      setTimeout(() => navigate("/login"), 700);
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError"
        ? "Signup request timed out. Make sure backend is running on port 8080."
        : (err instanceof Error ? err.message : "Unable to signup.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900">Create User Account</h1>
        <p className="text-sm text-slate-600 mt-1">Start by creating your user profile.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
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
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
          {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">{success}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          Already have an account? <Link to="/login" className="text-indigo-700 font-medium hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
}
