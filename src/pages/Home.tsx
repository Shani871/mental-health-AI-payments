import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Clock, Video } from "lucide-react";
import { motion } from "motion/react";
import { defaultRouteForRole, getAuthUser } from "../lib/auth";

export default function Home() {
  const authUser = getAuthUser();
  const accountCta = authUser
    ? {
        to: defaultRouteForRole(authUser.role),
        label:
          authUser.role === "ADMIN"
            ? "Open Admin Panel"
            : authUser.role === "THERAPIST"
              ? "Open Therapist Panel"
              : "Open Dashboard",
      }
    : { to: "/signup", label: "Create Account" };

  return (
    <div className="py-6 md:py-12 space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="shell-card rounded-[2rem] p-6 md:p-10 overflow-hidden relative"
      >
        <div className="absolute -top-20 -right-12 w-60 h-60 rounded-full bg-teal-100/70 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-52 h-52 rounded-full bg-amber-100/80 blur-3xl" />
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-teal-100 text-teal-800 mb-5 border border-teal-200">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Confidential care journey
            </span>
            <h1 className="display-font text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-slate-900 mb-5">
              Mental health support that starts with clarity.
            </h1>
            <p className="text-lg text-slate-700 leading-relaxed max-w-xl mb-8">
              Use AI triage to understand your current risk level, then move directly into therapist matching, booking, and follow-up from one flow.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/triage"
                className="brand-button inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold"
              >
                Start AI Triage
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/therapists"
                className="outline-button inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold"
              >
                Browse Therapists
              </Link>
              <Link
                to={accountCta.to}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                {accountCta.label}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["AI screening", "PHQ/GAD signal tracking"],
              ["Live booking", "Available slots + reminders"],
              ["Secure consults", "Video session support"],
              ["Admin oversight", "Therapist review workflows"],
            ].map(([title, subtitle], idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + idx * 0.08, duration: 0.35 }}
                className="rounded-2xl border border-slate-200 bg-white/95 p-4"
              >
                <div className="text-sm font-bold text-slate-900">{title}</div>
                <div className="text-xs text-slate-600 mt-1">{subtitle}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: ShieldCheck,
            title: "Private AI Triage",
            desc: "Structured check-ins convert symptoms into a clear starting plan.",
          },
          {
            icon: Clock,
            title: "Fast Session Booking",
            desc: "Patients pick real-time therapist availability and confirm instantly.",
          },
          {
            icon: Video,
            title: "Secure Video Follow-up",
            desc: "Therapy continuity through protected meeting links and attendance tracking.",
          },
        ].map((feature, i) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="shell-card rounded-2xl p-5"
          >
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100 mb-4">
              <feature.icon className="w-5 h-5" />
            </div>
            <h3 className="display-font text-lg font-bold text-slate-900">{feature.title}</h3>
            <p className="text-slate-600 mt-2 leading-relaxed">{feature.desc}</p>
          </motion.article>
        ))}
      </section>
    </div>
  );
}
