import { useEffect, useState } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";
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
    overallStatus: string;
    depressionProbability?: number;
    anxietyProbability?: number;
    recommendation?: string;
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
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <BrainCircuit className="w-8 h-8 text-indigo-600" />
                    Mental Health Prediction Tool
                </h1>
                <p className="text-slate-600 mt-2">
                    This AI-based risk prediction tool uses a Random Forest classifier trained on historical student health data to estimate depression and anxiety risks based on demographics and academics.
                    <br /><span className="text-sm font-semibold text-rose-600">Disclaimer: Not a medical diagnosis.</span>
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                {optionsLoading ? (
                    <div className="py-10 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                {options.genderOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Age</label>
                            <input type="number" name="age" value={formData.age} onChange={handleChange} min="15" max="40" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Course</label>
                            <select name="course" value={formData.course} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                {options.courseOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Year of Study</label>
                            <select name="year" value={formData.year} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                {options.yearOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Marital Status</label>
                            <select name="marital" value={formData.marital} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                {options.maritalOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Current CGPA</label>
                            <input type="number" name="cgpa" value={formData.cgpa} onChange={handleChange} step="0.01" min="0" max="4.0" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run Prediction Model"}
                    </button>
                </form>
                )}

                {error && (
                    <div className="mt-6 p-4 rounded-lg bg-red-50 text-red-700 border border-red-100 flex items-center gap-3">
                        <span className="font-medium">Error:</span> {error}
                    </div>
                )}

                {result && (
                    <div className="mt-8 pt-8 border-t border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Analysis Results</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="text-sm text-slate-500 font-medium">Depression Risk</div>
                                <div className={`text-xl font-bold mt-1 ${result.depressionRisk === 'High' ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {result.depressionRisk}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="text-sm text-slate-500 font-medium">Anxiety Risk</div>
                                <div className={`text-xl font-bold mt-1 ${result.anxietyRisk === 'High' ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {result.anxietyRisk}
                                </div>
                            </div>
                        </div>
                        <div className={`mt-4 w-full p-4 rounded-xl flex items-center justify-between border ${result.overallStatus === 'High Risk' ? 'bg-red-50 border-red-100' :
                                result.overallStatus === 'Moderate Risk' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
                            }`}>
                            <div className={`font-semibold ${result.overallStatus === 'High Risk' ? 'text-red-800' :
                                    result.overallStatus === 'Moderate Risk' ? 'text-amber-800' : 'text-emerald-800'
                                }`}>
                                Overall Status
                            </div>
                            <div className={`text-lg font-bold ${result.overallStatus === 'High Risk' ? 'text-red-700' :
                                    result.overallStatus === 'Moderate Risk' ? 'text-amber-700' : 'text-emerald-700'
                                }`}>
                                {result.overallStatus}
                            </div>
                        </div>
                        {(typeof result.depressionProbability === "number" || typeof result.anxietyProbability === "number") && (
                            <div className="mt-4 grid sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                                    <div className="text-sm text-slate-500 font-medium">Depression Probability</div>
                                    <div className="text-xl font-bold mt-1 text-slate-900">
                                        {typeof result.depressionProbability === "number"
                                            ? `${(result.depressionProbability * 100).toFixed(1)}%`
                                            : "N/A"}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                                    <div className="text-sm text-slate-500 font-medium">Anxiety Probability</div>
                                    <div className="text-xl font-bold mt-1 text-slate-900">
                                        {typeof result.anxietyProbability === "number"
                                            ? `${(result.anxietyProbability * 100).toFixed(1)}%`
                                            : "N/A"}
                                    </div>
                                </div>
                            </div>
                        )}
                        {result.recommendation && (
                            <div className="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-sm font-medium">
                                {result.recommendation}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
