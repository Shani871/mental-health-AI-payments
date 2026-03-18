import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Calendar, Clock, Loader2, PlusCircle, Save, Wallet } from "lucide-react";
import { apiFetch, apiFetchBlob } from "../lib/api";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  booked?: boolean;
};

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  meetingLink?: string | null;
  user?: {
    name: string;
    email: string;
  };
  therapist?: {
    id: string;
  };
  availabilitySlot: Slot;
};

type PayoutItem = {
  id: string;
  amount: number;
  status: "REQUESTED" | "PAID" | "REJECTED";
  createdAt: string;
  processedAt?: string;
};

type EarningsResponse = {
  grossEarnings: number;
  refundedEarnings: number;
  netEarnings: number;
  paidOut: number;
  pendingPayout: number;
};

type AiSummary = {
  userId: string;
  userName: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "EMERGENCY";
  phq9Score?: number;
  gad7Score?: number;
  summary: string;
  createdAt: string;
};

type Meeting = {
  id: string;
  bookingId: string;
  bookingStatus: string;
  meetingId: string;
  joinUrl: string;
  hostUrl: string;
  provider: string;
  attendanceStatus: string;
  userName: string;
  userEmail: string;
  therapistName: string;
  therapistEmail: string;
  startTime?: string;
  endTime?: string;
};

function asDateTimeInputValue(value: string): string {
  return value.slice(0, 16);
}

