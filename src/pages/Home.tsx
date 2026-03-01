import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Clock, Video } from "lucide-react";
import { motion } from "motion/react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-12 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mx-auto"
      >
        <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-800 mb-6">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Secure & Confidential
        </span>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Mental health support, <br className="hidden md:block" />
          <span className="text-indigo-600">guided by AI triage.</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
          Start with a confidential AI assessment to understand your needs, then connect with licensed therapists who specialize in helping you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-xl text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all hover:shadow-md"
          >
            Create Account
          </Link>
          <Link
            to="/triage"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all hover:shadow-md"
          >
            Start Free Assessment
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <Link
            to="/therapists"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm transition-all"
          >
            Browse Therapists
          </Link>
        </div>
      </motion.div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {[
          {
            icon: ShieldCheck,
            title: "Private AI Triage",
            desc: "A safe, judgment-free space to discuss how you're feeling. We use structured assessments to guide you.",
          },
          {
            icon: Clock,
            title: "Instant Booking",
            desc: "Find available slots and book your session immediately. No waiting lists or phone calls required.",
          },
          {
            icon: Video,
            title: "Secure Video Sessions",
            desc: "Connect with your therapist from anywhere using our secure, HIPAA-compliant video platform.",
          },
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 + 0.2 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6">
              <feature.icon className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
            <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
