"""
Nightly Incremental NeuMF Retrain
=================================

Designed for GitHub Actions cron execution.  Fetches the last 24 hours of
positive user-movie interactions from Supabase, incrementally fine-tunes
the NeuMF ranker (item embeddings frozen), and uploads the updated .pth
and .onnx artefacts back to Hugging Face Hub.

Environment variables required:
    SUPABASE_URL              – e.g. https://xxxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY – service-role secret (not the anon key)
    HF_TOKEN                  – Hugging Face write token
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from huggingface_hub import hf_hub_download, HfApi
from supabase import create_client, Client

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("retrain")

# ── Constants ────────────────────────────────────────────────────────────────

HF_REPO_ID = "vinay2047/movidex-models"
PTH_FILENAME = "neumf_ranker_best.pth"
ONNX_FILENAME = "neumf_ranker.onnx"

NUM_GENRES = 20
NEGATIVE_RATIO = 4          # negatives per positive sample
LEARNING_RATE = 1e-4
NUM_EPOCHS = 5
BATCH_SIZE = 512
EMBED_DIM = 64
MLP_LAYERS = [256, 128, 64]

# Genre vocabulary — must match pipeline.py exactly
GENRE_VOCAB: list[str] = [
    "(no genres listed)", "Action", "Adventure", "Animation", "Children",
    "Comedy", "Crime", "Documentary", "Drama", "Fantasy",
    "Film-Noir", "Horror", "IMAX", "Musical", "Mystery",
    "Romance", "Sci-Fi", "Thriller", "War", "Western",
]
GENRE_TO_IDX: dict[str, int] = {g: i for i, g in enumerate(GENRE_VOCAB)}


# ═══════════════════════════════════════════════════════════════════════════
# 1. NeuMF Model Definition  (must mirror training-time architecture)
# ═══════════════════════════════════════════════════════════════════════════

class NeuMF(nn.Module):
    """Neural Matrix Factorisation (He et al., 2017) with genre side-info.

    Architecture mirrors the upgraded training code:
      - GMF path:  user_gmf ⊙ item_gmf
      - MLP path:  concat(user_mlp, item_mlp, genre_linear(genre_vec))
                    → [256 → BN → ReLU → Drop] → [128 → BN → ReLU → Drop] → 64
      - Predict:   Linear(concat(gmf, mlp_out), 1)
    """

    def __init__(self, num_users: int, num_items: int, embed_dim: int = EMBED_DIM):
        super().__init__()

        # GMF path
        self.emb_user_gmf = nn.Embedding(num_users, embed_dim)
        self.emb_item_gmf = nn.Embedding(num_items, embed_dim)

        # MLP path
        self.emb_user_mlp = nn.Embedding(num_users, embed_dim)
        self.emb_item_mlp = nn.Embedding(num_items, embed_dim)

        # Genre side-information projection
        self.genre_linear = nn.Linear(NUM_GENRES, embed_dim)

        # MLP tower: input = user_mlp + item_mlp + genre = 3 * embed_dim
        mlp_input_dim = embed_dim * 3
        layers: list[nn.Module] = []
        in_size = mlp_input_dim
        for out_size in MLP_LAYERS[:-1]:
            layers.append(nn.Linear(in_size, out_size))
            layers.append(nn.BatchNorm1d(out_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.2))
            in_size = out_size
        # Final MLP layer — includes BN to match trained architecture
        layers.append(nn.Linear(in_size, MLP_LAYERS[-1]))
        layers.append(nn.BatchNorm1d(MLP_LAYERS[-1]))
        self.mlp_layers = nn.Sequential(*layers)

        # Final prediction: concat(gmf, mlp_out) → 1
        self.predict_layer = nn.Linear(embed_dim + MLP_LAYERS[-1], 1)

    def forward(
        self,
        user_id: torch.Tensor,
        movie_id: torch.Tensor,
        movie_genres: torch.Tensor,
    ) -> torch.Tensor:
        # GMF path
        gmf = self.emb_user_gmf(user_id) * self.emb_item_gmf(movie_id)

        # MLP path
        u_mlp = self.emb_user_mlp(user_id)
        i_mlp = self.emb_item_mlp(movie_id)
        g_proj = self.genre_linear(movie_genres)
        mlp_input = torch.cat([u_mlp, i_mlp, g_proj], dim=-1)
        mlp_out = self.mlp_layers(mlp_input)

        # Combine
        combined = torch.cat([gmf, mlp_out], dim=-1)
        logit = self.predict_layer(combined).squeeze(-1)
        return logit


# ═══════════════════════════════════════════════════════════════════════════
# 2. Supabase helpers
# ═══════════════════════════════════════════════════════════════════════════

def get_supabase_client() -> Client:
    """Instantiate an authenticated Supabase client from env vars."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)
    return create_client(url, key)


