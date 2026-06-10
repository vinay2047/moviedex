# MovieDex

MovieDex is an AI-powered personalized movie recommendation engine. It goes beyond simple "popular" or "trending" lists by employing a state-of-the-art **Two-Stage Recommendation Pipeline** to truly understand your unique tastes.

## 🧠 AI/ML Architecture: Two-Stage Pipeline

MovieDex relies on a modern, production-grade recommendation pipeline, similar to architectures used by large-scale streaming platforms. It is broken into two distinct stages: **Retrieval** and **Ranking**.

### Stage 1: Retrieval (Two-Tower Architecture)
The goal of the retrieval stage is to rapidly filter down millions of potential movies to a small subset (e.g., top 100) of strong candidates.

* **The Model:** We use a **Two-Tower Neural Network**. One "tower" learns to embed users (based on their watch history, favorites, and ratings), while the other "tower" embeds items (movies). 
* **The Execution:** These towers map both users and movies into a shared 32-dimensional vector space. In production, we don't run the full model for retrieval. Instead, we pre-compute the movie vectors and store them in PostgreSQL. We then use the **`pgvector`** extension to perform ultra-fast Approximate Nearest Neighbor (ANN) search (using negative inner product `<#>`) to retrieve the top-K candidates that match the user's learned embedding.
* **Cold-Start Fallback:** For brand new users without a trained embedding, the system dynamically generates a centroid vector based on their onboarding selections and uses metadata heuristics to provide a safe, high-quality initial experience.

### Stage 2: Ranking (NeuMF - Neural Matrix Factorization)
The retrieval stage is fast, but coarse. The ranking stage takes the top-K candidates from Stage 1 and meticulously scores them to find the absolute best matches.

* **The Model:** We use **NeuMF** (Neural Matrix Factorization), which combines traditional generalized matrix factorization (GMF) with a multi-layer perceptron (MLP). This allows the model to capture both linear and complex non-linear interactions between users and movies.
* **The Execution:** The NeuMF model is exported to **ONNX** and runs seamlessly within the FastAPI backend using `onnxruntime`. The ONNX InferenceSession vectorizes the candidates and re-ranks them in milliseconds, returning the final sorted list of personalized recommendations.

### 🔄 Nightly Retraining
The system gets smarter every day. A GitHub Actions workflow (`.github/workflows/nightly-retrain.yml`) triggers an automated nightly retraining job. It pulls the latest user interactions (ratings, watch history, favorites), retrains both the Two-Tower and NeuMF models, and hot-swaps the updated weights into production.

---

## 🏗️ Application Architecture

MovieDex isn't just an ML model; it's a complete, modern web application.

### Frontend
* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Design:** A premium, minimalist UI featuring dynamic ripple backgrounds, seamless light/dark mode harmony, glassmorphism, and optimistic UI updates for instantaneous interactivity.

### Backend
* **Framework:** FastAPI
* **Language:** Python
* **Inference:** PyTorch (for Two-Tower lookup) & ONNX Runtime (for NeuMF ranking) 
* **Concurrency:** CPU-bound ML inferences are safely dispatched to thread pools to ensure the async event loop is never blocked.

### Database
* **Provider:** Supabase
* **Engine:** PostgreSQL
* **Extensions:** `pgvector` for vector similarity search.
* **ORM:** SQLAlchemy (async)

## 🚀 Getting Started

*(Instructions for local setup and environment variables go here)*
