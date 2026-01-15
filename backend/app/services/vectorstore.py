"""Chroma vector store operations."""
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
from functools import lru_cache

from app.config import get_settings

settings = get_settings()


@lru_cache()
def get_embedding_model():
    """Get cached embedding model."""
    print(f"Loading embedding model: {settings.embedding_model}")
    return SentenceTransformer(settings.embedding_model)


@lru_cache()
def get_chroma_client():
    """Get cached Chroma client with persistence."""
    return chromadb.PersistentClient(
        path=settings.chroma_persist_path,
        settings=ChromaSettings(anonymized_telemetry=False)
    )


def get_collection(name: str = "knowledge_bank"):
    """Get or create a Chroma collection."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"schema_version": "1"}
    )


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for texts."""
    model = get_embedding_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()


def add_chunks(
    chunk_ids: List[str],
    chunks: List[str],
    metadatas: List[Dict[str, Any]],
    collection_name: str = "knowledge_bank"
) -> int:
    """Add chunks to the vector store."""
    if not chunks:
        return 0
    
    collection = get_collection(collection_name)
    embeddings = embed_texts(chunks)
    
    collection.add(
        ids=chunk_ids,
        documents=chunks,
        metadatas=metadatas,
        embeddings=embeddings
    )
    
    return len(chunks)


def query_similar(
    query_text: str,
    n_results: int = 5,
    where: Optional[Dict[str, Any]] = None,
    collection_name: str = "knowledge_bank"
) -> List[Dict[str, Any]]:
    """Query similar chunks from the vector store."""
    collection = get_collection(collection_name)
    
    query_embedding = embed_texts([query_text])[0]
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where=where,
        include=["documents", "metadatas", "distances"]
    )
    
    # Format results
    formatted = []
    if results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            formatted.append({
                "document": doc,
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else None
            })
    
    return formatted


def delete_by_document_id(document_id: str, collection_name: str = "knowledge_bank"):
    """Delete all chunks for a document."""
    collection = get_collection(collection_name)
    
    # Get all IDs for this document
    results = collection.get(
        where={"document_id": document_id},
        include=[]
    )
    
    if results["ids"]:
        collection.delete(ids=results["ids"])
    
    return len(results["ids"]) if results["ids"] else 0


def delete_by_campaign_id(campaign_id: str, collection_name: str = "knowledge_bank"):
    """Delete all chunks for a campaign."""
    collection = get_collection(collection_name)
    
    results = collection.get(
        where={"campaign_id": campaign_id},
        include=[]
    )
    
    if results["ids"]:
        collection.delete(ids=results["ids"])
    
    return len(results["ids"]) if results["ids"] else 0
