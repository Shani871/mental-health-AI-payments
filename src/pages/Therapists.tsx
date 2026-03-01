import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calendar as CalendarIcon, Clock, Loader2, Search, Star, Video } from "lucide-react";
import { apiFetch } from "../lib/api";

type TherapistListItem = {
  therapistId: string;
  therapistName: string;
  specialization: string;
  language: string;
  hourlyRate: number;
  experienceYears: number;
  rating: number;
  bio: string;
  profilePictureUrl?: string;
  nextAvailableSlot?: string | null;
  availableSlotCount: number;
};

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  booked: boolean;
};

function slotDateKey(slot: Slot): string {
  return slot.startTime.slice(0, 10);
}

export default function Therapists() {
  const [therapists, setTherapists] = useState<TherapistListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [filters, setFilters] = useState({
    keyword: "",
    specialization: "",
    language: "",
    minRating: "",
    maxPrice: "",
  });

  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => value.trim() !== ""),
    [filters]
  );

  const selectedTherapist = useMemo(
    () => therapists.find((item) => item.therapistId === selectedTherapistId) || null,
    [therapists, selectedTherapistId]
  );

  const availableDates = useMemo(() => {
    return Array.from(new Set(slots.map((slot) => slotDateKey(slot)))).sort();
  }, [slots]);

  const filteredSlots = useMemo(() => {
    if (!selectedDate) return slots;
    return slots.filter((slot) => slotDateKey(slot) === selectedDate);
  }, [slots, selectedDate]);

  const loadTherapists = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
      if (filters.specialization.trim()) params.set("specialization", filters.specialization.trim());
      if (filters.language.trim()) params.set("language", filters.language.trim());
      if (filters.minRating.trim()) params.set("minRating", filters.minRating.trim());
      if (filters.maxPrice.trim()) params.set("maxPrice", filters.maxPrice.trim());
      const query = params.toString();
      const data = await apiFetch<TherapistListItem[]>(`/api/therapists/all${query ? `?${query}` : ""}`);
      setTherapists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load therapists.");
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async (therapistId: string) => {
    setSelectedTherapistId(therapistId);
    setSlotsLoading(true);
    setSelectedDate("");
    try {
      const data = await apiFetch<Slot[]>(`/api/therapists/${therapistId}/slots`);
      setSlots(data);
      const firstDate = Array.from(new Set(data.map((slot) => slotDateKey(slot)))).sort()[0] || "";
      setSelectedDate(firstDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots.");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const bookSlot = async (slotId: string) => {
    setBookingSlotId(slotId);
    try {
      await apiFetch(`/api/bookings/create?slotId=${slotId}`, { method: "POST" });
      alert("Booking created with PENDING status. Complete payment within 5 minutes.");
      if (selectedTherapistId) await loadSlots(selectedTherapistId);
      await loadTherapists();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Booking failed.");
    } finally {
      setBookingSlotId(null);
    }
  };

  useEffect(() => {
    loadTherapists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await loadTherapists();
  };

  const clearFilters = async () => {
    setFilters({
      keyword: "",
      specialization: "",
      language: "",
      minRating: "",
      maxPrice: "",
    });
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TherapistListItem[]>("/api/therapists/all");
      setTherapists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load therapists.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Find a Therapist</h1>
        <p className="text-slate-600 mt-2">Click a therapist to view available dates and time slots.</p>
      </div>

      <form onSubmit={onSearch} className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="Keyword"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            value={filters.specialization}
            onChange={(e) => setFilters((prev) => ({ ...prev, specialization: e.target.value }))}
            placeholder="Specialization"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            value={filters.language}
            onChange={(e) => setFilters((prev) => ({ ...prev, language: e.target.value }))}
            placeholder="Language"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            value={filters.minRating}
            onChange={(e) => setFilters((prev) => ({ ...prev, minRating: e.target.value }))}
            placeholder="Min rating"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <input
            value={filters.maxPrice}
            onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))}
            placeholder="Max price"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">
            {therapists.map((therapist, index) => (
              <motion.button
                key={therapist.therapistId}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => loadSlots(therapist.therapistId)}
                className={`w-full text-left bg-white p-5 rounded-2xl border shadow-sm transition-all ${selectedTherapistId === therapist.therapistId ? "border-indigo-500 ring-1 ring-indigo-200" : "border-slate-200 hover:border-indigo-300"}`}
              >
                <div className="flex items-start gap-4">
                  <img
                    src={therapist.profilePictureUrl || `https://picsum.photos/seed/${therapist.therapistId}/96/96`}
                    alt={therapist.therapistName}
                    className="w-16 h-16 rounded-full object-cover border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{therapist.therapistName}</h3>
                        <p className="text-sm text-indigo-700 font-medium">{therapist.specialization || "General Therapy"}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">${therapist.hourlyRate}</div>
                        <div className="text-xs text-slate-500">per session</div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 line-clamp-2">{therapist.bio || "No bio provided yet."}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        {therapist.rating.toFixed(1)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {therapist.experienceYears} yrs
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" />
                        {therapist.language || "English"}
                      </span>
                      <span>{therapist.availableSlotCount} open slots</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
            {therapists.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                No therapists found for the selected filters.
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
              <h3 className="text-lg font-bold text-slate-900 mb-2 inline-flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                Available Slots
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {selectedTherapist ? `Selected: ${selectedTherapist.therapistName}` : "Select a therapist from the list."}
              </p>

              {!selectedTherapistId ? (
                <div className="text-sm text-slate-500 py-6">Select a therapist to view dates and time slots.</div>
              ) : slotsLoading ? (
                <div className="py-6 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-slate-500 py-6">No available slots.</div>
              ) : (
                <>
                  <label className="block text-xs text-slate-600 mb-1">Select Date</label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full mb-4 p-2 border border-slate-200 rounded-lg text-sm"
                  >
                    {availableDates.map((date) => (
                      <option key={date} value={date}>
                        {new Date(date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-3">
                    {filteredSlots.map((slot) => (
                      <div key={slot.id} className="p-3 border border-slate-200 rounded-xl">
                        <div className="text-sm font-medium text-slate-900">
                          {new Date(slot.startTime).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-600 mb-2">
                          {new Date(slot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <button
                          disabled={bookingSlotId === slot.id}
                          onClick={() => bookSlot(slot.id)}
                          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {bookingSlotId === slot.id ? "Booking..." : "Book Session"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
