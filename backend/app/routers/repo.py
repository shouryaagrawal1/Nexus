"""Repository connection and ingestion streaming routes."""
import os
import json
from fastapi import APIRouter, HTTPException, Query
from sse_starlette.sse import EventSourceResponse
from app.schemas.repo import RepoConnectRequest, RepoConnectResponse
from app.services.parser import code_parser
from app.services.ingestion_service import ingestion_manager

router = APIRouter(prefix="/api/repo", tags=["Repository"])

@router.post("/connect", response_model=RepoConnectResponse)
async def connect_repo(request: RepoConnectRequest):
    """Validates local directory path and initializes ingestion session."""
    raw_path = os.path.abspath(request.absolute_path)
    if not os.path.exists(raw_path) or not os.path.isdir(raw_path):
        raise HTTPException(
            status_code=400,
            detail={"error": "PathNotFound", "message": f"The directory '{raw_path}' does not exist or is not accessible."}
        )

    valid_count = code_parser.count_valid_files(raw_path, request.exclude_folders, request.languages)
    if valid_count == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "EmptyRepository", "message": "No valid Python or C++ files found in the specified path."}
        )

    session_id = ingestion_manager.start_session(
        repo_path=raw_path,
        languages=request.languages,
        exclude_folders=request.exclude_folders
    )

    return RepoConnectResponse(
        status="success",
        session_id=session_id,
        valid_files_count=valid_count,
        message="Repository validated. Ready for ingestion."
    )

@router.get("/ingest/status")
async def stream_ingest_status(session_id: str = Query(..., description="Session ID from /api/repo/connect")):
    """Server-Sent Events (SSE) streaming real-time progress of AST parsing and DB indexing."""
    async def event_generator():
        async for event in ingestion_manager.run_ingestion_stream(session_id):
            yield {
                "event": "message",
                "data": json.dumps(event)
            }

    return EventSourceResponse(event_generator())