export default function TherapistSessions() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [aiSummaries, setAiSummaries] = useState<AiSummary[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [licenseDocument, setLicenseDocument] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [meetingModalBooking, setMeetingModalBooking] = useState<Booking | null>(null);
  const [meetingModalMode, setMeetingModalMode] = useState<"accept" | "update">("update");
  const [meetingLinkInput, setMeetingLinkInput] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");
  const [meetingProviderFilter, setMeetingProviderFilter] = useState("");
  const [meetingAttendanceFilter, setMeetingAttendanceFilter] = useState("");
  const [downloadingCalendarFor, setDownloadingCalendarFor] = useState<string | null>(null);

  const buildMeetingUrl = (): string => {
    const params = new URLSearchParams();
    if (meetingSearch.trim()) {
      params.set("q", meetingSearch.trim());
    }
    if (meetingProviderFilter) {
      params.set("provider", meetingProviderFilter);
    }
    if (meetingAttendanceFilter) {
      params.set("attendanceStatus", meetingAttendanceFilter);
    }
    const query = params.toString();
    return query ? `/api/video/meetings/my?${query}` : "/api/video/meetings/my";
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingRows, earningsResponse, payoutRows, slotRows, summaries, meetingRows] = await Promise.all([
        apiFetch<Booking[]>("/api/bookings/therapist/my"),
        apiFetch<EarningsResponse>("/api/payment/earnings"),
        apiFetch<PayoutItem[]>("/api/payment/payouts/my"),
        apiFetch<Slot[]>("/api/therapists/me/slots"),
        apiFetch<AiSummary[]>("/api/ai/therapist/summaries"),
        apiFetch<Meeting[]>(buildMeetingUrl()),
      ]);
      setBookings(bookingRows);
      setEarnings(earningsResponse);
      setPayouts(payoutRows);
      setSlots(slotRows);
      setAiSummaries(summaries);
      setMeetings(meetingRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load therapist data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingSearch, meetingProviderFilter, meetingAttendanceFilter]);

  const activeBookings = bookings.filter((booking) => booking.status === "PENDING" || booking.status === "CONFIRMED");

  const openReschedule = async (booking: Booking) => {
    setRescheduleBookingId(booking.id);
    setSelectedRescheduleSlot("");
    try {
      const therapistId = booking.therapist?.id;
      if (!therapistId) {
        throw new Error("Therapist context missing for this booking.");
      }
      const openSlots = await apiFetch<Slot[]>(`/api/therapists/${therapistId}/slots`);
      setRescheduleSlots(openSlots.filter((slot) => slot.id !== booking.availabilitySlot.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to load slots.");
      setRescheduleBookingId(null);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleBookingId || !selectedRescheduleSlot) return;
    setActionBookingId(rescheduleBookingId);
    try {
      await apiFetch(`/api/bookings/${rescheduleBookingId}/therapist-reschedule?newSlotId=${selectedRescheduleSlot}`, {
        method: "PUT",
      });
      setRescheduleBookingId(null);
      setRescheduleSlots([]);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reschedule failed.");
    } finally {
      setActionBookingId(null);
    }
  };

  const markComplete = async (bookingId: string) => {
    setActionBookingId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/complete`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark complete.");
    } finally {
      setActionBookingId(null);
    }
  };

  const markNoShow = async (bookingId: string) => {
    setActionBookingId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/no-show`, { method: "PUT" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark no-show.");
    } finally {
      setActionBookingId(null);
    }
  };

  const openMeetingModal = (booking: Booking, mode: "accept" | "update") => {
    setMeetingModalBooking(booking);
    setMeetingModalMode(mode);
    setMeetingLinkInput(booking.meetingLink || "");
  };

  const closeMeetingModal = () => {
    setMeetingModalBooking(null);
    setMeetingLinkInput("");
  };

  const submitMeetingModal = async () => {
    if (!meetingModalBooking) return;
    const normalized = meetingLinkInput.trim();
    if (!normalized) {
      alert("Please enter Google Meet link.");
      return;
    }

    setActionBookingId(meetingModalBooking.id);
    try {
      if (meetingModalMode === "accept") {
        await apiFetch(`/api/bookings/${meetingModalBooking.id}/therapist-accept`, {
          method: "PUT",
          body: JSON.stringify({ meetingLink: normalized }),
        });
      } else {
        await apiFetch(`/api/bookings/${meetingModalBooking.id}/therapist-meeting-link`, {
          method: "PUT",
          body: JSON.stringify({ meetingLink: normalized }),
        });
      }
      closeMeetingModal();
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save Google Meet link.");
    } finally {
      setActionBookingId(null);
    }
  };

  const requestPayout = async () => {
    setRequestingPayout(true);
    try {
      await apiFetch("/api/payment/payouts/request", { method: "POST" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payout request failed.");
    } finally {
      setRequestingPayout(false);
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

  const saveSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!slotStartTime || !slotEndTime) {
      alert("Please set both start and end time.");
      return;
    }
    setSavingSlot(true);
    try {
      const payload = { startTime: slotStartTime, endTime: slotEndTime };
      if (editingSlotId) {
        await apiFetch(`/api/therapists/availability/${editingSlotId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/therapists/availability", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setEditingSlotId(null);
      setSlotStartTime("");
      setSlotEndTime("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save slot.");
    } finally {
      setSavingSlot(false);
    }
  };

  const editSlot = (slot: Slot) => {
    if (slot.booked) return;
    setEditingSlotId(slot.id);
    setSlotStartTime(asDateTimeInputValue(slot.startTime));
    setSlotEndTime(asDateTimeInputValue(slot.endTime));
  };

  const cancelEdit = () => {
    setEditingSlotId(null);
    setSlotStartTime("");
    setSlotEndTime("");
  };

  const uploadDocuments = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!licenseDocument && !idDocument) {
      alert("Select at least one document.");
      return;
    }
    setUploadingDocs(true);
    try {
      const formData = new FormData();
      if (licenseDocument) formData.append("licenseDocument", licenseDocument);
      if (idDocument) formData.append("idDocument", idDocument);
      await fetch("/api/therapists/profile/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Upload failed.");
        }
      });
      setLicenseDocument(null);
      setIdDocument(null);
      alert("Documents uploaded successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Document upload failed.");
    } finally {
      setUploadingDocs(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Therapist Sessions & Availability</h1>
        <p className="text-slate-600 mt-2">Manage your slots, sessions, and payouts.</p>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {loading ? (
        <div className="py-14 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Gross Earnings</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">${Number(earnings?.grossEarnings || 0).toFixed(2)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Refunded</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">${Number(earnings?.refundedEarnings || 0).toFixed(2)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Paid Out</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">${Number(earnings?.paidOut || 0).toFixed(2)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Pending Payout</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">${Number(earnings?.pendingPayout || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Manage Availability Slots</h2>
              <form onSubmit={saveSlot} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={savingSlot}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                  >
                    {editingSlotId ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    {savingSlot ? "Saving..." : editingSlotId ? "Update Slot" : "Add Slot"}
                  </button>
                  {editingSlotId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {slots.length === 0 ? (
                <p className="text-sm text-slate-500">No slots created yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {slots.map((slot) => (
                    <div key={slot.id} className="p-3 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {new Date(slot.startTime).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-600">
                          {new Date(slot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {slot.booked ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-amber-50 text-amber-700">Booked</span>
                        ) : (
                          <>
                            <span className="px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700">Open</span>
                            <button
                              type="button"
                              onClick={() => editSlot(slot)}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Payout History</h2>
                <button
                  onClick={requestPayout}
                  disabled={requestingPayout || Number(earnings?.pendingPayout || 0) <= 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  <Wallet className="w-4 h-4" />
                  {requestingPayout ? "Requesting..." : "Request Payout"}
                </button>
              </div>
              {payouts.length === 0 ? (
                <p className="text-sm text-slate-500">No payout entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout) => (
                    <div key={payout.id} className="p-3 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">${Number(payout.amount).toFixed(2)}</div>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">{payout.status}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Requested: {new Date(payout.createdAt).toLocaleString()}</div>
                      {payout.processedAt && (
                        <div className="text-xs text-slate-500">Processed: {new Date(payout.processedAt).toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Active Sessions</h2>
            {activeBookings.length === 0 ? (
              <p className="text-sm text-slate-500">No active sessions.</p>
            ) : (
              <div className="space-y-3">
                {activeBookings.map((booking, index) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 border border-slate-200 rounded-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{booking.user?.name || "User"}</div>
                        <div className="text-xs text-slate-500">{booking.user?.email}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(booking.availabilitySlot.startTime).toLocaleDateString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(booking.availabilitySlot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {booking.meetingLink && (
                          <div className="mt-2 text-xs text-slate-600 break-all">
                            Meet: {booking.meetingLink}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {booking.status === "PENDING" && (
                          <button
                            disabled={actionBookingId === booking.id}
                            onClick={() => openMeetingModal(booking, "accept")}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-60"
                          >
                            Accept Request
                          </button>
                        )}
                        {booking.status === "CONFIRMED" && (
                          <button
                            disabled={actionBookingId === booking.id}
                            onClick={() => openMeetingModal(booking, "update")}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 disabled:opacity-60"
                          >
                            {booking.meetingLink ? "Update Google Meet" : "Add Google Meet"}
                          </button>
                        )}
                        {booking.status === "CONFIRMED" && booking.meetingLink && (
                          <a
                            href={booking.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                          >
                            Open Meet
                          </a>
                        )}
                        {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                          <button
                            disabled={downloadingCalendarFor === booking.id}
                            onClick={() => downloadCalendarInvite(booking.id)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                          >
                            {downloadingCalendarFor === booking.id ? "Downloading..." : "Calendar .ics"}
                          </button>
                        )}
                        <button
                          onClick={() => openReschedule(booking)}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50"
                        >
                          Reschedule
                        </button>
                        {booking.status === "CONFIRMED" && (
                          <>
                            <button
                              disabled={actionBookingId === booking.id}
                              onClick={() => markComplete(booking.id)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-60"
                            >
                              Complete
                            </button>
                            <button
                              disabled={actionBookingId === booking.id}
                              onClick={() => markNoShow(booking.id)}
                              className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 disabled:opacity-60"
                            >
                              No-show
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">AI Summaries (Pre-session)</h2>
              {aiSummaries.length === 0 ? (
                <p className="text-sm text-slate-500">No AI summaries available yet.</p>
              ) : (
                <div className="space-y-3">
                  {aiSummaries.slice(0, 8).map((summary) => (
                    <div key={`${summary.userId}-${summary.createdAt}`} className="p-3 border border-slate-200 rounded-xl">
                      <div className="text-sm font-semibold text-slate-900">{summary.userName}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(summary.createdAt).toLocaleString()}</div>
                      <div className="text-xs mt-2 text-slate-700">
                        Risk: <span className="font-semibold">{summary.riskLevel}</span> | PHQ-9: {summary.phq9Score ?? "-"} | GAD-7: {summary.gad7Score ?? "-"}
                      </div>
                      <p className="text-xs text-slate-700 mt-2">{summary.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Meeting Metadata</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                <input
                  value={meetingSearch}
                  onChange={(e) => setMeetingSearch(e.target.value)}
                  placeholder="Search by patient, email, or meeting id"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
                <select
                  value={meetingProviderFilter}
                  onChange={(e) => setMeetingProviderFilter(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">All providers</option>
                  <option value="GOOGLE_MEET">Google Meet</option>
                  <option value="ZOOM">Zoom</option>
                </select>
                <select
                  value={meetingAttendanceFilter}
                  onChange={(e) => setMeetingAttendanceFilter(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">All attendance states</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="ATTENDED">Attended</option>
                  <option value="NO_SHOW">No-show</option>
                </select>
              </div>
              {meetings.length === 0 ? (
                <p className="text-sm text-slate-500">No meetings generated yet.</p>
              ) : (
                <div className="space-y-3 mb-5">
                  {meetings.slice(0, 12).map((meeting) => (
                    <div key={meeting.id} className="p-3 border border-slate-200 rounded-xl text-xs">
                      <div className="font-semibold text-slate-900">
                        {meeting.provider} • {meeting.attendanceStatus} • {meeting.bookingStatus}
                      </div>
                      <div className="text-slate-600 mt-1">
                        Patient: <span className="font-medium text-slate-700">{meeting.userName}</span> ({meeting.userEmail})
                      </div>
                      {meeting.startTime && (
                        <div className="text-slate-600 mt-1">
                          Slot: {new Date(meeting.startTime).toLocaleString()}
                        </div>
                      )}
                      <div className="text-slate-600 mt-1 break-all">Host URL: {meeting.hostUrl || "-"}</div>
                      <div className="text-slate-600 mt-1 break-all">Join URL: {meeting.joinUrl}</div>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="text-sm font-semibold text-slate-900 mb-2">Upload License/ID Documents</h3>
              <form onSubmit={uploadDocuments} className="space-y-3">
                <input
                  type="file"
                  onChange={(e) => setLicenseDocument(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
                <input
                  type="file"
                  onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
                <button
                  type="submit"
                  disabled={uploadingDocs}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {uploadingDocs ? "Uploading..." : "Upload Documents"}
                </button>
              </form>
            </section>
          </div>
        </>
      )}

      {rescheduleBookingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Therapist Reschedule</h3>
            {rescheduleSlots.length === 0 ? (
              <p className="text-sm text-slate-600 mb-4">No alternate slots available.</p>
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

      {meetingModalBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {meetingModalMode === "accept" ? "Accept Request & Add Google Meet" : "Add / Update Google Meet"}
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Enter link like: <span className="font-semibold">https://meet.google.com/abc-defg-hij</span>
            </p>
            <input
              value={meetingLinkInput}
              onChange={(e) => setMeetingLinkInput(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeMeetingModal}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              >
                Close
              </button>
              <button
                disabled={actionBookingId === meetingModalBooking.id}
                onClick={submitMeetingModal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {actionBookingId === meetingModalBooking.id ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
