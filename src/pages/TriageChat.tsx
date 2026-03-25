import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Sparkles } from "lucide-react";
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

type CareAction = {
  title: string;
  detail: string;
  priority: "critical" | "high" | "medium" | "low";
};

type CareInsights = {
  latestAssessment: Assessment | null;
  moodTrend: MoodTrend;
  recommendedActions: CareAction[];
  safetyPlanTemplate: {
    clinicalFollowUp: string;
    warningSigns: string[];
    copingSteps: string[];
    supportOptions: string[];
  };
  carePath: {
    severityLabel: string;
    nextCheckInDays: number;
    measurementBasedCare: string;
  };
};

const answerOptions = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

function riskClasses(risk?: string | null) {
  switch (risk) {
    case "EMERGENCY":
      return "bg-red-100 border-red-200 text-red-900";
    case "HIGH":
      return "bg-amber-100 border-amber-200 text-amber-900";
    case "MODERATE":
      return "bg-yellow-100 border-yellow-200 text-yellow-900";
    default:
      return "bg-emerald-100 border-emerald-200 text-emerald-900";
  }
}

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
  const [careInsights, setCareInsights] = useState<CareInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((q) => answers[q.key] !== undefined),
    [questions, answers]
  );

  const loadCareInsights = async () => {
    try {
      const insights = await apiFetch<CareInsights>("/api/ai/care-insights");
      setCareInsights(insights);
    } catch {
      // keep the form usable even if care insights fail
    }
  };

  useEffect(() => {
    loadCareInsights();
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
      await loadCareInsights();
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
      await loadCareInsights();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mood check-in.");
    }
  };

  const effectiveRisk = result?.riskLevel ?? careInsights?.latestAssessment?.riskLevel ?? null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <section className="shell-card rounded-[2rem] p-6 md:p-8">
        <h1 className="display-font text-3xl md:text-4xl font-extrabold text-slate-900">AI Structured Assessment</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Use PHQ-9 and GAD-7 style screening to establish a measurable baseline, then pair the result with mood trend tracking and therapist follow-up.
        </p>

        <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          If you are in immediate danger or feel unable to stay safe, contact your local emergency number or crisis support line now.
        </div>

        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["COMBINED", "PHQ9", "GAD7"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTool(option)}
              data-voice={option === "COMBINED" ? "phq 9 and gad 7|combined assessment" : option}
              className={`px-4 py-3 rounded-xl border text-sm font-medium ${tool === option ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}
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
            data-voice="ai disclaimer|consent disclaimer|consent"
            className="mt-1"
          />
          I understand this AI does not provide a medical diagnosis and I consent to use it for triage and screening support only.
        </label>

        <button
          onClick={start}
          disabled={loading}
          data-voice="start assessment|begin assessment|start triage"
          className="mt-5 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-60"
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
                    <label
                      key={option.value}
                      data-voice={`${question.text}|${option.label}`}
                      data-voice-action="true"
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 flex items-center gap-2"
                    >
                      <input
                        type="radio"
                        name={question.key}
                        data-voice={`${question.text}|${option.label}`}
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
            data-voice="therapist summary note|assessment note"
            className="w-full mt-5 p-3 border border-slate-200 rounded-lg text-sm min-h-[88px]"
          />

          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            data-voice="submit assessment|finish assessment"
            className="mt-4 px-5 py-2.5 bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </section>
      )}

      {(result || careInsights?.latestAssessment) && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 inline-flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Assessment Result
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                This result is meant for triage, not diagnosis. Use it to drive follow-up intensity and symptom monitoring.
              </p>
            </div>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${riskClasses(effectiveRisk)}`}>
              {effectiveRisk || "NO RISK SCORE"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">Risk</div>
              <div className="font-semibold text-slate-900">{effectiveRisk || "-"}</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">PHQ-9</div>
              <div className="font-semibold text-slate-900">{(result ?? careInsights?.latestAssessment)?.phq9Score ?? "-"}</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">GAD-7</div>
              <div className="font-semibold text-slate-900">{(result ?? careInsights?.latestAssessment)?.gad7Score ?? "-"}</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-slate-500">Next review</div>
              <div className="font-semibold text-slate-900">
                {careInsights?.carePath.nextCheckInDays === 0
                  ? "Now"
                  : `${careInsights?.carePath.nextCheckInDays ?? 7} day(s)`}
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-700">
            {(result ?? careInsights?.latestAssessment)?.summary || "No summary available."}
          </p>

          {careInsights && (
            <>
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  Recommended next steps
                </h3>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {careInsights.recommendedActions.map((action) => (
                    <div key={action.title} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">{action.title}</div>
                      <div className="text-sm text-slate-600 mt-2">{action.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-slate-600">
                  {careInsights.carePath.measurementBasedCare}
                </div>
              </div>

              {(effectiveRisk === "HIGH" || effectiveRisk === "EMERGENCY") && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="text-lg font-bold text-red-900 inline-flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Safety Plan Template
                  </h3>
                  <p className="text-sm text-red-900 mt-2">{careInsights.safetyPlanTemplate.clinicalFollowUp}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">Warning signs</div>
                      <ul className="mt-2 space-y-1 text-slate-700">
                        {careInsights.safetyPlanTemplate.warningSigns.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Coping steps</div>
                      <ul className="mt-2 space-y-1 text-slate-700">
                        {careInsights.safetyPlanTemplate.copingSteps.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Support options</div>
                      <ul className="mt-2 space-y-1 text-slate-700">
                        {careInsights.safetyPlanTemplate.supportOptions.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {effectiveRisk === "HIGH" || effectiveRisk === "EMERGENCY" ? (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm inline-flex gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  Elevated-risk detected. Do not wait for the next automated check-in if your symptoms worsen or you feel unsafe.
                </div>
              ) : null}
            </>
          )}
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
            data-voice="mood score|daily mood score"
            className="p-2 border border-slate-200 rounded-lg text-sm"
          />
          <input
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            placeholder="Optional note"
            data-voice="mood note|daily mood note"
            className="md:col-span-2 p-2 border border-slate-200 rounded-lg text-sm"
          />
          <button data-voice="save mood|submit mood" className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium">Save Mood</button>
        </form>

        {careInsights?.moodTrend && (
          <div className="mt-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Average (30d)</div>
                <div className="font-semibold text-slate-900">{careInsights.moodTrend.averageMood}</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Min / Max</div>
                <div className="font-semibold text-slate-900">
                  {careInsights.moodTrend.minMood} / {careInsights.moodTrend.maxMood}
                </div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Entries</div>
                <div className="font-semibold text-slate-900">{careInsights.moodTrend.entries}</div>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Next review</div>
                <div className="font-semibold text-slate-900">
                  {careInsights.carePath.nextCheckInDays === 0 ? "Now" : `${careInsights.carePath.nextCheckInDays} day(s)`}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {careInsights.moodTrend.history.slice(-7).reverse().map((item) => (
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
