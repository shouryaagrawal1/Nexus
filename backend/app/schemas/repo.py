"""Pydantic schemas for repository connection and ingestion."""
from typing import List, Optional
from pydantic import BaseModel, Field

class RepoConnectRequest(BaseModel):
    absolute_path: str = Field(..., description="Absolute path to the repository on local machine")
    languages: List[str] = Field(default=["python", "cpp"], description="Languages to include for parsing")
    exclude_folders: List[str] = Field(
        default=["node_modules", "venv", ".venv", "build", ".git", "__pycache__", ".chroma_data", "neo4j_data"],
        description="Folder names to skip during indexing"
    )

class RepoConnectResponse(BaseModel):
    status: str
    session_id: str
    valid_files_count: int
    message: str

class IngestEvent(BaseModel):
    stage: str # "AST_PARSING" | "GRAPH_MAPPING" | "VECTOR_EMBEDDING" | "COMPLETE" | "ERROR"
    current: int
    total: int
    message: str
