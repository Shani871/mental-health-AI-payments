import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithTimeout, safeParseJson } from "../lib/http";

type ApiResponse = {
  success: boolean;
  message: string;
};

export default function TherapistSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    specialization: "",
    experienceYears: "",
    hourlyRate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      specialization: form.specialization.trim(),
      experienceYears: Number(form.experienceYears),
      hourlyRate: Number(form.hourlyRate),
    };

    if (!Number.isFinite(payload.experienceYears) || payload.experienceYears < 0) {
      setError("Experience years must be a valid number.");
      return;
    }
    if (!Number.isFinite(payload.hourlyRate) || payload.hourlyRate <= 0) {
      setError("Hourly rate must be greater than 0.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithTimeout("/api/auth/therapist/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await safeParseJson(response)) as ApiResponse;
      if (!response.ok) {
        throw new Error(body?.message || "Therapist signup failed.");
      }
      setSuccess(body?.message || "Therapist registration submitted.");
      setTimeout(() => navigate("/login"), 700);
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError"
        ? "Signup request timed out. Make sure backend is running on port 8080."
        : (err instanceof Error ? err.message : "Unable to register therapist.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900">Therapist Registration</h1>
        <p className="text-sm text-slate-600 mt-1">Submit details for admin verification.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Full name"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="Email"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => onChange("password", e.target.value)}
            placeholder="Password"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            value={form.specialization}
            onChange={(e) => onChange("specialization", e.target.value)}
            placeholder="Specialization (e.g., Anxiety)"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="number"
            min="0"
            value={form.experienceYears}
            onChange={(e) => onChange("experienceYears", e.target.value)}
            placeholder="Experience years"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="number"
            min="1"
            step="0.01"
            value={form.hourlyRate}
            onChange={(e) => onChange("hourlyRate", e.target.value)}
            placeholder="Hourly rate"
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
            {loading ? "Submitting..." : "Register as Therapist"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          Already registered? <Link to="/login" className="text-indigo-700 font-medium hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
}
