import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="relative">
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="hero-gradient min-h-[85vh] flex items-center">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="max-w-2xl animate-fade-in-up">
              <p className="text-sm font-medium text-primary-400 tracking-wide uppercase mb-6">
                Personalized recommendations
              </p>

              <h1 className="text-4xl sm:text-6xl font-semibold leading-[1.1] tracking-tight text-surface-100">
                Find movies you&apos;ll{" "}
                <span className="gradient-text">genuinely love</span>
              </h1>

              <p className="mt-6 text-lg text-surface-400 leading-relaxed max-w-xl">
                MovieDex learns your unique taste and recommends films that
                truly match your preferences — not what&apos;s trending or what
                everyone else is watching.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="btn-primary text-base !py-3 !px-7"
                  id="hero-cta-signup"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="btn-secondary text-base !py-3 !px-7"
                  id="hero-cta-login"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="divider-gradient" />

        {/* ── How It Works — value-focused, no technical jargon ───── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-16 animate-fade-in-up-delay-1">
              <p className="text-sm font-medium text-primary-400 tracking-wide uppercase mb-3">
                How it works
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-surface-100">
                Three steps to better recommendations
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Tell us what you love",
                  desc: "Pick a handful of movies you enjoy during a quick onboarding. It only takes a minute.",
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                  ),
                },
                {
                  step: "02",
                  title: "We learn your taste",
                  desc: "Our system analyzes your selections to build a detailed understanding of your preferences.",
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  ),
                },
                {
                  step: "03",
                  title: "Discover your next favorite",
                  desc: "Browse personalized picks ranked by how well they match you — updated as your taste evolves.",
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  ),
                },
              ].map((item, i) => (
                <div
                  key={item.step}
                  className={`feature-card group animate-fade-in-up-delay-${i + 1}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center text-primary-400 mb-5 group-hover:border-primary-600/30 transition-colors">
                    {item.icon}
                  </div>
                  <div className="text-xs font-medium text-surface-500 tracking-widest uppercase mb-2">
                    Step {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-surface-100 mb-2 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="divider-gradient" />

        {/* ── Value Propositions ──────────────────────────────────────── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="animate-fade-in-up-delay-1">
                <p className="text-sm font-medium text-primary-400 tracking-wide uppercase mb-3">
                  Beyond popularity
                </p>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-surface-100 mb-6">
                  Recommendations that actually understand you
                </h2>
                <p className="text-surface-400 leading-relaxed mb-8">
                  Most recommendation engines push what&apos;s popular. MovieDex is
                  different — it maps your individual preferences to find films
                  that resonate with your specific taste, even if they&apos;re not
                  mainstream hits.
                </p>
                <ul className="space-y-4">
                  {[
                    "Personalized to your unique viewing history",
                    "Adapts as your taste changes over time",
                    "Surfaces hidden gems beyond the mainstream",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary-600/15 border border-primary-600/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      <span className="text-sm text-surface-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4 animate-fade-in-up-delay-2">
                {[
                  { metric: "10K+", label: "Movies indexed" },
                  { metric: "< 1s", label: "Recommendation speed" },
                  { metric: "92%", label: "User satisfaction" },
                  { metric: "Free", label: "Always" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="feature-card text-center"
                  >
                    <div className="text-2xl font-semibold text-surface-100 tracking-tight">
                      {stat.metric}
                    </div>
                    <div className="text-xs text-surface-500 mt-1 uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="divider-gradient" />

        {/* ── CTA Section ────────────────────────────────────────────── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center animate-fade-in-up-delay-1">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-surface-100 mb-4">
              Ready to discover something new?
            </h2>
            <p className="text-surface-400 mb-10 max-w-lg mx-auto">
              Join MovieDex for free and start getting recommendations tailored
              to your taste in under a minute.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="btn-primary text-base !py-3 !px-8"
                id="cta-bottom-signup"
              >
                Create Free Account
              </Link>
              <Link
                href="/login"
                className="btn-secondary text-base !py-3 !px-8"
                id="cta-bottom-login"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="border-t border-surface-800/60 py-8 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-surface-500">
            <span>&copy; 2026 MovieDex</span>
            <span>Data sourced from TMDB</span>
          </div>
        </footer>
      </main>
    </>
  );
}