def _paginate_query(
    table_query,
    *,
    page_size: int = 1000,
) -> list[dict]:
    """Supabase JS paginates at 1 000 rows.  Fetch all pages."""
    all_rows: list[dict] = []
    offset = 0
    while True:
        resp = table_query.range(offset, offset + page_size - 1).execute()
        batch = resp.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return all_rows


# ═══════════════════════════════════════════════════════════════════════════
# 3. Data harmonisation
# ═══════════════════════════════════════════════════════════════════════════

def fetch_recent_interactions(sb: Client, since_iso: str) -> pd.DataFrame:
    """Fetch positive interactions from 3 tables and harmonise into one DF.

    Sources:
      • ratings   — rows where rating >= 4.0 AND created_at >= since_iso
      • favorites — rows where created_at >= since_iso
      • watch_history — rows where watched_at >= since_iso AND status = 'watched'

    Returns DataFrame[user_id: str, movie_id: int, label: float]
    with duplicates (same user–movie pair) dropped.
    """
    frames: list[pd.DataFrame] = []

    # ── 3a. Ratings (explicit, high-signal) ──────────────────────────────
    logger.info("Fetching ratings >= 4.0 since %s …", since_iso)
    rating_rows = _paginate_query(
        sb.table("ratings")
        .select("user_id, movie_id")
        .gte("rating", 4.0)
        .gte("created_at", since_iso)
    )
    if rating_rows:
        df_r = pd.DataFrame(rating_rows)[["user_id", "movie_id"]]
        df_r["label"] = 1.0
        frames.append(df_r)
        logger.info("  → %d high-rated interactions", len(df_r))
    else:
        logger.info("  → 0 high-rated interactions")

    # ── 3b. Favorites (explicit positive) ────────────────────────────────
    logger.info("Fetching favorites since %s …", since_iso)
    fav_rows = _paginate_query(
        sb.table("favorites")
        .select("user_id, movie_id")
        .gte("created_at", since_iso)
    )
    if fav_rows:
        df_f = pd.DataFrame(fav_rows)[["user_id", "movie_id"]]
        df_f["label"] = 1.0
        frames.append(df_f)
        logger.info("  → %d favourite interactions", len(df_f))
    else:
        logger.info("  → 0 favourite interactions")

    # ── 3c. Watch history (implicit, status='watched' only) ──────────────
    logger.info("Fetching watch_history since %s …", since_iso)
    wh_rows = _paginate_query(
        sb.table("watch_history")
        .select("user_id, movie_id")
        .eq("status", "watched")
        .gte("watched_at", since_iso)
    )
    if wh_rows:
        df_w = pd.DataFrame(wh_rows)[["user_id", "movie_id"]]
        df_w["label"] = 1.0
        frames.append(df_w)
        logger.info("  → %d watched interactions", len(df_w))
    else:
        logger.info("  → 0 watched interactions")

    # ── Combine & deduplicate ────────────────────────────────────────────
    if not frames:
        logger.warning("No new interactions found in the last 24 h.")
        return pd.DataFrame(columns=["user_id", "movie_id", "label"])

    combined = pd.concat(frames, ignore_index=True)
    before = len(combined)
    combined.drop_duplicates(subset=["user_id", "movie_id"], inplace=True)
    combined.reset_index(drop=True, inplace=True)
    logger.info(
        "Harmonised: %d total → %d unique user–movie pairs (dropped %d dupes)",
        before, len(combined), before - len(combined),
    )
    return combined


# ═══════════════════════════════════════════════════════════════════════════
# 4. Index mapping helpers
# ═══════════════════════════════════════════════════════════════════════════

