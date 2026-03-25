"""
Semantic image search using FAISS + sentence-transformers.

Indexes each user's generated images (prompt + image_url) so they can
search their creations with natural language queries.

Separate from rag_store.py — that's for prompt refinement few-shot context;
this is for user-facing search of their own image history.
"""
import os
import pickle
import threading
import logging

logger = logging.getLogger(__name__)

_STORE_DIR = os.path.join(os.path.dirname(__file__), "rag_data")
_INDEX_PATH = os.path.join(_STORE_DIR, "search.index")
_META_PATH = os.path.join(_STORE_DIR, "search_meta.pkl")

_DIM = 384
_DIST_THRESHOLD = 1.4  # slightly looser than rag_store — search should be more permissive

_lock = threading.Lock()
_index = None
_meta: list[dict] = []   # [{"user_id": str, "prompt": str, "image_url": str}, ...]
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_index():
    global _index, _meta
    if _index is not None:
        return _index

    import faiss
    os.makedirs(_STORE_DIR, exist_ok=True)

    if os.path.exists(_INDEX_PATH) and os.path.exists(_META_PATH):
        try:
            _index = faiss.read_index(_INDEX_PATH)
            with open(_META_PATH, "rb") as f:
                _meta = pickle.load(f)
            logger.info(f"[SEARCH] Loaded index: {_index.ntotal} images")
            return _index
        except Exception as e:
            logger.warning(f"[SEARCH] Index load failed, starting fresh: {e}")

    _index = faiss.IndexFlatL2(_DIM)
    _meta = []
    logger.info("[SEARCH] Created fresh image search index")
    return _index


def _save() -> None:
    import faiss
    os.makedirs(_STORE_DIR, exist_ok=True)
    faiss.write_index(_index, _INDEX_PATH)
    with open(_META_PATH, "wb") as f:
        pickle.dump(_meta, f)


def index_image(user_id: str, prompt: str, image_url: str) -> None:
    """
    Embed the prompt and store (user_id, prompt, image_url).
    Called in a background thread after every successful text-to-image generation.
    """
    with _lock:
        try:
            idx = _get_index()
            model = _get_model()
            vec = model.encode([prompt], normalize_embeddings=True).astype("float32")
            idx.add(vec)
            _meta.append({"user_id": user_id, "prompt": prompt, "image_url": image_url})
            _save()
            logger.info(f"[SEARCH] Indexed image #{idx.ntotal} for user {user_id[:8]}: {prompt[:50]!r}")
        except Exception as e:
            logger.warning(f"[SEARCH] index_image failed (non-fatal): {e}")


def search_images(user_id: str, query: str, k: int = 12) -> list[dict]:
    """
    Return up to k images for `user_id` whose prompts are semantically
    similar to `query`. Each result: {"prompt": str, "image_url": str}.
    """
    with _lock:
        try:
            idx = _get_index()
            if idx.ntotal == 0:
                return []
            model = _get_model()
            vec = model.encode([query], normalize_embeddings=True).astype("float32")
            # Search a larger pool then filter by user_id
            search_k = min(idx.ntotal, k * 10)
            distances, indices = idx.search(vec, search_k)
            results = []
            for dist, i in zip(distances[0], indices[0]):
                if i == -1:
                    continue
                entry = _meta[i]
                if entry["user_id"] != user_id:
                    continue
                if dist > _DIST_THRESHOLD:
                    continue
                results.append({"prompt": entry["prompt"], "image_url": entry["image_url"]})
                if len(results) >= k:
                    break
            logger.info(f"[SEARCH] Query {query[:40]!r} → {len(results)} results for user {user_id[:8]}")
            return results
        except Exception as e:
            logger.warning(f"[SEARCH] search_images failed (non-fatal): {e}")
            return []
