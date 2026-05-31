"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import YearRangeSlider from "@/components/YearRangeSlider";
import SelectDropdown from "@/components/SelectDropdown";
import {
  getRecommendations,
  searchMovies,
  getPopularMovies,
  getMe,
  getGenres,
  type DiscoverParams,
} from "@/lib/api";
import type { MovieSummary, MovieRecommendation } from "@/types";

export default function DiscoverPage() {
  const router = useRouter();
  
  // Data states
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [popular, setPopular] = useState<MovieSummary[]>([]);
  const [searchResults, setSearchResults] = useState<MovieSummary[]>([]);
  
  // UI states
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"forYou" | "popular">("forYou");
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Filter States
  const currentYear = new Date().getFullYear();
  const defaultParams: DiscoverParams = {
    genre_id: null,
    min_year: 1920,
    max_year: currentYear,
    min_rating: null,
    sort_by: null,
  };

  // Draft states (what's in the modal right now)
  const [draftForYou, setDraftForYou] = useState<DiscoverParams>(defaultParams);
  const [draftPopular, setDraftPopular] = useState<DiscoverParams>(defaultParams);

  // Applied states (what's actually used to fetch data)
  const [appliedForYou, setAppliedForYou] = useState<DiscoverParams>(defaultParams);
  const [appliedPopular, setAppliedPopular] = useState<DiscoverParams>(defaultParams);

  // Initial load for genres and auth
  useEffect(() => {
    const init = async () => {
      try {
        const user = await getMe();
        if (!user.data.onboarding_completed) {
          router.push("/onboarding");
          return;
        }
        const genreRes = await getGenres();
        setGenres(genreRes.data);
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    init();
  }, [router]);

  // Fetch For You data when appliedForYou changes
  useEffect(() => {
    const fetchForYou = async () => {
      setLoading(true);
      try {
        const res = await getRecommendations({ limit: 20, ...appliedForYou });
        setRecommendations(res.data);
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchForYou();
  }, [appliedForYou]);

  // Fetch Popular data when appliedPopular changes
  useEffect(() => {
    const fetchPopular = async () => {
      setLoading(true);
      try {
        const res = await getPopularMovies({ limit: 20, ...appliedPopular });
        setPopular(res.data);
      } catch (err) {
        console.error("Failed to fetch popular:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPopular();
  }, [appliedPopular]);

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

  // Helpers for current tab state
  const currentDraft = activeTab === "forYou" ? draftForYou : draftPopular;
  const setCurrentDraft = activeTab === "forYou" ? setDraftForYou : setDraftPopular;
  const currentApplied = activeTab === "forYou" ? appliedForYou : appliedPopular;

  // Open modal and sync draft to applied
  const handleOpenFilters = () => {
    if (activeTab === "forYou") {
      setDraftForYou(appliedForYou);
    } else {
      setDraftPopular(appliedPopular);
    }
    setIsFilterModalOpen(true);
  };

  // Apply filters
  const handleApplyFilters = () => {
    if (activeTab === "forYou") {
      setAppliedForYou(draftForYou);
    } else {
      setAppliedPopular(draftPopular);
    }
    setIsFilterModalOpen(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    setCurrentDraft(defaultParams);
  };

  // Count active filters (based on applied state so the badge is accurate)
  const activeFiltersCount = Object.entries(currentApplied).filter(([key, val]) => {
    if (key === 'min_year' && val === 1920) return false;
    if (key === 'max_year' && val === currentYear) return false;
    return val !== null;
  }).length;

  const hasDraftFilters = Object.entries(currentDraft).filter(([key, val]) => {
    if (key === 'min_year' && val === 1920) return false;
    if (key === 'max_year' && val === currentYear) return false;
    return val !== null;
  }).length > 0;

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Search */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
              <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs & Filter Button (only when not searching) */}
        {query.length < 2 && (
          <div className="mb-10 flex items-center justify-center gap-4">
            <div className="relative flex items-center bg-surface-900 border border-surface-800 rounded-full p-1 w-[260px] shrink-0">
              {/* Sliding Background Indicator */}
              <div
                className="absolute top-1 bottom-1 left-1 w-[124px] bg-surface-700/80 rounded-full shadow-sm transition-transform duration-300 ease-out"
                style={{
                  transform: activeTab === "forYou" ? "translateX(0)" : "translateX(128px)",
                }}
              />
              <button
                onClick={() => setActiveTab("forYou")}
                className={`relative z-10 w-[124px] py-2 text-sm font-medium transition-colors rounded-full ${
                  activeTab === "forYou" ? "text-white drop-shadow-md" : "text-surface-400 hover:text-surface-200"
                }`}
              >
                For You
              </button>
              <button
                onClick={() => setActiveTab("popular")}
                className={`relative z-10 w-[124px] ml-1 py-2 text-sm font-medium transition-colors rounded-full ${
                  activeTab === "popular" ? "text-white drop-shadow-md" : "text-surface-400 hover:text-surface-200"
                }`}
              >
                Popular
              </button>
            </div>
            
            <button
              onClick={handleOpenFilters}
              className="bg-surface-800 hover:bg-surface-700 border border-surface-600 text-surface-200 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFiltersCount > 0 && (
                <span className="bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                  {activeFiltersCount}
                </span>
              )}
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
                : "No movies found with the selected filters."}
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

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex-none flex items-center justify-between p-4 sm:p-6 border-b border-surface-800">
              <h3 className="text-xl font-display font-semibold text-white">Filters</h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="text-surface-400 hover:text-white transition-colors p-2 -mr-2 rounded-full hover:bg-surface-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Genre Filter */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Genre</label>
                <SelectDropdown
                  value={currentDraft.genre_id ?? null}
                  onChange={(val) => setCurrentDraft({ ...currentDraft, genre_id: val ? Number(val) : null })}
                  options={[
                    { value: "", label: "All Genres" },
                    ...genres.map(g => ({ value: g.id, label: g.name }))
                  ]}
                />
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Minimum Rating</label>
                <SelectDropdown
                  value={currentDraft.min_rating ?? null}
                  onChange={(val) => setCurrentDraft({ ...currentDraft, min_rating: val ? Number(val) : null })}
                  options={[
                    { value: "", label: "Any Rating" },
                    { value: "5", label: "5+ Stars" },
                    { value: "6", label: "6+ Stars" },
                    { value: "7", label: "7+ Stars" },
                    { value: "8", label: "8+ Stars" },
                    { value: "9", label: "9+ Stars" },
                  ]}
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Sort By</label>
                <SelectDropdown
                  value={currentDraft.sort_by ?? null}
                  onChange={(val) => setCurrentDraft({ ...currentDraft, sort_by: val ? String(val) : null })}
                  options={[
                    { value: "", label: activeTab === "forYou" ? "Best Match" : "Most Popular" },
                    { value: "release_date_desc", label: "Newest Releases" },
                    { value: "vote_average_desc", label: "Highest Rated" },
                  ]}
                />
              </div>

              {/* Year Range */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Release Year Range</label>
                <YearRangeSlider
                  min={1920}
                  max={currentYear}
                  value={[currentDraft.min_year || 1920, currentDraft.max_year || currentYear]}
                  onChange={([min, max]) => setCurrentDraft({ ...currentDraft, min_year: min, max_year: max })}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex-none p-4 sm:p-6 border-t border-surface-800 flex justify-between items-center bg-surface-800/50">
              {hasDraftFilters ? (
                <button
                  onClick={handleClearFilters}
                  className="text-surface-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <div /> /* Spacer */
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-surface-300 hover:text-white font-medium transition-colors hover:bg-surface-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="bg-primary-500 hover:bg-primary-400 text-white font-medium py-2.5 px-6 rounded-xl transition-colors shadow-lg shadow-primary-500/20"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
