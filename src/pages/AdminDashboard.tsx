import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ShieldCheck, UserCheck, AlertCircle, Search, Filter, CheckCircle, XCircle } from "lucide-react";

type Therapist = {
    id: string;
    user?: {
        name: string;
        email: string;
    };
    specialization: string;
    verified: boolean;
    licenseNumber?: string;
    experienceYears: number;
    hourlyRate: number;
};

export default function AdminDashboard() {
    const [unverifiedTherapists, setUnverifiedTherapists] = useState<Therapist[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUnverified();
    }, []);

    const fetchUnverified = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/therapists/unverified");
            if (!response.ok) throw new Error("Failed to fetch");
            const data = await response.json();
            setUnverifiedTherapists(data);
            setLoading(false);
        } catch (err) {
            setError("Failed to load unverified therapists. Make sure the backend is running.");
            setLoading(false);
        }
    };

    const verifyTherapist = async (id: string) => {
        try {
            const response = await fetch(`/api/admin/therapists/${id}/verify`, { method: "PUT" });
            if (!response.ok) throw new Error("Verification failed");
            setUnverifiedTherapists((prev) => prev.filter((t) => t.id !== id));
            alert("Therapist verified successfully!");
        } catch (err) {
            alert("Verification failed.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-indigo-600" />
                        Admin Control Panel
                    </h1>
                    <p className="text-slate-600 mt-2">Manage the platform, verify providers, and monitor system health.</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-indigo-600" />
                        <span className="text-indigo-900 font-bold">{unverifiedTherapists.length} Pending Verifications</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1 space-y-2">
                    {[
                        { label: "Therapist Verification", icon: UserCheck, active: true },
                        { label: "Platform Analytics", icon: ShieldCheck, active: false },
                        { label: "System Health", icon: AlertCircle, active: false },
                    ].map((item, i) => (
                        <button
                            key={i}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${item.active
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                                : "text-slate-600 hover:bg-white hover:text-slate-900"
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800">Pending Approvals</h2>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name..."
                                        className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white">
                                    <Filter className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : unverifiedTherapists.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100 italic">
                                                <th className="pb-4 font-medium text-slate-500 text-sm">Therapist Info</th>
                                                <th className="pb-4 font-medium text-slate-500 text-sm">Specialization</th>
                                                <th className="pb-4 font-medium text-slate-500 text-sm">License</th>
                                                <th className="pb-4 font-medium text-slate-500 text-sm text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {unverifiedTherapists.map((t) => (
                                                <motion.tr
                                                    key={t.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="group hover:bg-slate-50 transition-colors"
                                                >
                                                    <td className="py-4">
                                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700">
                                                            {t.user?.name?.split(' ').map(n => n[0]).join('') || 'T'}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{t.user?.name || 'Unknown'}</div>
                                                            <div className="text-xs text-slate-500">{t.user?.email || 'No email'}</div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 text-sm text-slate-600">{t.specialization}</td>
                                                    <td className="py-4 font-mono text-xs text-slate-500 uppercase">{t.licenseNumber}</td>
                                                    <td className="py-4 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => verifyTherapist(t.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                Approve
                                                            </button>
                                                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <h3 className="font-bold text-slate-900">All caught up!</h3>
                                    <p className="text-slate-500 text-sm mt-1">There are no pending therapist verifications.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
