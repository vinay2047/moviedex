"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { getOnboardingCandidates, completeOnboarding, getMe } from "@/lib/api";
import type { MovieSummary } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<MovieSummary[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        // Check if already onboarded
        const user = await getMe();
        if (user.data.onboarding_completed) {
          router.push("/discover");
          return;
        }

        const res = await getOnboardingCandidates();
        setCandidates(res.data);
      } catch (err) {
        setError("Failed to load movies. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 10) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size < 5) return;
    setSubmitting(true);
    setError("");

    try {
      await completeOnboarding(Array.from(selected));
      router.push("/discover");
    } catch (err: any) {
      setError(err.message || "Failed to complete onboarding.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-display font-bold">
            Pick movies you <span className="gradient-text">love</span>
          </h1>
          <p className="mt-4 text-lg text-surface-400 max-w-2xl mx-auto">
            Select 5 to 10 movies to train your personal taste profile. The more
            you pick, the better your recommendations will be.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[200px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    selected.size >= i
                      ? "bg-primary-500 glow-primary"
                      : "bg-surface-700"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-surface-400">
              {selected.size} / 10 selected
              {selected.size < 5 && (
                <span className="text-primary-500 ml-1">
                  (min 5)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-8 text-center">
            {error}
          </div>
        )}

        {/* Movie grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {candidates.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                selected={selected.has(movie.id)}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="sticky bottom-0 py-6 mt-8">
          <div className="glass-card rounded-full px-6 py-4 flex items-center justify-between max-w-lg mx-auto shadow-2xl">
            <span className="text-sm text-surface-300">
              {selected.size >= 5
                ? "Ready to go!"
                : `Pick ${5 - selected.size} more`}
            </span>
            <button
              onClick={handleSubmit}
              disabled={selected.size < 5 || submitting}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              id="onboarding-submit"
            >
              {submitting ? "Computing your taste..." : "Get Recommendations →"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
