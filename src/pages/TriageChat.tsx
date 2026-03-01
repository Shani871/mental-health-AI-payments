import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";

type Question = {
  key: string;
  text: string;
};

type Assessment = {
  id: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "EMERGENCY" | null;
  phq9Score: number | null;
  gad7Score: number | null;
  score: number | null;
  summary: string | null;
  completed: boolean;
};

type MoodTrend = {
  averageMood: number;
  minMood: number;
  maxMood: number;
  entries: number;
  history: Array<{ id: string; score: number; note?: string; createdAt: string }>;
};

const answerOptions = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

export default function TriageChat() {
  const [tool, setTool] = useState<"COMBINED" | "PHQ9" | "GAD7">("COMBINED");
  const [consent, setConsent] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Assessment | null>(null);
  const [moodScore, setMoodScore] = useState(7);
  const [moodNote, setMoodNote] = useState("");
  const [moodTrend, setMoodTrend] = useState<MoodTrend | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((q) => answers[q.key] !== undefined),
    [questions, answers]
  );

  const loadMoodTrend = async () => {
    try {
      const trend = await apiFetch<MoodTrend>("/api/ai/mood/trend?days=30");
      setMoodTrend(trend);
    } catch {
      // keep page functional even if mood endpoints fail
    }
  };

  useEffect(() => {
    loadMoodTrend();
  }, []);

  const start = async () => {
    if (!consent) {
      setError("You must accept the AI disclaimer to start.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const assessment = await apiFetch<Assessment>(`/api/ai/structured/start?tool=${tool}`, { method: "POST" });
      await apiFetch(`/api/ai/accept-disclaimer/${assessment.id}`, { method: "POST" });
      const q = await apiFetch<Question[]>(`/api/ai/structured/questions?tool=${tool}`);
      setAssessmentId(assessment.id);
      setQuestions(q);
      setAnswers({});
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start assessment.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!assessmentId || !allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const completed = await apiFetch<Assessment>(`/api/ai/structured/${assessmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ responses: answers, note }),
      });
      setResult(completed);
      await loadMoodTrend();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitMood = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiFetch(`/api/ai/mood/checkin?score=${moodScore}&note=${encodeURIComponent(moodNote)}`, {
        method: "POST",
      });
      setMoodNote("");
      await loadMoodTrend();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mood check-in.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-slate-900">AI Structured Assessment</h1>
        <p className="text-slate-600 mt-2">
          This assistant is not a medical diagnosis tool. It provides triage guidance and recommends professional help.
        </p>

        <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          If you are in immediate danger or having self-harm thoughts, call your local emergency number or 988 (US).
        </div>

        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["COMBINED", "PHQ9", "GAD7"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTool(option)}
              className={`px-4 py-3 rounded-xl border text-sm font-medium ${tool === option ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"}`}
            >
              {option === "COMBINED" ? "PHQ-9 + GAD-7" : option}
            </button>
          ))}
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          I understand this AI does not provide medical diagnosis and I consent to use it for triage only.
        </label>

        <button
          onClick={start}
          disabled={loading}
          className="mt-5 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Starting..." : "Start Assessment"}
        </button>
      </section>

      {questions.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-slate-900">Questions</h2>
          <div className="space-y-6 mt-4">
            {questions.map((question, idx) => (
              <div key={question.key}>
                <div className="text-sm font-medium text-slate-900">
                  {idx + 1}. {question.text}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {answerOptions.map((option) => (
                    <label key={option.value} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 flex items-center gap-2">
                      <input
                        type="radio"
                        name={question.key}
                        checked={answers[question.key] === option.value}
                        onChange={() => setAnswers((prev) => ({ ...prev, [question.key]: option.value }))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for therapist summary..."
            className="w-full mt-5 p-3 border border-slate-200 rounded-lg text-sm min-h-[88px]"
          />

          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </section>
      )}

      {result && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-slate-900 inline-flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Assessment Result
          </h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">Risk</div>
              <div className="font-semibold text-slate-900">{result.riskLevel || "-"}</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">PHQ-9</div>
              <div className="font-semibold text-slate-900">{result.phq9Score ?? "-"}</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">GAD-7</div>
              <div className="font-semibold text-slate-900">{result.gad7Score ?? "-"}</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">Computed Score</div>
              <div className="font-semibold text-slate-900">{result.score ?? "-"}</div>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-700">{result.summary || "No summary available."}</p>

          {result.riskLevel === "HIGH" || result.riskLevel === "EMERGENCY" ? (
            <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm inline-flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              High-risk detected. Please book a therapist immediately. Emergency resources should be used if needed.
            </div>
          ) : null}
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-slate-900">Daily Mood Tracker</h2>
        <form onSubmit={submitMood} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="number"
            min={1}
            max={10}
            value={moodScore}
            onChange={(e) => setMoodScore(Number(e.target.value))}
            className="p-2 border border-slate-200 rounded-lg text-sm"
          />
          <input
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            placeholder="Optional note"
            className="md:col-span-2 p-2 border border-slate-200 rounded-lg text-sm"
          />
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Save Mood</button>
        </form>

        {moodTrend && (
          <div className="mt-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Average (30d)</div>
                <div className="font-semibold text-slate-900">{moodTrend.averageMood}</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Min / Max</div>
                <div className="font-semibold text-slate-900">{moodTrend.minMood} / {moodTrend.maxMood}</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Entries</div>
                <div className="font-semibold text-slate-900">{moodTrend.entries}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {moodTrend.history.slice(-7).reverse().map((item) => (
                <div key={item.id} className="p-3 border border-slate-200 rounded-lg text-sm">
                  <div className="font-semibold text-slate-900">Score: {item.score}</div>
                  {item.note && <div className="text-slate-600 mt-1">{item.note}</div>}
                  <div className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
