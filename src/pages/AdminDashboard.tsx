import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle, Loader2, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { apiFetch } from "../lib/api";

type Therapist = {
  id: string;
  specialization: string;
  experienceYears: number;
  hourlyRate: number;
  user?: {
    name: string;
    email: string;
  };
};

type TherapistSlot = {
  id: string;
  startTime: string;
  endTime: string;
  booked: boolean;
  windowStatus: "PAST" | "UPCOMING";
};

type TherapistBooking = {
  id: string;
  status: string;
  userName: string;
  userEmail: string;
  slotStartTime: string;
  slotEndTime: string;
  meetingLink?: string | null;
};

type TherapistOverview = {
  therapistId: string;
  name: string;
  email: string;
  specialization: string;
  language?: string;
  experienceYears: number;
  hourlyRate: number;
  verified: boolean;
  approvalStatus: "PENDING" | "VERIFIED" | "REJECTED";
  rating?: number;
  bio?: string;
  licenseDocumentUrl?: string;
  idDocumentUrl?: string;
  totalSlots: number;
  bookedSlots: number;
  openSlots: number;
  slots: TherapistSlot[];
  bookings: TherapistBooking[];
};

type RefundItem = {
  id: string;
  userName: string;
  therapistName: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
};

type PayoutItem = {
  id: string;
  therapistName: string;
  amount: number;
  status: string;
  createdAt: string;
};

