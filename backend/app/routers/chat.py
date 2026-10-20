"""FastAPI route for conversational AI queries."""
from fastapi import APIRouter, HTTPException
from app.schemas.chat import QueryRequest, QueryResponse
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("/query", response_model=QueryResponse)
async def chat_query(request: QueryRequest):
    """Executes dual-engine retrieval and queries Gemini LLM."""
    try:
        response = rag_service.execute_query(request.query, request.chat_history)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "LLMExecutionError", "message": str(e)}
        )
