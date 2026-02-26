import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Calendar, Video, FileText, CreditCard, Activity, Clock } from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetching user bookings
    setTimeout(() => {
      setBookings([
        {
          id: "b1",
          therapist: "Dr. Sarah Smith",
          date: "2026-03-01",
          time: "10:00 AM - 11:00 AM",
          status: "CONFIRMED",
          payment: "SUCCESS",
          type: "Video Session",
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, John</h1>
          <p className="text-slate-600 mt-2">Manage your sessions, payments, and AI triage history.</p>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
            Edit Profile
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
            New Booking
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { icon: Calendar, label: "Upcoming Sessions", value: "1", color: "text-indigo-600", bg: "bg-indigo-50" },
          { icon: Activity, label: "AI Assessments", value: "3", color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Clock, label: "Total Hours", value: "12", color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4"
          >
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex gap-6">
          {["upcoming", "past", "assessments", "billing"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium pb-4 -mb-4 border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading...</div>
          ) : activeTab === "upcoming" ? (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                  <div className="flex items-start gap-4 mb-4 sm:mb-0">
                    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                      <Video className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{b.therapist}</h4>
                      <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {b.date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {b.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
                      {b.status}
                    </span>
                    <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                      Join Video
                    </button>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="text-center py-12 text-slate-500">No upcoming sessions.</div>
              )}
            </div>
          ) : activeTab === "assessments" ? (
            <div className="space-y-4">
              <div className="p-5 border border-slate-200 rounded-xl flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Initial AI Triage</h4>
                    <p className="text-sm text-slate-500 mt-1">Completed on Feb 24, 2026</p>
                    <div className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <strong>Summary:</strong> User reported feeling overwhelmed and anxious over the past two weeks. Recommended speaking with a licensed therapist specializing in anxiety management.
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wider">
                  Moderate Risk
                </span>
              </div>
            </div>
          ) : activeTab === "billing" ? (
            <div className="space-y-4">
              <div className="p-5 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Session with Dr. Sarah Smith</h4>
                    <p className="text-sm text-slate-500 mt-1">Feb 24, 2026 • Invoice #INV-2026-001</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">$150.00</div>
                  <span className="text-xs font-medium text-emerald-600">PAID</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
