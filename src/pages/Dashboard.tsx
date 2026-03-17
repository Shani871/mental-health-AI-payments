import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Calendar,
  Clock,
  CreditCard,
  Loader2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { apiFetch, apiFetchBlob } from "../lib/api";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
};

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  meetingLink?: string | null;
  cancellationFeeApplied: boolean;
  cancellationFeeAmount: number;
  therapist?: {
    id: string;
    hourlyRate?: number;
    user?: {
      name: string;
    };
  };
  availabilitySlot: Slot;
};

type DashboardAction = {
  title: string;
  detail: string;
  priority: "critical" | "high" | "medium" | "low";
};

type MoodTrend = {
  averageMood: number;
  minMood: number;
  maxMood: number;
  entries: number;
  history: Array<{ id: string; score: number; note?: string; createdAt: string }>;
};

type CareInsights = {
  latestAssessment: {
    id: string;
    riskLevel: "LOW" | "MODERATE" | "HIGH" | "EMERGENCY" | null;
    phq9Score: number | null;
    gad7Score: number | null;
    summary: string | null;
    createdAt: string;
  } | null;
  moodTrend: MoodTrend;
  recommendedActions: DashboardAction[];
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

type DashboardInsights = {
  bookingMetrics: {
    upcomingCount: number;
    completedCount: number;
    cancelledCount: number;
    pendingPaymentCount: number;
    nextSessionInHours: number | null;
  };
  nextSession: {
    id: string;
    therapistName: string;
    status: string;
    startTime: string;
    endTime: string;
    hourlyRate?: number | null;
    meetingLink?: string | null;
  } | null;
  paymentOverview: {
    totalPaid: number;
    totalRefunded: number;
    netSpend: number;
    successfulPayments: number;
    refundRequests: number;
    processedRefunds: number;
    pendingBookings: number;
    paymentMethods: Record<string, number>;
  };
  careInsights: CareInsights;
  recommendedActions: DashboardAction[];
};

type PaymentQuote = {
  bookingId: string;
  therapistName: string;
  sessionFee: number;
  platformFee: number;
  therapistEarning: number;
  supportedMethods: string[];
  cancellationPolicy: string;
};

function formatCurrency(value?: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function riskClasses(risk?: string | null) {
  switch (risk) {
    case "EMERGENCY":
      return "bg-red-100 text-red-800 border-red-200";
    case "HIGH":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "MODERATE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

function actionClasses(priority: DashboardAction["priority"]) {
  switch (priority) {
    case "critical":
      return "border-red-200 bg-red-50";
    case "high":
      return "border-amber-200 bg-amber-50";
    case "medium":
      return "border-sky-200 bg-sky-50";
    default:
      return "border-emerald-200 bg-emerald-50";
  }
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string>("");
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [paymentQuote, setPaymentQuote] = useState<PaymentQuote | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [downloadingCalendarFor, setDownloadingCalendarFor] = useState<string | null>(null);

  const loadPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingData, dashboardData] = await Promise.all([
        apiFetch<Booking[]>("/api/bookings/my"),
        apiFetch<DashboardInsights>("/api/dashboard/user"),
      ]);
      setBookings(bookingData);
      setInsights(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const upcomingBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "PENDING" || booking.status === "CONFIRMED"),
    [bookings]
  );
  const pastBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "CANCELLED" ||
          booking.status === "COMPLETED" ||
          booking.status === "NO_SHOW"
      ),
    [bookings]
  );
  const rows = activeTab === "upcoming" ? upcomingBookings : pastBookings;

  const cancelBooking = async (bookingId: string) => {
    setActionBookingId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/cancel`, { method: "DELETE" });
      await loadPage();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel booking.");
    } finally {
      setActionBookingId(null);
    }
  };

  const openReschedule = async (booking: Booking) => {
    setRescheduleBookingId(booking.id);
    setSelectedRescheduleSlot("");
    try {
      const therapistId = booking.therapist?.id;
      if (!therapistId) {
        throw new Error("Therapist information missing.");
      }
      const slots = await apiFetch<Slot[]>(`/api/therapists/${therapistId}/slots`);
      setRescheduleSlots(slots.filter((slot) => slot.id !== booking.availabilitySlot.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load slots for reschedule.");
      setRescheduleBookingId(null);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleBookingId || !selectedRescheduleSlot) return;
    setActionBookingId(rescheduleBookingId);
    try {
      await apiFetch(`/api/bookings/${rescheduleBookingId}/reschedule?newSlotId=${selectedRescheduleSlot}`, {
        method: "PUT",
      });
      setRescheduleBookingId(null);
      setRescheduleSlots([]);
      await loadPage();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reschedule failed.");
    } finally {
      setActionBookingId(null);
    }
  };

  const openPayment = async (booking: Booking) => {
    setPaymentBooking(booking);
    setPaymentQuote(null);
    setPaymentLoading(true);
    try {
      const quote = await apiFetch<PaymentQuote>(`/api/payment/quote/${booking.id}`);
      setPaymentQuote(quote);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load payment quote.");
      setPaymentBooking(null);
    } finally {
      setPaymentLoading(false);
    }
  };

  const confirmCashPayment = async () => {
    if (!paymentBooking || !paymentQuote) return;

    setActionBookingId(paymentBooking.id);
    try {
      await apiFetch(
        `/api/payment/cash/confirm?bookingId=${paymentBooking.id}&amount=${paymentQuote.sessionFee}`,
        { method: "POST" }
      );
      setPaymentBooking(null);
      setPaymentQuote(null);
      await loadPage();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cash payment failed.");
    } finally {
      setActionBookingId(null);
    }
  };

  const submitReview = async () => {
    if (!reviewBookingId) return;
    setSubmittingReview(true);
    try {
      await apiFetch("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          bookingId: reviewBookingId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setReviewBookingId(null);
      setReviewComment("");
      setReviewRating(5);
      alert("Review submitted and pending admin moderation.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const downloadCalendarInvite = async (bookingId: string) => {
    setDownloadingCalendarFor(bookingId);
    try {
      const blob = await apiFetchBlob(`/api/bookings/${bookingId}/calendar.ics`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `mindtriage-session-${bookingId}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download calendar invite.");
    } finally {
      setDownloadingCalendarFor(null);
    }
  };

  const moodHistory = insights?.careInsights.moodTrend.history ?? [];
  const latestRisk = insights?.careInsights.latestAssessment?.riskLevel ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="shell-card rounded-[2rem] p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-12 right-0 w-56 h-56 rounded-full bg-teal-100/70 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <h1 className="display-font text-3xl md:text-4xl font-extrabold text-slate-900">Care Dashboard</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              One place for session operations, measurement-based mental health follow-up, and payment visibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/triage"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              Re-run Assessment
            </Link>
            <Link
              to="/payments"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Payments
            </Link>
            <Link
              to="/therapists"
              className="brand-button px-4 py-2 rounded-lg text-sm font-medium"
            >
              Book Session
            </Link>
          </div>
        </div>
      </section>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Upcoming Sessions</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{insights?.bookingMetrics.upcomingCount ?? 0}</div>
              <div className="text-xs text-slate-500 mt-2">
                {insights?.bookingMetrics.pendingPaymentCount ?? 0} still need payment confirmation
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Latest Risk Signal</div>
              <div className="mt-2">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${riskClasses(latestRisk)}`}>
                  {latestRisk || "NO RECENT SCREEN"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {insights?.careInsights.carePath.severityLabel ?? "Complete a new assessment to refresh care guidance."}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">30-Day Average Mood</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">
                {insights?.careInsights.moodTrend.averageMood ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {insights?.careInsights.moodTrend.entries ?? 0} entries logged
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Net Spend</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">
                {formatCurrency(insights?.paymentOverview.netSpend)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {insights?.paymentOverview.successfulPayments ?? 0} successful payments
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 inline-flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-700" />
                    Recommended Next Steps
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Guidance combines screening results, mood trend, and upcoming care activity.
                  </p>
                </div>
                {insights?.careInsights.carePath.nextCheckInDays !== undefined && (
                  <div className="text-sm text-slate-500">
                    Next check-in target:{" "}
                    <span className="font-semibold text-slate-900">
                      {insights.careInsights.carePath.nextCheckInDays === 0
                        ? "Now"
                        : `${insights.careInsights.carePath.nextCheckInDays} day(s)`}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(insights?.recommendedActions ?? []).map((action) => (
                  <div
                    key={action.title}
                    className={`rounded-2xl border p-4 ${actionClasses(action.priority)}`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{action.title}</div>
                    <p className="text-sm text-slate-700 mt-2">{action.detail}</p>
                  </div>
                ))}
              </div>

              {insights?.careInsights.latestAssessment && (
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">Latest Assessment Summary</div>
                      <p className="text-sm text-slate-700 mt-2">
                        {insights.careInsights.latestAssessment.summary}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm min-w-[180px]">
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-slate-500">PHQ-9</div>
                        <div className="font-semibold text-slate-900">
                          {insights.careInsights.latestAssessment.phq9Score ?? "-"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-slate-500">GAD-7</div>
                        <div className="font-semibold text-slate-900">
                          {insights.careInsights.latestAssessment.gad7Score ?? "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    {insights.careInsights.carePath.measurementBasedCare}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-700" />
                  Next Session
                </h2>
                {insights?.nextSession ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-lg font-semibold text-slate-900">{insights.nextSession.therapistName}</div>
                    <div className="text-sm text-slate-600">
                      {new Date(insights.nextSession.startTime).toLocaleDateString()} at{" "}
                      {new Date(insights.nextSession.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-sm text-slate-600">
                      Status: <span className="font-semibold text-slate-900">{insights.nextSession.status}</span>
                    </div>
                    {insights.nextSession.meetingLink && (
                      <a
                        href={insights.nextSession.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800"
                      >
                        <Video className="w-4 h-4" />
                        Join Link
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 mt-4">No active session booked.</p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-700" />
                  Mood Trend
                </h2>
                {moodHistory.length > 0 ? (
                  <>
                    <div className="mt-4 flex items-end gap-2 h-24">
                      {moodHistory.slice(-7).map((item) => (
                        <div key={item.id} className="flex-1 flex flex-col items-center gap-2">
                          <div
                            className="w-full rounded-t-lg bg-gradient-to-t from-teal-600 to-sky-400"
                            style={{ height: `${Math.max(item.score * 9, 12)}px` }}
                          />
                          <span className="text-[11px] text-slate-500">{item.score}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-sm text-slate-600">
                      Range {insights?.careInsights.moodTrend.minMood ?? 0} -{" "}
                      {insights?.careInsights.moodTrend.maxMood ?? 0} this month
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 mt-4">Mood tracking has not started yet.</p>
                )}
              </div>

              {(latestRisk === "HIGH" || latestRisk === "EMERGENCY") && (
                <div className="bg-white border border-red-200 rounded-2xl p-5">
                  <h2 className="text-lg font-bold text-red-900 inline-flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Safety Plan
                  </h2>
                  <p className="text-sm text-red-800 mt-2">
                    {insights?.careInsights.safetyPlanTemplate.clinicalFollowUp}
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div>
                      <div className="font-semibold text-slate-900">Warning signs</div>
                      <ul className="mt-1 space-y-1">
                        {(insights?.careInsights.safetyPlanTemplate.warningSigns ?? []).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Immediate coping steps</div>
                      <ul className="mt-1 space-y-1">
                        {(insights?.careInsights.safetyPlanTemplate.copingSteps ?? []).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">My Sessions</h2>
                <p className="text-sm text-slate-600 mt-1">Manage upcoming sessions, reviews, reschedules, and calendar sync.</p>
              </div>
              <div className="flex gap-6">
                {(["upcoming", "past"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-sm font-medium pb-3 -mb-3 border-b-2 ${activeTab === tab ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  >
                    {tab === "upcoming" ? "Upcoming & Active" : "Past & Closed"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {rows.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No bookings in this section.</div>
              ) : (
                <div className="space-y-4">
                  {rows.map((booking, index) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-5 border border-slate-200 rounded-xl"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center shrink-0">
                            <Video className="w-5 h-5 text-teal-700" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{booking.therapist?.user?.name || "Therapist"}</h4>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(booking.availabilitySlot.startTime).toLocaleDateString()}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(booking.availabilitySlot.startTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {booking.cancellationFeeApplied && (
                              <div className="mt-2 text-xs text-amber-700">
                                Late-cancel fee: {formatCurrency(booking.cancellationFeeAmount)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{booking.status}</span>
                          {booking.status === "CONFIRMED" && booking.meetingLink && (
                            <a
                              href={booking.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800"
                            >
                              Join
                            </a>
                          )}
                          {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                            <button
                              disabled={downloadingCalendarFor === booking.id}
                              onClick={() => downloadCalendarInvite(booking.id)}
                              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                            >
                              {downloadingCalendarFor === booking.id ? "Downloading..." : "Calendar .ics"}
                            </button>
                          )}
                          {booking.status === "PENDING" && (
                            <button
                              disabled={actionBookingId === booking.id}
                              onClick={() => openPayment(booking)}
                              className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                            >
                              {actionBookingId === booking.id ? "Preparing..." : "Pay now"}
                            </button>
                          )}
                          {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                            <>
                              <button
                                onClick={() => openReschedule(booking)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
                              >
                                Reschedule
                              </button>
                              <button
                                disabled={actionBookingId === booking.id}
                                onClick={() => cancelBooking(booking.id)}
                                className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-60"
                              >
                                {actionBookingId === booking.id ? "Cancelling..." : "Cancel"}
                              </button>
                            </>
                          )}
                          {booking.status === "COMPLETED" && (
                            <button
                              onClick={() => {
                                setReviewBookingId(booking.id);
                                setReviewRating(5);
                                setReviewComment("");
                              }}
                              className="px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-sm font-medium hover:bg-teal-100"
                            >
                              Add Review
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {rescheduleBookingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Reschedule Booking</h3>
            {rescheduleSlots.length === 0 ? (
              <p className="text-sm text-slate-600 mb-4">No alternate slots found.</p>
            ) : (
              <select
                value={selectedRescheduleSlot}
                onChange={(e) => setSelectedRescheduleSlot(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Select a new slot</option>
                {rescheduleSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {new Date(slot.startTime).toLocaleString()} -{" "}
                    {new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </option>
                ))}
              </select>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRescheduleBookingId(null)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              >
                Close
              </button>
              <button
                disabled={!selectedRescheduleSlot || actionBookingId === rescheduleBookingId}
                onClick={confirmReschedule}
                className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Payment Quote</h3>
            {paymentLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
              </div>
            ) : paymentQuote ? (
              <>
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Therapist</span>
                    <span className="font-semibold text-slate-900">{paymentQuote.therapistName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Session fee</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentQuote.sessionFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Platform fee</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentQuote.platformFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Supported methods</span>
                    <span className="font-semibold text-slate-900">{paymentQuote.supportedMethods.join(", ")}</span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 inline-flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {paymentQuote.cancellationPolicy}
                </div>
                <p className="text-sm text-slate-600 mt-4">
                  Cash confirmation is available here as an operational fallback. Online gateway flows remain available through the backend integrations.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Unable to load payment quote.</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPaymentBooking(null);
                  setPaymentQuote(null);
                }}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              >
                Close
              </button>
              <button
                disabled={!paymentQuote || actionBookingId === paymentBooking.id}
                onClick={confirmCashPayment}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                <CreditCard className="w-4 h-4" />
                {actionBookingId === paymentBooking.id ? "Confirming..." : "Confirm Cash Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewBookingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Rate Your Session</h3>
            <div className="space-y-3">
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} Star{rating > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Write your review"
                className="w-full p-2 border border-slate-200 rounded-lg text-sm min-h-[92px]"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReviewBookingId(null)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              >
                Close
              </button>
              <button
                disabled={submittingReview}
                onClick={submitReview}
                className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