def build_index_maps(sb: Client) -> tuple[dict[str, int], dict[int, int], dict[int, list[dict]]]:
    """Fetch model_user_index and movie_index mappings from Supabase.

    Returns:
        user_map  – {user_id(uuid str) → model_user_index(int)}
        movie_map – {movie_id(int)      → movie_index(int)}
        genre_map – {movie_id(int)      → genres JSONB list}
    """
    # Users with a model_user_index assigned
    logger.info("Building user index map …")
    user_rows = _paginate_query(
        sb.table("users")
        .select("id, model_user_index")
        .not_.is_("model_user_index", "null")
    )
    user_map = {r["id"]: r["model_user_index"] for r in user_rows}
    logger.info("  → %d users with model index", len(user_map))

    # Movies → movie_index + genres
    logger.info("Building movie index map …")
    movie_rows = _paginate_query(
        sb.table("movies").select("id, movie_index, genres")
    )
    movie_map = {r["id"]: r["movie_index"] for r in movie_rows}
    genre_map = {r["id"]: r.get("genres") for r in movie_rows}
    logger.info("  → %d movies indexed", len(movie_map))

    return user_map, movie_map, genre_map


def encode_genres_multihot(genres_jsonb: list[dict] | None) -> np.ndarray:
    """Convert JSONB genre list into a 20-dim multi-hot float32 vector."""
    vec = np.zeros(NUM_GENRES, dtype=np.float32)
    if not genres_jsonb:
        vec[GENRE_TO_IDX["(no genres listed)"]] = 1.0
        return vec
    for g in genres_jsonb:
        name = g.get("name", "")
        idx = GENRE_TO_IDX.get(name)
        if idx is not None:
            vec[idx] = 1.0
    if vec.sum() == 0:
        vec[GENRE_TO_IDX["(no genres listed)"]] = 1.0
    return vec


# ═══════════════════════════════════════════════════════════════════════════
# 5. Negative sampling
# ═══════════════════════════════════════════════════════════════════════════

def generate_negatives(
    positives: pd.DataFrame,
    num_items: int,
    movie_map: dict[int, int],
    genre_map: dict[int, list[dict]],
    ratio: int = NEGATIVE_RATIO,
) -> pd.DataFrame:
    """For each positive (user_index, movie_index) pair, sample `ratio`
    random movie_indexes that the user did NOT interact with as negatives.

    Returns DataFrame[user_index, movie_index, genre_vec, label].
    """
    rng = np.random.default_rng(seed=42)
    all_movie_ids = list(movie_map.keys())
    all_movie_indexes = np.array(list(movie_map.values()), dtype=np.int64)

    # Build per-user positive sets for fast lookup
    user_positives: dict[int, set[int]] = {}
    for _, row in positives.iterrows():
        uid = int(row["user_index"])
        mid = int(row["movie_index"])
        user_positives.setdefault(uid, set()).add(mid)

    neg_rows: list[dict] = []
    for user_idx, pos_set in user_positives.items():
        n_needed = len(pos_set) * ratio
        neg_indices: list[int] = []
        # Over-sample then filter to avoid positives
        attempts = 0
        while len(neg_indices) < n_needed and attempts < 20:
            candidates = rng.choice(all_movie_indexes, size=n_needed * 2, replace=True)
            for c in candidates:
                if int(c) not in pos_set:
                    neg_indices.append(int(c))
                    if len(neg_indices) >= n_needed:
                        break
            attempts += 1

        # Reverse-lookup movie_id from movie_index for genre encoding
        index_to_id = {v: k for k, v in movie_map.items()}
        for mi in neg_indices:
            mid = index_to_id.get(mi)
            gvec = encode_genres_multihot(genre_map.get(mid) if mid else None)
            neg_rows.append({
                "user_index": user_idx,
                "movie_index": mi,
                "genre_vec": gvec,
                "label": 0.0,
            })

    return pd.DataFrame(neg_rows)


# ═══════════════════════════════════════════════════════════════════════════
# 6. Training loop
# ═══════════════════════════════════════════════════════════════════════════

