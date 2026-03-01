import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Calendar, Clock, Video } from "lucide-react";
import { apiFetch } from "../lib/api";

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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string>("");
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Booking[]>("/api/bookings/my");
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const upcomingBookings = useMemo(
    () => bookings.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED"),
    [bookings]
  );
  const pastBookings = useMemo(
    () => bookings.filter((b) => b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW"),
    [bookings]
  );

  const cancelBooking = async (bookingId: string) => {
    setActionBookingId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/cancel`, { method: "DELETE" });
      await loadBookings();
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
      await loadBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reschedule failed.");
    } finally {
      setActionBookingId(null);
    }
  };

  const openPayment = async (booking: Booking) => {
    setPaymentBooking(booking);
    setPaymentAmount(booking.therapist?.hourlyRate ? String(booking.therapist.hourlyRate) : "");
  };

  const confirmCashPayment = async () => {
    if (!paymentBooking || !paymentAmount) return;
    const parsedAmount = Number(paymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    setActionBookingId(paymentBooking.id);
    try {
      await apiFetch(
        `/api/payment/cash/confirm?bookingId=${paymentBooking.id}&amount=${parsedAmount}`,
        { method: "POST" }
      );
      setPaymentBooking(null);
      await loadBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cash payment failed.");
    } finally {
      setActionBookingId(null);
    }
  };

  const rows = activeTab === "upcoming" ? upcomingBookings : pastBookings;

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Sessions</h1>
          <p className="text-slate-600 mt-2">Manage upcoming and completed/cancelled therapy bookings.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/payments" className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            Payment History
          </Link>
          <Link to="/therapists" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            New Booking
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex gap-6">
          {(["upcoming", "past"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium pb-3 -mb-3 border-b-2 ${activeTab === tab ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {tab === "upcoming" ? "Upcoming & Active" : "Past & Closed"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading...</div>
          ) : rows.length === 0 ? (
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
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5 text-indigo-600" />
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
                            Late-cancel fee: ${booking.cancellationFeeAmount?.toFixed?.(2) || booking.cancellationFeeAmount}
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
                          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                        >
                          Join
                        </a>
                      )}
                      {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                        <>
                          {booking.status === "PENDING" && (
                            <button
                              disabled={actionBookingId === booking.id}
                              onClick={() => openPayment(booking)}
                              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {actionBookingId === booking.id ? "Preparing..." : "Pay now"}
                            </button>
                          )}
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
                          className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100"
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
                    {new Date(slot.startTime).toLocaleString()} - {new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
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
            <h3 className="text-lg font-bold text-slate-900 mb-3">Confirm Cash Payment</h3>
            <p className="text-sm text-slate-600 mb-2">
              Enter amount and confirm. The booking will be marked as paid with cash and session will be confirmed.
            </p>
            <div className="space-y-3">
              <input
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Amount"
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPaymentBooking(null)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              >
                Close
              </button>
              <button
                disabled={!paymentAmount || actionBookingId === paymentBooking.id}
                onClick={confirmCashPayment}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
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
