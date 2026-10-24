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


@router.get("/file-content")
async def get_file_content(
    file_path: str = Query(..., description="Absolute or repo-relative file path"),
    start_line: int = Query(None, description="Optional start line (1-indexed)"),
    end_line: int = Query(None, description="Optional end line (1-indexed)")
):
    """Retrieves file source code with line range for CodeDrawer inspection."""
    target_path = file_path
    if not os.path.isabs(target_path) and ingestion_manager.current_repo_path:
        target_path = os.path.join(ingestion_manager.current_repo_path, file_path)

    if not os.path.exists(target_path):
        # Also check against current working directory or dummy repo
        alt_path = os.path.abspath(file_path)
        if os.path.exists(alt_path):
            target_path = alt_path
        else:
            raise HTTPException(status_code=404, detail=f"File '{file_path}' not found on server.")

    try:
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read file: {e}")

    total_lines = len(lines)
    s_idx = max(1, start_line) if start_line else 1
    e_idx = min(total_lines, end_line) if end_line else total_lines

    snippet = "".join(lines[s_idx - 1:e_idx])
    ext = os.path.splitext(target_path)[1].lower()
    lang = "python" if ext == ".py" else ("cpp" if ext in [".cpp", ".h", ".hpp", ".cc"] else "plaintext")

    return {
        "file_path": file_path,
        "resolved_path": target_path,
        "start_line": s_idx,
        "end_line": e_idx,
        "total_lines": total_lines,
        "language": lang,
        "code": snippet
    }