def incremental_train(
    model: NeuMF,
    positives_df: pd.DataFrame,
    movie_map: dict[int, int],
    genre_map: dict[int, list[dict]],
    num_items: int,
) -> NeuMF:
    """Run a brief incremental training loop on the harmonised interactions.

    Item embeddings are frozen to prevent catastrophic forgetting on the
    large item catalogue (only user embeddings, MLP, and prediction layer
    are updated).
    """
    device = torch.device("cpu")  # GitHub Actions runners are CPU-only
    model = model.to(device)

    # ── Freeze item embeddings ───────────────────────────────────────────
    for param in model.emb_item_gmf.parameters():
        param.requires_grad = False
    for param in model.emb_item_mlp.parameters():
        param.requires_grad = False
    logger.info("Item embeddings frozen (GMF + MLP).")

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info("Trainable parameters: %s / %s (%.1f%%)", f"{trainable:,}", f"{total:,}", 100 * trainable / total)

    # ── Prepare positive samples ─────────────────────────────────────────
    pos_genre_vecs = np.stack([
        encode_genres_multihot(genre_map.get(int(row["movie_id"])))
        for _, row in positives_df.iterrows()
    ])
    pos_data = pd.DataFrame({
        "user_index": positives_df["user_index"].values,
        "movie_index": positives_df["movie_index"].values,
        "label": 1.0,
    })
    pos_data["genre_vec"] = list(pos_genre_vecs)

    # ── Generate negative samples ────────────────────────────────────────
    neg_data = generate_negatives(pos_data, num_items, movie_map, genre_map)
    logger.info("Generated %d negative samples for %d positives.", len(neg_data), len(pos_data))

    # ── Combine into training set ────────────────────────────────────────
    train_df = pd.concat([pos_data, neg_data], ignore_index=True)
    train_df = train_df.sample(frac=1, random_state=42).reset_index(drop=True)  # shuffle

    # ── Convert to tensors ───────────────────────────────────────────────
    user_t = torch.tensor(train_df["user_index"].values, dtype=torch.long, device=device)
    item_t = torch.tensor(train_df["movie_index"].values, dtype=torch.long, device=device)
    genre_t = torch.tensor(np.stack(train_df["genre_vec"].values), dtype=torch.float32, device=device)
    label_t = torch.tensor(train_df["label"].values, dtype=torch.float32, device=device)

    # ── Optimiser & loss ─────────────────────────────────────────────────
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LEARNING_RATE,
    )
    criterion = nn.BCEWithLogitsLoss()

    n_samples = len(train_df)
    logger.info("Starting incremental training: %d samples, %d epochs, batch_size=%d",
                n_samples, NUM_EPOCHS, BATCH_SIZE)

    model.train()
    for epoch in range(1, NUM_EPOCHS + 1):
        epoch_loss = 0.0
        n_batches = 0
        for start in range(0, n_samples, BATCH_SIZE):
            end = min(start + BATCH_SIZE, n_samples)
            u = user_t[start:end]
            i = item_t[start:end]
            g = genre_t[start:end]
            y = label_t[start:end]

            optimizer.zero_grad()
            logits = model(u, i, g)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        avg_loss = epoch_loss / max(n_batches, 1)
        logger.info("  Epoch %d/%d — avg BCE loss: %.6f", epoch, NUM_EPOCHS, avg_loss)

    model.eval()
    logger.info("Incremental training complete.")
    return model


# ═══════════════════════════════════════════════════════════════════════════
# 7. ONNX export
# ═══════════════════════════════════════════════════════════════════════════

def export_to_onnx(model: NeuMF, path: Path) -> None:
    """Export the NeuMF model to ONNX format (opset 14).

    Input names and shapes match the existing production ONNX contract
    consumed by pipeline.py.
    """
    model.eval()
    dummy_user = torch.tensor([0], dtype=torch.long)
    dummy_item = torch.tensor([0], dtype=torch.long)
    dummy_genre = torch.zeros(1, NUM_GENRES, dtype=torch.float32)

    torch.onnx.export(
        model,
        (dummy_user, dummy_item, dummy_genre),
        str(path),
        opset_version=14,
        input_names=["user_id", "movie_id", "movie_genres"],
        output_names=["prediction_logit"],
        dynamic_axes={
            "user_id": {0: "batch_size"},
            "movie_id": {0: "batch_size"},
            "movie_genres": {0: "batch_size"},
            "prediction_logit": {0: "batch_size"},
        },
    )
    logger.info("ONNX model exported to %s", path)


