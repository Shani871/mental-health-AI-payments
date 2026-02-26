import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Star, Clock, Video, Calendar as CalendarIcon, Loader2 } from "lucide-react";

type Therapist = {
  id: string;
  user?: {
    name: string;
    email: string;
  };
  specialization: string;
  experienceYears: number;
  hourlyRate: number;
};

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  booked: boolean;
};

export default function Therapists() {
  // ... (omitting middle parts for clarity if replace_file_content allows, but actually I should provide full context)
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetch("/api/therapists/all")
      .then((res) => res.json())
      .then((data) => {
        setTherapists(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchSlots = async (id: string) => {
    setSelectedTherapist(id);
    try {
      const res = await fetch(`/api/therapists/${id}/slots`);
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error("Failed to fetch slots");
    }
  };

  const bookSlot = async (slotId: string) => {
    setBookingLoading(true);
    try {
      const res = await fetch(`/api/bookings/create?slotId=${slotId}`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Booking confirmed!");
        if (selectedTherapist) fetchSlots(selectedTherapist);
      } else {
        alert("Booking failed. Make sure you are logged in.");
      }
    } catch (err) {
      alert("Booking failed due to network error.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Find a Therapist</h1>
        <p className="text-slate-600 mt-2">Book a secure video session with a licensed professional.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {therapists.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white p-6 rounded-2xl border transition-all ${selectedTherapist === t.id
                ? "border-indigo-600 shadow-md ring-1 ring-indigo-600"
                : "border-slate-200 shadow-sm hover:border-indigo-300"
                }`}
            >
              <div className="flex items-start gap-4">
                <img
                  src={`https://picsum.photos/seed/${t.id}/100/100`}
                  alt={t.user?.name || "Therapist"}
                  className="w-20 h-20 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{t.user?.name || "Anonymous"}</h3>
                      <p className="text-indigo-600 font-medium text-sm">{t.specialization}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">${t.hourlyRate}</div>
                      <div className="text-xs text-slate-500">per session</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-medium text-slate-900">4.9</span>
                      <span>(120 reviews)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{t.experienceYears} yrs exp.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      <span>Video</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={() => fetchSlots(t.id)}
                      className="w-full sm:w-auto px-6 py-2.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      {selectedTherapist === t.id ? "Viewing Availability" : "View Availability"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              Available Slots
            </h3>

            {!selectedTherapist ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Select a therapist to view their available booking slots.
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No available slots found for this therapist.
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                  >
                    <div className="font-medium text-slate-900">{new Date(slot.startTime).toLocaleDateString()}</div>
                    <div className="text-sm text-slate-600 mb-3">
                      {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button
                      onClick={() => bookSlot(slot.id)}
                      disabled={bookingLoading}
                      className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {bookingLoading ? "Booking..." : "Book Session"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
