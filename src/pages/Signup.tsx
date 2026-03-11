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
    <div className="auth-shell">
      <div className="auth-card">
        <aside className="auth-aside">
          <h2 className="display-font text-2xl font-bold">User onboarding</h2>
          <p className="mt-3 text-sm text-teal-50/90">
            Create a user account to access AI triage, therapist discovery, booking, and payment history.
          </p>
          <div className="mt-6 space-y-2 text-sm">
            <p>• Personalized dashboard</p>
            <p>• Slot booking and rescheduling</p>
            <p>• AI risk prediction + trend tools</p>
          </div>
        </aside>

        <div className="auth-main">
          <h1 className="display-font text-2xl font-bold text-slate-900">Create User Account</h1>
          <p className="text-sm text-slate-600 mt-1">Start by creating your user profile.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="field-input"
            />
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
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              className="field-input"
            />
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
            {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">{success}</div>}
            <button
              type="submit"
              disabled={loading}
              className="brand-button w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600">
            Already have an account? <Link to="/login" className="text-teal-700 font-semibold hover:underline">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