# ═══════════════════════════════════════════════════════════════════════════
# 8. Hugging Face Hub upload / download
# ═══════════════════════════════════════════════════════════════════════════

def download_model(filename: str, dest: Path) -> None:
    """Download a model file from Hugging Face Hub."""
    logger.info("Downloading %s from repo '%s' …", filename, HF_REPO_ID)
    downloaded_path = hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=filename,
        token=os.environ.get("HF_TOKEN")
    )
    # Copy from HF cache to our dest Path
    import shutil
    shutil.copy2(downloaded_path, dest)
    size_mb = dest.stat().st_size / (1024 * 1024)
    logger.info("  → saved to %s (%.1f MB)", dest, size_mb)


def upload_model(filename: str, src: Path) -> None:
    """Upload a model file to Hugging Face Hub."""
    size_mb = src.stat().st_size / (1024 * 1024)
    logger.info("Uploading %s (%.1f MB) to repo '%s' …", filename, size_mb, HF_REPO_ID)

    api = HfApi()
    api.upload_file(
        path_or_fileobj=str(src),
        path_in_repo=filename,
        repo_id=HF_REPO_ID,
        repo_type="model",
        token=os.environ.get("HF_TOKEN")
    )
    logger.info("  → upload complete.")


def expand_user_embeddings_in_state_dict(state_dict: dict, num_new_users: int, embed_dim: int) -> dict:
    """Expand user embedding matrices in the state_dict for new users."""
    if num_new_users <= 0:
        return state_dict
    
    logger.info("Expanding PyTorch user embeddings for %d new users.", num_new_users)
    
    # Initialize new embeddings with standard deviation 0.01
    new_gmf = torch.randn(num_new_users, embed_dim) * 0.01
    new_mlp = torch.randn(num_new_users, embed_dim) * 0.01
    
    state_dict["emb_user_gmf.weight"] = torch.cat([state_dict["emb_user_gmf.weight"], new_gmf], dim=0)
    state_dict["emb_user_mlp.weight"] = torch.cat([state_dict["emb_user_mlp.weight"], new_mlp], dim=0)
    
    return state_dict