type ReviewItem = {
  id: string;
  userName: string;
  therapistName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [unverifiedTherapists, setUnverifiedTherapists] = useState<Therapist[]>([]);
  const [allTherapists, setAllTherapists] = useState<TherapistOverview[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<RefundItem[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutItem[]>([]);
  const [pendingReviews, setPendingReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [therapistOverviewRows, refunds, payouts, reviews] = await Promise.all([
        apiFetch<TherapistOverview[]>("/api/admin/therapists/overview"),
        apiFetch<RefundItem[]>("/api/payment/admin/refunds/pending"),
        apiFetch<PayoutItem[]>("/api/payment/admin/payouts/pending"),
        apiFetch<ReviewItem[]>("/api/reviews/admin/pending"),
      ]);
      setAllTherapists(therapistOverviewRows);
      setUnverifiedTherapists(
        therapistOverviewRows
          .filter((item) => item.approvalStatus === "PENDING")
          .map((item) => ({
            id: item.therapistId,
            specialization: item.specialization,
            experienceYears: item.experienceYears,
            hourlyRate: item.hourlyRate,
            user: {
              name: item.name,
              email: item.email,
            },
          }))
      );
      setPendingRefunds(refunds);
      setPendingPayouts(payouts);
      setPendingReviews(reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  const approveReview = async (reviewId: string) => {
    setActionId(reviewId);
    try {
      await apiFetch(`/api/reviews/admin/${reviewId}/approve`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Review approval failed.");
    } finally {
      setActionId(null);
    }
  };

  const rejectReview = async (reviewId: string) => {
    setActionId(reviewId);
    try {
      await apiFetch(`/api/reviews/admin/${reviewId}/reject`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Review rejection failed.");
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approveTherapist = async (therapistId: string) => {
    setActionId(therapistId);
    try {
      await apiFetch(`/api/admin/therapists/${therapistId}/verify`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setActionId(null);
    }
  };

  const rejectTherapist = async (therapistId: string) => {
    setActionId(therapistId);
    try {
      await apiFetch(`/api/admin/therapists/${therapistId}/reject`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setActionId(null);
    }
  };

  const approveRefund = async (refundId: string) => {
    setActionId(refundId);
    try {
      await apiFetch(`/api/payment/admin/refunds/${refundId}/approve`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Refund approval failed.");
    } finally {
      setActionId(null);
    }
  };

  const rejectRefund = async (refundId: string) => {
    setActionId(refundId);
    try {
      await apiFetch(`/api/payment/admin/refunds/${refundId}/reject`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Refund rejection failed.");
    } finally {
      setActionId(null);
    }
  };

  const markPayoutPaid = async (payoutId: string) => {
    setActionId(payoutId);
    try {
      await apiFetch(`/api/payment/admin/payouts/${payoutId}/mark-paid`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Mark payout paid failed.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 inline-flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
          Admin Operations
        </h1>
        <p className="text-slate-600 mt-2">Verify therapists and process payout/refund operations.</p>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {loading ? (
        <div className="py-14 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Therapist Verification</h2>
            {unverifiedTherapists.length === 0 ? (
              <p className="text-sm text-slate-500">No pending therapist approvals.</p>
            ) : (
              <div className="space-y-3">
                {unverifiedTherapists.map((therapist) => {
                  const overview = allTherapists.find((item) => item.therapistId === therapist.id);
                  const utilization = overview
                    ? {
                        totalSlots: overview.totalSlots,
                        bookedSlots: overview.bookedSlots,
                        utilizationPercent: overview.totalSlots
                          ? Number(((overview.bookedSlots * 100) / overview.totalSlots).toFixed(2))
                          : 0,
                      }
                    : null;
                  return (
                    <motion.div key={therapist.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 border border-slate-200 rounded-xl">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{therapist.user?.name || "Therapist"}</h3>
                          <p className="text-sm text-slate-600">{therapist.user?.email}</p>
                          <div className="mt-2 text-sm text-slate-700">
                            {therapist.specialization} • {therapist.experienceYears} yrs • ${therapist.hourlyRate}
                          </div>
                          {utilization && (
                            <div className="mt-2 text-xs text-slate-600">
                              Slots: {utilization.bookedSlots}/{utilization.totalSlots} ({utilization.utilizationPercent}%)
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={actionId === therapist.id}
                            onClick={() => approveTherapist(therapist.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 disabled:opacity-60"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            disabled={actionId === therapist.id}
                            onClick={() => rejectTherapist(therapist.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-60"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Pending Refund Requests</h2>
              {pendingRefunds.length === 0 ? (
                <p className="text-sm text-slate-500">No pending refunds.</p>
              ) : (
                <div className="space-y-3">
                  {pendingRefunds.map((refund) => (
                    <div key={refund.id} className="p-3 border border-slate-200 rounded-xl">
                      <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{refund.userName} {"->"} {refund.therapistName}</div>
                          <div className="text-xs text-slate-600 mt-1">{refund.reason}</div>
                          <div className="text-xs text-slate-500 mt-1">{new Date(refund.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">${Number(refund.amount).toFixed(2)}</div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={actionId === refund.id}
                          onClick={() => approveRefund(refund.id)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          disabled={actionId === refund.id}
                          onClick={() => rejectRefund(refund.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Pending Payout Requests</h2>
              {pendingPayouts.length === 0 ? (
                <p className="text-sm text-slate-500">No pending payouts.</p>
              ) : (
                <div className="space-y-3">
                  {pendingPayouts.map((payout) => (
                    <div key={payout.id} className="p-3 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{payout.therapistName}</div>
                          <div className="text-xs text-slate-500 mt-1">{new Date(payout.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1">
                          <Wallet className="w-4 h-4" />
                          ${Number(payout.amount).toFixed(2)}
                        </div>
                      </div>
                      <div className="mt-3">
                        <button
                          disabled={actionId === payout.id}
                          onClick={() => markPayoutPaid(payout.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-60"
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-4">All Therapists & Schedules</h2>
            {allTherapists.length === 0 ? (
              <p className="text-sm text-slate-500">No therapists found.</p>
            ) : (
              <div className="space-y-4">
                {allTherapists.map((therapist) => (
                  <div key={therapist.therapistId} className="p-4 border border-slate-200 rounded-xl">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-bold text-slate-900">{therapist.name}</div>
                        <div className="text-sm text-slate-600">{therapist.email}</div>
                        <div className="text-xs text-slate-600 mt-2">
                          {therapist.specialization} • {therapist.experienceYears} yrs • ${Number(therapist.hourlyRate).toFixed(2)} • {therapist.language || "N/A"}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Status: <span className="font-semibold">{therapist.approvalStatus}</span> • Rating: {Number(therapist.rating || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Slots: {therapist.bookedSlots}/{therapist.totalSlots} booked ({therapist.openSlots} open)
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 mb-2">Availability Slots</div>
                        {therapist.slots.length === 0 ? (
                          <p className="text-xs text-slate-500">No slots created.</p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-auto pr-1">
                            {therapist.slots.map((slot) => (
                              <div key={slot.id} className="p-2 border border-slate-200 rounded-lg text-xs">
                                <div className="text-slate-900 font-medium">
                                  {new Date(slot.startTime).toLocaleString()} -{" "}
                                  {new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                <div className="text-slate-600 mt-1">
                                  {slot.booked ? "Booked" : "Open"} • {slot.windowStatus}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 mb-2">Booking Schedule</div>
                        {therapist.bookings.length === 0 ? (
                          <p className="text-xs text-slate-500">No bookings yet.</p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-auto pr-1">
                            {therapist.bookings.map((booking) => (
                              <div key={booking.id} className="p-2 border border-slate-200 rounded-lg text-xs">
                                <div className="text-slate-900 font-medium">
                                  {booking.userName} ({booking.userEmail})
                                </div>
                                <div className="text-slate-600 mt-1">
                                  {new Date(booking.slotStartTime).toLocaleString()} • {booking.status}
                                </div>
                                {booking.meetingLink ? (
                                  <a
                                    href={booking.meetingLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-700 mt-1 inline-block break-all"
                                  >
                                    Meeting Link
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Pending Reviews Moderation</h2>
            {pendingReviews.length === 0 ? (
              <p className="text-sm text-slate-500">No pending reviews.</p>
            ) : (
              <div className="space-y-3">
                {pendingReviews.map((review) => (
                  <div key={review.id} className="p-3 border border-slate-200 rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {review.userName} {"->"} {review.therapistName}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">Rating: {review.rating}/5</div>
                        <div className="text-xs text-slate-600 mt-1">{review.comment || "No comment"}</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(review.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={actionId === review.id}
                        onClick={() => approveReview(review.id)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionId === review.id}
                        onClick={() => rejectReview(review.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
