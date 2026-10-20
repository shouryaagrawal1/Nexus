"""ChromaDB vector database service for AST-aware code chunks and embeddings."""
import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings

logger = logging.getLogger("nexus.chroma")

class ChromaService:
    def __init__(self):
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection = None

    def get_client(self) -> chromadb.ClientAPI:
        if not self._client:
            os.makedirs(settings.chroma_db_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=settings.chroma_db_dir,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
        return self._client

    def get_collection(self):
        if self._collection is None:
            client = self.get_client()
            self._collection = client.get_or_create_collection(
                name="code_chunks",
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    def check_health(self) -> bool:
        try:
            client = self.get_client()
            return client.heartbeat() is not None
        except Exception as e:
            logger.error(f"ChromaDB health check failed: {e}")
            return False

    def batch_add_chunks(self, chunks: List[Dict[str, Any]], batch_size: int = 100):
        """Adds AST code chunks to ChromaDB in batches of 100 according to spec section 4.2."""
        if not chunks:
            return
        collection = self.get_collection()
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            ids = [c["id"] for c in batch]
            documents = [c["document"] for c in batch]
            metadatas = [c.get("metadata", {}) for c in batch]
            
            # Upsert so re-indexing works idempotently
            collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )

    def query_similar(self, query: str, n_results: int = 5, distance_threshold: float = 0.85) -> List[Dict[str, Any]]:
        """Retrieves the top N most semantically relevant code chunks with distance filtering."""
        collection = self.get_collection()
        total_count = collection.count()
        if total_count == 0:
            return []

        limit = min(n_results, total_count)
        results = collection.query(
            query_texts=[query],
            n_results=limit,
            include=["documents", "metadatas", "distances"]
        )

        formatted = []
        if results and "ids" in results and results["ids"]:
            ids = results["ids"][0]
            docs = results["documents"][0] if "documents" in results and results["documents"] else []
            metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else []
            distances = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(ids)

            for i in range(len(ids)):
                dist = distances[i] if i < len(distances) else 0.0
                if dist <= distance_threshold:
                    formatted.append({
                        "id": ids[i],
                        "document": docs[i] if i < len(docs) else "",
                        "metadata": metas[i] if i < len(metas) else {},
                        "distance": dist
                    })
        return formatted

chroma_service = ChromaService()
