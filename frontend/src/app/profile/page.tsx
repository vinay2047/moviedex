"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import StarRating from "@/components/StarRating";
import { getUserRatings, getWatchHistory } from "@/lib/api";
import { tmdbImage } from "@/lib/api";
import type { RatingWithMovie, MovieSummary } from "@/types";
import Image from "next/image";
import Link from "next/link";

function ProfileContent() {
  const searchParams = useSearchParams();
  const [ratings, setRatings] = useState<RatingWithMovie[]>([]);
  const [watchHistory, setWatchHistory] = useState<MovieSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"ratings" | "history">("ratings");
  const [loading, setLoading] = useState(true);

  // Support tab query param from navbar dropdown
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "history") {
      setActiveTab("history");
    }
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ratingsRes, historyRes] = await Promise.all([
          getUserRatings(50),
          getWatchHistory(50),
        ]);
        setRatings(ratingsRes.data);
        setWatchHistory(historyRes.data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-surface-100 mb-8">Your Profile</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 bg-surface-800/50 border border-surface-700/40 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("ratings")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "ratings"
              ? "bg-primary-600 text-white shadow-lg"
              : "text-surface-400 hover:text-surface-100"
          }`}
          id="tab-ratings"
        >
          My Ratings ({ratings.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "history"
              ? "bg-primary-600 text-white shadow-lg"
              : "text-surface-400 hover:text-surface-100"
          }`}
          id="tab-history"
        >
          Watchlist ({watchHistory.length})
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      ) : activeTab === "ratings" ? (
        ratings.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-4 text-surface-500">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <p className="text-surface-400 text-lg">
              You haven&apos;t rated any movies yet.
            </p>
            <Link href="/discover" className="btn-primary inline-block mt-6">
              Discover Movies
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ratings.map((r) => (
              <Link
                key={r.movie_id}
                href={`/movie/${r.movie_id}`}
                className="flex items-center gap-4 rounded-xl p-4 bg-surface-900 border border-surface-700/40 hover:border-primary-500/20 transition-all group"
              >
                <div className="w-12 h-18 flex-shrink-0 rounded-lg overflow-hidden bg-surface-800">
                  {r.poster_path ? (
                    <Image
                      src={tmdbImage(r.poster_path, "w92")}
                      alt={r.title}
                      width={48}
                      height={72}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 4v1h-2V4c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H6V4c0-.55-.45-1-1-1s-1 .45-1 1v16c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-100 truncate group-hover:text-primary-400 transition-colors">
                    {r.title}
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    Rated {new Date(r.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <StarRating value={r.rating} readonly size="sm" />
              </Link>
            ))}
          </div>
        )
      ) : watchHistory.length === 0 ? (
        <div className="text-center py-20">
          <div className="flex justify-center mb-4 text-surface-500">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </div>
          <p className="text-surface-400 text-lg">
            Your watchlist is empty.
          </p>
          <Link href="/discover" className="btn-primary inline-block mt-6">
            Discover Movies
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {watchHistory.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="skeleton w-48 h-10 mb-8" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
              ))}
            </div>
          </main>
        }
      >
        <ProfileContent />
      </Suspense>
    </>
  );
}
