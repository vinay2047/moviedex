"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import StarRating from "@/components/StarRating";
import { getUserRatings, getWatchHistory, tmdbImage, upsertRating } from "@/lib/api";
import type { RatingWithMovie, MovieSummary } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/* ── Rating badge overlay for watched grid cards ────────────────────── */
function RatingBadge({ rating }: { rating: number }) {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 glass-card text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
      <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-amber-400">{rating}</span>
    </div>
  );
}

/* ── Unrated prompt for watched grid cards ───────────────────────────── */
function UnratedPrompt({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      className="absolute top-2 right-2 flex items-center justify-center bg-surface-950/60 backdrop-blur-sm p-1.5 rounded-lg border border-surface-700/30 hover:bg-surface-800/80 transition-colors cursor-pointer"
      title="Rate this movie"
    >
      <svg className="w-4 h-4 text-surface-400 hover:text-surface-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    </div>
  );
}

/* ── Poster card for the Watched grid ────────────────────────────────── */
function WatchedPosterCard({ movie, rating, onRateClick }: { movie: { id: number; title: string; poster_path: string | null; vote_average: number | null; release_date: string | null }; rating: number | null; onRateClick?: (e: React.MouseEvent) => void }) {
  const posterSrc = tmdbImage(movie.poster_path, "w342");
  const year = movie.release_date?.split("-")[0];

  return (
    <Link href={`/movie/${movie.id}`} id={`watched-card-${movie.id}`}>
      <div className="movie-card group relative rounded-2xl overflow-hidden ring-1 ring-white/5 cursor-pointer bg-surface-800">
        <div className="aspect-[2/3] relative bg-surface-800 overflow-hidden">
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
          <div className="absolute inset-0 bg-surface-950/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Rating badge or unrated prompt */}
          {rating !== null ? (
            <RatingBadge rating={rating} />
          ) : (
            <UnratedPrompt onClick={onRateClick} />
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
  const [watchlistMovies, setWatchlistMovies] = useState<MovieSummary[]>([]);
  const [unratedWatchedMovies, setUnratedWatchedMovies] = useState<MovieSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"watchlist" | "watched">("watchlist");
  const [loading, setLoading] = useState(true);

  // Rating Modal state
  const [ratingMovie, setRatingMovie] = useState<{ id: number; title: string } | null>(null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);

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
        const [ratingsRes, watchlistRes, unratedWatchedRes] = await Promise.all([
          getUserRatings(50),
          getWatchHistory(50, 0, "watchlist"),
          getWatchHistory(50, 0, "watched"),
        ]);
        setRatings(ratingsRes.data);
        setWatchlistMovies(watchlistRes.data);
        setUnratedWatchedMovies(unratedWatchedRes.data);
      } catch (err) {
        console.error("Failed to load library:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleRateClick = (e: React.MouseEvent, movie: { id: number; title: string }) => {
    e.preventDefault();
    e.stopPropagation();
    setRatingMovie(movie);
    setPendingRating(null);
  };

  const submitRating = async () => {
    if (!ratingMovie || pendingRating === null) return;
    setSavingRating(true);
    try {
      await upsertRating(ratingMovie.id, pendingRating);
      // Optimistically update the UI by adding this rating to the local ratings list
      setRatings((prev) => [
        ...prev.filter((r) => r.movie_id !== ratingMovie.id),
        {
          movie_id: ratingMovie.id,
          title: ratingMovie.title,
          poster_path: null, // Not used in this particular view since we merged
          rating: pendingRating,
          updated_at: new Date().toISOString(),
        },
      ]);
      setRatingMovie(null);
    } catch (err) {
      console.error("Failed to save rating:", err);
    } finally {
      setSavingRating(false);
    }
  };

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

  // Add unrated watched entries
  for (const m of unratedWatchedMovies) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      watchedMovies.push({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        release_date: m.release_date,
        userRating: null,
      });
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-surface-100 mb-8">Your Library</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 glass-card rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            activeTab === "watchlist"
              ? "bg-primary-500 text-white shadow-lg"
              : "text-surface-400 hover:text-surface-100"
          }`}
          id="tab-watchlist"
        >
          Watchlist
          {!loading && <span className="ml-1.5 text-xs opacity-70">({watchlistMovies.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab("watched")}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            activeTab === "watched"
              ? "bg-primary-500 text-white shadow-lg"
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
        watchlistMovies.length === 0 ? (
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
            {watchlistMovies.map((movie) => (
              <Link key={movie.id} href={`/movie/${movie.id}`} id={`watchlist-card-${movie.id}`}>
                <div className="movie-card group relative rounded-xl overflow-hidden ring-1 ring-surface-700/50 cursor-pointer">
                  <div className="aspect-[2/3] relative bg-surface-800 overflow-hidden">
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
                    <div className="absolute inset-0 bg-surface-950/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
                onRateClick={(e) => handleRateClick(e, movie)}
              />
            ))}
          </div>
        )
      )}

      {/* ── Rating Dialog ──────────────────────────────────────────────── */}
      {ratingMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-surface-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card bg-surface-900/80 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-surface-100 mb-2">Rate {ratingMovie.title}</h3>
            <p className="text-sm text-surface-400 mb-6">Select a rating out of 5 stars.</p>
            
            <div className="flex justify-center mb-8">
              <StarRating
                value={pendingRating ?? 0}
                onChange={setPendingRating}
                size="lg"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRatingMovie(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-sm text-surface-300 hover:text-surface-100 transition-colors"
                disabled={savingRating}
              >
                Cancel
              </button>
              <button
                onClick={submitRating}
                disabled={pendingRating === null || savingRating}
                className="px-5 py-2.5 rounded-xl font-medium text-sm btn-primary min-w-[120px]"
              >
                {savingRating ? "Saving..." : "Save Rating"}
              </button>
            </div>
          </div>
        </div>
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
export default function LibraryPage() {
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
