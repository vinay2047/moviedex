"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import {
  getRecommendations,
  searchMovies,
  getPopularMovies,
  getMe,
} from "@/lib/api";
import type { MovieSummary, MovieRecommendation } from "@/types";

export default function DiscoverPage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [searchResults, setSearchResults] = useState<MovieSummary[]>([]);
  const [popular, setPopular] = useState<MovieSummary[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"forYou" | "popular">("forYou");

  useEffect(() => {
    const init = async () => {
      try {
        const user = await getMe();
        if (!user.data.onboarding_completed) {
          router.push("/onboarding");
          return;
        }

        const [recRes, popRes] = await Promise.all([
          getRecommendations(20),
          getPopularMovies(20),
        ]);
        setRecommendations(recRes.data);
        setPopular(popRes.data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  // Debounced search
  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchMovies(q, 20);
      setSearchResults(res.data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const displayMovies = query.length >= 2
    ? searchResults
    : activeTab === "forYou"
    ? recommendations
    : popular;

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="discover-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 9,724 movies..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface-800 border border-surface-600 text-surface-100 placeholder-surface-500 text-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs (only when not searching) */}
        {query.length < 2 && (
          <div className="flex items-center gap-1 mb-8 glass-light rounded-xl p-1 w-fit mx-auto">
            <button
              onClick={() => setActiveTab("forYou")}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "forYou"
                  ? "bg-primary-600 text-white shadow-lg"
                  : "text-surface-400 hover:text-surface-100"
              }`}
              id="tab-for-you"
            >
              For You
            </button>
            <button
              onClick={() => setActiveTab("popular")}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "popular"
                  ? "bg-primary-600 text-white shadow-lg"
                  : "text-surface-400 hover:text-surface-100"
              }`}
              id="tab-popular"
            >
              Popular
            </button>
          </div>
        )}

        {/* Section title */}
        <h2 className="text-2xl font-display font-bold mb-6">
          {query.length >= 2
            ? `Results for "${query}"`
            : activeTab === "forYou"
            ? "Recommended for you"
            : "Popular movies"}
        </h2>

        {/* Movie grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
            ))}
          </div>
        ) : displayMovies.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-4 text-surface-500">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5c0 .621-.504 1.125-1.125 1.125m1.5 0h12m-12 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m12-3.75c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-1.5-3.75h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M6 11.625v1.5" />
              </svg>
            </div>
            <p className="text-surface-400 text-lg">
              {query.length >= 2
                ? "No movies found. Try a different search."
                : "No recommendations yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                showScore={activeTab === "forYou" && query.length < 2 && "score" in movie}
                score={"score" in movie ? (movie as MovieRecommendation).score : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
