"""
RAG-based prompt store using FAISS + sentence-transformers.

Embeds past successful prompts and retrieves semantically similar ones
as few-shot examples to improve LLM prompt refinement quality.

Flow:
  - After each successful generation: add_prompt(original, refined)
  - Before each /refine-prompt call: retrieve_similar(query) → inject into LLM context
"""
import os
import pickle
import threading
import logging

logger = logging.getLogger(__name__)

_STORE_DIR = os.path.join(os.path.dirname(__file__), "rag_data")
_INDEX_PATH = os.path.join(_STORE_DIR, "prompts.index")
_META_PATH = os.path.join(_STORE_DIR, "prompts_meta.pkl")

_DIM = 384          # all-MiniLM-L6-v2 embedding dimension
_DIST_THRESHOLD = 1.2  # L2 distance cutoff — above this, results are too dissimilar

_lock = threading.Lock()
_index = None
_meta: list[dict] = []   # [{"original": str, "refined": str}, ...]
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("[RAG] Loaded embedding model: all-MiniLM-L6-v2")
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
            logger.info(f"[RAG] Loaded index: {_index.ntotal} stored prompts")
            return _index
        except Exception as e:
            logger.warning(f"[RAG] Could not load existing index, starting fresh: {e}")

    _index = faiss.IndexFlatL2(_DIM)
    _meta = []
    logger.info("[RAG] Created fresh FAISS index (dim=384)")
    return _index


def _save() -> None:
    """Persist index and metadata to disk. Must be called inside _lock."""
    import faiss
    os.makedirs(_STORE_DIR, exist_ok=True)
    faiss.write_index(_index, _INDEX_PATH)
    with open(_META_PATH, "wb") as f:
        pickle.dump(_meta, f)


def add_prompt(original: str, refined: str) -> None:
    """
    Embed `original` and store the (original, refined) pair.
    Called in a background thread after every successful image generation.
    """
    with _lock:
        try:
            idx = _get_index()
            model = _get_model()
            vec = model.encode([original], normalize_embeddings=True).astype("float32")
            idx.add(vec)
            _meta.append({"original": original, "refined": refined})
            _save()
            logger.info(f"[RAG] Indexed prompt #{idx.ntotal}: {original[:60]!r}")
        except Exception as e:
            logger.warning(f"[RAG] add_prompt failed (non-fatal): {e}")


def retrieve_similar(query: str, k: int = 3) -> list[str]:
    """
    Return up to k refined prompts semantically similar to `query`.
    Returns [] when the index is empty or no results pass the distance threshold.
    """
    with _lock:
        try:
            idx = _get_index()
            if idx.ntotal == 0:
                return []
            model = _get_model()
            vec = model.encode([query], normalize_embeddings=True).astype("float32")
            actual_k = min(k, idx.ntotal)
            distances, indices = idx.search(vec, actual_k)
            results = [
                _meta[i]["refined"]
                for dist, i in zip(distances[0], indices[0])
                if i != -1 and dist < _DIST_THRESHOLD
            ]
            logger.info(f"[RAG] Retrieved {len(results)}/{actual_k} similar prompts for: {query[:50]!r}")
            return results
        except Exception as e:
            logger.warning(f"[RAG] retrieve_similar failed (non-fatal): {e}")
            return []
