"""
Two-Stage Recommendation Pipeline
==================================

Replaces the legacy single-stage pgvector recommendation service with a
production-grade two-stage pipeline:

  Stage 1 — Retrieval:  Two-Tower user embedding  →  pgvector ANN top-K
  Stage 2 — Ranking:    NeuMF ONNX re-ranking of K candidates → top-N

Thread Safety
-------------
All CPU-bound inference (PyTorch embedding lookup, ONNX forward pass) is
dispatched via ``asyncio.to_thread`` so the FastAPI event loop is never blocked.
The ONNX ``InferenceSession`` is configured with controlled thread counts to
prevent over-subscription on multi-worker deployments.

Fallback Strategy
-----------------
Users without a ``model_user_index`` (i.e. registered after model training)
use the warm-start pgvector embedding for retrieval only — no ONNX re-ranking.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import onnxruntime as ort
import torch
from sqlalchemy import select, text, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.user import User
from app.models.rating import Rating
from app.models.watch_history import WatchHistory
from app.models.onboarding import OnboardingSelection

logger = logging.getLogger(__name__)

# ── Genre vocabulary (alphabetically sorted, matching training encoding) ─────
GENRE_VOCAB: list[str] = [
    "(no genres listed)", "Action", "Adventure", "Animation", "Children",
    "Comedy", "Crime", "Documentary", "Drama", "Fantasy",
    "Film-Noir", "Horror", "IMAX", "Musical", "Mystery",
    "Romance", "Sci-Fi", "Thriller", "War", "Western",
]
GENRE_TO_IDX: dict[str, int] = {g: i for i, g in enumerate(GENRE_VOCAB)}
NUM_GENRES: int = len(GENRE_VOCAB)


def _sigmoid_scores(scores: list[float]) -> list[float]:
    """Convert raw NeuMF logits to 0-1 probabilities using a sigmoid.

    This is the mathematically correct transformation for model logits
    (the inverse of the log-odds used during training).
    """
    return [round(float(1 / (1 + np.exp(-s))), 4) for s in scores]


def _format_cosine_scores(scores: list[float]) -> list[float]:
    """Clamp cosine similarity to 0-1 and round for display."""
    return [round(max(0.0, float(s)), 4) for s in scores]


def _encode_genres_multihot(genres_jsonb: list[dict] | None) -> np.ndarray:
    """Convert JSONB genre list ``[{"id": 28, "name": "Action"}, ...]``
    into a 20-dim multi-hot float32 vector."""
    vec = np.zeros(NUM_GENRES, dtype=np.float32)
    if not genres_jsonb:
        vec[GENRE_TO_IDX["(no genres listed)"]] = 1.0
        return vec
    for g in genres_jsonb:
        name = g.get("name", "")
        idx = GENRE_TO_IDX.get(name)
        if idx is not None:
            vec[idx] = 1.0
    # If no recognised genres were matched, mark as unlisted
    if vec.sum() == 0:
        vec[GENRE_TO_IDX["(no genres listed)"]] = 1.0
    return vec


# ── Candidate data container ────────────────────────────────────────────────

@dataclass
class CandidateItem:
    """Intermediate representation of a retrieval candidate."""
    movie_id: int           # DB primary key (movies.id)
    movie_index: int        # Model-internal 0-based index
    title: str
    poster_path: str | None
    genres: list[dict] | None
    vote_average: float | None
    release_date: Any       # date | None
    retrieval_score: float  # Raw pgvector similarity score


# ── Main Pipeline ────────────────────────────────────────────────────────────

class RecommendationPipeline:
    """Production two-stage recommendation pipeline.

    Initialised once at application startup and stored on ``app.state``.
    All public async methods are safe to call concurrently from
    multiple request handlers.
    """

    def __init__(
        self,
        user_embeddings: np.ndarray,
        onnx_session: ort.InferenceSession,
        retrieval_top_k: int = 100,
    ) -> None:
        # ── Retrieval stage assets ────────────────────────────────────────
        self._user_embeddings = user_embeddings          # (num_users, 32)
        self._num_users = user_embeddings.shape[0]

        # ── Ranking stage assets ──────────────────────────────────────────
        self._onnx_session = onnx_session
        self._onnx_input_names = [i.name for i in onnx_session.get_inputs()]
        self._onnx_output_name = onnx_session.get_outputs()[0].name

        # ── Config ────────────────────────────────────────────────────────
        self._retrieval_top_k = retrieval_top_k

    # ── Class-level status flags ──────────────────────────────────────────

    @property
    def retrieval_ready(self) -> bool:
        return self._user_embeddings is not None and self._num_users > 0

    @property
    def ranker_ready(self) -> bool:
        return self._onnx_session is not None

    # ── Factory ───────────────────────────────────────────────────────────

    @classmethod
    def from_settings(cls, settings: Any) -> "RecommendationPipeline":
        """Synchronous factory — call via ``asyncio.to_thread`` from lifespan.

        Loads the Two-Tower state dict for user embeddings and creates the
        ONNX InferenceSession with production-tuned thread settings.
        """
        # Resolve paths relative to the repository root
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        if settings.model_base_dir:
            base = Path(settings.model_base_dir)
            if not base.is_absolute():
                base = repo_root / base
        else:
            base = repo_root / "models"
            
        retrieval_path = base / settings.retrieval_model_path
        ranker_path = base / settings.ranker_model_path

        # ── 1. Load Two-Tower user embeddings ─────────────────────────────
        logger.info("Loading Two-Tower retrieval model from %s", retrieval_path)
        state_dict = torch.load(str(retrieval_path), map_location="cpu", weights_only=True)
        user_embeddings: np.ndarray = state_dict["user_emb.weight"].numpy()
        logger.info(
            "Two-Tower loaded: %d users × %d dims",
            user_embeddings.shape[0], user_embeddings.shape[1],
        )

        # ── 2. Create ONNX InferenceSession ───────────────────────────────
        logger.info("Loading NeuMF ONNX ranker from %s", ranker_path)
        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = settings.onnx_intra_op_threads
        sess_opts.inter_op_num_threads = settings.onnx_inter_op_threads
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_opts.enable_mem_pattern = True

        onnx_session = ort.InferenceSession(
            str(ranker_path),
            sess_options=sess_opts,
            providers=["CPUExecutionProvider"],
        )
        logger.info(
            "ONNX ranker loaded — inputs: %s, output: %s",
            [i.name for i in onnx_session.get_inputs()],
            onnx_session.get_outputs()[0].name,
        )

        return cls(
            user_embeddings=user_embeddings,
            onnx_session=onnx_session,
            retrieval_top_k=settings.retrieval_top_k,
        )

    # ──────────────────────────────────────────────────────────────────────
    # Stage 1 — Retrieval
    # ──────────────────────────────────────────────────────────────────────

    def get_user_embedding(self, user_index: int) -> np.ndarray | None:
        """Look up a user's dense embedding from the Two-Tower weight table.

        Returns None if the index is out of range.
        """
        if 0 <= user_index < self._num_users:
            return self._user_embeddings[user_index]
        return None

    async def retrieve_candidates(
        self,
        db: AsyncSession,
        user_embedding: list[float] | np.ndarray,
        exclude_movie_ids: set[int],
        *,
        k: int | None = None,
        genre_id: int | None = None,
        min_year: int | None = None,
        max_year: int | None = None,
        min_rating: float | None = None,
        require_metadata: bool = False,
        is_cold_start: bool = False,
        embedding_column: Any = None,
    ) -> list[CandidateItem]:
        """Stage 1-B: pgvector ANN search for top-K candidate items.

        Uses the negative inner product operator (``<#>``) against the
        HNSW-indexed ``movies.embedding`` column.

        When ``require_metadata`` is True, results are restricted to movies
        that have a poster, a vote_average, and at least 50 votes. This is
        used by the cold-start path to avoid returning obscure movies that
        lack TMDB metadata.
        """
        k = k or self._retrieval_top_k
        emb_list = user_embedding.tolist() if isinstance(user_embedding, np.ndarray) else user_embedding

        # Build dynamic filter conditions
        conditions = []
        if exclude_movie_ids:
            conditions.append(Movie.id.notin_(exclude_movie_ids))

        if genre_id is not None:
            conditions.append(Movie.genres.contains([{"id": genre_id}]))
        if min_year is not None:
            conditions.append(extract("year", Movie.release_date) >= min_year)
        if max_year is not None:
            conditions.append(extract("year", Movie.release_date) <= max_year)
        if min_rating is not None:
            conditions.append(Movie.vote_average >= min_rating)

        # Cold-start quality gate: only return movies with real TMDB metadata
        if require_metadata:
            conditions.append(Movie.poster_path.isnot(None))
            conditions.append(Movie.vote_count.isnot(None))
            conditions.append(Movie.vote_count >= 50)
            conditions.append(Movie.vote_average.isnot(None))

        # Safe-Start Heuristic Post-Filter for Cold-Start users
        if is_cold_start:
            conditions.append(Movie.vote_count >= 1500)
            conditions.append(Movie.vote_average >= 7.0)

        emb_col = embedding_column if embedding_column is not None else Movie.embedding

        query = (
            select(
                Movie.id,
                Movie.movie_index,
                Movie.title,
                Movie.poster_path,
                Movie.genres,
                Movie.vote_average,
                Movie.release_date,
                (emb_col.max_inner_product(emb_list)).label("neg_score"),
            )
            .where(*conditions)
            .order_by(text("neg_score ASC"))
            .limit(k)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            CandidateItem(
                movie_id=row.id,
                movie_index=row.movie_index,
                title=row.title,
                poster_path=row.poster_path,
                genres=row.genres,
                vote_average=row.vote_average,
                release_date=row.release_date,
                retrieval_score=-row.neg_score,
            )
            for row in rows
        ]

    # ──────────────────────────────────────────────────────────────────────
    # Stage 2 — Ranking
    # ──────────────────────────────────────────────────────────────────────

    def preprocess_for_ranker(
        self,
        user_index: int,
        candidates: list[CandidateItem],
    ) -> dict[str, np.ndarray]:
        """Stage 2-A: Prepare batched input tensors for the ONNX ranker.

        Returns a dict matching the ONNX model's named inputs:
          - ``user_id``:      int64  (batch_size,)
          - ``movie_id``:     int64  (batch_size,)
          - ``movie_genres``: float32 (batch_size, 20)

        All K candidates are batched into a single array for vectorised
        inference (no Python loops).
        """
        batch_size = len(candidates)

        user_ids = np.full(batch_size, user_index, dtype=np.int64)
        movie_ids = np.array([c.movie_index for c in candidates], dtype=np.int64)
        movie_genres = np.stack([_encode_genres_multihot(c.genres) for c in candidates])

        return {
            "user_id": user_ids,
            "movie_id": movie_ids,
            "movie_genres": movie_genres,
        }

    def rerank_candidates(
        self,
        preprocessed: dict[str, np.ndarray],
    ) -> np.ndarray:
        """Stage 2-B: Run batched ONNX inference and return raw logits.

        Returns a 1-D float32 array of shape ``(batch_size,)`` where higher
        values indicate stronger predicted preference.

        Note: many ONNX NeuMF exports produce shape ``(batch_size, 1)``.
        The ``.squeeze(-1)`` call flattens the trailing dim safely (no-op
        when already 1-D).
        """
        outputs = self._onnx_session.run(
            [self._onnx_output_name],
            preprocessed,
        )
        raw = outputs[0]              # (batch_size,) or (batch_size, 1)
        return raw.squeeze(-1)        # guaranteed (batch_size,)

    # ──────────────────────────────────────────────────────────────────────
    # Full pipeline orchestrators
    # ──────────────────────────────────────────────────────────────────────

    async def recommend_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
        genre_id: int | None = None,
        min_year: int | None = None,
        max_year: int | None = None,
        min_rating: float | None = None,
        sort_by: str | None = None,
    ) -> tuple[list[dict], int, dict]:
        """End-to-end personalised recommendations.

        1. Look up user → determine if Two-Tower index exists.
        2. Retrieve top-K candidates via pgvector ANN.
        3. (If model index exists) Re-rank via NeuMF ONNX.
        4. Sort, paginate, return.

        Returns ``(list_of_movie_dicts, total_count, diagnostics)``.
        """
        # ── Diagnostics accumulator ───────────────────────────────────────
        diagnostics: dict = {
            "pipeline_used": "cold_start_fallback",
            "user_index_assigned": False,
            "needs_retraining": False,
        }

        # ── 1. Fetch user ─────────────────────────────────────────────────
        user = await db.get(User, user_id)
        if user is None:
            return [], 0, diagnostics

        diagnostics["user_index_assigned"] = user.model_user_index is not None

        # IDs to exclude (already rated / watched)
        rated_ids = set(
            (await db.execute(select(Rating.movie_id).where(Rating.user_id == user_id)))
            .scalars().all()
        )
        watched_ids = set(
            (await db.execute(select(WatchHistory.movie_id).where(WatchHistory.user_id == user_id)))
            .scalars().all()
        )
        exclude_ids = rated_ids | watched_ids

        # ── 2. Determine retrieval embedding ──────────────────────────────
        has_model_index = user.model_user_index is not None
        if has_model_index:
            # Use the learned Two-Tower embedding
            user_emb = await asyncio.to_thread(
                self.get_user_embedding, user.model_user_index
            )
            if user_emb is None:
                has_model_index = False
                diagnostics["needs_retraining"] = True
        
        # When sorting by external criteria, fetch a larger pool to re-sort
        retrieval_k = self._retrieval_top_k
        if sort_by:
            retrieval_k = max(retrieval_k, 100)

        if not has_model_index:
            # ── COLD START FALLBACK LOGIC ──
            diagnostics["pipeline_used"] = "cold_start_fallback"

            # 1. Bypass NeuMF: Fetch Onboarding Data
            onboarding_movies = (await db.execute(
                select(OnboardingSelection.movie_id)
                .where(OnboardingSelection.user_id == user_id)
            )).scalars().all()

            # Extreme edge case: 0 onboarding movies
            if len(onboarding_movies) == 0:
                popular_movies = (await db.execute(
                    select(Movie)
                    .where(Movie.vote_count >= 1000)
                    .order_by(Movie.vote_average.desc())
                    .limit(10)
                )).scalars().all()
                return [
                    {
                        "id": m.id,
                        "title": m.title,
                        "poster_path": m.poster_path,
                        "genres": m.genres,
                        "vote_average": m.vote_average,
                        "release_date": m.release_date,
                        "score": 0.0,
                    }
                    for m in popular_movies
                ], len(popular_movies), diagnostics

            # Exclude onboarding movies so we don't recommend them
            exclude_ids.update(onboarding_movies)

            # Fetch 384-dimensional pgvector item content embeddings
            vectors = (await db.execute(
                select(Movie.content_embedding)
                .where(Movie.id.in_(onboarding_movies))
            )).scalars().all()

            # Calculate Centroid using NumPy and L2-normalize
            # all-MiniLM-L6-v2 produces unit vectors, but the mean of unit
            # vectors is NOT unit-length.  Normalizing restores the centroid
            # to the unit sphere so that max_inner_product == cosine similarity.
            vectors_np = np.array([v for v in vectors if v is not None], dtype=np.float32)
            centroid = np.mean(vectors_np, axis=0) if len(vectors_np) > 0 else np.zeros(384, dtype=np.float32)
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = centroid / norm

            # Vector Search via pgvector — require_metadata filters out
            # the ~50k skeleton movies that lack TMDB data (no poster/votes).
            cold_k = max(limit * 5, 100) if not sort_by else retrieval_k
            candidates = await self.retrieve_candidates(
                db, centroid, exclude_ids,
                k=cold_k,
                genre_id=genre_id,
                min_year=min_year,
                max_year=max_year,
                min_rating=min_rating,
                require_metadata=True,
                is_cold_start=True,
                embedding_column=Movie.content_embedding,
            )
            recommendations = self._candidates_to_dicts(candidates)

        else:
            # ── WARM USER (NeuMF ONNX Ranking) ──
            diagnostics["pipeline_used"] = "neumf_ranker"

            # 3. Retrieve candidates via pgvector
            try:
                candidates = await self.retrieve_candidates(
                    db, user_emb, exclude_ids,
                    k=retrieval_k,
                    genre_id=genre_id,
                    min_year=min_year,
                    max_year=max_year,
                    min_rating=min_rating,
                    is_cold_start=False,
                )
            except Exception:
                logger.exception("Retrieval stage failed")
                return [], 0, diagnostics

            if not candidates:
                return [], 0, diagnostics

            # 4. Re-rank via ONNX
            try:
                preprocessed = await asyncio.to_thread(
                    self.preprocess_for_ranker, user.model_user_index, candidates
                )
                scores = await asyncio.to_thread(
                    self.rerank_candidates, preprocessed
                )
                raw_scores = scores.tolist()

                # Sort by raw logit (descending) for ranking correctness
                ranked = sorted(
                    zip(candidates, raw_scores),
                    key=lambda pair: pair[1],
                    reverse=True,
                )
                ordered_candidates = [c for c, _ in ranked]
                ordered_raw = [s for _, s in ranked]

                # Convert raw logits to probabilities via Sigmoid
                display_scores = _sigmoid_scores(ordered_raw)

                recommendations = [
                    {
                        "id": c.movie_id,
                        "title": c.title,
                        "poster_path": c.poster_path,
                        "genres": c.genres,
                        "vote_average": c.vote_average,
                        "release_date": c.release_date,
                        "score": ds,
                    }
                    for c, ds in zip(ordered_candidates, display_scores)
                ]
            except Exception:
                logger.exception("Ranking stage failed — falling back to retrieval order")
                diagnostics["pipeline_used"] = "cold_start_fallback"
                recommendations = self._candidates_to_dicts(candidates)

        # ── 5. Optional external sort ─────────────────────────────────────
        if sort_by == "release_date_desc":
            recommendations.sort(key=lambda x: str(x["release_date"] or ""), reverse=True)
        elif sort_by == "vote_average_desc":
            recommendations.sort(key=lambda x: x["vote_average"] or 0.0, reverse=True)

        # ── 6. Paginate ──────────────────────────────────────────────────
        total = len(recommendations)
        page = recommendations[offset : offset + limit]
        return page, total, diagnostics

    async def find_similar_movies(
        self,
        db: AsyncSession,
        movie_id: int,
        *,
        limit: int = 10,
    ) -> list[dict]:
        """Item-item similarity using the movie's stored pgvector embedding.

        This is a retrieval-only operation (no user context for re-ranking).
        Filters out low-relevance items by requiring their raw similarity 
        score to be within a relative threshold of the top match.
        """
        movie = await db.get(Movie, movie_id)
        if movie is None or movie.content_embedding is None:
            return []

        source_emb = movie.content_embedding
        fetch_limit = limit * 3  # Over-fetch for filtering

        query = (
            select(
                Movie.id,
                Movie.movie_index,
                Movie.title,
                Movie.poster_path,
                Movie.genres,
                Movie.vote_average,
                Movie.release_date,
                (Movie.content_embedding.max_inner_product(source_emb)).label("neg_score"),
            )
            .where(
                Movie.id != movie_id,
                Movie.poster_path.isnot(None),
                Movie.vote_count.isnot(None),
                Movie.vote_count >= 50,
                Movie.vote_average.isnot(None),
            )
            .order_by(text("neg_score ASC"))
            .limit(fetch_limit)
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return []

        # Raw scores are negated pgvector neg_scores (so higher = more similar)
        scored_rows = [(row, -row.neg_score) for row in rows]
        
        # Filter: keep items whose score is at least 65% of the best match's score
        top_score = scored_rows[0][1]
        
        # Only apply relative filtering if top_score is positive 
        # (since dot products can theoretically be negative)
        if top_score > 0:
            threshold = top_score * 0.65
            filtered_rows = [r for r in scored_rows if r[1] >= threshold]
        else:
            filtered_rows = scored_rows

        # Truncate back to the requested limit
        filtered_rows = filtered_rows[:limit]

        final_rows = [r[0] for r in filtered_rows]
        final_scores = [r[1] for r in filtered_rows]
        
        display_scores = _format_cosine_scores(final_scores)

        return [
            {
                "id": row.id,
                "title": row.title,
                "poster_path": row.poster_path,
                "genres": row.genres,
                "vote_average": row.vote_average,
                "release_date": row.release_date,
                "score": ds,
            }
            for row, ds in zip(final_rows, display_scores)
        ]

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _candidates_to_dicts(candidates: list[CandidateItem]) -> list[dict]:
        """Convert retrieval candidates to response dicts using retrieval scores."""
        raw_scores = [c.retrieval_score for c in candidates]
        display_scores = _format_cosine_scores(raw_scores)

        return [
            {
                "id": c.movie_id,
                "title": c.title,
                "poster_path": c.poster_path,
                "genres": c.genres,
                "vote_average": c.vote_average,
                "release_date": c.release_date,
                "score": ds,
            }
            for c, ds in zip(candidates, display_scores)
        ]
