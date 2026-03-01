import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RotateCcw, Wallet } from "lucide-react";
import { apiFetch, apiFetchBlob } from "../lib/api";

type PaymentHistoryItem = {
  id: string;
  bookingId: string;
  therapistName: string;
  amount: number;
  platformCommission: number;
  gatewayPaymentId?: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  createdAt: string;
};

type RefundItem = {
  id: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
  createdAt: string;
};

export default function Payments() {
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refundBookingId, setRefundBookingId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [requestingRefund, setRequestingRefund] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, refundsData] = await Promise.all([
        apiFetch<PaymentHistoryItem[]>("/api/payment/history"),
        apiFetch<RefundItem[]>("/api/payment/refunds/my"),
      ]);
      setHistory(historyData);
      setRefunds(refundsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const successful = history.filter((item) => item.status === "SUCCESS");
    const refunded = history.filter((item) => item.status === "REFUNDED");
    return {
      paid: successful.reduce((sum, item) => sum + Number(item.amount), 0),
      refunded: refunded.reduce((sum, item) => sum + Number(item.amount), 0),
    };
  }, [history]);

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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Payment History</h1>
        <p className="text-slate-600 mt-2">Track payments, invoices, and refund requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm text-slate-500">Total Successful Payments</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">${totals.paid.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm text-slate-500">Total Refunded</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">${totals.refunded.toFixed(2)}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-14 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Transactions</h2>
            {history.length === 0 ? (
              <div className="text-center py-10 text-slate-500">No transactions yet.</div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{item.therapistName}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        Payment ID: {item.gatewayPaymentId || "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700">{item.status}</span>
                      <div className="text-sm font-semibold text-slate-900">${Number(item.amount).toFixed(2)}</div>
                      {(item.status === "SUCCESS" || item.status === "REFUNDED") && (
                        <button
                          disabled={downloadingId === item.bookingId}
                          onClick={() => downloadInvoice(item.bookingId)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 disabled:opacity-60"
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Request Refund</h2>
              <form onSubmit={submitRefundRequest} className="space-y-3">
                <input
                  value={refundBookingId}
                  onChange={(e) => setRefundBookingId(e.target.value)}
                  placeholder="Booking ID"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                />
                <input
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                />
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm min-h-[88px]"
                />
                <button
                  type="submit"
                  disabled={!refundBookingId || !refundAmount || !refundReason.trim() || requestingRefund}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" />
                  {requestingRefund ? "Submitting..." : "Submit Refund Request"}
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">My Refund Requests</h2>
              {refunds.length === 0 ? (
                <div className="text-sm text-slate-500">No refund requests.</div>
              ) : (
                <div className="space-y-3">
                  {refunds.map((item) => (
                    <div key={item.id} className="p-3 border border-slate-200 rounded-xl">
                      <div className="text-sm font-semibold text-slate-900">${Number(item.amount).toFixed(2)}</div>
                      <div className="text-xs text-slate-600 mt-1">{item.reason}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
