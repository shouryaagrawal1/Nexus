"""Pydantic schemas for conversational queries and LLM responses."""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.graph import GraphNode, GraphEdge

class CodeSnippet(BaseModel):
    file_path: str
    language: str
    start_line: int
    end_line: int
    code: str

class QueryRequest(BaseModel):
    query: str = Field(..., description="User's architectural or code question")
    chat_history: List[Dict[str, Any]] = Field(default=[], description="Prior messages for context")

class QueryResponse(BaseModel):
    response_text: str # Prose explanation with [[Entity]] pills
    file_pills: List[str] # List of extracted files/classes/functions for UI pill rendering
    snippets: List[CodeSnippet] # Real code blocks directly from local source files
    graph_data: Dict[str, Any] # Formatted for React Flow: {"nodes": [...], "edges": [...]}
