"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Typed, validated configuration loaded from .env / environment."""

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_publishable_key: str = Field(..., description="Supabase publishable key")
    supabase_secret_key: str = Field(..., description="Supabase secret key")
    supabase_jwt_secret: str = Field("", description="JWT secret for HS256 verification (not needed for ES256 projects)")

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str = Field(
        ...,
        description="Async PostgreSQL connection string (postgresql+asyncpg://...)",
    )

    # ── TMDB ──────────────────────────────────────────────────────────────
    tmdb_read_access_token: str = Field("", description="TMDB v4 Read Access Token")

    # ── App ───────────────────────────────────────────────────────────────
    app_env: str = Field("development", description="development | staging | production")
    cors_origins: str = Field(
        "http://localhost:3000",
        description="Comma-separated allowed origins",
    )

    # ── ML Pipeline ──────────────────────────────────────────────────
    model_base_dir: str = Field(
        "models",
        description="Base directory for ML model files (defaults to models/)",
    )
    retrieval_model_path: str = Field(
        "twotower_retrieval.pth",
        description="Two-Tower retrieval model state_dict",
    )
    ranker_model_path: str = Field(
        "neumf_ranker.onnx",
        description="NeuMF ONNX ranker model",
    )
    retrieval_top_k: int = Field(100, description="Candidate pool size from retrieval stage")
    onnx_intra_op_threads: int = Field(2, description="ONNX intra-op parallelism threads")
    onnx_inter_op_threads: int = Field(1, description="ONNX inter-op parallelism threads")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()  # type: ignore[call-arg]