# ═══════════════════════════════════════════════════════════════════════════
# 9. Main orchestrator
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    logger.info("=" * 60)
    logger.info("NIGHTLY NeuMF INCREMENTAL RETRAIN — %s", datetime.now(timezone.utc).isoformat())
    logger.info("=" * 60)

    # ── Connect ──────────────────────────────────────────────────────────
    sb = get_supabase_client()

    # ── Time window ──────────────────────────────────────────────────────
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    since_iso = since.isoformat()

    # ── Step 1: Download current model ───────────────────────────────────
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        pth_path = tmpdir / PTH_FILENAME
        download_model(PTH_FILENAME, pth_path)

        # Load model to get current dims
        state_dict = torch.load(str(pth_path), map_location="cpu", weights_only=True)
        
        num_users = state_dict["emb_user_gmf.weight"].shape[0]
        num_items = state_dict["emb_item_gmf.weight"].shape[0]
        embed_dim = state_dict["emb_user_gmf.weight"].shape[1]
        
        logger.info(
            "Current model dimensions: %d users, %d items, %d embed_dim",
            num_users, num_items, embed_dim,
        )

        # ── Step 2: Fetch & harmonise interactions ───────────────────────────
        interactions = fetch_recent_interactions(sb, since_iso)
        if interactions.empty:
            logger.info("Nothing to train on.  Exiting cleanly.")
            return

        # ── Step 3: Build index maps & Handle New Users ──────────────────────
        user_map, movie_map, genre_map = build_index_maps(sb)

        interactions["movie_index"] = interactions["movie_id"].map(movie_map)
        
        # Drop unmapped movies
        before_movies = len(interactions)
        interactions.dropna(subset=["movie_index"], inplace=True)
        dropped_movies = before_movies - len(interactions)
        if dropped_movies:
            logger.warning(
                "Dropped %d interactions due to unmapped movies (catalog needs update).",
                dropped_movies,
            )

        # Map users
        interactions["user_index"] = interactions["user_id"].map(user_map)
        
        # Find unmapped users
        unmapped_mask = interactions["user_index"].isna()
        unmapped_user_ids = interactions[unmapped_mask]["user_id"].unique()
        num_new_users = len(unmapped_user_ids)
        
        if num_new_users > 0:
            logger.info("Found %d unmapped users. Assigning new model indices.", num_new_users)
            
            # Query the actual max model_user_index from the DB to avoid
            # collisions when a previous run assigned indices but crashed
            # before uploading updated weights.
            max_idx_resp = (
                sb.table("users")
                .select("model_user_index")
                .not_.is_("model_user_index", "null")
                .order("model_user_index", desc=True)
                .limit(1)
                .execute()
            )
            
            if max_idx_resp.data:
                db_max_idx = max_idx_resp.data[0]["model_user_index"]
                next_idx = db_max_idx + 1
            else:
                next_idx = num_users
            
            # Use the higher of model size vs DB max to be safe
            next_idx = max(next_idx, num_users)
            
            # If next_idx is higher than the model's current num_users, we MUST 
            # pad the model with dummy rows to bridge the gap, otherwise the new 
            # users will get indices that are out of bounds of the embedding matrix.
            pad_users = next_idx - num_users
            total_users_to_add = pad_users + num_new_users
            
            new_user_mappings = []
            for uid in unmapped_user_ids:
                new_user_mappings.append({"id": str(uid), "model_user_index": next_idx})
                user_map[str(uid)] = next_idx
                next_idx += 1
                
            # Upsert with conflict on primary key 'id'
            sb.table("users").upsert(new_user_mappings, on_conflict="id").execute()
            logger.info("Successfully upserted %d new users to Supabase.", num_new_users)
            
            # Remap interactions with the updated user_map
            interactions["user_index"] = interactions["user_id"].map(user_map)
            
            # Expand state dict (including any padding rows to bridge gaps)
            if total_users_to_add > 0:
                logger.info("Padding model with %d gap rows and %d new users...", pad_users, num_new_users)
                state_dict = expand_user_embeddings_in_state_dict(state_dict, total_users_to_add, embed_dim)
                num_users += total_users_to_add

        # Final drop to be absolutely safe
        interactions.dropna(subset=["user_index", "movie_index"], inplace=True)
        interactions["user_index"] = interactions["user_index"].astype(int)
        interactions["movie_index"] = interactions["movie_index"].astype(int)
        
        if interactions.empty:
            logger.info("No mappable interactions remain.  Exiting cleanly.")
            return
            
        logger.info("Final training set: %d positive interactions.", len(interactions))

        # ── Step 4: Validate Bounds & Load Model ───────────────────────────
        max_user_idx = interactions["user_index"].max()
        max_movie_idx = interactions["movie_index"].max()
        if max_user_idx >= num_users:
            logger.error(
                "User index %d exceeds model vocabulary (%d).  Aborting.",
                max_user_idx, num_users,
            )
            sys.exit(1)
        if max_movie_idx >= num_items:
            logger.error(
                "Movie index %d exceeds model vocabulary (%d).  Aborting.",
                max_movie_idx, num_items,
            )
            sys.exit(1)

        model = NeuMF(num_users, num_items, embed_dim)
        model.load_state_dict(state_dict)
        logger.info("Model loaded successfully.")

        # ── Step 5: Incremental training ─────────────────────────────────
        model = incremental_train(model, interactions, movie_map, genre_map, num_items)

        # ── Step 6: Save updated .pth ────────────────────────────────────
        updated_pth = tmpdir / PTH_FILENAME
        torch.save(model.state_dict(), str(updated_pth))
        logger.info("Updated .pth saved to %s", updated_pth)

        # ── Step 7: Export to ONNX ───────────────────────────────────────
        onnx_path = tmpdir / ONNX_FILENAME
        export_to_onnx(model, onnx_path)

        # ── Step 8: Upload back to Hugging Face Hub ──────────────────────
        upload_model(PTH_FILENAME, updated_pth)
        upload_model(ONNX_FILENAME, onnx_path)

    logger.info("=" * 60)
    logger.info("RETRAIN COMPLETE — all artefacts uploaded successfully.")
    logger.info("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logger.exception("Retrain pipeline failed with unhandled exception.")
        sys.exit(1)
