"""FastAPI route for system health indicators."""
from fastapi import APIRouter
from app.services.chroma_service import chroma_service
from app.services.neo4j_service import neo4j_service
from app.services.rag_service import rag_service

router = APIRouter(tags=["Health"])

@router.get("/api/health")
async def health_check():
    """Polls local services to drive the Server Health Indicators in the frontend sidebar."""
    chroma_ok = chroma_service.check_health()
    neo4j_ok = neo4j_service.check_health()
    llm_ok = rag_service.check_health()

    all_operational = chroma_ok and neo4j_ok and llm_ok
    return {
        "status": "operational" if all_operational else "degraded",
        "services": {
            "chromadb": "connected" if chroma_ok else "disconnected",
            "neo4j": "connected" if neo4j_ok else "disconnected",
            "llm_api": "ready" if llm_ok else "missing_key"
        }
    }
