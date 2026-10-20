"""FastAPI routes for graph visualization and blast radius retrieval."""
from fastapi import APIRouter, HTTPException
from app.services.neo4j_service import neo4j_service
from app.schemas.graph import ImpactResponse

router = APIRouter(prefix="/api/graph", tags=["Graph"])

@router.get("/node-impact/{node_id}", response_model=ImpactResponse)
async def get_node_impact(node_id: str):
    """Retrieves 1st and 2nd degree connections for clicked node in Architecture Canvas."""
    impact = neo4j_service.get_node_impact(node_id)
    if not impact["nodes"]:
        raise HTTPException(
            status_code=404,
            detail={"error": "NodeNotFound", "message": f"Architecture node '{node_id}' could not be found."}
        )
    return impact

@router.get("/galaxy")
async def get_galaxy_view(limit: int = 250):
    """Returns top-level repository nodes and edges for initial Galaxy View."""
    galaxy = neo4j_service.get_galaxy_view(limit=limit)
    return {
        "nodes": [n.model_dump() for n in galaxy["nodes"]],
        "edges": [e.model_dump() for e in galaxy["edges"]]
    }
