/** Shared TypeScript types matching the FastAPI Pydantic schemas. */

export interface GenreItem {
  id: number;
  name: string;
}

export interface CastMember {
  name: string | null;
  character: string | null;
  profile_path: string | null;
}

export interface MovieSummary {
  id: number;
  title: string;
  poster_path: string | null;
  genres: GenreItem[] | null;
  vote_average: number | null;
  release_date: string | null;
}

export interface MovieDetail extends MovieSummary {
  movielens_id: number;
  tmdb_id: number | null;
  original_title: string | null;
  overview: string | null;
  backdrop_path: string | null;
  vote_count: number | null;
  runtime: number | null;
  cast_top5: CastMember[] | null;
  trailer_key: string | null;
  user_rating: number | null;
  watch_status: string | null;
}

export interface MovieRecommendation extends MovieSummary {
  score: number;
}

export interface DiagnosticsInfo {
  pipeline_used: "neumf_ranker" | "cold_start_fallback";
  user_index_assigned: boolean;
  needs_retraining: boolean;
}

export interface UserProfile {
  id: string;
  onboarding_completed: boolean;
  has_embedding: boolean;
  created_at: string;
}

export interface RatingWithMovie {
  movie_id: number;
  title: string;
  poster_path: string | null;
  rating: number;
  updated_at: string;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface RecommendationResponse extends PaginatedResponse<MovieRecommendation> {
  diagnostics?: DiagnosticsInfo;
}

export interface SingleResponse<T> {
  data: T;
}

export interface RatingBucket {
  rating: number;
  count: number;
}

export interface TopGenre {
  genre: string;
  avg_rating: number;
  count: number;
}

export interface ProfileStats {
  total_watched: number;
  average_rating: number;
  rating_distribution: RatingBucket[];
  top_genres: TopGenre[];
}

export interface FavoriteMovie {
  movie_id: number;
  position: number;
  title: string;
  poster_path: string | null;
}
