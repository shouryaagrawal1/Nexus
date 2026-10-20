"""Pydantic schemas for graph nodes, edges, and impact analysis."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class GraphNode(BaseModel):
    id: str
    label: str # e.g., "BaseDBWorker"
    type: str  # "Class" | "Function" | "File"
    file_path: str
    line_number: int = 1
    metadata: Optional[Dict[str, Any]] = None

class GraphEdge(BaseModel):
    source: str # node_id
    target: str # node_id
    relationship_type: str # "CALLS" | "INHERITS_FROM" | "CONTAINS" | "DEFINED_IN"
    resolution: Optional[str] = "name_match" # Notes approximation boundaries

class ImpactResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
