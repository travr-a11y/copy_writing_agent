"""Document ingestion: parsing, chunking, and embedding."""
import os
import uuid
import csv
import markdown
from typing import List, Tuple
from docx import Document as DocxDocument
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.document import Document
from app.services.vectorstore import add_chunks

settings = get_settings()


def read_file_content(file_path: str, file_type: str) -> str:
    """Read content from various file types."""
    if file_type == "txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    
    elif file_type == "md":
        with open(file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
            # Convert markdown to plain text (strip formatting)
            html = markdown.markdown(md_content)
            # Simple HTML to text (remove tags)
            import re
            text = re.sub(r'<[^>]+>', ' ', html)
            return text
    
    elif file_type == "docx":
        doc = DocxDocument(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    
    elif file_type == "csv":
        rows = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                rows.append(" | ".join(row))
        return "\n".join(rows)
    
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def chunk_text(
    text: str,
    chunk_size: int = None,
    overlap: int = None
) -> List[Tuple[str, int]]:
    """
    Split text into chunks with overlap.
    Returns list of (chunk_text, chunk_index).
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap
    
    # Split into sentences (simple approach)
    sentences = []
    current = ""
    for char in text:
        current += char
        if char in ".!?" and len(current) > 10:
            sentences.append(current.strip())
            current = ""
    if current.strip():
        sentences.append(current.strip())
    
    # Build chunks from sentences
    chunks = []
    current_chunk = []
    current_length = 0
    chunk_index = 0
    
    for sentence in sentences:
        sentence_words = len(sentence.split())
        
        if current_length + sentence_words > chunk_size and current_chunk:
            # Save current chunk
            chunk_text = " ".join(current_chunk)
            chunks.append((chunk_text, chunk_index))
            chunk_index += 1
            
            # Start new chunk with overlap
            overlap_sentences = []
            overlap_length = 0
            for s in reversed(current_chunk):
                s_words = len(s.split())
                if overlap_length + s_words <= overlap:
                    overlap_sentences.insert(0, s)
                    overlap_length += s_words
                else:
                    break
            
            current_chunk = overlap_sentences
            current_length = overlap_length
        
        current_chunk.append(sentence)
        current_length += sentence_words
    
    # Add final chunk
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append((chunk_text, chunk_index))
    
    return chunks


async def process_document(document: Document, db: Session) -> int:
    """
    Process a document: read, chunk, and embed into Chroma.
    Returns the number of chunks created.
    """
    # Read content
    content = read_file_content(document.file_path, document.file_type)
    
    if not content.strip():
        return 0
    
    # Chunk content
    chunks = chunk_text(content)
    
    if not chunks:
        return 0
    
    # Prepare for vector store
    chunk_ids = []
    chunk_texts = []
    metadatas = []
    
    for text_content, chunk_index in chunks:
        chunk_id = str(uuid.uuid4())
        chunk_ids.append(chunk_id)
        chunk_texts.append(text_content)
        metadatas.append({
            "document_id": document.id,
            "campaign_id": document.campaign_id,
            "doc_type": document.doc_type or "unknown",
            "channel": document.channel or "",
            "industry": document.industry or "",
            "role": document.role or "",
            "chunk_index": chunk_index,
            "filename": document.filename,
        })
    
    # Add to vector store
    added = add_chunks(chunk_ids, chunk_texts, metadatas)
    
    return added
