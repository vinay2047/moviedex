"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import StarRating from "@/components/StarRating";
import { getUserRatings, getWatchHistory, tmdbImage } from "@/lib/api";
import type { RatingWithMovie, MovieSummary } from "@/types";
import Image from "next/image";
import Link from "next/link";

/* ── Rating badge overlay for watched grid cards ────────────────────── */
function RatingBadge({ rating }: { rating: number }) {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 bg-surface-950/80 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-lg border border-surface-700/40">
      <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-amber-400">{rating}</span>
    </div>
  );
}

/* ── Unrated prompt for watched grid cards ───────────────────────────── */
function UnratedPrompt() {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 bg-surface-950/60 backdrop-blur-sm text-xs px-2 py-1 rounded-lg border border-surface-700/30">
      <svg className="w-3 h-3 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
      <span className="text-surface-500">Rate</span>
    </div>
  );
}

/* ── Poster card for the Watched grid ────────────────────────────────── */
function WatchedPosterCard({ movie, rating }: { movie: { id: number; title: string; poster_path: string | null; vote_average: number | null; release_date: string | null }; rating: number | null }) {
  const posterSrc = tmdbImage(movie.poster_path, "w342");
  const year = movie.release_date?.split("-")[0];

  return (
    <Link href={`/movie/${movie.id}`} id={`watched-card-${movie.id}`}>
      <div className="movie-card group relative rounded-xl overflow-hidden ring-1 ring-surface-700/50 cursor-pointer">
        <div className="aspect-[2/3] relative bg-surface-800">
          {movie.poster_path ? (
            <Image
              src={posterSrc}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-surface-500">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 4v1h-2V4c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H6V4c0-.55-.45-1-1-1s-1 .45-1 1v16c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
              </svg>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Rating badge or unrated prompt */}
          {rating !== null ? (
            <RatingBadge rating={rating} />
          ) : (
            <UnratedPrompt />
          )}
        </div>

        <div className="p-3 bg-surface-900/80">
          <h3 className="text-sm font-semibold text-surface-100 truncate">
            {movie.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {movie.vote_average && (
              <span className="flex items-center gap-1 text-xs text-accent-400">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {movie.vote_average.toFixed(1)}
              </span>
            )}
            {year && <span className="text-xs text-surface-400">{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Main profile content ────────────────────────────────────────────── */
function ProfileContent() {
  const searchParams = useSearchParams();
  const [ratings, setRatings] = useState<RatingWithMovie[]>([]);
  const [watchHistory, setWatchHistory] = useState<MovieSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"watchlist" | "watched">("watchlist");
  const [loading, setLoading] = useState(true);

  // Support tab query param from navbar dropdown
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "watched") {
      setActiveTab("watched");
    } else if (tab === "history") {
      // backwards-compatible with old ?tab=history links
      setActiveTab("watchlist");
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

  // Build a lookup for ratings by movie_id
  const ratingsByMovieId = new Map(ratings.map((r) => [r.movie_id, r.rating]));

  // Merge all watched movies: rated + watch history (deduplicated)
  const watchedMovies: Array<{ id: number; title: string; poster_path: string | null; vote_average: number | null; release_date: string | null; userRating: number | null }> = [];
  const seenIds = new Set<number>();

  // Add rated movies first (they are definitely watched)
  for (const r of ratings) {
    seenIds.add(r.movie_id);
    watchedMovies.push({
      id: r.movie_id,
      title: r.title,
      poster_path: r.poster_path,
      vote_average: null,
      release_date: null,
      userRating: r.rating,
    });
  }

  // Add watch history entries that don't already have a rating
  for (const m of watchHistory) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      watchedMovies.push({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        release_date: m.release_date,
        userRating: ratingsByMovieId.get(m.id) ?? null,
      });
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-surface-100 mb-8">Your Profile</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 bg-surface-800/50 border border-surface-700/40 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            activeTab === "watchlist"
              ? "bg-primary-600 text-white shadow-lg"
              : "text-surface-400 hover:text-surface-100"
          }`}
          id="tab-watchlist"
        >
          Watchlist
          {!loading && <span className="ml-1.5 text-xs opacity-70">({watchHistory.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab("watched")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            activeTab === "watched"
              ? "bg-primary-600 text-white shadow-lg"
              : "text-surface-400 hover:text-surface-100"
          }`}
          id="tab-watched"
        >
          Watched
          {!loading && <span className="ml-1.5 text-xs opacity-70">({watchedMovies.length})</span>}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      ) : activeTab === "watchlist" ? (
        /* ── Watchlist Tab: poster grid of saved movies ─────────────── */
        watchHistory.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            }
            message="Your watchlist is empty."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {watchHistory.map((movie) => (
              <Link key={movie.id} href={`/movie/${movie.id}`} id={`watchlist-card-${movie.id}`}>
                <div className="movie-card group relative rounded-xl overflow-hidden ring-1 ring-surface-700/50 cursor-pointer">
                  <div className="aspect-[2/3] relative bg-surface-800">
                    {movie.poster_path ? (
                      <Image
                        src={tmdbImage(movie.poster_path, "w342")}
                        alt={movie.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-surface-500">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18 4v1h-2V4c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H6V4c0-.55-.45-1-1-1s-1 .45-1 1v16c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-3 bg-surface-900/80">
                    <h3 className="text-sm font-semibold text-surface-100 truncate">{movie.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {movie.vote_average && (
                        <span className="flex items-center gap-1 text-xs text-accent-400">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {movie.vote_average.toFixed(1)}
                        </span>
                      )}
                      {movie.release_date && (
                        <span className="text-xs text-surface-400">{movie.release_date.split("-")[0]}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        /* ── Watched Tab: all movies user has marked as watched ─────── */
        watchedMovies.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            message="No movies marked as watched yet."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {watchedMovies.map((movie) => (
              <WatchedPosterCard
                key={movie.id}
                movie={movie}
                rating={movie.userRating}
              />
            ))}
          </div>
        )
      )}
    </main>
  );
}

/* ── Empty state reusable component ──────────────────────────────────── */
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-20">
      <div className="flex justify-center mb-4 text-surface-500">
        {icon}
      </div>
      <p className="text-surface-400 text-lg">{message}</p>
      <Link href="/discover" className="btn-primary inline-block mt-6">
        Discover Movies
      </Link>
    </div>
  );
}

/* ── Page wrapper with Suspense ──────────────────────────────────────── */
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
