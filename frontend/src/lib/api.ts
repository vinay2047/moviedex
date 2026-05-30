/**
 * FastAPI client wrapper — all requests to the backend go through here.
 *
 * Automatically attaches the Supabase JWT for authenticated requests.
 */

import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  params?: Record<string, string | number>;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

function buildUrl(path: string, params?: Record<string, string | number>): string {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, params } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  }

  const url = buildUrl(path, params);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// ── Typed API methods ────────────────────────────────────────────────────

import type {
  MovieSummary,
  MovieDetail,
  MovieRecommendation,
  UserProfile,
  RatingWithMovie,
  PaginatedResponse,
  SingleResponse,
  GenreItem,
  ProfileStats,
  FavoriteMovie,
} from "@/types";

// Users
export const getMe = () => api<SingleResponse<UserProfile>>("/api/v1/users/me");

export const getProfileStats = () => api<SingleResponse<ProfileStats>>("/api/v1/profile/stats");

// Movies
export const searchMovies = (q: string, limit = 10, offset = 0) =>
  api<PaginatedResponse<MovieSummary>>("/api/v1/movies/search", {
    params: { q, limit, offset },
  });

export interface DiscoverParams {
  limit?: number;
  offset?: number;
  genre_id?: number | null;
  min_year?: number | null;
  max_year?: number | null;
  min_rating?: number | null;
  sort_by?: string | null;
}

export const getPopularMovies = (params: DiscoverParams = { limit: 20, offset: 0 }) => {
  // Filter out null/undefined
  const queryParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v != null)
  );
  return api<PaginatedResponse<MovieSummary>>("/api/v1/movies/popular", {
    params: queryParams as Record<string, string | number>,
    auth: false,
  });
};

export const getMovieDetail = (id: number) =>
  api<SingleResponse<MovieDetail>>(`/api/v1/movies/${id}`);

export const getGenres = () =>
  api<{ data: GenreItem[] }>("/api/v1/movies/genres", { auth: false });

// Recommendations
export const getRecommendations = (params: DiscoverParams = { limit: 20, offset: 0 }) => {
  // Filter out null/undefined
  const queryParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v != null)
  );
  return api<PaginatedResponse<MovieRecommendation>>("/api/v1/recommendations", {
    params: queryParams as Record<string, string | number>,
  });
};

export const getSimilarMovies = (movieId: number, limit = 10) =>
  api<{ data: MovieRecommendation[] }>(
    `/api/v1/recommendations/similar/${movieId}`,
    { params: { limit } }
  );

// Onboarding
export const getOnboardingCandidates = () =>
  api<{ data: MovieSummary[] }>("/api/v1/onboarding/candidates");

export const completeOnboarding = (movieIds: number[]) =>
  api<SingleResponse<{ onboarding_completed: boolean; message: string }>>(
    "/api/v1/onboarding/complete",
    { method: "POST", body: { movie_ids: movieIds } }
  );

// Ratings
export const getUserRatings = (limit = 50, offset = 0) =>
  api<PaginatedResponse<RatingWithMovie>>("/api/v1/ratings", {
    params: { limit, offset },
  });

export const upsertRating = (movieId: number, rating: number) =>
  api<SingleResponse<{ movie_id: number; rating: number; updated_at: string }>>(
    "/api/v1/ratings",
    { method: "POST", body: { movie_id: movieId, rating } }
  );

export const deleteRating = (movieId: number) =>
  api<void>(`/api/v1/ratings/${movieId}`, { method: "DELETE" });

// Watch History
export const getWatchHistory = (limit = 50, offset = 0, status?: string) =>
  api<PaginatedResponse<MovieSummary>>("/api/v1/watch-history", {
    params: { limit, offset, ...(status ? { status } : {}) },
  });

export const addToWatchHistory = (movieId: number, status: "watchlist" | "watched" = "watchlist") =>
  api<SingleResponse<{ movie_id: number; status: string }>>(
    "/api/v1/watch-history",
    { method: "POST", body: { movie_id: movieId, status } }
  );

export const removeFromWatchHistory = (movieId: number) =>
  api<void>(`/api/v1/watch-history/${movieId}`, { method: "DELETE" });

// Favorites
export const getFavorites = () =>
  api<{ data: FavoriteMovie[] }>("/api/v1/favorites");

export const addFavorite = (movieId: number) =>
  api<SingleResponse<{ movie_id: number; position: number; created_at: string }>>(
    "/api/v1/favorites",
    { method: "POST", body: { movie_id: movieId } }
  );

export const removeFavorite = (movieId: number) =>
  api<void>(`/api/v1/favorites/${movieId}`, { method: "DELETE" });

export const getFavoriteStatus = (movieId: number) =>
  api<SingleResponse<{ is_favorite: boolean; total_favorites: number }>>(`/api/v1/favorites/${movieId}/status`);

// TMDB image helpers
export const tmdbImage = (path: string | null, size = "w500"): string => {
  if (!path) return "/placeholder-poster.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const tmdbBackdrop = (path: string | null): string => {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/original${path}`;
};
