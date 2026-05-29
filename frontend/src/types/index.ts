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
  in_watch_history: boolean;
}

export interface MovieRecommendation extends MovieSummary {
  score: number;
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

export interface SingleResponse<T> {
  data: T;
}
