"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import StarRating from "@/components/StarRating";
import {
  getMovieDetail,
  getSimilarMovies,
  upsertRating,
  addToWatchHistory,
  removeFromWatchHistory,
  tmdbImage,
  tmdbBackdrop,
} from "@/lib/api";
import type { MovieDetail, MovieRecommendation } from "@/types";

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = Number(params.id);

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [similar, setSimilar] = useState<MovieRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [movieRes, similarRes] = await Promise.all([
          getMovieDetail(movieId),
          getSimilarMovies(movieId, 10),
        ]);
        setMovie(movieRes.data);
        setSimilar(similarRes.data);
      } catch (err) {
        console.error("Failed to load movie:", err);
      } finally {
        setLoading(false);
      }
    };
    if (movieId) load();
  }, [movieId]);

  // Simple watchlist toggle — no dialog
  const handleToggleWatchlist = async () => {
    if (!movie) return;
    try {
      if (movie.in_watch_history) {
        await removeFromWatchHistory(movie.id);
        setMovie((prev) => (prev ? { ...prev, in_watch_history: false } : prev));
      } else {
        await addToWatchHistory(movie.id);
        setMovie((prev) => (prev ? { ...prev, in_watch_history: true } : prev));
      }
    } catch (err) {
      console.error("Watchlist toggle failed:", err);
    }
  };

  // Open the "Mark as Watched" rating dialog
  const handleMarkAsWatchedClick = () => {
    setPendingRating(null);
    setShowRatingDialog(true);
  };

  // Save from the dialog — upsert rating
  const handleMarkAsWatched = async () => {
    if (!movie) return;
    setSaving(true);
    try {
      if (pendingRating !== null) {
        await upsertRating(movie.id, pendingRating);
        setMovie((prev) =>
          prev ? { ...prev, user_rating: pendingRating } : prev
        );
      }
      setShowRatingDialog(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-12">
          <div className="skeleton w-full h-96 rounded-2xl mb-8" />
          <div className="skeleton w-1/2 h-10 mb-4" />
          <div className="skeleton w-full h-24" />
        </main>
      </>
    );
  }

  if (!movie) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p className="text-2xl text-surface-400">Movie not found.</p>
        </main>
      </>
    );
  }

  const backdrop = tmdbBackdrop(movie.backdrop_path);
  const poster = tmdbImage(movie.poster_path, "w500");
  const year = movie.release_date?.split("-")[0];
  const hours = movie.runtime ? Math.floor(movie.runtime / 60) : null;
  const mins = movie.runtime ? movie.runtime % 60 : null;

  return (
    <>
      <Navbar />
      <main>
        {/* Backdrop */}
        <div className="relative h-[50vh] sm:h-[60vh] overflow-hidden">
          {backdrop && (
            <Image
              src={backdrop}
              alt=""
              fill
              className="object-cover"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/60 to-surface-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-950/80 to-transparent" />
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-48 relative z-10">
          <div className="flex flex-col sm:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 w-48 sm:w-64">
              <div className="aspect-[2/3] relative rounded-2xl overflow-hidden ring-1 ring-surface-700/50 shadow-2xl">
                {movie.poster_path ? (
                  <Image src={poster} alt={movie.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface-800 flex items-center justify-center text-surface-500">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 4v1h-2V4c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H6V4c0-.55-.45-1-1-1s-1 .45-1 1v16c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-4">
              <h1 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight text-surface-100">
                {movie.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-surface-400">
                {year && <span>{year}</span>}
                {hours !== null && (
                  <span>
                    {hours}h {mins}m
                  </span>
                )}
                {movie.vote_average && (
                  <span className="flex items-center gap-1 text-accent-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {movie.vote_average.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Genres */}
              {movie.genres && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {movie.genres.map((g) => (
                    <span
                      key={g.id}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-surface-800 text-surface-300 border border-surface-700"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              {movie.overview && (
                <p className="mt-6 text-surface-300 leading-relaxed max-w-3xl">
                  {movie.overview}
                </p>
              )}

              {/* User actions */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {/* Add to Watchlist toggle */}
                <button
                  onClick={handleToggleWatchlist}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    movie.in_watch_history
                      ? "bg-primary-600/15 text-primary-400 border border-primary-500/25 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25"
                      : "btn-primary"
                  }`}
                  id="toggle-watchlist"
                >
                  <svg
                    className="w-5 h-5"
                    fill={movie.in_watch_history ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={movie.in_watch_history ? 0 : 1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                    />
                  </svg>
                  {movie.in_watch_history ? "In Watchlist" : "Add to Watchlist"}
                </button>

                {/* Mark as Watched — opens rating dialog */}
                <button
                  onClick={handleMarkAsWatchedClick}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm btn-secondary"
                  id="mark-as-watched"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mark as Watched
                </button>

                {/* Your rating (shown inline if already rated) */}
                {movie.user_rating !== null && (
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    <span>Your rating:</span>
                    <StarRating value={movie.user_rating} readonly size="sm" />
                  </div>
                )}

                {/* Trailer */}
                {movie.trailer_key && (
                  <a
                    href={`https://www.youtube.com/watch?v=${movie.trailer_key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 btn-secondary"
                    id="watch-trailer"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch Trailer
                  </a>
                )}
              </div>

              {/* Cast */}
              {movie.cast_top5 && movie.cast_top5.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold mb-4 text-surface-100">Cast</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {movie.cast_top5.map((member, idx) => (
                      <div key={idx} className="flex-shrink-0 w-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-surface-800 mx-auto overflow-hidden">
                          {member.profile_path ? (
                            <Image
                              src={tmdbImage(member.profile_path, "w185")}
                              alt={member.name || ""}
                              width={64}
                              height={64}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-surface-500">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-xs font-medium text-surface-200 truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-surface-500 truncate">
                          {member.character}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Similar movies */}
          {similar.length > 0 && (
            <section className="mt-16 mb-12">
              <h2 className="text-2xl font-semibold tracking-tight mb-6 text-surface-100">
                Similar movies
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {similar.map((m) => (
                  <MovieCard key={m.id} movie={m} showScore score={m.score} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Rating Dialog Overlay */}
      {showRatingDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRatingDialog(false);
          }}
        >
          <div className="bg-surface-900 border border-surface-700/60 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-sm mx-4 p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-surface-100 mb-1">
              Mark as Watched
            </h3>
            <p className="text-sm text-surface-400 mb-6">
              Rate this movie (optional).
            </p>

            {/* Star rating */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <StarRating
                value={pendingRating}
                onChange={(r) => setPendingRating(r)}
                size="lg"
              />
              {pendingRating !== null && (
                <button
                  onClick={() => setPendingRating(null)}
                  className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
                >
                  Clear rating
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowRatingDialog(false)}
                className="flex-1 btn-secondary text-sm text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsWatched}
                disabled={saving}
                className="flex-1 btn-primary text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Mark as Watched"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
