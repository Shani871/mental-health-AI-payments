import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, Zap, AlertCircle, Heart, Info, ArrowRight, ShieldCheck, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../lib/api";

type PredictionOptions = {
    genderOptions: string[];
    courseOptions: string[];
    yearOptions: string[];
    maritalOptions: string[];
};

type PredictionResult = {
    depressionRisk: "High" | "Low";
    anxietyRisk: "High" | "Low";
    panicRisk: "High" | "Low";
    overallStatus: string;
    depressionProbability?: number;
    anxietyProbability?: number;
    panicProbability?: number;
    recommendation?: string;
};

const RiskCard = ({ title, risk, probability, type }: { title: string, risk: "High" | "Low", probability?: number, type: 'depression' | 'anxiety' | 'panic' }) => {
    const isHigh = risk === "High";
    const icons = {
        depression: <Heart className={`w-5 h-5 ${isHigh ? 'text-rose-500' : 'text-emerald-500'}`} />,
        anxiety: <Zap className={`w-5 h-5 ${isHigh ? 'text-amber-500' : 'text-emerald-500'}`} />,
        panic: <AlertCircle className={`w-5 h-5 ${isHigh ? 'text-orange-500' : 'text-emerald-500'}`} />
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border transition-all duration-300 ${
                isHigh 
                ? 'bg-rose-50/50 border-rose-100 shadow-sm shadow-rose-100/50' 
                : 'bg-emerald-50/30 border-emerald-100/50 shadow-sm shadow-emerald-50/50'
            }`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl ${isHigh ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                    {icons[type]}
                </div>
                {typeof probability === "number" && (
                    <span className={`text-sm font-bold ${isHigh ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {(probability * 100).toFixed(0)}%
                    </span>
                )}
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h4>
                <div className={`text-2xl font-black mt-1 ${isHigh ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {risk}
                </div>
            </div>
            {typeof probability === "number" && (
                <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${probability * 100}%` }}
                        className={`h-full rounded-full ${isHigh ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    />
                </div>
            )}
        </motion.div>
    );
};

export default function Prediction() {
    const [loading, setLoading] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [options, setOptions] = useState<PredictionOptions>({
        genderOptions: [],
        courseOptions: [],
        yearOptions: [],
        maritalOptions: [],
    });

    const [formData, setFormData] = useState({
        gender: "",
        age: "20",
        course: "",
        year: "",
        marital: "",
        cgpa: "3.5",
    });

    useEffect(() => {
        const loadOptions = async () => {
            setOptionsLoading(true);
            setError(null);
            try {
                const data = await apiFetch<PredictionOptions>("/api/predict/options");
                setOptions(data);
                setFormData((prev) => ({
                    ...prev,
                    gender: data.genderOptions[0] || "",
                    course: data.courseOptions[0] || "",
                    year: data.yearOptions[0] || "",
                    marital: data.maritalOptions[0] || "",
                }));
            } catch (err: any) {
                setError(err.message || "Failed to load prediction options.");
            } finally {
                setOptionsLoading(false);
            }
        };
        loadOptions();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const resp = await apiFetch<PredictionResult>("/api/predict", {
                method: "POST",
                body: JSON.stringify({
                    gender: formData.gender,
                    age: parseInt(formData.age),
                    course: formData.course,
                    year: formData.year,
                    marital: formData.marital,
                    cgpa: parseFloat(formData.cgpa),
                }),
            });

            if ((resp as any).error) {
                throw new Error((resp as any).error);
            }

            setResult(resp);
        } catch (err: any) {
            setError(err.message || "Failed to run prediction");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20 px-4">
            <header className="text-center space-y-4">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex p-3 rounded-2xl bg-indigo-600/10 text-indigo-600 border border-indigo-200"
                >
                    <BrainCircuit className="w-10 h-10" />
                </motion.div>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
                    Health Prediction <span className="text-indigo-600">Sync</span>
                </h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                    Advanced AI diagnostics powered by Random Forest classifiers. Monitor student mental health indicators in real-time.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-500 bg-rose-50 w-fit mx-auto px-3 py-1.5 rounded-full border border-rose-100">
                    <Activity className="w-3 h-3" />
                    Not a medical diagnosis
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/40 sticky top-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                             Demographics
                             <Info className="w-4 h-4 text-slate-400" />
                        </h2>
                        
                        {optionsLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                <p className="text-sm font-medium text-slate-400">Loading configurations...</p>
                            </div>
                        ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                                    <select name="gender" value={formData.gender} onChange={handleChange} data-voice="gender" className="w-full bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 font-medium p-3 transition-all cursor-pointer">
                                        {options.genderOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Age</label>
                                    <input type="number" name="age" value={formData.age} onChange={handleChange} min="15" max="40" data-voice="age" className="w-full bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 font-medium p-3 transition-all" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Course of Study</label>
                                    <select name="course" value={formData.course} onChange={handleChange} data-voice="course|course of study" className="w-full bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 font-medium p-3 transition-all cursor-pointer">
                                        {options.courseOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Year</label>
                                        <select name="year" value={formData.year} onChange={handleChange} data-voice="academic year|year" className="w-full bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 font-medium p-3 transition-all cursor-pointer">
                                            {options.yearOptions.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CGPA</label>
                                        <input type="number" name="cgpa" value={formData.cgpa} onChange={handleChange} step="0.01" min="0" max="4.0" data-voice="cgpa" className="w-full bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 font-medium p-3 transition-all" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Marital Status</label>
                                    <select name="marital" value={formData.marital} onChange={handleChange} data-voice="marital status|marital" className="w-full bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 font-medium p-3 transition-all cursor-pointer">
                                        {options.maritalOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                data-voice="run ai diagnostic|run prediction|submit prediction"
                                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200 font-bold transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Run AI Diagnostic <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                        )}
                        
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-6 p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-start gap-3"
                            >
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div className="text-sm font-semibold">{error}</div>
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-7">
                    <AnimatePresence mode="wait">
                        {!result && !loading ? (
                            <motion.div 
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200"
                            >
                                <div className="p-5 rounded-full bg-white shadow-sm mb-6">
                                    <ShieldCheck className="w-12 h-12 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Ready for Analysis</h3>
                                <p className="text-slate-500 mt-2 max-w-sm">
                                    Input student data on the left to generate a comprehensive risk evaluation.
                                </p>
                            </motion.div>
                        ) : loading ? (
                            <motion.div 
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center p-10"
                            >
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                                    <BrainCircuit className="w-10 h-10 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                </div>
                                <p className="text-lg font-bold text-slate-900 mt-8">Synthesizing Data...</p>
                                <p className="text-slate-500 mt-2">Classifying patterns using Random Forest Ensemble</p>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="results"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between mb-2 px-2">
                                    <h3 className="text-2xl font-black text-slate-900">Analysis Summary</h3>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Live Prediction</span>
                                    </div>
                                </div>

                                <div className="grid sm:grid-cols-3 gap-4">
                                    <RiskCard title="Depression" risk={result.depressionRisk} probability={result.depressionProbability} type="depression" />
                                    <RiskCard title="Anxiety" risk={result.anxietyRisk} probability={result.anxietyProbability} type="anxiety" />
                                    <RiskCard title="Panic" risk={result.panicRisk} probability={result.panicProbability} type="panic" />
                                </div>

                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className={`relative overflow-hidden p-8 rounded-3xl border ${
                                        result.overallStatus === 'High Risk' ? 'bg-rose-600 border-rose-500 text-white' :
                                        result.overallStatus === 'Moderate Risk' ? 'bg-amber-500 border-amber-400 text-white' : 
                                        'bg-emerald-600 border-emerald-500 text-white'
                                    } shadow-2xl ${
                                        result.overallStatus === 'High Risk' ? 'shadow-rose-200' :
                                        result.overallStatus === 'Moderate Risk' ? 'shadow-amber-100' : 'shadow-emerald-100'
                                    }`}
                                >
                                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                                        <div>
                                            <div className="text-white/80 font-bold uppercase tracking-widest text-xs mb-1">Global Sentiment</div>
                                            <div className="text-4xl font-black">{result.overallStatus}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/20 max-w-xs transition-colors">
                                                <p className="text-sm font-semibold leading-relaxed">
                                                    {result.recommendation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Abstract background element */}
                                    <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                                    <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-black/10 rounded-full blur-3xl" />
                                </motion.div>

                                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-4">
                                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-indigo-600">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-900">Data Integrity & Privacy</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                            This analysis is generated locally. Results are not stored on public servers unless explicitly synchronized with your clinical dashboard.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
