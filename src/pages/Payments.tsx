import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, RotateCcw, Wallet } from "lucide-react";
import { apiFetch, apiFetchBlob } from "../lib/api";

type PaymentHistoryItem = {
  id: string;
  bookingId: string;
  therapistName: string;
  amount: number;
  platformCommission: number;
  gateway: string;
  gatewayPaymentId?: string;
  refundableRemaining: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  createdAt: string;
  updatedAt: string;
};

type RefundItem = {
  id: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
  createdAt: string;
};

type RefundEligibleBooking = {
  bookingId: string;
  therapistName: string;
  bookingStatus: string;
  sessionStart: string;
  paidAmount: number;
  refundableRemaining: number;
  lateCancellationFee: number;
  message: string;
};

type PaymentOverview = {
  totalPaid: number;
  totalRefunded: number;
  netSpend: number;
  successfulPayments: number;
  refundRequests: number;
  processedRefunds: number;
  pendingBookings: number;
  paymentMethods: Record<string, number>;
};

function formatCurrency(value?: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function Payments() {
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [eligibleBookings, setEligibleBookings] = useState<RefundEligibleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refundBookingId, setRefundBookingId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [requestingRefund, setRequestingRefund] = useState(false);

  const selectedEligibleBooking = useMemo(
    () => eligibleBookings.find((item) => item.bookingId === refundBookingId) || null,
    [eligibleBookings, refundBookingId]
  );

  const refundableBalance = useMemo(
    () => eligibleBookings.reduce((sum, item) => sum + Number(item.refundableRemaining), 0),
    [eligibleBookings]
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, refundsData, overviewData, eligibleData] = await Promise.all([
        apiFetch<PaymentHistoryItem[]>("/api/payment/history"),
        apiFetch<RefundItem[]>("/api/payment/refunds/my"),
        apiFetch<PaymentOverview>("/api/payment/overview"),
        apiFetch<RefundEligibleBooking[]>("/api/payment/refund-eligible"),
      ]);
      setHistory(historyData);
      setRefunds(refundsData);
      setOverview(overviewData);
      setEligibleBookings(eligibleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedEligibleBooking) return;
    setRefundAmount(String(selectedEligibleBooking.refundableRemaining));
  }, [selectedEligibleBooking]);

  const downloadInvoice = async (bookingId: string) => {
    setDownloadingId(bookingId);
    try {
      const blob = await apiFetchBlob(`/api/payment/invoice/${bookingId}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `invoice_${bookingId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download invoice.");
    } finally {
      setDownloadingId(null);
    }
  };

  const submitRefundRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!refundBookingId || !refundAmount || !refundReason.trim()) return;
    setRequestingRefund(true);
    try {
      const params = new URLSearchParams({
        bookingId: refundBookingId,
        amount: refundAmount,
        reason: refundReason.trim(),
      });
      await apiFetch(`/api/payment/refund-request?${params.toString()}`, { method: "POST" });
      setRefundBookingId("");
      setRefundAmount("");
      setRefundReason("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Refund request failed.");
    } finally {
      setRequestingRefund(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="shell-card rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <h1 className="display-font text-3xl md:text-4xl font-extrabold text-slate-900">Payments & Refunds</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Transparent session pricing, ledger visibility, invoice downloads, and refund workflows built around real booking eligibility.
            </p>
          </div>
          <Link
            to="/dashboard"
            data-voice="back to dashboard|dashboard"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="py-14 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-teal-700" />
        </div>
      ) : (
        <>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Total Paid</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(overview?.totalPaid)}</div>
              <div className="text-xs text-slate-500 mt-2">{overview?.successfulPayments ?? 0} completed transactions</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Total Refunded</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(overview?.totalRefunded)}</div>
              <div className="text-xs text-slate-500 mt-2">{overview?.processedRefunds ?? 0} processed refunds</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Refundable Balance</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(refundableBalance)}</div>
              <div className="text-xs text-slate-500 mt-2">{eligibleBookings.length} bookings currently eligible</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm text-slate-500">Pending Session Payments</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{overview?.pendingBookings ?? 0}</div>
              <div className="text-xs text-slate-500 mt-2">Complete them from the dashboard to confirm sessions</div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Transactions</h2>
              {history.length === 0 ? (
                <div className="text-center py-10 text-slate-500">No transactions yet.</div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="p-4 border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">{item.therapistName}</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                          <div className="inline-flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5" />
                            Gateway: {item.gateway || "N/A"}
                          </div>
                          <div>Payment ID: {item.gatewayPaymentId || "N/A"}</div>
                          <div>Platform fee: {formatCurrency(item.platformCommission)}</div>
                          <div>Refundable remaining: {formatCurrency(item.refundableRemaining)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700">{item.status}</span>
                        <div className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</div>
                        {(item.status === "SUCCESS" || item.status === "REFUNDED") && (
                          <button
                            disabled={downloadingId === item.bookingId}
                            onClick={() => downloadInvoice(item.bookingId)}
                            data-voice={`invoice|download invoice|${item.therapistName} invoice`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-sm font-medium hover:bg-teal-100 disabled:opacity-60"
                          >
                            <Download className="w-4 h-4" />
                            {downloadingId === item.bookingId ? "Downloading..." : "Invoice"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Refund Request</h2>
                <form onSubmit={submitRefundRequest} className="space-y-3">
                  <select
                    value={refundBookingId}
                    onChange={(e) => setRefundBookingId(e.target.value)}
                    data-voice="eligible booking|refund booking"
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Select eligible booking</option>
                    {eligibleBookings.map((booking) => (
                      <option key={booking.bookingId} value={booking.bookingId}>
                        {booking.therapistName} · {new Date(booking.sessionStart).toLocaleDateString()} · {formatCurrency(booking.refundableRemaining)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="Refund amount"
                    data-voice="refund amount"
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason"
                    data-voice="refund reason"
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm min-h-[88px]"
                  />
                  {selectedEligibleBooking && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">{selectedEligibleBooking.therapistName}</div>
                      <div className="mt-1">Session: {new Date(selectedEligibleBooking.sessionStart).toLocaleString()}</div>
                      <div className="mt-1">Remaining refundable amount: {formatCurrency(selectedEligibleBooking.refundableRemaining)}</div>
                      {selectedEligibleBooking.lateCancellationFee > 0 && (
                        <div className="mt-1">Late cancellation fee: {formatCurrency(selectedEligibleBooking.lateCancellationFee)}</div>
                      )}
                      <div className="mt-2 text-slate-600">{selectedEligibleBooking.message}</div>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={!refundBookingId || !refundAmount || !refundReason.trim() || requestingRefund}
                    data-voice="submit refund request|request refund"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {requestingRefund ? "Submitting..." : "Submit Refund Request"}
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Payment Methods In Use</h2>
                {Object.keys(overview?.paymentMethods || {}).length === 0 ? (
                  <div className="text-sm text-slate-500">No payment methods recorded yet.</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(overview?.paymentMethods || {}).map(([method, count]) => (
                      <div key={method} className="flex items-center justify-between text-sm border border-slate-200 rounded-xl px-3 py-2">
                        <span className="font-medium text-slate-900">{method}</span>
                        <span className="text-slate-600">{count} payment(s)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-4">My Refund Requests</h2>
            {refunds.length === 0 ? (
              <div className="text-sm text-slate-500">No refund requests.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {refunds.map((item) => (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</div>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">{item.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Booking {item.bookingId}</div>
                    <div className="text-sm text-slate-600 mt-3">{item.reason}</div>
                    <div className="text-xs text-slate-500 mt-3">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
