"use client";

import Image from "next/image";
import Link from "next/link";
import { tmdbImage } from "@/lib/api";
import type { MovieSummary } from "@/types";

interface MovieCardProps {
  movie: MovieSummary;
  showScore?: boolean;
  score?: number;
  selected?: boolean;
  onSelect?: (id: number) => void;
}

export default function MovieCard({
  movie,
  showScore,
  score,
  selected,
  onSelect,
}: MovieCardProps) {
  const posterSrc = tmdbImage(movie.poster_path, "w342");
  const year = movie.release_date?.split("-")[0];

  const handleClick = () => {
    if (onSelect) {
      onSelect(movie.id);
    }
  };

  const card = (
    <div
      className={`movie-card group relative rounded-xl overflow-hidden cursor-pointer ${
        selected
          ? "ring-2 ring-primary-500 glow-primary"
          : "ring-1 ring-surface-700/50"
      }`}
      onClick={onSelect ? handleClick : undefined}
    >
      {/* Poster */}
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

        {/* Score badge */}
        {showScore && score !== undefined && (
          <div className="absolute top-2 right-2 bg-primary-600/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg">
            {(score * 100).toFixed(0)}% match
          </div>
        )}

        {/* Selected checkmark */}
        {selected && (
          <div className="absolute top-2 left-2 bg-primary-500 text-white rounded-full w-7 h-7 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
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
          {year && (
            <span className="text-xs text-surface-400">{year}</span>
          )}
        </div>
      </div>
    </div>
  );

  // If it's selectable (onboarding), don't wrap in Link
  if (onSelect) return card;

  return (
    <Link href={`/movie/${movie.id}`} id={`movie-card-${movie.id}`}>
      {card}
    </Link>
  );
}
